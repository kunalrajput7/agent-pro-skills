#!/usr/bin/env python3
"""
score.py — Detailed JSON scoring analysis for agent-pro-skills skill folders.

Usage: python score.py <skill-folder-path>

Outputs a JSON object with dimensional scores, issues, and a letter grade.
No external dependencies — uses only Python standard library.
"""

import json
import os
import re
import sys
from pathlib import Path


# =============================================================================
# Token estimation
# =============================================================================

def count_approximate_tokens(text: str) -> int:
    """Approximate token count as word_count * 1.3."""
    words = text.split()
    return int(len(words) * 1.3)


# =============================================================================
# Frontmatter extraction
# =============================================================================

def extract_frontmatter(content: str) -> dict:
    """
    Parse YAML frontmatter between the first pair of --- delimiters.
    Returns a flat dict of key: value strings. Does not depend on PyYAML.
    """
    match = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return {}

    fm_block = match.group(1)
    result = {}
    current_key = None

    for line in fm_block.splitlines():
        # Skip blank lines and comments
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue

        # Key: value pairs
        kv = re.match(r"^([A-Za-z_][A-Za-z0-9_-]*)\s*:\s*(.*)", line)
        if kv:
            current_key = kv.group(1).strip()
            value = kv.group(2).strip().strip("\"'")
            result[current_key] = value
        elif current_key and line.startswith("  "):
            # Continuation or list item — append to previous key
            result[current_key] += " " + stripped.lstrip("- ").strip("\"'")

    return result


def get_body(content: str) -> str:
    """Return everything after the closing --- of frontmatter."""
    match = re.match(r"^---\s*\n.*?\n---\s*\n?(.*)", content, re.DOTALL)
    return match.group(1) if match else content


# =============================================================================
# Scoring dimensions
# =============================================================================

def score_structure(skill_dir: Path) -> dict:
    """
    Structure dimension — up to 30 points.

    Checks:
    - SKILL.md exists (8 pts)
    - Frontmatter valid (6 pts)
    - Name is kebab-case (6 pts)
    - Description present and under 200 chars (5 pts)
    - All referenced scripts exist (5 pts)
    """
    score = 0
    issues = []
    skill_md = skill_dir / "SKILL.md"

    # SKILL.md exists
    if skill_md.is_file():
        score += 8
    else:
        issues.append("SKILL.md not found")
        return {"score": score, "max": 30, "issues": issues}

    content = skill_md.read_text(encoding="utf-8", errors="replace")
    fm = extract_frontmatter(content)

    # Frontmatter valid
    if fm:
        score += 6
    else:
        issues.append("YAML frontmatter missing or malformed")

    # Name is kebab-case
    name = fm.get("name", "")
    if name and re.match(r"^[a-z][a-z0-9-]*$", name):
        score += 6
    elif not name:
        issues.append("name field missing in frontmatter")
    else:
        issues.append(f"name '{name}' is not kebab-case")

    # Description present and under 200 chars
    desc = fm.get("description", "")
    if desc and len(desc) < 200:
        score += 5
    elif not desc:
        issues.append("description field missing")
    else:
        issues.append(f"description is {len(desc)} chars (must be under 200)")

    # Referenced scripts exist
    script_refs = re.findall(r"scripts/[a-zA-Z0-9_-]+\.\w+", content)
    missing_scripts = [s for s in script_refs if not (skill_dir / s).is_file()]
    if not missing_scripts:
        score += 5
    else:
        for ms in missing_scripts:
            issues.append(f"Referenced script '{ms}' not found")

    return {"score": score, "max": 30, "issues": issues}


def score_clarity(content: str) -> dict:
    """
    Clarity dimension — up to 30 points.

    Checks:
    - Step-by-step instructions / numbered lists (8 pts)
    - Examples / Usage section present (8 pts)
    - Scope boundaries defined (7 pts)
    - Imperative voice usage (7 pts)
    """
    score = 0
    issues = []
    body = get_body(content)

    # Step-by-step instructions
    if re.search(r"(^\d+\.\s|\bStep\s+\d+)", body, re.MULTILINE):
        score += 8
    else:
        issues.append("No numbered steps or 'Step N' patterns found")

    # Examples / Usage section
    if re.search(r"^##\s+(Examples?|Usage)", body, re.MULTILINE | re.IGNORECASE):
        score += 8
    else:
        issues.append("Missing '## Examples' or '## Usage' section")

    # Scope boundaries
    if re.search(r"\b(do not|don't|should not|must not|never )\b", body, re.IGNORECASE):
        score += 7
    else:
        issues.append("No scope boundaries (missing 'do not' / 'should not' guidance)")

    # Imperative voice — look for common imperative verbs at line starts
    imperative_pattern = r"^(Use |Run |Create |Check |Ensure |Verify |Set |Add |Remove |Install |Copy |Delete |Read |Write |Parse |Generate |Build |Deploy |Test |Validate )"
    imperative_hits = len(re.findall(imperative_pattern, body, re.MULTILINE))
    if imperative_hits >= 3:
        score += 7
    elif imperative_hits >= 1:
        score += 4
        issues.append("Limited imperative voice usage (found only a few directive statements)")
    else:
        issues.append("No imperative voice detected (instructions should start with action verbs)")

    return {"score": score, "max": 30, "issues": issues}


def score_specificity(content: str, frontmatter: dict) -> dict:
    """
    Specificity dimension — up to 30 points.

    Checks:
    - Description specificity — no vague words without triggers (10 pts)
    - Trigger conditions documented (10 pts)
    - Non-trigger / out-of-scope conditions (10 pts)
    """
    score = 0
    issues = []
    body = get_body(content)
    desc = frontmatter.get("description", "")

    # Description specificity
    vague_words = re.findall(r"\b(helpful|useful|various|diverse|general purpose)\b", desc, re.IGNORECASE)
    if not vague_words:
        score += 10
    else:
        issues.append(f"Description contains vague word(s): {', '.join(vague_words)}")

    # Trigger conditions
    trigger_patterns = [
        r"\b(when|trigger|activate|invoke|if the user)\b",
        r"^##\s+(When to use|Triggers?)",
    ]
    has_triggers = any(
        re.search(p, body, re.MULTILINE | re.IGNORECASE) for p in trigger_patterns
    )
    # Also check frontmatter for trigger fields
    has_fm_triggers = any(k.lower().startswith("trigger") for k in frontmatter)

    if has_triggers or has_fm_triggers:
        score += 10
    else:
        issues.append("No trigger conditions found (when should this skill activate?)")

    # Non-trigger / out-of-scope conditions
    non_trigger_patterns = [
        r"\b(do not|don't|should not|must not|never )\s+(use|run|invoke|trigger|activate)",
        r"^##\s+(Out of scope|Non-triggers?|Limitations?|Boundaries)",
        r"\b(this skill is not|not intended for|not designed for)\b",
    ]
    has_non_triggers = any(
        re.search(p, body, re.MULTILINE | re.IGNORECASE) for p in non_trigger_patterns
    )
    if has_non_triggers:
        score += 10
    else:
        issues.append("No non-trigger / out-of-scope conditions found")

    return {"score": score, "max": 30, "issues": issues}


def score_advanced(skill_dir: Path) -> dict:
    """
    Advanced dimension — up to 10 points.

    Checks:
    - Progressive disclosure (references/ used for large skills) (4 pts)
    - Script error handling (3 pts)
    - Security clean (3 pts)
    """
    score = 0
    issues = []
    skill_md = skill_dir / "SKILL.md"

    if not skill_md.is_file():
        return {"score": 0, "max": 10, "issues": ["SKILL.md not found"]}

    content = skill_md.read_text(encoding="utf-8", errors="replace")
    body = get_body(content)
    token_count = count_approximate_tokens(body)

    # Progressive disclosure
    refs_dir = skill_dir / "references"
    has_refs = refs_dir.is_dir() and any(refs_dir.iterdir())
    if token_count <= 2000:
        score += 4  # Not needed for short skills
    elif has_refs:
        score += 4
    else:
        issues.append(f"SKILL.md is ~{token_count} tokens but has no references/ content for progressive disclosure")

    # Script error handling
    scripts_dir = skill_dir / "scripts"
    scripts_ok = True
    if scripts_dir.is_dir():
        for script_file in scripts_dir.iterdir():
            if not script_file.is_file():
                continue
            try:
                script_content = script_file.read_text(encoding="utf-8", errors="replace")
            except Exception:
                continue

            if script_file.suffix == ".sh":
                if not re.search(r"set -e|set -euo pipefail", script_content):
                    issues.append(f"Script '{script_file.name}' missing 'set -e' or 'set -euo pipefail'")
                    scripts_ok = False
            elif script_file.suffix == ".py":
                if "try:" not in script_content or "except" not in script_content:
                    issues.append(f"Script '{script_file.name}' missing try/except error handling")
                    scripts_ok = False

    if scripts_ok:
        score += 3
    # Partial credit: at least some scripts have handling
    elif score == 0:
        pass

    # Security clean
    security_clean = True
    all_files = list(skill_dir.rglob("*"))
    text_extensions = {".sh", ".py", ".js", ".ts", ".md", ".yaml", ".yml", ".json", ".toml", ".txt"}

    for f in all_files:
        if not f.is_file() or f.suffix not in text_extensions:
            continue
        try:
            fc = f.read_text(encoding="utf-8", errors="replace")
        except Exception:
            continue

        # Hardcoded secrets
        if re.search(r"(API_KEY|token|password|secret)\s*=\s*[\"'][^\s\"']{4,}", fc):
            if not re.search(r"(example|placeholder|your_|changeme|xxx)", fc, re.IGNORECASE):
                issues.append(f"Potential hardcoded secret in {f.name}")
                security_clean = False

        # Unsafe execution
        if re.search(r"(curl\s*\|?\s*(bash|sh)\b|eval\s*\(|exec\s*\()", fc):
            # Exclude lines that are warnings/documentation
            for line in fc.splitlines():
                if re.search(r"(curl\s*\|?\s*(bash|sh)|eval\s*\(|exec\s*\()", line):
                    if not re.search(r"(#|//|do not|don't|never|avoid|warning)", line, re.IGNORECASE):
                        issues.append(f"Unsafe execution pattern in {f.name}")
                        security_clean = False
                        break

        # Out-of-scope ops
        if re.search(r"(rm\s+-rf\s+/[^.]|/etc/|/usr/(bin|sbin|lib))", fc):
            for line in fc.splitlines():
                if re.search(r"(rm\s+-rf\s+/[^.]|/etc/|/usr/(bin|sbin|lib))", line):
                    if not re.search(r"(#|//|do not|don't|never|avoid|warning)", line, re.IGNORECASE):
                        issues.append(f"Out-of-scope file operation in {f.name}")
                        security_clean = False
                        break

    if security_clean:
        score += 3

    return {"score": score, "max": 10, "issues": issues}


# =============================================================================
# Grade assignment
# =============================================================================

def assign_grade(total: int) -> str:
    """Letter grade from total score (0-100)."""
    if total >= 90:
        return "A"
    elif total >= 80:
        return "B"
    elif total >= 70:
        return "C"
    elif total >= 60:
        return "D"
    else:
        return "F"


# =============================================================================
# Main
# =============================================================================

def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python score.py <skill-folder-path>", file=sys.stderr)
        sys.exit(1)

    skill_dir = Path(sys.argv[1]).resolve()
    if not skill_dir.is_dir():
        print(json.dumps({"error": f"'{sys.argv[1]}' is not a directory"}))
        sys.exit(1)

    skill_md = skill_dir / "SKILL.md"
    content = ""
    frontmatter = {}
    skill_name = skill_dir.name

    if skill_md.is_file():
        try:
            content = skill_md.read_text(encoding="utf-8", errors="replace")
            frontmatter = extract_frontmatter(content)
            skill_name = frontmatter.get("name", skill_dir.name)
        except Exception as e:
            content = ""
            frontmatter = {}

    # Score each dimension
    structure = score_structure(skill_dir)
    clarity = score_clarity(content)
    specificity = score_specificity(content, frontmatter)
    advanced = score_advanced(skill_dir)

    total = structure["score"] + clarity["score"] + specificity["score"] + advanced["score"]
    token_count = count_approximate_tokens(get_body(content)) if content else 0

    # Collect security issues from advanced dimension
    security_issues = [i for i in advanced["issues"] if any(
        kw in i.lower() for kw in ("secret", "unsafe", "out-of-scope")
    )]

    report = {
        "skill_name": skill_name,
        "total_score": total,
        "grade": assign_grade(total),
        "dimensions": {
            "structure": {
                "score": structure["score"],
                "max": structure["max"],
                "issues": structure["issues"],
            },
            "clarity": {
                "score": clarity["score"],
                "max": clarity["max"],
                "issues": clarity["issues"],
            },
            "specificity": {
                "score": specificity["score"],
                "max": specificity["max"],
                "issues": specificity["issues"],
            },
            "advanced": {
                "score": advanced["score"],
                "max": advanced["max"],
                "issues": [i for i in advanced["issues"] if i not in security_issues],
            },
        },
        "token_count": token_count,
        "security_issues": security_issues,
    }

    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()

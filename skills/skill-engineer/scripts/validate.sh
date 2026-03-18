#!/bin/bash
set -euo pipefail

# =============================================================================
# validate.sh — Deterministic quality gate for agent-pro-skills skill folders
# Usage: bash validate.sh <skill-folder-path>
# Exit codes: 0 = PASS/WARN, 1 = FAIL (structural or security errors)
# =============================================================================

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No colour

pass_mark() { printf "  ${GREEN}✓${NC} %s\n" "$1"; }
fail_mark() { printf "  ${RED}✗${NC} %s\n" "$1"; }
warn_mark() { printf "  ${YELLOW}!${NC} %s\n" "$1"; }

# ---------------------------------------------------------------------------
# Argument handling
# ---------------------------------------------------------------------------
if [[ $# -lt 1 ]]; then
  echo "Usage: bash validate.sh <skill-folder-path>"
  exit 1
fi

SKILL_DIR="$(cd "$1" && pwd)"
SKILL_MD="$SKILL_DIR/SKILL.md"

STRUCTURAL_PASS=true
SECURITY_PASS=true
QUALITY_SCORE=100

# ---------------------------------------------------------------------------
# Extract frontmatter helper
# ---------------------------------------------------------------------------
extract_frontmatter() {
  # Prints the YAML block between the first pair of --- lines
  awk 'BEGIN{found=0} /^---$/{found++; next} found==1{print} found>=2{exit}' "$1"
}

get_fm_field() {
  # $1 = field name, reads from stdin
  grep -E "^${1}:" | head -1 | sed "s/^${1}:[[:space:]]*//" | sed 's/^["'"'"']//' | sed 's/["'"'"']$//' | xargs
}

# ===========================  STRUCTURAL CHECKS  ============================
structural_issues=()

# 1. SKILL.md exists
if [[ ! -f "$SKILL_MD" ]]; then
  structural_issues+=("SKILL.md missing")
  STRUCTURAL_PASS=false
  # Cannot continue without SKILL.md
  echo ""
  echo "=== Skill Validation Report ==="
  echo "Skill: (unknown)"
  echo ""
  echo "Structural Checks:"
  fail_mark "SKILL.md exists"
  echo ""
  echo "Result: FAIL"
  exit 1
fi

SKILL_CONTENT="$(cat "$SKILL_MD")"
FRONTMATTER="$(extract_frontmatter "$SKILL_MD")"

# 2. YAML frontmatter present
if [[ -z "$FRONTMATTER" ]]; then
  structural_issues+=("YAML frontmatter missing")
  STRUCTURAL_PASS=false
fi

# 3. name field — kebab-case
SKILL_NAME="$(echo "$FRONTMATTER" | get_fm_field "name")"
if [[ -z "$SKILL_NAME" ]]; then
  structural_issues+=("name field missing in frontmatter")
  STRUCTURAL_PASS=false
elif ! echo "$SKILL_NAME" | grep -qE '^[a-z][a-z0-9-]*$'; then
  structural_issues+=("name '$SKILL_NAME' is not kebab-case (must match ^[a-z][a-z0-9-]*\$)")
  STRUCTURAL_PASS=false
fi

# 4. description field — under 200 chars
DESCRIPTION="$(echo "$FRONTMATTER" | get_fm_field "description")"
if [[ -z "$DESCRIPTION" ]]; then
  structural_issues+=("description field missing in frontmatter")
  STRUCTURAL_PASS=false
elif [[ ${#DESCRIPTION} -ge 200 ]]; then
  structural_issues+=("description is ${#DESCRIPTION} chars (must be under 200)")
  STRUCTURAL_PASS=false
fi

# 5. Folder name matches name field
FOLDER_NAME="$(basename "$SKILL_DIR")"
if [[ -n "$SKILL_NAME" && "$FOLDER_NAME" != "$SKILL_NAME" ]]; then
  structural_issues+=("Folder name '$FOLDER_NAME' does not match name field '$SKILL_NAME'")
  STRUCTURAL_PASS=false
fi

# 6. Referenced scripts exist and are executable
SCRIPT_REFS=()
while IFS= read -r ref; do
  [[ -n "$ref" ]] && SCRIPT_REFS+=("$ref")
done < <(grep -oE 'scripts/[a-zA-Z0-9_-]+\.(sh|py|js|ts|rb)' "$SKILL_MD" 2>/dev/null || true)

for sref in "${SCRIPT_REFS[@]+"${SCRIPT_REFS[@]}"}"; do
  full_path="$SKILL_DIR/$sref"
  if [[ ! -f "$full_path" ]]; then
    structural_issues+=("Referenced script '$sref' not found")
    STRUCTURAL_PASS=false
  elif [[ ! -x "$full_path" ]]; then
    structural_issues+=("Script '$sref' exists but is not executable")
    STRUCTURAL_PASS=false
  fi
done

# 7. Referenced files in references/ and templates/ exist
REF_FILES=()
while IFS= read -r ref; do
  [[ -n "$ref" ]] && REF_FILES+=("$ref")
done < <(grep -oE '(references|templates)/[a-zA-Z0-9_./-]+' "$SKILL_MD" 2>/dev/null || true)

for rref in "${REF_FILES[@]+"${REF_FILES[@]}"}"; do
  full_path="$SKILL_DIR/$rref"
  if [[ ! -e "$full_path" ]]; then
    structural_issues+=("Referenced file '$rref' not found")
    STRUCTURAL_PASS=false
  fi
done

# ===========================  QUALITY CHECKS  ================================
quality_notes=()

# Body = everything after the second --- line
BODY="$(awk 'BEGIN{c=0} /^---$/{c++; next} c>=2{print}' "$SKILL_MD")"

# 8. Token count (approximate: words * 1.3)
WORD_COUNT=$(echo "$BODY" | wc -w | xargs)
TOKEN_COUNT=$(awk "BEGIN{printf \"%d\", $WORD_COUNT * 1.3}")

if [[ $TOKEN_COUNT -gt 5000 ]]; then
  QUALITY_SCORE=$((QUALITY_SCORE - 30))
  quality_notes+=("Token count: ~${TOKEN_COUNT} (over 5,000 — penalty -30)")
elif [[ $TOKEN_COUNT -gt 3000 ]]; then
  QUALITY_SCORE=$((QUALITY_SCORE - 15))
  quality_notes+=("Token count: ~${TOKEN_COUNT} (over 3,000 — penalty -15)")
else
  quality_notes+=("Token count: ~${TOKEN_COUNT} (under 3,000 limit)")
fi

# 9. Description specificity
VAGUE_WORDS="helpful|useful|various|diverse|many things|general purpose"
if echo "$DESCRIPTION" | grep -qiE "($VAGUE_WORDS)"; then
  # Check if trigger conditions are present to offset vagueness
  if ! echo "$FRONTMATTER" | grep -qiE "trigger"; then
    QUALITY_SCORE=$((QUALITY_SCORE - 10))
    quality_notes+=("Description contains vague words without specific trigger conditions (penalty -10)")
  fi
else
  quality_notes+=("Description specificity OK")
fi

# 10. Usage examples section
if echo "$BODY" | grep -qiE '^##\s+(Examples|Usage)'; then
  quality_notes+=("Usage/Examples section present")
else
  QUALITY_SCORE=$((QUALITY_SCORE - 10))
  quality_notes+=("Missing '## Examples' or '## Usage' section (penalty -10)")
fi

# 11. Scope boundaries
if echo "$BODY" | grep -qiE "(do not|don't|should not|must not|never )"; then
  quality_notes+=("Scope boundaries defined")
else
  QUALITY_SCORE=$((QUALITY_SCORE - 10))
  quality_notes+=("No scope boundaries found (missing 'do not'/'should not' guidance — penalty -10)")
fi

# 12. Step-by-step instructions
if echo "$BODY" | grep -qE '(^[0-9]+\.|Step [0-9]+|^- \[)'; then
  quality_notes+=("Step-by-step instructions present")
else
  QUALITY_SCORE=$((QUALITY_SCORE - 5))
  quality_notes+=("No numbered steps or 'Step N' patterns found (penalty -5)")
fi

# 13. Progressive disclosure
if [[ $TOKEN_COUNT -gt 2000 ]]; then
  if [[ ! -d "$SKILL_DIR/references" ]] || [[ -z "$(ls -A "$SKILL_DIR/references" 2>/dev/null)" ]]; then
    QUALITY_SCORE=$((QUALITY_SCORE - 12))
    quality_notes+=("SKILL.md > 2,000 tokens with no references/ content (penalty -12)")
  else
    quality_notes+=("Progressive disclosure via references/ folder")
  fi
else
  quality_notes+=("Progressive disclosure not required (under 2,000 tokens)")
fi

# 14. Script error handling
SCRIPT_HANDLING_PENALTY=0
if [[ -d "$SKILL_DIR/scripts" ]]; then
  for script_file in "$SKILL_DIR/scripts"/*; do
    [[ -f "$script_file" ]] || continue
    fname="$(basename "$script_file")"
    case "$fname" in
      *.sh)
        if ! grep -qE '(set -e|set -euo pipefail)' "$script_file"; then
          SCRIPT_HANDLING_PENALTY=$((SCRIPT_HANDLING_PENALTY + 8))
          quality_notes+=("Script '$fname' missing 'set -e' or 'set -euo pipefail' (penalty -8)")
        fi
        ;;
      *.py)
        if ! grep -qE '(try:|except )' "$script_file"; then
          SCRIPT_HANDLING_PENALTY=$((SCRIPT_HANDLING_PENALTY + 8))
          quality_notes+=("Script '$fname' missing try/except error handling (penalty -8)")
        fi
        ;;
    esac
  done
fi
QUALITY_SCORE=$((QUALITY_SCORE - SCRIPT_HANDLING_PENALTY))

# Clamp score to 0
if [[ $QUALITY_SCORE -lt 0 ]]; then
  QUALITY_SCORE=0
fi

# ===========================  SECURITY CHECKS  ==============================
security_issues=()

# Collect all text files in the skill folder for scanning
ALL_FILES=()
while IFS= read -r f; do
  ALL_FILES+=("$f")
done < <(find "$SKILL_DIR" -type f \( -name '*.sh' -o -name '*.py' -o -name '*.js' -o -name '*.ts' -o -name '*.md' -o -name '*.yaml' -o -name '*.yml' -o -name '*.json' -o -name '*.toml' -o -name '*.txt' \) 2>/dev/null)

# 15. Hardcoded secrets
for f in "${ALL_FILES[@]+"${ALL_FILES[@]}"}"; do
  if grep -nEi '(API_KEY|TOKEN|PASSWORD|SECRET)[[:space:]]*=[[:space:]]*"[^"]{4,}"' "$f" 2>/dev/null | grep -vEi '(example|placeholder|your_|changeme|xxx|TODO|REPLACE)' >/dev/null 2>&1; then
    security_issues+=("Potential hardcoded secret in $(basename "$f")")
    SECURITY_PASS=false
  fi
done

# 16. Unsafe execution patterns
for f in "${ALL_FILES[@]+"${ALL_FILES[@]}"}"; do
  if grep -nE '(curl\s*\|?\s*(bash|sh)\b|eval\s*\(|exec\s*\()' "$f" 2>/dev/null | grep -vE '(#|//|<!--|do not|don'\''t|never|avoid|warning)' >/dev/null 2>&1; then
    security_issues+=("Unsafe execution pattern in $(basename "$f")")
    SECURITY_PASS=false
  fi
done

# 17. Out-of-scope file operations
for f in "${ALL_FILES[@]+"${ALL_FILES[@]}"}"; do
  if grep -nE '(rm\s+-rf\s+/[^.]|/etc/|/usr/(bin|sbin|lib))' "$f" 2>/dev/null | grep -vE '(#|//|<!--|do not|don'\''t|never|avoid|warning)' >/dev/null 2>&1; then
    security_issues+=("Out-of-scope file operation in $(basename "$f")")
    SECURITY_PASS=false
  fi
done

# ===========================  REPORT  ========================================
echo ""
echo "=== Skill Validation Report ==="
echo "Skill: ${SKILL_NAME:-"(unknown)"}"
echo ""

# --- Structural ---
echo "Structural Checks:"
if [[ ${#structural_issues[@]} -eq 0 ]]; then
  pass_mark "SKILL.md exists and valid"
  [[ -n "$FRONTMATTER" ]] && pass_mark "Frontmatter valid (name: $SKILL_NAME)"
  [[ -n "$DESCRIPTION" ]] && pass_mark "Description present (${#DESCRIPTION} chars)"
  [[ "$FOLDER_NAME" == "$SKILL_NAME" ]] && pass_mark "Folder name matches name field"
  [[ ${#SCRIPT_REFS[@]} -gt 0 ]] && pass_mark "All referenced scripts exist and executable"
  [[ ${#REF_FILES[@]} -gt 0 ]] && pass_mark "All referenced files exist"
else
  # Print passing checks first, then failures
  [[ -f "$SKILL_MD" ]] && pass_mark "SKILL.md exists" || true
  for issue in "${structural_issues[@]}"; do
    fail_mark "$issue"
  done
fi

# --- Quality ---
echo ""
echo "Quality Score: ${QUALITY_SCORE}/100"
for note in "${quality_notes[@]+"${quality_notes[@]}"}"; do
  if echo "$note" | grep -q "penalty"; then
    warn_mark "$note"
  else
    pass_mark "$note"
  fi
done

# --- Security ---
echo ""
echo "Security Checks:"
if [[ ${#security_issues[@]} -eq 0 ]]; then
  pass_mark "No hardcoded secrets"
  pass_mark "No unsafe execution patterns"
  pass_mark "No out-of-scope file operations"
else
  for issue in "${security_issues[@]}"; do
    fail_mark "$issue"
  done
fi

# --- Result ---
echo ""
if [[ "$STRUCTURAL_PASS" == false || "$SECURITY_PASS" == false ]]; then
  echo -e "Result: ${RED}FAIL${NC}"
  exit 1
elif [[ $QUALITY_SCORE -lt 60 ]]; then
  echo -e "Result: ${YELLOW}WARN${NC} (quality score below 60)"
  exit 0
else
  echo -e "Result: ${GREEN}PASS${NC}"
  exit 0
fi

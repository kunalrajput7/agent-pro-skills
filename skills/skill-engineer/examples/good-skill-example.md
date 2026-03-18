# Good Skill Example: python-code-reviewer

<!-- PURPOSE: This file is a teaching example. It shows what a high-quality,
     well-structured SKILL.md looks like. Every section includes commentary
     explaining the design principle behind it. Use this as your gold standard
     when creating new skills. -->

---

Below is the complete SKILL.md for a fictional `python-code-reviewer` skill.

---

```markdown
---
name: python-code-reviewer
description: >
  Review Python code for correctness, style, and maintainability issues.
  Use when the user asks to review a Python file, check code quality,
  or requests a PR review of Python changes.
---
```

<!-- WHY THIS FRONTMATTER IS GOOD:
     1. `name` is kebab-case and matches the folder name (python-code-reviewer/).
        This is required for the validator and for agents to resolve the skill.
     2. `description` is 198 characters — just under the 200-char limit.
        It names three SPECIFIC trigger conditions: "review a Python file",
        "check code quality", "PR review of Python changes".
        Compare this to a bad description like "A helpful skill for code."
        Specific triggers let the agent match user intent accurately.
     3. No unnecessary frontmatter fields. Keep it minimal. -->

```markdown
# Python Code Reviewer

Review Python files for bugs, style violations, and maintainability problems. Produce a structured report with line-level findings.

## Workflow

1. Identify the target files. If the user specifies files, use those. If they say "review my changes," run `git diff --name-only` to find modified `.py` files.

2. Run the automated linting script:
   ```bash
   bash scripts/lint.sh <file-path>
   ```
   This runs ruff and mypy. Parse the output into a list of findings.

3. Read each target file. For every file, check against the review checklist in `references/review-checklist.md`. Focus on:
   - Incorrect error handling (bare `except:`, swallowed exceptions)
   - Mutable default arguments
   - Missing type hints on public functions
   - Functions longer than 50 lines
   - Unused imports or variables (cross-check with lint output)

4. Classify each finding by severity:
   - **Critical**: Bugs, security issues, data loss risks
   - **Warning**: Style violations, maintainability concerns
   - **Suggestion**: Optional improvements, readability tweaks

5. Present the review in this format:
   ```
   ## Review: <filename>

   ### Critical
   - Line 42: Bare `except:` swallows all exceptions including KeyboardInterrupt.
     Fix: Catch specific exceptions (`except ValueError:`).

   ### Warnings
   - Line 15: Mutable default argument `def process(items=[])`.
     Fix: Use `def process(items=None):` with `items = items or []`.

   ### Suggestions
   - Line 88: Function `handle_request` is 67 lines. Consider extracting
     the validation logic into a separate function.

   **Summary**: 1 critical, 1 warning, 1 suggestion.
   ```

6. After presenting findings, ask: "Want me to fix any of these issues?"
```

<!-- WHY THIS WORKFLOW IS GOOD:
     1. NUMBERED STEPS, not prose paragraphs. The agent follows steps sequentially
        without ambiguity. Each step is a concrete action: "Run X", "Read Y",
        "Check Z", "Present in this format."
     2. IMPERATIVE VOICE throughout: "Identify", "Run", "Read", "Classify",
        "Present", "Ask." Never passive ("the file should be read").
     3. SCRIPTS FOR DETERMINISTIC WORK: Step 2 delegates linting to a script.
        Linting is deterministic — the LLM should not guess at lint results.
        The script runs ruff and mypy, tools with fixed rules, and produces
        structured output the agent can parse reliably.
     4. PROGRESSIVE DISCLOSURE: Step 3 references `references/review-checklist.md`
        instead of inlining 50 checklist items here. This keeps SKILL.md under
        3000 tokens. The agent reads the checklist file only when it needs it.
     5. STRUCTURED OUTPUT FORMAT: Step 5 shows the exact output template.
        This removes guesswork about how to present results.
     6. ENDS WITH A USER HANDOFF: Step 6 asks the user what to do next.
        The skill reviews but does not auto-fix without permission. -->

```markdown
## Examples

### Example 1: Review a specific file

**User:** "Review utils/parser.py for issues."

**Agent behavior:**
1. Run `bash scripts/lint.sh utils/parser.py` and collect findings.
2. Read `utils/parser.py` and check against `references/review-checklist.md`.
3. Present the structured review report grouped by severity.
4. Ask if the user wants auto-fixes applied.

### Example 2: Review PR changes

**User:** "Review the Python changes in my current branch."

**Agent behavior:**
1. Run `git diff --name-only` to find changed `.py` files.
2. For each file, run the lint script and perform manual review.
3. Present a combined report covering all changed files.
4. Summarize total findings across files.

### Example 3: Scoped review

**User:** "Check if there are any security issues in auth.py."

**Agent behavior:**
1. Run the lint script on `auth.py`.
2. Read `auth.py` but focus ONLY on security-related checks from the checklist
   (SQL injection, hardcoded secrets, unsafe deserialization, improper auth).
3. Present findings filtered to security issues only.
4. Skip style and maintainability suggestions since the user asked specifically
   about security.
```

<!-- WHY THESE EXAMPLES ARE GOOD:
     1. THREE EXAMPLES covering different usage patterns: single file, PR scope,
        and filtered review. This shows the agent how to adapt behavior.
     2. Each example has a realistic USER INPUT — the exact kind of thing a real
        user would type.
     3. Each example has EXPECTED AGENT BEHAVIOR as numbered steps, so the agent
        knows exactly what to do for each input pattern.
     4. Example 3 demonstrates SCOPE SENSITIVITY — the agent should adapt its
        review focus based on what the user asked for, not always do everything.
     5. Examples double as acceptance tests: if the agent does something
        different from what's described here, the skill needs revision. -->

```markdown
## Do NOT

- Do NOT review non-Python files. If the user asks to review JavaScript, TypeScript, or other languages, say this skill only handles Python and suggest they find a language-specific reviewer.
- Do NOT auto-fix code without asking the user first. Always present findings and wait for approval.
- Do NOT run the full test suite. This skill reviews code statically. If the user wants test execution, that is a separate workflow.
- Do NOT make subjective style judgments beyond what ruff enforces. Do not argue about single quotes vs double quotes or other matters of team preference unless `references/review-checklist.md` explicitly lists them.
- Do NOT review generated files (migrations, protobuf stubs, compiled outputs). Skip any file in directories named `generated/`, `migrations/`, or `__pycache__/`.
```

<!-- WHY THIS DO-NOT SECTION IS GOOD:
     1. EXPLICIT SCOPE BOUNDARIES: Each bullet names a specific thing the skill
        must refuse to do, with a reason and an alternative.
     2. PREVENTS SCOPE CREEP: Without this section, the agent might try to
        review JS files, run tests, or auto-fix code — all reasonable things
        an agent might do, but outside this skill's contract.
     3. ACTIONABLE ALTERNATIVES: "say this skill only handles Python and suggest
        they find a language-specific reviewer" tells the agent what to do
        INSTEAD of just saying no.
     4. PROTECTS AGAINST COMMON MISTAKES: The "generated files" bullet prevents
        the agent from wasting time reviewing auto-generated code, which is a
        common pitfall in real code review workflows. -->

---

## Folder Structure

The complete skill folder would look like this:

```
python-code-reviewer/
  SKILL.md                          # Everything above (under 3000 tokens)
  scripts/
    lint.sh                         # Runs ruff + mypy, outputs structured findings
  references/
    review-checklist.md             # 50-item checklist: error handling, security,
                                    #   type safety, performance, naming, etc.
  examples/
    sample-review-output.md         # A complete example review so the agent
                                    #   sees the expected output format
```

<!-- WHY THIS STRUCTURE IS GOOD:
     1. PROGRESSIVE DISCLOSURE: SKILL.md is the entry point (loaded on activation).
        The checklist is in references/ (loaded on-demand). This keeps activation
        cost low — the agent only reads the checklist when it actually starts
        reviewing a file.
     2. SCRIPTS FOR DETERMINISM: lint.sh handles the deterministic part (running
        ruff and mypy). The LLM handles the non-deterministic part (understanding
        context, explaining fixes in plain language).
     3. EXAMPLES FOR CALIBRATION: sample-review-output.md shows the agent what
        a good review looks like, reducing format drift over time.
     4. SINGLE RESPONSIBILITY: One script does one thing. One references file
        covers one topic. No monolithic files. -->

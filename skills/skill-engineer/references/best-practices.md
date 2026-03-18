# Skill Design Best Practices

This document covers the core principles for building skills that are reliable, efficient, and easy for agents to use correctly. Read this when you need deeper guidance beyond what SKILL.md provides.

---

## 1. Progressive Disclosure Architecture

Skills load in three stages. Design for this deliberately.

**Stage 1 — Metadata (~100 tokens, always loaded):**
The frontmatter `name` and `description` fields. Every skill in the system has its metadata loaded into the agent's context at all times. This is why descriptions must be concise and precise — they compete for space with every other installed skill.

**Stage 2 — SKILL.md body (loaded on invoke, target under 3000 tokens):**
The main instructions. This is loaded when the agent decides to use the skill (either via slash command or auto-trigger). Keep this focused on *what to do*. Move background knowledge, detailed examples, and edge-case handling into references/.

**Stage 3 — References (loaded only when the agent reads them, unlimited size):**
Deep-dive documents in the `references/` directory. The agent loads these only when it encounters a situation that needs more context. This is where you put detailed style guides, lengthy examples, troubleshooting guides, and domain knowledge.

**Design rule:** If removing a paragraph from SKILL.md would not break the skill's core workflow, move that paragraph to a reference document and add a one-line pointer in SKILL.md instead.

**Example — splitting a bloated skill:**

Before (everything in SKILL.md, ~6000 tokens):
```markdown
# Code Review Skill
[200 words of instructions]
[500 words explaining code review philosophy]
[800 words of examples for different languages]
[300 words of edge cases]
```

After (progressive disclosure):
```markdown
# Code Review Skill                          ← SKILL.md (~1500 tokens)
[200 words of instructions]
[2 brief examples]
For language-specific conventions, read references/language-conventions.md
For edge cases, read references/edge-cases.md
```
```
references/language-conventions.md            ← loaded only if needed
references/edge-cases.md                      ← loaded only if needed
```

---

## 2. Frontmatter Description Writing

The description field is the single most important line in your skill. It determines whether the agent selects your skill or ignores it.

**Rules:**

1. Start with a trigger verb or condition: "Format", "Generate", "When the user asks about..."
2. Be specific about scope: name the language, tool, or domain.
3. Stay under 200 characters. The agent processes hundreds of descriptions; brevity matters.
4. Include negative conditions if the skill could be confused with another.

**Good descriptions:**
```yaml
description: "Format Python files using Black with the project's pyproject.toml settings"
description: "Generate SQL migration files when schema changes are detected in models/"
description: "When the user asks to deploy, run the staging deploy pipeline via GitHub Actions"
```

**Bad descriptions:**
```yaml
description: "A helpful skill for code formatting"          # Too vague
description: "This skill helps with database operations"    # No trigger condition
description: "Deploy things"                                 # No specificity
```

---

## 3. Instruction Clarity

Write instructions that an agent can follow without interpretation. Every sentence in SKILL.md should pass the "could a junior developer follow this step exactly?" test.

**Use imperative voice:**
- Good: "Run `npm test` and check that all tests pass."
- Bad: "You might want to consider running the test suite."

**One instruction per step:**
- Good:
  ```
  ### Step 1: Run the linter
  Run `eslint src/ --fix` to auto-fix lint errors.

  ### Step 2: Check for remaining errors
  Run `eslint src/` without --fix. If errors remain, list them.
  ```
- Bad:
  ```
  ### Step 1: Lint
  Run eslint with --fix to fix things, then run it again without --fix
  to see if anything is left, and if there are errors you should list them.
  ```

**Separate context from action:**
- Put *why* and *background* in `references/`.
- Put *what to do* in `SKILL.md`.

Example:
```markdown
# In SKILL.md:
### Step 2: Apply naming conventions
Rename variables to match the project's naming rules.
For the full naming convention reference, read references/naming-conventions.md.
```

---

## 4. Script Design

Scripts handle deterministic, repeatable operations. They are the backbone of task skills.

**Principles:**

1. **One task per script.** A script named `validate-schema.sh` should validate a schema. It should not also format the file, commit changes, or send notifications.

2. **Always start with `set -euo pipefail`.**
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   ```
   - `set -e`: Exit on any error.
   - `set -u`: Error on undefined variables.
   - `set -o pipefail`: Catch errors in piped commands.

3. **Use meaningful exit codes:**
   - `0` — Success.
   - `1` — Validation error (bad input, failed check). The agent can fix this.
   - `2` — System error (missing tool, permission denied). The agent should report this.

   ```bash
   if ! command -v jq &>/dev/null; then
       echo "ERROR: jq is not installed" >&2
       exit 2
   fi

   if [ -z "$1" ]; then
       echo "ERROR: No file path provided" >&2
       echo "Usage: validate-schema.sh <path-to-schema.json>" >&2
       exit 1
   fi
   ```

4. **Produce structured output.** Print results in a format the agent can parse:
   ```bash
   echo "STATUS: success"
   echo "FILES_CHANGED: 3"
   echo "ERRORS: 0"
   ```

5. **Never use interactive prompts.** No `read -p`, no `select`, no editors. Scripts must run unattended.

6. **Never use `eval` or dynamically construct commands from user input.** This is a security boundary — treat it as non-negotiable.

---

## 5. Testing a Skill

Before publishing, test every skill with at least three categories of prompts.

**Category 1 — Trigger prompts (should activate the skill):**
Write 3+ prompts that should clearly trigger the skill. Verify the agent selects it.
```
Prompt: "Format my Python code"
Expected: Agent invokes the python-formatter skill.
```

**Category 2 — Non-trigger prompts (should NOT activate the skill):**
Write 3+ prompts that are related but should not trigger the skill. Verify the agent ignores it.
```
Prompt: "Explain how Black formats code"
Expected: Agent answers directly, does NOT invoke the formatter skill.
```

**Category 3 — Edge-case prompts (boundary conditions):**
Write 3+ prompts that test unusual inputs, missing prerequisites, or error paths.
```
Prompt: "Format my Python code" (but no Python files exist in the project)
Expected: Agent reports "No Python files found" rather than failing silently.
```

**Testing checklist:**
- [ ] Skill triggers on intended prompts
- [ ] Skill does NOT trigger on related-but-different prompts
- [ ] Scripts exit with correct codes on success and failure
- [ ] Error messages are actionable (tell the agent what to do next)
- [ ] SKILL.md stays under 3000 tokens
- [ ] All file paths in scripts are relative to the skill directory

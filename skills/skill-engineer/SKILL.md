---
name: skill-engineer
description: >
  Create high-quality, validated agent skills through a structured engineering process.
  Use when a user wants to create a new skill, build an agent capability, design a
  reusable workflow, or package domain knowledge for their coding agent. Also use when
  the user says they need a custom skill, wants to automate a repeating task, or asks
  about creating SKILL.md files.
---

# Skill Engineer

Create agent skills through a three-phase process: Spec, Design, Validate. Proceed through each phase sequentially. Show your work at every phase and wait for user approval before advancing.

## Phase 1: Skill Specification

Gather requirements before designing anything.

1. Ask the user to describe what they want the skill to do. If they already described it, work from that description.
2. Ask these clarifying questions (skip any the user already answered):
   - What specific task or workflow should this skill handle?
   - When should it trigger automatically? When should it NOT trigger?
   - Does it need to run scripts or just provide instructions?
   - Does it need external services (APIs, MCP servers)?
   - Is this for personal use, team use, or public distribution?
3. If web search is available, search for existing skills that solve the same problem. Note any found so the user can decide whether to reuse or build new.
4. Produce a skill spec summary:

```
Skill Name:            [kebab-case]
Purpose:               [one sentence]
Trigger Conditions:    [when to activate]
Non-Trigger Conditions:[when NOT to activate]
Pattern Type:          [reference | task | tool-orchestration]
Scripts Needed:        [yes/no — and what they do]
MCP Dependencies:      [none | list]
Estimated Size:        [small <1000 tokens | medium 1000-3000 | large 3000+]
```

5. Present the spec and ask: "Does this look right? Want to change anything before I design the skill?"

Do NOT proceed to Phase 2 until the user approves.

## Phase 2: Skill Design

After user approval, design the skill.

### Step 1: Select the skill pattern

- **Pattern A: Reference Skill** -- Knowledge, conventions, style guides. No scripts needed. The agent's language ability handles everything.
  Read `templates/reference-skill.md` for the template.

- **Pattern B: Task Skill** -- Repeatable workflows with deterministic steps. Includes scripts for operations that must not rely on LLM non-determinism.
  Read `templates/task-skill.md` for the template.

- **Pattern C: Tool-Orchestration Skill** -- Workflows requiring external services via MCP or tool calls.
  Read `templates/tool-skill.md` for the template.

### Step 2: Read best practices

Read `references/best-practices.md` for skill design guidance before writing.

### Step 3: Write the SKILL.md

Follow these rules strictly:

1. Frontmatter `name` must be kebab-case and match the folder name.
2. Frontmatter `description` must be under 200 characters with specific trigger conditions.
3. Write action-oriented instructions in imperative voice ("Run X", "Check Y").
4. Keep the SKILL.md body under 3000 tokens. Move supplementary content to `references/`.
5. Include at least 2 usage examples showing input and expected behavior.
6. Include an explicit "Do NOT" section defining scope boundaries.
7. Use numbered step-by-step instructions, not prose paragraphs.
8. If the skill has side effects (deploy, commit, publish), add `disable-model-invocation: true` to frontmatter.
9. If the skill is background knowledge only, add `user-invocable: false` to frontmatter.

### Step 4: Create scripts (Pattern B and C only)

1. Make each script handle one deterministic task.
2. Include error handling: `set -euo pipefail` for bash, `try/except` for Python.
3. Print structured, human-readable output the agent can parse.
4. Use meaningful exit codes: 0 = success, 1 = validation error, 2 = system error.
5. No interactive prompts -- the agent cannot respond to stdin.
6. Make scripts executable (`chmod +x`).

### Step 5: Create progressive disclosure structure

Organize the skill folder as:

```
skill-name/
  SKILL.md              # Core instructions (loaded when skill activates)
  scripts/              # Executable scripts (if needed)
  references/           # Detailed guides (loaded on-demand by the agent)
  templates/            # File templates for the agent to fill in
  examples/             # Example outputs showing expected format
```

### Step 6: Present the design

Show the complete folder structure and full contents of every file to the user. Ask: "Ready for validation?"

Do NOT proceed to Phase 3 until the user approves.

## Phase 3: Skill Validation

After user review, validate the skill.

### Step 1: Run validation

```bash
bash scripts/validate.sh path/to/generated-skill/
```

### Step 2: Review the report

The validator checks three categories:

**Structural checks (pass/fail):**
- SKILL.md exists and is valid markdown
- YAML frontmatter is valid with `name` (kebab-case) and `description` (under 200 chars)
- Folder name matches the `name` field
- All referenced scripts exist and are executable
- All referenced files in `references/` and `templates/` exist

**Quality checks (scored 0-100):**
- Token count penalty if SKILL.md body exceeds 3000 tokens
- Description specificity (penalizes vague words like "helpful", "useful", "various")
- At least 2 usage examples present
- Explicit scope boundaries (DO NOT section)
- Step-by-step instructions (not prose)
- Scripts have error handling
- Progressive disclosure used for supplementary content

**Security checks (pass/fail):**
- No hardcoded API keys, tokens, or passwords
- No `curl | bash` or `eval` patterns
- No file operations outside the project directory

### Step 3: Fix issues

Fix every issue the validator reports. Re-run validation until:
- All structural checks pass
- Quality score is above 70
- All security checks pass

### Step 4: Install

Ask the user: "Skill validated. Install to your coding agents?"

If yes, run:

```bash
bash scripts/install-skill.sh path/to/generated-skill/
```

The install script detects all coding agents on the system and copies the skill to the correct folder for each one.

## Examples

### Example 1: Creating a reference skill

**User:** "I want a skill that teaches my agent our team's API naming conventions."

**Result:** Phase 1 identifies this as a Pattern A (Reference Skill) with no scripts needed. Phase 2 produces a SKILL.md with numbered naming rules, 2 examples of correct vs incorrect names, and a Do NOT section. Phase 3 validates and installs to `.claude/skills/api-naming/`.

### Example 2: Creating a task skill with scripts

**User:** "Build me a skill that runs our full test suite and generates a coverage report before every PR."

**Result:** Phase 1 identifies this as a Pattern B (Task Skill) with a `run-tests.sh` script. Phase 2 produces SKILL.md with step-by-step instructions referencing the script, plus `references/coverage-thresholds.md` for team-specific settings. Phase 3 validates the script has `set -euo pipefail` and installs to all detected agents.

### Example 3: Creating a tool-orchestration skill

**User:** "I need a skill that reads a GitHub issue, creates a branch, implements a fix, and opens a PR."

**Result:** Phase 1 identifies this as a Pattern C (Tool-Orchestration Skill) requiring GitHub MCP or `gh` CLI. Phase 2 produces SKILL.md with a multi-step workflow, fallback behavior when tools are unavailable, and an error handling section. Phase 3 validates and installs.

## Do NOT

- Do NOT skip phases or combine them. Each phase has a user approval gate.
- Do NOT generate a skill without asking clarifying questions first.
- Do NOT put more than 3000 tokens of instructions in SKILL.md. Use `references/` for supplementary content.
- Do NOT create scripts without error handling.
- Do NOT use vague descriptions like "a helpful skill" or "does useful things" in frontmatter.
- Do NOT hardcode API keys, secrets, or credentials in any generated file.
- Do NOT install a skill without running validation first.
- Do NOT assume a specific coding agent. Skills must work across all platforms.

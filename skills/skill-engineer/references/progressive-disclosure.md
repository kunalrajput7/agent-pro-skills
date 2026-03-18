# Progressive Disclosure Architecture

Skills use a three-stage loading system designed to keep the agent's context window lean. Every token loaded into context is a token that cannot be used for reasoning about the user's actual problem. This document explains the architecture and how to design for it.

---

## Why This Matters

A coding agent typically has a context window of 100K-200K tokens. That sounds like a lot until you account for:

- The system prompt (~2000-5000 tokens)
- The conversation history (grows with each turn)
- File contents the agent has read (~500-2000 tokens per file)
- Tool definitions and responses
- **Skill metadata for every installed skill**

If a user has 30 skills installed and each skill's metadata costs 100 tokens, that is 3000 tokens permanently occupied. If each skill instead loaded its full SKILL.md (2000 tokens each), that would be 60,000 tokens — consuming a third to half the context window before the agent does any work.

Progressive disclosure solves this: load the minimum at each stage, and only load more when the agent actually needs it.

---

## Stage 1: Metadata (Always Loaded)

**What loads:** The `name` and `description` fields from the frontmatter block.
**When:** At agent startup, for every installed skill.
**Budget:** ~100 tokens per skill.

This is the skill's "advertisement." The agent reads all descriptions to decide which skill matches the user's request. The metadata must be:

- **Small:** Under 200 characters for the description. The name is typically 10-30 characters.
- **Precise:** The description must contain enough signal for the agent to make a correct match/no-match decision.
- **Self-contained:** The agent must be able to decide whether to invoke the skill based on the description alone, without reading SKILL.md.

**Example metadata (what the agent always sees):**
```
name: format-python
description: "Format Python files using Black with the project's pyproject.toml settings"
```

This costs roughly 30 tokens. The agent can immediately determine:
- Trigger: user asks to format Python code
- No trigger: user asks to format JavaScript, or asks about Python but not formatting

---

## Stage 2: SKILL.md Body (Loaded on Invoke)

**What loads:** The full content of SKILL.md, excluding frontmatter.
**When:** The agent has decided to use this skill (via slash command or auto-trigger).
**Budget:** Target under 3000 tokens. Hard ceiling at 5000 tokens.

This is the skill's "instruction manual." It tells the agent exactly what to do. It should contain:

- Step-by-step instructions for the workflow
- Script invocations with argument format
- 1-2 brief examples (enough to show the expected output format)
- Pointers to reference documents for deeper context

It should NOT contain:
- Background knowledge or theory
- Exhaustive examples for every edge case
- Full specifications of external tools or standards
- Troubleshooting guides

**Example SKILL.md body (~1200 tokens):**
```markdown
# Format Python

Format Python source files using Black, respecting the project's configuration.

## Steps

### Step 1: Identify files to format
Find all `.py` files that have been modified (staged or unstaged). If the user specifies
a file or directory, use that instead.

### Step 2: Run the formatter
```bash
bash scripts/format.sh [file-or-directory]
```
The script auto-detects pyproject.toml and passes it to Black.

### Step 3: Report results
Show which files were changed. If no files needed formatting, say so.

## Example

**User:** "Format my Python code"
**Action:** Run `bash scripts/format.sh .`
**Output:**
```
STATUS: success
FILES_FORMATTED: 3
CHANGED: src/main.py, src/utils.py, tests/test_main.py
```

## References

- For Black configuration options, read references/black-config.md
- For project-specific formatting rules, read references/style-overrides.md

## Do NOT

- Format files outside the project root
- Modify non-Python files
- Run Black without the project's pyproject.toml settings
```

---

## Stage 3: References (Loaded on Demand)

**What loads:** Individual files from the `references/` directory.
**When:** The agent reads a specific reference file while executing the skill.
**Budget:** Unlimited per file, but be practical. A 10,000-token reference is fine. A 50,000-token reference defeats the purpose.

References are the skill's "knowledge base." The agent loads them only when it encounters a situation that needs deeper context. Not every invocation will load any references. Some invocations might load one. Rarely will all references be loaded at once.

**What belongs in references:**
- Full specifications (conventional commits spec, REST API naming conventions)
- Comprehensive example libraries (20+ examples for different scenarios)
- Domain knowledge (database schema explanations, architecture decision records)
- Troubleshooting guides (common errors and their solutions)
- Configuration references (all available options for a tool)

**Example references/ structure:**
```
references/
  black-config.md        ← All Black configuration options with examples
  style-overrides.md     ← Project-specific deviations from default Black settings
  troubleshooting.md     ← Common errors: Black version mismatch, syntax errors, etc.
```

---

## Concrete Example: Splitting a Large Skill

Imagine you have a skill for writing database migrations. Here is how the content distributes across the three stages.

### Before: Everything in SKILL.md (~7000 tokens)
```markdown
---
name: create-migration
description: "Create database migration files"
---

# Create Migration

## How Alembic Works
[500 words explaining Alembic revision system, the env.py file, upgrade/downgrade
functions, autogenerate, and how the migration chain works]

## Steps
1. Detect model changes
2. Generate migration
3. Review migration
4. Test migration

## Alembic Command Reference
[300 words listing every alembic command and flag]

## Naming Conventions
[200 words on migration file naming: YYYYMMDD_HHMM_description.py]

## Examples
[1500 words showing 10 different migration scenarios: add column, remove column,
rename column, add index, add foreign key, create table, drop table, add constraint,
data migration, multi-step migration]

## Common Errors
[800 words covering revision conflicts, import errors, missing model imports,
autogenerate limitations, and manual migration patterns]

## Do NOT
- Create empty migrations
- Skip the review step
```

### After: Progressive Disclosure

**Stage 1 — Metadata (always loaded, ~30 tokens):**
```yaml
name: create-migration
description: "Generate an Alembic migration file when SQLAlchemy models in app/models/ are modified"
```

**Stage 2 — SKILL.md body (loaded on invoke, ~1500 tokens):**
```markdown
# Create Migration

Generate an Alembic database migration when model changes are detected.

## Steps

### Step 1: Detect changes
Run the model-diff script to identify modified SQLAlchemy models:
```bash
bash scripts/detect-model-changes.sh
```

### Step 2: Generate migration
```bash
bash scripts/generate-migration.sh "description of the change"
```
The script runs `alembic revision --autogenerate` with the correct configuration.

### Step 3: Review the generated migration
Open the new migration file. Verify that:
- The upgrade() function matches the intended change
- The downgrade() function correctly reverses it
- No unintended changes were captured by autogenerate

### Step 4: Test the migration
```bash
bash scripts/test-migration.sh
```
This runs upgrade and downgrade against a test database.

## Quick Reference
- Naming format: `YYYYMMDD_HHMM_description.py`
- For the full Alembic command reference, read references/alembic-commands.md

## Example
**User:** "I added a `phone_number` column to the User model"
**Output:**
```
STATUS: success
MIGRATION_FILE: migrations/versions/20250115_1423_add_phone_number_to_users.py
CHANGES_DETECTED: 1 (add column: users.phone_number VARCHAR(20))
```

For more examples, read references/migration-examples.md.

## Do NOT
- Create empty migrations with no detected changes
- Skip the review step — autogenerate misses some changes (see references/autogenerate-limitations.md)
- Run migrations against production (this skill is for generating files only)
```

**Stage 3 — References (loaded only when needed):**
```
references/
  alembic-commands.md           ← Full command reference (~1500 tokens)
  migration-examples.md         ← 10 detailed examples (~3000 tokens)
  autogenerate-limitations.md   ← What autogenerate misses (~1000 tokens)
  troubleshooting.md            ← Common errors and fixes (~1500 tokens)
  naming-conventions.md         ← Detailed naming rules (~500 tokens)
```

**Token savings in practice:**

| Scenario | Before | After |
|----------|--------|-------|
| Skill NOT invoked | 0 tokens (but description is vague) | 30 tokens (precise description) |
| Simple migration, no issues | 7000 tokens | 1530 tokens |
| Migration with autogenerate problem | 7000 tokens | 2530 tokens (SKILL.md + limitations ref) |
| First-time user needs full context | 7000 tokens | 7530 tokens (everything loaded) |

In the common case (simple migration, no issues), progressive disclosure saves **5470 tokens** per invocation. Across a conversation with multiple skill invocations, this adds up to tens of thousands of tokens saved for reasoning.

---

## Design Checklist

When splitting a skill into three stages, walk through this checklist:

- [ ] **Metadata:** Can the agent decide to invoke (or skip) this skill from the description alone?
- [ ] **SKILL.md:** Does it contain only actionable steps and essential context?
- [ ] **SKILL.md:** Is it under 3000 tokens?
- [ ] **SKILL.md:** Does every reference pointer include a one-line summary of what the reference contains?
- [ ] **References:** Is each reference document focused on one topic?
- [ ] **References:** Could a reference be useful to other skills too? (If so, consider a shared location.)
- [ ] **References:** Are reference file names descriptive enough that the agent can decide whether to read them based on the name and the pointer in SKILL.md?

# Frontmatter Field Reference

Every skill begins with a YAML frontmatter block delimited by `---`. This block defines metadata that the agent runtime reads to decide when and how to load the skill. This document covers each field in detail.

---

## Required Fields

### `name`

The unique identifier for the skill. This is also the slash command the user types to invoke it manually.

**Format:** kebab-case (lowercase, hyphens between words). No spaces, no underscores, no camelCase.

**Rules:**
- Must be unique across all installed skills.
- Should be 2-4 words that clearly identify the skill's purpose.
- Use a verb-noun pattern when possible.

**Good names:**
```yaml
name: format-python
name: create-migration
name: review-pr
name: deploy-staging
name: generate-changelog
```

**Bad names:**
```yaml
name: mySkill              # camelCase, not kebab-case
name: helper               # too generic
name: format               # too broad — format what?
name: python_code_formatter_v2  # underscores, version number, too long
name: do-stuff             # meaningless
```

---

### `description`

The single most important line in the skill. The agent reads every installed skill's description to decide which skill to invoke. Think of it as a search query in reverse: you are writing the text that should match the user's intent.

**Format:** Plain text, under 200 characters. No markdown, no line breaks.

**Rules:**
1. **Start with a trigger verb or condition.** The first words should tell the agent *when* to activate: "Format", "Generate", "When the user asks to...", "Run...when..."
2. **Name the specific tool, language, or domain.** "Python" not "code." "Alembic" not "migrations." "GitHub Actions" not "CI/CD."
3. **Include what makes this skill distinct** from similar skills. If you have both `format-python` and `lint-python`, the descriptions must clearly separate them.
4. **Add negative conditions** if the skill could be confused with another: "...but not for test files."

**Good descriptions:**
```yaml
description: "Format Python files using Black with the project's pyproject.toml settings"
description: "Generate Alembic migration files when SQLAlchemy model definitions change"
description: "Create a GitHub PR with conventional title, linked issues, and reviewers from CODEOWNERS"
description: "Run the full test suite and report failures when user asks to test or validate changes"
description: "Scaffold a new React component with TypeScript types, tests, and Storybook story"
description: "When the user asks to deploy to staging, trigger the deploy workflow via GitHub Actions CLI"
description: "Analyze bundle size impact of current changes using source-map-explorer"
```

**Bad descriptions:**
```yaml
description: "A helpful skill for formatting"
# Why it's bad: does not say WHAT it formats or WHICH tool it uses.

description: "Helps with database stuff"
# Why it's bad: "stuff" is meaningless. Does not name the database, ORM, or operation.

description: "This skill will assist the user in performing various code-related tasks and operations"
# Why it's bad: 95 characters of filler, zero information content.

description: "Deployment"
# Why it's bad: one word. No trigger condition, no tool, no scope.

description: "Use this when you want to do something with git"
# Why it's bad: "something with git" matches everything. No specificity.

description: "Formats code, runs linters, fixes style issues, organizes imports, and checks types"
# Why it's bad: five different responsibilities. This is five skills, not one.
```

---

## Optional Fields

### `disable-model-invocation`

**Type:** boolean (true/false)
**Default:** false

When set to `true`, the agent will never auto-trigger this skill based on the user's prompt. The skill can only be invoked via the explicit slash command (e.g., `/deploy-production`).

**When to use:**
- Destructive operations (deploys, database migrations, bulk deletes)
- Operations with side effects that cannot be undone
- Workflows that cost money (API calls to paid services)
- Anything where accidental triggering would be harmful

**Example:**
```yaml
---
name: deploy-production
description: "Deploy the current branch to production via the CI/CD pipeline"
disable-model-invocation: true
---
```
The agent will never auto-invoke this skill. The user must type `/deploy-production` explicitly.

### `user-invocable`

**Type:** boolean (true/false)
**Default:** true

When set to `false`, the skill cannot be invoked via a slash command. It exists only as background knowledge that the agent loads automatically when relevant.

**When to use:**
- Style guides and coding conventions the agent should follow passively
- Project-specific context (architecture decisions, team norms)
- Domain knowledge that applies across many different tasks

**Example:**
```yaml
---
name: project-conventions
description: "Project coding conventions: naming, file structure, and import ordering rules"
user-invocable: false
---
```
The user cannot type `/project-conventions`. Instead, the agent loads this skill's knowledge whenever it performs a task where coding conventions are relevant.

---

## Complete Examples

### Task skill — explicit invocation only
```yaml
---
name: reset-dev-database
description: "Drop and recreate the local dev database with seed data when user runs /reset-dev-database"
disable-model-invocation: true
---
```

### Reference skill — auto-triggered
```yaml
---
name: api-style-guide
description: "Apply REST API naming and versioning conventions when creating or modifying API endpoints"
---
```

### Background knowledge — never directly invoked
```yaml
---
name: team-architecture
description: "Hexagonal architecture decisions and bounded context boundaries for this monorepo"
user-invocable: false
---
```

### Tool-orchestration skill — auto-triggered
```yaml
---
name: create-linear-issue
description: "Create a Linear issue with project, team, and priority when user asks to file a ticket or track work"
---
```

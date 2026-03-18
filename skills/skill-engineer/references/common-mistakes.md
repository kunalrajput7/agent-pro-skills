# Common Mistakes in Skill Design

These are the most frequent problems found in marketplace skills. For each mistake, a bad example and a concrete fix are provided.

---

## 1. Bloated Instructions

**Problem:** Everything crammed into SKILL.md instead of using the references/ directory. The skill consumes 5000+ tokens every time it is invoked, most of which is background context the agent rarely needs.

**Bad example:**
```markdown
# Git Commit Skill

## How Git commits work
[400 words explaining git internals]

## Conventional Commits specification
[600 words reproducing the full spec]

## Steps
1. Stage files
2. Write a commit message following conventional commits
3. Commit

## Examples for every commit type
[800 words of examples for feat, fix, chore, docs, refactor, test, ci, perf, build, style]
```

**Fix:** Keep only the actionable steps in SKILL.md. Move everything else to references/.
```markdown
# Git Commit Skill                              ← SKILL.md (~800 tokens)

## Steps
1. Stage the changed files relevant to the task.
2. Write a commit message following conventional commits format.
   For the full format spec, read references/conventional-commits.md.
3. Run `git commit` with the message.

## Quick Reference
- feat: new feature
- fix: bug fix
- chore: maintenance
For the complete list with examples, read references/conventional-commits.md.
```

---

## 2. Vague Descriptions

**Problem:** The frontmatter description does not tell the agent *when* to activate. It reads like a marketing tagline instead of a trigger condition.

**Bad examples:**
```yaml
description: "A helpful skill for development tasks"
description: "Makes your code better"
description: "Assists with various database operations"
description: "Useful for working with APIs"
```

**Fix:** Name the specific action, tool, language, and trigger condition.
```yaml
description: "Format Python files using Black when the user asks to format or lint Python code"
description: "Generate Alembic migration files when SQLAlchemy models in app/models/ change"
description: "Create OpenAPI specs from FastAPI route definitions when user asks to document APIs"
description: "Run psql queries against the staging database when user needs to inspect live data"
```

---

## 3. No Scope Boundaries

**Problem:** The skill has no "Do NOT" section, so it triggers on everything remotely related. A code-review skill fires when the user asks "what does this function do?" A deploy skill fires when the user mentions "production."

**Bad example:**
```yaml
name: code-review
description: "Review code and provide feedback"
```
No boundaries. This triggers on "review my PR," "explain this code," "what's wrong with this function," and "write a review of this library" — most of which are not code reviews.

**Fix:** Add explicit scope boundaries and refine the description.
```yaml
name: code-review
description: "Perform a structured code review on staged changes or a specific PR when user says 'review' or '/code-review'"
```
```markdown
## Do NOT

- Trigger when the user asks to *explain* code (that is general Q&A, not a review)
- Trigger when the user asks to *write* code (that is code generation)
- Review files outside the current repository
- Provide feedback on architecture decisions unless specifically asked
```

---

## 4. Hardcoded Assumptions

**Problem:** The skill assumes a specific project structure, language version, package manager, or framework that may not match the user's project.

**Bad example:**
```bash
# Assumes npm, assumes src/ directory, assumes .eslintrc.json exists
cd src/
npx eslint . --config ../.eslintrc.json --fix
npm test
```

**Fix:** Detect the environment or accept parameters. Fail with a clear message if assumptions are wrong.
```bash
#!/usr/bin/env bash
set -euo pipefail

# Detect package manager
if [ -f "pnpm-lock.yaml" ]; then
    PKG_MGR="pnpm"
elif [ -f "yarn.lock" ]; then
    PKG_MGR="yarn"
elif [ -f "package-lock.json" ]; then
    PKG_MGR="npm"
else
    echo "ERROR: No supported package manager lockfile found" >&2
    echo "Supported: npm, yarn, pnpm" >&2
    exit 1
fi

# Detect source directory
SRC_DIR="${1:-.}"
if [ ! -d "$SRC_DIR" ]; then
    echo "ERROR: Directory '$SRC_DIR' does not exist" >&2
    exit 1
fi

$PKG_MGR run lint -- "$SRC_DIR"
```

---

## 5. No Error Handling in Scripts

**Problem:** Scripts fail silently. The agent does not know something went wrong and reports success to the user.

**Bad example:**
```bash
curl -s https://api.example.com/deploy
echo "Deployed successfully"
```
The curl command could fail with a network error, a 500 response, or a timeout. The script always prints "Deployed successfully."

**Fix:** Check every critical operation. Use `set -euo pipefail` and validate responses.
```bash
#!/usr/bin/env bash
set -euo pipefail

RESPONSE=$(curl -sf --max-time 30 https://api.example.com/deploy 2>&1) || {
    echo "ERROR: Deploy request failed" >&2
    echo "Response: $RESPONSE" >&2
    exit 2
}

STATUS=$(echo "$RESPONSE" | jq -r '.status' 2>/dev/null) || {
    echo "ERROR: Could not parse deploy response as JSON" >&2
    echo "Raw response: $RESPONSE" >&2
    exit 2
}

if [ "$STATUS" != "success" ]; then
    echo "ERROR: Deploy returned status '$STATUS'" >&2
    echo "Full response: $RESPONSE" >&2
    exit 1
fi

echo "STATUS: success"
echo "DEPLOY_ID: $(echo "$RESPONSE" | jq -r '.deploy_id')"
```

---

## 6. Using eval or Dynamic Code Execution

**Problem:** Scripts construct commands from user input and execute them with `eval`, creating a code injection risk.

**Bad example:**
```bash
# User provides a filename — what if it contains "; rm -rf /"?
FILENAME="$1"
eval "cat $FILENAME | wc -l"
```

**Fix:** Never use `eval`. Use direct commands with properly quoted variables.
```bash
#!/usr/bin/env bash
set -euo pipefail

FILENAME="$1"

if [ ! -f "$FILENAME" ]; then
    echo "ERROR: File '$FILENAME' does not exist" >&2
    exit 1
fi

LINE_COUNT=$(wc -l < "$FILENAME")
echo "STATUS: success"
echo "LINE_COUNT: $LINE_COUNT"
```

---

## 7. No Examples

**Problem:** The skill tells the agent *what* to do but not *what good output looks like*. The agent guesses at formatting, level of detail, and structure.

**Bad example:**
```markdown
# Changelog Skill
Generate a changelog entry for the latest changes.
```

**Fix:** Include at least two concrete examples showing input and expected output.
```markdown
# Changelog Skill
Generate a changelog entry for the latest changes.

## Examples

### Example 1: Feature addition
**Input:** User merged PR #42 "Add dark mode toggle to settings page"
**Output:**
```
### Added
- Dark mode toggle in Settings > Appearance (#42)
```

### Example 2: Bug fix
**Input:** User merged PR #58 "Fix crash when uploading files over 10MB"
**Output:**
```
### Fixed
- File upload crash for files exceeding 10MB (#58)
```
```

---

## 8. Mixing Concerns

**Problem:** One skill tries to handle five different workflows. It has a massive description, complex conditional logic, and triggers too broadly.

**Bad example:**
```yaml
name: project-management
description: "Create issues, manage PRs, update project boards, send Slack notifications, and generate reports"
```
This skill is actually five skills pretending to be one. Its SKILL.md will be enormous, it will trigger on many unrelated prompts, and any change risks breaking unrelated functionality.

**Fix:** Split into focused skills, each with one clear responsibility.
```yaml
# Skill 1
name: create-issue
description: "Create a GitHub issue with labels and assignees when user asks to file or create an issue"

# Skill 2
name: manage-pr
description: "Create, update, or merge pull requests when user asks to manage a PR"

# Skill 3
name: update-board
description: "Move items on the GitHub project board when user asks to update task status"

# Skill 4
name: notify-slack
description: "Send a Slack notification to a channel when user asks to notify the team"

# Skill 5
name: project-report
description: "Generate a weekly project status report from GitHub issues and PRs"
```

Each skill is small, focused, and independently testable. They can be composed by the agent when a workflow requires multiple steps.

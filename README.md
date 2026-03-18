# agent-pro-skills

**Create high-quality, validated AI agent skills through structured engineering.**

<!-- Badges -->
[![npm version](https://img.shields.io/npm/v/agent-pro-skills)](https://www.npmjs.com/package/agent-pro-skills)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Node.js >= 18](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

---

## What This Is

A skill that creates skills. `agent-pro-skills` is an open-source npm CLI that installs a structured skill-engineering process into your existing coding agent. It works inside any coding agent — Claude Code, Cursor, GitHub Copilot, Codex CLI, Windsurf, Gemini CLI, Antigravity, and 35+ others. Zero config, zero API keys, zero cost.

Your coding agent IS the AI model. We provide the instructions, templates, and validation scripts. The agent provides the intelligence.

---

## The Problem

The agent skills ecosystem has exploded to over 40,000 skills across multiple marketplaces — but quality has not kept pace. According to independent audits, **13.4% of marketplace skills contain critical vulnerabilities**. Most skills are written ad-hoc without any design process. Developers copy-paste prompt templates without understanding progressive disclosure, producing bloated instructions that cause context rot (diluted attention and wasted tokens). Frontmatter descriptions are poorly written, causing skills to either never trigger or trigger at the wrong time. No standard validation exists before publishing.

`agent-pro-skills` solves this with a structured three-phase engineering process: **Spec, Design, Validate.**

---

## Quick Start

```bash
npx agent-pro-skills init
```

```
  agent-pro-skills v0.1.0

  Detecting installed coding agents...
    ✓ Claude Code (global: ~/.claude)
    ✓ Cursor (project: .cursor)
    ✓ GitHub Copilot (project: .github)

  Install skill-engineer to all 3 agents? (Y/n) y

  Installing...
    ✓ .claude/skills/skill-engineer/
    ✓ .cursor/skills/skill-engineer/
    ✓ .github/skills/skill-engineer/

  Done! Usage:
    • Type /skill-engineer in your coding agent
    • Or say: "I need a skill for [your use case]"
```

Once installed, open your coding agent and say something like:

> "I need an agent skill that reviews pull requests in Python projects, checking for security issues, code style, and test coverage."

The skill-engineer skill takes over from there.

---

## How It Works

The core product is a **SKILL.md file** (with supporting scripts and templates) that teaches your coding agent how to engineer other skills through three phases:

### Phase 1: Specification

The agent asks clarifying questions before designing anything — purpose, trigger conditions, input/output, success criteria, failure modes, and scope boundaries. If web search is available, it checks for existing skills to avoid reinventing the wheel. The output is a clear spec document the user reviews before proceeding.

### Phase 2: Design

The agent selects the appropriate skill pattern (Reference, Task, or Tool-Orchestration), writes the SKILL.md with proper frontmatter, creates any necessary scripts for deterministic operations, and structures supplementary content into separate files for progressive disclosure. All design decisions follow best practices loaded from the included reference documents.

### Phase 3: Validation

The agent runs deterministic validation scripts on the generated skill, checking structure, quality (scored 0-100), and security. It fixes any issues found, re-validates until all structural checks pass and the quality score exceeds 70, then offers to install the finished skill to all detected agents.

---

## Commands

```bash
# Install the skill-engineer skill to detected agents
npx agent-pro-skills init

# Install to specific agents only
npx agent-pro-skills init --agents claude,cursor

# Install globally (available in all projects)
npx agent-pro-skills init --global

# Check what's currently installed
npx agent-pro-skills status

# Remove the skill from all agents
npx agent-pro-skills uninstall

# Version and help
npx agent-pro-skills --version
npx agent-pro-skills --help
```

| Command | Description |
|---------|-------------|
| `init` | Detect agents and install the skill-engineer skill |
| `init --agents <list>` | Install to specific agents (comma-separated) |
| `init --global` | Install to global skill folders instead of project-level |
| `init --symlink` | Use symlinks instead of copying (Unix only) |
| `status` | Show which agents have the skill installed |
| `uninstall` | Remove skill-engineer from all detected agents |
| `--version` | Print the installed version |
| `--help` | Show usage information |

---

## Supported Agents

The SKILL.md format is an open standard that works identically across all platforms. A skill authored for one agent works unchanged on all others.

| Agent | Project Skill Folder | Global Skill Folder |
|-------|---------------------|---------------------|
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| Cursor | `.cursor/skills/` | `~/.cursor/skills/` |
| GitHub Copilot | `.github/skills/` | `~/.github/skills/` |
| Codex CLI | `.codex/skills/` | `~/.codex/skills/` |
| Antigravity | `.gemini/skills/` | `~/.gemini/antigravity/skills/` |
| Windsurf | `.windsurf/skills/` | `~/.windsurf/skills/` |
| Gemini CLI | `.gemini/skills/` | `~/.gemini/skills/` |
| Universal fallback | `.agents/skills/` | `~/.agents/skills/` |

The CLI auto-detects which agents are installed by checking for running processes, config directories, and project-level folders. You can also specify agents explicitly with the `--agents` flag.

---

## The Skill-Engineer Skill

The core product is a skill folder installed into your agents:

```
skill-engineer/
├── SKILL.md                          # Three-phase process instructions
├── scripts/
│   ├── validate.sh                   # Deterministic quality checks
│   ├── score.py                      # Token counting and structure analysis
│   └── install-skill.sh             # Install output skill to detected agents
├── templates/
│   ├── reference-skill.md            # Template: knowledge/convention skills
│   ├── task-skill.md                 # Template: action/automation skills
│   └── tool-skill.md                # Template: MCP-integrated skills
├── references/
│   ├── best-practices.md             # Skill design patterns
│   ├── common-mistakes.md            # What bad skills get wrong
│   ├── frontmatter-guide.md          # Writing good descriptions
│   └── progressive-disclosure.md     # Context management
└── examples/
    ├── good-skill-example.md         # Well-structured skill
    └── bad-skill-example.md          # Common anti-patterns
```

### Skill Patterns

The skill-engineer guides the agent to choose one of three patterns based on the user's needs:

| Pattern | Use Case | Example |
|---------|----------|---------|
| **Reference** | Knowledge, conventions, style guides. The agent's language ability handles everything; no scripts needed. | API design conventions, coding standards, brand guidelines |
| **Task** | Repeatable workflows with deterministic steps. Includes scripts for operations that shouldn't rely on LLM non-determinism. | Deploy workflow, PR review checklist, release process |
| **Tool-Orchestration** | Workflows that need external services via MCP or subagents. Combines LLM instructions with tool calls. | Create issue, create branch, fix code, open PR |

---

## Validation

The validation scripts run locally with no API calls and check three categories:

### Structural Checks (pass/fail)

- SKILL.md exists and contains valid markdown
- YAML frontmatter is present and parseable
- `name` field exists and is kebab-case
- `description` field exists and is under 200 characters
- Folder name matches the `name` field
- All referenced scripts exist and are executable
- All referenced template and reference files exist

### Quality Score (0-100)

- Instruction token count (penalty if SKILL.md body exceeds 3,000 tokens)
- Description specificity (penalty for vague terms like "helpful" or "useful")
- At least 2 usage examples present
- Explicit scope boundaries (DO and DO NOT sections)
- Clear step-by-step instructions (not vague prose)
- Scripts include error handling (`set -e`, try/except)
- Progressive disclosure used for large skills (references/ folder)

### Security Checks (pass/fail)

- No hardcoded API keys, tokens, or passwords
- No `curl | bash` or `curl | sh` patterns
- No file operations outside the project directory
- No `eval` or dynamic code execution on user input
- Scripts do not install global packages without explicit user action

Example output:

```
=== Skill Validation Report ===
Skill: pr-reviewer

Structural Checks:
  ✓ SKILL.md exists and valid
  ✓ Frontmatter valid (name: pr-reviewer)
  ✓ Description: 128 chars (under 200 limit)
  ✓ All scripts found and executable

Quality Score: 92/100
  ✓ Token count: 1,624 (under 3,000 limit)
  ✓ Description is specific
  ✓ 3 usage examples included
  ✓ Explicit DO NOT section
  ✓ Progressive disclosure (references/)
  ✗ Script missing set -euo pipefail (-8)

Security Checks:
  ✓ No hardcoded secrets
  ✓ No unsafe patterns
  ✓ File operations scoped to project

Result: PASS (1 minor issue)
```

---

## Development

### Prerequisites

- Node.js 18+
- npm

### Setup

```bash
# Clone the repository
git clone https://github.com/kunalrajput7/agent-pro-skills.git
cd agent-pro-skills

# Install dependencies
npm install

# Link for local testing
npm link

# Now you can run locally:
agent-pro-skills init
agent-pro-skills status
```

### Testing

```bash
npm test
```

Tests use the Node.js built-in test runner (`node --test`). No test framework dependencies.

### Linting

```bash
npm run lint
```

### Design Principles

- **Zero dependencies** — Only Node.js built-in modules (fs, path, os, child_process, readline). `npx` downloads the smallest possible package and works instantly.
- **No build step** — Ship raw JavaScript, no TypeScript compilation, no bundling.
- **Cross-platform** — Works on macOS, Linux, and Windows. Uses `path.join()` and `os.homedir()` everywhere.
- **Non-destructive** — Never deletes or overwrites user files. Asks before replacing existing skill folders.
- **Offline-capable** — The CLI and all validation scripts work completely offline.

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on reporting bugs, suggesting features, and submitting pull requests.

---

## License

[MIT](./LICENSE) -- Copyright (c) 2026 Agent Pro Skills Contributors

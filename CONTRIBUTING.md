# Contributing to agent-pro-skills

Thank you for your interest in contributing. This guide covers the process for reporting bugs, suggesting features, and submitting code changes.

---

## Reporting Bugs

Open a [GitHub issue](https://github.com/kunalrajput7/agent-pro-skills/issues) with the following information:

1. **What you expected to happen** and **what actually happened**
2. **Steps to reproduce** the problem
3. **Environment details**: OS, Node.js version (`node --version`), agent(s) you tested with
4. **Error output** or logs, if any

Check existing issues first to avoid duplicates. If you find a related open issue, add a comment there instead of opening a new one.

---

## Suggesting Features

Open a [GitHub issue](https://github.com/kunalrajput7/agent-pro-skills/issues) with the label `enhancement` and describe:

1. **The problem** you are trying to solve
2. **Your proposed solution** (if you have one)
3. **Alternatives you considered**

Feature discussions happen in the issue thread before any code is written.

---

## Submitting Pull Requests

### 1. Fork and branch

```bash
git clone https://github.com/<your-username>/agent-pro-skills.git
cd agent-pro-skills
git checkout -b your-branch-name
```

Use a descriptive branch name: `fix/windows-path-detection`, `feat/add-agent-support`, `docs/update-readme`.

### 2. Make your changes

Follow the code style guidelines below. Keep changes focused — one logical change per PR.

### 3. Test

```bash
npm test
```

All existing tests must pass. If you add new functionality, add corresponding tests in the `tests/` directory.

### 4. Lint

```bash
npm run lint
```

Fix any lint errors before submitting.

### 5. Open a pull request

Push your branch and open a PR against `main`. In the PR description, include:

- **What** the change does
- **Why** it is needed
- **How** you tested it
- Reference any related issue (e.g., "Fixes #42")

---

## Code Style

- **Zero dependencies.** The package uses only Node.js built-in modules (`fs`, `path`, `os`, `child_process`, `readline`). Do not add npm dependencies.
- **CommonJS modules.** Use `require()` and `module.exports`, not ES module syntax.
- **Cross-platform.** Use `path.join()` and `os.homedir()` for file paths. Handle both forward slashes and backslashes. Test on Windows if you can.
- **No build step.** Ship plain JavaScript. No TypeScript, no bundlers, no transpilation.
- **Non-destructive.** Never delete or overwrite user files without explicit confirmation.

---

## Testing

Tests use the Node.js built-in test runner:

```bash
npm test          # runs: node --test tests/
```

Test files follow the naming convention `*.test.js` and live in the `tests/` directory. Use `node:test` and `node:assert` — no external test frameworks.

When adding tests:

- Cover the happy path and at least one failure case
- Mock filesystem operations where possible to avoid side effects
- Keep tests fast — no network calls, no sleeps

---

## Commit Messages

Use short, descriptive commit messages in imperative mood:

```
fix: handle backslash paths on Windows
feat: add Windsurf agent detection
docs: clarify --global flag behavior
test: add detection tests for Codex CLI
chore: update lint configuration
```

Format: `<type>: <short description>`

Types: `fix`, `feat`, `docs`, `test`, `chore`, `refactor`

Keep the subject line under 72 characters. Add a blank line and a longer body if more context is needed.

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/version/2/1/code_of_conduct/). By participating, you agree to uphold a welcoming, respectful, and harassment-free environment for everyone.

If you experience or witness unacceptable behavior, please report it by opening a GitHub issue or contacting the maintainers directly.

---

Thank you for helping make agent skills better for everyone.

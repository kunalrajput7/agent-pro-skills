'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { execSync, execFileSync } = require('node:child_process');

// =============================================================================
// Helpers
// =============================================================================

const VALIDATE_SCRIPT = path.join(__dirname, '..', 'skills', 'skill-engineer', 'scripts', 'validate.sh');

/**
 * Create a unique temporary directory for test isolation.
 */
function createTempDir() {
  const name = `agent-pro-skills-validate-test-${crypto.randomBytes(6).toString('hex')}`;
  const dir = path.join(os.tmpdir(), name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/**
 * Recursively remove a directory, ignoring errors.
 */
function cleanupDir(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Best-effort cleanup.
  }
}

/**
 * Locate a bash executable for running shell scripts on Windows.
 * Returns the path to bash, or null if unavailable.
 */
function findBash() {
  // On non-Windows, bash is almost always available.
  if (process.platform !== 'win32') {
    try {
      execSync('bash --version', { stdio: 'pipe' });
      return 'bash';
    } catch {
      return null;
    }
  }

  // On Windows, try common Git Bash locations, then PATH.
  const candidates = [
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'bin', 'bash.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'Git', 'bin', 'bash.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Git', 'bin', 'bash.exe'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  // Try PATH.
  try {
    execSync('bash --version', { stdio: 'pipe' });
    return 'bash';
  } catch {
    return null;
  }
}

/**
 * Run validate.sh against a skill folder and return { exitCode, stdout, stderr }.
 * Uses the discovered bash executable.
 */
function runValidate(bashPath, skillDir) {
  // Convert Windows paths to forward-slash for bash.
  const scriptPath = VALIDATE_SCRIPT.replace(/\\/g, '/');
  const dirPath = skillDir.replace(/\\/g, '/');

  try {
    const stdout = execFileSync(bashPath, [scriptPath, dirPath], {
      encoding: 'utf8',
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (err) {
    return {
      exitCode: err.status || 1,
      stdout: err.stdout || '',
      stderr: err.stderr || '',
    };
  }
}

/**
 * Create a valid SKILL.md with all required fields and quality markers.
 */
function createValidSkillMd(skillDir, skillName) {
  const content = `---
name: ${skillName}
description: Automate code review checks by running linters and formatting validators before commits.
---

# ${skillName}

Run automated code review checks on staged files before committing. Do not run on untracked files.

## Steps

1. Gather the list of staged files with \`git diff --cached --name-only\`.
2. Run the project linter on each staged file.
3. Check for formatting issues using the configured formatter.
4. Report results in a structured summary.
5. If all checks pass, confirm the commit is safe.

## Examples

### Example 1: Clean code
**Input:** User runs the skill on staged files.
**Result:** All checks pass. Skill reports "All files pass linting and formatting."

### Example 2: Lint errors found
**Input:** User stages a file with unused imports.
**Result:** Skill reports lint errors with file name and line numbers.

## Do NOT

- Do not modify any files. This skill is read-only.
- Do not run on entire repositories — only staged files.
- Do not skip the formatting check even if linting passes.
`;

  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf8');
}

// =============================================================================
// Locate bash — all tests in this file are conditional on bash availability
// =============================================================================

const BASH_PATH = findBash();
const SKIP_BASH = BASH_PATH ? false : 'bash not found on this system (Git Bash required on Windows)';

// =============================================================================
// validate.sh — valid skill
// =============================================================================

describe('validate.sh with a valid skill', { skip: SKIP_BASH }, () => {
  let tempDir;
  let skillDir;

  before(() => {
    tempDir = createTempDir();
    skillDir = path.join(tempDir, 'code-review');
    fs.mkdirSync(skillDir, { recursive: true });
    createValidSkillMd(skillDir, 'code-review');
  });

  after(() => {
    cleanupDir(tempDir);
  });

  it('exits with code 0 for a valid skill', () => {
    const result = runValidate(BASH_PATH, skillDir);
    assert.equal(
      result.exitCode,
      0,
      `Expected exit code 0 but got ${result.exitCode}.\nStdout: ${result.stdout}\nStderr: ${result.stderr}`,
    );
  });

  it('output contains "PASS" or "WARN" but not "FAIL"', () => {
    const result = runValidate(BASH_PATH, skillDir);
    const output = result.stdout + result.stderr;
    // A valid skill should PASS (or WARN for quality), never FAIL.
    assert.ok(
      output.includes('PASS') || output.includes('WARN'),
      `Expected output to contain PASS or WARN.\nOutput: ${output}`,
    );
  });

  it('output contains the skill name', () => {
    const result = runValidate(BASH_PATH, skillDir);
    assert.ok(
      result.stdout.includes('code-review'),
      `Expected output to contain skill name "code-review".\nOutput: ${result.stdout}`,
    );
  });

  it('reports quality score', () => {
    const result = runValidate(BASH_PATH, skillDir);
    assert.ok(
      result.stdout.includes('Quality Score:'),
      `Expected output to contain "Quality Score:".\nOutput: ${result.stdout}`,
    );
  });
});

// =============================================================================
// validate.sh — missing SKILL.md
// =============================================================================

describe('validate.sh with missing SKILL.md', { skip: SKIP_BASH }, () => {
  let tempDir;
  let skillDir;

  before(() => {
    tempDir = createTempDir();
    skillDir = path.join(tempDir, 'empty-skill');
    fs.mkdirSync(skillDir, { recursive: true });
    // Intentionally do NOT create a SKILL.md.
  });

  after(() => {
    cleanupDir(tempDir);
  });

  it('exits with code 1 when SKILL.md is missing', () => {
    const result = runValidate(BASH_PATH, skillDir);
    assert.equal(
      result.exitCode,
      1,
      `Expected exit code 1 for missing SKILL.md but got ${result.exitCode}.\nStdout: ${result.stdout}\nStderr: ${result.stderr}`,
    );
  });

  it('output indicates SKILL.md is missing', () => {
    const result = runValidate(BASH_PATH, skillDir);
    const output = result.stdout + result.stderr;
    assert.ok(
      output.includes('SKILL.md') && (output.includes('missing') || output.includes('FAIL')),
      `Expected output to mention SKILL.md missing.\nOutput: ${output}`,
    );
  });

  it('output contains "FAIL"', () => {
    const result = runValidate(BASH_PATH, skillDir);
    const output = result.stdout + result.stderr;
    assert.ok(
      output.includes('FAIL'),
      `Expected output to contain "FAIL".\nOutput: ${output}`,
    );
  });
});

// =============================================================================
// validate.sh — vague description reduces quality score
// =============================================================================

describe('validate.sh with vague description', { skip: SKIP_BASH }, () => {
  let tempDir;
  let skillDir;

  before(() => {
    tempDir = createTempDir();
    skillDir = path.join(tempDir, 'vague-skill');
    fs.mkdirSync(skillDir, { recursive: true });

    // Create a SKILL.md with a vague description containing penalized words.
    const content = `---
name: vague-skill
description: A helpful and useful skill for various general purpose tasks.
---

# Vague Skill

This skill does helpful things.

## Steps

1. Do something useful.
2. Be helpful.

## Examples

### Example 1
**Input:** Something.
**Result:** Something helpful.

## Do NOT

- Do not be unhelpful.
`;
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf8');
  });

  after(() => {
    cleanupDir(tempDir);
  });

  it('exits with code 0 (vague description is a quality issue, not structural)', () => {
    const result = runValidate(BASH_PATH, skillDir);
    assert.equal(
      result.exitCode,
      0,
      `Expected exit code 0 (quality penalties do not cause FAIL) but got ${result.exitCode}.\nStderr: ${result.stderr}`,
    );
  });

  it('quality score is lower than 100 due to vague description', () => {
    const result = runValidate(BASH_PATH, skillDir);
    const match = result.stdout.match(/Quality Score:\s*(\d+)/);
    assert.ok(match, `Expected to find "Quality Score: N" in output.\nOutput: ${result.stdout}`);
    const score = parseInt(match[1], 10);
    assert.ok(score < 100, `Expected quality score < 100 for vague description, got ${score}`);
  });

  it('output mentions vague words penalty', () => {
    const result = runValidate(BASH_PATH, skillDir);
    assert.ok(
      result.stdout.includes('vague') || result.stdout.includes('penalty'),
      `Expected output to mention vague words or penalty.\nOutput: ${result.stdout}`,
    );
  });
});

// =============================================================================
// validate.sh — security: hardcoded secrets
// =============================================================================

describe('validate.sh catches hardcoded secrets', { skip: SKIP_BASH }, () => {
  let tempDir;
  let skillDir;

  before(() => {
    tempDir = createTempDir();
    skillDir = path.join(tempDir, 'secret-skill');
    fs.mkdirSync(path.join(skillDir, 'scripts'), { recursive: true });

    // Create a valid SKILL.md that references a script.
    const skillContent = `---
name: secret-skill
description: Deploys an application to the cloud using API credentials.
---

# Secret Skill

Deploy the application by running the deployment script.

## Steps

1. Run the deployment script: \`bash scripts/deploy.sh\`.
2. Check the output for success.

## Examples

### Example 1
**Input:** User asks to deploy.
**Result:** Deployment succeeds.

## Do NOT

- Do not deploy to production without confirmation.
`;
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillContent, 'utf8');

    // Create a script with a hardcoded secret (NOT marked as example/placeholder).
    const scriptContent = `#!/bin/bash
set -euo pipefail

API_KEY="sk_live_a1b2c3d4e5f6g7h8i9j0"
curl -H "Authorization: Bearer $API_KEY" https://api.deploy.example.com/deploy
`;
    const scriptPath = path.join(skillDir, 'scripts', 'deploy.sh');
    fs.writeFileSync(scriptPath, scriptContent, 'utf8');

    // Make the script executable (matters on non-Windows).
    try {
      fs.chmodSync(scriptPath, 0o755);
    } catch {
      // chmod may not work on Windows — that is fine.
    }
  });

  after(() => {
    cleanupDir(tempDir);
  });

  it('exits with code 1 when hardcoded secrets are detected', () => {
    const result = runValidate(BASH_PATH, skillDir);
    assert.equal(
      result.exitCode,
      1,
      `Expected exit code 1 for hardcoded secrets but got ${result.exitCode}.\nStdout: ${result.stdout}\nStderr: ${result.stderr}`,
    );
  });

  it('output mentions hardcoded secret or security issue', () => {
    const result = runValidate(BASH_PATH, skillDir);
    const output = result.stdout + result.stderr;
    const mentionsSecret =
      output.toLowerCase().includes('secret') ||
      output.toLowerCase().includes('hardcoded') ||
      output.includes('FAIL');
    assert.ok(
      mentionsSecret,
      `Expected output to mention hardcoded secret or FAIL.\nOutput: ${output}`,
    );
  });

  it('output contains "FAIL" for security violation', () => {
    const result = runValidate(BASH_PATH, skillDir);
    const output = result.stdout + result.stderr;
    assert.ok(
      output.includes('FAIL'),
      `Expected "FAIL" in output for security violation.\nOutput: ${output}`,
    );
  });
});

// =============================================================================
// validate.sh — structural: folder name mismatch
// =============================================================================

describe('validate.sh catches folder name mismatch', { skip: SKIP_BASH }, () => {
  let tempDir;
  let skillDir;

  before(() => {
    tempDir = createTempDir();
    // Folder is named "wrong-folder" but the frontmatter name is "correct-skill".
    skillDir = path.join(tempDir, 'wrong-folder');
    fs.mkdirSync(skillDir, { recursive: true });

    const content = `---
name: correct-skill
description: A skill with a mismatched folder name for testing validation.
---

# Correct Skill

1. Step one.
2. Step two.

## Examples

### Example 1
**Input:** Test.
**Result:** Test.

## Do NOT

- Do not mismatch folder names.
`;
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), content, 'utf8');
  });

  after(() => {
    cleanupDir(tempDir);
  });

  it('exits with code 1 when folder name does not match name field', () => {
    const result = runValidate(BASH_PATH, skillDir);
    assert.equal(
      result.exitCode,
      1,
      `Expected exit code 1 for folder name mismatch but got ${result.exitCode}.\nStdout: ${result.stdout}\nStderr: ${result.stderr}`,
    );
  });

  it('output mentions the folder name mismatch', () => {
    const result = runValidate(BASH_PATH, skillDir);
    const output = result.stdout + result.stderr;
    assert.ok(
      output.includes('Folder name') || output.includes('does not match'),
      `Expected output to mention folder name mismatch.\nOutput: ${output}`,
    );
  });
});

// =============================================================================
// validate.sh — no argument provided
// =============================================================================

describe('validate.sh with no arguments', { skip: SKIP_BASH }, () => {
  it('exits with code 1 when no skill folder is given', () => {
    try {
      const scriptPath = VALIDATE_SCRIPT.replace(/\\/g, '/');
      execFileSync(BASH_PATH, [scriptPath], {
        encoding: 'utf8',
        timeout: 15000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      // If we reach here, the script did not fail.
      assert.fail('Expected validate.sh to exit with code 1 when called with no arguments');
    } catch (err) {
      assert.equal(err.status, 1, `Expected exit code 1, got ${err.status}`);
    }
  });

  it('prints usage instructions', () => {
    try {
      const scriptPath = VALIDATE_SCRIPT.replace(/\\/g, '/');
      execFileSync(BASH_PATH, [scriptPath], {
        encoding: 'utf8',
        timeout: 15000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (err) {
      const output = (err.stdout || '') + (err.stderr || '');
      assert.ok(
        output.includes('Usage') || output.includes('usage'),
        `Expected usage message.\nOutput: ${output}`,
      );
    }
  });
});

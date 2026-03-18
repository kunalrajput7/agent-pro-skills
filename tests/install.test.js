'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const { installSkill, checkInstalled } = require('../lib/install');
const { uninstallSkill } = require('../lib/uninstall');
const { SKILL_ENGINEER_DIR } = require('../lib/utils');

// =============================================================================
// Helpers
// =============================================================================

/**
 * Create a unique temporary directory for test isolation.
 */
function createTempDir() {
  const name = `agent-pro-skills-test-${crypto.randomBytes(6).toString('hex')}`;
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
    // Best-effort cleanup — ignore errors on Windows file locks.
  }
}

/**
 * Set up a fake agent directory structure inside a temp directory so that
 * detectAgents() will find agents when cwd is the temp dir.
 *
 * We create project-level dirs (e.g. .claude, .cursor) that the detect
 * module will pick up when resolving from process.cwd().
 */
function setupMockAgentDirs(rootDir, agentDirNames) {
  for (const dirName of agentDirNames) {
    fs.mkdirSync(path.join(rootDir, dirName), { recursive: true });
  }
}

// =============================================================================
// checkInstalled()
// =============================================================================

describe('checkInstalled()', () => {
  it('returns an array', () => {
    const result = checkInstalled();
    assert.ok(Array.isArray(result), 'checkInstalled() should return an array');
  });

  it('each entry has agent, path, and installed fields', () => {
    const result = checkInstalled();

    for (const entry of result) {
      assert.ok('agent' in entry, 'Entry should have "agent" field');
      assert.ok('path' in entry, 'Entry should have "path" field');
      assert.ok('installed' in entry, 'Entry should have "installed" field');
      assert.equal(typeof entry.agent, 'string');
      assert.equal(typeof entry.path, 'string');
      assert.equal(typeof entry.installed, 'boolean');
    }
  });

  it('accepts both "global" and "project" scope', () => {
    assert.doesNotThrow(() => checkInstalled('global'));
    assert.doesNotThrow(() => checkInstalled('project'));
  });
});

// =============================================================================
// installSkill() — targeted agent install in temp directory
// =============================================================================

describe('installSkill() with targeted agent', () => {
  let tempDir;

  before(() => {
    tempDir = createTempDir();
  });

  after(() => {
    cleanupDir(tempDir);
  });

  it('installs skill-engineer to a specific agent skill path', () => {
    // We target a specific agent (claude-code) in global mode.
    // The global skill path for claude-code is: <homedir>/.claude/skills
    // Instead, we target the agent by name so it writes to its configured path.
    // For a controlled test, we install to "claude-code" agent.
    const results = installSkill({ agents: ['claude-code'], global: true });

    assert.ok(Array.isArray(results), 'installSkill should return an array');
    assert.ok(results.length > 0, 'Should have at least one result for claude-code');

    const entry = results[0];
    assert.ok(
      ['installed', 'exists'].includes(entry.status),
      `Status should be "installed" or "exists", got "${entry.status}"`,
    );
    assert.equal(entry.agent, 'Claude Code');
    assert.ok(entry.path.includes('skill-engineer'), 'Path should include "skill-engineer"');
  });

  it('reports "exists" when installing a second time to the same agent', () => {
    // The first install happened in the previous test. Installing again
    // to the same agent should report "exists".
    const results = installSkill({ agents: ['claude-code'], global: true });
    assert.ok(results.length > 0);
    assert.equal(results[0].status, 'exists', 'Second install should report "exists"');
  });

  it('returns an empty array for a non-existent agent name', () => {
    const results = installSkill({ agents: ['totally-fake-agent'], global: true });
    assert.ok(Array.isArray(results));
    assert.equal(results.length, 0, 'No results for non-existent agent');
  });

  it('result entries have required fields', () => {
    const results = installSkill({ agents: ['cursor'], global: true });

    for (const entry of results) {
      assert.ok('agent' in entry, 'Entry must have "agent"');
      assert.ok('path' in entry, 'Entry must have "path"');
      assert.ok('status' in entry, 'Entry must have "status"');
      assert.ok(
        ['installed', 'exists', 'error'].includes(entry.status),
        `Unexpected status: "${entry.status}"`,
      );
    }
  });
});

// =============================================================================
// installSkill() — file content verification
// =============================================================================

describe('installSkill() copies files correctly', () => {
  let targetDir;

  before(() => {
    // Install to a known agent, then verify the file was actually copied.
    const results = installSkill({ agents: ['claude-code'], global: true });
    const entry = results.find((r) => r.agent === 'Claude Code');
    targetDir = entry ? entry.path : null;
  });

  it('creates the skill-engineer directory', () => {
    assert.ok(targetDir, 'targetDir should be set from install result');
    assert.ok(fs.existsSync(targetDir), `Expected directory to exist: ${targetDir}`);
  });

  it('copies SKILL.md into the target', () => {
    const skillMd = path.join(targetDir, 'SKILL.md');
    assert.ok(fs.existsSync(skillMd), `Expected SKILL.md at ${skillMd}`);
  });

  it('copied SKILL.md has the correct content', () => {
    const sourceMd = path.join(SKILL_ENGINEER_DIR, 'SKILL.md');
    const targetMd = path.join(targetDir, 'SKILL.md');

    // If the install was via symlink, the content is the same too.
    const sourceContent = fs.readFileSync(sourceMd, 'utf8');
    const targetContent = fs.readFileSync(targetMd, 'utf8');
    assert.equal(targetContent, sourceContent, 'SKILL.md content should match the source');
  });

  it('copies the scripts directory', () => {
    const scriptsDir = path.join(targetDir, 'scripts');
    // The skill-engineer template has a scripts/ directory.
    const sourceScripts = path.join(SKILL_ENGINEER_DIR, 'scripts');
    if (fs.existsSync(sourceScripts)) {
      assert.ok(fs.existsSync(scriptsDir), `Expected scripts/ directory at ${scriptsDir}`);
    }
  });

  it('copies the references directory', () => {
    const refsDir = path.join(targetDir, 'references');
    const sourceRefs = path.join(SKILL_ENGINEER_DIR, 'references');
    if (fs.existsSync(sourceRefs)) {
      assert.ok(fs.existsSync(refsDir), `Expected references/ directory at ${refsDir}`);
    }
  });

  it('copies the templates directory', () => {
    const tplDir = path.join(targetDir, 'templates');
    const sourceTpl = path.join(SKILL_ENGINEER_DIR, 'templates');
    if (fs.existsSync(sourceTpl)) {
      assert.ok(fs.existsSync(tplDir), `Expected templates/ directory at ${tplDir}`);
    }
  });
});

// =============================================================================
// uninstallSkill()
// =============================================================================

describe('uninstallSkill()', () => {
  let tempDir;

  before(() => {
    tempDir = createTempDir();
  });

  after(() => {
    cleanupDir(tempDir);
  });

  it('returns an empty array for a non-existent agent', () => {
    const results = uninstallSkill({ agents: ['totally-fake-agent'], global: true });
    assert.ok(Array.isArray(results));
    assert.equal(results.length, 0);
  });

  it('reports "not-found" when the skill was never installed', () => {
    // Use windsurf agent which is unlikely to have the skill installed.
    // First ensure the directory does NOT have skill-engineer in it.
    const { getAgentByName } = require('../lib/detect');
    const config = getAgentByName('windsurf');
    const skillDir = path.join(config.skillPath('global'), 'skill-engineer');

    // Only run this assertion if skill-engineer is genuinely absent.
    if (!fs.existsSync(skillDir)) {
      const results = uninstallSkill({ agents: ['windsurf'], global: true });
      assert.ok(results.length > 0);
      assert.equal(results[0].status, 'not-found');
    }
  });

  it('removes skill-engineer after it is installed', () => {
    // Install to a controlled agent, then uninstall and verify removal.
    // We use codex agent with global scope to minimize side effects.
    const installResults = installSkill({ agents: ['codex'], global: true });

    if (installResults.length > 0 && installResults[0].status === 'installed') {
      const installedPath = installResults[0].path;
      assert.ok(fs.existsSync(installedPath), 'Skill should exist after install');

      const uninstallResults = uninstallSkill({ agents: ['codex'], global: true });
      assert.ok(uninstallResults.length > 0);
      assert.equal(uninstallResults[0].status, 'removed');
      assert.ok(!fs.existsSync(installedPath), 'Skill directory should be removed after uninstall');
    }
  });

  it('result entries have required fields', () => {
    const results = uninstallSkill({ agents: ['cursor'], global: true });

    for (const entry of results) {
      assert.ok('agent' in entry, 'Entry must have "agent"');
      assert.ok('path' in entry, 'Entry must have "path"');
      assert.ok('status' in entry, 'Entry must have "status"');
      assert.ok(
        ['removed', 'not-found', 'error'].includes(entry.status),
        `Unexpected status: "${entry.status}"`,
      );
    }
  });
});

// =============================================================================
// Install + Uninstall round-trip in isolated temp directory
// =============================================================================

describe('install/uninstall round-trip with mock project', () => {
  let tempDir;
  let originalCwd;

  before(() => {
    tempDir = createTempDir();
    originalCwd = process.cwd();

    // Create a .claude project directory so detectAgents() finds claude-code
    // when scanning from the temp dir as cwd.
    setupMockAgentDirs(tempDir, ['.claude']);

    // Change cwd so that detect module picks up the project dir.
    process.chdir(tempDir);
  });

  after(() => {
    // Restore original working directory before cleanup.
    process.chdir(originalCwd);
    cleanupDir(tempDir);
  });

  it('detectAgents finds claude-code via project dir in temp folder', () => {
    const { detectAgents: detect } = require('../lib/detect');
    const agents = detect('project');
    const claudeAgent = agents.find((a) => a.name === 'claude-code');
    assert.ok(claudeAgent, 'Should detect claude-code from .claude project dir');
    assert.equal(claudeAgent.detectedVia, 'projectDir');
  });

  it('installSkill creates skill-engineer in the temp project', () => {
    const results = installSkill({ agents: ['claude-code'], global: false });
    assert.ok(results.length > 0, 'Should return at least one result');

    const entry = results[0];
    assert.equal(entry.status, 'installed', 'Skill should be freshly installed');

    // Verify the path is inside our temp directory.
    assert.ok(
      entry.path.startsWith(tempDir),
      `Installed path "${entry.path}" should be inside temp dir "${tempDir}"`,
    );

    // Verify SKILL.md exists.
    const skillMd = path.join(entry.path, 'SKILL.md');
    assert.ok(fs.existsSync(skillMd), `SKILL.md should exist at ${skillMd}`);
  });

  it('checkInstalled reports the skill as installed in the temp project', () => {
    const results = checkInstalled('project');
    const claudeEntry = results.find((r) => r.agent === 'Claude Code');
    assert.ok(claudeEntry, 'Should find Claude Code in checkInstalled results');
    assert.equal(claudeEntry.installed, true, 'Should report installed=true');
  });

  it('uninstallSkill removes skill-engineer from the temp project', () => {
    const results = uninstallSkill({ agents: ['claude-code'], global: false });
    assert.ok(results.length > 0);
    assert.equal(results[0].status, 'removed');

    // The skill-engineer directory should be gone.
    const skillEngineerDir = path.join(tempDir, '.claude', 'skills', 'skill-engineer');
    assert.ok(!fs.existsSync(skillEngineerDir), 'skill-engineer dir should be removed');
  });

  it('checkInstalled reports the skill as not installed after uninstall', () => {
    const results = checkInstalled('project');
    const claudeEntry = results.find((r) => r.agent === 'Claude Code');
    assert.ok(claudeEntry, 'Should still find Claude Code in checkInstalled results');
    assert.equal(claudeEntry.installed, false, 'Should report installed=false after uninstall');
  });
});

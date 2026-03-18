'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { getAgentConfigs, getAgentByName, detectAgents, getAllSkillPaths } = require('../lib/detect');

// =============================================================================
// getAgentConfigs()
// =============================================================================

describe('getAgentConfigs()', () => {
  it('returns an array of 7 agent configurations', () => {
    const configs = getAgentConfigs();
    assert.ok(Array.isArray(configs), 'Expected an array');
    assert.equal(configs.length, 7, 'Expected exactly 7 agent configs');
  });

  it('each config has all required fields', () => {
    const requiredFields = ['name', 'displayName', 'processNames', 'globalDirs', 'projectDirs', 'skillPath'];
    const configs = getAgentConfigs();

    for (const config of configs) {
      for (const field of requiredFields) {
        assert.ok(
          field in config,
          `Agent "${config.name || '(unknown)'}" is missing required field "${field}"`,
        );
      }
    }
  });

  it('name field is a non-empty string for every agent', () => {
    const configs = getAgentConfigs();

    for (const config of configs) {
      assert.equal(typeof config.name, 'string');
      assert.ok(config.name.length > 0, 'name must not be empty');
    }
  });

  it('displayName field is a non-empty string for every agent', () => {
    const configs = getAgentConfigs();

    for (const config of configs) {
      assert.equal(typeof config.displayName, 'string');
      assert.ok(config.displayName.length > 0, 'displayName must not be empty');
    }
  });

  it('processNames is a non-empty array of strings for every agent', () => {
    const configs = getAgentConfigs();

    for (const config of configs) {
      assert.ok(Array.isArray(config.processNames), `processNames for "${config.name}" must be an array`);
      assert.ok(config.processNames.length > 0, `processNames for "${config.name}" must not be empty`);
      for (const pn of config.processNames) {
        assert.equal(typeof pn, 'string');
      }
    }
  });

  it('globalDirs is a non-empty array of strings for every agent', () => {
    const configs = getAgentConfigs();

    for (const config of configs) {
      assert.ok(Array.isArray(config.globalDirs), `globalDirs for "${config.name}" must be an array`);
      assert.ok(config.globalDirs.length > 0, `globalDirs for "${config.name}" must not be empty`);
    }
  });

  it('projectDirs is a non-empty array of strings for every agent', () => {
    const configs = getAgentConfigs();

    for (const config of configs) {
      assert.ok(Array.isArray(config.projectDirs), `projectDirs for "${config.name}" must be an array`);
      assert.ok(config.projectDirs.length > 0, `projectDirs for "${config.name}" must not be empty`);
    }
  });

  it('skillPath is a function for every agent', () => {
    const configs = getAgentConfigs();

    for (const config of configs) {
      assert.equal(
        typeof config.skillPath,
        'function',
        `skillPath for "${config.name}" must be a function`,
      );
    }
  });

  it('includes the expected agent names', () => {
    const configs = getAgentConfigs();
    const names = configs.map((c) => c.name);

    const expected = [
      'claude-code',
      'cursor',
      'github-copilot',
      'codex',
      'antigravity',
      'windsurf',
      'gemini-cli',
    ];

    for (const name of expected) {
      assert.ok(names.includes(name), `Expected agent "${name}" to be in the config list`);
    }
  });
});

// =============================================================================
// skillPath() behaviour
// =============================================================================

describe('skillPath() for each agent', () => {
  it('returns a path containing "skills" for global scope', () => {
    const configs = getAgentConfigs();

    for (const config of configs) {
      const globalPath = config.skillPath('global');
      assert.equal(typeof globalPath, 'string', `skillPath('global') for "${config.name}" must return a string`);
      assert.ok(
        globalPath.includes('skills'),
        `Global skillPath for "${config.name}" should contain "skills": got "${globalPath}"`,
      );
    }
  });

  it('returns a path containing "skills" for project scope', () => {
    const configs = getAgentConfigs();

    for (const config of configs) {
      const projectPath = config.skillPath('project');
      assert.equal(typeof projectPath, 'string', `skillPath('project') for "${config.name}" must return a string`);
      assert.ok(
        projectPath.includes('skills'),
        `Project skillPath for "${config.name}" should contain "skills": got "${projectPath}"`,
      );
    }
  });

  it('global path starts with the home directory', () => {
    const configs = getAgentConfigs();
    const home = os.homedir();

    for (const config of configs) {
      const globalPath = config.skillPath('global');
      assert.ok(
        globalPath.startsWith(home),
        `Global skillPath for "${config.name}" should start with homedir "${home}": got "${globalPath}"`,
      );
    }
  });

  it('project path starts with the current working directory', () => {
    const configs = getAgentConfigs();
    const cwd = process.cwd();

    for (const config of configs) {
      const projectPath = config.skillPath('project');
      assert.ok(
        projectPath.startsWith(cwd),
        `Project skillPath for "${config.name}" should start with cwd "${cwd}": got "${projectPath}"`,
      );
    }
  });

  it('global and project paths are different', () => {
    const configs = getAgentConfigs();

    for (const config of configs) {
      const globalPath = config.skillPath('global');
      const projectPath = config.skillPath('project');
      // They should only be equal if cwd happens to be the home dir, which is unlikely.
      // But we only assert when they are expected to differ.
      if (os.homedir() !== process.cwd()) {
        assert.notEqual(
          globalPath,
          projectPath,
          `Global and project paths for "${config.name}" should differ`,
        );
      }
    }
  });
});

// =============================================================================
// getAgentByName()
// =============================================================================

describe('getAgentByName()', () => {
  it('returns the Claude Code config when searching for "claude-code"', () => {
    const config = getAgentByName('claude-code');
    assert.ok(config, 'Expected a config object for "claude-code"');
    assert.equal(config.name, 'claude-code');
    assert.equal(config.displayName, 'Claude Code');
  });

  it('returns the Cursor config when searching for "cursor"', () => {
    const config = getAgentByName('cursor');
    assert.ok(config, 'Expected a config object for "cursor"');
    assert.equal(config.name, 'cursor');
    assert.equal(config.displayName, 'Cursor');
  });

  it('returns undefined for a non-existent agent name', () => {
    const config = getAgentByName('nonexistent');
    assert.equal(config, undefined, 'Expected undefined for a non-existent agent');
  });

  it('returns undefined for an empty string', () => {
    const config = getAgentByName('');
    assert.equal(config, undefined);
  });

  it('returns undefined for null', () => {
    const config = getAgentByName(null);
    assert.equal(config, undefined);
  });

  it('is case-sensitive (uppercase should not match)', () => {
    const config = getAgentByName('Claude-Code');
    assert.equal(config, undefined, 'Agent lookup should be case-sensitive');
  });

  it('returned config has a working skillPath function', () => {
    const config = getAgentByName('claude-code');
    assert.ok(config);
    assert.equal(typeof config.skillPath, 'function');

    const globalPath = config.skillPath('global');
    assert.ok(globalPath.endsWith(path.join('.claude', 'skills')));

    const projectPath = config.skillPath('project');
    assert.ok(projectPath.endsWith(path.join('.claude', 'skills')));
  });
});

// =============================================================================
// detectAgents()
// =============================================================================

describe('detectAgents()', () => {
  it('runs without throwing', () => {
    assert.doesNotThrow(() => detectAgents());
  });

  it('returns an array', () => {
    const result = detectAgents();
    assert.ok(Array.isArray(result), 'detectAgents() should return an array');
  });

  it('each detected agent has required fields', () => {
    const result = detectAgents();

    for (const agent of result) {
      assert.ok('name' in agent, 'Detected agent should have a "name" field');
      assert.ok('displayName' in agent, 'Detected agent should have a "displayName" field');
      assert.ok('detected' in agent, 'Detected agent should have a "detected" field');
      assert.ok('detectedVia' in agent, 'Detected agent should have a "detectedVia" field');
      assert.ok('skillPath' in agent, 'Detected agent should have a "skillPath" field');
    }
  });

  it('detectedVia is one of the expected values', () => {
    const validValues = ['projectDir', 'globalDir', 'process'];
    const result = detectAgents();

    for (const agent of result) {
      assert.ok(
        validValues.includes(agent.detectedVia),
        `detectedVia for "${agent.name}" should be one of ${validValues.join(', ')}: got "${agent.detectedVia}"`,
      );
    }
  });

  it('detected is always true for returned agents', () => {
    const result = detectAgents();

    for (const agent of result) {
      assert.equal(agent.detected, true, `Agent "${agent.name}" should have detected=true`);
    }
  });

  it('accepts "global" scope without throwing', () => {
    assert.doesNotThrow(() => detectAgents('global'));
  });

  it('accepts "project" scope without throwing', () => {
    assert.doesNotThrow(() => detectAgents('project'));
  });
});

// =============================================================================
// getAllSkillPaths()
// =============================================================================

describe('getAllSkillPaths()', () => {
  it('returns an array', () => {
    const result = getAllSkillPaths();
    assert.ok(Array.isArray(result), 'getAllSkillPaths() should return an array');
  });

  it('every element is a string', () => {
    const result = getAllSkillPaths();

    for (const p of result) {
      assert.equal(typeof p, 'string', `Expected string but got ${typeof p}: "${p}"`);
    }
  });

  it('every path contains "skills"', () => {
    const result = getAllSkillPaths();

    for (const p of result) {
      assert.ok(p.includes('skills'), `Expected path to contain "skills": got "${p}"`);
    }
  });

  it('accepts scope argument without throwing', () => {
    assert.doesNotThrow(() => getAllSkillPaths('global'));
    assert.doesNotThrow(() => getAllSkillPaths('project'));
  });

  it('returns the same number of paths as detectAgents returns agents', () => {
    const agents = detectAgents('global');
    const paths = getAllSkillPaths('global');
    assert.equal(paths.length, agents.length, 'Path count should match detected agent count');
  });
});

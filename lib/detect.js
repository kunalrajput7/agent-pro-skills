'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// ---------------------------------------------------------------------------
// Agent configurations
// ---------------------------------------------------------------------------

const AGENT_CONFIGS = [
  {
    name: 'claude-code',
    displayName: 'Claude Code',
    processNames: ['claude'],
    globalDirs: ['~/.claude'],
    projectDirs: ['.claude'],
    skillPath: (scope) => scope === 'global'
      ? path.join(os.homedir(), '.claude', 'skills')
      : path.join(process.cwd(), '.claude', 'skills'),
  },
  {
    name: 'cursor',
    displayName: 'Cursor',
    processNames: ['cursor'],
    globalDirs: ['~/.cursor'],
    projectDirs: ['.cursor'],
    skillPath: (scope) => scope === 'global'
      ? path.join(os.homedir(), '.cursor', 'skills')
      : path.join(process.cwd(), '.cursor', 'skills'),
  },
  {
    name: 'github-copilot',
    displayName: 'GitHub Copilot',
    processNames: ['code'],
    globalDirs: ['~/.github'],
    projectDirs: ['.github'],
    skillPath: (scope) => scope === 'global'
      ? path.join(os.homedir(), '.github', 'skills')
      : path.join(process.cwd(), '.github', 'skills'),
  },
  {
    name: 'codex',
    displayName: 'Codex CLI',
    processNames: ['codex'],
    globalDirs: ['~/.codex'],
    projectDirs: ['.codex'],
    skillPath: (scope) => scope === 'global'
      ? path.join(os.homedir(), '.codex', 'skills')
      : path.join(process.cwd(), '.codex', 'skills'),
  },
  {
    name: 'antigravity',
    displayName: 'Antigravity',
    processNames: ['antigravity'],
    globalDirs: ['~/.gemini/antigravity'],
    projectDirs: ['.gemini', '.agent', '.agents'],
    skillPath: (scope) => scope === 'global'
      ? path.join(os.homedir(), '.gemini', 'antigravity', 'skills')
      : path.join(process.cwd(), '.agent', 'skills'),
  },
  {
    name: 'windsurf',
    displayName: 'Windsurf',
    processNames: ['windsurf'],
    globalDirs: ['~/.windsurf', '~/.codeium'],
    projectDirs: ['.windsurf'],
    skillPath: (scope) => scope === 'global'
      ? path.join(os.homedir(), '.agents', 'skills')
      : path.join(process.cwd(), '.agents', 'skills'),
  },
  {
    name: 'gemini-cli',
    displayName: 'Gemini CLI',
    processNames: ['gemini'],
    globalDirs: ['~/.gemini'],
    projectDirs: ['.gemini'],
    skillPath: (scope) => scope === 'global'
      ? path.join(os.homedir(), '.gemini', 'skills')
      : path.join(process.cwd(), '.gemini', 'skills'),
  },
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a directory path, expanding a leading `~` to the user home dir.
 */
function resolvePath(dir) {
  if (dir.startsWith('~')) {
    return path.join(os.homedir(), dir.slice(1));
  }
  return path.resolve(dir);
}

/**
 * Return true when the given directory exists on disk.
 */
function dirExists(dir) {
  try {
    return fs.statSync(dir).isDirectory();
  } catch (_) {
    return false;
  }
}

/**
 * Return the list of running process names (lower-cased) on the current
 * platform.  Failures are silently swallowed — process detection is
 * best-effort.
 */
function getRunningProcesses() {
  try {
    const isWindows = os.platform() === 'win32';
    const cmd = isWindows
      ? 'tasklist /FO CSV /NH'
      : 'ps -eo comm=';

    const stdout = execSync(cmd, {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (isWindows) {
      // tasklist CSV rows look like: "Image Name","PID","Session Name",...
      // Extract the first quoted field from every line.
      return stdout
        .split('\n')
        .map((line) => {
          const match = line.match(/^"([^"]+)"/);
          if (!match) return '';
          // Strip .exe suffix so process name comparisons are uniform.
          return match[1].replace(/\.exe$/i, '').toLowerCase();
        })
        .filter(Boolean);
    }

    // Unix: one process name per line.
    return stdout
      .split('\n')
      .map((line) => path.basename(line.trim()).toLowerCase())
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

/**
 * Check whether any of the given process names appear in the running process
 * list.  `runningSet` is expected to be a Set of lower-cased names.
 */
function isProcessRunning(processNames, runningSet) {
  return processNames.some((name) => runningSet.has(name.toLowerCase()));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detect which coding agents are present on this machine.
 *
 * @param {'global'|'project'} [scope='global'] — whether to resolve skill
 *   paths for global or project scope.
 * @returns {Array<{name: string, displayName: string, detected: boolean,
 *   detectedVia: 'projectDir'|'globalDir'|'process', skillPath: string}>}
 *   Only agents that were actually detected are included.
 */
function detectAgents(scope) {
  scope = scope || 'global';

  // Fetch the running-process list once, shared across all agent checks.
  const runningProcesses = new Set(getRunningProcesses());
  const results = [];

  for (const config of AGENT_CONFIGS) {
    // 1. Project-level directories
    const projectDetected = config.projectDirs.some((dir) =>
      dirExists(path.resolve(process.cwd(), dir)),
    );
    if (projectDetected) {
      results.push({
        name: config.name,
        displayName: config.displayName,
        detected: true,
        detectedVia: 'projectDir',
        skillPath: config.skillPath(scope),
      });
      continue;
    }

    // 2. Global directories
    const globalDetected = config.globalDirs.some((dir) =>
      dirExists(resolvePath(dir)),
    );
    if (globalDetected) {
      results.push({
        name: config.name,
        displayName: config.displayName,
        detected: true,
        detectedVia: 'globalDir',
        skillPath: config.skillPath(scope),
      });
      continue;
    }

    // 3. Running process
    if (isProcessRunning(config.processNames, runningProcesses)) {
      results.push({
        name: config.name,
        displayName: config.displayName,
        detected: true,
        detectedVia: 'process',
        skillPath: config.skillPath(scope),
      });
    }
  }

  return results;
}

/**
 * Look up an agent configuration by its kebab-case name.
 *
 * @param {string} name — e.g. 'claude-code', 'cursor'
 * @returns {object|undefined} The matching entry from AGENT_CONFIGS, or
 *   undefined when no agent matches.
 */
function getAgentByName(name) {
  return AGENT_CONFIGS.find((c) => c.name === name);
}

/**
 * Return the full list of agent configurations.
 *
 * @returns {Array<object>}
 */
function getAgentConfigs() {
  return AGENT_CONFIGS;
}

/**
 * Convenience helper — return just the skill-folder paths for every agent
 * that was detected.
 *
 * @param {'global'|'project'} [scope='global']
 * @returns {string[]}
 */
function getAllSkillPaths(scope) {
  return detectAgents(scope).map((a) => a.skillPath);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  detectAgents,
  getAgentByName,
  getAgentConfigs,
  getAllSkillPaths,
};

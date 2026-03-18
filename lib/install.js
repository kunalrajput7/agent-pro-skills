'use strict';

const fs = require('fs');
const path = require('path');

const { ensureDir, copyDir, log, SKILL_ENGINEER_DIR, isSymlinkSupported, isWindows } = require('./utils');
const { detectAgents, getAgentByName } = require('./detect');

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the list of agents to operate on.
 *
 * When `agentNames` is provided (non-null, non-empty array) only the agents
 * whose kebab-case names appear in the list are returned.  Otherwise every
 * detected agent is returned.
 *
 * @param {string[]|null} agentNames — filter list, or null / undefined for all
 * @param {string} scope — 'global' or 'project'
 * @returns {Array<{name: string, displayName: string, skillPath: string}>}
 */
function resolveAgents(agentNames, scope) {
  if (agentNames && agentNames.length > 0) {
    // Return only the requested agents, regardless of whether they are
    // currently detected on this machine.  This allows users to install
    // skills for agents whose config directories don't yet exist.
    return agentNames
      .map((n) => {
        const config = getAgentByName(n);
        if (!config) return null;
        return {
          name: config.name,
          displayName: config.displayName,
          skillPath: config.skillPath(scope),
        };
      })
      .filter(Boolean);
  }

  // No filter — use every detected agent.
  return detectAgents(scope).map((a) => ({
    name: a.name,
    displayName: a.displayName,
    skillPath: a.skillPath,
  }));
}

/**
 * Create a directory symlink.  On Windows, junctions are used because they
 * do not require elevated privileges.
 */
function createSymlink(target, linkPath) {
  const type = isWindows() ? 'junction' : 'dir';
  fs.symlinkSync(target, linkPath, type);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Install the skill-engineer skill to each resolved agent's skill folder.
 *
 * @param {object} options
 * @param {string[]|null} options.agents — kebab-case agent names, or null for
 *   all detected agents.
 * @param {boolean} options.global — true  → install to the global skill folder
 *                                   false → install to the project-level folder
 * @param {boolean} options.symlink — when true (and the platform supports it),
 *   create a symbolic link instead of copying the files.
 *
 * @returns {Array<{agent: string, path: string, status: 'installed'|'exists'|'error', error?: string}>}
 */
function installSkill(options) {
  const { agents: agentNames = null, global: isGlobal = false, symlink = false } = options || {};

  const scope = isGlobal ? 'global' : 'project';
  const resolved = resolveAgents(agentNames, scope);
  const results = [];

  // If the caller asked for symlinks, verify the platform actually supports
  // them so we can fall back to copying with a meaningful message.
  const canSymlink = symlink && isSymlinkSupported();

  for (const agent of resolved) {
    const targetDir = path.join(agent.skillPath, 'skill-engineer');

    try {
      // If the target already exists do NOT overwrite — report and move on.
      if (fs.existsSync(targetDir)) {
        log.warn(`skill-engineer already exists at ${targetDir}`);
        results.push({ agent: agent.displayName, path: targetDir, status: 'exists' });
        continue;
      }

      // Ensure the parent skill folder exists.
      ensureDir(agent.skillPath);

      if (canSymlink) {
        // Create a symlink pointing at the package's bundled skill folder.
        createSymlink(SKILL_ENGINEER_DIR, targetDir);
        log.success(`Linked skill-engineer → ${targetDir}`);
      } else {
        // Copy the entire skill-engineer folder.
        copyDir(SKILL_ENGINEER_DIR, targetDir);
        log.success(`Installed skill-engineer → ${targetDir}`);
      }

      results.push({ agent: agent.displayName, path: targetDir, status: 'installed' });
    } catch (err) {
      log.error(`Failed to install for ${agent.displayName}: ${err.message}`);
      results.push({ agent: agent.displayName, path: targetDir, status: 'error', error: err.message });
    }
  }

  return results;
}

/**
 * Check whether skill-engineer is already installed for each detected agent.
 *
 * @param {'global'|'project'} [scope='project']
 * @returns {Array<{agent: string, path: string, installed: boolean}>}
 */
function checkInstalled(scope) {
  scope = scope || 'project';

  const agents = detectAgents(scope);
  const results = [];

  for (const agent of agents) {
    const skillMd = path.join(agent.skillPath, 'skill-engineer', 'SKILL.md');
    const installed = fs.existsSync(skillMd);

    results.push({
      agent: agent.displayName,
      path: path.join(agent.skillPath, 'skill-engineer'),
      installed,
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  installSkill,
  checkInstalled,
};

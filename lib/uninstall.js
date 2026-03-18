'use strict';

const fs = require('fs');
const path = require('path');

const { removeDir, log } = require('./utils');
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

  return detectAgents(scope).map((a) => ({
    name: a.name,
    displayName: a.displayName,
    skillPath: a.skillPath,
  }));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Uninstall the skill-engineer skill from each resolved agent's skill folder.
 *
 * Only the `skill-engineer/` sub-directory inside the agent's skill path is
 * removed.  No other files or folders are ever touched, keeping the operation
 * non-destructive.
 *
 * @param {object} options
 * @param {string[]|null} options.agents — kebab-case agent names, or null for
 *   all detected agents.
 * @param {boolean} options.global — true  → target the global skill folder
 *                                   false → target the project-level folder
 *
 * @returns {Array<{agent: string, path: string, status: 'removed'|'not-found'|'error', error?: string}>}
 */
function uninstallSkill(options) {
  const { agents: agentNames = null, global: isGlobal = false } = options || {};

  const scope = isGlobal ? 'global' : 'project';
  const resolved = resolveAgents(agentNames, scope);
  const results = [];

  for (const agent of resolved) {
    const targetDir = path.join(agent.skillPath, 'skill-engineer');

    try {
      if (!fs.existsSync(targetDir)) {
        log.info(`skill-engineer not found at ${targetDir} — nothing to remove.`);
        results.push({ agent: agent.displayName, path: targetDir, status: 'not-found' });
        continue;
      }

      // Remove the skill-engineer folder (and only that folder).
      removeDir(targetDir);
      log.success(`Removed skill-engineer from ${targetDir}`);
      results.push({ agent: agent.displayName, path: targetDir, status: 'removed' });
    } catch (err) {
      log.error(`Failed to uninstall for ${agent.displayName}: ${err.message}`);
      results.push({ agent: agent.displayName, path: targetDir, status: 'error', error: err.message });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  uninstallSkill,
};

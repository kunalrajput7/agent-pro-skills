#!/usr/bin/env node
'use strict';

const readline = require('readline');
const { log, colors, VERSION, PACKAGE_NAME } = require('../lib/utils');
const { detectAgents } = require('../lib/detect');
const { installSkill, checkInstalled } = require('../lib/install');
const { uninstallSkill } = require('../lib/uninstall');

// ---------------------------------------------------------------------------
// Argument parsing
// ---------------------------------------------------------------------------

/**
 * Parse process.argv into a structured object.
 * Handles positional commands, --flag options, and --key value pairs.
 */
function parseArgs(argv) {
  const args = argv.slice(2); // strip node and script path
  const parsed = {
    command: null,
    agents: null,
    global: false,
    symlink: false,
    version: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--version':
      case '-v':
        parsed.version = true;
        break;

      case '--help':
      case '-h':
        parsed.help = true;
        break;

      case '--global':
        parsed.global = true;
        break;

      case '--symlink':
        parsed.symlink = true;
        break;

      case '--agents': {
        const next = args[i + 1];
        if (next && !next.startsWith('-')) {
          parsed.agents = next.split(',').map((a) => a.trim()).filter(Boolean);
          i++; // consume the value
        }
        break;
      }

      default:
        // Treat first non-flag argument as the command
        if (!arg.startsWith('-') && !parsed.command) {
          parsed.command = arg;
        }
        break;
    }
  }

  return parsed;
}

// ---------------------------------------------------------------------------
// Interactive prompt helper
// ---------------------------------------------------------------------------

/**
 * Prompt the user with a yes/no question via readline.
 * @param {string} question  The question to display.
 * @param {boolean} defaultYes  Whether the default answer is "yes".
 * @returns {Promise<boolean>}
 */
function confirm(question, defaultYes = true) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(question, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === '') {
        resolve(defaultYes);
      } else {
        resolve(trimmed === 'y' || trimmed === 'yes');
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Help text
// ---------------------------------------------------------------------------

function printHelp() {
  const name = colors.bold(PACKAGE_NAME);
  console.log(`
${name} v${VERSION}

${colors.bold('USAGE')}
  npx ${PACKAGE_NAME} <command> [options]

${colors.bold('COMMANDS')}
  init          Install the skill-engineer skill to detected coding agents
  status        Show which agents have skill-engineer installed
  uninstall     Remove skill-engineer from agents

${colors.bold('OPTIONS')}
  --agents <list>   Comma-separated list of agents (e.g. claude,cursor)
  --global          Install/uninstall globally (~/.agent/skills/) instead of project-level
  --symlink         Use symlinks instead of copying files

  -v, --version     Print version number
  -h, --help        Show this help message

${colors.bold('EXAMPLES')}
  npx ${PACKAGE_NAME} init
  npx ${PACKAGE_NAME} init --agents claude,cursor
  npx ${PACKAGE_NAME} init --global --symlink
  npx ${PACKAGE_NAME} status
  npx ${PACKAGE_NAME} uninstall --agents cursor
`);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

/**
 * `init` — detect agents, prompt the user, and install skill-engineer.
 */
async function cmdInit(parsed) {
  // 1. Banner
  log.header(`${PACKAGE_NAME} v${VERSION}`);

  // 2. Detect agents
  log.info('Detecting installed coding agents...');
  const scope = parsed.global ? 'global' : 'project';
  const detected = detectAgents(scope);

  if (detected.length === 0) {
    log.warn('No coding agents detected.');
    log.info('');
    log.info('Supported agents: Claude Code, Cursor, GitHub Copilot, Codex CLI,');
    log.info('                  Antigravity, Windsurf, Gemini CLI');
    log.info('');
    log.info(`Run with ${colors.bold('--agents')} to specify agents manually:`);
    log.info(`  npx ${PACKAGE_NAME} init --agents claude,cursor`);
    process.exit(1);
  }

  // 3. Show detected agents
  for (const agent of detected) {
    log.success(`${agent.displayName} (${scope}: ${agent.skillPath})`);
  }
  log.info('');

  // 4. Determine which agents to install to
  let selectedAgents = detected;

  if (parsed.agents) {
    // Filter detected agents by the user-supplied list
    const requested = parsed.agents.map((a) => a.toLowerCase());
    selectedAgents = detected.filter((agent) =>
      requested.some(
        (r) =>
          agent.name.toLowerCase().includes(r) ||
          agent.displayName.toLowerCase().includes(r)
      )
    );

    if (selectedAgents.length === 0) {
      log.error(`None of the specified agents (${parsed.agents.join(', ')}) were detected.`);
      process.exit(1);
    }
  } else {
    // Prompt for confirmation
    const yes = await confirm(
      `  Install skill-engineer to all ${detected.length} agent${detected.length === 1 ? '' : 's'}? (Y/n) `
    );
    if (!yes) {
      log.info('Installation cancelled.');
      process.exit(0);
    }
  }

  // 5. Install
  log.info('');
  log.info('Installing...');
  const results = installSkill({
    agents: selectedAgents.map((a) => a.name),
    global: parsed.global,
    symlink: parsed.symlink,
  });

  // 6. Show results
  log.info('');
  for (const result of results) {
    if (result.status === 'installed') {
      log.success(result.path);
    } else if (result.status === 'exists') {
      log.warn(`${result.path} (already exists)`);
    } else {
      log.error(`${result.path} — ${result.error || 'failed'}`);
    }
  }

  // 7. Usage instructions
  log.info('');
  log.info(colors.bold('Done! Usage:'));
  log.step(`Type ${colors.cyan('/skill-engineer')} in your coding agent`);
  log.step(`Or say: ${colors.dim('"I need a skill for [your use case]"')}`);
  log.info('');
}

/**
 * `status` — show which agents have skill-engineer installed.
 */
function cmdStatus() {
  log.header(`${PACKAGE_NAME} v${VERSION}`);

  const allAgents = checkInstalled();
  const installed = allAgents.filter((e) => e.installed);
  const notInstalled = allAgents.filter((e) => !e.installed);

  if (installed.length === 0) {
    log.info('skill-engineer is not installed for any detected agent.');
    log.info('');
    log.info(`Run ${colors.bold(`npx ${PACKAGE_NAME} init`)} to install.`);
    log.info('');
    return;
  }

  log.info('skill-engineer is installed for:');
  log.info('');
  for (const entry of installed) {
    log.success(`${entry.agent} — ${entry.path}`);
  }

  if (notInstalled.length > 0) {
    log.info('');
    log.info('Not installed for:');
    for (const entry of notInstalled) {
      log.step(`${entry.agent}`);
    }
  }
  log.info('');
}

/**
 * `uninstall` — remove skill-engineer from agents.
 */
async function cmdUninstall(parsed) {
  log.header(`${PACKAGE_NAME} v${VERSION}`);

  // Prompt for confirmation
  const yes = await confirm(
    `  Remove skill-engineer from all agents? (y/N) `,
    false // default is "no"
  );
  if (!yes) {
    log.info('Uninstall cancelled.');
    return;
  }

  log.info('');
  log.info('Removing...');
  const results = uninstallSkill({
    agents: parsed.agents,
    global: parsed.global,
  });

  log.info('');
  for (const result of results) {
    if (result.status === 'removed') {
      log.success(`Removed from ${result.agent} — ${result.path}`);
    } else if (result.status === 'not-found') {
      log.info(`${result.agent} — not installed`);
    } else {
      log.error(`${result.agent} — ${result.error || 'failed'}`);
    }
  }
  log.info('');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const parsed = parseArgs(process.argv);

  // --version / -v
  if (parsed.version) {
    console.log(VERSION);
    return;
  }

  // --help / -h or no command
  if (parsed.help || !parsed.command) {
    printHelp();
    return;
  }

  switch (parsed.command) {
    case 'init':
      await cmdInit(parsed);
      break;

    case 'status':
      cmdStatus();
      break;

    case 'uninstall':
      await cmdUninstall(parsed);
      break;

    default:
      log.error(`Unknown command: ${parsed.command}`);
      log.info('');
      log.info(`Run ${colors.bold(`npx ${PACKAGE_NAME} --help`)} to see available commands.`);
      process.exit(1);
  }
}

main().catch((err) => {
  log.error(err.message || String(err));
  process.exit(1);
});

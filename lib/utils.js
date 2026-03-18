'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PACKAGE_NAME = 'agent-pro-skills';

/**
 * Read the version string from the package's own package.json.
 * Wrapped in a function so the file is read lazily and only once.
 */
const VERSION = (() => {
  try {
    const pkgPath = path.join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return pkg.version;
  } catch {
    return '0.0.0';
  }
})();

/** Absolute path to the bundled skill-engineer template directory. */
const SKILL_ENGINEER_DIR = path.join(__dirname, '..', 'skills', 'skill-engineer');

/**
 * Content for the Claude Code slash-command file (.claude/commands/skill-engineer.md).
 * This thin wrapper tells Claude Code to load the full skill from the skills directory
 * so that `/skill-engineer` works as a custom command.
 */
const CLAUDE_COMMAND_CONTENT = [
  'Read and follow all instructions in `.claude/skills/skill-engineer/SKILL.md`.',
  '',
  'When the SKILL.md references files in `templates/`, `references/`, `scripts/`,',
  'or `examples/`, find them inside `.claude/skills/skill-engineer/`.',
  '',
  '$ARGUMENTS',
  '',
].join('\n');

// ---------------------------------------------------------------------------
// Platform helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when running on Windows.
 */
function isWindows() {
  return process.platform === 'win32';
}

/**
 * Recursively copy a directory from `src` to `dest`.
 * Works cross-platform using only built-in Node modules.
 */
function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Recursively remove a directory and all of its contents.
 * Uses fs.rmSync (Node >= 14.14) with force + recursive flags.
 */
function removeDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

/**
 * Check whether symbolic links are supported on the current platform.
 * On Windows symlinks require elevated privileges or Developer Mode,
 * so we perform a real test in a temp directory.
 */
function isSymlinkSupported() {
  // Non-Windows platforms universally support symlinks.
  if (!isWindows()) {
    return true;
  }

  const tmpDir = path.join(os.tmpdir(), `${PACKAGE_NAME}-symlink-test-${process.pid}`);
  const target = path.join(tmpDir, 'target');
  const link = path.join(tmpDir, 'link');

  try {
    fs.mkdirSync(tmpDir, { recursive: true });
    fs.mkdirSync(target, { recursive: true });
    fs.symlinkSync(target, link, 'junction');
    return true;
  } catch {
    return false;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup — ignore errors.
    }
  }
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/**
 * Expand a leading `~` or `~/` in `filepath` to the user's home directory.
 * Paths that do not start with `~` are returned unchanged.
 */
function expandHome(filepath) {
  if (!filepath) {
    return filepath;
  }

  if (filepath === '~') {
    return os.homedir();
  }

  if (filepath.startsWith('~/') || filepath.startsWith('~\\')) {
    return path.join(os.homedir(), filepath.slice(2));
  }

  return filepath;
}

/**
 * Recursively create a directory if it does not already exist.
 */
function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Check whether the process can write to the given directory.
 * Returns `true` if a temporary file can be created and removed.
 */
function isWritable(dirPath) {
  const probe = path.join(dirPath, `.${PACKAGE_NAME}-write-test-${process.pid}`);

  try {
    fs.writeFileSync(probe, '');
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns the project root — the current working directory.
 */
function getProjectRoot() {
  return process.cwd();
}

// ---------------------------------------------------------------------------
// Logging helpers (colored console output via ANSI escape codes)
// ---------------------------------------------------------------------------

const supportsColor = (() => {
  // Respect NO_COLOR (https://no-color.org/) and FORCE_COLOR conventions.
  if ('NO_COLOR' in process.env) return false;
  if ('FORCE_COLOR' in process.env) return true;

  // When stdout is not a TTY (e.g. piped), disable colour.
  if (!process.stdout.isTTY) return false;

  // Windows Terminal, modern ConEmu, and VS Code all support ANSI.
  if (isWindows()) {
    return Boolean(
      process.env.WT_SESSION ||       // Windows Terminal
      process.env.ConEmuANSI === 'ON' // ConEmu
    ) || Number(os.release().split('.')[0]) >= 10; // Win 10+
  }

  // Most Unix terminals support colour.
  return true;
})();

/**
 * Wrap `text` in an ANSI colour sequence if colours are supported.
 */
function colorize(code, text) {
  if (!supportsColor) return text;
  return `\x1b[${code}m${text}\x1b[0m`;
}

const colors = {
  green:  (t) => colorize('32', t),
  yellow: (t) => colorize('33', t),
  red:    (t) => colorize('31', t),
  cyan:   (t) => colorize('36', t),
  bold:   (t) => colorize('1', t),
  dim:    (t) => colorize('2', t),
};

const log = {
  /** Default informational message. */
  info(msg) {
    console.log(msg);
  },

  /** Success message — green check-mark prefix. */
  success(msg) {
    console.log(`${colors.green('\u2713')} ${msg}`);
  },

  /** Warning message — yellow warning-sign prefix. */
  warn(msg) {
    console.warn(`${colors.yellow('\u26A0')} ${msg}`);
  },

  /** Error message — red cross-mark prefix. */
  error(msg) {
    console.error(`${colors.red('\u2717')} ${msg}`);
  },

  /** Indented step — bullet point. */
  step(msg) {
    console.log(`  ${colors.dim('\u2022')} ${msg}`);
  },

  /** Styled header / banner. */
  header(title) {
    const line = '\u2500'.repeat(Math.max(title.length + 4, 40));
    console.log('');
    console.log(colors.cyan(line));
    console.log(colors.cyan(`  ${colors.bold(title)}`));
    console.log(colors.cyan(line));
    console.log('');
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

module.exports = {
  // Constants
  PACKAGE_NAME,
  VERSION,
  SKILL_ENGINEER_DIR,
  CLAUDE_COMMAND_CONTENT,

  // Platform helpers
  isWindows,
  copyDir,
  removeDir,
  isSymlinkSupported,

  // Path helpers
  expandHome,
  ensureDir,
  isWritable,
  getProjectRoot,

  // Logging
  log,
  colors,
};

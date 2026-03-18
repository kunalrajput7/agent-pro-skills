#!/bin/bash
set -euo pipefail

# =============================================================================
# install-skill.sh — Install a generated skill to all detected coding agents
# Usage: bash install-skill.sh <skill-folder-path> [--global]
# =============================================================================

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

info()  { printf "${GREEN}[INFO]${NC}  %s\n" "$1"; }
warn()  { printf "${YELLOW}[WARN]${NC}  %s\n" "$1"; }
error() { printf "${RED}[ERROR]${NC} %s\n" "$1"; }

# ---------------------------------------------------------------------------
# Argument parsing
# ---------------------------------------------------------------------------
if [[ $# -lt 1 ]]; then
  echo "Usage: bash install-skill.sh <skill-folder-path> [--global]"
  exit 1
fi

SKILL_DIR="$(cd "$1" && pwd)"
GLOBAL_INSTALL=false

shift
while [[ $# -gt 0 ]]; do
  case "$1" in
    --global) GLOBAL_INSTALL=true; shift ;;
    *)
      error "Unknown argument: $1"
      exit 1
      ;;
  esac
done

# ---------------------------------------------------------------------------
# Validate skill folder
# ---------------------------------------------------------------------------
SKILL_MD="$SKILL_DIR/SKILL.md"
if [[ ! -f "$SKILL_MD" ]]; then
  error "SKILL.md not found in '$SKILL_DIR'"
  exit 1
fi

# Extract skill name from frontmatter
SKILL_NAME="$(awk 'BEGIN{found=0} /^---$/{found++; next} found==1{print} found>=2{exit}' "$SKILL_MD" \
  | grep -E '^name:' | head -1 | sed 's/^name:[[:space:]]*//' | sed 's/^["'"'"']//' | sed 's/["'"'"']$//' | xargs)"

if [[ -z "$SKILL_NAME" ]]; then
  error "Could not extract 'name' field from SKILL.md frontmatter"
  exit 1
fi

info "Skill: ${SKILL_NAME}"
info "Source: ${SKILL_DIR}"
info "Scope:  $(if $GLOBAL_INSTALL; then echo 'global'; else echo 'project'; fi)"
echo ""

# ---------------------------------------------------------------------------
# Agent detection and installation
# ---------------------------------------------------------------------------
HOME_DIR="$HOME"
INSTALLED_COUNT=0
SKIPPED_COUNT=0

# Each entry: config_dir|agent_name|global_skills_path|project_skills_path
AGENTS=(
  "${HOME_DIR}/.claude|Claude Code|${HOME_DIR}/.claude/skills|.claude/skills"
  "${HOME_DIR}/.cursor|Cursor|${HOME_DIR}/.cursor/skills|.cursor/skills"
  "${HOME_DIR}/.github|GitHub Copilot|${HOME_DIR}/.github/skills|.github/skills"
  "${HOME_DIR}/.codex|Codex CLI|${HOME_DIR}/.codex/skills|.codex/skills"
  "${HOME_DIR}/.gemini/antigravity|Antigravity|${HOME_DIR}/.gemini/antigravity/skills|.gemini/antigravity/skills"
  "${HOME_DIR}/.windsurf|Windsurf|${HOME_DIR}/.windsurf/skills|.windsurf/skills"
  "${HOME_DIR}/.gemini|Gemini CLI|${HOME_DIR}/.gemini/skills|.gemini/skills"
)

install_to_agent() {
  local config_dir="$1"
  local agent_name="$2"
  local global_skills="$3"
  local project_skills="$4"

  # Check if agent config directory exists
  if [[ ! -d "$config_dir" ]]; then
    return 1
  fi

  # Determine target path based on scope
  local target_base
  if $GLOBAL_INSTALL; then
    target_base="$global_skills"
  else
    target_base="$project_skills"
  fi

  local target_dir="${target_base}/${SKILL_NAME}"

  # Create target directory
  mkdir -p "$target_dir"

  # Copy skill contents
  cp -r "$SKILL_DIR"/* "$target_dir/" 2>/dev/null || true
  # Also copy hidden files if any
  cp -r "$SKILL_DIR"/.[!.]* "$target_dir/" 2>/dev/null || true

  info "Installed to ${agent_name}: ${target_dir}"
  return 0
}

echo -e "${BOLD}Detecting installed agents...${NC}"
echo ""

for agent_entry in "${AGENTS[@]}"; do
  IFS='|' read -r config_dir agent_name global_path project_path <<< "$agent_entry"

  if install_to_agent "$config_dir" "$agent_name" "$global_path" "$project_path"; then
    INSTALLED_COUNT=$((INSTALLED_COUNT + 1))
  else
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
  fi
done

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo -e "${BOLD}=== Installation Summary ===${NC}"
echo "Skill:     ${SKILL_NAME}"
echo "Installed: ${INSTALLED_COUNT} agent(s)"
echo "Skipped:   ${SKIPPED_COUNT} agent(s) (not detected)"

if [[ $INSTALLED_COUNT -eq 0 ]]; then
  echo ""
  warn "No agents were detected. Checked for config directories:"
  for agent_entry in "${AGENTS[@]}"; do
    IFS='|' read -r config_dir agent_name _ _ <<< "$agent_entry"
    echo "  - ${agent_name}: ${config_dir}"
  done
  echo ""
  warn "Create the config directory for your agent first, or install manually."
  exit 1
fi

echo ""
info "Done. Skill '${SKILL_NAME}' is ready to use."

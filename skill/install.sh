#!/usr/bin/env bash
# Install the geethob skill into the user's Claude Code skill directory.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}/geethob"

if ! command -v geethob >/dev/null 2>&1; then
  echo "geethob binary not found on \$PATH." >&2
  echo "Install it first (see https://github.com/hemant1996/geethob#install), then re-run this script." >&2
  exit 1
fi

mkdir -p "$TARGET"
cp "$SCRIPT_DIR/SKILL.md" "$TARGET/SKILL.md"

echo "Installed geethob skill to $TARGET"
echo "Restart Claude Code (or reload skills) to pick it up."

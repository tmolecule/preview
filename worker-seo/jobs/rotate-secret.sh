#!/usr/bin/env bash
# Rotate a Worker secret on a scheduled trigger.
#
# Args:
#   $1  Worker project directory (where wrangler.toml lives)
#   $2  Secret name (e.g. DECK_PASSWORD)
# Env:
#   SECRET_VALUE  New value to set (required, set in launchd plist)
#
# Self-disables via a marker file at ~/scripts/logs/.rotate-<name>.completed
# so a recurring launchd schedule only rotates once.

set -euo pipefail

WORKER_DIR="${1:?Worker dir required}"
SECRET_NAME="${2:?Secret name required}"
SECRET_VALUE="${SECRET_VALUE:?SECRET_VALUE env var required}"

MARKER_DIR="$HOME/scripts/logs"
MARKER="$MARKER_DIR/.rotate-${SECRET_NAME}.completed"
mkdir -p "$MARKER_DIR"

if [ -f "$MARKER" ]; then
  echo "$(date): $SECRET_NAME already rotated on $(cat "$MARKER"); skipping"
  exit 0
fi

if [ ! -d "$WORKER_DIR" ]; then
  echo "$(date): worker dir not found: $WORKER_DIR" >&2
  exit 1
fi

echo "$(date): rotating $SECRET_NAME in $WORKER_DIR"
cd "$WORKER_DIR"
printf '%s' "$SECRET_VALUE" | npx wrangler secret put "$SECRET_NAME"
echo "$(date): rotation of $SECRET_NAME complete"
date -u +%Y-%m-%dT%H:%M:%SZ > "$MARKER"

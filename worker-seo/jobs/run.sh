#!/usr/bin/env bash
# Runner for jobs/*.md specs. Invoked by launchd.
# Self-disables after a successful run via a brand-prefixed marker file
# so the launchd recurrence doesn't re-fire in subsequent years and
# multi-brand jobs don't collide on a shared marker name.
#
# Usage (called by launchd):
#   ./run.sh llm-mentions-recheck
#
# The argument is the basename (without .md) of the job spec to execute.

set -euo pipefail

JOB_NAME="${1:-}"
if [ -z "$JOB_NAME" ]; then
  echo "Usage: $0 <job-name>" >&2
  exit 64
fi

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SPEC_PATH="$REPO_DIR/jobs/${JOB_NAME}.md"
BRAND="$(basename "$(dirname "$REPO_DIR")")"
MARKER_DIR="$HOME/scripts/logs"
MARKER="$MARKER_DIR/.${BRAND}-${JOB_NAME}.completed"
CLAUDE_BIN="${CLAUDE_BIN:-/Users/voicecalls/.local/bin/claude}"

# Load Resend credentials if available so Claude can email the report.
# File should contain: RESEND_API_KEY=re_...
if [ -f "$HOME/.env.resend" ]; then
  set -a
  # shellcheck disable=SC1091
  . "$HOME/.env.resend"
  set +a
fi

mkdir -p "$MARKER_DIR"

if [ ! -f "$SPEC_PATH" ]; then
  echo "$(date): job spec not found at $SPEC_PATH" >&2
  exit 1
fi

if [ -f "$MARKER" ]; then
  echo "$(date): job '$BRAND/$JOB_NAME' already completed on $(cat "$MARKER"); skipping"
  exit 0
fi

echo "$(date): starting job '$BRAND/$JOB_NAME' from $SPEC_PATH"

"$CLAUDE_BIN" -p "Open and execute the job specified in the file at $SPEC_PATH. The spec is self-contained — follow it. Use the local DataForSEO MCP (mcp__dataforseo__*) for the API queries. Write the final report to the path the spec specifies, update the brand MEMORY.md index file the spec specifies with a one-line pointer to the new report file, and then send the report by running the Bash command shown in the 'Send the report by email' section of the spec." \
  --allowedTools 'mcp__dataforseo__ai_opt_llm_ment_agg_metrics,Read,Write,Edit,Bash,Grep,Glob'

echo "$(date): job '$BRAND/$JOB_NAME' completed"
date -u +%Y-%m-%dT%H:%M:%SZ > "$MARKER"

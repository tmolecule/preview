#!/usr/bin/env bash
# Ask the worker to suggest internal links for a draft markdown file.
#
# Usage:
#   ADMIN_TOKEN=xxx WORKER_URL=... bash scripts/link-suggest.sh path/to/draft.md [--slug new-page-slug]
#
# Outputs a JSON envelope; falls back to a human-readable summary if --pretty is set.
set -euo pipefail

WORKER_URL="${WORKER_URL:?must set WORKER_URL}"
ADMIN_TOKEN="${ADMIN_TOKEN:?must set ADMIN_TOKEN}"

DRAFT_PATH="${1:?usage: link-suggest.sh <draft.md> [--slug slug] [--pretty]}"
shift || true

EXCLUDE_SLUG=""
PRETTY=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --slug) EXCLUDE_SLUG="$2"; shift 2 ;;
    --pretty) PRETTY=1; shift ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

[[ -f "$DRAFT_PATH" ]] || { echo "draft not found: $DRAFT_PATH" >&2; exit 2; }

draft=$(cat "$DRAFT_PATH")
payload=$(jq -n --arg draft "$draft" --arg exclude_slug "$EXCLUDE_SLUG" \
  '{draft: $draft, exclude_slug: (if $exclude_slug == "" then null else $exclude_slug end)}')

resp=$(curl -sS -X POST "$WORKER_URL/api/link-suggest" \
  -H "authorization: Bearer $ADMIN_TOKEN" \
  -H "content-type: application/json" \
  -d "$payload")

if [[ "$PRETTY" == "1" ]]; then
  echo "$resp" | jq -r '
    "draft chars: \(.draft_chars)\n" +
    "suggestions: \(.total_suggestions) (min required \(.min_required); meets=\(.meets_min_inbound))\n\n" +
    (.suggestions | map(
      "→ " + .target_url + "\n" +
      "  anchor: \"" + .suggested_anchor + "\"  (score " + (.score | tostring) + ")\n" +
      "  source: " + (.source_paragraph[0:120] | gsub("\n"; " ")) + (if (.source_paragraph | length) > 120 then "…" else "" end) + "\n"
    ) | join("\n"))
  '
else
  echo "$resp" | jq .
fi

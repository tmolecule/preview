#!/usr/bin/env bash
# Bulk-upload all JSON files in seed/ to the LEARN_PAGES KV namespace.
# Filename (sans .json) becomes the slug. JSON content is the value.
#
# Usage:
#   ./scripts/seed-kv.sh              # writes to production KV
#   ./scripts/seed-kv.sh --preview    # writes to preview KV (for `wrangler dev`)

set -euo pipefail

if [ "${1:-}" = "--preview" ]; then
  PREVIEW_FLAG="--preview"
  echo "Seeding PREVIEW KV namespace"
else
  PREVIEW_FLAG="--preview false"
  echo "Seeding PRODUCTION KV namespace"
fi

cd "$(dirname "$0")/.."

count=0
for f in seed/*.json; do
  [ -f "$f" ] || continue
  slug="$(basename "$f" .json)"
  echo "  -> $slug"
  npx wrangler kv key put --binding=LEARN_PAGES $PREVIEW_FLAG "$slug" --path="$f"
  count=$((count + 1))
done

echo "Seeded $count pages."
echo "Verify with: npx wrangler kv key list --binding=LEARN_PAGES $PREVIEW_FLAG"

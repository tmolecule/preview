#!/usr/bin/env bash
# Bulk-upload all JSON files in seed/ to the LEARN_PAGES KV namespace.
# Filename (sans .json) becomes the slug. JSON content is the value.
#
# Usage:
#   ./scripts/seed-kv.sh              # writes to production KV
#   ./scripts/seed-kv.sh --preview    # writes to preview KV (for `wrangler dev`)

set -euo pipefail

# wrangler 4.x: `kv key put` writes to LOCAL Miniflare unless --remote is passed,
# and LEARN_PAGES has both a prod + preview id so --preview must be specified too.
#   production -> --remote --preview false   (real remote prod namespace)
#   preview    -> --preview                  (local preview store, for `wrangler dev`)
if [ "${1:-}" = "--preview" ]; then
  KV_FLAGS="--preview"
  echo "Seeding PREVIEW KV namespace (local, for wrangler dev)"
else
  KV_FLAGS="--remote --preview false"
  echo "Seeding PRODUCTION KV namespace (remote)"
fi

cd "$(dirname "$0")/.."

count=0
for f in seed/*.json; do
  [ -f "$f" ] || continue
  slug="$(basename "$f" .json)"
  echo "  -> $slug"
  npx wrangler kv key put --binding=LEARN_PAGES $KV_FLAGS "$slug" --path="$f"
  count=$((count + 1))
done

echo "Seeded $count pages."
echo "Verify with: npx wrangler kv key list --binding=LEARN_PAGES $KV_FLAGS"

#!/usr/bin/env bash
# Re-index all learn.tmolecule.com seed JSONs into Vectorize via the deployed worker.
#
# Usage:
#   ADMIN_TOKEN=xxx WORKER_URL=https://tmolecule-learn-intel.<subdomain>.workers.dev \
#     bash scripts/index-now.sh [--only path1.json,path2.json]
#
# Defaults to all seed JSONs in ~/tmolecule/worker-seo/seed/.
set -euo pipefail

SEED_DIR="${SEED_DIR:-$HOME/tmolecule/worker-seo/seed}"
WORKER_URL="${WORKER_URL:?must set WORKER_URL}"
ADMIN_TOKEN="${ADMIN_TOKEN:?must set ADMIN_TOKEN}"

ONLY_LIST=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --only) ONLY_LIST="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

FILES=()
if [[ -n "$ONLY_LIST" ]]; then
  IFS=',' read -ra FILES <<< "$ONLY_LIST"
else
  while IFS= read -r line; do FILES+=("$line"); done < <(find "$SEED_DIR" -maxdepth 1 -name '*.json' -not -name '_*' | sort)
fi

ok=0; fail=0; skipped=0
for f in "${FILES[@]}"; do
  base=$(basename "$f" .json)
  if ! jq -e '.body_html' "$f" >/dev/null 2>&1; then
    echo "skip (no body_html): $base"
    skipped=$((skipped+1))
    continue
  fi
  payload=$(jq --arg slug "$base" '. + {slug: $slug}' "$f")
  resp=$(curl -sS --max-time 120 --retry 4 --retry-delay 5 --retry-all-errors -X POST "$WORKER_URL/admin/index-page" \
    -H "authorization: Bearer $ADMIN_TOKEN" \
    -H "content-type: application/json" \
    -d "$payload" \
    -w "\n__HTTP__%{http_code}")
  code=$(echo "$resp" | sed -n 's/^__HTTP__//p')
  body=$(echo "$resp" | sed '$d')
  if [[ "$code" == "200" ]]; then
    chunks=$(echo "$body" | jq -r '.chunks')
    echo "ok    $base  ($chunks chunks)"
    ok=$((ok+1))
  else
    echo "FAIL  $base  http=$code  body=$body" >&2
    fail=$((fail+1))
  fi
  sleep 2
done

echo
echo "indexed=$ok  failed=$fail  skipped=$skipped"
exit $(( fail > 0 ? 1 : 0 ))

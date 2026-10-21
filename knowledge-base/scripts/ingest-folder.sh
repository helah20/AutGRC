#!/usr/bin/env bash
# Uploads every supported file in a folder (default: ./documents) to the
# knowledge base through the ingest form.
#   ./scripts/ingest-folder.sh [folder]
set -euo pipefail

dir="${1:-$(dirname "$0")/../documents}"
url="${KB_FORM_URL:-http://127.0.0.1:5678/form/kb-upload}"

shopt -s nullglob nocaseglob
count=0
for f in "$dir"/*.{pdf,docx,txt,md,csv,json}; do
  printf '→ %s ... ' "$(basename "$f")"
  if curl -sf -o /dev/null -F "field-0=@${f}" "$url"; then
    echo ok; count=$((count + 1))
  else
    echo FAILED
  fi
done
echo "Uploaded $count file(s)."

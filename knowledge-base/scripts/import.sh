#!/bin/sh
# Runs inside the n8n-import container: imports the two credentials and the
# two workflows, substituting the models and collection chosen in .env.
set -eu

work=/tmp/kb-import
rm -rf "$work" && mkdir -p "$work/workflows"

sed "s|__OLLAMA_URL__|${OLLAMA_URL}|" /import/credentials/credentials.template.json \
  > "$work/credentials.json"

for f in /import/workflows/*.json; do
  sed -e "s|\"qwen2.5:7b\"|\"${CHAT_MODEL}\"|g" \
      -e "s|\"bge-m3\"|\"${EMBEDDING_MODEL}\"|g" \
      -e "s|\"value\": \"knowledge_base\"|\"value\": \"${QDRANT_COLLECTION}\"|g" \
      "$f" > "$work/workflows/$(basename "$f")"
done

n8n import:credentials --input="$work/credentials.json"
n8n import:workflow --separate --input="$work/workflows"
# Imported workflows arrive inactive; publish them so the form and chat URLs work.
n8n publish:workflow --id=kbIngestDocs0001 2>/dev/null \
  || n8n update:workflow --id=kbIngestDocs0001 --active=true
n8n publish:workflow --id=kbChatAgent00001 2>/dev/null \
  || n8n update:workflow --id=kbChatAgent00001 --active=true

chown -R node:node /home/node/.n8n
rm -rf "$work"
echo "knowledge-base: credentials and workflows imported"

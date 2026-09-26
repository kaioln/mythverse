#!/bin/sh
cd "$(dirname "$0")"
if command -v node >/dev/null 2>&1; then
  (sleep 1; open "http://localhost:8080/") &
  node server/index.js
else
  echo "Node.js nao encontrado: abrindo no modo offline (sem contas)."
  open index.html
fi

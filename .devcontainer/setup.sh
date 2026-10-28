#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
python3 -c 'import sys; assert sys.version_info >= (3, 12), "Banyra requires Python 3.12+"'
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) throw new Error("Banyra requires Node.js 22+")'

if [ ! -x .venv/bin/python ]; then
  python3 -m venv .venv
fi
.venv/bin/python -m pip install -e './backend[server,dev]'
npm --prefix frontend ci --no-audit --no-fund
npm --prefix frontend run build

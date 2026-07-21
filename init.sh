#!/usr/bin/env bash
set -euo pipefail

required_node_major="24"
if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: Node.js 24 is required, but node was not found." >&2
  exit 1
fi
current_node_version="$(node -p 'process.versions.node')"
current_node_major="${current_node_version%%.*}"
if [ "$current_node_major" != "$required_node_major" ]; then
  echo "ERROR: Node.js 24.x is required; current version is ${current_node_version}." >&2
  exit 1
fi

echo "=== MD-Convertor Verification ==="

required_files=(
  "AGENTS.md"
  "PROGRESS.md"
  "CHANGELOG.md"
  "feature_list.json"
  "session-handoff.md"
  "package.json"
  "package-lock.json"
  "docs/PRODUCT.md"
  "docs/ARCHITECTURE.md"
  "docs/TESTING.md"
  "docs/QUALITY-AUDIT.md"
)

for file in "${required_files[@]}"; do
  test -f "$file"
  echo "OK: $file"
done

node -e 'const fs = require("node:fs"); const data = JSON.parse(fs.readFileSync("feature_list.json", "utf8")); if (!Array.isArray(data.features) || data.features.length === 0) throw new Error("feature_list.json must contain features"); const ids = new Set(data.features.map((feature) => feature.id)); const active = data.features.filter((feature) => feature.status === "in-progress"); if (active.length > 1) throw new Error("Only one feature may be in progress"); for (const feature of data.features) { if (!feature.id || !feature.name || !feature.status || !Array.isArray(feature.dependencies)) throw new Error(`Invalid feature: ${feature.id || "unknown"}`); for (const dependency of feature.dependencies) if (!ids.has(dependency)) throw new Error(`Unknown dependency: ${dependency}`); }'

if [ ! -d node_modules ]; then
  npm ci
fi

npm run lint
npm run typecheck
npm run test:coverage
npm run build

echo "=== Verification Complete ==="
echo "Run 'npm run test:e2e' separately after Playwright browsers are installed."
echo "Run 'npm run test:live' only as the network-dependent release gate."

#!/usr/bin/env bash
#
# Builds the Chrome Web Store upload: dist/shorts-blocker-<version>.zip
# Usage: scripts/package.sh

set -euo pipefail

# Work from the project root, wherever the script is called from.
cd "$(dirname "$0")/.."

echo "Running tests..."
if ! node --test; then
  echo "Tests failed. No package was built." >&2
  exit 1
fi

version=$(node -p "require('./manifest.json').version")
zip_path="dist/shorts-blocker-${version}.zip"

# Every icon PNG the manifest points to, from both "icons" and "action.default_icon".
icon_files=$(node -p "
  const manifest = require('./manifest.json');
  const icons = { ...manifest.icons, ...manifest.action.default_icon };
  [...new Set(Object.values(icons))].join('\n');
")

echo "Building ${zip_path}..."
mkdir -p dist
rm -f "$zip_path"

# -X leaves out macOS extra file attributes. The -x patterns leave out dot files
# such as .DS_Store. Paths are relative, so manifest.json lands at the zip root.
zip -r -X "$zip_path" manifest.json src popup $icon_files -x '.*' '*/.*'

echo
echo "Zip contents:"
unzip -l "$zip_path"

# Unzip to a temporary folder and check that every file the manifest names is there.
check_dir=$(mktemp -d)
trap 'rm -rf "$check_dir"' EXIT
unzip -q "$zip_path" -d "$check_dir"

referenced_files=$(node -p "
  const manifest = require('./manifest.json');
  const files = [
    manifest.background.service_worker,
    manifest.action.default_popup,
    ...Object.values(manifest.action.default_icon),
    ...Object.values(manifest.icons),
    ...manifest.content_scripts.flatMap((script) => [...(script.js || []), ...(script.css || [])]),
    ...manifest.web_accessible_resources.flatMap((entry) => entry.resources),
  ];
  [...new Set(files)].join('\n');
")

missing=0
for file in $referenced_files; do
  if [ -f "$check_dir/$file" ]; then
    echo "  ok       $file"
  else
    echo "  MISSING  $file" >&2
    missing=1
  fi
done

if [ "$missing" -ne 0 ]; then
  echo "The zip is missing files the manifest needs." >&2
  exit 1
fi

echo
echo "Done: ${zip_path}"

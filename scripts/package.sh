#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
./scripts/check.sh
./scripts/build-app.sh
mkdir -p release
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
BUNDLE="$TMP/ragnarok-timeline"
mkdir -p "$BUNDLE"
# Explicit allowlist: no live logs, settings, .git, build caches, or private source trees.
for item in Package.swift README.md PRIVACY.md .gitignore .github install.sh uninstall.sh Sources Tests hooks scripts docs; do
  cp -R "$item" "$BUNDLE/"
done
mkdir -p "$BUNDLE/dist"
/usr/bin/ditto "dist/Ragnarok Timeline.app" "$BUNDLE/dist/Ragnarok Timeline.app"
(cd "$TMP" && /usr/bin/zip -qr "$OLDPWD/release/ragnarok-timeline-macos.zip" ragnarok-timeline)
/usr/bin/shasum -a 256 release/ragnarok-timeline-macos.zip > release/ragnarok-timeline-macos.zip.sha256
echo 'Release ZIP and SHA-256 written to release/'

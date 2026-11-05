#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ "$(uname -s)" != Darwin ]]; then echo 'This app requires macOS 14 or later.' >&2; exit 1; fi
NODE=$(command -v node || true)
if [[ -z "$NODE" ]]; then echo 'Node.js 20 or later is required for the hooks and installer. No configuration changed.' >&2; exit 1; fi
"$NODE" -e 'if(Number(process.versions.node.split(".")[0])<20)process.exit(1)' || { echo 'Node.js 20 or later required.' >&2; exit 1; }
APP="$PWD/dist/Ragnarok Timeline.app"
if [[ ! -d "$APP" ]]; then
  echo 'Building from source. Apple command-line developer tools are required.'
  ./scripts/build-app.sh
fi
codesign --verify --strict "$APP"
"$NODE" scripts/hooks.mjs install "$@"
mkdir -p "$HOME/Applications"
DEST="$HOME/Applications/Ragnarok Timeline.app"
if [[ -e "$DEST" ]]; then mv "$DEST" "$HOME/Applications/Ragnarok Timeline.previous.$(date +%Y%m%d-%H%M%S).app"; fi
/usr/bin/ditto "$APP" "$DEST"
echo 'Installed. Restart your selected agents. Review new hooks if the agent asks; the installer does not approve them.'
open "$DEST"

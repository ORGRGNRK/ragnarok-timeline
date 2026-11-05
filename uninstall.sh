#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
node scripts/hooks.mjs uninstall
echo 'The app remains in ~/Applications/Ragnarok Timeline.app; close it and move it to Trash if no longer wanted.'
echo 'Local events and configuration backups are retained under ~/Library/Application Support/Ragnarok Timeline and next to the agent configs.'

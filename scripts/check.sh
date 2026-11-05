#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --test hooks/*.test.mjs hooks/test/*.test.mjs
swift test

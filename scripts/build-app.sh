#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Universal app for Apple silicon and Intel Macs. No downloaded Swift packages.
swift build -c release --arch arm64 --arch x86_64
BIN_DIR=$(swift build -c release --arch arm64 --arch x86_64 --show-bin-path)
APP="$PWD/dist/Ragnarok Timeline.app"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN_DIR/RagnarokTimeline" "$APP/Contents/MacOS/RagnarokTimeline"
cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleName</key><string>Ragnarok Timeline</string>
<key>CFBundleDisplayName</key><string>Ragnarok Timeline</string>
<key>CFBundleIdentifier</key><string>co.rgnrk.timeline</string>
<key>CFBundleExecutable</key><string>RagnarokTimeline</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>CFBundleShortVersionString</key><string>0.1.0</string>
<key>CFBundleVersion</key><string>1</string>
<key>LSMinimumSystemVersion</key><string>14.0</string>
<key>NSHighResolutionCapable</key><true/>
</dict></plist>
PLIST
(git rev-parse --short HEAD 2>/dev/null || echo development) > "$APP/Contents/Resources/commit"
codesign --force --sign - "$APP"
codesign --verify --strict "$APP"
lipo -archs "$APP/Contents/MacOS/RagnarokTimeline"
echo "Built: $APP"

#!/usr/bin/env bash
# Builds the AlreaDough desktop pet (a small native Mac app) and installs it.
# Usage: bash desktop-pet/build.sh            installs to ~/Applications/AlreaDough Pet.app
#        bash desktop-pet/build.sh /some/path.app
# Needs only the Xcode command line tools (swiftc); no Node, no extra downloads.
set -euo pipefail
cd "$(dirname "$0")"

APP="${1:-$HOME/Applications/AlreaDough Pet.app}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

pkill -f "AlreaDoughPet" 2>/dev/null || true
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"

echo "编译..."
swiftc -O -o "$APP/Contents/MacOS/AlreaDoughPet" main.swift

# the dough holding the heart butter; 900px wide is plenty for a desktop pet and keeps the app small
sips -Z 900 ../public/mascot/already-dough-fold-v3.png --out "$APP/Contents/Resources/dough.png" >/dev/null

echo "生成图标..."
ICONSET="$WORK/AppIcon.iconset"
mkdir -p "$ICONSET"
SRC="../public/brand/already-dough-mark.png"   # the square dough mark
for size in 16 32 128 256 512; do
  sips -z $size $size "$SRC" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  sips -z $((size * 2)) $((size * 2)) "$SRC" --out "$ICONSET/icon_${size}x${size}@2x.png" >/dev/null
done
iconutil -c icns "$ICONSET" -o "$APP/Contents/Resources/AppIcon.icns"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>AlreaDough Pet</string>
  <key>CFBundleDisplayName</key><string>AlreaDough 桌宠</string>
  <key>CFBundleIdentifier</key><string>ai.alreadough.pet</string>
  <key>CFBundleExecutable</key><string>AlreaDoughPet</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleShortVersionString</key><string>1.0</string>
  <key>CFBundleVersion</key><string>1</string>
  <key>LSMinimumSystemVersion</key><string>12.0</string>
  <key>LSUIElement</key><true/>
  <key>NSHighResolutionCapable</key><true/>
</dict>
</plist>
PLIST

codesign --force --sign - "$APP" >/dev/null 2>&1 || echo "(没有签名也能在本机运行)"
echo "已安装：$APP"

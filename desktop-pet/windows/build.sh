#!/usr/bin/env bash
# Builds the Windows desktop pet on this Mac and writes public/downloads/AlreaDough-Pet-windows.zip.
#
#   bash desktop-pet/windows/build.sh
#
# Needs the .NET SDK (8 or newer), once: https://dotnet.microsoft.com/download  (or set DOTNET=/path/to/dotnet).
# The pet itself targets .NET Framework 4.7.2, which Windows 10/11 already have, so people who download it install
# nothing. After a new build, set WINDOWS_PET_READY = true in app/components/DesktopPetPanel.tsx.
set -euo pipefail
cd "$(dirname "$0")"

DOTNET="${DOTNET:-$(command -v dotnet || echo "$HOME/.dotnet/dotnet")}"
if [ ! -x "$DOTNET" ]; then
  echo "没有找到 .NET SDK。先安装：https://dotnet.microsoft.com/download （或者 DOTNET=/路径/dotnet bash build.sh）"
  exit 1
fi

mkdir -p build
echo "准备图片..."
# the dough holding the heart butter; 900px wide is plenty for a desktop pet and keeps the app small
sips -Z 900 ../../public/mascot/already-dough-fold-v3.png --out build/dough.png >/dev/null
sips -z 64 64 ../../public/brand/already-dough-mark.png --out build/mark.png >/dev/null

echo "生成图标..."
for size in 16 24 32 48 64 128 256; do
  sips -z $size $size ../../public/brand/already-dough-mark.png --out "build/icon-$size.png" >/dev/null
done
# an .ico is a small header plus PNG images (Windows Vista and later read PNG inside .ico)
python3 - <<'PY'
import struct
sizes = [16, 24, 32, 48, 64, 128, 256]
images = [open(f"build/icon-{s}.png", "rb").read() for s in sizes]
offset = 6 + 16 * len(sizes)
header = struct.pack("<HHH", 0, 1, len(sizes))
entries = b""
for size, data in zip(sizes, images):
    entries += struct.pack("<BBBBHHII", size % 256, size % 256, 0, 0, 1, 32, len(data), offset)
    offset += len(data)
open("build/AppIcon.ico", "wb").write(header + entries + b"".join(images))
PY

echo "编译..."
"$DOTNET" build AlreaDoughPet.csproj -c Release -o build/out -nologo -v quiet

echo "打包..."
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/AlreaDough Pet"
cp build/out/AlreaDoughPet.exe "$STAGE/AlreaDough Pet/AlreaDough Pet.exe"
if [ -f build/out/AlreaDoughPet.exe.config ]; then cp build/out/AlreaDoughPet.exe.config "$STAGE/AlreaDough Pet/AlreaDough Pet.exe.config"; fi
# Notepad shows Chinese correctly when the file starts with a UTF-8 byte order mark
printf '\xEF\xBB\xBF' > "$STAGE/AlreaDough Pet/使用说明.txt"
cat README.txt >> "$STAGE/AlreaDough Pet/使用说明.txt"
mkdir -p ../../public/downloads
rm -f ../../public/downloads/AlreaDough-Pet-windows.zip
# Python marks the names as UTF-8 inside the zip (macOS zip does not), so Windows shows 使用说明.txt, not gibberish
python3 - "$STAGE" ../../public/downloads/AlreaDough-Pet-windows.zip <<'PY'
import os, sys, zipfile
stage, target = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for folder, _, files in os.walk(stage):
        for name in sorted(files):
            path = os.path.join(folder, name)
            archive.write(path, os.path.relpath(path, stage))
PY
ls -lh ../../public/downloads/AlreaDough-Pet-windows.zip
echo "下载包：public/downloads/AlreaDough-Pet-windows.zip"

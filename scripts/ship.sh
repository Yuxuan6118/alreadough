#!/usr/bin/env bash
# One command to check, build, commit and deploy AlreaDough.
# Usage: bash scripts/ship.sh "what you changed"
# It stops at the first failure, so a broken build never goes live.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.local/node/bin:$PATH"

message="${1:-update}"

echo "1/4 检查代码有没有改坏..."
node --test tests/rendered-html.test.mjs

echo "2/4 构建..."
rm -f dist/server/wrangler.json
node_modules/.bin/vinext build
if [ ! -f dist/server/wrangler.json ]; then
  echo "构建没有成功，已停止，没有上线。"
  exit 1
fi

echo "3/4 提交到 git（只提交已有文件的改动和 app、lib、tests、scripts 里的新文件）..."
git add -u
git add app lib tests scripts
if git diff --cached --quiet; then
  echo "没有新的改动需要提交，继续上线当前版本。"
else
  git commit -q -m "$message"
fi

echo "4/4 上线..."
node_modules/.bin/wrangler deploy

status=$(curl -s -o /dev/null -w "%{http_code}" https://alreadough.com/ || true)
echo "alreadough.com 返回：$status（200 表示网站能正常打开）"

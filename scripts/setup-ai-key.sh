#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="$PROJECT_DIR/.env.local"

printf 'OpenAI API key（输入时不会显示）：'
IFS= read -r -s OPENAI_SECRET
printf '\n'

if [[ "$OPENAI_SECRET" != sk-* ]]; then
  printf '这不像有效的 OpenAI API key；没有保存任何内容。\n'
  exit 1
fi

umask 077
printf 'OPENAI_API_KEY=%s\nOPENAI_CHAT_MODEL=gpt-5.6-luna\nOPENAI_CREATIVE_MODEL=gpt-5.6-terra\n' "$OPENAI_SECRET" > "$ENV_FILE"
unset OPENAI_SECRET
chmod 600 "$ENV_FILE"
printf 'AI 密钥已安全保存在本机，并已被版本控制忽略。请重新启动本地预览。\n'

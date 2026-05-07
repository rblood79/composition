#!/bin/bash
# PostToolUse Hook: 파일 수정 후 자동 포매팅
# Edit/Write 완료 후 prettier 실행

set -euo pipefail

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# 포매팅 대상 확장자만 처리
if echo "$FILE_PATH" | grep -qE '\.(ts|tsx|js|jsx|css|json|md)$'; then
  cd "${CLAUDE_PROJECT_DIR:-.}"
  PRETTIER="${CLAUDE_PROJECT_DIR:-.}/node_modules/.bin/prettier"
  if [ -x "$PRETTIER" ]; then
    "$PRETTIER" --write "$FILE_PATH" 2>/dev/null || true
  else
    npx prettier --write "$FILE_PATH" 2>/dev/null || true
  fi
fi

exit 0

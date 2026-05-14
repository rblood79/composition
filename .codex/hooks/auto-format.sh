#!/bin/bash
# PostToolUse Hook: 파일 수정 후 자동 포매팅
# Edit/Write 완료 후 prettier 실행

set -euo pipefail

INPUT=$(cat)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/dev/null
. "$SCRIPT_DIR/codex-hook-utils.sh"

PROJECT_DIR=$(codex_hook_project_dir "$INPUT")
FILE_PATHS=$(codex_hook_tool_paths "$INPUT")

if [ -z "$FILE_PATHS" ]; then
  exit 0
fi

cd "$PROJECT_DIR"
PRETTIER="$PROJECT_DIR/node_modules/.bin/prettier"

while IFS= read -r FILE_PATH; do
  [ -z "$FILE_PATH" ] && continue
  if echo "$FILE_PATH" | grep -qE '\.(ts|tsx|js|jsx|css|json|md)$' && [ -f "$FILE_PATH" ]; then
    if [ -x "$PRETTIER" ]; then
      "$PRETTIER" --write "$FILE_PATH" 2>/dev/null || true
    else
      npx prettier --write "$FILE_PATH" 2>/dev/null || true
    fi
  fi
done <<< "$FILE_PATHS"

exit 0

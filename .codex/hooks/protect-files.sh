#!/bin/bash
# PreToolUse Hook: 보호 파일 수정 차단
# 2.1.x JSON 응답 형식: {"hookSpecificOutput":{...,"permissionDecision":"deny"}}
# 목록 · 판정은 scripts/protected-paths.sh (Claude hook · preflight guard 와 같은 정본).
set -euo pipefail

INPUT=$(cat)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/dev/null
. "$SCRIPT_DIR/codex-hook-utils.sh"
# shellcheck source=/dev/null
. "$SCRIPT_DIR/../../scripts/protected-paths.sh"

FILE_PATHS=$(codex_hook_tool_paths "$INPUT")
if [ -z "$FILE_PATHS" ]; then
  exit 0
fi

while IFS= read -r FILE_PATH; do
  [ -z "$FILE_PATH" ] && continue
  WHY=$(protected_path_reason "$FILE_PATH") || continue
  REASON="보호 파일 수정 차단: $FILE_PATH — $WHY
이 파일은 보안/설정 파일이므로 직접 수정이 금지됩니다. 사용자에게 확인을 요청하세요."

  if command -v jq >/dev/null 2>&1; then
    jq -n --arg r "$REASON" '{
      decision: "block",
      reason: $r,
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: $r
      }
    }'
    exit 0
  fi
  echo "$REASON" >&2
  exit 2
done <<< "$FILE_PATHS"

exit 0

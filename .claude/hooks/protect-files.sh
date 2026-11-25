#!/bin/bash
# PreToolUse Hook: 보호 파일 수정 차단
# 2.1.x JSON 응답 형식: {"hookSpecificOutput":{...,"permissionDecision":"deny"}}
# 목록 · 판정은 scripts/protected-paths.sh (Codex hook · preflight guard 와 같은 정본).
set -euo pipefail

# CLAUDE_PROJECT_DIR 이 아니라 스크립트 위치로 찾는다 — selftest 는 임시 project dir 로 돌린다.
# shellcheck source=/dev/null
. "$(cd "$(dirname "$0")/../.." && pwd)/scripts/protected-paths.sh"

INPUT=$(cat)

FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

if ! WHY=$(protected_path_reason "$FILE_PATH"); then
  exit 0
fi

REASON="보호 파일 수정 차단: $FILE_PATH — $WHY
이 파일은 보안/설정 파일이므로 직접 수정이 금지됩니다. 사용자에게 확인을 요청하세요."

if command -v jq >/dev/null 2>&1; then
  jq -n --arg r "$REASON" '{
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

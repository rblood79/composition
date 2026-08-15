#!/bin/bash
# PreToolUse Hook: 보호 파일 수정 차단
# 2.1.x JSON 응답 형식: {"hookSpecificOutput":{...,"permissionDecision":"deny"}}
set -euo pipefail

INPUT=$(cat)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/dev/null
. "$SCRIPT_DIR/codex-hook-utils.sh"

FILE_PATHS=$(codex_hook_tool_paths "$INPUT")
if [ -z "$FILE_PATHS" ]; then
  exit 0
fi

PROTECTED_PATTERNS=(
  ".env"
  ".env.local"
  ".env.production"
  "credentials"
  "secret"
  #".claude/settings.json"
  #".claude/settings.local.json"
  #".claude/hooks/"
  #".claude/rules/"
  #".claude/agents/"
  #".codex/config.toml"
  #".codex/hooks/"
  #".codex/agents/"
  #"CLAUDE.md"
  #"CLAUDE.local.md"
  #"AGENTS.md"
  #"supabase/config.toml"
)

while IFS= read -r FILE_PATH; do
  [ -z "$FILE_PATH" ] && continue
  for PATTERN in "${PROTECTED_PATTERNS[@]}"; do
    if echo "$FILE_PATH" | grep -qi "$PATTERN"; then
      REASON="보호 파일 수정 차단: $FILE_PATH
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
      else
        echo "$REASON" >&2
        exit 2
      fi
    fi
  done
done <<< "$FILE_PATHS"

exit 0

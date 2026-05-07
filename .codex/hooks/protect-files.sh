#!/bin/bash
# PreToolUse Hook: 보호 파일 수정 차단
# 2.1.x JSON 응답 형식: {"hookSpecificOutput":{...,"permissionDecision":"deny"}}
set -euo pipefail

INPUT=$(cat)

# tool_input에서 file_path 추출
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null || echo "")
if [ -z "$FILE_PATH" ]; then
  exit 0
fi

PROTECTED_PATTERNS=(
  ".env"
  ".env.local"
  ".env.production"
  "credentials"
  "secret"
  ".claude/settings.json"
  ".claude/settings.local.json"
  ".claude/hooks/"
  ".claude/rules/"
  ".claude/agents/"
  "CLAUDE.md"
  "CLAUDE.local.md"
  "AGENTS.md"
  "supabase/config.toml"
)

for PATTERN in "${PROTECTED_PATTERNS[@]}"; do
  if echo "$FILE_PATH" | grep -qi "$PATTERN"; then
    REASON="보호 파일 수정 차단: $FILE_PATH
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
    else
      # fallback
      echo "$REASON" >&2
      exit 2
    fi
  fi
done

exit 0

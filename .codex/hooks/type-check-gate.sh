#!/bin/bash
# Stop Hook: Type Check Gate
# agent가 응답 완료 시 자동으로 pnpm type-check 실행
# 2.1.x JSON 응답 형식: {"decision":"block","reason":"..."} 사용 (exit 0 with JSON)
#
# 사전 단계: spec-rebuild-flag.sh 가 생성한 .claude/.spec-rebuild-pending flag 확인 →
#   있으면 pnpm build:specs 1회 실행 후 flag 삭제. 다중 편집 debounce.
set -euo pipefail

INPUT=$(cat)

# 재진입 방지
STOP_HOOK_ACTIVE="${STOP_HOOK_ACTIVE:-false}"
if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Spec rebuild gate: flag 존재 시 build:specs 1회 실행
SPEC_FLAG="${CLAUDE_PROJECT_DIR:-.}/.claude/.spec-rebuild-pending"
if [ -f "$SPEC_FLAG" ]; then
  if ! BUILD_OUTPUT=$(pnpm build:specs 2>&1); then
    REASON_TEXT="build:specs 실패. spec 빌드 에러를 수정하세요:

$(echo "$BUILD_OUTPUT" | tail -30)"
    if command -v jq >/dev/null 2>&1; then
      jq -n --arg r "$REASON_TEXT" '{decision: "block", reason: $r}'
    else
      echo "$REASON_TEXT" >&2
      exit 2
    fi
    exit 0
  fi
  rm -f "$SPEC_FLAG"
fi

# .ts/.tsx 변경 감지
CHANGED_TS=$(git diff --name-only HEAD 2>/dev/null | grep -E '\.(ts|tsx)$' || true)
if [ -z "$CHANGED_TS" ]; then
  exit 0
fi

# type-check 실행
export STOP_HOOK_ACTIVE=true
if ! TYPE_CHECK_OUTPUT=$(pnpm type-check 2>&1); then
  REASON_TEXT="type-check 실패. 아래 에러를 수정하세요:

$(echo "$TYPE_CHECK_OUTPUT" | tail -30)"

  if command -v jq >/dev/null 2>&1; then
    jq -n --arg r "$REASON_TEXT" '{decision: "block", reason: $r}'
  else
    echo "$REASON_TEXT" >&2
    exit 2
  fi
  exit 0
fi

exit 0

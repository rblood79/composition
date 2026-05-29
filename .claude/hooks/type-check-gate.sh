#!/bin/bash
# Stop Hook: Type Check Gate (asyncRewake 모드)
# agent가 응답 완료 시 백그라운드로 pnpm type-check 실행.
# settings.json 에서 asyncRewake:true 로 등록됨 → exit 2 시 모델 재호출(논블로킹).
# 성공(exit 0)이면 사용자 흐름을 막지 않음. stdout 이 재호출 system-reminder 로 전달됨.
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
    # asyncRewake: exit 2 로 모델 재호출 (stdout 이 system-reminder 로 전달)
    echo "build:specs 실패. spec 빌드 에러를 수정하세요:

$(echo "$BUILD_OUTPUT" | tail -30)"
    exit 2
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
  # asyncRewake: exit 2 로 모델 재호출 (stdout 이 system-reminder 로 전달)
  echo "type-check 실패. 아래 에러를 수정하세요:

$(echo "$TYPE_CHECK_OUTPUT" | tail -30)"
  exit 2
fi

exit 0

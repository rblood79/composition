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

# run ledger (병합 순서 ③) — run 미시작이면 조용히 no-op
LEDGER="${CLAUDE_PROJECT_DIR:-.}/scripts/agent/run-ledger.sh"
ledger() { [ -x "$LEDGER" ] && AGENT_EVIDENCE_SOURCE=type-check-gate.sh bash "$LEDGER" evidence "$@" >/dev/null 2>&1 || true; }

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

# CSS regen gate (ADR-913 R6 closure): catalog rule table 편집 시 generated CSS 재생성.
# spec-rebuild-flag.sh 가 packages/shared/src/catalog/** 편집 감지 시 .css-regen-pending touch.
# Why: rule table(packages/shared/) 편집은 Skia(런타임 직독) 만 즉시 갱신, generated CSS(Preview/
#   Publish git-tracked 산출물) 는 stale → Builder↔Preview 시각 발산. generate:css 재실행 +
#   validate:sync 로 봉합. CSS diff 발생 시 커밋 누락 방지 알림.
CSS_FLAG="${CLAUDE_PROJECT_DIR:-.}/.claude/.css-regen-pending"
if [ -f "$CSS_FLAG" ]; then
  GENERATED_DIR="packages/shared/src/components/styles/generated"
  if ! CSS_OUTPUT=$(pnpm generate:css 2>&1); then
    echo "generate:css 실패. catalog rule table 변경 후 CSS 재생성 에러를 수정하세요:

$(echo "$CSS_OUTPUT" | tail -30)"
    exit 2
  fi
  # validate:sync — Skia 런타임 직독 ↔ generated CSS 동기 검증 (실패해도 차단 안 함, 알림만)
  VALIDATE_OUTPUT=$(pnpm validate:sync 2>&1 || true)
  rm -f "$CSS_FLAG"
  # 재생성으로 CSS 산출물에 diff 가 생겼으면 커밋 누락 방지 알림 (asyncRewake)
  CSS_DIFF=$(git diff --name-only HEAD -- "$GENERATED_DIR" 2>/dev/null || true)
  if [ -n "$CSS_DIFF" ]; then
    echo "catalog rule table 편집으로 generated CSS 가 재생성됐습니다. 아래 파일을 커밋에 포함하세요 (ADR-913 R6 — Skia↔CSS 동기):

$CSS_DIFF

validate:sync 결과(참고):
$(echo "$VALIDATE_OUTPUT" | tail -10)"
    exit 2
  fi
fi

# 세션 소유 변경 가드 (2026-08-18): 이 세션이 쓰기 도구(Edit/Write/NotebookEdit) 또는
# agent 위임(Task/Agent — 하위 agent 편집은 main transcript 에 안 잡힘)을 한 번도 안 썼으면
# 작업 트리의 .ts 변경은 외부(병렬 세션/수동 편집) 소유 → 이 세션에서 게이트 동작 금지.
# Why: 읽기 전용(plan mode) 세션이 외부 잔여 변경만으로 반복 차단됨 (2026-08-18 실측 4회).
# transcript/jq 부재 시엔 기존 작업 트리 기준으로 폴백 (게이트 보수적 유지).
TRANSCRIPT=$(printf '%s' "$INPUT" | jq -r '.transcript_path // empty' 2>/dev/null || true)
if [ -n "$TRANSCRIPT" ] && [ -f "$TRANSCRIPT" ] && command -v jq >/dev/null 2>&1; then
  SESSION_WRITE_COUNT=$(jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="tool_use") | .name' "$TRANSCRIPT" 2>/dev/null | grep -cE '^(Edit|Write|MultiEdit|NotebookEdit|Task|Agent)$' || true)
  if [ "${SESSION_WRITE_COUNT:-0}" -eq 0 ]; then
    exit 0
  fi
  # 세션 편집 확장자 가드 (2026-09-02, 사용자 승인): 쓰기 도구는 썼지만 편집 대상이 전부
  # 비-.ts/.tsx (문서·메모리·훅) 이고 agent 위임도 0 이면, 작업 트리의 .ts 변경은 여전히
  # 외부 소유 → 이 세션에서 게이트 동작 금지.
  # Why: ADR 문서만 쓴 세션이 병렬 세션(ADR-923 Phase 5)의 미커밋 .ts 로 Stop 마다 재차단
  #   (2026-09-02 실측 12회 연속 — 수정 권한 없는 파일이라 세션 안에서 루프 종료 불가).
  #   agent 위임이 있으면 하위 편집이 transcript 에 안 잡히므로 기존 보수 동작 유지.
  SESSION_AGENT_COUNT=$(jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="tool_use") | .name' "$TRANSCRIPT" 2>/dev/null | grep -cE '^(Task|Agent)$' || true)
  SESSION_TS_EDIT_COUNT=$(jq -r 'select(.type=="assistant") | .message.content[]? | select(.type=="tool_use") | select(.name=="Edit" or .name=="Write" or .name=="MultiEdit" or .name=="NotebookEdit") | .input.file_path // .input.notebook_path // empty' "$TRANSCRIPT" 2>/dev/null | grep -cE '\.(ts|tsx)$' || true)
  if [ "${SESSION_AGENT_COUNT:-0}" -eq 0 ] && [ "${SESSION_TS_EDIT_COUNT:-0}" -eq 0 ]; then
    exit 0
  fi
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
  ledger typecheck fail --cmd "pnpm type-check" --exit 2
  exit 2
fi

ledger typecheck pass --cmd "pnpm type-check"
exit 0

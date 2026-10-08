#!/usr/bin/env bash
# 수동 codex:route의 참고 힌트. 자동 prompt hook에는 등록하지 않는다.
# 스킬 선택과 실행 범위는 사용자 요청과 해당 SKILL.md 계약을 따른다.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/codex/env.sh"
codex_activate_env
cd "$ROOT_DIR"

if [ "${1:-}" = "--" ]; then
  shift
fi

if [ "$#" -gt 0 ]; then
  PROMPT="$*"
else
  PROMPT="$(cat)"
fi

if [ -z "${PROMPT// }" ]; then
  echo "Usage: pnpm run codex:route -- \"<user request>\""
  exit 1
fi

HINTS=()

add_hint() {
  HINTS+=("$1")
}

if echo "$PROMPT" | grep -qiE "렌더링|Skia|Canvas|WebGL|정합성|cross[- ]?check|CSS.*(WebGL|Canvas|Skia)"; then
  add_hint "rendering: cross-check로 catalog/theme·생성 CSS·Canvas·Preview 경로를 대조; 동시 변경이 있으면 .agents/README.md의 범위별 검증 사용"
fi

if echo "$PROMPT" | grep -qiE "ADR[- ]?[0-9]+.{0,30}(실행|진행|next)|execute[- ]?adr|다음 ?Phase|phase ?(자동|진행|실행)"; then
  add_hint "adr-execute: execute-adr는 명시 요청 범위에만 적용; 대상 ADR의 상태·의존 Phase·검증 계약 확인; 다른 작업의 dirty 변경 보존; commit/push는 별도 사용자 요청 시에만 수행"
fi

if echo "$PROMPT" | grep -qiE "ADR|아키텍처 결정|architecture decision"; then
  add_hint "adr: 검토 요청은 review-adr; 새 ADR 작성의 명시 요청은 create-adr; 현재 file:line 근거를 제시하고 리뷰만 요청되면 수정하지 않음"
elif echo "$PROMPT" | grep -qiE "재검토|리뷰|검토|review"; then
  add_hint "code-review: review로 코드 변경의 정확성·회귀·계약을 검토; 현재 file:line 근거를 제시하고 리뷰만 요청되면 수정하지 않음"
fi

if echo "$PROMPT" | grep -qiE "새 컴포넌트|컴포넌트 (구현|만들|추가|설계)|new component|implement component|React Aria|Spectrum|S2"; then
  add_hint "component: component-design과 composition-patterns 사용; catalog·origin template 변경 전 React Aria/Spectrum API와 등록 계약 확인"
fi

if echo "$PROMPT" | grep -qiE "버그|bug|에러|error|실패|fail|crash|broken|안 ?(됨|되|나와)|망가|동일하다|똑같다"; then
  add_hint "debug: start from the actual runtime path and value chain; reproduce before patching"
fi

if echo "$PROMPT" | grep -qiE "리팩토링|refactor|재구조|migration|마이그레이션"; then
  add_hint "refactor: keep ownership narrow; preserve public contracts; run targeted tests before broad gates"
fi

if echo "$PROMPT" | grep -qiE "테스트|test|E2E|storybook|playwright|vitest"; then
  add_hint "test: prefer focused Vitest near changed modules; use Playwright for user flow or visual behavior"
fi

if echo "$PROMPT" | grep -qiE "레이아웃|layout|Taffy|flex|grid|align|정렬|Yoga"; then
  add_hint "layout: .agents/rules/layout-engine.md 참조; transaction layout 영향 → CatalogCompositionRoot 계획 → styleOf → PersistentLayoutTree 증분 반영을 추적"
fi

if echo "$PROMPT" | grep -qiE "상태|store|zustand|slice|elementsMap|childrenMap|history"; then
  add_hint "state: .agents/rules/state-management.md 참조; CatalogCommand → workspace.execute → transaction commit → Canvas·DOM consumer → 저장 대기열 → CatalogAutosave → 로드 → session read model → UI 경로를 확인"
fi

if echo "$PROMPT" | grep -qiE "Page.*Frame|Frame.*Page|page-bound|selectedElement|deferred.*selection|선택.*Frame|프러퍼티.*Frame|다른 Page|currentPageId"; then
  add_hint "selection: CatalogSession과 useCatalogSession의 현재 선택·페이지를 확인하고 CatalogCommand를 workspace.execute로 실행; 지연된 inspector 표시값을 편집 대상으로 재사용하지 않음"
fi

if echo "$PROMPT" | grep -qiE "전체 검증|일괄|패밀리|컴포넌트 전체|parallel|sweep|서브에이전트|병렬"; then
  add_hint "parallel: only spawn sub-agents when explicitly requested; use cross-check per component for family sweeps"
fi

if echo "$PROMPT" | grep -qiE "RAC|slot|showWhen|presentWhen|StateOwner|조건부.*표시|값.*바인딩"; then
  add_hint "rac-composition: composition-patterns의 .agents/skills/composition-patterns/rules/domain-rac-composition.md 참조; children·slot·상태 주체·조건부 표시·값 바인딩 계약 확인"
fi

if echo "$PROMPT" | grep -qiE "실제.*(builder|빌더)|직접.*(테스트|확인)|브라우저.*(검증|확인|테스트)|browser.*(verify|test|check)|evaluate"; then
  add_hint "live-evaluate: evaluate로 실행 중인 Builder의 실제 사용자 흐름·상태 동기화 확인; 서버·탭을 찾고 미검증 범위와 이유 보고"
fi

echo "=== Codex Route Hints ==="
echo "mise: ${CODEX_MISE_STATUS:-unknown}"

if [ "${#HINTS[@]}" -eq 0 ]; then
  echo "- no special route; follow AGENTS.md and keep the change scoped"
else
  printf -- "- %s\n" "${HINTS[@]}"
fi

#!/usr/bin/env bash
# Manual Codex prompt router. Codex has no automatic UserPromptSubmit hook, so this
# gives a cheap, repeatable way to map a request to local skills/rules/gates.

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
  add_hint "rendering: use cross-check; inspect spec/CSS/Canvas paths together; finish with codex:preflight"
fi

if echo "$PROMPT" | grep -qiE "ADR|아키텍처 결정|설계 문서|architecture decision|재검토|리뷰"; then
  add_hint "adr/review: use review-adr or create-adr; cite current file:line evidence; avoid edits for read-only review"
fi

if echo "$PROMPT" | grep -qiE "새 컴포넌트|컴포넌트 (구현|만들|추가|설계)|new component|implement component|React Aria|Spectrum|S2"; then
  add_hint "component: use component-design plus composition-patterns; verify React Aria/Spectrum API before spec changes"
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
  add_hint "layout: load .agents/rules/layout-engine.md; check layoutVersion and full rebuild/cache invalidation"
fi

if echo "$PROMPT" | grep -qiE "상태|store|zustand|slice|elementsMap|childrenMap|history"; then
  add_hint "state: load .agents/rules/state-management.md; preserve Memory -> Index -> History -> DB -> Preview -> Rebalance"
  add_hint "adr-137: page-bound mutation must use readImmediateSelectionSnapshot() + apply*FromSelection(snapshot, ...) or explicit context via apply*Explicit({ pageId, contextReason, ... })"
fi

if echo "$PROMPT" | grep -qiE "Page.*Frame|Frame.*Page|page-bound|selectedElement|deferred.*selection|선택.*Frame|프러퍼티.*Frame|다른 Page|currentPageId"; then
  add_hint "adr-137: verify Selection Consumer Contract; deferred inspector data is display-only, stale mismatch should hide/disable page-bound controls"
fi

if echo "$PROMPT" | grep -qiE "전체 검증|일괄|패밀리|컴포넌트 전체|parallel|sweep|서브에이전트|병렬"; then
  add_hint "parallel: only spawn sub-agents when explicitly requested; use parallel-verify for component-family sweeps"
fi

echo "=== Codex Route Hints ==="
echo "mise: ${CODEX_MISE_STATUS:-unknown}"

if [ "${#HINTS[@]}" -eq 0 ]; then
  echo "- no special route; follow AGENTS.md and keep the change scoped"
else
  printf -- "- %s\n" "${HINTS[@]}"
fi

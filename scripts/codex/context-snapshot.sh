#!/usr/bin/env bash
# Changed-file aware context snapshot for resume/precompact handoff.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/codex/env.sh"
codex_activate_env
cd "$ROOT_DIR"

print_section() {
  local title="$1"
  echo
  echo "=== ${title} ==="
}

CHANGED="$(codex_changed_files)"

print_section "Codex Context Snapshot"
echo "repo: $(basename "$ROOT_DIR")"
echo "branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
echo "head: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "mise: ${CODEX_MISE_STATUS:-unknown}"

print_section "Changed Files (최대 20개)"
if [ -z "$CHANGED" ]; then
  echo "none"
else
  printf '%s\n' "$CHANGED" | sed -n '1,20p'
  echo "전체 목록: git status --short"
fi

print_section "Core Contract"
echo "- AGENTS.md: 작업 범위·권한·완료 계약. 공용 skill/rule 정본은 .claude/, .agents는 심링크."
echo "- commit/push는 사용자 명시 요청 시에만 실행. 다른 작업의 dirty 변경 보존."
echo "- 인수인계: .agent/task-state.json에서 현재 작업 항목만 읽는다."

print_section "관련 지침 (필요한 링크만 열기)"
echo "- .agents/README.md: 범위별 검증·evidence 운영"
if echo "$CHANGED" | grep -qiE "catalog|shared/src/components|canvas|skia|rendering|preview|packages/engine"; then
  echo "- .agents/skills/composition-patterns/SKILL.md"
  echo "- .agents/skills/composition-patterns/rules/domain-rac-composition.md"
  echo "- .agents/skills/cross-check/SKILL.md"
fi
if echo "$CHANGED" | grep -qiE "catalog/(commands|document|runtime)|catalogRuntime|store|session|history|autosave"; then
  echo "- .agents/rules/state-management.md"
fi
if echo "$CHANGED" | grep -qiE "layout|packages/engine|catalogRuntime|catalog/runtime"; then
  echo "- .agents/rules/layout-engine.md"
fi
if echo "$CHANGED" | grep -qiE "\.css$|theme|token"; then
  echo "- .agents/rules/style-ssot.md"
fi
if echo "$CHANGED" | grep -qiE "docs/adr|adr-writing|CHANGELOG"; then
  echo "- .agents/rules/adr-writing.md"
fi

print_section "Completion Gate"
echo "pnpm run codex:preflight (포맷은 검사만, 파일 수정 없음)"
echo "동시 작업은 .agents/README.md의 범위별 검증 사용; 검증한 최신 변경에만 PASS 적용."

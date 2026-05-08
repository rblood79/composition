#!/bin/bash
# Stop Hook: ADR Implemented 승격 시 README.md / CHANGELOG.md 동시 갱신 검증
#
# Why: 지난 30일 113건 Implemented 승격 중 README 동시 갱신 7건 (6.2%) / CHANGELOG 5건 (4.4%).
#      `feedback-adr-closure-5-step.md` 5단계가 checklist 일 뿐 enforcement 없음.
#
# 동작:
#   1. git diff HEAD 로 docs/adr/**.md 변경 파일 추출
#   2. 각 파일의 working tree Status vs HEAD Status 비교 → "Implemented" 신규 승격 식별
#   3. 승격 감지 시 docs/adr/README.md / docs/CHANGELOG.md 동시 변경 여부 확인
#   4. 미반영이면 decision: block + 안내
#   5. block / escape hatch 사용 시 stats/hook-blocks.jsonl 로깅 (Wave A* metrics)
#
# Escape hatch:
#   - ADR_SPLIT_COMMIT=1 환경변수 (지속)
#   - .claude/.adr-split-commit-allowed flag 파일 (1회용, 자동 삭제)

set -euo pipefail

INPUT=$(cat)

# 재진입 방지
ADR_SYNC_HOOK_ACTIVE="${ADR_SYNC_HOOK_ACTIVE:-false}"
if [ "$ADR_SYNC_HOOK_ACTIVE" = "true" ]; then
  exit 0
fi
export ADR_SYNC_HOOK_ACTIVE=true

cd "${CLAUDE_PROJECT_DIR:-.}"

# Wave A* metrics: hook action 로깅 helper
log_hook_action() {
  local action="$1"  # block | escape
  local stats_dir="${CLAUDE_PROJECT_DIR:-.}/.claude/stats"
  mkdir -p "$stats_dir" 2>/dev/null || return 0
  if command -v jq >/dev/null 2>&1; then
    jq -nc \
      --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      --arg action "$action" \
      --arg hook "adr-status-sync-check" \
      '{ts: $ts, hook: $hook, action: $action}' \
      >> "$stats_dir/hook-blocks.jsonl" 2>/dev/null || true
  fi
}

# Escape hatch 1: 환경변수
if [ "${ADR_SPLIT_COMMIT:-}" = "1" ]; then
  log_hook_action "escape"
  exit 0
fi

# Escape hatch 2: flag 파일 (1회 사용 후 자동 삭제)
SPLIT_FLAG="${CLAUDE_PROJECT_DIR:-.}/.claude/.adr-split-commit-allowed"
if [ -f "$SPLIT_FLAG" ]; then
  rm -f "$SPLIT_FLAG"
  log_hook_action "escape"
  exit 0
fi

# 변경된 ADR 본문 파일 (design/, reviews/ 제외)
ADR_FILES=$(git diff --name-only HEAD -- 'docs/adr/*.md' 'docs/adr/completed/*.md' 2>/dev/null \
  | grep -vE '/(design|reviews)/' || true)

if [ -z "$ADR_FILES" ]; then
  exit 0
fi

PROMOTED_ADRS=()
while IFS= read -r f; do
  [ -z "$f" ] && continue
  [ ! -f "$f" ] && continue

  CURRENT_STATUS=$(awk '
    /^## Status[[:space:]]*$/ {found=1; next}
    found && NF > 0 {print $1; exit}
  ' "$f" 2>/dev/null)

  HEAD_CONTENT=$(git show "HEAD:$f" 2>/dev/null || echo "")
  if [ -z "$HEAD_CONTENT" ]; then
    HEAD_STATUS=""
  else
    HEAD_STATUS=$(echo "$HEAD_CONTENT" | awk '
      /^## Status[[:space:]]*$/ {found=1; next}
      found && NF > 0 {print $1; exit}
    ')
  fi

  if [ "$CURRENT_STATUS" = "Implemented" ] && [ "$HEAD_STATUS" != "Implemented" ]; then
    PROMOTED_ADRS+=("$f")
  fi
done <<< "$ADR_FILES"

if [ ${#PROMOTED_ADRS[@]} -eq 0 ]; then
  exit 0
fi

README_CHANGED=$(git diff --name-only HEAD -- docs/adr/README.md 2>/dev/null || true)
CHANGELOG_CHANGED=$(git diff --name-only HEAD -- docs/CHANGELOG.md 2>/dev/null || true)

MISSING=()
[ -z "$README_CHANGED" ] && MISSING+=("docs/adr/README.md")
[ -z "$CHANGELOG_CHANGED" ] && MISSING+=("docs/CHANGELOG.md")

if [ ${#MISSING[@]} -eq 0 ]; then
  exit 0
fi

# block 로깅
log_hook_action "block"

PROMOTED_LIST=$(printf '  - %s\n' "${PROMOTED_ADRS[@]}")
MISSING_LIST=$(printf '  - %s\n' "${MISSING[@]}")

REASON_TEXT=$(cat <<INNER_EOF
ADR Implemented 승격 감지 — 동시 갱신 누락:

승격된 ADR:
$PROMOTED_LIST
미반영 파일:
$MISSING_LIST

[필수 후속 작업]
1. docs/adr/README.md — Implemented 섹션 행 이동 + 카운트 갱신
2. docs/CHANGELOG.md — 새 엔트리 추가 (Section/Title/Why/Files 포맷)
   - 헤더 형식: ## [한글 제목 — 기술 요약] - YYYY-MM-DD
   - 서브섹션 순서: Breaking Changes → Bug Fixes → Features → Architecture → Performance → Documentation → Infrastructure
   - 'Why:' 한 줄 포함 (단순 'X가 Y로 변경됨' 금지)

[참조]
- .claude/rules/changelog.md §1 트리거 표
- ~/.claude/projects/-Users-admin-work-composition/memory/feedback-adr-closure-5-step.md 5단계
- 통계: 지난 30일 Implemented 113건 중 README 동시 갱신 7건 (6.2%)

[Escape hatch — 다음 커밋으로 분리 의도인 경우]
- 1회용 우회: touch .claude/.adr-split-commit-allowed (hook 통과 후 자동 삭제)
- 지속 우회: ADR_SPLIT_COMMIT=1 환경변수
- 단, 분리 commit 후 24시간 내 README/CHANGELOG 갱신 권장
INNER_EOF
)

if command -v jq >/dev/null 2>&1; then
  jq -n --arg r "$REASON_TEXT" '{decision: "block", reason: $r}'
else
  echo "$REASON_TEXT" >&2
  exit 2
fi
exit 0

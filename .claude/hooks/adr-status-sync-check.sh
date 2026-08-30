#!/bin/bash
# Stop Hook: ADR Implemented 승격 시 README.md / CHANGELOG.md 동시 갱신 + Live Exercise 근거 검증
#
# Why: 지난 30일 113건 Implemented 승격 중 README 동시 갱신 7건 (6.2%) / CHANGELOG 5건 (4.4%).
#      `feedback-adr-closure-5-step.md` 5단계가 checklist 일 뿐 enforcement 없음.
# Why (live, 2026-08-28 — 병합 순서 ③): ADR-144 가 test/type-check PASS 만으로 Implemented 승격
#      → live builder 미동작 → 34 commit revert. CLAUDE.md §완료 기준 (live behavior 1회 exercise)
#      이 산문 자가 적용이라 hook 으로 승격 시점에 요구한다.
#
# 동작:
#   1. git diff HEAD 로 docs/adr/**.md 변경 파일 추출
#   2. 각 파일의 working tree Status vs HEAD Status 비교 → "Implemented" 신규 승격 식별
#   3. 승격 감지 시
#      a. docs/adr/README.md / docs/CHANGELOG.md 동시 변경 여부 (escape hatch 로 분리 commit 허용)
#      b. Live Exercise 근거 — 다음 중 하나 (escape hatch 로 우회 불가):
#         - ADR 본문에 `### Live Exercise` 절 (heading 에 "Live Exercise") 또는 `live-exercise:` 표기
#         - docs/adr/evidence/NNN-*live*.md 파일 존재
#         - 현재 run ledger (.agent/runs/current) 에 kind=live-exercise status=pass 기록
#   4. 미반영이면 decision: block + 안내
#   5. block / escape / pass 를 stats/hook-blocks.jsonl + run ledger 에 기록
#
# Escape hatch (README/CHANGELOG 분리 commit 전용 — live 근거에는 적용 안 됨):
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

# run ledger (있으면 append, 없거나 run 미시작이면 조용히 no-op)
LEDGER="${CLAUDE_PROJECT_DIR:-.}/scripts/agent/run-ledger.sh"
[ -x "$LEDGER" ] || LEDGER="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/scripts/agent/run-ledger.sh"
ledger() { [ -x "$LEDGER" ] && AGENT_EVIDENCE_SOURCE=adr-status-sync-check.sh bash "$LEDGER" evidence "$@" >/dev/null 2>&1 || true; }

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

# Escape hatch (README/CHANGELOG 분리 commit) — 여기서 exit 하지 않고 flag 만 세운다 (live 검사는 계속)
SPLIT_OK=0
if [ "${ADR_SPLIT_COMMIT:-}" = "1" ]; then
  SPLIT_OK=1
fi
SPLIT_FLAG="${CLAUDE_PROJECT_DIR:-.}/.claude/.adr-split-commit-allowed"
if [ -f "$SPLIT_FLAG" ]; then
  rm -f "$SPLIT_FLAG"
  SPLIT_OK=1
fi

# 변경된 ADR 본문 파일 (design/, reviews/ 제외)
ADR_FILES=$(git diff --name-only HEAD -- 'docs/adr/*.md' 'docs/adr/completed/*.md' 2>/dev/null \
  | grep -vE '/(design|reviews)/' || true)

if [ -z "$ADR_FILES" ]; then
  [ "$SPLIT_OK" = 1 ] && log_hook_action "escape"
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
  [ "$SPLIT_OK" = 1 ] && log_hook_action "escape"
  exit 0
fi

# a. README / CHANGELOG 동시 갱신
MISSING=()
if [ "$SPLIT_OK" = 1 ]; then
  log_hook_action "escape"
else
  README_CHANGED=$(git diff --name-only HEAD -- docs/adr/README.md 2>/dev/null || true)
  CHANGELOG_CHANGED=$(git diff --name-only HEAD -- docs/CHANGELOG.md 2>/dev/null || true)
  [ -z "$README_CHANGED" ] && MISSING+=("docs/adr/README.md")
  [ -z "$CHANGELOG_CHANGED" ] && MISSING+=("docs/CHANGELOG.md")
fi

# b. Live Exercise 근거 (escape hatch 무관)
LEDGER_HAS_LIVE=0
if [ -x "$LEDGER" ] && bash "$LEDGER" has-live >/dev/null 2>&1; then
  LEDGER_HAS_LIVE=1
fi
LIVE_MISSING=()
for f in "${PROMOTED_ADRS[@]}"; do
  NNN=$(basename "$f" | grep -oE '^[0-9]+' || true)
  if grep -qiE '^#{2,4}[[:space:]].*live[[:space:]-]*exercise|live-exercise:' "$f" 2>/dev/null; then
    continue
  fi
  if [ -n "$NNN" ] && ls docs/adr/evidence/"$NNN"-*live* >/dev/null 2>&1; then
    continue
  fi
  if [ "$LEDGER_HAS_LIVE" = 1 ]; then
    continue
  fi
  LIVE_MISSING+=("$f")
done

if [ ${#MISSING[@]} -eq 0 ] && [ ${#LIVE_MISSING[@]} -eq 0 ]; then
  ledger adr-sync pass --detail "Implemented 승격 ${#PROMOTED_ADRS[@]}건 — README/CHANGELOG + Live Exercise 근거 확인"
  exit 0
fi

# block 로깅
log_hook_action "block"
ledger adr-sync block --detail "README/CHANGELOG 누락 ${#MISSING[@]} · Live Exercise 누락 ${#LIVE_MISSING[@]}"

PROMOTED_LIST=$(printf '  - %s\n' "${PROMOTED_ADRS[@]}")
MISSING_LIST=""
[ ${#MISSING[@]} -gt 0 ] && MISSING_LIST=$(printf '  - %s\n' "${MISSING[@]}")
LIVE_LIST=""
[ ${#LIVE_MISSING[@]} -gt 0 ] && LIVE_LIST=$(printf '  - %s\n' "${LIVE_MISSING[@]}")

REASON_TEXT=$(cat <<INNER_EOF
ADR Implemented 승격 감지 — 종결 근거 누락:

승격된 ADR:
$PROMOTED_LIST
$( [ -n "$MISSING_LIST" ] && printf '동시 갱신 미반영 파일:\n%s\n' "$MISSING_LIST" )
$( [ -n "$LIVE_LIST" ] && printf 'Live Exercise 근거 없음 (CLAUDE.md §완료 기준 — test/type-check PASS 단독 종결 금지):\n%s\n' "$LIVE_LIST" )
[필수 후속 작업]
1. docs/adr/README.md — Implemented 섹션 행 이동 + 카운트 갱신
2. docs/CHANGELOG.md — 새 엔트리 추가 (Section/Title/Why/Files 포맷)
   - 헤더 형식: ## [한글 제목 — 기술 요약] - YYYY-MM-DD
   - 서브섹션 이름: Added / Changed / Removed / Fixed / Performance / Tests / Documentation / Infrastructure (Breaking Changes 는 있으면 최상단)
   - 'Why:' 한 줄 포함 (단순 'X가 Y로 변경됨' 금지)
3. Live Exercise — 다음 중 하나로 실제 builder 에서 무엇을 exercise 했는지 기록:
   - ADR 본문에 \`### Live Exercise\` 절 (시나리오 · 결과 · 날짜 · Chrome MCP / 사용자 confirm 구분)
   - docs/adr/evidence/NNN-*live*.md 파일
   - run ledger: pnpm agent:run -- evidence live-exercise pass --detail "<무엇을 exercise 했는지>"

[참조]
- .claude/rules/changelog.md §1 트리거 표 · .claude/rules/adr-writing.md §Status 전이 규칙
- ~/.claude/projects/-Users-admin-work-composition/memory/feedback-adr-closure-5-step.md 5단계
- Why: ADR-144 (2026-05-22) — test PASS 로 승격 후 live 미동작 → 34 commit revert

[Escape hatch — README/CHANGELOG 를 다음 커밋으로 분리하는 경우만 (Live Exercise 는 우회 불가)]
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

#!/bin/bash
# Metrics Snapshot — SessionStart 백그라운드 호출
#
# 새 ADR Implemented 승격 commit 마다 README/CHANGELOG 동시 갱신 여부를 stats/adr-drift.jsonl 에 기록.
# 마지막 분석 시점 (last-snapshot-sha) 이후 새 commit 만 처리 → idempotent.
#
# Why: time-based ("1주 운영") 게이팅을 evidence-based (commit N건 분석) 로 전환.
#      Wave A 효과 측정 → Wave B 자동 진입 trigger 데이터 수집.
#
# 출력 schema (stats/adr-drift.jsonl, jsonl append):
#   {
#     "sha": "abc123",
#     "date": "2026-05-09T04:30:00Z",
#     "promoted_adrs": ["100-...md"],
#     "readme_updated": true,
#     "changelog_updated": true,
#     "synced": true   # 모두 동시 갱신 시
#   }

set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

STATS_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/stats"
DRIFT_FILE="$STATS_DIR/adr-drift.jsonl"
SNAPSHOT_FILE="$STATS_DIR/.last-drift-snapshot-sha"

mkdir -p "$STATS_DIR"

# 마지막 분석 SHA (없으면 7일 전부터)
if [ -f "$SNAPSHOT_FILE" ]; then
  SINCE_SHA=$(cat "$SNAPSHOT_FILE")
  if ! git rev-parse --verify "$SINCE_SHA" >/dev/null 2>&1; then
    SINCE_SHA=""
  fi
fi

if [ -z "${SINCE_SHA:-}" ]; then
  # 첫 실행 — 현재 HEAD 를 baseline 시작점으로 저장. 다음 새 commit 부터 측정 (Wave A 활성화 시점 기준)
  git rev-parse HEAD > "$SNAPSHOT_FILE" 2>/dev/null || true
  exit 0
fi
RANGE="$SINCE_SHA..HEAD"

# ADR 본문 변경 commit 만 추출 (design/reviews/completed 제외 — 본문 status 변경 위주)
COMMITS=$(git log $RANGE --format='%H' -- 'docs/adr/*.md' 'docs/adr/completed/*.md' 2>/dev/null \
  | tail -r 2>/dev/null || awk "{ a[i++] = \$0 } END { for (j=i-1; j>=0; j--) print a[j] }")

if [ -z "$COMMITS" ]; then
  # 새 commit 없음 → 현재 HEAD 만 기록
  git rev-parse HEAD > "$SNAPSHOT_FILE" 2>/dev/null || true
  exit 0
fi

while IFS= read -r SHA; do
  [ -z "$SHA" ] && continue

  # 해당 commit 에서 ADR Implemented 승격 발생했는지
  PROMOTED=()
  CHANGED_ADR=$(git show --name-only --format='' "$SHA" 2>/dev/null \
    | grep -E '^docs/adr/[^/]*\.md$|^docs/adr/completed/[^/]*\.md$' \
    | grep -vE '/(design|reviews)/' || true)

  while IFS= read -r f; do
    [ -z "$f" ] && continue

    # commit 후 Status (이 commit 의 working tree)
    POST_STATUS=$(git show "$SHA:$f" 2>/dev/null | awk '
      /^## Status[[:space:]]*$/ {found=1; next}
      found && NF > 0 {print $1; exit}
    ' || echo "")
    # commit 전 Status (parent)
    PRE_STATUS=$(git show "$SHA^:$f" 2>/dev/null | awk '
      /^## Status[[:space:]]*$/ {found=1; next}
      found && NF > 0 {print $1; exit}
    ' || echo "")

    if [ "$POST_STATUS" = "Implemented" ] && [ "$PRE_STATUS" != "Implemented" ]; then
      PROMOTED+=("$f")
    fi
  done <<< "$CHANGED_ADR"

  # 승격 없으면 skip
  [ ${#PROMOTED[@]} -eq 0 ] && continue

  # README / CHANGELOG 동시 변경 여부
  COMMIT_FILES=$(git show --name-only --format='' "$SHA" 2>/dev/null || echo "")
  README_UPDATED=$(echo "$COMMIT_FILES" | grep -qx 'docs/adr/README.md' && echo true || echo false)
  CHANGELOG_UPDATED=$(echo "$COMMIT_FILES" | grep -qx 'docs/CHANGELOG.md' && echo true || echo false)

  SYNCED=false
  if [ "$README_UPDATED" = "true" ] && [ "$CHANGELOG_UPDATED" = "true" ]; then
    SYNCED=true
  fi

  COMMIT_DATE=$(git show -s --format='%cI' "$SHA" 2>/dev/null || date -u +%Y-%m-%dT%H:%M:%SZ)

  # JSON line append
  PROMOTED_JSON=$(printf '%s\n' "${PROMOTED[@]}" | jq -R . | jq -s .)
  jq -nc \
    --arg sha "$SHA" \
    --arg date "$COMMIT_DATE" \
    --argjson promoted "$PROMOTED_JSON" \
    --argjson readme "$README_UPDATED" \
    --argjson changelog "$CHANGELOG_UPDATED" \
    --argjson synced "$SYNCED" \
    '{sha: $sha, date: $date, promoted_adrs: $promoted, readme_updated: $readme, changelog_updated: $changelog, synced: $synced}' \
    >> "$DRIFT_FILE"
done <<< "$COMMITS"

# 마지막 분석 SHA 저장
git rev-parse HEAD > "$SNAPSHOT_FILE" 2>/dev/null || true

exit 0

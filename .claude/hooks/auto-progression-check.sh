#!/bin/bash
# Auto Progression Check — SessionStart foreground 메시지 출력
#
# stats/adr-drift.jsonl + stats/hook-blocks.jsonl 분석 → 다음 Wave 진입 조건 평가.
# 시간 단위 ("1주 운영") 가 아니라 evidence 기반 (commit N건 분석) 자동 판정.
#
# 출력: "Wave X 진입 조건" 또는 "Wave A* drift metric: 95% (4/4 synced, last 5 ADR commits)"
#
# Wave B 진입 조건 (Wave A → Wave B):
#   - drift sync rate ≥ 90% (최근 5+ ADR Implemented commit)
#   - false positive rate ≤ 20% (hook-blocks 중 escape hatch 사용 비율)
#   - regression count = 0 (hook 자체 type-check error 등)
#
# Wave C / L4 조건은 향후 추가 (Wave B land 이후 활성화).

set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

STATS_DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/stats"
DRIFT_FILE="$STATS_DIR/adr-drift.jsonl"
BLOCKS_FILE="$STATS_DIR/hook-blocks.jsonl"

# stats 파일 없으면 baseline 메시지만
if [ ! -f "$DRIFT_FILE" ] || [ ! -s "$DRIFT_FILE" ]; then
  cat <<MSG

## 📊 Auto-Progression — Wave A baseline 수집 중

- ADR Implemented 승격 commit 누적 = 0
- Wave A* metrics 수집 시작 시점: 다음 ADR 종결 commit 부터
- Wave B 진입 조건: drift sync ≥ 90% (5+ commit) / FP ≤ 20% / regression = 0
MSG
  exit 0
fi

# 최근 N=5 ADR Implemented commit 분석 (전체가 5 미만이면 전체)
TOTAL_COMMITS=$(wc -l < "$DRIFT_FILE" | tr -d ' ')
SAMPLE_SIZE=5
if [ "$TOTAL_COMMITS" -lt "$SAMPLE_SIZE" ]; then
  SAMPLE_SIZE=$TOTAL_COMMITS
fi

RECENT=$(tail -"$SAMPLE_SIZE" "$DRIFT_FILE")
SYNCED_COUNT=$(echo "$RECENT" | jq -r 'select(.synced==true) | .sha' | wc -l | tr -d ' ')
SYNC_RATE=$(awk -v s="$SYNCED_COUNT" -v t="$SAMPLE_SIZE" 'BEGIN{ if (t>0) printf "%.0f", (s/t)*100; else print "0" }')

# 전체 누적 통계 (참고용)
TOTAL_SYNCED=$(jq -r 'select(.synced==true) | .sha' "$DRIFT_FILE" | wc -l | tr -d ' ')
TOTAL_RATE=$(awk -v s="$TOTAL_SYNCED" -v t="$TOTAL_COMMITS" 'BEGIN{ if (t>0) printf "%.0f", (s/t)*100; else print "0" }')

# FP rate (hook-blocks 분석)
FP_RATE_INFO="N/A (block 발생 없음)"
if [ -f "$BLOCKS_FILE" ] && [ -s "$BLOCKS_FILE" ]; then
  TOTAL_BLOCKS=$(wc -l < "$BLOCKS_FILE" | tr -d ' ')
  ESCAPE_USED=$(jq -r 'select(.action=="escape") | .ts' "$BLOCKS_FILE" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$TOTAL_BLOCKS" -gt 0 ]; then
    FP_RATE=$(awk -v e="$ESCAPE_USED" -v t="$TOTAL_BLOCKS" 'BEGIN{ printf "%.0f", (e/t)*100 }')
    FP_RATE_INFO="$FP_RATE% ($ESCAPE_USED escape / $TOTAL_BLOCKS blocks)"
  fi
fi

# Wave B 진입 조건 평가
SYNC_PASS=$(awk -v r="$SYNC_RATE" 'BEGIN{ print (r>=90) ? "true" : "false" }')
FP_PASS="true"
if [ -f "$BLOCKS_FILE" ] && [ -s "$BLOCKS_FILE" ]; then
  TOTAL_BLOCKS=$(wc -l < "$BLOCKS_FILE" | tr -d ' ')
  ESCAPE_USED=$(jq -r 'select(.action=="escape") | .ts' "$BLOCKS_FILE" 2>/dev/null | wc -l | tr -d ' ')
  if [ "$TOTAL_BLOCKS" -gt 0 ]; then
    FP_RATE=$(awk -v e="$ESCAPE_USED" -v t="$TOTAL_BLOCKS" 'BEGIN{ printf "%d", (e/t)*100 }')
    if [ "$FP_RATE" -gt 20 ]; then
      FP_PASS="false"
    fi
  fi
fi
SAMPLE_PASS=$([ "$SAMPLE_SIZE" -ge 5 ] && echo "true" || echo "false")

cat <<MSG

## 📊 Auto-Progression — Wave A 효과 측정

- 최근 ${SAMPLE_SIZE} ADR Implemented commit: drift sync rate **${SYNC_RATE}%** (${SYNCED_COUNT}/${SAMPLE_SIZE})
- 전체 누적: ${TOTAL_RATE}% (${TOTAL_SYNCED}/${TOTAL_COMMITS} commits)
- Hook block FP rate: ${FP_RATE_INFO}
MSG

if [ "$SYNC_PASS" = "true" ] && [ "$FP_PASS" = "true" ] && [ "$SAMPLE_PASS" = "true" ]; then
  cat <<MSG

### ✅ Wave B 진입 조건 충족

- ✅ Sync rate ≥ 90% (현재 ${SYNC_RATE}%)
- ✅ FP rate ≤ 20% (현재 ${FP_RATE_INFO})
- ✅ Sample size ≥ 5 (현재 ${SAMPLE_SIZE})

**다음 step**: Wave B (\`execute-adr\` deterministic finisher) 즉시 진입 가능.
사용자 신호 — "Wave B 진행해" 또는 \`/execute-adr ADR-NNN --auto\` 명령으로 trigger.

(Wave B 작업 scope: \`.claude/skills/execute-adr/finisher.sh\` 작성 + SKILL.md \`--auto\` flag 추가, 약 5-7h)
MSG
else
  cat <<MSG

### ⏳ Wave B 진입 대기

조건 미충족:
- Sample: $([ "$SAMPLE_PASS" = "true" ] && echo "✅ ≥5" || echo "❌ <5 (현재 ${SAMPLE_SIZE})")
- Sync rate: $([ "$SYNC_PASS" = "true" ] && echo "✅ ≥90%" || echo "❌ <90% (현재 ${SYNC_RATE}%)")
- FP rate: $([ "$FP_PASS" = "true" ] && echo "✅ ≤20%" || echo "❌ >20% (현재 ${FP_RATE_INFO})")

**자동 재평가**: 다음 ADR Implemented commit 후 SessionStart 에서 재계산.
MSG
fi

exit 0

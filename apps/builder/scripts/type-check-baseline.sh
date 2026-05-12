#!/usr/bin/env bash
#
# type-check-baseline.sh
#
# apps/builder type-check baseline wrapper.
#
# 배경: apps/builder/tsconfig.json 이 `files: []` + project references 구성으로
# `tsc --noEmit` 단일 호출 시 0 파일 검사 → 모든 type 위반 silent 통과 상태였다.
# 본 wrapper 는 tsconfig.app.json + tsconfig.node.json 를 각각 명시 검사하여
# 실효 type-check 를 회복한다.
#
# baseline 정책: 누적 type 에러 freeze (.type-errors-baseline.txt) 후
# 새 위반 (baseline 외 신규 line) 만 fail. 기존 에러 단계적 정리는 별 phase 흡수.
#
# 종료 코드:
#   0  — 새 위반 0 (baseline 정합)
#   1  — 새 위반 발견 or baseline 파일 missing
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILDER_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$BUILDER_DIR"

BASELINE=".type-errors-baseline.txt"

if [ ! -f "$BASELINE" ]; then
  echo "ERROR: baseline file '$BUILDER_DIR/$BASELINE' missing." >&2
  echo "       baseline 을 생성하려면:" >&2
  echo "         cd $BUILDER_DIR" >&2
  echo "         pnpm exec tsc -p tsconfig.app.json --noEmit 2>&1 | grep 'error TS' | sort > $BASELINE" >&2
  exit 1
fi

CURRENT=$(mktemp)
NEW=$(mktemp)
RESOLVED=$(mktemp)
trap "rm -f '$CURRENT' '$NEW' '$RESOLVED'" EXIT

# Run both tsconfigs. grep "error TS" 매칭 line 만 추출. fail 도 무시 (|| true).
{
  pnpm exec tsc -p tsconfig.app.json --noEmit 2>&1 || true
  pnpm exec tsc -p tsconfig.node.json --noEmit 2>&1 || true
} | grep "error TS" | sort -u > "$CURRENT"

# baseline 에 없는 새 위반
comm -23 "$CURRENT" "$BASELINE" > "$NEW"
NEW_COUNT=$(wc -l < "$NEW" | tr -d ' ')

# baseline 에 있지만 현재 사라진 (resolved) 항목
comm -13 "$CURRENT" "$BASELINE" > "$RESOLVED"
RESOLVED_COUNT=$(wc -l < "$RESOLVED" | tr -d ' ')

BASELINE_COUNT=$(wc -l < "$BASELINE" | tr -d ' ')

if [ "$NEW_COUNT" -gt 0 ]; then
  echo "" >&2
  echo "TYPE-CHECK FAIL — $NEW_COUNT new violation(s) vs baseline:" >&2
  echo "" >&2
  cat "$NEW" >&2
  echo "" >&2
  echo "(baseline: $BASELINE_COUNT known errors)" >&2
  exit 1
fi

if [ "$RESOLVED_COUNT" -gt 0 ]; then
  echo "INFO: $RESOLVED_COUNT baseline error(s) resolved — baseline 을 새로 고치는 것을 권장:"
  echo "  cd $BUILDER_DIR"
  echo "  pnpm exec tsc -p tsconfig.app.json --noEmit 2>&1 | grep 'error TS' | sort > $BASELINE"
fi

echo "TYPE-CHECK PASS — no new violations (baseline: $BASELINE_COUNT known errors)"

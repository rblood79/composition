#!/usr/bin/env bash
# agent dashboard — `pnpm agent:dashboard [--runs N] [--json] [--fresh]`
#
# 관측 표면 (Codex P5, 2026-08-27 paperthin·polysona 분석 — 보류 항목 착수 08-28). 원칙:
#   Observer 는 evidence 의 consumer — 새 truth 를 만들지 않는다. 자체 산출 점수·해시 없음.
#   모든 수치는 이미 있는 기록에서만 읽는다:
#     .agent/runs/*/run.json · evidence.jsonl   (run ledger — local-only)
#     git log                                   (fix/revert scope — fix-visibility.sh 의 집계 그대로)
#
# 표시 지표 (P5 목록 그대로):
#   1. 실행 중 run 의 phase · 허용 scope
#   2. gate 별 마지막 실행 시각 · status · exit
#   3. run 별 targeted test / live exercise / cross-check 존재 여부 + 미해결 block
#   4. 반복 fix scope 와 회귀 테스트 동반률
#   5. catalog drift 수 (마지막 catalog-gate 기록; --fresh 면 지금 실행)
#
# macOS bash 3.2 호환. jq 필요.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNS_DIR="${AGENT_RUNS_DIR:-$ROOT_DIR/.agent/runs}"
cd "$ROOT_DIR"

if [ "${1:-}" = "--" ]; then shift; fi
N=5; JSON=0; FRESH=0
while [ "$#" -gt 0 ]; do
  case "$1" in
    --runs) N="$2"; shift 2 ;;
    --json) JSON=1; shift ;;
    --fresh) FRESH=1; shift ;;
    -h|--help)
      cat <<'EOF'
agent dashboard — evidence 소비 전용 관측 (새 truth 없음)

  pnpm agent:dashboard [--runs N] [--json] [--fresh]
    --runs N   최근 N 개 run (기본 5)
    --json     기계용 출력 (섹션별 객체)
    --fresh    catalog gate 를 지금 실행해 drift 수를 갱신 (~2s)
EOF
      exit 0 ;;
    *) echo "[agent:dashboard] 알 수 없는 옵션 $1" >&2; exit 2 ;;
  esac
done
command -v jq >/dev/null 2>&1 || { echo "[agent:dashboard] jq 필요" >&2; exit 2; }

[ "$FRESH" = 1 ] && bash scripts/codex/agent-catalog-gate.sh >/dev/null 2>&1 || true

# ---------- 수집 ----------
CURRENT=""; [ -f "$RUNS_DIR/current" ] && CURRENT=$(cat "$RUNS_DIR/current")
RUN_IDS=$(ls -1 "$RUNS_DIR" 2>/dev/null | grep -v '^current$' | sort -r | head -"$N" || true)

# 모든 evidence (최근 N run) 를 run id 붙여 한 스트림으로
all_evidence() {
  local id
  for id in $RUN_IDS; do
    [ -s "$RUNS_DIR/$id/evidence.jsonl" ] || continue
    jq -c --arg run "$id" '. + {run: $run}' "$RUNS_DIR/$id/evidence.jsonl" 2>/dev/null || true
  done
}
EV=$(all_evidence)

# 1. 현재 run
CUR_JSON='null'
if [ -n "$CURRENT" ] && [ -f "$RUNS_DIR/$CURRENT/run.json" ]; then
  CUR_JSON=$(jq -c '{id, understoodAs, phase, scope, liveScenario, adr, startedAt, headAtStart}' "$RUNS_DIR/$CURRENT/run.json")
fi

# 2. gate 별 마지막 실행
GATES_JSON=$(printf '%s\n' "$EV" | jq -sc 'map(select(.kind != null)) | group_by(.kind) | map(max_by(.ts) | {kind, ts, status, exit, source, run, detail})' 2>/dev/null || echo '[]')

# 3. run 별 존재 여부
runs_json() {
  local id
  for id in $RUN_IDS; do
    [ -f "$RUNS_DIR/$id/run.json" ] || continue
    local ev="$RUNS_DIR/$id/evidence.jsonl"
    local vit live xc block
    vit=$(grep -c '"kind":"vitest","status":"pass"' "$ev" 2>/dev/null || true); vit=${vit:-0}
    live=$(grep -c '"kind":"live-exercise","status":"pass"' "$ev" 2>/dev/null || true); live=${live:-0}
    xc=$(grep -c '"kind":"cross-check","status":"pass"' "$ev" 2>/dev/null || true); xc=${xc:-0}
    # 미해결 block = kind 의 마지막 status 가 block
    block=$(jq -sr 'group_by(.kind) | map(select((last.status) == "block") | .[0].kind) | join(",")' "$ev" 2>/dev/null || true)
    jq -nc --arg id "$id" --arg vit "$vit" --arg live "$live" --arg xc "$xc" --arg block "$block" \
      --argjson run "$(jq -c '{result, phase: .phase.status, adr}' "$RUNS_DIR/$id/run.json")" \
      '$run + {id: $id, vitestPass: ($vit|tonumber), livePass: ($live|tonumber), crossCheckPass: ($xc|tonumber), openBlocks: ($block | split(",") | map(select(. != "")))}'
  done
}
RUNS_JSON=$(runs_json | jq -sc '.' 2>/dev/null || echo '[]')

# 4. fix scope — fix-visibility.sh 집계 재사용 (SessionStart 출력, 판정어 없음)
FIX_TEXT=$(printf '{"hook_event_name":"SessionStart"}' | CLAUDE_PROJECT_DIR="$ROOT_DIR" bash .claude/hooks/fix-visibility.sh 2>/dev/null || true)
FIX_JSON=$(printf '%s\n' "$FIX_TEXT" | awk '/fix · 회귀테스트 동반/ {scope=$1; cnt=$2; tc=$NF; printf "{\"scope\":\"%s\",\"fixes\":%s,\"withTest\":%s}\n", scope, cnt, tc}' | jq -sc '.' 2>/dev/null || echo '[]')

# 5. catalog drift — 마지막 catalog-gate 기록
DRIFT_LAST=$(printf '%s\n' "$EV" | jq -sc 'map(select(.kind == "catalog-gate")) | max_by(.ts) // null' 2>/dev/null || echo null)
DRIFT_JSON=null
if [ "$DRIFT_LAST" != null ] && [ -n "$DRIFT_LAST" ]; then
  DDET=$(printf '%s' "$DRIFT_LAST" | jq -r '.detail // ""')
  DF=$(printf '%s' "$DDET" | grep -oE 'FAIL [0-9]+' | awk '{print $2}'); DW=$(printf '%s' "$DDET" | grep -oE 'WARN [0-9]+' | awk '{print $2}')
  DRIFT_JSON=$(printf '%s' "$DRIFT_LAST" | jq -c --arg f "${DF:-}" --arg w "${DW:-}" '{ts, status, run, fail: (if $f == "" then null else ($f|tonumber) end), warn: (if $w == "" then null else ($w|tonumber) end)}')
fi

# ---------- 출력 ----------
if [ "$JSON" = 1 ]; then
  jq -nc --argjson cur "$CUR_JSON" --argjson gates "$GATES_JSON" --argjson runs "$RUNS_JSON" --argjson fix "$FIX_JSON" \
         --argjson drift "$DRIFT_JSON" \
    '{currentRun: $cur, gates: $gates, runs: $runs, fixScopes: $fix, catalogDrift: $drift}'
  exit 0
fi

echo "== agent dashboard ($(date -u +%Y-%m-%dT%H:%M:%SZ)) — evidence 소비 전용, 최근 ${N} run =="
echo
echo "## 1. 실행 중 run"
if [ "$CUR_JSON" = null ]; then
  echo "  (없음 — pnpm agent:work -- start --understood-as \"...\")"
else
  printf '%s' "$CUR_JSON" | jq -r '"  \(.id)\n  understood as: \(.understoodAs)\n  phase: \(.phase.current // "-") (\(.phase.status))  adr: \(.adr // "-")  head: \(.headAtStart)\n  scope include: \(.scope.include | join(", ") | if . == "" then "-" else . end)  exclude: \(.scope.exclude | join(", ") | if . == "" then "-" else . end)\n  live scenario: \(.liveScenario // "-")"'
fi
echo
echo "## 2. gate 별 마지막 실행"
if [ "$(printf '%s' "$GATES_JSON" | jq 'length')" = 0 ]; then echo "  (기록 없음)"; else
  printf '  %-16s %-6s %-5s %-20s %s\n' kind status exit ts source
  printf '%s' "$GATES_JSON" | jq -r '.[] | "\(.kind)\t\(.status)\t\(.exit // "-")\t\(.ts)\t\(.source)"' | awk -F'\t' '{printf "  %-16s %-6s %-5s %-20s %s\n", $1, $2, $3, $4, $5}'
fi
echo
echo "## 3. run 별 targeted test · live exercise · cross-check"
if [ "$(printf '%s' "$RUNS_JSON" | jq 'length')" = 0 ]; then echo "  (run 없음)"; else
  printf '  %-44s %-8s %-6s %-5s %-6s %s\n' run phase vitest live xcheck "open block"
  printf '%s' "$RUNS_JSON" | jq -r '.[] | "\(.id[0:44])\t\(.phase)\t\(.vitestPass)\t\(.livePass)\t\(.crossCheckPass)\t\(.openBlocks | join(",") | if . == "" then "-" else . end)"' | awk -F'\t' '{printf "  %-44s %-8s %-6s %-5s %-6s %s\n", $1, $2, $3, $4, $5, $6}'
fi
echo
echo "## 4. 반복 fix scope (최근 30일, 2회+) · 회귀 테스트 동반"
if [ -z "$FIX_TEXT" ]; then echo "  (2회+ scope 없음)"; else printf '%s\n' "$FIX_TEXT" | grep -v '^📊' | grep -v '→' | sed 's/^   /  /'; fi
echo
echo "## 5. catalog drift"
if [ "$DRIFT_JSON" = null ]; then echo "  (catalog-gate 기록 없음 — pnpm codex:agent-catalog 또는 --fresh)"; else
  printf '%s' "$DRIFT_JSON" | jq -r '"  FAIL \(.fail // "?") · WARN \(.warn // "?")  (\(.status), \(.ts))"'
fi

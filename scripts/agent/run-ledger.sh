#!/usr/bin/env bash
# Run manifest + evidence ledger (최소형) — `pnpm agent:run -- <cmd>`
#
# 한 작업(run) 의 "무엇으로 이해했나(understoodAs)" 와 "무엇을 실제로 실행·검증했나(evidence)"
# 를 local-only 로 남긴다. Claude Code 와 Codex 양쪽 hook/게이트가 같은 ledger 에 append 한다.
#
#   .agent/runs/<run-id>/run.json        — manifest (understoodAs / scope / skill·role / phase / gates / live scenario / uncertainty)
#   .agent/runs/<run-id>/evidence.jsonl  — append-only 사실 기록 (command · exit · target · artifact · pass/fail/skip+reason)
#   .agent/runs/<run-id>/artifacts/      — 스크린샷·로그 등
#   .agent/runs/current                  — 현재 run id (없으면 evidence 는 조용히 no-op → hook 에 노이즈 없음)
#
# Why (2026-08-27 paperthin·polysona 분석 병합 순서 ③ — Codex P1 스키마 + Claude P5):
#   ADR-144 (test/type-check PASS 로 Implemented 승격 → live 에서 미동작 → 34 commit revert) 와
#   polysona 의 해시 QA (`40 + hash % 56` 를 점수로 표시) 는 같은 클래스 — "검증했다" 가 실행 사실이
#   아니라 산문이었다. 완료 보고는 이 ledger 에서 나와야 한다. workflow runner (Codex P2) 는 이
#   최소형의 효용을 확인한 뒤 판단 (보류).
#
# 계약: `.agent/task-state.json` 의 goal/guard/stop 은 복제·자동 변경하지 않는다 — manifest 는 경로 +
#   sha256 만 참조 (read-only snapshot). macOS bash 3.2 호환.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
RUNS_DIR="${AGENT_RUNS_DIR:-$ROOT_DIR/.agent/runs}"
CURRENT_FILE="$RUNS_DIR/current"

if [ "${1:-}" = "--" ]; then shift; fi
CMD="${1:-help}"; [ "$#" -gt 0 ] && shift

now_iso() { date -u +%Y-%m-%dT%H:%M:%SZ; }
host_name() {
  if [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then echo claude
  elif [ -n "${CODEX_MISE_STATUS:-}" ] || [ -n "${CODEX_HOME:-}" ]; then echo codex
  else echo manual; fi
}
need_jq() { command -v jq >/dev/null 2>&1 || { echo "[agent:run] jq 필요" >&2; exit 2; }; }
current_id() { [ -f "$CURRENT_FILE" ] && cat "$CURRENT_FILE" || true; }
run_dir() { local id; id=$(current_id); if [ -n "$id" ]; then printf '%s/%s' "$RUNS_DIR" "$id"; fi; return 0; }
require_run() {
  local d; d=$(run_dir)
  if [ -z "$d" ] || [ ! -f "$d/run.json" ]; then echo "[agent:run] 진행 중인 run 없음 — 먼저 'start --understood-as \"...\"'" >&2; exit 2; fi
  printf '%s' "$d"
}
sha_of() { if command -v shasum >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'; else echo ""; fi; }
slug() { local v; v=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g' | cut -c1-40); printf '%s' "${v:-run}"; }

case "$CMD" in
  start)
    need_jq
    UNDERSTOOD=""; ADR=""; INCLUDE=""; EXCLUDE=""; SKILL=""; ROLE=""; LIVE=""; GATES=""
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --understood-as) UNDERSTOOD="$2"; shift 2 ;;
        --adr) ADR="$2"; shift 2 ;;
        --scope-include) INCLUDE="$2"; shift 2 ;;
        --scope-exclude) EXCLUDE="$2"; shift 2 ;;
        --skill) SKILL="$2"; shift 2 ;;
        --role) ROLE="$2"; shift 2 ;;
        --live) LIVE="$2"; shift 2 ;;
        --gates) GATES="$2"; shift 2 ;;
        *) echo "[agent:run] start: 알 수 없는 옵션 $1" >&2; exit 2 ;;
      esac
    done
    if [ -z "$UNDERSTOOD" ]; then
      echo "[agent:run] --understood-as \"<요청을 1줄로 재진술>\" 필수 (readchk — 잘못 이해했으면 여기서 드러난다)" >&2; exit 2
    fi
    ID="$(date +%Y%m%d-%H%M%S)-$(slug "${ADR:+adr-$ADR-}$UNDERSTOOD")"
    D="$RUNS_DIR/$ID"; mkdir -p "$D/artifacts"
    CONTRACT="$ROOT_DIR/.agent/task-state.json"
    CONTRACT_SHA=""; [ -f "$CONTRACT" ] && CONTRACT_SHA=$(sha_of "$CONTRACT")
    jq -n \
      --arg id "$ID" --arg ts "$(now_iso)" --arg host "$(host_name)" \
      --arg u "$UNDERSTOOD" --arg adr "$ADR" --arg inc "$INCLUDE" --arg exc "$EXCLUDE" \
      --arg skill "$SKILL" --arg role "$ROLE" --arg live "$LIVE" --arg gates "$GATES" \
      --arg cpath ".agent/task-state.json" --arg csha "$CONTRACT_SHA" \
      --arg head "$(git -C "$ROOT_DIR" rev-parse --short HEAD 2>/dev/null || echo unknown)" \
      '{
        id: $id, startedAt: $ts, endedAt: null, host: $host, headAtStart: $head,
        understoodAs: $u,
        adr: (if $adr == "" then null else $adr end),
        scope: { include: ($inc | split(",") | map(select(. != ""))), exclude: ($exc | split(",") | map(select(. != ""))) },
        skill: (if $skill == "" then null else $skill end),
        role: (if $role == "" then null else $role end),
        phase: { current: null, status: "started" },
        gates: { required: ($gates | split(",") | map(select(. != ""))) },
        liveScenario: (if $live == "" then null else $live end),
        uncertainty: [], residualRisk: [],
        contractRef: { path: $cpath, sha256: (if $csha == "" then null else $csha end), note: "read-only snapshot — goal/guard/stop 은 복제·자동 변경하지 않는다" },
        result: null
      }' > "$D/run.json"
    : > "$D/evidence.jsonl"
    printf '%s' "$ID" > "$CURRENT_FILE"
    echo "[agent:run] started $ID"
    echo "understood as: $UNDERSTOOD"
    ;;

  evidence)
    # evidence <kind> <status> [--detail t] [--cmd c] [--exit n] [--target t] [--artifact p] [--skip-reason r] [--gate-added g]
    # run 이 없으면 no-op (hook 노이즈 방지). --require 로 강제.
    KIND="${1:-}"; STATUS="${2:-}"; shift 2 2>/dev/null || { echo "[agent:run] evidence <kind> <pass|fail|skip|block|info> ..." >&2; exit 2; }
    DETAIL=""; ECMD=""; EXIT=""; TARGET=""; ARTIFACT=""; SKIP=""; GATE=""; REQUIRE=0
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --detail) DETAIL="$2"; shift 2 ;;
        --cmd) ECMD="$2"; shift 2 ;;
        --exit) EXIT="$2"; shift 2 ;;
        --target) TARGET="$2"; shift 2 ;;
        --artifact) ARTIFACT="$2"; shift 2 ;;
        --skip-reason) SKIP="$2"; shift 2 ;;
        --gate-added) GATE="$2"; shift 2 ;;
        --require) REQUIRE=1; shift ;;
        *) echo "[agent:run] evidence: 알 수 없는 옵션 $1" >&2; exit 2 ;;
      esac
    done
    case "$STATUS" in pass|fail|skip|block|info) ;; *) echo "[agent:run] status 는 pass|fail|skip|block|info" >&2; exit 2 ;; esac
    D=$(run_dir)
    if [ -z "$D" ] || [ ! -f "$D/run.json" ]; then
      [ "$REQUIRE" = 1 ] && { echo "[agent:run] 진행 중인 run 없음" >&2; exit 2; }
      exit 0
    fi
    need_jq
    jq -nc \
      --arg ts "$(now_iso)" --arg host "$(host_name)" --arg src "${AGENT_EVIDENCE_SOURCE:-cli}" \
      --arg kind "$KIND" --arg status "$STATUS" --arg detail "$DETAIL" --arg cmd "$ECMD" \
      --arg cwd "$(pwd)" --arg exit "$EXIT" --arg target "$TARGET" --arg artifact "$ARTIFACT" \
      --arg skip "$SKIP" --arg gate "$GATE" \
      '{ts: $ts, host: $host, source: $src, kind: $kind, status: $status,
        detail: (if $detail == "" then null else $detail end),
        cmd: (if $cmd == "" then null else $cmd end), cwd: $cwd,
        exit: (if $exit == "" then null else ($exit | tonumber) end),
        target: (if $target == "" then null else $target end),
        artifact: (if $artifact == "" then null else $artifact end),
        skipReason: (if $skip == "" then null else $skip end),
        gateAdded: (if $gate == "" then null else $gate end)}' >> "$D/evidence.jsonl"
    ;;

  phase)
    # phase <name> <status>   (status: started|verified|done|blocked)
    need_jq; D=$(require_run)
    tmp=$(mktemp); jq --arg n "${1:-}" --arg s "${2:-started}" '.phase = {current: $n, status: $s}' "$D/run.json" > "$tmp" && mv "$tmp" "$D/run.json"
    echo "[agent:run] phase ${1:-} → ${2:-started}"
    ;;

  note)
    # note uncertainty|risk "<text>"  — manifest 배열에 append
    need_jq; D=$(require_run)
    key=""; case "${1:-}" in uncertainty) key=uncertainty ;; risk) key=residualRisk ;; *) echo "[agent:run] note uncertainty|risk \"<text>\"" >&2; exit 2 ;; esac
    tmp=$(mktemp); jq --arg k "$key" --arg t "${2:-}" '.[$k] += [$t]' "$D/run.json" > "$tmp" && mv "$tmp" "$D/run.json"
    ;;

  status)
    need_jq
    D=$(run_dir)
    if [ -z "$D" ] || [ ! -f "$D/run.json" ]; then echo "[agent:run] 진행 중인 run 없음"; exit 0; fi
    jq -r '"run: \(.id)\nhost: \(.host)  head: \(.headAtStart)  started: \(.startedAt)\nunderstood as: \(.understoodAs)\nadr: \(.adr // "-")  phase: \(.phase.current // "-") (\(.phase.status))\nlive scenario: \(.liveScenario // "-")\nuncertainty: \(.uncertainty | length)  residual risk: \(.residualRisk | length)"' "$D/run.json"
    echo "evidence:"
    if [ -s "$D/evidence.jsonl" ]; then
      jq -r '"\(.kind)\t\(.status)"' "$D/evidence.jsonl" | sort | uniq -c | awk '{printf "  %-22s %-6s %s\n", $2, $3, $1}'
    else
      echo "  (없음)"
    fi
    ;;

  report)
    # 완료 보고용 markdown — ledger 에서 생성 (산문 주장 대신 실행 사실)
    need_jq; D=$(require_run)
    echo "## 실행 근거 (run $(jq -r .id "$D/run.json"))"
    echo
    echo "- understood as: $(jq -r .understoodAs "$D/run.json")"
    echo "- live scenario: $(jq -r '.liveScenario // "-"' "$D/run.json")"
    echo
    echo "| kind | status | detail | target | exit |"
    echo "| --- | --- | --- | --- | --- |"
    if [ -s "$D/evidence.jsonl" ]; then
      jq -r '"| \(.kind) | \(.status) | \(.detail // "") | \(.target // "") | \(.exit // "") |"' "$D/evidence.jsonl"
    fi
    LIVE_N=$(jq -c 'select(.kind == "live-exercise" and .status == "pass")' "$D/evidence.jsonl" 2>/dev/null | wc -l | tr -d ' ')
    echo
    echo "- live-exercise pass: ${LIVE_N}건$( [ "$LIVE_N" = 0 ] && echo ' — ⚠ live behavior 미기록 (CLAUDE.md §완료 기준)')"
    ;;

  close)
    need_jq; D=$(require_run)
    RESULT="${1:-}"
    tmp=$(mktemp); jq --arg ts "$(now_iso)" --arg r "$RESULT" '.endedAt = $ts | .result = (if $r == "" then null else $r end) | .phase.status = "closed"' "$D/run.json" > "$tmp" && mv "$tmp" "$D/run.json"
    rm -f "$CURRENT_FILE"
    echo "[agent:run] closed $(basename "$D") — evidence $(wc -l < "$D/evidence.jsonl" | tr -d ' ')건"
    ;;

  list)
    ls -1 "$RUNS_DIR" 2>/dev/null | grep -v '^current$' || true
    ;;

  has-live)
    # exit 0 ↔ 현재 run 에 live-exercise pass 기록이 있음 (hook 용)
    D=$(run_dir)
    [ -n "$D" ] && [ -s "$D/evidence.jsonl" ] && grep -q '"kind":"live-exercise","status":"pass"' "$D/evidence.jsonl"
    ;;

  help|-h|--help)
    cat <<'EOF'
agent run ledger (local-only, .agent/runs/):

  pnpm agent:run -- start --understood-as "<요청 1줄 재진술>" [--adr NNN] [--scope-include a,b] [--scope-exclude c]
                         [--skill s] [--role r] [--live "<live 시나리오>"] [--gates g1,g2]
  pnpm agent:run -- evidence <kind> <pass|fail|skip|block|info> [--detail t] [--cmd c] [--exit n]
                         [--target t] [--artifact p] [--skip-reason r] [--gate-added g]
        kind 예: typecheck · vitest · cross-check · live-exercise · preflight · catalog-gate · hook-selftest · adr-sync
  pnpm agent:run -- phase <name> <started|verified|done|blocked>
  pnpm agent:run -- note uncertainty|risk "<text>"
  pnpm agent:run -- status | report | close ["<result>"] | list | has-live

run 이 없으면 evidence 는 조용히 no-op — hook 은 항상 호출해도 된다.
EOF
    ;;
  *)
    echo "[agent:run] 알 수 없는 명령: $CMD (help 참조)" >&2; exit 2 ;;
esac

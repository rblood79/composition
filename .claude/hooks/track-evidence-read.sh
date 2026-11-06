#!/bin/bash
# PostToolUse Hook (Read matcher): 증거 파일을 실제로 열어 봤다는 사실을 run 에 남긴다.
#
# run ledger 의 `evidence live-exercise pass` 는 Claude 세션에서 증거 파일 (run 폴더 artifacts/ 안)
# 을 Read 한 기록을 요구한다. 이 hook 이 그 기록 (.agent/runs/<id>/evidence-reads.jsonl — 경로 ·
# 내용 지문 · 세션) 을 만든다. 판정은 하지 않는다 — 항상 exit 0, 출력 없음.
#
# Why (2026-11-06): `--artifact` 필수만으로는 "파일을 만들어 놓고 보지 않은 채 PASS" 가 가능하다.
#   ADR-144 (test PASS 로 승격 → live 에서 미동작 → 34 commit revert) 와 같은 종류 — 관찰이 아니라
#   기록이 PASS 를 만든다. 출처: anthropics/cwc-long-running-agents 의 track-read.sh + verify-gate.sh.
#
# 비용: run 이 없거나 대상이 artifacts/ 밖이면 jq · node 를 띄우기 전에 끝난다.

SCRIPT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
RUNS="${AGENT_RUNS_DIR:-$SCRIPT_ROOT/.agent/runs}"
[ -f "$RUNS/current" ] || exit 0
RUN="$RUNS/$(cat "$RUNS/current")"
[ -d "$RUN/artifacts" ] || exit 0

INPUT=$(cat)
case "$INPUT" in *artifacts/*) ;; *) exit 0 ;; esac   # 값싼 선별 — 정확한 판정은 evidence-state.mjs
command -v jq >/dev/null 2>&1 || exit 0
FILE=$(printf '%s' "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -n "$FILE" ] || exit 0
SESSION=$(printf '%s' "$INPUT" | jq -r '.session_id // empty' 2>/dev/null)

node "$SCRIPT_ROOT/scripts/agent/evidence-state.mjs" record-read "$RUN" "$FILE" "$SESSION" >/dev/null 2>&1 || true
exit 0

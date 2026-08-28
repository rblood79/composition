#!/usr/bin/env bash
# Hook self-test — `pnpm run hooks:selftest`
#
# .claude/settings.json 에 등록된 hook 마다 샘플 stdin JSON 을 넣고 기대 판정
# (permissionDecision / decision / 출력 유무 / flag 파일) 을 assert 한다.
#
# Why (2026-08-27 paperthin·polysona 분석 병합 순서 ①'):
#   polysona 의 hook 은 `type: bash` + 환경변수 계약으로 작성돼 Claude Code 의
#   `type: command` + stdin JSON 계약과 어긋나 **한 번도 동작하지 않은 채** 우승 리포에
#   남았다. hook 은 등록됐다는 사실이 아니라 "샘플 입력 → 기대 판정" 으로만 살아 있음을
#   증명한다 (feedback-infra-exists-vs-wired-consumption-path 와 같은 클래스).
#
# 격리: 임시 CLAUDE_PROJECT_DIR (flag/stat 기록 흡수) + 임시 git repo (adr-status-sync) +
#   transcript JSONL fixture. 실제 저장소·type-check·prettier(npx) 는 호출하지 않는다.
#
# macOS bash 3.2 호환.

set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOKS="$ROOT_DIR/.claude/hooks"
TMP="$(mktemp -d "${TMPDIR:-/tmp}/hook-selftest.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$TMP/proj/.claude" "$TMP/proj/docs/adr/design"

PASS=0
FAIL=0
CUR=""

case_start() { CUR="$1"; }
pass() { PASS=$((PASS + 1)); printf '  ✓ %s\n' "$CUR"; }
fail() { FAIL=$((FAIL + 1)); printf '  ✗ %s — %s\n' "$CUR" "$1"; }

# run_hook <hook.sh> <stdin-json> [ENV=VAL ...] → stdout 을 OUT 에, exit code 를 RC 에
OUT=""; RC=0
run_hook() {
  local hook="$1" json="$2"; shift 2
  OUT=$(printf '%s' "$json" | env CLAUDE_PROJECT_DIR="$TMP/proj" "$@" bash "$HOOKS/$hook" 2>/dev/null)
  RC=$?
}

decision_of() { printf '%s' "$OUT" | jq -r '.hookSpecificOutput.permissionDecision // empty' 2>/dev/null; }
assert_decision() {
  local want="$1" got; got=$(decision_of)
  if [ "$got" = "$want" ]; then pass; else fail "permissionDecision 기대 '$want', 실제 '${got:-<없음>}' (rc=$RC)"; fi
}
assert_allow() {   # 출력 없음 + exit 0 = 통과
  if [ -z "$OUT" ] && [ "$RC" -eq 0 ]; then pass; else fail "통과(빈 출력·exit 0) 기대, 실제 rc=$RC 출력=$(printf '%s' "$OUT" | head -c 120)"; fi
}
assert_contains() {
  local needle="$1"
  if printf '%s' "$OUT" | grep -qF -- "$needle"; then pass; else fail "출력에 '$needle' 없음 (rc=$RC): $(printf '%s' "$OUT" | head -c 160)"; fi
}
assert_not_contains() {
  local needle="$1"
  if printf '%s' "$OUT" | grep -qF -- "$needle"; then fail "출력에 '$needle' 가 있으면 안 됨"; else pass; fi
}
assert_block() {
  local got; got=$(printf '%s' "$OUT" | jq -r '.decision // empty' 2>/dev/null)
  if [ "$got" = "block" ]; then pass; else fail "decision 기대 'block', 실제 '${got:-<없음>}' (rc=$RC)"; fi
}

tool_json() {  # tool_json <tool_name> <json-fragment for tool_input> [transcript_path]
  if [ -n "${3:-}" ]; then
    printf '{"hook_event_name":"PreToolUse","tool_name":"%s","tool_input":%s,"transcript_path":"%s"}' "$1" "$2" "$3"
  else
    printf '{"hook_event_name":"PreToolUse","tool_name":"%s","tool_input":%s}' "$1" "$2"
  fi
}
transcript() {  # transcript <file> <user message...>  (userType=external, content=string)
  local f="$1"; shift
  : > "$f"
  local m
  for m in "$@"; do
    jq -nc --arg c "$m" '{type:"user",userType:"external",message:{content:$c}}' >> "$f"
  done
}

printf 'hook selftest — %s\n' "$HOOKS"

# ---------- protect-files.sh (PreToolUse Edit|Write) ----------
printf '\n== protect-files.sh ==\n'
case_start "보호 파일 .env → deny"
run_hook protect-files.sh "$(tool_json Write '{"file_path":"/x/app/.env"}')"; assert_decision deny
case_start "vite-env.d.ts 는 오탐 아님 (2026-07-17 회귀) → 통과"
run_hook protect-files.sh "$(tool_json Edit '{"file_path":"/x/app/src/vite-env.d.ts"}')"; assert_allow
case_start "file_path 없음 → 통과"
run_hook protect-files.sh "$(tool_json Bash '{"command":"ls"}')"; assert_allow

# ---------- derived-adr-block.sh (PreToolUse Edit|Write) ----------
printf '\n== derived-adr-block.sh ==\n'
T_YES="$TMP/t-adr-yes.jsonl"; T_NO="$TMP/t-adr-no.jsonl"
transcript "$T_YES" "ADR-195 리뷰 반영해줘" "새 ADR 생성해줘 — 명령 팔레트"
transcript "$T_NO" "ADR-195 Phase 1 진행 중이야" "테스트 돌려봐"
NEW_ADR="$TMP/proj/docs/adr/999-selftest.md"
case_start "신규 ADR + 사용자 명시 요청 transcript → 통과"
run_hook derived-adr-block.sh "$(tool_json Write "{\"file_path\":\"$NEW_ADR\"}" "$T_YES")"; assert_allow
case_start "신규 ADR + 요청 없음 → ask"
run_hook derived-adr-block.sh "$(tool_json Write "{\"file_path\":\"$NEW_ADR\"}" "$T_NO")"; assert_decision ask
case_start "신규 ADR + transcript 없음 → ask"
run_hook derived-adr-block.sh "$(tool_json Write "{\"file_path\":\"$NEW_ADR\"}")"; assert_decision ask
case_start "기존 ADR 수정 → 통과"
printf '# ADR\n' > "$NEW_ADR"
run_hook derived-adr-block.sh "$(tool_json Edit "{\"file_path\":\"$NEW_ADR\"}" "$T_NO")"; assert_allow
rm -f "$NEW_ADR"
case_start "design/ 하위 → 통과"
run_hook derived-adr-block.sh "$(tool_json Write "{\"file_path\":\"$TMP/proj/docs/adr/design/999-breakdown.md\"}" "$T_NO")"; assert_allow

# ---------- protect-branch-pr.sh (PreToolUse Bash) ----------
printf '\n== protect-branch-pr.sh ==\n'
T_PR="$TMP/t-pr.jsonl"; transcript "$T_PR" "이번 건은 PR 생성해줘"
case_start "git push origin main → 통과"
run_hook protect-branch-pr.sh "$(tool_json Bash '{"command":"git push origin main"}' "$T_NO")"; assert_allow
case_start "gh pr create + 요청 없음 → deny"
run_hook protect-branch-pr.sh "$(tool_json Bash '{"command":"gh pr create --fill"}' "$T_NO")"; assert_decision deny
case_start "gh pr create + 사용자 'PR 생성해줘' → 통과"
run_hook protect-branch-pr.sh "$(tool_json Bash '{"command":"gh pr create --fill"}' "$T_PR")"; assert_allow
case_start "git checkout -b feature/x + transcript 없음 → ask"
run_hook protect-branch-pr.sh "$(tool_json Bash '{"command":"git checkout -b feature/x"}')"; assert_decision ask
case_start "git push origin feature/x + 요청 없음 → deny"
run_hook protect-branch-pr.sh "$(tool_json Bash '{"command":"git push -u origin feature/x"}' "$T_NO")"; assert_decision deny
case_start "git checkout main (기존 branch 전환) → 통과"
run_hook protect-branch-pr.sh "$(tool_json Bash '{"command":"git checkout main"}' "$T_NO")"; assert_allow

# ---------- protect-commit-vocabulary.sh (PreToolUse Bash) ----------
printf '\n== protect-commit-vocabulary.sh ==\n'
case_start "커밋 메시지 '발효' → deny"
run_hook protect-commit-vocabulary.sh "$(tool_json Bash '{"command":"git commit -m \"feat: catalog 발효\""}')"; assert_decision deny
case_start "커밋 메시지 '전환' → 통과"
run_hook protect-commit-vocabulary.sh "$(tool_json Bash '{"command":"git commit -m \"feat: catalog 전환\""}')"; assert_allow
case_start "commit 아닌 git 명령에 어휘 → 통과"
run_hook protect-commit-vocabulary.sh "$(tool_json Bash '{"command":"git log --grep 발효"}')"; assert_allow

# ---------- spec-rebuild-flag.sh (PostToolUse Edit|Write) ----------
printf '\n== spec-rebuild-flag.sh ==\n'
SPEC_FLAG="$TMP/proj/.claude/.spec-rebuild-pending"; CSS_FLAG="$TMP/proj/.claude/.css-regen-pending"
case_start "packages/specs/src 편집 → .spec-rebuild-pending 생성"
rm -f "$SPEC_FLAG" "$CSS_FLAG"
run_hook spec-rebuild-flag.sh "$(tool_json Edit '{"file_path":"/r/packages/specs/src/components/Frame.spec.ts"}')"
if [ -f "$SPEC_FLAG" ] && [ ! -f "$CSS_FLAG" ]; then pass; else fail "spec flag=$([ -f "$SPEC_FLAG" ] && echo 1 || echo 0) css flag=$([ -f "$CSS_FLAG" ] && echo 1 || echo 0)"; fi
case_start "packages/shared/src/catalog 편집 → .css-regen-pending 생성"
rm -f "$SPEC_FLAG" "$CSS_FLAG"
run_hook spec-rebuild-flag.sh "$(tool_json Edit '{"file_path":"/r/packages/shared/src/catalog/generated/componentRulesTable.ts"}')"
if [ -f "$CSS_FLAG" ] && [ ! -f "$SPEC_FLAG" ]; then pass; else fail "css flag 기대"; fi
case_start "generated CSS 산출물 편집 → flag 없음 (무한 루프 방지)"
rm -f "$SPEC_FLAG" "$CSS_FLAG"
run_hook spec-rebuild-flag.sh "$(tool_json Edit '{"file_path":"/r/packages/shared/src/components/styles/generated/button.css"}')"
if [ ! -f "$CSS_FLAG" ] && [ ! -f "$SPEC_FLAG" ]; then pass; else fail "flag 가 생기면 안 됨"; fi

# ---------- route-prompt.sh (UserPromptSubmit) ----------
printf '\n== route-prompt.sh ==\n'
prompt_json() { jq -nc --arg p "$1" '{hook_event_name:"UserPromptSubmit",prompt:$p}'; }
case_start "'렌더링 버그' → cross-check + debugger 힌트"
run_hook route-prompt.sh "$(prompt_json '캔버스 렌더링 버그 고쳐줘')"; assert_contains '/cross-check'
case_start "  (동일 입력) debugger"
assert_contains 'debugger'
case_start "'ADR-195 다음 Phase 실행' → execute-adr"
run_hook route-prompt.sh "$(prompt_json 'ADR-195 다음 Phase 실행해줘')"; assert_contains 'execute-adr'
case_start "'ADR-195 리뷰' → review-adr, execute-adr 아님"
run_hook route-prompt.sh "$(prompt_json 'ADR-195 리뷰해줘')"; assert_contains 'review-adr'
case_start "  (동일 입력) execute-adr 미주입"
assert_not_contains 'execute-adr'
case_start "'ADR 생성해줘' → create-adr 사용자 전용 안내"
run_hook route-prompt.sh "$(prompt_json '명령 팔레트 ADR 생성해줘')"; assert_contains '사용자 전용'
case_start "인사말 → 힌트 없음"
run_hook route-prompt.sh "$(prompt_json '안녕하세요')"; assert_allow

# ---------- session-start.sh / precompact-snapshot.sh / type-check-gate.sh ----------
printf '\n== session-start.sh · precompact-snapshot.sh · type-check-gate.sh ==\n'
case_start "session-start → roster 블록 출력"
run_hook session-start.sh '{"hook_event_name":"SessionStart"}'; assert_contains '<composition-workflow-roster>'
case_start "precompact-snapshot → 스냅샷 헤더 출력"
run_hook precompact-snapshot.sh '{"hook_event_name":"PreCompact"}'; assert_contains '=== PreCompact Context Snapshot ==='
case_start "type-check-gate 재진입 가드 (STOP_HOOK_ACTIVE=true) → 통과"
run_hook type-check-gate.sh '{"hook_event_name":"Stop"}' STOP_HOOK_ACTIVE=true; assert_allow

# ---------- adr-status-sync-check.sh (Stop) — 임시 git repo ----------
printf '\n== adr-status-sync-check.sh ==\n'
REPO="$TMP/repo"; RUNS="$TMP/runs"; mkdir -p "$REPO/docs/adr" "$REPO/.claude" "$RUNS"
(
  cd "$REPO" && git init -q && git -c user.name=t -c user.email=t@t config commit.gpgsign false
  printf '# ADR-100\n\n## Status\n\nAccepted\n' > docs/adr/100-x.md
  printf '# README\n' > docs/adr/README.md
  printf '# CHANGELOG\n' > docs/CHANGELOG.md
  git add -A && git -c user.name=t -c user.email=t@t commit -qm init
) >/dev/null 2>&1
run_in_repo() {  # run_in_repo <stdin> [ENV=VAL...]
  local json="$1"; shift
  OUT=$(cd "$REPO" && printf '%s' "$json" | env CLAUDE_PROJECT_DIR="$REPO" AGENT_RUNS_DIR="$RUNS" "$@" bash "$HOOKS/adr-status-sync-check.sh" 2>/dev/null); RC=$?
}
adr_body() { printf '# ADR-100\n\n## Status\n\n%s\n' "$1" > "$REPO/docs/adr/100-x.md"; }
LIVE_SEC=$'Implemented\n\n### Live Exercise\n\n- 2026-08-28 builder 5173 팔레트 실행 12건 확인 (Chrome MCP)'
sync_docs() { printf '# README\n- 100\n' > "$REPO/docs/adr/README.md"; printf '# CHANGELOG\n- 100\n' > "$REPO/docs/CHANGELOG.md"; }
reset_docs() { printf '# README\n' > "$REPO/docs/adr/README.md"; printf '# CHANGELOG\n' > "$REPO/docs/CHANGELOG.md"; }
LEDGER="$ROOT_DIR/scripts/agent/run-ledger.sh"

case_start "승격 + README/CHANGELOG 미갱신 + Live 없음 → block"
adr_body Implemented; run_in_repo '{"hook_event_name":"Stop"}'; assert_block
case_start "  (block 시) stats/hook-blocks.jsonl 기록"
if [ -s "$REPO/.claude/stats/hook-blocks.jsonl" ]; then pass; else fail "기록 없음"; fi
case_start "승격 + 동시 갱신 + Live Exercise 없음 → block (live 근거 필수)"
sync_docs; run_in_repo '{"hook_event_name":"Stop"}'; assert_block
case_start "  block 사유에 'Live Exercise' 안내"
if printf '%s' "$OUT" | jq -r '.reason' 2>/dev/null | grep -q 'Live Exercise'; then pass; else fail "사유에 Live Exercise 없음"; fi
case_start "승격 + 동시 갱신 + ### Live Exercise 절 → 통과"
adr_body "$LIVE_SEC"; run_in_repo '{"hook_event_name":"Stop"}'; assert_allow
case_start "승격 + 동시 갱신 + docs/adr/evidence/100-live-*.md → 통과"
adr_body Implemented; mkdir -p "$REPO/docs/adr/evidence"; : > "$REPO/docs/adr/evidence/100-live-exercise.md"
run_in_repo '{"hook_event_name":"Stop"}'; assert_allow; rm -rf "$REPO/docs/adr/evidence"
case_start "승격 + 동시 갱신 + run ledger live-exercise pass → 통과"
AGENT_RUNS_DIR="$RUNS" bash "$LEDGER" start --understood-as "selftest run" >/dev/null 2>&1
AGENT_RUNS_DIR="$RUNS" bash "$LEDGER" evidence live-exercise pass --detail "selftest" >/dev/null 2>&1
run_in_repo '{"hook_event_name":"Stop"}'; assert_allow
case_start "  (통과 시) ledger 에 adr-sync pass 기록"
if grep -q '"kind":"adr-sync","status":"pass"' "$RUNS/$(cat "$RUNS/current")/evidence.jsonl"; then pass; else fail "adr-sync pass 미기록"; fi
AGENT_RUNS_DIR="$RUNS" bash "$LEDGER" close >/dev/null 2>&1
case_start "escape ADR_SPLIT_COMMIT=1 + Live 절 → 통과 (README/CHANGELOG 미갱신)"
reset_docs; adr_body "$LIVE_SEC"; run_in_repo '{"hook_event_name":"Stop"}' ADR_SPLIT_COMMIT=1; assert_allow
case_start "escape ADR_SPLIT_COMMIT=1 + Live 없음 → block (live 는 우회 불가)"
adr_body Implemented; run_in_repo '{"hook_event_name":"Stop"}' ADR_SPLIT_COMMIT=1; assert_block
case_start "ADR 변경 없음 → 통과"
(cd "$REPO" && git checkout -q -- docs/adr/100-x.md)
run_in_repo '{"hook_event_name":"Stop"}'; assert_allow

# ---------- run-ledger.sh (scripts/agent) — manifest + evidence ----------
printf '\n== run-ledger.sh (pnpm agent:run) ==\n'
RUNS2="$TMP/runs2"; mkdir -p "$RUNS2"
led() { OUT=$(AGENT_RUNS_DIR="$RUNS2" bash "$LEDGER" "$@" 2>&1); RC=$?; }
case_start "run 없이 evidence → 조용한 no-op (exit 0)"
led evidence typecheck pass; assert_allow
case_start "start 에 --understood-as 없음 → exit 2"
led start; if [ "$RC" -eq 2 ]; then pass; else fail "rc=$RC"; fi
case_start "start → run.json + 'understood as:' 출력"
led start --understood-as "ADR-999 P1 을 auto 로 실행" --adr 999 --live "builder 에서 X 확인"; assert_contains "understood as: ADR-999 P1 을 auto 로 실행"
case_start "  run.json 에 understoodAs·contractRef"
RID=$(cat "$RUNS2/current")
if jq -e '.understoodAs == "ADR-999 P1 을 auto 로 실행" and .adr == "999" and .contractRef.path == ".agent/task-state.json"' "$RUNS2/$RID/run.json" >/dev/null 2>&1; then pass; else fail "run.json 필드 불일치"; fi
case_start "has-live (기록 없음) → exit 1"
led has-live; if [ "$RC" -ne 0 ]; then pass; else fail "rc=0"; fi
case_start "evidence live-exercise pass → has-live exit 0"
led evidence live-exercise pass --detail "팔레트 12건" --artifact "artifacts/x.png"; led has-live; if [ "$RC" -eq 0 ]; then pass; else fail "rc=$RC"; fi
case_start "evidence 잘못된 status → exit 2"
led evidence typecheck maybe; if [ "$RC" -eq 2 ]; then pass; else fail "rc=$RC"; fi
case_start "status 에 evidence 집계"
led status; assert_contains "live-exercise"
case_start "report 에 live-exercise pass 1건"
led report; assert_contains "live-exercise pass: 1건"
case_start "close → current 제거 + endedAt"
led close "done"; if [ ! -f "$RUNS2/current" ] && jq -e '.endedAt != null and .result == "done"' "$RUNS2/$RID/run.json" >/dev/null 2>&1; then pass; else fail "close 미반영"; fi

# ---------- work.sh (scripts/agent) — scope 기반 verify · close 게이트 ----------
printf '\n== work.sh (pnpm agent:work) ==\n'
WORK="$ROOT_DIR/scripts/agent/work.sh"; RUNS3="$TMP/runs3"; mkdir -p "$RUNS3"
wk() { OUT=$(AGENT_RUNS_DIR="$RUNS3" bash "$WORK" "$@" 2>&1); RC=$?; }
case_start "verify (run 없음) → exit 2"
wk verify --files docs/a.md; if [ "$RC" -eq 2 ]; then pass; else fail "rc=$RC"; fi
case_start "verify --dry-run 은 run 없이 계획만 (exit 0)"
wk verify --dry-run --files apps/builder/src/builder/factories/x.ts; if [ "$RC" -eq 0 ] && printf '%s' "$OUT" | grep -q 'live-exercise  plan'; then pass; else fail "rc=$RC"; fi
case_start "start → scope 요약 출력"
wk start --understood-as "selftest work"; assert_contains "scope: 변경 파일"
case_start "docs-only verify → 전부 skip, exit 0"
wk verify --files docs/a.md,.claude/rules/x.md; if [ "$RC" -eq 0 ] && printf '%s' "$OUT" | grep -q 'docs/scripts 만 변경'; then pass; else fail "rc=$RC"; fi
case_start "사용자-가시·render 경로 verify → cross-check/live block, exit 3"
wk verify --skip-exec --files apps/builder/src/builder/factories/x.ts,apps/builder/src/builder/workspace/canvas/skia/y.ts
if [ "$RC" -eq 3 ] && printf '%s' "$OUT" | grep -q 'block 2'; then pass; else fail "rc=$RC"; fi
case_start "  ledger 에 live-exercise block · cross-check block 기록"
if grep -q '"kind":"live-exercise","status":"block"' "$RUNS3/$(cat "$RUNS3/current")/evidence.jsonl" && grep -q '"kind":"cross-check","status":"block"' "$RUNS3/$(cat "$RUNS3/current")/evidence.jsonl"; then pass; else fail "block 미기록"; fi
case_start "close (block 미해결) → 거부 exit 3"
wk close "x"; if [ "$RC" -eq 3 ] && printf '%s' "$OUT" | grep -q 'close 거부'; then pass; else fail "rc=$RC"; fi
case_start "evidence cross-check pass + live-exercise pass → verify 통과 exit 0"
AGENT_RUNS_DIR="$RUNS3" bash "$LEDGER" evidence cross-check pass --detail selftest >/dev/null 2>&1
AGENT_RUNS_DIR="$RUNS3" bash "$LEDGER" evidence live-exercise pass --detail selftest >/dev/null 2>&1
wk verify --skip-exec --files apps/builder/src/builder/factories/x.ts,apps/builder/src/builder/workspace/canvas/skia/y.ts; if [ "$RC" -eq 0 ]; then pass; else fail "rc=$RC"; fi
case_start "--no-live → 사람 단계 skip"
wk verify --skip-exec --no-live --files apps/builder/src/builder/factories/x.ts; if [ "$RC" -eq 0 ] && printf '%s' "$OUT" | grep -q 'live-exercise  skip   --no-live'; then pass; else fail "rc=$RC"; fi
case_start "close → report + closed"
wk close "selftest done"; if [ "$RC" -eq 0 ] && printf '%s' "$OUT" | grep -q 'live-exercise pass: 1건' && [ ! -f "$RUNS3/current" ]; then pass; else fail "rc=$RC"; fi
case_start "resume <id> → current 복구 + phase resumed"
WID=$(ls "$RUNS3" | grep -v '^current$' | head -1); wk resume "$WID"
if [ "$RC" -eq 0 ] && [ "$(cat "$RUNS3/current")" = "$WID" ] && jq -e '.phase.status == "resumed" and .endedAt == null' "$RUNS3/$WID/run.json" >/dev/null 2>&1; then pass; else fail "rc=$RC"; fi
case_start "close --force (fail 기록 있어도) → close-override 기록"
AGENT_RUNS_DIR="$RUNS3" bash "$LEDGER" evidence typecheck fail --exit 1 >/dev/null 2>&1
wk close "forced" --force; if [ "$RC" -eq 0 ] && grep -q '"kind":"close-override"' "$RUNS3/$WID/evidence.jsonl"; then pass; else fail "rc=$RC"; fi

# ---------- dashboard.sh (scripts/agent) — evidence 소비 전용 ----------
printf '\n== dashboard.sh (pnpm agent:dashboard) ==\n'
DASH="$ROOT_DIR/scripts/agent/dashboard.sh"; RUNS4="$TMP/runs4"; STATS4="$TMP/stats4"; mkdir -p "$RUNS4" "$STATS4"
dsh() { OUT=$(AGENT_RUNS_DIR="$RUNS4" AGENT_STATS_DIR="$STATS4" bash "$DASH" "$@" 2>&1); RC=$?; }
case_start "기록 0 → 모든 섹션 '없음', exit 0"
dsh; if [ "$RC" -eq 0 ] && printf '%s' "$OUT" | grep -q 'run 없음' && printf '%s' "$OUT" | grep -q 'adr-drift: (기록 없음)'; then pass; else fail "rc=$RC"; fi
case_start "run + catalog-gate 기록 → 현재 run · gate 표 · drift FAIL/WARN 파싱"
AGENT_RUNS_DIR="$RUNS4" bash "$LEDGER" start --understood-as "dashboard selftest" --live "builder X" >/dev/null 2>&1
AGENT_RUNS_DIR="$RUNS4" bash "$LEDGER" evidence catalog-gate pass --detail "FAIL 0 WARN 2" >/dev/null 2>&1
AGENT_RUNS_DIR="$RUNS4" bash "$LEDGER" evidence live-exercise block --detail "x" >/dev/null 2>&1
printf '{"ts":"2026-08-28T00:00:00Z","hook":"adr-status-sync-check","action":"block"}\n{"ts":"2026-08-28T00:00:01Z","hook":"adr-status-sync-check","action":"escape"}\n' > "$STATS4/hook-blocks.jsonl"
dsh; if [ "$RC" -eq 0 ] && printf '%s' "$OUT" | grep -q 'understood as: dashboard selftest' && printf '%s' "$OUT" | grep -q 'FAIL 0 · WARN 2' && printf '%s' "$OUT" | grep -q 'escape 비율 50%'; then pass; else fail "rc=$RC"; fi
case_start "  미해결 block 이 run 행에 표시"
if printf '%s' "$OUT" | grep -q 'live-exercise$'; then pass; else fail "open block 미표시"; fi
case_start "--json → 7 키 객체"
dsh --json; if [ "$RC" -eq 0 ] && [ "$(printf '%s' "$OUT" | jq 'keys | length' 2>/dev/null)" = 7 ] && [ "$(printf '%s' "$OUT" | jq '.catalogDrift.warn')" = 2 ]; then pass; else fail "rc=$RC"; fi
AGENT_RUNS_DIR="$RUNS4" bash "$LEDGER" close >/dev/null 2>&1

# ---------- auto-format.sh (PostToolUse) ----------
printf '\n== auto-format.sh ==\n'
case_start "포맷 대상 아닌 확장자 → 통과 (prettier 미호출)"
run_hook auto-format.sh "$(tool_json Write "{\"file_path\":\"$TMP/proj/x.txt\"}")"; assert_allow
case_start "file_path 없음 → 통과"
run_hook auto-format.sh "$(tool_json Bash '{"command":"ls"}')"; assert_allow

# ---------- fix-visibility.sh — 기존 회귀 테스트 위임 ----------
printf '\n== fix-visibility.test.sh ==\n'
case_start "fix-visibility 회귀 (Stop JSON · SessionStart plain)"
if bash "$HOOKS/fix-visibility.test.sh" >/dev/null 2>&1; then pass; else fail "fix-visibility.test.sh 실패"; fi

# ---------- summary ----------
printf '\n== 결과 == PASS %d · FAIL %d\n' "$PASS" "$FAIL"
[ -x "$LEDGER" ] && AGENT_EVIDENCE_SOURCE=selftest.sh bash "$LEDGER" evidence hook-selftest "$([ "$FAIL" -gt 0 ] && echo fail || echo pass)" --detail "PASS $PASS FAIL $FAIL" --cmd "pnpm hooks:selftest" >/dev/null 2>&1 || true
if [ "$FAIL" -gt 0 ]; then
  echo "[hooks:selftest] 실패 — hook 이 등록은 됐지만 기대 판정을 내지 않습니다."
  exit 1
fi
echo "[hooks:selftest] 통과"

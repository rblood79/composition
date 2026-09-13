#!/usr/bin/env bash
# Codex lifecycle hook contract self-test.
#
# Paperthin·Polysona 병합 순서 1': hook은 존재만 확인하지 않고 Codex stdin JSON으로
# 실제 분기를 exercise한다. 임시 git workspace와 fake pnpm을 사용하므로 제품 파일과
# 실제 build cache는 변경하지 않는다. macOS bash 3.2 호환.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HOOKS_DIR="$ROOT_DIR/.codex/hooks"
LEDGER="$ROOT_DIR/scripts/agent/run-ledger.sh"
PASS=0
FAIL=0

pass() {
  PASS=$((PASS + 1))
  printf '  ✓ %s\n' "$1"
}

fail() {
  FAIL=$((FAIL + 1))
  printf '  ✗ %s\n' "$1"
}

assert_contains() {
  local label="$1" haystack="$2" needle="$3"
  if printf '%s' "$haystack" | grep -Fq "$needle"; then
    pass "$label"
  else
    fail "$label — 누락: $needle"
  fi
}

hook_command() {
  local event="$1" script="$2"
  jq -r --arg event "$event" --arg script "$script" \
    '[.hooks[$event][]?.hooks[]? | select(.type == "command" and (.command | contains($script))) | .command][0] // empty' \
    "$ROOT_DIR/.codex/hooks.json"
}

TMP_ROOT=$(mktemp -d "${TMPDIR:-/tmp}/composition-codex-hook-selftest.XXXXXX")
cleanup() {
  [ -n "${TMP_ROOT:-}" ] && [ -d "$TMP_ROOT" ] && rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

printf '== Codex hooks.json contract ==\n'
CONFIG_AUDIT=$(node "$ROOT_DIR/scripts/codex/hook-config-audit.mjs" "$ROOT_DIR")
if printf '%s\n' "$CONFIG_AUDIT" | grep -q '^ERROR'; then
  while IFS=$'\t' read -r kind detail; do
    [ "$kind" = ERROR ] && fail "hooks.json — $detail"
  done <<< "$CONFIG_AUDIT"
else
  pass "hooks.json event·type·경로·실행권한 ($(printf '%s\n' "$CONFIG_AUDIT" | awk -F'\t' '$1 == "COUNT" {print $2}') handlers)"
fi

printf '\n== 자동 주입·전체 Stop 검사 미등록 ==\n'
if jq -e '(.hooks | has("SessionStart") or has("UserPromptSubmit") or has("Stop")) | not' "$ROOT_DIR/.codex/hooks.json" >/dev/null; then
  pass "중복 prompt 주입과 전체 dirty 검사 미등록"
else
  fail "불필요한 자동 이벤트 등록"
fi

printf '\n== PreToolUse protected-file hook ==\n'
PROTECT_COMMAND=$(hook_command PreToolUse protect-files.sh)
PROTECT_INPUT=$(jq -nc --arg cwd "$ROOT_DIR" --arg command $'*** Begin Patch\n*** Update File: .env.local\n*** End Patch' '{cwd:$cwd,tool_name:"apply_patch",tool_input:{command:$command}}')
PROTECT_OUT=$(printf '%s' "$PROTECT_INPUT" | (cd "$ROOT_DIR" && /bin/bash -c "$PROTECT_COMMAND") 2>&1 || true)
if printf '%s' "$PROTECT_OUT" | jq -e '.hookSpecificOutput.permissionDecision == "deny"' >/dev/null 2>&1; then
  pass "보호 파일 patch 차단"
else
  fail "보호 파일 patch 차단 — deny JSON 없음"
fi

NORMAL_INPUT=$(jq -nc --arg cwd "$ROOT_DIR" --arg command $'*** Begin Patch\n*** Update File: docs/example.md\n*** End Patch' '{cwd:$cwd,tool_name:"apply_patch",tool_input:{command:$command}}')
NORMAL_OUT=$(printf '%s' "$NORMAL_INPUT" | (cd "$ROOT_DIR" && /bin/bash -c "$PROTECT_COMMAND") 2>&1 || true)
if [ -z "$NORMAL_OUT" ]; then pass "일반 파일 patch 허용"; else fail "일반 파일 patch가 출력/차단됨"; fi

printf '\n== 수동 spec flag adapter 호환 ==\n'
FAKE_PROJECT="$TMP_ROOT/project"
mkdir -p "$FAKE_PROJECT/.codex"
SPEC_COMMAND="bash \"$HOOKS_DIR/spec-rebuild-flag.sh\""
SPEC_INPUT=$(jq -nc --arg cwd "$FAKE_PROJECT" --arg command $'*** Begin Patch\n*** Update File: packages/specs/src/example.ts\n*** End Patch' '{cwd:$cwd,tool_name:"apply_patch",tool_input:{command:$command}}')
printf '%s' "$SPEC_INPUT" | (cd "$ROOT_DIR" && /bin/bash -c "$SPEC_COMMAND")
if [ -f "$FAKE_PROJECT/.codex/.spec-rebuild-pending" ]; then pass "spec patch가 rebuild flag 생성"; else fail "spec rebuild flag 미생성"; fi

printf '\n== 수동 type-check adapter + evidence ledger 호환 ==\n'
TEST_REPO="$TMP_ROOT/typecheck-repo"
FAKE_BIN="$TMP_ROOT/bin"
RUNS_DIR="$TMP_ROOT/runs"
mkdir -p "$TEST_REPO/.codex" "$TEST_REPO/nested" "$TEST_REPO/scripts" "$FAKE_BIN" "$RUNS_DIR"
ln -s "$HOOKS_DIR" "$TEST_REPO/.codex/hooks"
ln -s "$ROOT_DIR/scripts/codex" "$TEST_REPO/scripts/codex"
ln -s "$ROOT_DIR/scripts/agent" "$TEST_REPO/scripts/agent"
git -C "$TEST_REPO" init -q
printf 'export const sample = 1;\n' > "$TEST_REPO/sample.ts"
FAKE_PNPM_CONTENT='#!/usr/bin/env bash
case "$*" in
  *build:specs*) exit "${FAKE_BUILD_RC:-0}" ;;
  *type-check*) exit "${FAKE_TYPECHECK_RC:-0}" ;;
  *) exit 0 ;;
esac'
printf '%s\n' "$FAKE_PNPM_CONTENT" > "$FAKE_BIN/pnpm"
chmod +x "$FAKE_BIN/pnpm"

AGENT_RUNS_DIR="$RUNS_DIR" CODEX_HOME="$TMP_ROOT/codex-home" bash "$LEDGER" start --understood-as "codex hook selftest" >/dev/null
touch "$TEST_REPO/.codex/.spec-rebuild-pending"
STOP_INPUT=$(jq -nc --arg cwd "$TEST_REPO/nested" '{cwd:$cwd,hook_event_name:"Stop"}')
STOP_COMMAND="bash \"$HOOKS_DIR/type-check-gate.sh\""
STOP_OUT=$(printf '%s' "$STOP_INPUT" | (cd "$TEST_REPO/nested" && env PATH="$FAKE_BIN:$PATH" AGENT_RUNS_DIR="$RUNS_DIR" CODEX_HOME="$TMP_ROOT/codex-home" /bin/bash -c "$STOP_COMMAND") 2>&1 || true)
RUN_ID=$(cat "$RUNS_DIR/current")
EVIDENCE="$RUNS_DIR/$RUN_ID/evidence.jsonl"

if [ ! -f "$TEST_REPO/.codex/.spec-rebuild-pending" ]; then pass "spec build 성공 후 flag 제거"; else fail "spec build 성공 후 flag 잔존"; fi
if grep -q '"kind":"spec-build","status":"pass"' "$EVIDENCE"; then pass "spec-build pass ledger 기록"; else fail "spec-build pass ledger 미기록"; fi
if grep -q '"kind":"typecheck","status":"pass"' "$EVIDENCE"; then pass "typecheck pass ledger 기록"; else fail "typecheck pass ledger 미기록"; fi
if [ -z "$STOP_OUT" ]; then pass "성공 Stop hook 무출력"; else fail "성공 Stop hook에 예상 밖 출력"; fi

FAIL_OUT=$(printf '%s' "$STOP_INPUT" | (cd "$TEST_REPO/nested" && env PATH="$FAKE_BIN:$PATH" FAKE_TYPECHECK_RC=7 AGENT_RUNS_DIR="$RUNS_DIR" CODEX_HOME="$TMP_ROOT/codex-home" /bin/bash -c "$STOP_COMMAND") 2>&1 || true)
if printf '%s' "$FAIL_OUT" | jq -e '.decision == "block"' >/dev/null 2>&1; then pass "typecheck 실패가 Stop block 반환"; else fail "typecheck 실패 Stop block JSON 없음"; fi
if grep -q '"kind":"typecheck","status":"fail"' "$EVIDENCE" && grep -q '"exit":7' "$EVIDENCE"; then
  pass "typecheck fail/exit ledger 기록"
else
  fail "typecheck fail/exit ledger 미기록"
fi

printf '\n== 결과 == PASS %d · FAIL %d\n' "$PASS" "$FAIL"
AGENT_EVIDENCE_SOURCE=codex-hook-selftest.sh bash "$LEDGER" evidence codex-hook-selftest "$([ "$FAIL" -gt 0 ] && echo fail || echo pass)" \
  --detail "PASS $PASS FAIL $FAIL" --cmd "pnpm codex:hooks:selftest" >/dev/null 2>&1 || true

[ "$FAIL" -eq 0 ]

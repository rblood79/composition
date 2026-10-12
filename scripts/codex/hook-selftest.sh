#!/usr/bin/env bash
# Codex lifecycle hook contract self-test.
#
# Paperthin·Polysona 병합 순서 1': hook은 존재만 확인하지 않고 Codex stdin JSON으로
# 등록된 handler의 실제 분기를 exercise한다. 제품 파일과 build cache는 변경하지 않는다.
# macOS bash 3.2 호환.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
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

hook_command() {
  local event="$1" script="$2"
  jq -r --arg event "$event" --arg script "$script" \
    '[.hooks[$event][]?.hooks[]? | select(.type == "command" and (.command | contains($script))) | .command][0] // empty' \
    "$ROOT_DIR/.codex/hooks.json"
}

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

printf '\n== 결과 == PASS %d · FAIL %d\n' "$PASS" "$FAIL"
AGENT_EVIDENCE_SOURCE=codex-hook-selftest.sh bash "$LEDGER" evidence codex-hook-selftest "$([ "$FAIL" -gt 0 ] && echo fail || echo pass)" \
  --detail "PASS $PASS FAIL $FAIL" --cmd "pnpm codex:hooks:selftest" >/dev/null 2>&1 || true

[ "$FAIL" -eq 0 ]

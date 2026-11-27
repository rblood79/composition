#!/usr/bin/env bash
# work runner와 preflight의 스킬/tooling 검사 선택을 공유한다.

# 경로 scope (ERE) — work.sh verify 와 adr-autorun.sh gate 가 같이 쓴다.
# render 경로 = G3 ratchet 대상 · engine 경로 = cargo test 대상.
RE_RENDER='^(apps/builder/src/builder/(workspace/canvas/|catalogRuntime/)|packages/rendering/src/|packages/shared/src/(catalog/|components/|domain/componentTraits\.ts)|apps/builder/src/preview/|apps/publish/src/|packages/engine/src/)|\.css$'
RE_ENGINE='^packages/engine/src/'

codex_instruction_checks() {
  local files="$1"
  if printf '%s\n' "$files" | grep -qE '^(\.claude/skills/|\.agents/skills/|scripts/codex/(validate-skills\.mjs|skills\.test\.mjs|skills-gate\.sh|validation-scope\.sh|route-prompt\.sh|agent-catalog-gate\.sh)$|package\.json$)'; then
    echo skills-validate
  fi
  if printf '%s\n' "$files" | grep -qE '^(scripts/codex/(validate-skills\.mjs|skills\.test\.mjs|skills-gate\.sh|validation-scope\.sh|route-prompt\.sh|agent-catalog-gate\.sh)$|\.codex/hooks\.json$|package\.json$)'; then
    echo skills-test
  fi
  if printf '%s\n' "$files" | grep -qE '^(scripts/(codex|agent)/|\.codex/(hooks/|tests/|hooks\.json$)|\.prettierignore$|package\.json$)'; then
    echo workflow-test
  fi
  return 0
}

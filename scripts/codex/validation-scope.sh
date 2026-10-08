#!/usr/bin/env bash
# work runner와 preflight의 스킬/tooling 검사 선택을 공유한다.
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

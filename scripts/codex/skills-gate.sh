#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/codex/env.sh"
source "$ROOT_DIR/scripts/codex/validation-scope.sh"
codex_activate_env
cd "$ROOT_DIR"
if [ "${1:-}" = "--" ]; then shift; fi
if [ "$#" -gt 0 ]; then
  FILES=$(printf '%s\n' "$@")
else
  # 공용 changed-files helper는 삭제를 제외하므로 스킬 삭제도 검사 범위에 더한다.
  FILES=$({ codex_changed_files; git diff --name-only --diff-filter=D; git diff --cached --name-only --diff-filter=D; } | sort -u)
fi
CHECKS=$(codex_instruction_checks "$FILES")
if [ -z "$CHECKS" ]; then echo "[codex:skills:gate] 관련 변경 없음 - 스킵"; exit 0; fi
while IFS= read -r check; do
  case "$check" in
    skills-validate) codex_pnpm run codex:skills:validate ;;
    skills-test) codex_pnpm run codex:skills:test ;;
    workflow-test) codex_pnpm run codex:workflow:test ;;
  esac
done <<< "$CHECKS"

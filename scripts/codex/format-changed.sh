#!/bin/bash
# Codex helper: format changed files with Prettier.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/codex/env.sh"
codex_activate_env
cd "$ROOT_DIR"

if [ "${1:-}" = "--" ]; then
  shift
fi

if [ "$#" -gt 0 ]; then
  FILES="$(printf '%s\n' "$@")"
else
  FILES="$(codex_changed_files)"
fi

TARGETS="$(
  echo "$FILES" |
    grep -E '\.(ts|tsx|js|jsx|css|json|md)$' |
    grep -Ev '^packages/react-aria-starter/' |
    while IFS= read -r file; do
      [ -L "$file" ] || printf '%s\n' "$file"
    done || true
)"

if [ -z "$TARGETS" ]; then
  echo "[codex:format] 포맷 대상 없음"
  exit 0
fi

echo "[codex:format] prettier 실행"
if [ -x "./node_modules/.bin/prettier" ]; then
  # shellcheck disable=SC2086
  ./node_modules/.bin/prettier --write $TARGETS
  exit 0
fi

echo "[codex:format] 로컬 prettier 미설치 - 스킵"

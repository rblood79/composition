#!/bin/bash
# Codex helper: format changed files with Prettier.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/codex/env.sh"
codex_activate_env
cd "$ROOT_DIR"

MODE=--write
case "${1:-}" in --check|--write) MODE="$1"; shift ;; esac
if [ "${1:-}" = "--" ]; then shift; fi

if [ "$#" -gt 0 ]; then
  FILES="$(printf '%s\n' "$@")"
else
  FILES="$(codex_changed_files)"
fi

TARGETS=()
while IFS= read -r file; do
  if [[ "$file" =~ \.(ts|tsx|js|jsx|mjs|cjs|css|json|md)$ ]] && [ -f "$file" ] && [ ! -L "$file" ]; then
    TARGETS+=("$file")
  fi
done <<< "$FILES"

if [ "${#TARGETS[@]}" -eq 0 ]; then
  echo "[codex:format] 포맷 대상 없음"
  exit 0
fi

echo "[codex:format] prettier $MODE 실행 (.prettierignore 공통 적용)"
if [ -x "./node_modules/.bin/prettier" ]; then
  ./node_modules/.bin/prettier "$MODE" --ignore-path "$ROOT_DIR/.prettierignore" -- "${TARGETS[@]}"
  exit 0
fi

echo "[codex:format] 로컬 prettier 미설치 - 검증 불가" >&2
exit 1

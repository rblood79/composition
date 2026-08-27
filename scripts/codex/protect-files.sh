#!/bin/bash
# Codex preflight: block edits to sensitive files unless explicitly approved.

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

if [ -z "$FILES" ]; then
  echo "[codex:guard] 변경 파일 없음"
  exit 0
fi

PROTECTED_PATTERNS=(
  "^\\.env$"
  "^\\.env\\..+"
  "credentials"
  "secret"
  "^supabase/config\\.toml$"
  "^\\.claude/settings\\.json$"
  "^\\.claude/settings\\.local\\.json$"
)

BLOCKED_FILES=()
while IFS= read -r file; do
  [ -z "$file" ] && continue
  for pattern in "${PROTECTED_PATTERNS[@]}"; do
    if echo "$file" | grep -Eiq "$pattern"; then
      BLOCKED_FILES+=("$file")
      break
    fi
  done
done <<< "$FILES"

if [ "${#BLOCKED_FILES[@]}" -gt 0 ]; then
  echo "[codex:guard] 보호 파일 변경이 감지되어 중단합니다:"
  printf ' - %s\n' "${BLOCKED_FILES[@]}"
  echo "필요 시 사용자 승인 후 진행하세요."
  CODEX_GATE_NAME=codex:guard codex_evidence guard block --detail "${BLOCKED_FILES[*]}"
  exit 2
fi

CODEX_GATE_NAME=codex:guard codex_evidence guard pass
echo "[codex:guard] 통과"

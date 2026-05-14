#!/bin/bash
# PostToolUse Hook: spec 소스 편집 감지 시 rebuild flag 생성
# packages/specs/src/** 또는 packages/specs/scripts/** 변경 시 .codex/.spec-rebuild-pending touch
# 실제 build:specs 실행은 type-check-gate.sh (Stop hook) 에서 수행 — 다중 편집 debounce
#
# Why: build:specs ~3.3s. 매 Edit 마다 즉시 실행하면 다중 spec 편집 시 누적 대기 폭증.
# flag 파일 + Stop hook 통합으로 작업 종료 시 1회만 실행.

set -euo pipefail

INPUT=$(cat)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/dev/null
. "$SCRIPT_DIR/codex-hook-utils.sh"

PROJECT_DIR=$(codex_hook_project_dir "$INPUT")
FILE_PATHS=$(codex_hook_tool_paths "$INPUT")

if [ -z "$FILE_PATHS" ]; then
  exit 0
fi

while IFS= read -r FILE_PATH; do
  case "$FILE_PATH" in
    packages/specs/src/*|packages/specs/scripts/*|*/packages/specs/src/*|*/packages/specs/scripts/*)
      FLAG_FILE="$PROJECT_DIR/.codex/.spec-rebuild-pending"
      touch "$FLAG_FILE" 2>/dev/null || true
      ;;
  esac
done <<< "$FILE_PATHS"

exit 0

#!/bin/bash
# PostToolUse Hook: spec 소스 편집 감지 시 rebuild flag 생성
# packages/specs/src/** 또는 packages/specs/scripts/** 변경 시 .claude/.spec-rebuild-pending touch
# 실제 build:specs 실행은 type-check-gate.sh (Stop hook) 에서 수행 — 다중 편집 debounce
#
# Why: build:specs ~3.3s. 매 Edit 마다 즉시 실행하면 다중 spec 편집 시 누적 대기 폭증.
# flag 파일 + Stop hook 통합으로 작업 종료 시 1회만 실행.

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty' 2>/dev/null)

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

case "$FILE_PATH" in
  */packages/specs/src/*|*/packages/specs/scripts/*)
    FLAG_FILE="${CLAUDE_PROJECT_DIR:-.}/.claude/.spec-rebuild-pending"
    touch "$FLAG_FILE" 2>/dev/null || true
    ;;
esac

exit 0

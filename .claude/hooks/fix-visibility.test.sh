#!/usr/bin/env bash
# Regression: Codex Stop requires JSON stdout, while SessionStart permits plain text.
set -euo pipefail

PROJECT_DIR=$(cd "$(dirname "$0")/../.." && pwd)
HOOK="$PROJECT_DIR/.claude/hooks/fix-visibility.sh"

# Keep the fixture hermetic: the child hook inherits this git function instead of
# reading or modifying the repository's real history.
git() {
  case "${1:-}" in
    rev-parse)
      printf '%s\n' '.git'
      ;;
    log)
      if [[ " $* " == *" -1 "* ]]; then
        printf '%s' "$MOCK_SUBJECT"
      else
        printf '%s' "$MOCK_LOG"
      fi
      ;;
    show)
      printf '%s' "${MOCK_SHOW_FILES:-}"
      ;;
    *)
      return 1
      ;;
  esac
}
export -f git

run_hook() {
  local event=$1
  printf '{"hook_event_name":"%s"}\n' "$event" \
    | CLAUDE_PROJECT_DIR="$PROJECT_DIR" bash "$HOOK"
}

export MOCK_SHOW_FILES=''
export MOCK_SUBJECT='fix(hook): second fixture'
export MOCK_LOG=$'@@@a\tfix(hook): first fixture\n\n@@@b\tfix(hook): second fixture\n'

fix_output=$(run_hook Stop)
printf '%s\n' "$fix_output" \
  | jq -e '.systemMessage | type == "string" and startswith("fix(hook)")' >/dev/null

export MOCK_SUBJECT='docs(hook): non-fix fixture'
docs_output=$(run_hook Stop)
test -z "$docs_output"

export MOCK_SUBJECT='revert(hook): fixture'
export MOCK_LOG=$'@@@a\tfix(hook): first fixture\n\n@@@b\tfix(hook): second fixture\n\n@@@c\trevert(hook): fixture\n'
revert_output=$(run_hook Stop)
printf '%s\n' "$revert_output" \
  | jq -e '.systemMessage | type == "string" and startswith("revert(hook)")' >/dev/null

session_output=$(run_hook SessionStart)
case "$session_output" in
  '📊 최근 30일 fix/revert 집계'*) ;;
  *)
    printf '%s\n' 'SessionStart plain-text summary was not preserved.' >&2
    exit 1
    ;;
esac

printf '%s\n' 'fix-visibility hook regression: PASS'

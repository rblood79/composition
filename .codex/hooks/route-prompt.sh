#!/usr/bin/env bash
# Codex UserPromptSubmit adapter.
#
# Prompt 분류의 정본은 scripts/codex/route-prompt.sh 이다. lifecycle hook은
# Codex stdin JSON에서 prompt만 꺼내 정본 router로 전달한다. 이렇게 해야
# user-only invocation 정책과 skill coverage가 manual route와 drift하지 않는다.

set -euo pipefail

payload=$(cat)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/dev/null
. "$SCRIPT_DIR/codex-hook-utils.sh"

PROJECT_DIR=$(codex_hook_project_dir "$payload")
if command -v jq >/dev/null 2>&1; then
  prompt=$(printf '%s' "$payload" | jq -r '.prompt // empty' 2>/dev/null || true)
else
  prompt=$(printf '%s' "$payload" | sed -n 's/.*"prompt":"\([^"]*\)".*/\1/p')
fi

[ -z "$prompt" ] && exit 0

bash "$PROJECT_DIR/scripts/codex/route-prompt.sh" -- "$prompt"

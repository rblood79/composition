#!/usr/bin/env bash

codex_hook_project_dir() {
  local input="${1:-}"
  local cwd=""
  local candidate=""
  local git_root=""

  if command -v jq >/dev/null 2>&1 && [ -n "$input" ]; then
    cwd=$(printf '%s' "$input" | jq -r '.cwd // empty' 2>/dev/null || true)
  fi

  if [ -n "$cwd" ]; then
    candidate="$cwd"
  elif [ -n "${CODEX_PROJECT_DIR:-}" ]; then
    candidate="$CODEX_PROJECT_DIR"
  elif [ -n "${CLAUDE_PROJECT_DIR:-}" ]; then
    candidate="$CLAUDE_PROJECT_DIR"
  else
    candidate=$(pwd)
  fi

  git_root=$(git -C "$candidate" rev-parse --show-toplevel 2>/dev/null || true)
  if [ -n "$git_root" ]; then
    printf '%s\n' "$git_root"
  else
    printf '%s\n' "$candidate"
  fi
}

codex_hook_tool_paths() {
  local input="${1:-}"
  local direct=""
  local command=""

  if command -v jq >/dev/null 2>&1 && [ -n "$input" ]; then
    direct=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty' 2>/dev/null || true)
    command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null || true)
  fi

  if [ -n "$direct" ]; then
    printf '%s\n' "$direct"
  fi

  if [ -n "$command" ]; then
    printf '%s\n' "$command" | sed -n \
      -e 's/^\*\*\* Update File: //p' \
      -e 's/^\*\*\* Add File: //p' \
      -e 's/^\*\*\* Delete File: //p' \
      -e 's/^\*\*\* Move to: //p'
  fi
}

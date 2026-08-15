#!/usr/bin/env bash
# Changed-file aware context snapshot for resume/precompact handoff.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/codex/env.sh"
codex_activate_env
cd "$ROOT_DIR"

print_section() {
  local title="$1"
  echo
  echo "=== ${title} ==="
}

CHANGED="$(codex_changed_files)"

print_rule_head() {
  local title="$1"
  local path="$2"
  local lines="${3:-60}"

  print_section "$title"
  if [ -f "$path" ]; then
    sed -n "1,${lines}p" "$path"
  else
    echo "missing: $path"
  fi
}

print_section "Codex Context Snapshot"
echo "repo: $(basename "$ROOT_DIR")"
echo "branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
echo "head: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "mise: ${CODEX_MISE_STATUS:-unknown}"

print_section "Changed Files"
if [ -z "$CHANGED" ]; then
  echo "none"
else
  echo "$CHANGED"
fi

print_section "Core Contract"
echo "- Prefer AGENTS.md and .agents/* over legacy .claude/*."
echo "- Claude hooks are not automatic in Codex; use pnpm run codex:* commands."
echo "- Default git flow is local commit then git push origin main; no web PR unless the user explicitly asks."

if [ -z "$CHANGED" ]; then
  print_section "Default High-Signal Rules"
  echo "- composition-patterns before nontrivial code changes"
  echo "- codex:route when skill/rule mapping is unclear"
  echo "- codex:preflight before completion"
  exit 0
fi

if echo "$CHANGED" | grep -qiE "canvas|skia|sprite|renderer|Spec\\.(ts|tsx)|nodeRenderer|specShape"; then
  print_rule_head "Canvas Rendering Rule" ".agents/rules/canvas-rendering.md" 80
fi

if echo "$CHANGED" | grep -qiE "layout|fullTree|taffy|yoga|flex|grid|enrichWith"; then
  print_rule_head "Layout Engine Rule" ".agents/rules/layout-engine.md" 70
fi

if echo "$CHANGED" | grep -qiE "store|slice|zustand|elementsMap|childrenMap|history"; then
  print_rule_head "State Management Rule" ".agents/rules/state-management.md" 70
fi

if echo "$CHANGED" | grep -qiE "\\.css$|theme|token|preview-system|builder-system"; then
  print_rule_head "CSS Token Rule" ".agents/rules/css-tokens.md" 70
fi

if echo "$CHANGED" | grep -qiE "docs/adr|adr-writing|CHANGELOG"; then
  print_rule_head "ADR/Docs Rule" ".agents/rules/adr-writing.md" 80
fi

print_section "Completion Gate"
echo "pnpm run codex:preflight"

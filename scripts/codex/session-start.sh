#!/bin/bash
# Codex session bootstrap: surface high-signal context before coding.

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

print_section "Codex Session Start"
echo "repo: $(basename "$ROOT_DIR")"
echo "branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
echo "head: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
echo "mise: ${CODEX_MISE_STATUS:-unknown}"

print_section "Priority Context"
for path in \
  "AGENTS.md" \
  ".agents/README.md" \
  ".agents/skills/INDEX.md" \
  ".agents/progress.md"
do
  if [ -f "$path" ]; then
    echo "- $path"
  else
    echo "- (missing) $path"
  fi
done

print_section "Recent Changelog Header"
if [ -f "docs/CHANGELOG.md" ]; then
  awk '/^## \[/{print; exit}' docs/CHANGELOG.md || true
else
  echo "docs/CHANGELOG.md 없음"
fi

print_section "Quality Gates"
echo "1) pnpm run codex:guard        # protected-file check"
echo "2) pnpm run codex:format       # changed-file prettier"
echo "3) pnpm run codex:typecheck    # only when TS changed"
echo "4) pnpm run codex:preflight    # completion gate"
echo "5) pnpm run codex:agent-catalog # .claude <-> .agents catalog drift gate"

print_section "Harness Commands"
echo "- pnpm run codex:harness -- start"
echo "- pnpm run codex:route -- \"<prompt>\""
echo "- pnpm run codex:snapshot"
echo "- pnpm run codex:preflight"

print_section "Git Working Tree"
git status --short

print_section "Changed File Count"
changed_count="$(codex_changed_files | wc -l | tr -d ' ')"
echo "${changed_count} files"

#!/usr/bin/env bash
# Single command surface for Codex workflow operations.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/codex/env.sh"
codex_activate_env
cd "$ROOT_DIR"

if [ "${1:-}" = "--" ]; then
  shift
fi

COMMAND="${1:-help}"
if [ "$#" -gt 0 ]; then
  shift
fi

case "$COMMAND" in
  start | session-start)
    bash scripts/codex/session-start.sh "$@"
    ;;
  route | prompt)
    bash scripts/codex/route-prompt.sh "$@"
    ;;
  snapshot | context | precompact)
    bash scripts/codex/context-snapshot.sh "$@"
    ;;
  guard)
    bash scripts/codex/protect-files.sh "$@"
    ;;
  format)
    bash scripts/codex/format-changed.sh "$@"
    ;;
  typecheck | type-check)
    bash scripts/codex/type-check-gate.sh "$@"
    ;;
  preflight | verify)
    codex_pnpm run codex:preflight
    ;;
  run | ledger)
    bash scripts/agent/run-ledger.sh "$@"
    ;;
  catalog)
    bash scripts/codex/agent-catalog-gate.sh "$@"
    ;;
  work)
    bash scripts/agent/work.sh "$@"
    ;;
  help | -h | --help)
    cat <<'EOF'
Codex harness commands:

  pnpm run codex:harness -- start
  pnpm run codex:harness -- route "<prompt>"
  pnpm run codex:harness -- snapshot
  pnpm run codex:harness -- guard
  pnpm run codex:harness -- format
  pnpm run codex:harness -- typecheck
  pnpm run codex:harness -- preflight
  pnpm run codex:harness -- catalog
  pnpm run codex:harness -- run start --understood-as "<요청 재진술>" | evidence <kind> <status> | status | report | close
  pnpm run codex:harness -- work start --understood-as "..." | status | verify [--dry-run|--full] | resume <id> | close

Shortcuts:

  pnpm run codex:session-start
  pnpm run codex:route -- "<prompt>"
  pnpm run codex:snapshot
  pnpm run codex:preflight
EOF
    ;;
  *)
    echo "Unknown Codex harness command: $COMMAND" >&2
    echo "Run: pnpm run codex:harness -- help" >&2
    exit 2
    ;;
esac

#!/bin/bash
# Codex gate: run type-check only when TS files changed.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/codex/env.sh"
codex_activate_env
cd "$ROOT_DIR"

CHANGED_TS="$(codex_changed_files | grep -E '\.(ts|tsx)$' || true)"

if [ -z "$CHANGED_TS" ]; then
  echo "[codex:typecheck] TS 변경 없음 - 스킵"
  CODEX_GATE_NAME=codex:typecheck codex_evidence typecheck skip --skip-reason "no TS changes"
  exit 0
fi

echo "[codex:typecheck] TS 변경 감지 - pnpm type-check 실행"
if codex_pnpm type-check; then
  CODEX_GATE_NAME=codex:typecheck codex_evidence typecheck pass --cmd "pnpm type-check"
else
  rc=$?
  CODEX_GATE_NAME=codex:typecheck codex_evidence typecheck fail --cmd "pnpm type-check" --exit "$rc"
  exit "$rc"
fi

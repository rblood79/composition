#!/usr/bin/env bash
# Shared helpers for Codex harness scripts.

set -euo pipefail

codex_repo_root() {
  cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd
}

codex_activate_env() {
  if command -v mise >/dev/null 2>&1; then
    eval "$(mise hook-env -s bash 2>/dev/null || mise hook-env 2>/dev/null || true)"
    export CODEX_MISE_STATUS="active"
  else
    export CODEX_MISE_STATUS="not-installed"
  fi
}

codex_pnpm() {
  if command -v pnpm >/dev/null 2>&1; then
    pnpm "$@"
    return
  fi

  if command -v corepack >/dev/null 2>&1; then
    corepack pnpm "$@"
    return
  fi

  echo "[codex] pnpm not found. Install pnpm or enable corepack." >&2
  return 127
}

# run ledger append (병합 순서 ③) — run 미시작이면 조용히 no-op
codex_evidence() {
  local kind="$1" status="$2"; shift 2
  local ledger; ledger="$(codex_repo_root)/scripts/agent/run-ledger.sh"
  [ -x "$ledger" ] && AGENT_EVIDENCE_SOURCE="${CODEX_GATE_NAME:-codex}" bash "$ledger" evidence "$kind" "$status" "$@" >/dev/null 2>&1 || true
}

codex_changed_files() {
  {
    git diff --name-only --diff-filter=ACMR 2>/dev/null || true
    git diff --name-only --cached --diff-filter=ACMR 2>/dev/null || true
    git ls-files --others --exclude-standard 2>/dev/null || true
  } | sed '/^$/d' | sort -u
}

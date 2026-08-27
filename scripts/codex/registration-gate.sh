#!/bin/bash
# Codex gate: ADR-139 컴포넌트 등록·대칭 contract — TS 변경 시에만 실행.
#
# composition 컴포넌트는 여러 독립 레지스트리(rendererMap / TAG_SPEC_MAP /
# getDefaultProps / ComponentFactory 등)에 각각 등록되어야 정상 동작한다. 본
# 게이트는 등록 누락을 build/CI 시점에 차단한다 (ADR-139 Gate G2).
#
# 종료 코드:
#   0  — contract test PASS (또는 TS 변경 없어 스킵)
#   ≠0 — 등록 누락 감지 (병합 차단)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/codex/env.sh"
codex_activate_env
cd "$ROOT_DIR"

CHANGED_TS="$(codex_changed_files | grep -E '\.(ts|tsx)$' || true)"

if [ -z "$CHANGED_TS" ]; then
  echo "[codex:registration] TS 변경 없음 - 스킵"
  CODEX_GATE_NAME=codex:registration codex_evidence registration skip --skip-reason "no TS changes"
  exit 0
fi

echo "[codex:registration] TS 변경 감지 - 컴포넌트 등록 contract 실행 (ADR-139)"
if codex_pnpm run test:registration-contract; then
  CODEX_GATE_NAME=codex:registration codex_evidence registration pass --target test:registration-contract
else
  rc=$?
  CODEX_GATE_NAME=codex:registration codex_evidence registration fail --target test:registration-contract --exit "$rc"
  exit "$rc"
fi

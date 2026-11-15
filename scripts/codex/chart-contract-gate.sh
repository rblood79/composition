#!/bin/bash
# Codex gate: ADR-306 Chart 계약 — 항상 실행 (rendering `src/chart` unit 은 1 초 안쪽).
#
# ztd 0.5.0 분류 census (`ztdCoverage.test.ts`) · 손계산 fixture · prop 전달 목록 정적 검사 · 기존 Chart
# scene 회귀를 한 번에 돈다. 브라우저 좌표 비교 (G3) 는 이 사슬에 넣지 않는다 — Phase 종료 때 직접 실행.
#
# 종료 코드: 0 — PASS · ≠0 — Chart 계약 실패 (병합 차단)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/codex/env.sh"
codex_activate_env
cd "$ROOT_DIR"

echo "[codex:chart-contract] ADR-306 Chart 계약 게이트"
if codex_pnpm run test:chart-contract; then
  CODEX_GATE_NAME=codex:chart-contract codex_evidence chart-contract pass --target test:chart-contract
else
  rc=$?
  CODEX_GATE_NAME=codex:chart-contract codex_evidence chart-contract fail --target test:chart-contract --exit "$rc"
  exit "$rc"
fi

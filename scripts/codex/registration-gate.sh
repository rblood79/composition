#!/bin/bash
# Codex gate: 컴포넌트 등록 contract — TS 변경 시에만 실행.
#
# ADR-139 의 원래 대상 (rendererMap / TAG_SPEC_MAP / getDefaultProps / ComponentFactory 를
# 오가는 `componentRegistrationContract.test.ts`) 은 ADR-248 Phase 4e-13-3 (0b0eaea28) 에서
# 레지스트리와 함께 삭제됐다. 지금의 등록 경로는 componentCatalog · COMPONENT_RULES_TABLE ·
# typed library definition · product binding 이고, 누락은 두 테스트가 잡는다:
#   - phase4ePalette — 팔레트 항목마다 library definition 이 있고 page body 가 삽입을 받는다
#   - phase3G3Census — 등록 type · state 를 typed library · binding 과 다시 세고 Canvas · DOM
#     까지 렌더한다
# 본 게이트는 등록 누락을 build/CI 시점에 차단한다.
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

echo "[codex:registration] TS 변경 감지 - 컴포넌트 등록 contract 실행 (catalog · library · binding)"
if codex_pnpm run test:registration-contract; then
  CODEX_GATE_NAME=codex:registration codex_evidence registration pass --target test:registration-contract
else
  rc=$?
  CODEX_GATE_NAME=codex:registration codex_evidence registration fail --target test:registration-contract --exit "$rc"
  exit "$rc"
fi

#!/bin/bash
# Codex gate: ADR-305 CSS 문서 경계 — 항상 실행 (TS 변경 조건 없음 · CSS 만 바뀐 변경도 대상).
#
# 빌더 문서 (index.html) 와 사용자 컴포넌트 문서 (preview.html · publish/index.html) 가 같이 싣는 시트는
# 중립 시트 (선언이 전부 `--*` · @font-face · @layer 감싸기) 뿐이고, 빌더 chrome 위젯 시트는 빌더 문서 범위 ·
# `--catalog-token-*` 0 이다. 테스트: apps/builder/src/builder/styles/__tests__/chromeWidgetSheets.static.test.ts
#
# 종료 코드: 0 — PASS · ≠0 — 경계 위반 (병합 차단)

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$ROOT_DIR/scripts/codex/env.sh"
codex_activate_env
cd "$ROOT_DIR"

echo "[codex:css-boundary] ADR-305 CSS 문서 경계 게이트"
if codex_pnpm run test:css-boundary; then
  CODEX_GATE_NAME=codex:css-boundary codex_evidence css-boundary pass --target test:css-boundary
else
  rc=$?
  CODEX_GATE_NAME=codex:css-boundary codex_evidence css-boundary fail --target test:css-boundary --exit "$rc"
  exit "$rc"
fi

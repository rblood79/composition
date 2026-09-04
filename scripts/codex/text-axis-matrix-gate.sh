#!/usr/bin/env bash
# ADR-205 G4 — 텍스트 시각 축 격차표 drift 게이트.
#
# `docs/adr/evidence/205-text-axis-gap-matrix.md` 의 생성 블록이 코드 (상속 속성 목록 ·
# ADR-057 블록 · 폭/wrap leg · Skia scene build) 와 어긋나면 실패한다. 새 텍스트 CSS 속성이
# 한쪽 표면에만 생기는 것을 커밋 시점으로 앞당긴다.
#
# 값 수준 **도달 검사**는 vitest 쪽에 있다:
#   apps/builder/src/builder/workspace/canvas/utils/__tests__/textAxisGate.static.test.ts
set -euo pipefail
cd "$(dirname "$0")/../.."
node scripts/generate-text-axis-matrix.mjs --check

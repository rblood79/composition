#!/usr/bin/env bash
# 엔진 capability 절 drift 게이트 — docs/CSS_SUPPORT_MATRIX.md 의 생성 블록이
# layoutCapabilityMatrix.ts 와 어긋나면 실패한다 (문서 정체를 preflight 실패로 바꾼다).
set -euo pipefail
cd "$(dirname "$0")/../.."
node scripts/generate-engine-matrix.mjs --check

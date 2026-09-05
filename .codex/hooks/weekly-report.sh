#!/usr/bin/env bash
# 미등록 legacy 진입점. Claude transcript를 Codex 사용량으로 오인한 집계를 중단합니다.
set -euo pipefail
printf '%s\n' "Codex 사용량 집계는 지원하지 않습니다. 현재 evidence 조회: pnpm run agent:dashboard" >&2

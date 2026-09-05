#!/usr/bin/env bash
# 미등록 legacy 진입점. transcript 집계로 정본 INDEX를 자동 변경하지 않습니다.
set -euo pipefail
printf '%s\n' "INDEX 자동 갱신은 중단되었습니다. 현재 evidence 조회: pnpm run agent:dashboard" >&2

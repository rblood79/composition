#!/usr/bin/env bash
# 미등록 legacy 진입점. 공용 snapshot 구현을 재사용합니다.
set -euo pipefail
PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
exec bash "$PROJECT_DIR/scripts/codex/context-snapshot.sh" "$@"

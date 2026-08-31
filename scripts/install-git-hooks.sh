#!/usr/bin/env bash
# ADR-198 Phase 5 — 저장소 git hook 설치 (idempotent)
#
# `.git/hooks` 는 버전 관리 대상이 아니라 clone 마다 비어 있다. `core.hooksPath`
# 를 커밋된 `.githooks/` 로 돌려 hook 이 코드와 함께 리뷰·이력을 남기게 한다.
#
# 되돌리기: `git config --unset core.hooksPath`

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

current="$(git config core.hooksPath || true)"

# 기본 위치(`$GIT_DIR/hooks`)를 절대경로로 명시해 둔 설정은 "커스텀 hook 경로"가
# 아니라 기본값이다 — 덮어써도 잃는 것이 없다. 그 외의 경로만 보호한다.
default_hooks="$(cd "$(git rev-parse --git-dir)" && pwd)/hooks"
if [ "$current" = "$default_hooks" ] || [ "$current" = ".git/hooks" ]; then
  current=""
fi

if [ -n "$current" ] && [ "$current" != ".githooks" ]; then
  echo "⚠️  core.hooksPath 가 이미 \"$current\" 로 설정돼 있다 — 덮어쓰지 않는다."
  echo "    의도한 것이면: git config core.hooksPath .githooks"
  exit 1
fi

chmod +x .githooks/* 2>/dev/null || true
git config core.hooksPath .githooks

echo "✅ core.hooksPath = .githooks"
echo ""
echo "설치된 hook:"
for h in .githooks/*; do
  [ -f "$h" ] && echo "  - $(basename "$h")"
done
echo ""
echo "pre-push 는 D3 경로(catalog/spec/생성 CSS·Canvas/Skia·Preview·폰트/wasm·하니스)가"
echo "바뀐 push 에서만 시각 파리티 smoke 를 돌린다. 그 외 push 는 즉시 통과."
echo "건너뛰려면: SKIP_VISUAL_PARITY=1 git push origin main"

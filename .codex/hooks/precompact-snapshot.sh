#!/bin/bash
# PreCompact Context Snapshot — 컨텍스트 압축 직전 핵심 정보 재주입
# 변경된 파일 패턴에 맞는 규칙만 동적 주입 (Context Engineering: Just-in-time)

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RULES_DIR="$PROJECT_DIR/rules"

echo "=== PreCompact Context Snapshot ==="
echo ""
echo "## Project: composition NoCode Builder"
echo "## Pipeline: Memory→Index→History→DB→Preview→Rebalance"
echo "## Engines: Taffy WASM (Flex/Grid/Block), CanvasKit/Skia (render), PixiJS (events)"
echo ""

# 변경된 파일 목록 수집
CHANGED=$(git -C "$PROJECT_DIR/.." diff --name-only HEAD 2>/dev/null || true)

if [ -n "$CHANGED" ]; then
  echo "## Changed files: $(echo "$CHANGED" | wc -l | tr -d ' ') files"
  echo ""

  # Canvas/Skia/Spec 변경 → canvas-rendering 규칙 주입
  if echo "$CHANGED" | grep -qiE "canvas|skia|sprite|Spec\.(ts|tsx)|nodeRenderer|specShape"; then
    echo "## Canvas/Spec Rules (auto-injected from canvas-rendering.md)"
    head -40 "$RULES_DIR/canvas-rendering.md" 2>/dev/null || true
    echo ""
  fi

  # Layout/Taffy 변경 → layout-engine 규칙 주입
  if echo "$CHANGED" | grep -qiE "layout|fullTree|taffy|enrichWith"; then
    echo "## Layout Rules (auto-injected from layout-engine.md)"
    head -30 "$RULES_DIR/layout-engine.md" 2>/dev/null || true
    echo ""
  fi

  # Store/State 변경 → state-management 규칙 주입
  if echo "$CHANGED" | grep -qiE "store|slice|zustand|elementsMap|childrenMap"; then
    echo "## State Rules (auto-injected from state-management.md)"
    head -25 "$RULES_DIR/state-management.md" 2>/dev/null || true
    echo ""
  fi

  # CSS/Theme 변경 → css-tokens 규칙 주입
  if echo "$CHANGED" | grep -qiE "\.css$|theme|token|preview-system|builder-system"; then
    echo "## CSS Token Rules (auto-injected from css-tokens.md)"
    head -30 "$RULES_DIR/css-tokens.md" 2>/dev/null || true
    echo ""
  fi
else
  # 변경 파일 없으면 핵심 규칙만 간략 주입
  echo "## CRITICAL Rules (compact)"
  echo "- No inline Tailwind → tv() + CSS files"
  echo "- No any type → explicit types"
  echo "- DirectContainer → engine result x/y"
  echo "- O(1) elementsMap → no array traversal"
  echo "- History before state change"
  echo "- layoutVersion + 1 on layout props"
  echo "- batchUpdateElementOrders() single set()"
  echo "- resolveToken() for TokenRef numeric ops"
  echo ""
fi

echo "## Key Files"
echo "- SKILL.md: .claude/skills/composition-patterns/SKILL.md"
echo "- Rules: .claude/rules/ (canvas-rendering, layout-engine, state-management, css-tokens)"
echo "=== End Snapshot ==="

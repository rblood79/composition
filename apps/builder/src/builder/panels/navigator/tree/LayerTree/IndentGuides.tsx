import React from "react";

/**
 * 들여쓰기 안내선 (panel-ui 07, 2026-09-14) — depth 마다 16, 선은 expand 상자 (16) 중앙
 * x = 16k − 4 (행 padding 4 + 16(k−1) + 8). 행 높이 전체를 지나 위아래 행과 이어진다.
 * 종전 8/depth + 8 마다 gradient 선은 5단 이상에서 소속을 읽기 어려웠다.
 */
const INDENT_PER_DEPTH = 16;

export function IndentGuides({
  depth,
  activeGuides,
}: {
  depth: number;
  activeGuides?: readonly boolean[];
}) {
  if (depth <= 0) return null;
  return (
    <div
      className="elementItemIndent"
      style={{ width: `${depth * INDENT_PER_DEPTH}px` }}
      aria-hidden="true"
    >
      {Array.from({ length: depth }, (_, k) => (
        <span
          key={k}
          className="layer-indent-guide"
          data-active={activeGuides?.[k] ? "true" : undefined}
          style={{ left: `${k * INDENT_PER_DEPTH + INDENT_PER_DEPTH / 2}px` }}
        />
      ))}
    </div>
  );
}

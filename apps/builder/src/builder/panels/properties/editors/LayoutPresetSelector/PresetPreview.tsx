/**
 * PresetPreview - SVG 기반 레이아웃 썸네일
 *
 * 영역 배열은 `derivePreviewAreas` 가 breakpoint 별로 파생한다 (ADR-168 P-1) — 이 컴포넌트는
 * 그리기만 담당한다.
 *
 * 색상은 전부 시맨틱 토큰이다 (ADR-168 P-2). 원시 토큰(`--color-gray-*` / `--color-white`)은
 * dark mode 재정의가 없어서, 다크 테마에서 흰 배경 위에 연회색 사각형이 그려지고 이름표가
 * 배경에 묻혔다.
 */

import { memo, useMemo } from "react";
import type { PreviewArea } from "./types";

interface PresetPreviewProps {
  /** 미리보기 영역 배열 */
  areas: PreviewArea[];
  /** SVG 너비 */
  width?: number;
  /** SVG 높이 */
  height?: number;
  /** 선택된 Slot 이름 */
  selectedSlot?: string;
}

/**
 * 영역 배경.
 *
 * 선택·required 는 둘 다 accent 계열이고, 선택은 테두리(굵기 2 + `--accent`)로 구분한다.
 * 슬롯이 아닌 영역(격자 슬롯 내부의 카드 셀)은 가장 안쪽 표면으로 낮춰 "슬롯 안에 놓일
 * 자리" 로 읽히게 한다.
 */
function fillOf(area: PreviewArea, isSelected: boolean): string {
  if (isSelected || area.required) return "var(--accent-subtle)";
  return area.isSlot ? "var(--bg-muted)" : "var(--bg-inset)";
}

export const PresetPreview = memo(function PresetPreview({
  areas,
  width = 120,
  height = 80,
  selectedSlot,
}: PresetPreviewProps) {
  // SVG rect 요소 캐싱
  const rectElements = useMemo(() => {
    return areas.map((area) => {
      const isSelected = selectedSlot === area.name;

      // 이름표는 **슬롯에만** 붙인다 — 카드 셀에 이름을 찍으면 `feed#0` 같은 내부 id 가
      // 그대로 노출되고, 좁은 셀에서 글자가 서로 겹친다.
      const showLabel = area.isSlot && area.width >= 20 && area.height >= 15;

      return (
        <g key={area.name}>
          <rect
            x={`${area.x}%`}
            y={`${area.y}%`}
            width={`${area.width}%`}
            height={`${area.height}%`}
            fill={fillOf(area, isSelected)}
            stroke={isSelected ? "var(--accent)" : "var(--border)"}
            strokeWidth={isSelected ? 2 : 1}
            rx={2}
          />
          {showLabel && (
            <text
              x={`${area.x + area.width / 2}%`}
              y={`${area.y + area.height / 2}%`}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="var(--fg-muted)"
              fontSize="8"
              fontFamily="var(--font-sans)"
            >
              {area.name}
            </text>
          )}
          {/* Required 표시 */}
          {area.required && area.isSlot && area.width >= 15 && (
            <text
              x={`${area.x + area.width - 2}%`}
              y={`${area.y + 4}%`}
              textAnchor="end"
              fill="var(--accent)"
              fontSize="8"
              fontWeight="bold"
            >
              *
            </text>
          )}
        </g>
      );
    });
  }, [areas, selectedSlot]);

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="preset-preview-svg"
    >
      {rectElements}
    </svg>
  );
});

export default PresetPreview;

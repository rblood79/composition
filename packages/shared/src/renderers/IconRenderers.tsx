import React from "react";
import { getIconData } from "@composition/rendering";
import type { PreviewElement, RenderContext } from "../types";

/**
 * Icon 컴포넌트 렌더러
 *
 * ADR-019: Lucide 아이콘을 SVG로 렌더링
 * div 래핑: data-element-id, 스타일, 레이아웃 지원
 */

const ICON_SIZE_MAP: Record<string, number> = {
  xs: 16,
  sm: 18,
  md: 24,
  lg: 36,
  xl: 48,
};

export const renderIcon = (
  element: PreviewElement,
  _context: RenderContext,
): React.ReactNode => {
  const props = element.props || {};
  const iconName = String(props.iconName || "circle");
  // fontSize 오버라이드 시 iconSize = fontSize
  const styleFontSize = (props.style as Record<string, unknown> | undefined)
    ?.fontSize;
  const overrideFs =
    styleFontSize != null
      ? typeof styleFontSize === "number"
        ? styleFontSize
        : parseFloat(String(styleFontSize)) || undefined
      : undefined;
  const size = overrideFs ?? ICON_SIZE_MAP[String(props.size || "md")] ?? 24;
  const strokeWidth = Number(props.strokeWidth) || 2;
  const color =
    (props.style as Record<string, string> | undefined)?.color ??
    "currentColor";

  const data = getIconData(iconName);
  if (!data) return null;

  return (
    <div
      key={element.id}
      className="react-aria-Icon"
      data-element-id={element.id}
      data-original-type="Icon"
      style={props.style as React.CSSProperties | undefined}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {data.paths.map((d: string, i: number) => (
          <path key={i} d={d} />
        ))}
        {data.circles?.map(
          (c: { cx: number; cy: number; r: number }, i: number) => (
            <circle key={`c${i}`} cx={c.cx} cy={c.cy} r={c.r} />
          ),
        )}
      </svg>
    </div>
  );
};

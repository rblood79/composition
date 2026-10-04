/**
 * IconPreview - Lucide 아이콘 SVG 미리보기 렌더러
 *
 * LucideIconData → DOM <svg> 변환
 * Builder 패널/에디터용 (Canvas가 아닌 DOM 렌더링)
 */

import { memo } from "react";
import { getIconData } from "@composition/rendering";

export interface IconPreviewProps {
  /** 아이콘 이름 (lucide 레지스트리 키) */
  name: string;
  /** 크기 (px) */
  size?: number;
  /** stroke 색상 */
  color?: string;
  /** 선 두께 */
  strokeWidth?: number;
  className?: string;
}

export const IconPreview = memo(function IconPreview({
  name,
  size = 16,
  color = "currentColor",
  strokeWidth = 2,
  className,
}: IconPreviewProps) {
  const data = getIconData(name);
  if (!data) return null;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {data.paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
      {data.circles?.map((c, i) => (
        <circle key={`c${i}`} cx={c.cx} cy={c.cy} r={c.r} />
      ))}
    </svg>
  );
});

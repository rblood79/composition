/**
 * CornerRadius — Border 코너 2×2 필드의 글리프 (panel-ui 02 `c_tl` … `c_br`, 2026-09-15).
 *
 * lucide 에 "한 코너만 둥근 사각" 글리프가 없어 (SquareRoundCorner 는 한 종류뿐) 시안 path 를
 * 그대로 인라인한다 — viewBox 16, 각 코너의 호 하나 + 인접 변 둘. props 계약은 lucide 와 같다.
 */

export type CornerRadiusCorner = "tl" | "tr" | "bl" | "br";

export interface CornerRadiusProps {
  corner: CornerRadiusCorner;
  color?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

const CORNER_PATHS: Record<CornerRadiusCorner, string> = {
  tl: "M3 13V6a3 3 0 0 1 3-3h7",
  tr: "M3 3h7a3 3 0 0 1 3 3v7",
  bl: "M3 3v7a3 3 0 0 0 3 3h7",
  br: "M13 3v7a3 3 0 0 1-3 3H3",
};

export function CornerRadius({
  corner,
  color = "currentColor",
  size = 16,
  strokeWidth = 1.5,
  className,
}: CornerRadiusProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={CORNER_PATHS[corner]} />
    </svg>
  );
}

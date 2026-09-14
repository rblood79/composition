/**
 * LineDashed — 선 스타일 seg 의 「- - -」 글리프 (lucide 에 dashed line 아이콘이 없다;
 * solid 는 `Minus`, dotted 는 `Ellipsis`). props 계약은 lucide 아이콘과 동일.
 */

export interface LineDashedProps {
  color?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function LineDashed({
  color = "currentColor",
  size = 24,
  strokeWidth = 2,
  className,
}: LineDashedProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M3 12h4" />
      <path d="M10 12h4" />
      <path d="M17 12h4" />
    </svg>
  );
}

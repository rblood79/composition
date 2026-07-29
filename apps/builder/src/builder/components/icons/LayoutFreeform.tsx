/**
 * LayoutFreeform — lucide `layout-freeform` 아이콘 로컬 구현
 *
 * lucide 업스트림에는 존재하지만 설치본 `lucide-react@0.575.0`에는 아직
 * `LayoutFreeform` export가 없어 upstream path 데이터를 그대로 인라인한다.
 *
 * lucide-react가 이 아이콘을 배포하면 본 파일을 삭제하고
 * `import { LayoutFreeform } from "lucide-react"`로 교체할 것.
 */

export interface LayoutFreeformProps {
  color?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function LayoutFreeform({
  color = "currentColor",
  size = 24,
  strokeWidth = 2,
  className,
}: LayoutFreeformProps) {
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
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="4" rx="1" />
      <rect width="7" height="7" x="4" y="14" rx="1" />
    </svg>
  );
}

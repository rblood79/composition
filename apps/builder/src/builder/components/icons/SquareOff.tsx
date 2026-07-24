/**
 * SquareOff — lucide `square-off` 아이콘 로컬 구현
 *
 * lucide 업스트림(main 브랜치 `icons/square-off.svg`)에는 존재하지만 **npm 배포본에는
 * 아직 포함되지 않았다** — 설치본 `lucide-react@0.575.0` 은 물론 최신 `1.26.0` tarball 에도
 * `square-off` 파일/`SquareOff` export 가 0건 (2026-07-25 실측. `message-square-off` /
 * `parking-square-off` 만 존재). 그래서 upstream path 데이터를 그대로 인라인한다.
 *
 * lucide-react 가 이 아이콘을 배포하면 본 파일을 삭제하고
 * `import { SquareOff } from "lucide-react"` 로 교체할 것.
 *
 * props 계약은 lucide 아이콘과 동일 (color/size/strokeWidth) — `iconProps` 를 그대로 전달.
 */

export interface SquareOffProps {
  color?: string;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function SquareOff({
  color = "currentColor",
  size = 24,
  strokeWidth = 2,
  className,
}: SquareOffProps) {
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
      <path d="M20.4 20.4a2 2 0 0 1-1.4.6H5a2 2 0 0 1-2-2V5a2 2 0 0 1 .59-1.41" />
      <path d="M21 15.3V5a2 2 0 0 0-2-2H8.7" />
      <path d="M22 22 2 2" />
    </svg>
  );
}

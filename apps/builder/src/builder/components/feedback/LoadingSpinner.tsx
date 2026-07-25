/**
 * LoadingSpinner - 로딩 상태 표시 컴포넌트
 *
 * 모든 패널에서 사용하는 공통 로딩 UI
 * 일관된 loading state 표현을 위한 공통 컴포넌트
 */

import type { ReactNode } from "react";

import "./LoadingSpinner.css";
export interface LoadingSpinnerProps {
  /** 표시할 아이콘 (선택, 기본: 회전 스피너) */
  icon?: ReactNode;
  /** 로딩 메시지 */
  message?: string;
  /** 추가 설명 (선택) */
  description?: string;
  /** 스피너 크기 */
  size?: "sm" | "md" | "lg";
  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * 로딩 스피너 컴포넌트
 *
 * @example
 * ```tsx
 * <LoadingSpinner message="데이터를 불러오는 중..." />
 * ```
 *
 * @example
 * ```tsx
 * <LoadingSpinner
 *   size="lg"
 *   message="에디터를 불러오는 중..."
 *   description="잠시만 기다려주세요"
 * />
 * ```
 */
export function LoadingSpinner({
  icon,
  message = "불러오는 중...",
  description,
  size = "md",
  className = "",
}: LoadingSpinnerProps) {
  return (
    <div className={`inspector loading ${className}`.trim()}>
      <div className="loading-state">
        {icon || (
          <div className={`spinner spinner-${size}`} aria-label="Loading">
            <svg
              className="spinner-svg"
              viewBox="0 0 50 50"
              xmlns="http://www.w3.org/2000/svg"
            >
              <circle
                className="spinner-circle"
                cx="25"
                cy="25"
                r="20"
                fill="none"
                strokeWidth="4"
              />
            </svg>
          </div>
        )}
        <p className="loading-message">{message}</p>
        {description && <p className="loading-description">{description}</p>}
      </div>
    </div>
  );
}

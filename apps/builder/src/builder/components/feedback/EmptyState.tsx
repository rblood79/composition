/**
 * EmptyState - 빈 상태 표시 컴포넌트
 *
 * 모든 패널에서 사용하는 공통 빈 상태 UI
 * 일관된 empty state 표현을 위한 공통 컴포넌트
 */

import type { ReactNode } from "react";
import "./EmptyState.css";

export interface EmptyStateProps {
  /** 표시할 아이콘 */
  icon: ReactNode;
  /** 메인 메시지 */
  message: string;
  /** 추가 설명 (선택) */
  description?: string;
  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * 빈 상태 컴포넌트
 *
 * @example
 * ```tsx
 * <EmptyState icon={<Settings2 size={32} />} message="요소를 선택하세요" />
 * ```
 *
 * @example
 * ```tsx
 * <EmptyState
 *   icon={<FileQuestion size={48} />}
 *   message="데이터를 찾을 수 없습니다"
 *   description="다른 데이터 소스를 선택해주세요"
 * />
 * ```
 */
export function EmptyState({
  icon,
  message,
  description,
  className = "",
}: EmptyStateProps) {
  return (
    <div className={`builder-empty-state ${className}`.trim()}>
      <div className="builder-empty-state-content">
        <div className="builder-empty-state-icon">{icon}</div>
        <p className="builder-empty-state-message">{message}</p>
        {description && (
          <p className="builder-empty-state-description">{description}</p>
        )}
      </div>
    </div>
  );
}

/**
 * Slot Component
 *
 * Layout 내에서 Page 콘텐츠가 삽입될 위치를 표시하는 특수 컴포넌트
 *
 * 사용 모드:
 * - Layout 편집 모드: 빈 플레이스홀더로 표시 (이름, required 표시)
 * - Page 렌더링 모드: Page의 slot_name과 일치하는 요소들로 교체됨
 *
 * @example
 * ```tsx
 * // Layout 내에서 Slot 배치
 * <Slot name="content" required />
 * <Slot name="sidebar" description="Optional sidebar" />
 * ```
 */

import React from "react";
import "./styles/generated/Slot.css";
import { useComponentStrings } from "../i18n";

export interface SlotProps {
  /** Slot 식별자 (예: "content", "sidebar", "navigation") */
  name: string;

  /** 필수 여부 - true면 Page에서 반드시 채워야 함 */
  required?: boolean;

  /** Slot 설명 (UI 표시용) */
  description?: string;

  /** CSS 클래스 */
  className?: string;

  /** 추가 스타일 */
  style?: React.CSSProperties;

  /** Element ID (Preview에서 선택용) */
  "data-element-id"?: string;

  /**
   * Slot이 채워진 콘텐츠 (렌더링 시점에 주입됨)
   * - Layout 편집 모드: undefined (플레이스홀더 표시)
   * - Page 렌더링 모드: Page element들의 ReactNode
   */
  children?: React.ReactNode;

  /**
   * Layout 편집 모드 여부
   * true: 플레이스홀더 UI 표시
   * false: children만 렌더링 (Slot UI 숨김)
   */
  isEditMode?: boolean;
}

/**
 * 🚀 Phase 4: data-* 패턴 전환
 * - tailwind-variants 제거
 * - data-required, data-empty 속성 사용
 */
export function Slot({
  name,
  required = false,
  description,
  className,
  style,
  children,
  isEditMode = true,
  ...props
}: SlotProps) {
  const t = useComponentStrings();
  const isEmpty = !children || (Array.isArray(children) && children.length === 0);

  // Edit 모드가 아니고 children이 있으면 children만 렌더링 (Slot UI 숨김)
  if (!isEditMode && !isEmpty) {
    return <>{children}</>;
  }

  return (
    <div
      className={className ? `react-aria-Slot ${className}` : "react-aria-Slot"}
      style={style}
      data-slot-name={name}
      data-slot-required={required}
      data-required={required || undefined}
      data-empty={isEmpty || undefined}
      {...props}
    >
      {/* Edit 모드일 때 플레이스홀더 UI 표시 */}
      {isEditMode && isEmpty && (
        <div className="react-aria-Slot-placeholder">
          <div className="react-aria-Slot-icon">
            <SlotIcon />
          </div>
          <div className="react-aria-Slot-info">
            <span className="react-aria-Slot-name">
              {name}
              {required && <span className="react-aria-Slot-required-badge">{t("required")}</span>}
            </span>
            {description && (
              <span className="react-aria-Slot-description">{description}</span>
            )}
          </div>
        </div>
      )}

      {/* 채워진 콘텐츠 렌더링 */}
      {children}
    </div>
  );
}

/**
 * Slot 아이콘 (Placeholder용)
 */
function SlotIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 3v18" />
      <path d="M15 3v18" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
    </svg>
  );
}

export default Slot;

/**
 * PanelHeader - 패널 최상위 헤더 컴포넌트
 *
 * 모든 패널의 최상위 헤더에 사용되는 공통 컴포넌트
 * title + actions 구조를 일관되게 제공
 */

import type { ReactNode } from "react";
import { translateDisplayLabel, useOptionalI18n } from "../../../i18n";

export interface PanelHeaderProps {
  /** 헤더 제목 */
  title: string;
  /** 제목 앞에 표시할 아이콘 (ReactNode) */
  icon?: ReactNode;
  /** 헤더 우측 액션 버튼들 (ReactNode) */
  actions?: ReactNode;
  /** 추가 CSS 클래스 */
  className?: string;
}

/**
 * 패널 헤더 컴포넌트
 *
 * @example
 * ```tsx
 * <PanelHeader
 *   title="Properties"
 *   actions={<button className="iconButton"><Square size={iconProps.size} /></button>}
 * />
 * ```
 *
 * @example
 * ```tsx
 * // 아이콘이 있는 패널 헤더
 * <PanelHeader
 *   icon={<Database size={iconProps.size} />}
 *   title="DataTable"
 * />
 * ```
 *
 * @example
 * ```tsx
 * <PanelHeader
 *   title="Events"
 *   actions={<EventTypePicker onSelect={handleAddEvent} />}
 * />
 * ```
 */
export function PanelHeader({
  title,
  icon,
  actions,
  className = "",
}: PanelHeaderProps) {
  const i18n = useOptionalI18n();
  return (
    <div className={`panel-header ${className}`.trim()}>
      <h3 className="panel-title">
        {icon && <span className="panel-icon">{icon}</span>}
        {i18n ? translateDisplayLabel(i18n.t, title) : title}
      </h3>
      {actions && <div className="panel-actions">{actions}</div>}
    </div>
  );
}

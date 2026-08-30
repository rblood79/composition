/**
 * PanelHeader - 패널 최상위 헤더 컴포넌트
 *
 * 모든 패널의 최상위 헤더에 사용되는 공통 컴포넌트
 * title + actions 구조를 일관되게 제공
 */

import type { ReactNode } from "react";
import { X } from "lucide-react";
import {
  semanticLabelKeys,
  translateKey,
  useOptionalI18n,
} from "../../../i18n";
import { iconProps } from "../../../utils/ui/uiConstants";
import { togglePanelWorkspace } from "../../hooks/usePanelLayout";
import type { PanelId } from "../../panels/core/types";
import { ActionIconButton } from "../ui/ActionIconButton";

export interface PanelHeaderProps {
  /** 헤더 제목 */
  title: string;
  /** 제목 앞에 표시할 아이콘 (ReactNode) */
  icon?: ReactNode;
  /** 헤더 우측 액션 버튼들 (ReactNode) */
  actions?: ReactNode;
  /** 등록 패널 ID. 지정하면 기존 actions 뒤에 공통 닫기 버튼을 렌더링 */
  panelId?: PanelId;
  /** 패널별 종료 절차가 필요할 때 panelId 대신 사용하는 닫기 핸들러 */
  onClose?: () => void;
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
  panelId,
  onClose,
  className = "",
}: PanelHeaderProps) {
  const i18n = useOptionalI18n();
  const closeLabel = i18n ? i18n.t("common.close") : "Close";
  const handleClose =
    onClose ?? (panelId ? () => togglePanelWorkspace(panelId) : undefined);
  const resolvedTitle = i18n
    ? translateKey(i18n.t, semanticLabelKeys[title] ?? title, title)
    : title;

  return (
    <div className={`panel-header ${className}`.trim()}>
      <h3 className="panel-title">
        {icon && <span className="panel-icon">{icon}</span>}
        {/* 이름표를 span 으로 감싸는 이유: 익명 flex item 은 줄바꿈을 막을 수 없어
            좁은 패널에서 "작업 내역" 같은 두 어절 이름이 두 줄로 접혀 잘렸다. */}
        <span className="panel-title-text" title={resolvedTitle}>
          {resolvedTitle}
        </span>
      </h3>
      {(actions || handleClose) && (
        <div className="panel-actions">
          {actions}
          {handleClose && (
            <ActionIconButton
              onPress={handleClose}
              aria-label={closeLabel}
              tooltip={closeLabel}
            >
              <X size={iconProps.size} />
            </ActionIconButton>
          )}
        </div>
      )}
    </div>
  );
}

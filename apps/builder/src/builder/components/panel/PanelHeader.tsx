/**
 * PanelHeader - 패널 최상위 헤더 컴포넌트
 *
 * 모든 패널의 최상위 헤더에 사용되는 공통 컴포넌트
 * title + actions 구조를 일관되게 제공
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
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
  /**
   * 제목 인라인 rename — 더블클릭 또는 (포커스 후) Enter/F2 로 입력이 열리고 Enter/blur 가
   * commit, Esc 가 취소. 빈 값은 commit 하지 않는다. 지정한 패널만 제목이 편집 가능하다.
   */
  onTitleCommit?: (next: string) => void;
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
  onTitleCommit,
  className = "",
}: PanelHeaderProps) {
  const i18n = useOptionalI18n();
  const closeLabel = i18n ? i18n.t("common.close") : "Close";
  const renameLabel = i18n ? i18n.t("common.rename") : "Rename";
  const [renaming, setRenaming] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (renaming) renameInputRef.current?.select();
  }, [renaming]);
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
        {onTitleCommit && renaming ? (
          <input
            ref={renameInputRef}
            className="panel-title-text panel-title-input"
            aria-label={renameLabel}
            defaultValue={resolvedTitle}
            autoFocus
            data-shortcut-local="undo redo"
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Enter") {
                e.preventDefault();
                onTitleCommit(e.currentTarget.value);
                setRenaming(false);
              } else if (e.key === "Escape") {
                e.preventDefault();
                setRenaming(false);
              }
            }}
            onBlur={(e) => {
              onTitleCommit(e.currentTarget.value);
              setRenaming(false);
            }}
          />
        ) : onTitleCommit ? (
          <span
            className="panel-title-text panel-title-renamable"
            title={`${resolvedTitle} — ${renameLabel}`}
            role="button"
            tabIndex={0}
            aria-label={`${resolvedTitle} — ${renameLabel}`}
            onDoubleClick={() => setRenaming(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "F2") {
                e.preventDefault();
                setRenaming(true);
              }
            }}
          >
            {resolvedTitle}
          </span>
        ) : (
          <span className="panel-title-text" title={resolvedTitle}>
            {resolvedTitle}
          </span>
        )}
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

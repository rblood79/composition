/**
 * ActionList - 액션 목록 컴포넌트
 *
 * 액션 블록 목록을 렌더링하고 순서 변경을 지원
 * 향후 dnd-kit 통합을 위한 구조 준비
 */

import { Button } from "react-aria-components";
import { ChevronUp, ChevronDown } from "lucide-react";
import type { BlockEventAction } from "../types/eventBlockTypes";
import { ActionBlock } from "./ActionBlock";
import { iconProps, iconSmall } from "../../../../utils/ui/uiConstants";
import { ACTION_ICONS } from "../../../config/actionIcons";

/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const AddIcon = ACTION_ICONS.add;

interface ActionListProps {
  /** 액션 목록 */
  actions: BlockEventAction[];

  /** 액션 클릭 핸들러 (편집 모드 진입) */
  onActionClick?: (action: BlockEventAction) => void;

  /** 액션 삭제 핸들러 */
  onRemoveAction?: (actionId: string) => void;

  /** 액션 순서 변경 핸들러 */
  onReorderActions?: (fromIndex: number, toIndex: number) => void;

  /** 액션 업데이트 핸들러 */
  onUpdateAction?: (
    actionId: string,
    updates: Partial<BlockEventAction>,
  ) => void;

  /** 액션 추가 버튼 클릭 핸들러 */
  onAddAction?: () => void;

  /** 확장된 액션 ID */
  expandedActionId?: string | null;

  /** 액션 확장 토글 핸들러 */
  onToggleActionExpand?: (actionId: string) => void;

  /** 빈 목록 메시지 */
  emptyMessage?: string;

  /** 비활성화 여부 */
  isDisabled?: boolean;

  /** reorder 버튼 표시 여부 */
  showReorderButtons?: boolean;
}

/**
 * 액션 목록 컴포넌트
 *
 * @example
 * <ActionList
 *   actions={handler.thenActions}
 *   onActionClick={(action) => setSelectedAction(action)}
 *   onRemoveAction={(id) => removeAction(id)}
 *   onReorderActions={(from, to) => reorderActions(from, to)}
 *   onAddAction={() => setShowActionPicker(true)}
 * />
 */
export function ActionList({
  actions,
  onActionClick,
  onRemoveAction,
  onReorderActions,
  onAddAction,
  expandedActionId,
  onToggleActionExpand,
  emptyMessage = "No actions",
  isDisabled = false,
  showReorderButtons = true,
}: ActionListProps) {
  const handleMoveUp = (index: number) => {
    if (index > 0 && onReorderActions) {
      onReorderActions(index, index - 1);
    }
  };

  const handleMoveDown = (index: number) => {
    if (index < actions.length - 1 && onReorderActions) {
      onReorderActions(index, index + 1);
    }
  };

  if (actions.length === 0) {
    return (
      <div className="action-list action-list-empty">
        <span>{emptyMessage}</span>
        {onAddAction && (
          <Button
            className="add-action-btn"
            onPress={onAddAction}
            isDisabled={isDisabled}
          >
            <AddIcon size={iconSmall.size} />
            <span>Add action</span>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="action-list" role="list" aria-label="Action list">
      {actions.map((action, index) => (
        <div key={action.id} className="action-list-item">
          {/* Reorder Buttons */}
          {showReorderButtons && onReorderActions && (
            <div className="action-reorder-buttons">
              <Button
                className="iconButton action-reorder-btn"
                onPress={() => handleMoveUp(index)}
                isDisabled={isDisabled || index === 0}
                aria-label="Move action up"
              >
                <ChevronUp
                  size={iconSmall.size}
                  color={iconProps.color}
                  strokeWidth={iconProps.strokeWidth}
                />
              </Button>
              <Button
                className="iconButton action-reorder-btn"
                onPress={() => handleMoveDown(index)}
                isDisabled={isDisabled || index === actions.length - 1}
                aria-label="Move action down"
              >
                <ChevronDown
                  size={iconSmall.size}
                  color={iconProps.color}
                  strokeWidth={iconProps.strokeWidth}
                />
              </Button>
            </div>
          )}

          {/* Action Block */}
          <div className="action-list-item-content">
            <ActionBlock
              action={action}
              index={index + 1}
              onClick={() => onActionClick?.(action)}
              onRemove={() => onRemoveAction?.(action.id)}
              isExpanded={expandedActionId === action.id}
              onToggleExpand={
                onToggleActionExpand
                  ? () => onToggleActionExpand(action.id)
                  : undefined
              }
            />
          </div>
        </div>
      ))}

      {/* Add Action Button at bottom */}
      {onAddAction && (
        <div className="action-list-add">
          <Button
            className="add-action-btn"
            onPress={onAddAction}
            isDisabled={isDisabled}
          >
            <AddIcon size={iconSmall.size} />
            <span>Add action</span>
          </Button>
        </div>
      )}
    </div>
  );
}

/**
 * ThenElseBlock - THEN/ELSE 분기 블록
 *
 * 조건 만족/불만족 시 실행될 액션 목록을 담는 컨테이너
 * ActionList를 포함하며 드래그 앤 드롭 정렬 지원
 */

import { useState } from "react";
import { Button } from "react-aria-components";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { BlockEventAction } from "../types/eventBlockTypes";
import type { ActionType } from "../types/eventTypes";
import { ActionBlock } from "./ActionBlock";
import { BlockConnector } from "./BlockConnector";
import { RecommendedActionsChips } from "../components/RecommendedActionsChips";
import { iconProps, iconSmall } from "../../../../utils/ui/uiConstants";
import { ACTION_ICONS } from "../../../config/actionIcons";

/** 여러 화면에 공통으로 나오는 액션의 아이콘 정본 (`config/actionIcons.ts`). */
const AddIcon = ACTION_ICONS.add;

interface ThenElseBlockProps {
  /** 블록 타입: 'then' 또는 'else' */
  type: "then" | "else";

  /** 액션 목록 */
  actions: BlockEventAction[];

  /** 액션 추가 버튼 클릭 핸들러 */
  onAddAction: () => void;

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

  /** 상위 커넥터 표시 여부 */
  showConnector?: boolean;

  /** 비활성화 여부 */
  isDisabled?: boolean;

  /** 초기 접힘 상태 */
  defaultCollapsed?: boolean;

  /** 현재 이벤트 타입 (추천 액션용) */
  eventType?: string;

  /** 컴포넌트 타입 (추천 액션용) */
  componentType?: string;

  /** 추천 액션 빠른 추가 핸들러 */
  onQuickAddAction?: (actionType: ActionType) => void;
}

/**
 * THEN/ELSE 분기 블록 컴포넌트
 *
 * @example
 * <ThenElseBlock
 *   type="then"
 *   actions={handler.thenActions}
 *   onAddAction={() => setShowActionPicker(true)}
 *   onActionClick={(action) => setSelectedAction(action)}
 *   onRemoveAction={(id) => removeAction(id)}
 * />
 */
export function ThenElseBlock({
  type,
  actions,
  onAddAction,
  onActionClick,
  onRemoveAction,
  showConnector = true,
  isDisabled = false,
  defaultCollapsed = false,
  eventType,
  componentType,
  onQuickAddAction,
}: ThenElseBlockProps) {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);

  const isThen = type === "then";
  const blockClass = isThen ? "then-block" : "else-block";
  const label = isThen ? "THEN" : "ELSE";
  const ariaLabel = isThen
    ? "Actions when condition is true"
    : "Actions when condition is false";

  const handleToggleActionExpand = (actionId: string) => {
    setExpandedActionId((prev) => (prev === actionId ? null : actionId));
  };

  return (
    <div className={`branch-block ${blockClass}`}>
      {/* Connector from IF block */}
      {showConnector && (
        <BlockConnector
          direction="down"
          className={isThen ? "success" : "fallback"}
        />
      )}

      {/* Block Container */}
      <div
        className="block-container"
        role="region"
        aria-label={ariaLabel}
        data-block-type={type}
      >
        {/* Header */}
        <div className="block-header">
          <Button
            className="iconButton block-collapse-btn"
            onPress={() => setIsCollapsed(!isCollapsed)}
            aria-expanded={!isCollapsed}
            aria-label={
              isCollapsed ? `Expand ${label} block` : `Collapse ${label} block`
            }
          >
            {isCollapsed ? (
              <ChevronRight
                size={iconProps.size}
                color={iconProps.color}
                strokeWidth={iconProps.strokeWidth}
              />
            ) : (
              <ChevronDown
                size={iconProps.size}
                color={iconProps.color}
                strokeWidth={iconProps.strokeWidth}
              />
            )}
          </Button>

          <span className="block-label">{label}</span>

          <span className="block-count">
            {actions.length} action{actions.length !== 1 ? "s" : ""}
          </span>

          <div className="block-header-spacer" />

          {/* Add Action Button */}
          <Button
            className="iconButton block-collapse-btn"
            onPress={onAddAction}
            isDisabled={isDisabled}
            aria-label={`Add action to ${label}`}
          >
            <AddIcon
              size={iconProps.size}
              color={iconProps.color}
              strokeWidth={iconProps.strokeWidth}
            />
          </Button>
        </div>

        {/* Action List */}
        {!isCollapsed && (
          <div
            className="block-content"
            role="list"
            aria-label={`${label} actions`}
          >
            {actions.length === 0 ? (
              <div className="block-empty">
                <span>No actions</span>
                {/* 추천 액션 chips (빈 상태) */}
                {eventType && componentType && onQuickAddAction && (
                  <RecommendedActionsChips
                    eventType={eventType}
                    componentType={componentType}
                    existingActions={actions}
                    onAddAction={onQuickAddAction}
                  />
                )}
                <Button
                  className="add-action-btn"
                  onPress={onAddAction}
                  isDisabled={isDisabled}
                >
                  <AddIcon size={iconSmall.size} />
                  <span>More actions</span>
                </Button>
              </div>
            ) : (
              <>
                {actions.map((action, index) => (
                  <ActionBlock
                    key={action.id}
                    action={action}
                    index={index + 1}
                    onClick={() => onActionClick?.(action)}
                    onRemove={() => onRemoveAction?.(action.id)}
                    isExpanded={expandedActionId === action.id}
                    onToggleExpand={() => handleToggleActionExpand(action.id)}
                  />
                ))}
                {/* 추천 액션 chips (액션 있는 상태 - 미등록 타입만) */}
                {eventType && componentType && onQuickAddAction && (
                  <RecommendedActionsChips
                    eventType={eventType}
                    componentType={componentType}
                    existingActions={actions}
                    onAddAction={onQuickAddAction}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

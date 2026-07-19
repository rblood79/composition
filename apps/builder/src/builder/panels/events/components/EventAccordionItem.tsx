/**
 * EventAccordionItem — ADR-149 Phase 2b, L2 inline accordion 본체.
 *
 * 단일 EventHandler 의 액션 목록 · 추가 · 고급 설정(조건/타이밍) · 삭제를
 * **overlay 없이 depth 2 이내** 로 inline 렌더한다 (HC1). 기존 block editor 트리
 * (WhenBlock/IfBlock/ThenElseBlock) 의 3~4 depth + overlay 를 대체.
 *
 * - 액션 config 편집: `BlockActionEditor` (25종 ActionEditor 래핑) inline expand
 * - 추가: `RecommendedActionsChips`(③) + `ActionTypePicker`(inline)
 * - 고급: `ConditionEditor` + `DebounceThrottleEditor`
 * - 누락 경고(④): config 미설정 액션 표시
 *
 * @see docs/adr/design/149-events-panel-canonical-simplification-breakdown.md §Phase 2b
 */

import { useState, useCallback } from "react";
import { Button } from "react-aria-components";
import {
  ChevronDown,
  ChevronRight,
  Trash2,
  Plus,
  Settings2,
  AlertTriangle,
} from "lucide-react";
import type {
  EventHandler,
  EventAction,
  ActionType,
} from "../types/eventTypes";
import { ACTION_TYPE_LABELS } from "../types/eventTypes";
import type { BlockEventAction } from "../types/eventBlockTypes";
import { BlockActionEditor } from "../editors/BlockActionEditor";
import { ActionTypePicker } from "../pickers/ActionTypePicker";
import { RecommendedActionsChips } from "./RecommendedActionsChips";
import { ConditionEditor } from "./ConditionEditor";
import { DebounceThrottleEditor } from "./DebounceThrottleEditor";
import { normalizeToInspectorAction } from "../utils/normalizeEventTypes";
import { iconProps, iconEditProps } from "../../../../utils/ui/uiConstants";

interface EventAccordionItemProps {
  /** 편집 중인 이벤트 핸들러 */
  handler: EventHandler;
  /** 추천 액션 컨텍스트용 컴포넌트 타입 */
  componentType: string;
  /** 핸들러 전체 갱신 (canonical write 는 상위에서 처리) */
  onUpdate: (updated: EventHandler) => void;
  /** 이 이벤트 핸들러 제거 */
  onRemove: () => void;
}

/** EventAction → BlockActionEditor 가 기대하는 BlockEventAction 으로 정규화. */
function toBlockAction(action: EventAction, index: number): BlockEventAction {
  return {
    id: action.id ?? `action-${index}`,
    type: action.type,
    config: action.config ?? {},
    delay: action.delay,
    condition: action.condition,
    enabled: action.enabled !== false,
  };
}

/** 액션 config 에서 대표 값 1개를 짧은 요약으로 추출. */
function summarizeAction(action: EventAction): string {
  const c = (action.config ?? {}) as Record<string, unknown>;
  const primary =
    c.path ??
    c.url ??
    c.endpoint ??
    c.message ??
    c.modalId ??
    c.elementId ??
    c.targetId ??
    c.storePath ??
    c.formId ??
    c.text ??
    c.dataTableName ??
    c.sourceId;
  return typeof primary === "string" && primary.trim() !== ""
    ? String(primary)
    : "";
}

/** 액션 config 가 비어 있으면 설정 필요로 간주 (누락 경고 ④). */
function isActionUnconfigured(action: EventAction): boolean {
  const c = (action.config ?? {}) as Record<string, unknown>;
  return Object.keys(c).length === 0 || summarizeAction(action) === "";
}

export function EventAccordionItem({
  handler,
  componentType,
  onUpdate,
  onRemove,
}: EventAccordionItemProps) {
  const [expandedActionId, setExpandedActionId] = useState<string | null>(null);
  const [showAddPicker, setShowAddPicker] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const actions = handler.actions ?? [];

  // 액션 추가
  const handleAddAction = useCallback(
    (actionType: ActionType) => {
      const normalized = normalizeToInspectorAction(actionType);
      const newAction: EventAction = {
        id: `action-${normalized}-${actions.length}-${handler.id}`,
        type: normalized,
        config: {},
      };
      onUpdate({ ...handler, actions: [...actions, newAction] });
      setExpandedActionId(newAction.id ?? null);
      setShowAddPicker(false);
    },
    [handler, actions, onUpdate],
  );

  // 액션 갱신 (BlockActionEditor onChange)
  const handleUpdateAction = useCallback(
    (index: number, updated: BlockEventAction) => {
      const nextActions = actions.map((a, i) =>
        i === index
          ? {
              ...a,
              type: updated.type as EventAction["type"],
              config: updated.config,
              delay: updated.delay,
              condition: updated.condition,
              enabled: updated.enabled,
            }
          : a,
      );
      onUpdate({ ...handler, actions: nextActions });
    },
    [handler, actions, onUpdate],
  );

  // 액션 제거
  const handleRemoveAction = useCallback(
    (index: number) => {
      const nextActions = actions.filter((_, i) => i !== index);
      onUpdate({ ...handler, actions: nextActions });
      setExpandedActionId(null);
    },
    [handler, actions, onUpdate],
  );

  // 조건 변경
  const handleConditionChange = useCallback(
    (condition: string | undefined) => {
      onUpdate({ ...handler, condition });
    },
    [handler, onUpdate],
  );

  // 타이밍(debounce/throttle) 변경
  const handleTimingChange = useCallback(
    (settings: { debounce?: number; throttle?: number }) => {
      onUpdate({ ...handler, ...settings });
    },
    [handler, onUpdate],
  );

  const unconfiguredCount = actions.filter(isActionUnconfigured).length;
  const hasAdvanced =
    Boolean(handler.condition) ||
    Boolean(handler.debounce) ||
    Boolean(handler.throttle);

  return (
    <div className="event-accordion-body">
      {/* 액션 목록 */}
      {actions.length === 0 ? (
        <p className="event-accordion-empty">아직 액션이 없습니다.</p>
      ) : (
        <ul className="event-action-list">
          {actions.map((action, index) => {
            const actionId = action.id ?? `action-${index}`;
            const expanded = expandedActionId === actionId;
            const summary = summarizeAction(action);
            const unconfigured = isActionUnconfigured(action);
            return (
              <li key={actionId} className="event-action-item">
                <button
                  type="button"
                  className="event-action-summary"
                  onClick={() =>
                    setExpandedActionId(expanded ? null : actionId)
                  }
                  aria-expanded={expanded}
                >
                  {expanded ? (
                    <ChevronDown size={iconEditProps.size} />
                  ) : (
                    <ChevronRight size={iconEditProps.size} />
                  )}
                  <span className="event-action-name">
                    {ACTION_TYPE_LABELS[action.type] ?? action.type}
                  </span>
                  {summary ? (
                    <span className="event-action-detail">{summary}</span>
                  ) : (
                    <span className="event-action-detail is-warning">
                      설정 필요
                    </span>
                  )}
                  {unconfigured && (
                    <AlertTriangle
                      className="event-action-warn-icon"
                      size={iconEditProps.size}
                    />
                  )}
                </button>
                {expanded && (
                  <div className="event-action-editor">
                    <BlockActionEditor
                      action={toBlockAction(action, index)}
                      onChange={(updated) => handleUpdateAction(index, updated)}
                      onRemove={() => handleRemoveAction(index)}
                      showTitle={false}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* 추천 액션 chips (③) */}
      <RecommendedActionsChips
        eventType={handler.event}
        componentType={componentType}
        existingActions={actions.map((a, i) => toBlockAction(a, i))}
        onAddAction={handleAddAction}
      />

      {/* 액션 추가 */}
      {showAddPicker ? (
        <div className="event-add-action-picker">
          <ActionTypePicker
            onSelect={handleAddAction}
            inline
            placeholder="액션 선택..."
          />
          <Button
            className="iconButton"
            onPress={() => setShowAddPicker(false)}
            aria-label="Cancel"
          >
            취소
          </Button>
        </div>
      ) : (
        <Button
          className="event-add-action-btn"
          onPress={() => setShowAddPicker(true)}
        >
          <Plus size={iconEditProps.size} />
          <span>액션 추가</span>
        </Button>
      )}

      {/* 누락 경고 (④) */}
      {unconfiguredCount > 0 && (
        <div className="event-warning-banner" role="status">
          <AlertTriangle size={iconEditProps.size} />
          <span>{unconfiguredCount}개 액션의 설정이 비어 있습니다.</span>
        </div>
      )}

      {/* 고급 설정 */}
      <div className="event-advanced">
        <Button
          className="event-advanced-toggle"
          onPress={() => setAdvancedOpen((v) => !v)}
          aria-expanded={advancedOpen}
        >
          {advancedOpen ? (
            <ChevronDown size={iconEditProps.size} />
          ) : (
            <ChevronRight size={iconEditProps.size} />
          )}
          <Settings2 size={iconEditProps.size} />
          <span>고급</span>
          {hasAdvanced && !advancedOpen && (
            <span className="event-advanced-dot" aria-hidden />
          )}
        </Button>
        {advancedOpen && (
          <div className="event-advanced-body">
            <ConditionEditor
              condition={handler.condition}
              onChange={handleConditionChange}
              label="실행 조건 (선택)"
            />
            <DebounceThrottleEditor
              debounce={handler.debounce}
              throttle={handler.throttle}
              onChange={handleTimingChange}
            />
          </div>
        )}
      </div>

      {/* 이벤트 핸들러 제거 */}
      <Button
        className="event-remove-handler-btn"
        onPress={onRemove}
        aria-label={`Remove ${handler.event}`}
      >
        <Trash2 size={iconProps.size} color={iconProps.color} />
        <span>이벤트 제거</span>
      </Button>
    </div>
  );
}

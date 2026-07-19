/**
 * EventsPanel — 이벤트 관리 패널 (ADR-149 Phase 2b, 2-depth UX)
 *
 * L1 — supportedEvents callback props 목록 (바인딩 상태 표시). 빈 상태에서 추천
 *      이벤트 chips(①) + 템플릿 chips(②).
 * L2 — 행 클릭 시 inline accordion(`EventAccordionItem`) — overlay 0, depth ≤ 2 (HC1).
 *
 * 읽기 = `selectedElement.events`(canonical-synced legacy projection). 쓰기 =
 * canonical write 단일 진입점 `updateEventsRootCollection`(2a wrapper — updateAndSave
 * [node projection + history + persist] + writeEventsToRootCollection[root 파생]).
 * canonical-hook 읽기 + 역방향 adapter 전환은 Phase 3 (HC3/HC5).
 *
 * 비활성 gating 은 PanelContainer 의 <Activity mode="hidden"> 이 담당 (ADR-155).
 *
 * @see docs/adr/149-events-panel-canonical-simplification.md (Phase 2b)
 */

import { useState, useCallback } from "react";
import {
  ChevronDown,
  ChevronRight,
  Zap,
  SquareMousePointer,
} from "lucide-react";
import type { SelectedElement } from "../../inspector/types";
import type { EventHandler, EventType } from "./types/eventTypes";
import { EVENT_TYPE_LABELS } from "./types/eventTypes";
import { isImplementedEventType } from "@/types/events/events.types";
import { useDebouncedSelectedElementData, useStore } from "../../stores";
import { useEventHandlers } from "./state/useEventHandlers";
import { RecommendedEventsSection } from "./components/RecommendedEventsSection";
import { TemplateSuggestionSection } from "./components/TemplateSuggestionSection";
import { EventAccordionItem } from "./components/EventAccordionItem";
import { generateEventHandlerIds } from "./hooks/useApplyTemplate";
import type { EventTemplate } from "./data/eventTemplates";
import {
  iconProps,
  iconEditProps,
  iconLarge,
} from "../../../utils/ui/uiConstants";
import { PanelHeader, EmptyState } from "../../components";
import { useInitialMountDetection } from "@/builder/hooks";
import { useComponentMeta } from "../../hooks";
import "./EventsPanel.css";

export function EventsPanel() {
  const selectedElement = useDebouncedSelectedElementData();

  if (!selectedElement) {
    return (
      <div className="events-panel">
        <PanelHeader
          icon={<SquareMousePointer size={iconProps.size} />}
          title="Events"
        />
        <div className="panel-contents">
          <EmptyState message="요소를 선택하세요" />
        </div>
      </div>
    );
  }

  // key prop 으로 요소 변경 시 로컬 핸들러 상태 리마운트
  return (
    <EventsPanelContent
      key={selectedElement.id}
      selectedElement={selectedElement}
    />
  );
}

interface EventsPanelContentProps {
  selectedElement: SelectedElement;
}

function EventsPanelContent({ selectedElement }: EventsPanelContentProps) {
  const componentMeta = useComponentMeta(selectedElement?.type);

  // 컴포넌트가 지원하는 이벤트 타입 (구현된 것만)
  const supportedEvents = (
    (componentMeta?.inspector.supportedEvents || []) as EventType[]
  ).filter((event): event is EventType => isImplementedEventType(event));

  // canonical write 단일 진입점 (2a wrapper)
  const updateEventsRoot = useStore(
    (state) => state.updateEventsRootCollection,
  );

  const eventsFromElement = (selectedElement?.events || []) as EventHandler[];
  const { handlers, addHandler, updateHandler, removeHandler } =
    useEventHandlers(eventsFromElement);

  // 로컬 핸들러 변경 → canonical write (초기 마운트 echo 제외)
  const handleHandlersUpdate = useCallback(
    (updatedHandlers: EventHandler[]) => {
      updateEventsRoot(selectedElement.id, updatedHandlers);
    },
    [updateEventsRoot, selectedElement.id],
  );
  useInitialMountDetection({
    data: handlers,
    onUpdate: handleHandlersUpdate,
    resetKey: selectedElement?.id,
  });

  // 단일 open accordion — 현재 펼쳐진 이벤트 타입
  const [expandedEvent, setExpandedEvent] = useState<EventType | null>(null);

  const registeredEventTypes = handlers
    .map((h) => h.event)
    .filter((event): event is EventType => isImplementedEventType(event));

  // L1 표시 대상: 지원 이벤트 + (지원 목록 밖이지만 이미 바인딩된) 이벤트
  const displayEvents: EventType[] = [
    ...supportedEvents,
    ...registeredEventTypes.filter((e) => !supportedEvents.includes(e)),
  ];

  const handlerByEvent = (eventType: EventType): EventHandler | undefined =>
    handlers.find((h) => h.event === eventType);

  // 행 클릭 — 펼치기/접기 (미바인딩이면 핸들러 생성 후 펼침)
  const handleToggleEvent = (eventType: EventType) => {
    if (expandedEvent === eventType) {
      setExpandedEvent(null);
      return;
    }
    if (!handlerByEvent(eventType)) {
      addHandler(eventType);
    }
    setExpandedEvent(eventType);
  };

  // 템플릿 적용 (이벤트 + 액션 일괄 생성)
  const handleApplyTemplate = useCallback(
    (template: EventTemplate) => {
      const templateEvents = generateEventHandlerIds(template.events, "tpl");
      let firstEvent: EventType | null = null;
      for (const templateEvent of templateEvents) {
        const existing = handlers.find((h) => h.event === templateEvent.event);
        if (existing) {
          updateHandler(existing.id, {
            ...existing,
            actions: [...existing.actions, ...templateEvent.actions],
          });
        } else {
          const created = addHandler(templateEvent.event);
          updateHandler(created.id, {
            ...created,
            actions: templateEvent.actions,
          });
        }
        if (!firstEvent && isImplementedEventType(templateEvent.event)) {
          firstEvent = templateEvent.event as EventType;
        }
      }
      if (firstEvent) setExpandedEvent(firstEvent);
    },
    [handlers, addHandler, updateHandler],
  );

  return (
    <div className="events-panel">
      <PanelHeader
        icon={<SquareMousePointer size={iconProps.size} />}
        title="Events"
      />

      <div className="panel-contents">
        {displayEvents.length === 0 ? (
          <EmptyState
            icon={
              <Zap
                size={iconLarge.size}
                color={iconProps.color}
                strokeWidth={iconProps.strokeWidth}
              />
            }
            message="이벤트를 지원하지 않는 컴포넌트입니다"
            description="다른 요소를 선택하세요"
          />
        ) : (
          <>
            {/* 빈 상태: 추천 이벤트 chips(①) + 템플릿 chips(②) */}
            {handlers.length === 0 && (
              <>
                <RecommendedEventsSection
                  componentType={selectedElement.type}
                  registeredEvents={registeredEventTypes}
                  onAddEvent={handleToggleEvent}
                />
                <TemplateSuggestionSection
                  componentType={selectedElement.type}
                  currentHandlers={handlers}
                  onApplyTemplate={handleApplyTemplate}
                />
              </>
            )}

            {/* L1 — supportedEvents callback 목록 */}
            <ul className="event-callback-list">
              {displayEvents.map((eventType) => {
                const handler = handlerByEvent(eventType);
                const bound = Boolean(handler);
                const actionCount = handler?.actions?.length ?? 0;
                const expanded = expandedEvent === eventType;
                return (
                  <li key={eventType} className="event-callback-item">
                    <button
                      type="button"
                      className={`event-callback-row${bound ? " is-bound" : ""}`}
                      onClick={() => handleToggleEvent(eventType)}
                      aria-expanded={expanded}
                    >
                      {expanded ? (
                        <ChevronDown size={iconEditProps.size} />
                      ) : (
                        <ChevronRight size={iconEditProps.size} />
                      )}
                      <Zap
                        className="event-callback-icon"
                        size={iconEditProps.size}
                        color={iconProps.color}
                        strokeWidth={iconProps.strokeWidth}
                      />
                      <span className="event-callback-name">
                        {EVENT_TYPE_LABELS[eventType] ?? eventType}
                      </span>
                      <span className="event-callback-status">
                        {bound
                          ? `${actionCount} 액션${actionCount !== 1 ? "s" : ""}`
                          : "미설정"}
                      </span>
                    </button>
                    {expanded && handler && (
                      <EventAccordionItem
                        handler={handler}
                        componentType={selectedElement.type}
                        onUpdate={(updated) =>
                          updateHandler(updated.id, updated)
                        }
                        onRemove={() => {
                          removeHandler(handler.id);
                          setExpandedEvent(null);
                        }}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

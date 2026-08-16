/**
 * Event Type Registry — RAC 실존 callback 어휘 (ADR-055 → ADR-158 Phase 4 축소)
 *
 * **ADR-158 Phase 4 (2026-08-16)**: 구 24종 중 **DOM 별칭 10종**
 * (onClick / onDoubleClick / onMouseEnter / onMouseLeave / onMouseDown /
 * onMouseUp / onKeyDown / onKeyUp / onKeyPress / onInput) 과 **비RAC·미구현 3종**
 * (onScroll / onResize / onLoad) 이 은퇴했다. `IMPLEMENTED_ACTION_TYPES` 47종
 * (camelCase 28 + snake_case 별칭 19) 과 그 레이블·카테고리 맵도 함께 사라졌다 —
 * Do 축은 `CAPABILITY_REGISTRY` (`@composition/shared`) 가 소유한다.
 *
 * 남은 11종은 RAC 레퍼런스에 실존하는 callback 이다.
 *
 * **ADR-158 Phase 4 후속 (2026-08-17): 소비자 0** — 마지막 소비자였던
 * `ItemsManager` 의 `event-id` 드롭다운(Menu/ComboBox/Select `onActionId`)이
 * dead 채널 제거로 사라졌다. 본 파일과 `eventRegistryVocabulary.test.ts` 는
 * 삭제 대기 (파일 삭제는 별도 승인 절차).
 *
 * ⚠️ 인터랙션 규칙의 트리거 어휘는 **여기가 아니라** `CAPABILITY_REGISTRY[type].events`
 * 다 (컴포넌트별로 노출 가능한 callback 이 다르므로). 본 registry 는 컴포넌트를
 * 가리지 않는 평면 목록이라 그 용도로 쓰면 안 된다.
 *
 * @see docs/adr/completed/158-interactions-rules-capability-registry.md
 */

// ===== 이벤트 카테고리 ID =====

/** `mouse` / `keyboard` / `other` 는 해당 어휘가 전부 은퇴하며 함께 사라졌다. */
export type EventCategoryId = "form" | "reactAria";

// ===== 이벤트 정의 인터페이스 =====

interface EventDef {
  label: string;
  category: EventCategoryId;
}

// ===== 정본: EVENT_REGISTRY =====

export const EVENT_REGISTRY = {
  // Form Events
  onChange: {
    label: "값 변경",
    category: "form",
  },
  onSubmit: {
    label: "제출",
    category: "form",
  },
  onFocus: {
    label: "포커스",
    category: "form",
  },
  onBlur: {
    label: "포커스 해제",
    category: "form",
  },

  // React Aria Events
  onPress: {
    label: "프레스",
    category: "reactAria",
  },
  onSelectionChange: {
    label: "선택 변경",
    category: "reactAria",
  },
  onAction: {
    label: "액션",
    category: "reactAria",
  },
  onOpenChange: {
    label: "열림/닫힘",
    category: "reactAria",
  },
  onChangeEnd: {
    label: "값 변경 완료",
    category: "reactAria",
  },
  onExpandedChange: {
    label: "펼침/접힘 변경",
    category: "reactAria",
  },
  onRemove: {
    label: "항목 제거",
    category: "reactAria",
  },
} as const satisfies Record<string, EventDef>;

// ===== 파생 =====

/** registry 에 실존하는 이벤트 타입 */
export type EventType = keyof typeof EVENT_REGISTRY;

/** 이벤트 타입 → 한글 레이블 매핑 */
export const EVENT_TYPE_LABELS = Object.fromEntries(
  (Object.entries(EVENT_REGISTRY) as [EventType, EventDef][]).map(([k, v]) => [
    k,
    v.label,
  ]),
) as Record<EventType, string>;

/** 카테고리별 이벤트 목록 (자동 집계) */
export const EVENT_CATEGORIES_BY_ID = (
  Object.entries(EVENT_REGISTRY) as [EventType, EventDef][]
).reduce<Record<EventCategoryId, EventType[]>>(
  (acc, [key, def]) => {
    if (!acc[def.category]) acc[def.category] = [];
    acc[def.category].push(key);
    return acc;
  },
  {} as Record<EventCategoryId, EventType[]>,
);

// ===== 타입 가드 =====

/** 이벤트 타입이 registry 에 존재하는지 확인 */
export function isEventType(eventType: string): eventType is EventType {
  return eventType in EVENT_REGISTRY;
}

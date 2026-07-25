/**
 * @fileoverview ADR-131 Phase 2 — Root collection migration adapter.
 *
 * legacy `Element.events` / `Element.dataBinding` (또는 deprecated
 * `CompositionExtension.events` / `dataBinding` / `actions`) 를 ADR-131 root
 * collection `CompositionDocument.events|data|actions` 로 이동.
 *
 * **scope**:
 * - `migrateLegacyEventsToRootEvents`: `Element.events: EventHandler[]` →
 *   `SerializedEvent[]` + `SerializedAction[]` (chain) — target = element.id 자동 binding
 * - `migrateLegacyDataBindingToRootData`: `Element.dataBinding: DataBinding` →
 *   `SerializedData`. id 생성 (`db_<elementId>`) — id 충돌 회피
 * - `mergeIntoDocument`: 변환 결과를 `CompositionDocument.events|data|actions` 에 병합
 *
 * **id 충돌 회피**: 같은 element 의 events 가 여러 EventHandler 를 포함하면 각
 * handler.id 가 그대로 SerializedEvent.id. handler.actions 의 action.id 가 없으면
 * 자동 생성 (`<eventId>__a<index>`).
 *
 * **round-trip 보존**: `migrateRootCollectionToLegacy` (역방향) 가 `target` 별
 * grouping 으로 Element.events[] 복원. canonical->legacy export 시 사용.
 *
 * **dev data 0 가정**: 사용자 IndexedDB 실 데이터에 events/dataBinding 사용처
 * 거의 미존재 (사용자 confirm 2026-05-12). Phase 2 시점 migration helper 는
 * 주로 unit test fixture 와 향후 신규 data 변환을 위한 primitive.
 *
 * @see docs/adr/131-events-data-actions-first-class-collections.md §Phase 2
 * @see docs/adr/design/131-events-data-actions-first-class-collections-breakdown.md §3
 */

import type {
  CompositionDocument,
  SerializedAction,
  SerializedEvent,
} from "@composition/shared";
import type { Element } from "../../types/builder/unified.types";

/**
 * legacy EventHandler shape — `apps/builder/src/builder/panels/events/types/eventTypes.ts`
 * 의 `EventHandler` 를 schema dependency 없이 받는 generic shape.
 */
interface LegacyEventHandlerShape {
  id: string;
  event: string;
  actions?: LegacyEventActionShape[];
  elseActions?: LegacyEventActionShape[];
  condition?: string | Record<string, unknown>;
  [k: string]: unknown;
}

interface LegacyEventActionShape {
  id?: string;
  type: string;
  config?: Record<string, unknown>;
  [k: string]: unknown;
}

/**
 * `Element.events` (legacy EventHandler[]) → ADR-131 root collection
 * `SerializedEvent[]` + `SerializedAction[]`.
 *
 * - 각 `EventHandler` 1개 → `SerializedEvent` 1개 + chain action n개
 * - `handler.actions[0]` 이 `SerializedEvent.actionRef` (chain head)
 * - `handler.actions[i+1]` 이 `handler.actions[i].next[]`
 * - `handler.elseActions` 가 있으면 별 chain 으로 변환 후
 *   `SerializedEvent.fallbackActionRef` 에 head 부착
 * - action id 미정의 시 `<eventId>__a<index>` / `<eventId>__e<index>` 자동 생성
 *
 * `target` = element.id (event 발생 대상 UI node id).
 */
export function migrateLegacyEventsToRootEvents(
  elementId: string,
  legacyEvents: readonly LegacyEventHandlerShape[] | undefined,
): { events: SerializedEvent[]; actions: SerializedAction[] } {
  if (!legacyEvents || legacyEvents.length === 0) {
    return { events: [], actions: [] };
  }

  const events: SerializedEvent[] = [];
  const actions: SerializedAction[] = [];

  for (const handler of legacyEvents) {
    const event: SerializedEvent = {
      id: handler.id,
      type: "event",
      kind: handler.event,
      target: elementId,
    };

    if (handler.condition !== undefined) {
      event.condition =
        typeof handler.condition === "string"
          ? { expr: handler.condition }
          : handler.condition;
    }

    // ADR-149 Phase 3-a — round-trip fidelity: 패널 L2 고급이 편집하는 event-level
    // 필드를 index-sig slot 으로 보존 (reverse adapter 가 복원). 미정의는 미방출.
    if (handler.enabled !== undefined) event.enabled = handler.enabled;
    if (handler.debounce !== undefined) event.debounce = handler.debounce;
    if (handler.throttle !== undefined) event.throttle = handler.throttle;

    const thenChain = buildActionChain(handler.actions, `${handler.id}__a`);
    if (thenChain.head) {
      event.actionRef = thenChain.head;
      actions.push(...thenChain.list);
    }

    const elseChain = buildActionChain(handler.elseActions, `${handler.id}__e`);
    if (elseChain.head) {
      event.fallbackActionRef = elseChain.head;
      actions.push(...elseChain.list);
    }

    events.push(event);
  }

  return { events, actions };
}

function buildActionChain(
  legacyActions: readonly LegacyEventActionShape[] | undefined,
  idPrefix: string,
): { head: string | undefined; list: SerializedAction[] } {
  if (!legacyActions || legacyActions.length === 0) {
    return { head: undefined, list: [] };
  }

  const ids: string[] = legacyActions.map((a, i) => a.id ?? `${idPrefix}${i}`);

  const list: SerializedAction[] = legacyActions.map((legacy, i) => {
    const action: SerializedAction = {
      id: ids[i],
      type: "action",
      kind: legacy.type,
    };
    if (legacy.config !== undefined) {
      action.config = legacy.config;
    }
    // ADR-149 Phase 3-a — action-level fidelity 보존 (reverse 가 복원).
    if (legacy.delay !== undefined) action.delay = legacy.delay;
    if (legacy.condition !== undefined) action.condition = legacy.condition;
    if (legacy.enabled !== undefined) action.enabled = legacy.enabled;
    if (i + 1 < ids.length) {
      action.next = [ids[i + 1]];
    }
    return action;
  });

  return { head: ids[0], list };
}

/**
 * `migrateLegacyEventsToRootEvents` 의 역함수 — canonical root collection
 * (`SerializedEvent[]` + `SerializedAction[]`) 에서 특정 `target` UI node 의
 * legacy `EventHandler[]` 를 복원. ADR-149 Phase 3-a (HC5, rootCollectionMigration
 * :19 주석 실현). 2026-05-15 에 제거됐던 `rootEventsToLegacyByTarget` 의 재도입.
 *
 * - `event.target === targetId` 인 events 만 대상
 * - `actionRef` chain (`action.next[0]`) 을 순회하여 `actions[]` 복원 (visited set
 *   로 순환 차단)
 * - `fallbackActionRef` chain → `elseActions[]`
 * - `condition`: `{ expr: string }` → string 역변환 (그 외 Record 는 passthrough)
 * - fidelity slot (event `enabled`/`debounce`/`throttle`, action `delay`/`condition`/
 *   `enabled`) 복원 — forward 가 index-sig 로 보존한 것
 *
 * **round-trip 계약**: `migrateRootCollectionToLegacy(target,
 * migrateLegacyEventsToRootEvents(target, L).{events,actions})` === `L`
 * (id 명시 fixture 기준). id 미정의 action 은 forward 가 `<eventId>__a<i>` 생성 →
 * reverse 는 그 id 를 보존 (id 부여만 차이).
 */
export function migrateRootCollectionToLegacy(
  targetId: string,
  events: readonly SerializedEvent[] | undefined,
  actions: readonly SerializedAction[] | undefined,
): LegacyEventHandlerShape[] {
  if (!events || events.length === 0) return [];

  const actionById = new Map<string, SerializedAction>();
  for (const a of actions ?? []) actionById.set(a.id, a);

  const result: LegacyEventHandlerShape[] = [];
  for (const event of events) {
    if (event.target !== targetId) continue;

    const handler: LegacyEventHandlerShape = {
      id: event.id,
      event: event.kind,
      actions: event.actionRef
        ? walkActionChain(event.actionRef, actionById)
        : [],
    };

    if (event.condition !== undefined) {
      const expr = (event.condition as Record<string, unknown>).expr;
      handler.condition = typeof expr === "string" ? expr : event.condition;
    }
    if (event.enabled !== undefined) handler.enabled = event.enabled;
    if (event.debounce !== undefined) handler.debounce = event.debounce;
    if (event.throttle !== undefined) handler.throttle = event.throttle;

    if (event.fallbackActionRef) {
      const elseActions = walkActionChain(event.fallbackActionRef, actionById);
      if (elseActions.length > 0) handler.elseActions = elseActions;
    }

    result.push(handler);
  }
  return result;
}

/** actionRef chain (`next[0]`) 을 순회하여 legacy action list 복원 (순환 차단). */
function walkActionChain(
  headId: string,
  actionById: Map<string, SerializedAction>,
): LegacyEventActionShape[] {
  const out: LegacyEventActionShape[] = [];
  const visited = new Set<string>();
  let cur: string | undefined = headId;
  while (cur && !visited.has(cur)) {
    visited.add(cur);
    const action = actionById.get(cur);
    if (!action) break;
    const legacy: LegacyEventActionShape = { id: action.id, type: action.kind };
    if (action.config !== undefined) legacy.config = action.config;
    if (action.delay !== undefined) legacy.delay = action.delay;
    if (action.condition !== undefined) legacy.condition = action.condition;
    if (action.enabled !== undefined) legacy.enabled = action.enabled;
    out.push(legacy);
    cur = Array.isArray(action.next) ? action.next[0] : undefined;
  }
  return out;
}

// ADR-131 Phase 8 (2026-05-13): migrateLegacyDataBindingToRootData 제거.
// data SSOT 는 `collections` 등 별 store. `Element.dataBinding` 은 element 별
// binding reference 로 보존 (root collection 격상 의미 없음).

/**
 * legacy `Element[]` 전수 → root collection `events|actions` 변환.
 *
 * 각 element 의 `events` 를 추출하여 document 수준 collection 으로 흘려보낸다.
 * dev data 0 가정 (Phase 0 inventory) — 거의 빈 결과 예상.
 *
 * **사용처 (Phase 4)**: `legacyToCanonical()` 변환 직후 호출하여 결과 doc 에
 * `events|actions` 주입.
 *
 * **ADR-131 Phase 8 (2026-05-13)**: data 영역 제거 — data SSOT 는 `collections`
 * 등 별 store. `Element.dataBinding` 은 element 별 binding reference 로 보존.
 */
export function migrateLegacyElementsToRootCollections(
  elements: readonly Element[],
): {
  events: SerializedEvent[];
  actions: SerializedAction[];
} {
  const events: SerializedEvent[] = [];
  const actions: SerializedAction[] = [];

  for (const el of elements) {
    const legacyEventArray = Array.isArray(el.events)
      ? (el.events as LegacyEventHandlerShape[])
      : undefined;
    const eventResult = migrateLegacyEventsToRootEvents(
      el.id,
      legacyEventArray,
    );
    events.push(...eventResult.events);
    actions.push(...eventResult.actions);
  }

  return { events, actions };
}

/**
 * legacy 스키마(`SerializedEvent`) 시절의 document 형태.
 *
 * ADR-158 Phase 1 에서 `CompositionDocument.events` 의 entry 가 `InteractionRule`
 * 로 교체되면서, 본 legacy adapter 는 canonical 타입과 분리된 자기완결 형태로
 * 남는다 (production consumer 0 — Phase 4 에서 모듈째 삭제).
 */
export type LegacyRootCollectionDocument = Omit<
  CompositionDocument,
  "events"
> & {
  events?: SerializedEvent[];
};

/**
 * legacy document 에 root collection 결과를 병합.
 *
 * 기존 doc 의 events/actions 이 있으면 append. id 충돌 시 기존 entry 가 우선
 * (dedupe by id, first wins).
 *
 * **ADR-131 Phase 8 (2026-05-13)**: data 영역 제거.
 *
 * @deprecated ADR-158 Phase 1 — 신규 스키마는 `writeInteractionRulesToRootCollection`
 *   이 담당한다. 본 함수는 legacy 어휘 전용이며 Phase 4 에서 삭제된다.
 */
export function mergeIntoDocument(
  doc: LegacyRootCollectionDocument,
  collections: {
    events?: SerializedEvent[];
    actions?: SerializedAction[];
  },
): LegacyRootCollectionDocument {
  const existingEvents = doc.events ?? [];
  const existingActions = doc.actions ?? [];

  const newEvents = collections.events ?? [];
  const newActions = collections.actions ?? [];

  return {
    ...doc,
    ...(existingEvents.length || newEvents.length
      ? { events: dedupeById([...existingEvents, ...newEvents]) }
      : {}),
    ...(existingActions.length || newActions.length
      ? { actions: dedupeById([...existingActions, ...newActions]) }
      : {}),
  };
}

function dedupeById<T extends { id: string }>(list: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of list) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

// ADR-131 Phase 8 (2026-05-13): rootDataToLegacyByElement 제거.
// data SSOT 는 `collections` 등 별 store. `Element.dataBinding` 보존.
// 2026-05-15: rootEventsToLegacyByTarget 제거 — production caller 0.
// canonical-only runtime 에서 legacy Element.events round-trip 미사용.

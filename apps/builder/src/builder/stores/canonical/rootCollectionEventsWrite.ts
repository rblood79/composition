/**
 * @fileoverview ADR-149 Phase 2a — canonical events/actions root collection
 * write core.
 *
 * `syncEventsToRootCollection` (inspectorActions.ts) 에서 추출한 테스트 가능 단위.
 * 대상 element 의 events 를 canonical root collection(`doc.events` / `doc.actions`)
 * 에 clean-slate replace 로 반영한다:
 *   1. 이 element 를 `target` 으로 가진 기존 events 제거
 *   2. 그 events 가 참조하던 actions chain(actionRef/fallbackActionRef → action.next
 *      DAG) 제거 — 다른 element 의 actions 는 보존
 *   3. 신규 events 를 `migrateLegacyEventsToRootEvents` 로 root event/action 변환 후 append
 *   4. 결과 빈 배열이면 `undefined` 로 set (root field 제거)
 *
 * 이 함수는 **canonical root collection 만** 갱신한다 (primary read view).
 * history / undo·redo / DB persist / node projection(props.events) 은 store action
 * `updateEventsRootCollection` (inspectorActions) 가 `updateAndSave` 로 담당한다
 * (ADR-149 R8 — Phase 2 transitional projection). Phase 3 에서 projection 제거 시
 * root-collection-native history event type 도입 예정 (breakdown Phase 3).
 *
 * @see docs/adr/149-events-panel-canonical-simplification.md (Phase 2a)
 * @see docs/adr/design/149-events-panel-inventory.md (§1-B, §5)
 */
import { migrateLegacyEventsToRootEvents } from "../../../adapters/canonical/rootCollectionMigration";
import { useCanonicalDocumentStore } from "./canonicalDocumentStore";

/**
 * 대상 element 의 events 를 canonical root collection 에 반영 (clean-slate replace).
 * 다른 element 의 events/actions 는 보존된다. 활성 project 가 없으면 no-op.
 */
export function writeEventsToRootCollection(
  elementId: string,
  events: readonly unknown[] | undefined,
): void {
  const store = useCanonicalDocumentStore.getState();
  if (!store.currentProjectId) return;

  const doc = store.getDocument(store.currentProjectId);
  const existingEvents = doc?.events ?? [];
  const existingActions = doc?.actions ?? [];

  // 1) 이 element 가 target 인 기존 events 제거 (clean slate)
  const filteredEvents = existingEvents.filter((e) => e.target !== elementId);

  // 2) 제거되는 events 가 참조하던 actions chain 제거 (visited set 로 DAG 안전)
  const eventsForThisElement = existingEvents.filter(
    (e) => e.target === elementId,
  );
  const refIds = new Set<string>();
  for (const ev of eventsForThisElement) {
    if (ev.actionRef) refIds.add(ev.actionRef);
    if (ev.fallbackActionRef) refIds.add(ev.fallbackActionRef);
  }
  const visited = new Set<string>();
  const queue = [...refIds];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (visited.has(cur)) continue;
    visited.add(cur);
    const action = existingActions.find((a) => a.id === cur);
    if (action?.next) queue.push(...action.next);
  }
  const filteredActions = existingActions.filter((a) => !visited.has(a.id));

  // 3) 신규 events 변환 + append
  const eventArr = Array.isArray(events) ? events : [];
  const result = migrateLegacyEventsToRootEvents(
    elementId,
    eventArr as Parameters<typeof migrateLegacyEventsToRootEvents>[1],
  );

  const nextEvents = [...filteredEvents, ...result.events];
  const nextActions = [...filteredActions, ...result.actions];

  store.setEvents(nextEvents.length > 0 ? nextEvents : undefined);
  store.setActions(nextActions.length > 0 ? nextActions : undefined);
}

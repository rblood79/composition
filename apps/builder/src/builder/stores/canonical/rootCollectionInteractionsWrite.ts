/**
 * @fileoverview ADR-158 Phase 1 — canonical `events` root collection write core.
 *
 * 구 `rootCollectionEventsWrite.ts` (ADR-149 Phase 2a) 를 계승한다. 저장 위치
 * (`CompositionDocument.events` root collection, ADR-131) 와 clean-slate replace
 * 전략은 그대로이고, entry 스키마만 `SerializedEvent` + `SerializedAction` chain 에서
 * `InteractionRule` 로 교체됐다.
 *
 * 구 구현 대비 사라진 것:
 * - `actions` chain GC (actionRef/fallbackActionRef → `action.next` DAG 순회).
 *   `InteractionRule` 은 action 을 entry 안에 인라인으로 담아 참조 자체가 없다.
 * - `migrateLegacyEventsToRootEvents` 어댑터 경유. 패널이 `InteractionRule` 을
 *   직접 생산하므로 변환 계층이 불필요하다.
 * - legacy `element.events` mirror 파생 (breakdown §2 — Phase 1 에서 중단).
 *
 * 본 함수는 **canonical root collection 만** 갱신한다. persist 는 호출자
 * (`updateEventsRootCollection` — inspectorActions) 가
 * `persistActiveCanonicalDocument` 로 담당한다.
 *
 * @see docs/adr/158-interactions-rules-capability-registry.md
 * @see docs/adr/design/158-interactions-rules-capability-registry-breakdown.md §2
 */
import type { InteractionRule } from "@composition/shared";

import { useCanonicalDocumentStore } from "./canonicalDocumentStore";

/**
 * 대상 element 를 트리거로 갖는 규칙을 canonical root collection 에 반영
 * (clean-slate replace). 다른 element 의 규칙은 보존된다. 활성 project 가 없으면 no-op.
 *
 * `actions` root collection 은 건드리지 않는다 — ADR-158 이후 dormant 필드이며
 * ADR-131 자산으로만 보존된다 (composition-document.types.ts 주석 참조).
 */
export function writeInteractionRulesToRootCollection(
  elementId: string,
  rules: readonly InteractionRule[] | undefined,
): void {
  const store = useCanonicalDocumentStore.getState();
  if (!store.currentProjectId) return;

  const doc = store.getDocument(store.currentProjectId);
  const existing = doc?.events ?? [];

  // 이 element 가 트리거인 기존 규칙 제거 (clean slate) 후 신규 append
  const preserved = existing.filter((r) => r.elementId !== elementId);
  const incoming = Array.isArray(rules) ? rules : [];
  const next = [...preserved, ...incoming];

  store.setEvents(next.length > 0 ? next : undefined);
}

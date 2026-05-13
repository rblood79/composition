/**
 * @fileoverview Canonical Elements Bridge — ADR-116 Phase 2 G3 Sub-Phase A
 *
 * Phase 2 hot path cutover 의 backbone. legacy `elementsMap` 와
 * `useCanonicalDocumentStore` 사이의 단일 read 진입점을 제공.
 *
 * **Sub-Phase A scope**:
 * - canonical store wrap (single source read).
 * - subscribe lifecycle (`useSyncExternalStore` 호환 시그니처).
 * - React hook 2종 (`useCanonicalNode`, `useActiveCanonicalDocument`).
 *
 * **Direct cutover scope**:
 * - legacy `elementsMap` fallback 자동 변환은 채택하지 않는다.
 * - path-별 cutover 는 active canonical document 를 직접 읽는다.
 * - snapshot reference 는 store 의 clone-on-write 로 안정화한다.
 *
 * **D6=i 채택 근거**:
 * - `useSyncExternalStore` = React 18+ external store subscribe primitive.
 * - Zustand v5 `useStore selector + useMemo getState` 패턴은 selector cache
 *   miss 회귀 이력 (세션 36 ElementSlotSelector 무한 루프) 가 있으므로 회피.
 * - bridge 가 store 와 React 사이의 thin layer 로 작용 — store 의 clone-on-write
 *   가 snapshot stability 를 보장하면 React re-render 가 정확히 1회.
 */

import { useSyncExternalStore } from "react";
import type {
  CanonicalNode,
  CompositionDocument,
  SerializedAction,
  SerializedEvent,
} from "@composition/shared";
import {
  selectActiveCanonicalDocument,
  selectCanonicalNode,
  useCanonicalDocumentStore,
} from "./canonicalDocumentStore";

// ─────────────────────────────────────────────
// Read API — store 단일 진입점
// ─────────────────────────────────────────────

/**
 * 활성 canonical document 의 nodeId 노드를 반환. 없으면 `null`.
 *
 * Phase 2 hot path 가 호출 — `useCanonicalNode(nodeId)` hook 의 snapshot
 * source.
 *
 * direct cutover 이후 canonical store 단독 조회만 수행한다.
 */
export function getCanonicalNode(nodeId: string): CanonicalNode | null {
  return selectCanonicalNode(nodeId);
}

/**
 * 활성 canonical document 자체를 반환. 없으면 `null`.
 *
 * Phase 2 LayerTree pilot 의 backbone — 트리 derived view 생성 source.
 */
export function getActiveCanonicalDocument(): CompositionDocument | null {
  return selectActiveCanonicalDocument();
}

// ─────────────────────────────────────────────
// Subscribe API — useSyncExternalStore 호환
// ─────────────────────────────────────────────

/**
 * canonical store 의 mutation 발생 시 listener 를 호출.
 *
 * **subscribe 단위**: store 전체 (Zustand v5 native subscribe). 특정 nodeId
 * 만 watch 하고 싶어도 store level subscribe 후 snapshot 비교에 의존
 * (snapshot reference 가 변경되지 않으면 React 가 re-render skip).
 *
 * 이는 `subscribeWithSelector` middleware 를 사용하지 않기 위한 의도적
 * 단순화 — Phase 2 backbone 단계에서는 store 의 clone-on-write 가 selector
 * stability 를 보장하므로 over-subscribe 가 perf 영향 없음.
 */
export function subscribeCanonicalStore(listener: () => void): () => void {
  return useCanonicalDocumentStore.subscribe(listener);
}

// ─────────────────────────────────────────────
// React hooks — useSyncExternalStore 기반
// ─────────────────────────────────────────────

/**
 * 활성 canonical document 의 nodeId 노드를 React 컴포넌트에서 구독.
 *
 * - canonical store mutation 시 자동 re-render.
 * - nodeId 가 `null`/empty/없음/currentProjectId `null` 시 `null` 반환.
 * - snapshot 안정성 = store 의 clone-on-write 보장 (mutation 발생 시에만
 *   reference 변경).
 *
 * **Step 2 (Selection/properties)** 진입 — `nodeId: string | null` 확장. caller
 * 가 selectedElementId 같이 nullable id 직접 전달 가능.
 *
 * @example
 *   const node = useCanonicalNode(selectedElementId);
 *   if (!node) return null;
 *   return <SomeView node={node} />;
 */
export function useCanonicalNode(nodeId: string | null): CanonicalNode | null {
  return useSyncExternalStore(
    subscribeCanonicalStore,
    () => (nodeId ? getCanonicalNode(nodeId) : null),
    () => null, // SSR snapshot — Phase 2 단계 SSR 미지원
  );
}

/**
 * 활성 canonical document 전체를 React 컴포넌트에서 구독.
 *
 * - LayerTree pilot 의 derived view source.
 * - Preview sync 의 resolved canonical tree publish source (Sub-Phase B).
 * - currentProjectId 가 `null` 이거나 해당 doc 미등록 시 `null`.
 *
 * @example
 *   const doc = useActiveCanonicalDocument();
 *   const tree = useMemo(() => doc ? buildLayerTree(doc) : [], [doc]);
 */
export function useActiveCanonicalDocument(): CompositionDocument | null {
  return useSyncExternalStore(
    subscribeCanonicalStore,
    () => getActiveCanonicalDocument(),
    () => null,
  );
}

// ─────────────────────────────────────────────
// ADR-131 Phase 3 — Root collection hooks
// ─────────────────────────────────────────────

const EMPTY_EVENT_LIST: readonly SerializedEvent[] = Object.freeze([]);
const EMPTY_ACTION_LIST: readonly SerializedAction[] = Object.freeze([]);

/**
 * 활성 canonical document 의 `events` root collection 을 구독.
 *
 * 미정의 시 안정적인 동일 빈 배열 reference 반환 (re-render churn 회피).
 * mutation 시 새 array reference 가 store 에서 publish → React 재구독.
 */
export function useDocumentEvents(): readonly SerializedEvent[] {
  return useSyncExternalStore(
    subscribeCanonicalStore,
    () =>
      selectActiveCanonicalDocument()?.events ??
      (EMPTY_EVENT_LIST as SerializedEvent[]),
    () => EMPTY_EVENT_LIST as SerializedEvent[],
  );
}

/**
 * 특정 UI node id 를 `target` 으로 가진 events 만 filter.
 *
 * 빈 결과는 module-level 빈 배열 reference 사용 — useSyncExternalStore 의
 * `getSnapshot must return same value on re-call` 계약 충족.
 *
 * cross-call cache 가 필요한 경우 (target 별 stable filter) 는 Phase 4
 * 시점에 useMemo + targetIndex map 도입.
 */
export function useEventsForTarget(
  targetNodeId: string | null,
): readonly SerializedEvent[] {
  return useSyncExternalStore(
    subscribeCanonicalStore,
    () => {
      if (!targetNodeId) return EMPTY_EVENT_LIST as SerializedEvent[];
      const all = selectActiveCanonicalDocument()?.events;
      if (!all || all.length === 0) {
        return EMPTY_EVENT_LIST as SerializedEvent[];
      }
      const filtered = all.filter((e) => e.target === targetNodeId);
      if (filtered.length === 0) {
        return EMPTY_EVENT_LIST as SerializedEvent[];
      }
      return filtered;
    },
    () => EMPTY_EVENT_LIST as SerializedEvent[],
  );
}

// ADR-131 Phase 8 (2026-05-13): useDocumentData 제거.
// data SSOT 는 `data_tables` / `api_endpoints` / `variables`. RAC/RSC consumer
// 는 `useCollectionData({ datatableId | dataBinding })` 사용.

/** 활성 document 의 `actions` root collection 구독. */
export function useDocumentActions(): readonly SerializedAction[] {
  return useSyncExternalStore(
    subscribeCanonicalStore,
    () =>
      selectActiveCanonicalDocument()?.actions ??
      (EMPTY_ACTION_LIST as SerializedAction[]),
    () => EMPTY_ACTION_LIST as SerializedAction[],
  );
}

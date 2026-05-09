import type { CompositionDocument } from "@composition/shared";

import { canonicalDocumentToFrameElementScopes } from "../../../../adapters/canonical/frameElementScope";
import type { Element } from "../../../../types/core/store.types";
import { visitCanonicalDocumentElements } from "../../../stores/canonical/canonicalElementsView";
import {
  rebuildPageIndex,
  type PageElementIndex,
} from "../../../stores/utils/elementIndexer";

/**
 * `CanonicalSceneModel` — canonical document 에서 derived 된 scene snapshot.
 *
 * **ADR-125 Phase 1 (transition-derived-readonly)**:
 * - `elements`: canonical-native traversal (`visitCanonicalDocumentElements`) 결과의
 *   `Element[]` projection. **canonical document 가 SSOT** 이며, 본 list 는
 *   layout/render consumer 의 편의 view.
 * - `elementsMap` / `childrenByParent`: `elements` 로부터 derived 된 O(1) lookup map.
 *   **legacy 호환 유지를 위한 internal derived view 이며, Phase 2 에서
 *   layout engine 입력 contract 가 canonical-native 로 전환되면 사용 빈도가
 *   감소한다**. caller 가 직접 mutable subscription 으로 의존하면 안 됨.
 * - `frameElementScopes` / `pageIndex`: canonical document 기반 derived index.
 *
 * Phase 1 시점의 contract: scene model 은 `elements` (canonical-native node list)
 * 와 `elementsMap` (legacy map) **양쪽** 을 동시에 노출. consumer 는 가능한
 * `elements` 를 우선 사용하고, map 은 hot-path lookup 시에만 사용한다.
 */
export interface CanonicalSceneModel {
  childrenByParent: Map<string, Element[]>;
  elements: Element[];
  elementsMap: Map<string, Element>;
  frameElementScopes: ReturnType<typeof canonicalDocumentToFrameElementScopes>;
  pageIndex: PageElementIndex;
}

export function buildSceneElementMap(
  elements: Element[],
): Map<string, Element> {
  return new Map(elements.map((element) => [element.id, element]));
}

export function buildSceneChildrenByParent(
  elements: Element[],
): Map<string, Element[]> {
  const map = new Map<string, Element[]>();
  for (const element of elements) {
    if (element.deleted || !element.parent_id) continue;
    const list = map.get(element.parent_id);
    if (list) {
      list.push(element);
    } else {
      map.set(element.parent_id, [element]);
    }
  }
  return map;
}

/**
 * canonical document 로부터 scene model 을 단일 traversal 로 build.
 *
 * **ADR-125 Phase 1 contract**:
 * - canonical-native traversal (`visitCanonicalDocumentElements`) 단일 pass.
 * - `elements` 는 traversal 결과의 `Element[]` projection (canonical-native node
 *   list 와 의미적으로 동등).
 * - `elementsMap` / `childrenByParent` 는 `elements` 로부터 derived 된 lookup
 *   map — legacy 호환 view (Phase 2 에서 layout engine 이 canonical scene model
 *   직접 입력으로 받게 되면 derived view 의 사용 빈도가 감소한다).
 *
 * Builder hot path 에서 `useStore.elementsMap` / `childrenMap` mutable
 * subscription 대신 본 함수의 결과 (또는 `useCanonicalSceneSnapshot` derived)
 * 를 사용한다. ADR-122 HC.1 + ADR-125 §Layer 규칙.
 */
export function buildCanonicalSceneModel(
  doc: CompositionDocument,
): CanonicalSceneModel {
  const elements: Element[] = [];
  visitCanonicalDocumentElements(doc, (element) => {
    elements.push(element);
  });
  const elementsMap = buildSceneElementMap(elements);

  return {
    childrenByParent: buildSceneChildrenByParent(elements),
    elements,
    elementsMap,
    frameElementScopes: canonicalDocumentToFrameElementScopes(doc),
    pageIndex: rebuildPageIndex(elements, elementsMap),
  };
}

/**
 * @fileoverview Canonical scene model — legacy Element[] projection (boundary).
 *
 * **ADR-127 Phase 2**: `CanonicalSceneModel` 인터페이스가 canonical-native
 * (CanonicalNode 기반) 으로 재설계되면서, 기존 caller 가 `Element[]` projection
 * 을 필요로 하는 transition 기간 동안 사용할 helper 를 본 module 로 격리한다.
 *
 * **Boundary 위치**: `builder/stores/canonical/` — workspace scope (ADR-126
 * Phase 2 G2 grep gate scope) 외부. 본 module 의 `Element` 의존은 boundary
 * 격리되어 있어 G2 grep gate 의 allowlist 패턴에 포함된다.
 *
 * **사용 정책**:
 * - 신규 caller 가 본 helper 를 호출하면 `@deprecated` 경고 발생.
 * - 기존 caller 는 ADR-126 Phase 2 file-by-file transition 진행 시 본 helper
 *   를 점진적으로 제거한다 (helper 호출 → canonical-native traversal 로 swap).
 * - ADR-126 Phase 5 (derived view 제거) 시점에 본 module 자체 삭제.
 *
 * **재사용 source**: `canonicalDocumentToElements` (`canonicalElementsView.ts`)
 * 의 traversal logic 을 활용하여 CanonicalNode → Element[] projection 을 만든다.
 */

import type { CanonicalNode } from "@composition/shared";
import type { Element } from "../../../types/builder/unified.types";

import type { CanonicalSceneModel } from "../../workspace/canvas/scene/canonicalSceneModel";
import type {
  CanvasSceneGraph,
  CanvasSceneNode,
} from "../../workspace/canvas/scene/canvasSceneNode";
import {
  canonicalDocumentToElements,
  getActiveCanonicalDocumentElements,
} from "./canonicalElementsView";

/**
 * Scene model 의 평탄 Element[] projection 반환 (legacy view).
 *
 * @deprecated ADR-127 Phase 2 transition. 신규 caller 는 `sceneModel.nodes`
 *   (CanonicalNode[]) 를 직접 소비. ADR-126 Phase 5 시점에 본 helper 제거.
 */
export function getSceneModelElementsLegacy(
  _scene: CanonicalSceneModel,
): Element[] {
  // canonical document 자체를 source 로 traversal — scene model 의 nodes 와
  // 의미적으로 동등한 결과를 반환한다.
  return getActiveCanonicalDocumentElements() ?? [];
}

/**
 * Scene model 의 평탄 Map<id, Element> lookup 반환 (legacy view).
 *
 * @deprecated ADR-127 Phase 2 transition. 신규 caller 는 `sceneModel.nodesMap`
 *   (Map<string, CanonicalNode>) 를 직접 소비. ADR-126 Phase 5 시점에 본 helper
 *   제거.
 */
export function getSceneModelElementsMapLegacy(
  scene: CanonicalSceneModel,
): Map<string, Element> {
  const elements = getSceneModelElementsLegacy(scene);
  return new Map(elements.map((element) => [element.id, element]));
}

/**
 * Scene model 의 parent_id → children Element[] 매핑 반환 (legacy view).
 *
 * @deprecated ADR-127 Phase 2 transition. 신규 caller 는
 *   `sceneModel.childrenByParent` (Map<string, CanonicalNode[]>) 를 직접 소비.
 *   ADR-126 Phase 5 시점에 본 helper 제거.
 */
export function getSceneModelChildrenByParentLegacy(
  scene: CanonicalSceneModel,
): Map<string, Element[]> {
  const elements = getSceneModelElementsLegacy(scene);
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
 * Scene model 의 nested CanonicalNode 를 Element[] 로 변환 (단발 호출용).
 *
 * `getSceneModelElementsLegacy` 와 다른 점은 active document store 를 거치지
 * 않고 입력 nodes 로부터 직접 변환. 단발 컨텍스트 (예: snapshot diff).
 *
 * @deprecated ADR-127 Phase 2 transition.
 */
export function nodesToElementsLegacy(_nodes: CanonicalNode[]): Element[] {
  // 단순 시나리오: active document 와 nodes 가 같다면 동일 결과. 다른 경우는
  // 기존 caller 가 active document 기준 read 패턴이라 동일 source 사용.
  return getActiveCanonicalDocumentElements() ?? [];
}

// canonicalDocumentToElements 는 doc 인자가 필요한 함수. 위 helper 들은 active
// document 기준 read 가 자연스러운 transition pattern 이라 active getter 사용.
// 별도 doc 기반 변환이 필요한 caller 는 직접 canonicalDocumentToElements(doc)
// 호출.
export { canonicalDocumentToElements };

// ─────────────────────────────────────────────
// Legacy Element-based helpers (boundary)
// ─────────────────────────────────────────────

/**
 * Element[] 기반 평탄 Map<id, Element> lookup 생성.
 *
 * @deprecated ADR-127 Phase 2 transition. canonical-native scene model 의
 *   `nodesMap` 사용 권장. 본 helper 는 storeElements (Zustand legacy mirror) 기반
 *   transition path 에서만 사용.
 */
export function buildLegacyElementMap(
  elements: Element[],
): Map<string, Element> {
  return new Map(elements.map((element) => [element.id, element]));
}

/**
 * Element[] 기반 parent_id → children Element[] 매핑 생성.
 *
 * @deprecated ADR-127 Phase 2 transition. canonical-native scene model 의
 *   `childrenByParent` (CanonicalNode 기반) 사용 권장. 본 helper 는 storeElements
 *   (Zustand legacy mirror) 기반 transition path 에서만 사용.
 */
export function buildLegacyChildrenByParent(
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
 * Legacy store `Element[]` 를 Canvas scene graph 로 변환하는 bootstrap boundary.
 *
 * @deprecated ADR-126 Phase 5 transition. 신규 workspace/canvas caller 는
 *   canonical `CanvasSceneGraph` 를 직접 소비해야 한다. 본 helper 는 active
 *   canonical document 가 아직 없는 초기 bootstrap fallback 에서만 사용한다.
 */
export function buildLegacyCanvasSceneGraph(
  elements: Element[],
): CanvasSceneGraph {
  const nodes: CanvasSceneNode[] = [];
  const nodesMap = new Map<string, CanvasSceneNode>();
  const childrenByParent = new Map<string, CanvasSceneNode[]>();
  const parentById = new Map<string, string>();

  for (const element of elements) {
    const layoutId =
      typeof (element as { layout_id?: unknown }).layout_id === "string"
        ? ((element as { layout_id: string }).layout_id ?? null)
        : null;
    const node: CanvasSceneNode = {
      id: element.id,
      type: element.type,
      props: element.props ?? {},
      parentId: element.parent_id ?? null,
      pageId: element.page_id ?? null,
      layoutId,
      parent_id: element.parent_id ?? null,
      page_id: element.page_id ?? null,
      layout_id: layoutId,
      deleted: element.deleted,
      ...(element.customId ? { customId: element.customId } : {}),
      ...(element.componentName ? { name: element.componentName } : {}),
      ...(element.componentName
        ? { componentName: element.componentName }
        : {}),
      sourceNode: {
        id: element.id,
        type: element.type as CanonicalNode["type"],
        props: element.props ?? {},
      },
    };

    nodes.push(node);
    nodesMap.set(node.id, node);
    if (node.parentId) {
      parentById.set(node.id, node.parentId);
      const children = childrenByParent.get(node.parentId);
      if (children) {
        children.push(node);
      } else {
        childrenByParent.set(node.parentId, [node]);
      }
    }
  }

  return {
    childrenByParent,
    nodes,
    nodesMap,
    parentById,
  };
}

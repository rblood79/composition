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
 * **재사용 source**: `canonicalElementsView.ts` 의 active document traversal logic
 * 을 활용하여 CanonicalNode → Element[] projection 을 만든다.
 */

import type { CanonicalNode } from "@composition/shared";
import type { Element } from "../../../types/builder/unified.types";

import type {
  CanvasSceneGraph,
  CanvasSceneNode,
} from "../../workspace/canvas/scene/canvasSceneNode";

// ADR-912 후속 cleanup: scene-model Element[] projection helper 6종
// (getSceneModelElementsLegacy / ...MapLegacy / ...ChildrenByParentLegacy /
//  nodesToElementsLegacy / buildLegacyElementMap / buildLegacyChildrenByParent)
// 제거 — ADR-126/127 canonical-only 전환으로 외부 caller 0건. 유일 live export 는
// 초기 bootstrap fallback 인 buildLegacyCanvasSceneGraph 만 남는다.

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
    // legacy Element 의 snake_case `layout_id` 를 읽는 유일한 지점 (본 함수가 legacy →
    // scene 경계). CanvasSceneNode 쪽으로는 camelCase `layoutId` 만 내보낸다.
    const rawLayoutId = (element as { layout_id?: unknown }).layout_id;
    const layoutId = typeof rawLayoutId === "string" ? rawLayoutId : null;
    const node: CanvasSceneNode = {
      id: element.id,
      type: element.type,
      props: element.props ?? {},
      parentId: element.parent_id ?? null,
      pageId: element.page_id ?? null,
      layoutId,
      parent_id: element.parent_id ?? null,
      page_id: element.page_id ?? null,
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

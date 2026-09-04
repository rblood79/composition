import type { CompositionDocument } from "@composition/shared";

import { canonicalNodeToElement } from "../../../stores/canonical/canonicalElementsView";
import { getProjectableNodeLookups } from "../../../stores/canonical/canonicalTraversalHelpers";
import type { PanelNode } from "../../panelNode";

export interface CanonicalPropertyReadIndex {
  readonly elements: PanelNode[];
  readonly elementsById: ReadonlyMap<string, PanelNode>;
  readonly childrenByParent: ReadonlyMap<string, PanelNode[]>;
}

const canonicalIndexCache = new WeakMap<
  CompositionDocument,
  CanonicalPropertyReadIndex
>();
const legacyIndexCache = new WeakMap<PanelNode[], CanonicalPropertyReadIndex>();

function appendNode(
  index: {
    elements: PanelNode[];
    elementsById: Map<string, PanelNode>;
    childrenByParent: Map<string, PanelNode[]>;
  },
  node: PanelNode,
): void {
  index.elements.push(node);
  // 기존 `new Map(elements.map(...))`과 같은 last-match 의미를 보존한다.
  index.elementsById.set(node.id, node);
  if (node.deleted || !node.parent_id) return;

  const siblings = index.childrenByParent.get(node.parent_id);
  if (siblings) {
    siblings.push(node);
  } else {
    index.childrenByParent.set(node.parent_id, [node]);
  }
}

function createMutableIndex(): {
  elements: PanelNode[];
  elementsById: Map<string, PanelNode>;
  childrenByParent: Map<string, PanelNode[]>;
} {
  return {
    elements: [],
    elementsById: new Map(),
    childrenByParent: new Map(),
  };
}

/**
 * 활성 canonical document의 ADR-127 traversal cache를 Properties/Styles 전용
 * structural index로 한 번만 변환한다. full `Element[]` view와 hook 인스턴스별
 * Map 재생성을 피하면서 page/frame scope와 ref descendants parent를 보존한다.
 */
export function getCanonicalPropertyReadIndex(
  document: CompositionDocument,
): CanonicalPropertyReadIndex {
  const cached = canonicalIndexCache.get(document);
  if (cached) return cached;

  const index = createMutableIndex();
  for (const lookup of getProjectableNodeLookups()) {
    const element = canonicalNodeToElement(lookup.node, lookup.parentId, {
      pageId: lookup.pageId,
      layoutId: lookup.layoutId,
    });
    if (element) appendNode(index, element as PanelNode);
  }

  canonicalIndexCache.set(document, index);
  return index;
}

/** canonical document가 없는 pre-cutover/test 경계의 reference-stable fallback. */
export function getLegacyPropertyReadIndex(
  elements: PanelNode[],
): CanonicalPropertyReadIndex {
  const cached = legacyIndexCache.get(elements);
  if (cached) return cached;

  const index = createMutableIndex();
  for (const element of elements) appendNode(index, element);
  legacyIndexCache.set(elements, index);
  return index;
}

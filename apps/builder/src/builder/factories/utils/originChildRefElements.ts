import type { CanonicalNode, CompositionDocument } from "@composition/shared";
import type { Element } from "../../../types/core/store.types";
import {
  COMPONENT_DESCENDANTS_MIRROR_FIELD,
  COMPONENT_MASTER_ID_MIRROR_FIELD,
  COMPONENT_ROLE_MIRROR_FIELD,
} from "../../../adapters/canonical/componentSemanticsMirror";
import {
  toOriginChildSeed,
  type OriginChildRefDiagnostic,
} from "../../components/originChildRefs";

/**
 * ADR-229 Phase 2 — 생성 경로 (`createElementsFromDefinition`) 의 자식에 seed 와 **같은 규칙**
 * (`toOriginChildSeed`) 을 적용한다. reusable origin 이 없는 complex type (ColorPicker · Navigation
 * …) 은 아직 factory definition 으로 plain 트리를 만드는데, 그 자식 중 reusable type (ColorField
 * · Link) 은 seed 와 같은 모양 (origin instance ref + diff props + descendants) 이어야 한다.
 *
 * Element 목록을 트리로 모아 규칙을 적용하고 다시 편다 — ref 가 된 자식의 자손 Element 는 origin
 * 이 소유하므로 목록에서 빠진다. origin index 는 문서의 reusable 노드 (Components 페이지).
 */
export function convertCreatedChildrenToRefs(
  parent: Element,
  children: readonly Element[],
  doc: CompositionDocument | null | undefined,
): { children: Element[]; diagnostics: OriginChildRefDiagnostic[] } {
  const diagnostics: OriginChildRefDiagnostic[] = [];
  if (!doc || children.length === 0) {
    return { children: [...children], diagnostics };
  }

  const originsById = new Map<string, CanonicalNode>();
  const collect = (nodes: readonly CanonicalNode[]): void => {
    for (const node of nodes) {
      if (node.reusable === true && !originsById.has(node.id)) {
        originsById.set(node.id, node);
      }
      collect(node.children ?? []);
    }
  };
  collect(doc.children);
  if (originsById.size === 0) return { children: [...children], diagnostics };

  const byParent = new Map<string, Element[]>();
  for (const child of children) {
    const key = child.parent_id ?? parent.id;
    const siblings = byParent.get(key);
    if (siblings) siblings.push(child);
    else byParent.set(key, [child]);
  }
  const elementById = new Map(children.map((child) => [child.id, child]));

  const toNode = (element: Element): CanonicalNode => {
    const nested = (byParent.get(element.id) ?? []).map(toNode);
    return {
      id: element.id,
      type: element.type,
      props: (element.props ?? {}) as Record<string, unknown>,
      ...(nested.length > 0 ? { children: nested } : {}),
    } as CanonicalNode;
  };

  // seed 트리 → Element 목록 (DFS, 부모 먼저). ref 는 원 Element 위에 ref 필드를 얹고 자손을 버린다.
  const out: Element[] = [];
  const flatten = (seed: CanonicalNode): void => {
    const element = elementById.get(seed.id);
    if (!element) return;
    if (seed.type === "ref") {
      out.push(toRefElement(element, seed));
      return;
    }
    out.push(element);
    for (const child of seed.children ?? []) flatten(child);
  };

  for (const child of byParent.get(parent.id) ?? []) {
    flatten(
      toOriginChildSeed(toNode(child), {
        originsById,
        parentType: parent.type,
        grandparentType: null,
        ownerChain: new Set(),
        diagnostics,
      }),
    );
  }
  return { children: out, diagnostics };
}

function toRefElement(element: Element, seed: CanonicalNode): Element {
  const ref = (seed as { ref?: string }).ref ?? "";
  const descendants = (seed as { descendants?: Record<string, unknown> })
    .descendants;
  return {
    ...element,
    type: "ref",
    ref,
    [COMPONENT_ROLE_MIRROR_FIELD]: "instance",
    [COMPONENT_MASTER_ID_MIRROR_FIELD]: ref,
    componentName: element.type,
    props: (seed.props ?? {}) as Element["props"],
    ...(descendants
      ? { [COMPONENT_DESCENDANTS_MIRROR_FIELD]: descendants }
      : {}),
  } as Element;
}

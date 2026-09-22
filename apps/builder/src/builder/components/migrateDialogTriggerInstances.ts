import type {
  CanonicalNode,
  CompositionDocument,
  RefNode,
  DescendantOverride,
} from "@composition/shared";

const ORIGIN_ID = "component-dialog";
export const LEGACY_DIALOG_CONTENT_ID = `${ORIGIN_ID}--content`;

/** 본문 → trigger 구조 이관과 같은 hydration에서 인스턴스 override 경로도 옮긴다. */
export function migrateDialogTriggerInstances(
  document: CompositionDocument,
): CompositionDocument {
  const findOrigin = (
    nodes: readonly CanonicalNode[],
  ): CanonicalNode | undefined => {
    for (const node of nodes) {
      if (node.id === ORIGIN_ID) return node;
      const found = findOrigin(node.children ?? []);
      if (found) return found;
    }
  };
  if (findOrigin(document.children)?.type !== "Dialog") return document;

  const visit = (node: CanonicalNode): CanonicalNode => {
    let next = node;
    if (node.children) {
      const children = node.children.map(visit);
      if (children.some((child, index) => child !== node.children![index]))
        next = { ...next, children };
    }
    if (node.type !== "ref") return next;
    const ref = next as RefNode;
    const descendants: Record<string, DescendantOverride> = {};
    let changed = false;
    for (const [path, override] of Object.entries(ref.descendants ?? {})) {
      const value =
        "type" in override && override.type
          ? visit(override as CanonicalNode)
          : "children" in override && Array.isArray(override.children)
            ? { ...override, children: override.children.map(visit) }
            : override;
      if (value !== override) changed = true;
      descendants[
        ref.ref === ORIGIN_ID ? `${LEGACY_DIALOG_CONTENT_ID}/${path}` : path
      ] = value;
    }
    if (ref.ref !== ORIGIN_ID)
      return changed ? ({ ...next, descendants } as RefNode) : next;
    const { isOpen, defaultOpen, ...contentProps } = ref.props ?? {};
    if (Object.keys(contentProps).length)
      descendants[LEGACY_DIALOG_CONTENT_ID] = contentProps;
    return {
      ...next,
      props: {
        ...(isOpen !== undefined ? { isOpen } : {}),
        ...(defaultOpen !== undefined ? { defaultOpen } : {}),
      },
      descendants,
    } as RefNode;
  };
  return { ...document, children: document.children.map(visit) };
}

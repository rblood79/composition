import type { Element } from "../../../types/builder/unified.types";
import { getAiReadHost } from "../aiReadHost";

interface AiToolElementProjection {
  readonly childrenByParent: Map<string, Element[]>;
  readonly elements: Element[];
  readonly elementsById: Map<string, Element>;
}

const projectionCache = new WeakMap<
  readonly Element[],
  AiToolElementProjection
>();
const NO_ELEMENTS: readonly Element[] = [];

function buildAiToolElementProjection(
  elements: Element[],
): AiToolElementProjection {
  const elementsById = new Map<string, Element>();
  const childrenByParent = new Map<string, Element[]>();

  for (const element of elements) {
    elementsById.set(element.id, element);
    if (element.deleted || !element.parent_id) continue;
    const siblings = childrenByParent.get(element.parent_id);
    if (siblings) {
      siblings.push(element);
    } else {
      childrenByParent.set(element.parent_id, [element]);
    }
  }

  return { childrenByParent, elements, elementsById };
}

/**
 * The AI tools' read of the open document and selection: the AI read host's (ADR-248 4e-5). 4e-7:
 * only the host — without one the document reads empty (the old store host is
 * `aiHosts.store.ts`, old-store tests only).
 */
export function getAiToolReadModel() {
  const host = getAiReadHost();
  const elements = host?.elements() ?? NO_ELEMENTS;
  let projection = projectionCache.get(elements);
  if (!projection) {
    projection = buildAiToolElementProjection(elements as Element[]);
    projectionCache.set(elements, projection);
  }
  const selectedElementIds = host ? [...host.selectedIds()] : [];
  return {
    ...projection,
    state: {
      currentPageId: host?.currentPageId() ?? null,
      pages: host?.pages() ?? [],
      selectedElementId: selectedElementIds[0] ?? null,
      selectedElementIds,
    },
  };
}

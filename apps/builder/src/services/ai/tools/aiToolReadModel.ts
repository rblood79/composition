import { getAiReadHost, type AiElementRow } from "../aiReadHost";

interface AiToolElementProjection {
  readonly childrenByParent: Map<string, AiElementRow[]>;
  readonly elements: AiElementRow[];
  readonly elementsById: Map<string, AiElementRow>;
}

const projectionCache = new WeakMap<
  readonly AiElementRow[],
  AiToolElementProjection
>();
const NO_ELEMENTS: readonly AiElementRow[] = [];

function buildAiToolElementProjection(
  elements: AiElementRow[],
): AiToolElementProjection {
  const elementsById = new Map<string, AiElementRow>();
  const childrenByParent = new Map<string, AiElementRow[]>();

  for (const element of elements) {
    elementsById.set(element.id, element);
    if (!element.parent_id) continue;
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
    projection = buildAiToolElementProjection(elements as AiElementRow[]);
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

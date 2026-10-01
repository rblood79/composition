/**
 * ADR-248 Phase 4e-7: the old store / canonical document as the AI read and write hosts — what the
 * AI tools did without a host before 4e-7. Old-store tests import this module (it registers itself
 * as the hosts' test fallback); the catalog Builder installs its own hosts. It goes with the old
 * store.
 */
import {
  isBodyType,
  isInteractionRule,
  resolveEditContract,
  type CanonicalNode,
  type CompositionDocument,
  type InteractionRule,
} from "@composition/shared";
import { runCanonicalMutation } from "../../adapters/canonical/canonicalMutationRunner";
import {
  canOperate,
  getOperationRejectMessageKey,
} from "../../builder/domain/canOperate";
import {
  resolveMoveTarget,
  type MoveTargetNode,
} from "../../builder/domain/resolveMoveTarget";
import { resolveCreationParentId } from "../../builder/hooks/useElementCreator";
import { getStoreState, useStore } from "../../builder/stores";
import { useCanonicalDocumentStore } from "../../builder/stores/canonical/canonicalDocumentStore";
import { getActiveCanonicalDocument } from "../../builder/stores/canonical/canonicalElementsBridge";
import { canonicalNodeToElement } from "../../builder/stores/canonical/canonicalElementsView";
import {
  getNodeMap,
  getProjectableNodeLookups,
} from "../../builder/stores/canonical/canonicalTraversalHelpers";
import { historyManager } from "../../builder/stores/history";
import { confirmStructuralOriginImpact } from "../../builder/stores/utils/elementUpdate";
import { getDefaultProps } from "../../types/builder/unified.types";
import type { Element } from "../../types/builder/unified.types";
import type { ToolTranslate } from "../../types/integrations/ai.types";
import { setAiReadHostTestFallback, type AiReadHost } from "./aiReadHost";
import { setAiWriteHostTestFallback, type AiWriteHost } from "./aiWriteHost";
import { adaptPropsForElement, adaptStylePatchWithFills } from "./styleAdapter";
import {
  applyCanonicalFields,
  readStoreCanonicalFields,
  type CanonicalFieldPatch,
} from "./tools/canonicalNodeFields.store";
import { createCompositeElement } from "./tools/compositeCreation";
import { collectVariableDetails } from "./tools/listVariables";

const echo: ToolTranslate = (key) => key;

function activeDocument(): CompositionDocument | null {
  const canonical = useCanonicalDocumentStore.getState();
  return canonical.currentProjectId
    ? (canonical.documents.get(canonical.currentProjectId) ?? null)
    : null;
}

// ── read ─────────────────────────────────────────────────────────────────────────────────────

const canonicalElementsCache = new WeakMap<CompositionDocument, Element[]>();

/** The old canonical document's elements (projected), else the old element store's. */
function storeElements(): Element[] {
  const doc = activeDocument();
  if (doc) {
    const cached = canonicalElementsCache.get(doc);
    if (cached) return cached;
    const elements: Element[] = [];
    for (const lookup of getProjectableNodeLookups()) {
      const element = canonicalNodeToElement(lookup.node, lookup.parentId, {
        pageId: lookup.pageId,
        layoutId: lookup.layoutId,
      });
      if (element) elements.push(element);
    }
    canonicalElementsCache.set(doc, elements);
    return elements;
  }
  return getStoreState().elements;
}

let storeVersion = 0;
const listeners = new Set<() => void>();
const bump = () => {
  storeVersion += 1;
  for (const listener of listeners) listener();
};
useStore.subscribe(bump);
useCanonicalDocumentStore.subscribe(bump);

export const storeAiReadHost: AiReadHost = {
  version: () => String(storeVersion),
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  elements: storeElements,
  currentPageId: () => getStoreState().currentPageId,
  selectedIds() {
    const { selectedElementId, selectedElementIds } = getStoreState();
    return selectedElementId
      ? [
          selectedElementId,
          ...selectedElementIds.filter((id) => id !== selectedElementId),
        ]
      : [...selectedElementIds];
  },
  fields(id) {
    const node = getNodeMap().get(id);
    return node
      ? resolveEditContract(node as CanonicalNode, activeDocument()).fields
      : [];
  },
  creationParentId() {
    const doc = activeDocument();
    const state = getStoreState();
    return doc
      ? resolveCreationParentId({
          selectedElementId: state.selectedElementId,
          elements: storeElements(),
          currentPageId: state.currentPageId,
          layoutId: null,
          doc,
        })
      : null;
  },
  pages: () =>
    getStoreState().pages.map((page) => ({ id: page.id, title: page.title })),
  interactionRules: () =>
    (activeDocument()?.events ?? []).map((rule) => ({
      id: rule.id,
      elementId: rule.elementId,
      trigger: rule.trigger,
      actionKind: rule.action?.kind,
    })),
  variables: (projectDefs) =>
    collectVariableDetails(getActiveCanonicalDocument(), projectDefs as never),
  projectId: () => useCanonicalDocumentStore.getState().currentProjectId ?? "",
  canonicalFields: (id) =>
    readStoreCanonicalFields(id) as Record<string, unknown> | undefined,
};

// ── write ────────────────────────────────────────────────────────────────────────────────────

/** Nesting preflight (the palette's `resolveMoveTarget`, policy `reject`). */
function findNestingErrorForParent(
  elements: readonly Element[],
  parentId: string | null,
  childType: string,
): string | null {
  if (!parentId) return null;
  const nodes = new Map(
    elements.map((el) => [el.id, el as unknown as MoveTargetNode] as const),
  );
  const target = resolveMoveTarget({
    targetParentId: parentId,
    insertionIndex: Number.MAX_SAFE_INTEGER,
    movingTypes: [childType],
    nodes,
    policy: "reject",
    doc: getActiveCanonicalDocument(),
  });
  if (target.ok) return null;
  if (target.reason === "nesting" && target.violation) {
    return `Cannot place ${childType} under ${target.violation.parentType}: ${target.violation.reason}. Choose a different parentId.`;
  }
  return `Cannot place ${childType} under ${parentId}: it is inside an instance (edit its component instead). Choose a different parentId.`;
}

export const storeAiWriteHost: AiWriteHost = {
  async create(input, t = echo) {
    const { type } = input;
    const aiProps = { ...(input.props ?? {}) };
    const aiStyles = { ...(input.styles ?? {}) };
    const aiFills = input.fills ? [...input.fills] : undefined;
    const canonicalPatch = (input.canonical ?? {}) as CanonicalFieldPatch;
    const elements = storeElements();
    const { addElement, currentPageId, selectedElementId } = getStoreState();

    let parentId: string | null = input.parentId || null;
    if (!parentId) {
      if (selectedElementId) parentId = selectedElementId;
      else parentId = elements.find((el) => isBodyType(el.type))?.id ?? null;
    }
    const nestingError = findNestingErrorForParent(elements, parentId, type);
    if (nestingError) return { ok: false, error: nestingError };
    // origin 안 생성은 모든 instance 를 바꾼다 — 편집과 같은 영향 확인 (ADR-236 E4).
    const impactGate = confirmStructuralOriginImpact([parentId]);
    if (impactGate !== true && !(await impactGate))
      return { ok: false, error: t("aiToolError.originImpactCancelled") };

    // ADR-134 Phase 6: 합성 컴포넌트는 팔레트와 같은 분기로 만든다.
    const composite = await createCompositeElement({
      type,
      initialProps: adaptPropsForElement(type, aiProps, aiStyles),
      initialCanonical: {
        ...canonicalPatch,
        ...(aiFills ? { fills: aiFills } : {}),
      },
      elements,
      currentPageId: currentPageId || null,
      selectedElementId: selectedElementId ?? null,
      parentIdOverride: input.parentId ?? null,
      addElement,
    });
    if (composite)
      return {
        ok: true,
        elementId: composite.elementId,
        parentId,
        composite: { mode: composite.mode, childCount: composite.childCount },
      };

    const newElement = {
      id: crypto.randomUUID(),
      type,
      props: adaptPropsForElement(
        type,
        { ...getDefaultProps(type), ...aiProps },
        aiStyles,
      ),
      ...canonicalPatch,
      ...(aiFills ? { fills: aiFills } : {}),
      parent_id: parentId,
      page_id: currentPageId || "default",
      dataBinding: undefined,
    } as Element;
    await addElement(newElement);
    return { ok: true, elementId: newElement.id, parentId };
  },

  async update(id, input) {
    const { updateElement, updateElementProps } = getStoreState();
    const element = storeElements().find((el) => el.id === id);
    if (!element) return { ok: false, error: `Element not found: ${id}` };
    const newStyles = { ...(input.styles ?? {}) };
    const updates: Record<string, unknown> = { ...(input.props ?? {}) };
    if (Object.keys(newStyles).length > 0 || input.fills) {
      const existingStyle = (element.props?.style || {}) as Record<
        string,
        unknown
      >;
      updates.style = adaptStylePatchWithFills(existingStyle, newStyles).style;
    }
    if (input.fills !== undefined) {
      // Inspector와 같은 canonical 1차 fills + full-node history 표면.
      const { fills: _legacyFills, ...baseProps } = element.props ?? {};
      void _legacyFills;
      await updateElement(id, {
        props: { ...baseProps, ...updates },
        fills: [...input.fills],
      });
    } else if (Object.keys(updates).length > 0) {
      await updateElementProps(id, updates);
    }
    const canonicalApplied = await applyCanonicalFields(
      id,
      (input.canonical ?? {}) as CanonicalFieldPatch,
    );
    return { ok: true, elementId: id, canonicalApplied };
  },

  async remove(id, t = echo) {
    const elementsById = new Map(
      storeElements().map((el) => [el.id, el] as const),
    );
    // 구조 변경 판정 (ADR-236 Phase 3 — 메뉴 · 단축키 · Layers 와 같은 `canOperate`).
    const verdict = canOperate("delete", id, (key) => elementsById.get(key));
    if (!verdict.ok) {
      switch (verdict.reason) {
        case "body":
          return { ok: false, error: t("aiToolError.bodyUndeletable") };
      }
      const messageKey = getOperationRejectMessageKey(verdict.reason);
      return {
        ok: false,
        error: messageKey ? t(messageKey) : t("aiToolError.notDeleted", { id }),
      };
    }
    // origin 안 삭제는 모든 instance 를 바꾼다 — 편집과 같은 영향 확인 (ADR-236 E4).
    const impactGate = confirmStructuralOriginImpact([id]);
    if (impactGate !== true && !(await impactGate))
      return { ok: false, error: t("aiToolError.originImpactCancelled") };
    await getStoreState().removeElement(id);
    return { ok: true };
  },

  addInteraction(elementId, trigger, action) {
    const rule: InteractionRule = {
      id: crypto.randomUUID(),
      type: "interaction",
      elementId,
      trigger,
      action,
    };
    if (!isInteractionRule(rule)) return { ok: false, error: "invalid rule" };
    // 러너 경유 (ADR-184) — events root collection 은 persist 가 필요하다.
    runCanonicalMutation({
      canonical: () => {
        useCanonicalDocumentStore.getState().addEvent(rule);
        return { changed: true, document: activeDocument() };
      },
      history: {
        skip:
          "이벤트 규칙은 Events 패널과 같은 canonical-only 경로 — 패널도 history 를 " +
          "남기지 않는다 (inspectorActions.updateEventsRootCollection)",
      },
    });
    return { ok: true, ruleId: rule.id };
  },

  async batch(label, run) {
    // 배치 전체를 되돌리기 1 단위로 묶는다 (ADR-134 G3) — entry 는 canonicalEvents 로 역연산된다.
    const count = /\((\d+)\)$/.exec(label)?.[1] ?? "0";
    historyManager.beginTransaction({
      type: "batch",
      elementId: `ai-batch-${count}`,
    });
    try {
      return await run();
    } finally {
      historyManager.commitTransaction();
    }
  },
};

setAiReadHostTestFallback(storeAiReadHost);
setAiWriteHostTestFallback(storeAiWriteHost);

import {
  canMaterializeSkiaPresentationFill,
  TAG_SPEC_MAP,
  type SkiaPresentationMaterializationContext,
} from "@composition/specs";
import {
  getPrimitiveBinding,
  isCatalogCutover,
  type CompositionDocument,
} from "@composition/shared";
import { useCanonicalDocumentStore } from "../stores/canonical/canonicalDocumentStore";
import { getCanonicalDocumentElementsView } from "../stores/canonical/canonicalElementsView";
import type { FillItem } from "../../types/builder/fill.types";
import { FillType } from "../../types/builder/fill.types";
import { editorPresentationCanonicalRuntimeOptions } from "./editorPresentationCommitAdapter";
import { EditorPresentationTransactionRuntime } from "./editorPresentationRuntime";
import type { EditorPresentationTargetRef } from "./editorPresentationTypes";

const FILL_PILOT_QUERY_PARAM = "adr187FillPilot";
const materializationContextByDocument = new WeakMap<
  CompositionDocument,
  Map<string, SkiaPresentationMaterializationContext>
>();

export const editorPresentationFillPilotRuntime =
  new EditorPresentationTransactionRuntime(
    editorPresentationCanonicalRuntimeOptions,
  );

let previousDocumentVersion =
  useCanonicalDocumentStore.getState().documentVersion;

useCanonicalDocumentStore.subscribe((state) => {
  if (state.documentVersion === previousDocumentVersion) return;
  previousDocumentVersion = state.documentVersion;
  if (state.currentProjectId) {
    editorPresentationFillPilotRuntime.reconcileDocumentVersion(
      state.currentProjectId,
    );
  }
});

export interface FillPresentationPilotTarget {
  readonly fills: readonly FillItem[];
  readonly projectId: string;
  readonly target: EditorPresentationTargetRef;
}

export function isFillPresentationPilotEnabled(): boolean {
  return (
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).has(FILL_PILOT_QUERY_PARAM)
  );
}

function getMaterializationContext(
  document: CompositionDocument,
  selectedElementId: string,
): SkiaPresentationMaterializationContext {
  let documentCache = materializationContextByDocument.get(document);
  if (!documentCache) {
    documentCache = new Map();
    materializationContextByDocument.set(document, documentCache);
  }
  const cached = documentCache.get(selectedElementId);
  if (cached) return cached;

  const elementsView = getCanonicalDocumentElementsView(document);
  const element = elementsView.byId.get(selectedElementId);
  const ancestorTypes: string[] = [];
  const visitedAncestorIds = new Set<string>([selectedElementId]);
  let parentId = element?.parent_id;
  while (parentId && !visitedAncestorIds.has(parentId)) {
    visitedAncestorIds.add(parentId);
    const parent = elementsView.byId.get(parentId);
    if (!parent) break;
    ancestorTypes.push(parent.type);
    parentId = parent.parent_id;
  }
  const nativeSpec = element ? TAG_SPEC_MAP[element.type] : undefined;
  const context: SkiaPresentationMaterializationContext = Object.freeze({
    ancestorTypes: Object.freeze(ancestorTypes),
    hasGenericBackground:
      element !== undefined &&
      (isCatalogCutover(element.type) ||
        nativeSpec === undefined ||
        nativeSpec.render.presentation?.fills === "background"),
    hasChildren: elementsView.elements.some(
      (candidate) => candidate.parent_id === selectedElementId,
    ),
  });
  documentCache.set(selectedElementId, context);
  return context;
}

export function resolveFillPresentationPilotTarget(
  selectedElementId: string | null,
  fillId: string,
): FillPresentationPilotTarget | null {
  if (!isFillPresentationPilotEnabled() || !selectedElementId) return null;

  const state = useCanonicalDocumentStore.getState();
  const projectId = state.currentProjectId;
  const document = projectId ? state.documents.get(projectId) : null;
  if (!projectId || !document) return null;
  const elementsView = getCanonicalDocumentElementsView(document);
  const element = elementsView.byId.get(selectedElementId);
  if (!element) return null;

  const primitiveBinding = getPrimitiveBinding(element.type)?.skiaPrimitive;
  if (
    !canMaterializeSkiaPresentationFill(
      primitiveBinding,
      (element.props ?? {}) as Readonly<Record<string, unknown>>,
      getMaterializationContext(document, selectedElementId),
    )
  ) {
    return null;
  }

  const target: EditorPresentationTargetRef = {
    kind: "canonical-node",
    nodeId: selectedElementId,
  };
  if (!editorPresentationCanonicalRuntimeOptions.hasTarget(projectId, target)) {
    return null;
  }
  const value = editorPresentationCanonicalRuntimeOptions.readTargetValue(
    projectId,
    target,
  );
  const fills = Array.isArray(value) ? (value as FillItem[]) : [];
  const fill = fills[0];
  if (
    fills.length !== 1 ||
    !fill ||
    fill.id !== fillId ||
    fill.type !== FillType.Color ||
    !fill.enabled ||
    !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(fill.color)
  ) {
    return null;
  }

  return {
    fills,
    projectId,
    target,
  };
}

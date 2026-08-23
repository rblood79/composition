import {
  canMaterializeSkiaPresentationFill,
  TAG_SPEC_MAP,
  type SkiaPresentationMaterializationContext,
} from "@composition/specs";
import {
  getPrimitiveBinding,
  isCatalogCutover,
  type CanonicalNode,
  type CompositionDocument,
} from "@composition/shared";
import { useCanonicalDocumentStore } from "../stores/canonical/canonicalDocumentStore";
import { getCanonicalDocumentElementsView } from "../stores/canonical/canonicalElementsView";
import type { FillItem } from "../../types/builder/fill.types";
import { FillType } from "../../types/builder/fill.types";
import {
  editorPresentationCanonicalRuntimeOptions,
  getEditorPresentationTargetNode,
  resolveEditorPresentationTarget,
} from "./editorPresentationCommitAdapter";
import { EditorPresentationTransactionRuntime } from "./editorPresentationRuntime";
import { EditorPresentationPreviewBridge } from "./editorPresentationPreviewBridge";
import type {
  BeginEditorPresentationInput,
  EditorPresentationHandle,
  EditorPresentationTargetRef,
} from "./editorPresentationTypes";
import type { EditorPresentationRuntimeDiagnostics } from "./editorPresentationRuntime";

const FILL_PILOT_QUERY_PARAM = "adr187FillPilot";
const materializationContextByDocument = new WeakMap<
  CompositionDocument,
  Map<string, SkiaPresentationMaterializationContext>
>();

export const editorPresentationFillPilotRuntime =
  new EditorPresentationTransactionRuntime(
    editorPresentationCanonicalRuntimeOptions,
  );

declare global {
  interface Window {
    __composition_EDITOR_PRESENTATION_DEBUG__?: {
      begin(input: BeginEditorPresentationInput): EditorPresentationHandle;
      diagnostics(): EditorPresentationRuntimeDiagnostics;
    };
  }
}

// 실제 Builder의 singleton runtime을 브라우저 검증 하니스가 사용하도록 한다.
// 동적 import는 Vite query가 다른 module instance를 만들 수 있으므로 live parity
// 증거로 사용할 수 없다. production benchmark도 같은 query를 사용하므로 metrics
// opt-in에서만 동일 instance를 노출한다(overlay 전용이며 canonical commit API는 없다).
if (
  typeof window !== "undefined" &&
  new URLSearchParams(window.location.search).has("adr187Metrics")
) {
  window.__composition_EDITOR_PRESENTATION_DEBUG__ = {
    begin: (input) =>
      editorPresentationFillPilotRuntime.beginEditorPresentation(input),
    diagnostics: () => editorPresentationFillPilotRuntime.getDiagnostics(),
  };
}

export const editorPresentationFillPreviewBridge =
  new EditorPresentationPreviewBridge({
    readDocumentRevision: (projectId) => {
      const state = useCanonicalDocumentStore.getState();
      return state.currentProjectId === projectId ? state.documentVersion : -1;
    },
    runtime: editorPresentationFillPilotRuntime,
  });

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
  if (typeof window === "undefined") return false;
  // Phase 3 production cutover: default-on. `?adr187FillPilot=0` is the
  // explicit rollback switch for diagnosing a live regression.
  return (
    new URLSearchParams(window.location.search).get(FILL_PILOT_QUERY_PARAM) !==
    "0"
  );
}

function getMaterializationContext(
  document: CompositionDocument,
  selectedElementId: string,
  elementOverride?: CanonicalNode,
): SkiaPresentationMaterializationContext {
  let documentCache = materializationContextByDocument.get(document);
  if (!documentCache) {
    documentCache = new Map();
    materializationContextByDocument.set(document, documentCache);
  }
  const cached = documentCache.get(selectedElementId);
  if (cached) return cached;

  const elementsView = getCanonicalDocumentElementsView(document);
  const element = elementOverride ?? elementsView.byId.get(selectedElementId);
  if (!element) {
    return Object.freeze({
      ancestorTypes: Object.freeze([]),
      hasGenericBackground: false,
      hasChildren: false,
    });
  }
  const ancestorTypes: string[] = [];
  const visitedAncestorIds = new Set<string>([selectedElementId]);
  let parentId = elementOverride
    ? null
    : (element as { parent_id?: string | null }).parent_id;
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
    hasChildren: elementOverride
      ? (elementOverride.children?.length ?? 0) > 0
      : elementsView.elements.some(
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

  const target = resolveEditorPresentationTarget(projectId, selectedElementId);
  if (!target) return null;
  const element = getEditorPresentationTargetNode(projectId, target);
  if (!element) return null;

  const primitiveBinding = getPrimitiveBinding(element.type)?.skiaPrimitive;
  if (
    !canMaterializeSkiaPresentationFill(
      primitiveBinding,
      (element.props ?? {}) as Readonly<Record<string, unknown>>,
      target.kind === "canonical-node"
        ? getMaterializationContext(document, selectedElementId)
        : getMaterializationContext(document, selectedElementId, element),
    )
  ) {
    return null;
  }

  if (!editorPresentationCanonicalRuntimeOptions.hasTarget(projectId, target)) {
    return null;
  }
  const value = editorPresentationCanonicalRuntimeOptions.readTargetValue(
    projectId,
    target,
    "fill-paint",
  );
  const fills = Array.isArray(value) ? (value as FillItem[]) : [];
  const fill = fills[0];
  const isMutableGradient =
    fill?.type === FillType.LinearGradient ||
    fill?.type === FillType.RadialGradient ||
    fill?.type === FillType.AngularGradient;
  if (
    fills.length !== 1 ||
    !fill ||
    fill.id !== fillId ||
    !fill.enabled ||
    (fill.type === FillType.Color &&
      !/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(fill.color)) ||
    (isMutableGradient && (!("stops" in fill) || fill.stops.length < 2)) ||
    (fill.type !== FillType.Color && !isMutableGradient)
  ) {
    return null;
  }

  return {
    fills,
    projectId,
    target,
  };
}

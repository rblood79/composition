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
import type { ColorFillItem, FillItem } from "../../types/builder/fill.types";
import { FillType } from "../../types/builder/fill.types";
import { hex8ToFloat32 } from "../panels/styles/utils/colorUtils";
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
import { getSkiaNode } from "../workspace/canvas/skia/useSkiaNode";

const FILL_PILOT_QUERY_PARAM = "adr187FillPilot";
const materializationContextByDocument = new WeakMap<
  CompositionDocument,
  Map<string, SkiaPresentationMaterializationContext>
>();

export const editorPresentationFillPilotRuntime =
  new EditorPresentationTransactionRuntime(
    editorPresentationCanonicalRuntimeOptions,
  );

export interface EditorPresentationFillParitySample {
  readonly available: boolean;
  readonly expectedRgba: readonly number[] | null;
  readonly phase: "canonical" | "presentation" | null;
  readonly previewCssColor: string | null;
  readonly previewMaxChannelDelta: number | null;
  readonly previewRgba: readonly number[] | null;
  readonly previewSkiaMaxChannelDelta: number | null;
  readonly reason: string | null;
  readonly skiaMaxChannelDelta: number | null;
  readonly skiaRgba: readonly number[] | null;
  readonly targetId: string | null;
}

let lastParityProjectId: string | null = null;
let lastParityTarget: EditorPresentationTargetRef | null = null;
let parityCaptureArmed = false;

function parseCssColorChannel(value: string): number | null {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  return value.endsWith("%") ? parsed / 100 : parsed / 255;
}

function parseCssAlpha(value: string | undefined): number | null {
  if (value === undefined) return 1;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  return value.endsWith("%") ? parsed / 100 : parsed;
}

function parseComputedCssColor(value: string): readonly number[] | null {
  const rgb = value.match(/^rgba?\((.+)\)$/i);
  if (rgb) {
    const parts = rgb[1]
      .replaceAll(",", " ")
      .split(/[\s/]+/)
      .filter(Boolean);
    if (parts.length < 3) return null;
    const red = parseCssColorChannel(parts[0]);
    const green = parseCssColorChannel(parts[1]);
    const blue = parseCssColorChannel(parts[2]);
    const alpha = parseCssAlpha(parts[3]);
    if (red === null || green === null || blue === null || alpha === null) {
      return null;
    }
    return Object.freeze([red, green, blue, alpha]);
  }

  const srgb = value.match(/^color\(srgb\s+(.+)\)$/i);
  if (!srgb) return null;
  const parts = srgb[1].split(/[\s/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const red = Number.parseFloat(parts[0]);
  const green = Number.parseFloat(parts[1]);
  const blue = Number.parseFloat(parts[2]);
  const alpha = parseCssAlpha(parts[3]);
  if (
    !Number.isFinite(red) ||
    !Number.isFinite(green) ||
    !Number.isFinite(blue) ||
    alpha === null
  ) {
    return null;
  }
  return Object.freeze([red, green, blue, alpha]);
}

function maxChannelDelta(
  left: readonly number[] | null,
  right: readonly number[] | null,
): number | null {
  if (!left || !right || left.length !== right.length) return null;
  return Number(
    Math.max(
      ...left.map((value, index) => Math.abs(value - right[index])),
    ).toFixed(6),
  );
}

function unavailableParitySample(
  reason: string,
): EditorPresentationFillParitySample {
  return Object.freeze({
    available: false,
    expectedRgba: null,
    phase: null,
    previewCssColor: null,
    previewMaxChannelDelta: null,
    previewRgba: null,
    previewSkiaMaxChannelDelta: null,
    reason,
    skiaMaxChannelDelta: null,
    skiaRgba: null,
    targetId: null,
  });
}

/** exact-URL live gate 전용 read-only CSS Preview↔Skia fill sample. */
export function readEditorPresentationFillParitySample(): EditorPresentationFillParitySample {
  let projectId: string | null = null;
  let target: EditorPresentationTargetRef | null = null;
  let fills: readonly FillItem[] | null = null;
  let phase: EditorPresentationFillParitySample["phase"] = null;

  for (const session of editorPresentationFillPilotRuntime
    .getSnapshot()
    .sessions.values()) {
    const descriptor = session.applied?.descriptor;
    if (descriptor?.type !== "fills.replace") continue;
    projectId = session.projectId;
    target = descriptor.target;
    fills = descriptor.fills;
    phase = "presentation";
  }

  if (projectId && target) {
    lastParityProjectId = projectId;
    lastParityTarget = target;
  } else if (lastParityProjectId && lastParityTarget) {
    projectId = lastParityProjectId;
    target = lastParityTarget;
    const canonicalFills =
      editorPresentationCanonicalRuntimeOptions.readTargetValue(
        projectId,
        target,
        "fill-paint",
      );
    fills = Array.isArray(canonicalFills)
      ? (canonicalFills as readonly FillItem[])
      : null;
    phase = "canonical";
  }

  if (!projectId || !target || !fills) {
    return unavailableParitySample("no-fill-presentation-target");
  }
  const fill = fills[0];
  if (fill?.type !== FillType.Color) {
    return unavailableParitySample("target-is-not-a-color-fill");
  }

  const targetNode = getEditorPresentationTargetNode(projectId, target);
  const targetId = targetNode?.id ?? null;
  if (!targetId) return unavailableParitySample("target-node-not-found");

  const expected = hex8ToFloat32(fill.color);
  const expectedRgba = Object.freeze([
    expected[0],
    expected[1],
    expected[2],
    expected[3] * fill.opacity,
  ]);
  const skiaTarget = getSkiaNode(targetId)?.presentationFillTargets?.[0];
  const skiaRgba = skiaTarget ? Object.freeze([...skiaTarget.color]) : null;
  const iframe = document.querySelector<HTMLIFrameElement>("#previewFrame");
  const previewDocument = iframe?.contentDocument ?? null;
  const previewElement = previewDocument
    ? ([
        ...previewDocument.querySelectorAll<HTMLElement>("[data-element-id]"),
      ].find((element) => element.dataset.elementId === targetId) ?? null)
    : null;
  const previewCssColor =
    previewElement && previewDocument?.defaultView
      ? previewDocument.defaultView.getComputedStyle(previewElement)
          .backgroundColor
      : null;
  const previewRgba = previewCssColor
    ? parseComputedCssColor(previewCssColor)
    : null;
  const expectedSkiaRgba = skiaTarget
    ? Object.freeze([
        expectedRgba[0],
        expectedRgba[1],
        expectedRgba[2],
        expectedRgba[3] * skiaTarget.opacityMultiplier,
      ])
    : null;

  return Object.freeze({
    available: previewRgba !== null && skiaRgba !== null,
    expectedRgba,
    phase,
    previewCssColor,
    previewMaxChannelDelta: maxChannelDelta(previewRgba, expectedRgba),
    previewRgba,
    previewSkiaMaxChannelDelta: maxChannelDelta(previewRgba, skiaRgba),
    reason:
      previewRgba === null
        ? "preview-color-not-found"
        : skiaRgba === null
          ? "skia-fill-target-not-found"
          : null,
    skiaMaxChannelDelta: maxChannelDelta(skiaRgba, expectedSkiaRgba),
    skiaRgba,
    targetId,
  });
}

function writeEditorPresentationFillParitySample(): void {
  document.documentElement.dataset.compositionAdr187FillParity = JSON.stringify(
    readEditorPresentationFillParitySample(),
  );
}

if (typeof window !== "undefined" && import.meta.env.DEV) {
  editorPresentationFillPilotRuntime.subscribeSessionEvents((event) => {
    if (
      !parityCaptureArmed ||
      event.type !== "updated" ||
      event.session.applied?.descriptor.type !== "fills.replace"
    ) {
      return;
    }
    parityCaptureArmed = false;
    // DEV one-shot probe only. Product frame scheduling remains runtime-owned;
    // the delayed checkpoint samples both consumers while a long native drag
    // is still active, after the Preview postMessage consumer has settled.
    setTimeout(writeEditorPresentationFillParitySample, 250);
  });
}

declare global {
  interface Window {
    __composition_EDITOR_PRESENTATION_FILL_PARITY_DOM_ABORT__?: AbortController;
    __composition_EDITOR_PRESENTATION_DEBUG__?: {
      begin(input: BeginEditorPresentationInput): EditorPresentationHandle;
      diagnostics(): EditorPresentationRuntimeDiagnostics;
      fillParity(): EditorPresentationFillParitySample;
    };
  }
}

// 실제 Builder의 singleton runtime을 브라우저 검증 하니스가 사용하도록 한다.
// 동적 import는 Vite query가 다른 module instance를 만들 수 있으므로 live parity
// 증거로 사용할 수 없다. production benchmark도 같은 query를 사용하므로 metrics
// opt-in에서만 동일 instance를 노출한다(overlay 전용이며 canonical commit API는 없다).
if (
  typeof window !== "undefined" &&
  (import.meta.env.DEV ||
    new URLSearchParams(window.location.search).has("adr187Metrics"))
) {
  window.__composition_EDITOR_PRESENTATION_DEBUG__ = {
    begin: (input) =>
      editorPresentationFillPilotRuntime.beginEditorPresentation(input),
    diagnostics: () => editorPresentationFillPilotRuntime.getDiagnostics(),
    fillParity: readEditorPresentationFillParitySample,
  };
}

if (typeof document !== "undefined" && import.meta.env.DEV) {
  window.__composition_EDITOR_PRESENTATION_FILL_PARITY_DOM_ABORT__?.abort();
  const controller = new AbortController();
  window.__composition_EDITOR_PRESENTATION_FILL_PARITY_DOM_ABORT__ = controller;
  const commands = {
    arm: () => {
      parityCaptureArmed = true;
      delete document.documentElement.dataset.compositionAdr187FillParity;
    },
    snapshot: writeEditorPresentationFillParitySample,
  } as const;
  const commandButtons: HTMLButtonElement[] = [];
  for (const [commandIndex, [command, run]] of Object.entries(
    commands,
  ).entries()) {
    const selector = `[data-adr187-fill-parity-command="${command}"]`;
    document.documentElement.querySelector(selector)?.remove();
    const button = document.createElement("button");
    button.type = "button";
    button.tabIndex = -1;
    button.setAttribute("aria-hidden", "true");
    button.dataset.adr187FillParityCommand = command;
    Object.assign(button.style, {
      border: "0",
      height: "1px",
      left: `${8 + commandIndex}px`,
      opacity: "0",
      padding: "0",
      position: "fixed",
      top: "0",
      width: "1px",
      zIndex: "2147483647",
    });
    button.onclick = run;
    document.documentElement.append(button);
    commandButtons.push(button);
  }
  controller.signal.addEventListener(
    "abort",
    () => commandButtons.forEach((button) => button.remove()),
    { once: true },
  );
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
  readonly materializedFallback: boolean;
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
  fallbackFill?: ColorFillItem,
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
  const canonicalFills = Array.isArray(value) ? (value as FillItem[]) : [];
  // 신규 요소와 legacy backgroundColor read-through는 아직 canonical fills가 없다.
  // 이 경우에만 caller가 제공한 단일 color fill을 presentation overlay의 base로
  // materialize한다. ref descendant는 style override 정리까지 atomic하게 보장할 수
  // 없으므로 canonical root에만 허용한다.
  const materializedFallback =
    canonicalFills.length === 0 &&
    target.kind === "canonical-node" &&
    fallbackFill?.id === fillId;
  const fills = materializedFallback ? [fallbackFill] : canonicalFills;
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
    materializedFallback,
    projectId,
    target,
  };
}

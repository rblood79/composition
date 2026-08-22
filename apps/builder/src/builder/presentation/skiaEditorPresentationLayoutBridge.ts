import type { ComputedLayout } from "../workspace/canvas/layout/engines/LayoutEngine";
import type { CanvasSceneNode } from "../workspace/canvas/scene/canvasSceneNode";
import { recordEditorPresentationTargetIncrementalPatches } from "../performance/editorPresentationPhase0Metrics";
import {
  buildSubtreeCommandStream,
  getCachedCommandStreamSnapshot,
  type RenderCommandStream,
} from "../workspace/canvas/skia/renderCommands";
import {
  applySubtreeCommandPatch,
  getSubtreeElementIds,
} from "../workspace/canvas/skia/subtreeCommandPatch";
import type {
  EditorPresentationSession,
  EditorMutationDescriptor,
} from "./editorPresentationTypes";
import type {
  EditorPresentationSessionEvent,
  EditorPresentationTransactionRuntime,
} from "./editorPresentationRuntime";
import {
  createPresentationLayoutPlan,
  createPresentationLayoutPublications,
  type PresentationLayoutTreeIndex,
} from "./editorPresentationLayoutLane";

interface SkiaEditorPresentationLayoutBridgeOptions {
  readonly getActiveProjectId: () => string | null;
  readonly getCanonicalRevision: () => number;
  readonly getChildrenMap: () => Map<string, CanvasSceneNode[]>;
  readonly getLayoutMap: () => ReadonlyMap<string, ComputedLayout> | null;
  readonly getRenderNode: (nodeId: string) => CanvasSceneNode | undefined;
  readonly onPatched: (stream: RenderCommandStream) => void;
  readonly runtime: EditorPresentationTransactionRuntime;
}

type PositionPatch = {
  readonly x?: number;
  readonly y?: number;
};

interface SessionPatchState {
  readonly rootKey: string;
  readonly targetId: string;
  terminalRevision: number | null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readPositionPatch(
  descriptor: EditorMutationDescriptor,
): PositionPatch | null {
  if (
    descriptor.type !== "style.patch" &&
    descriptor.type !== "geometry.patch"
  ) {
    return null;
  }

  const patch = descriptor.patch;
  const allowedKeys =
    descriptor.type === "style.patch" ? ["left", "top"] : ["x", "y"];
  const keys = Object.keys(patch);
  if (keys.length === 0 || keys.some((key) => !allowedKeys.includes(key))) {
    return null;
  }

  const xValue = patch[descriptor.type === "style.patch" ? "left" : "x"];
  const yValue = patch[descriptor.type === "style.patch" ? "top" : "y"];
  if (
    (xValue !== undefined && !isFiniteNumber(xValue)) ||
    (yValue !== undefined && !isFiniteNumber(yValue))
  ) {
    return null;
  }
  return {
    ...(xValue !== undefined ? { x: xValue } : {}),
    ...(yValue !== undefined ? { y: yValue } : {}),
  };
}

function getAbsolutePosition(node: CanvasSceneNode): boolean {
  const style = node.sourceNode?.props?.style;
  return (
    style !== null &&
    typeof style === "object" &&
    (style as Record<string, unknown>).position === "absolute"
  );
}

function getRootKey(node: CanvasSceneNode): string | null {
  return node.pageId ?? node.page_id ?? null;
}

/**
 * ADR-188 Phase 4 layout consumer.
 *
 * `absolute + numeric left/top|x/y`만 hot path로 승격한다. reflow, size, parent,
 * structure, fixed/sticky, ref-descendant와 CSS 문자열은 모두 commit-only다.
 */
export class SkiaEditorPresentationLayoutBridge {
  readonly #options: SkiaEditorPresentationLayoutBridgeOptions;
  readonly #unsubscribe: () => void;
  readonly #presentationRevisionByRootKey = new Map<string, number>();
  readonly #sessionState = new Map<string, SessionPatchState>();
  #planSequence = 0;

  constructor(options: SkiaEditorPresentationLayoutBridgeOptions) {
    this.#options = options;
    this.#unsubscribe = options.runtime.subscribeSessionEvents((event) =>
      this.#handleEvent(event),
    );
  }

  dispose(): void {
    this.#unsubscribe();
    this.#presentationRevisionByRootKey.clear();
    this.#sessionState.clear();
  }

  handleStoreSync(renderedDocumentRevision: number): void {
    for (const [sessionId, state] of this.#sessionState) {
      if (
        state.terminalRevision !== null &&
        renderedDocumentRevision >= state.terminalRevision
      ) {
        this.#sessionState.delete(sessionId);
      }
    }
  }

  #handleEvent(event: EditorPresentationSessionEvent): void {
    if (event.type === "updated") {
      this.#applySession(event.session);
      return;
    }
    const state = this.#sessionState.get(event.session.sessionId);
    if (!state) return;
    if (event.result.status === "committed") {
      state.terminalRevision = event.result.committedDocumentRevision;
      return;
    }
    this.#restoreSession(state);
    this.#sessionState.delete(event.session.sessionId);
  }

  #applySession(session: EditorPresentationSession): void {
    if (session.projectId !== this.#options.getActiveProjectId()) return;
    const descriptor = session.applied?.descriptor;
    if (!descriptor || descriptor.target.kind !== "canonical-node") {
      const state = this.#sessionState.get(session.sessionId);
      if (state) this.#restoreSession(state);
      return;
    }

    const positionPatch = readPositionPatch(descriptor);
    if (!positionPatch) {
      const state = this.#sessionState.get(session.sessionId);
      if (state) this.#restoreSession(state);
      return;
    }

    const targetId = descriptor.target.nodeId;
    const renderNode = this.#options.getRenderNode(targetId);
    if (!renderNode || !getAbsolutePosition(renderNode)) return;

    const rootKey = getRootKey(renderNode);
    if (!rootKey) return;

    const previousState = this.#sessionState.get(session.sessionId);
    if (previousState && previousState.targetId !== targetId) {
      this.#restoreSession(previousState);
      this.#sessionState.delete(session.sessionId);
    }

    const current = getCachedCommandStreamSnapshot();
    const layoutMap = this.#options.getLayoutMap();
    const childrenMap = this.#options.getChildrenMap();
    if (!current || !layoutMap) return;

    const context = current.subtreeBuildContextByElement.get(targetId);
    const currentSpan = current.subtreeSpans.get(targetId);
    if (!context || !currentSpan || current.topLayerElementIds.has(targetId)) {
      return;
    }

    const baseLayout = layoutMap.get(targetId);
    if (!baseLayout) return;
    const nextLayout = {
      ...baseLayout,
      ...(positionPatch.x !== undefined ? { x: positionPatch.x } : {}),
      ...(positionPatch.y !== undefined ? { y: positionPatch.y } : {}),
    } as ComputedLayout;

    const affectedNodeIds = getSubtreeElementIds(current, currentSpan);
    const childrenByParent = new Map<string, readonly string[]>();
    const parentById = new Map<string, string | null>();
    const nodeById = new Map<string, CanvasSceneNode>();
    const rootKeyByNodeId = new Map<string, string>();
    for (const elementId of affectedNodeIds) {
      const node = this.#options.getRenderNode(elementId);
      if (!node) return;
      nodeById.set(elementId, node);
      rootKeyByNodeId.set(elementId, rootKey);
      parentById.set(elementId, node.parentId ?? node.parent_id ?? null);
      childrenByParent.set(
        elementId,
        (childrenMap.get(elementId) ?? [])
          .filter((child) => affectedNodeIds.has(child.id))
          .map((child) => child.id),
      );
    }
    const tree: PresentationLayoutTreeIndex = {
      childrenByParent,
      parentById,
      nodeById,
      rootKeyByNodeId,
    };
    const plan = createPresentationLayoutPlan({
      targets: [descriptor.target],
      mutations: [descriptor],
      tree,
    });
    if (plan.roots.length !== 1 || plan.roots[0] !== targetId) return;

    const subtreeLayoutMap = new Map<string, ComputedLayout>();
    for (const elementId of affectedNodeIds) {
      const layout = layoutMap.get(elementId);
      if (!layout) return;
      subtreeLayoutMap.set(elementId, layout);
    }
    subtreeLayoutMap.set(targetId, nextLayout);

    const canonicalRevision = this.#options.getCanonicalRevision();
    const baseCanonicalRevision = current.baseCanonicalRevision;
    if (canonicalRevision !== baseCanonicalRevision) return;

    const nextRevision =
      (this.#presentationRevisionByRootKey.get(rootKey) ??
        current.presentationRevisionByRootKey.get(rootKey) ??
        current.presentationRevision) + 1;
    const revisionMap = new Map([[rootKey, nextRevision]]);
    const publications = createPresentationLayoutPublications({
      plan,
      layoutDelta: new Map([[targetId, nextLayout]]),
      tree,
      baseCanonicalRevision,
      planSequence: this.#planSequence + 1,
      presentationRevisionByRootKey: revisionMap,
    });
    if (!publications.ok || publications.publications.length !== 1) return;
    const publication = publications.publications[0];

    const replacement = buildSubtreeCommandStream({
      rootId: targetId,
      childrenMap,
      layoutMap: subtreeLayoutMap,
      context,
      revision: {
        presentationRevision: nextRevision,
        baseCanonicalRevision,
        presentationRevisionByRootKey: revisionMap,
      },
    });
    this.#planSequence = publication.planSequence;

    const result = applySubtreeCommandPatch({
      current,
      replacement,
      rootId: targetId,
      publication,
      canonicalRevision,
    });
    if (!result.applied) return;
    recordEditorPresentationTargetIncrementalPatches(affectedNodeIds.size);
    this.#presentationRevisionByRootKey.set(rootKey, nextRevision);
    this.#sessionState.set(session.sessionId, {
      rootKey,
      targetId,
      terminalRevision: null,
    });
    this.#options.onPatched(current);
  }

  #restoreSession(state: SessionPatchState): void {
    const current = getCachedCommandStreamSnapshot();
    const layoutMap = this.#options.getLayoutMap();
    const childrenMap = this.#options.getChildrenMap();
    const currentSpan = current?.subtreeSpans.get(state.targetId);
    const context = current?.subtreeBuildContextByElement.get(state.targetId);
    const canonicalRevision = this.#options.getCanonicalRevision();
    if (
      !current ||
      !layoutMap ||
      !currentSpan ||
      !context ||
      canonicalRevision !== current.baseCanonicalRevision
    ) {
      return;
    }

    const affectedNodeIds = getSubtreeElementIds(current, currentSpan);
    const subtreeLayoutMap = new Map<string, ComputedLayout>();
    for (const elementId of affectedNodeIds) {
      const layout = layoutMap.get(elementId);
      if (!layout) return;
      subtreeLayoutMap.set(elementId, layout);
    }
    const nextRevision =
      (this.#presentationRevisionByRootKey.get(state.rootKey) ??
        current.presentationRevisionByRootKey.get(state.rootKey) ??
        current.presentationRevision) + 1;
    const replacement = buildSubtreeCommandStream({
      rootId: state.targetId,
      childrenMap,
      layoutMap: subtreeLayoutMap,
      context,
      revision: {
        presentationRevision: nextRevision,
        baseCanonicalRevision: current.baseCanonicalRevision,
        presentationRevisionByRootKey: new Map([[state.rootKey, nextRevision]]),
      },
    });
    const result = applySubtreeCommandPatch({
      current,
      replacement,
      rootId: state.targetId,
      publication: {
        rootKey: state.rootKey,
        presentationRevision: nextRevision,
        baseCanonicalRevision: current.baseCanonicalRevision,
      },
      canonicalRevision,
    });
    if (!result.applied) return;
    recordEditorPresentationTargetIncrementalPatches(affectedNodeIds.size);
    this.#presentationRevisionByRootKey.set(state.rootKey, nextRevision);
    this.#options.onPatched(current);
  }
}

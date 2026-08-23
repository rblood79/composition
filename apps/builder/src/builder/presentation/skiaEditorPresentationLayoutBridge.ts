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
  type PresentationLayoutComputeRequest,
  type PresentationLayoutTreeIndex,
} from "./editorPresentationLayoutLane";

export type { PresentationLayoutComputeRequest } from "./editorPresentationLayoutLane";

interface SkiaEditorPresentationLayoutBridgeOptions {
  readonly getActiveProjectId: () => string | null;
  readonly getCanonicalRevision: () => number;
  readonly getChildrenMap: () => Map<string, CanvasSceneNode[]>;
  readonly getLayoutMap: () => ReadonlyMap<string, ComputedLayout> | null;
  readonly getRenderNode: (nodeId: string) => CanvasSceneNode | undefined;
  readonly computeTargetedLayout?: (
    input: PresentationLayoutComputeRequest,
  ) => ReadonlyMap<string, ComputedLayout> | null;
  readonly onPatched: (stream: RenderCommandStream) => void;
  readonly runtime: EditorPresentationTransactionRuntime;
}

type LayoutPatch = {
  readonly x?: number;
  readonly y?: number;
  readonly width?: number;
  readonly height?: number;
  readonly padding?: number;
  readonly paddingTop?: number;
  readonly paddingRight?: number;
  readonly paddingBottom?: number;
  readonly paddingLeft?: number;
  readonly gap?: number;
  readonly rowGap?: number;
  readonly columnGap?: number;
};

const TARGETED_SPACING_KEYS = [
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "gap",
  "rowGap",
  "columnGap",
] as const;

interface SessionPatchState {
  readonly rootKey: string;
  readonly rootId: string;
  readonly targetId: string;
  terminalRevision: number | null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function readLayoutPatch(
  descriptor: EditorMutationDescriptor,
): LayoutPatch | null {
  if (
    descriptor.type !== "style.patch" &&
    descriptor.type !== "geometry.patch"
  ) {
    return null;
  }

  const patch = descriptor.patch;
  const allowedKeys =
    descriptor.type === "style.patch"
      ? ["left", "top", "width", "height", ...TARGETED_SPACING_KEYS]
      : ["x", "y", "width", "height"];
  const keys = Object.keys(patch);
  if (keys.length === 0 || keys.some((key) => !allowedKeys.includes(key))) {
    return null;
  }

  const xValue = patch[descriptor.type === "style.patch" ? "left" : "x"];
  const yValue = patch[descriptor.type === "style.patch" ? "top" : "y"];
  const widthValue = patch.width;
  const heightValue = patch.height;
  const spacingValues = Object.fromEntries(
    TARGETED_SPACING_KEYS.filter((key) => patch[key] !== undefined).map(
      (key) => [key, patch[key]],
    ),
  ) as Record<string, unknown>;
  if (
    (xValue !== undefined && !isFiniteNumber(xValue)) ||
    (yValue !== undefined && !isFiniteNumber(yValue)) ||
    (widthValue !== undefined &&
      (!isFiniteNumber(widthValue) || widthValue < 0)) ||
    (heightValue !== undefined &&
      (!isFiniteNumber(heightValue) || heightValue < 0)) ||
    Object.values(spacingValues).some(
      (value) => !isFiniteNumber(value) || value < 0,
    )
  ) {
    return null;
  }
  return {
    ...(xValue !== undefined ? { x: xValue } : {}),
    ...(yValue !== undefined ? { y: yValue } : {}),
    ...(widthValue !== undefined ? { width: widthValue } : {}),
    ...(heightValue !== undefined ? { height: heightValue } : {}),
    ...spacingValues,
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

function hasExplicitSize(node: CanvasSceneNode | undefined): boolean {
  const style = node?.sourceNode?.props?.style;
  if (!style || typeof style !== "object") return false;
  const record = style as Record<string, unknown>;
  return (
    record.width !== undefined &&
    record.width !== null &&
    record.width !== "auto" &&
    record.height !== undefined &&
    record.height !== null &&
    record.height !== "auto"
  );
}

function collectSubtreeIds(
  rootId: string,
  childrenMap: ReadonlyMap<string, readonly CanvasSceneNode[]>,
  target: Set<string>,
): void {
  const pending = [rootId];
  while (pending.length > 0) {
    const nodeId = pending.pop()!;
    if (target.has(nodeId)) continue;
    target.add(nodeId);
    for (const child of childrenMap.get(nodeId) ?? []) pending.push(child.id);
  }
}

/**
 * ADR-188 Phase 4 layout consumer.
 *
 * `absolute + numeric left/top|x/y`, numeric width/height, non-grid flow의
 * padding/gap만 hot path로 승격한다. targeted consumer가 없는 structure,
 * fixed/sticky, grid track, ref-descendant와 CSS 문자열은 모두 commit-only다.
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

    const layoutPatch = readLayoutPatch(descriptor);
    if (!layoutPatch) {
      const state = this.#sessionState.get(session.sessionId);
      if (state) this.#restoreSession(state);
      return;
    }

    const targetId = descriptor.target.nodeId;
    const renderNode = this.#options.getRenderNode(targetId);
    if (!renderNode) return;

    const hasSizePatch =
      layoutPatch.width !== undefined || layoutPatch.height !== undefined;
    const hasSpacingPatch = TARGETED_SPACING_KEYS.some(
      (key) => layoutPatch[key] !== undefined,
    );
    const hasTargetedLayoutPatch = hasSizePatch || hasSpacingPatch;
    if (!hasTargetedLayoutPatch && !getAbsolutePosition(renderNode)) return;

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

    const affectedNodeIds = new Set<string>();
    collectSubtreeIds(targetId, childrenMap, affectedNodeIds);
    // used-size promotion may move the publication root to an in-flow parent.
    // Gather only candidate ancestry subtrees; unrelated page roots are never read.
    let cursor = targetId;
    while (true) {
      const node = this.#options.getRenderNode(cursor);
      const parentId = node?.parentId ?? node?.parent_id ?? null;
      if (!parentId) break;
      collectSubtreeIds(parentId, childrenMap, affectedNodeIds);
      cursor = parentId;
      if (hasExplicitSize(node)) break;
    }

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
    if (plan.roots.length !== 1) return;
    const publicationRootId = plan.roots[0];
    if (!publicationRootId) return;

    const context = current.subtreeBuildContextByElement.get(publicationRootId);
    const currentSpan = current.subtreeSpans.get(publicationRootId);
    if (
      !context ||
      !currentSpan ||
      current.topLayerElementIds.has(publicationRootId)
    ) {
      return;
    }

    const subtreeLayoutMap = new Map<string, ComputedLayout>();
    const publicationNodeIds = getSubtreeElementIds(current, currentSpan);
    for (const elementId of publicationNodeIds) {
      const layout = layoutMap.get(elementId);
      if (!layout) return;
      subtreeLayoutMap.set(elementId, layout);
    }

    const rootLayout = layoutMap.get(publicationRootId);
    if (!rootLayout) return;
    let layoutDelta = new Map<string, ComputedLayout>();
    const computeTargetedLayout = this.#options.computeTargetedLayout;
    const canComputeTargetedLayout =
      hasTargetedLayoutPatch &&
      computeTargetedLayout &&
      (hasSpacingPatch || !getAbsolutePosition(renderNode));
    if (canComputeTargetedLayout) {
      const computed = computeTargetedLayout({
        affectedNodeIds: plan.affectedNodeIds,
        availableHeight: rootLayout.height,
        availableWidth: rootLayout.width,
        descriptor,
        parentChain: plan.parentChain,
        rootKey,
        roots: plan.roots,
      });
      if (!computed) return;
      for (const elementId of plan.affectedNodeIds) {
        const layout = computed.get(elementId);
        if (!layout) return;
        subtreeLayoutMap.set(elementId, layout);
        layoutDelta.set(elementId, layout);
      }
    } else {
      if (
        hasSpacingPatch ||
        (hasSizePatch &&
          (!getAbsolutePosition(renderNode) ||
            (childrenMap.get(targetId)?.length ?? 0) > 0))
      ) {
        const state = this.#sessionState.get(session.sessionId);
        if (state) this.#restoreSession(state);
        return;
      }
      const baseLayout = layoutMap.get(targetId);
      if (!baseLayout) return;
      const nextLayout = {
        ...baseLayout,
        ...(layoutPatch.x !== undefined ? { x: layoutPatch.x } : {}),
        ...(layoutPatch.y !== undefined ? { y: layoutPatch.y } : {}),
        ...(layoutPatch.width !== undefined
          ? { width: layoutPatch.width }
          : {}),
        ...(layoutPatch.height !== undefined
          ? { height: layoutPatch.height }
          : {}),
      } as ComputedLayout;
      subtreeLayoutMap.set(targetId, nextLayout);
      layoutDelta.set(targetId, nextLayout);
    }

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
      layoutDelta,
      tree,
      baseCanonicalRevision,
      planSequence: this.#planSequence + 1,
      presentationRevisionByRootKey: revisionMap,
    });
    if (!publications.ok || publications.publications.length !== 1) return;
    const publication = publications.publications[0];

    const replacement = buildSubtreeCommandStream({
      rootId: publicationRootId,
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
      rootId: publicationRootId,
      publication,
      canonicalRevision,
    });
    if (!result.applied) return;
    recordEditorPresentationTargetIncrementalPatches(affectedNodeIds.size);
    this.#presentationRevisionByRootKey.set(rootKey, nextRevision);
    this.#sessionState.set(session.sessionId, {
      rootKey,
      rootId: publicationRootId,
      targetId,
      terminalRevision: null,
    });
    this.#options.onPatched(current);
  }

  #restoreSession(state: SessionPatchState): void {
    const current = getCachedCommandStreamSnapshot();
    const layoutMap = this.#options.getLayoutMap();
    const childrenMap = this.#options.getChildrenMap();
    const currentSpan = current?.subtreeSpans.get(state.rootId);
    const context = current?.subtreeBuildContextByElement.get(state.rootId);
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
      rootId: state.rootId,
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
      rootId: state.rootId,
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

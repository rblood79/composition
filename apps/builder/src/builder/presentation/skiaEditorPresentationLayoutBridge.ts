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
import { normalizePresentationSpacingPatch } from "./editorPresentationStyleNormalization";
import {
  publishLayoutReceipt,
  type PresentationLayoutRejectReason,
} from "./editorPresentationLayoutReceipt";

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

/**
 * ADR-224 캔버스 resize — marker 축의 Fill 파생 CSS 를 미리보기에서 지우는 키 (값은 "" 만).
 * commit 이 지우는 집합 (`resolveSizeMode("fixed").remove`) + projection 이 넣은 min.
 */
const TARGETED_RELEASE_KEYS = [
  "alignSelf",
  "flexBasis",
  "flexGrow",
  "flexShrink",
  "justifySelf",
  "minWidth",
  "minHeight",
] as const;

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

type LayoutApplyOutcome =
  | {
      readonly ok: true;
      readonly rootKey: string;
      readonly baseCanonicalRevision: number;
      readonly presentationRevision: number;
    }
  | {
      readonly ok: false;
      readonly reason: PresentationLayoutRejectReason;
      readonly rootKey?: string;
      readonly baseCanonicalRevision?: number;
    };

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

  const patch =
    descriptor.type === "style.patch"
      ? normalizePresentationSpacingPatch(descriptor.patch)
      : descriptor.patch;
  const allowedKeys =
    descriptor.type === "style.patch"
      ? [
          "left",
          "top",
          "width",
          "height",
          ...TARGETED_SPACING_KEYS,
          ...TARGETED_RELEASE_KEYS,
        ]
      : ["x", "y", "width", "height"];
  const keys = Object.keys(patch);
  if (keys.length === 0 || keys.some((key) => !allowedKeys.includes(key))) {
    return null;
  }
  // release 키는 제거 ("") 만 — 값을 싣는 patch 는 이 lane 의 계약 밖
  if (
    descriptor.type === "style.patch" &&
    TARGETED_RELEASE_KEYS.some(
      (key) => patch[key] !== undefined && patch[key] !== "",
    )
  ) {
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

  /**
   * ADR-222 §4.2: layout descriptor 를 가진 session 의 각 frame 은 receipt 를 남긴다.
   * 성공은 `#applyLayoutSession` 이 publication revision 을 반환할 때, 실패는 그
   * 안의 모든 early return 이 사유를 반환할 때다. base 로 되돌아간 frame
   * (applied null) 은 restore 결과를 같은 revision 으로 보고한다.
   */
  #applySession(session: EditorPresentationSession): void {
    if (session.projectId !== this.#options.getActiveProjectId()) return;
    const descriptor = session.applied?.descriptor;
    if (!descriptor || descriptor.target.kind !== "canonical-node") {
      const state = this.#sessionState.get(session.sessionId);
      if (state) {
        const restored = this.#restoreSession(state);
        publishLayoutReceipt(
          restored !== null
            ? {
                sessionId: session.sessionId,
                descriptorRevision: session.revision,
                baseCanonicalRevision: restored.baseCanonicalRevision,
                rootKey: state.rootKey,
                layoutPublicationRevision: restored.presentationRevision,
                result: "published",
              }
            : {
                sessionId: session.sessionId,
                descriptorRevision: session.revision,
                baseCanonicalRevision: null,
                rootKey: state.rootKey,
                result: "rejected",
                reason: "restore-rejected",
              },
        );
      }
      return;
    }

    const layoutPatch = readLayoutPatch(descriptor);
    if (
      !layoutPatch ||
      (descriptor.type !== "style.patch" &&
        descriptor.type !== "geometry.patch")
    ) {
      const state = this.#sessionState.get(session.sessionId);
      if (state) this.#restoreSession(state);
      return;
    }

    const outcome = this.#applyLayoutSession(session, descriptor, layoutPatch);
    publishLayoutReceipt(
      outcome.ok
        ? {
            sessionId: session.sessionId,
            descriptorRevision: session.revision,
            baseCanonicalRevision: outcome.baseCanonicalRevision,
            rootKey: outcome.rootKey,
            layoutPublicationRevision: outcome.presentationRevision,
            result: "published",
          }
        : {
            sessionId: session.sessionId,
            descriptorRevision: session.revision,
            baseCanonicalRevision: outcome.baseCanonicalRevision ?? null,
            rootKey: outcome.rootKey ?? null,
            result: "rejected",
            reason: outcome.reason,
          },
    );
  }

  #applyLayoutSession(
    session: EditorPresentationSession,
    descriptor: Extract<
      EditorMutationDescriptor,
      { type: "style.patch" | "geometry.patch" }
    >,
    layoutPatch: LayoutPatch,
  ): LayoutApplyOutcome {
    if (descriptor.target.kind !== "canonical-node") {
      return { ok: false, reason: "render-node-missing" };
    }
    const targetId = descriptor.target.nodeId;
    const renderNode = this.#options.getRenderNode(targetId);
    if (!renderNode) return { ok: false, reason: "render-node-missing" };

    const hasSizePatch =
      layoutPatch.width !== undefined || layoutPatch.height !== undefined;
    const hasSpacingPatch = TARGETED_SPACING_KEYS.some(
      (key) => layoutPatch[key] !== undefined,
    );
    const hasTargetedLayoutPatch = hasSizePatch || hasSpacingPatch;
    if (!hasTargetedLayoutPatch && !getAbsolutePosition(renderNode)) {
      return { ok: false, reason: "targeted-unsupported" };
    }

    const rootKey = getRootKey(renderNode);
    if (!rootKey) return { ok: false, reason: "root-key-missing" };

    const previousState = this.#sessionState.get(session.sessionId);
    if (previousState && previousState.targetId !== targetId) {
      this.#restoreSession(previousState);
      this.#sessionState.delete(session.sessionId);
    }

    const current = getCachedCommandStreamSnapshot();
    const layoutMap = this.#options.getLayoutMap();
    const childrenMap = this.#options.getChildrenMap();
    if (!current || !layoutMap) {
      return { ok: false, reason: "stream-missing", rootKey };
    }

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
      if (!node) return { ok: false, reason: "affected-node-missing", rootKey };
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
    const publicationRootId = plan.roots.length === 1 ? plan.roots[0] : null;
    if (!publicationRootId) {
      return { ok: false, reason: "plan-root-ambiguous", rootKey };
    }

    const context = current.subtreeBuildContextByElement.get(publicationRootId);
    const currentSpan = current.subtreeSpans.get(publicationRootId);
    if (
      !context ||
      !currentSpan ||
      current.topLayerElementIds.has(publicationRootId)
    ) {
      return { ok: false, reason: "root-context-missing", rootKey };
    }

    const subtreeLayoutMap = new Map<string, ComputedLayout>();
    const publicationNodeIds = getSubtreeElementIds(current, currentSpan);
    for (const elementId of publicationNodeIds) {
      const layout = layoutMap.get(elementId);
      if (!layout) return { ok: false, reason: "layout-missing", rootKey };
      subtreeLayoutMap.set(elementId, layout);
    }

    const rootLayout = layoutMap.get(publicationRootId);
    if (!rootLayout) return { ok: false, reason: "layout-missing", rootKey };
    const layoutDelta = new Map<string, ComputedLayout>();
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
      if (!computed) return { ok: false, reason: "compute-null", rootKey };
      for (const elementId of plan.affectedNodeIds) {
        const layout = computed.get(elementId);
        if (!layout)
          return { ok: false, reason: "compute-incomplete", rootKey };
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
        return { ok: false, reason: "targeted-unsupported", rootKey };
      }
      const baseLayout = layoutMap.get(targetId);
      if (!baseLayout) return { ok: false, reason: "layout-missing", rootKey };
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
    if (canonicalRevision !== baseCanonicalRevision) {
      return {
        ok: false,
        reason: "canonical-revision-mismatch",
        rootKey,
        baseCanonicalRevision,
      };
    }

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
    if (!publications.ok || publications.publications.length !== 1) {
      return {
        ok: false,
        reason: "publication-rejected",
        rootKey,
        baseCanonicalRevision,
      };
    }
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
    if (!result.applied) {
      return {
        ok: false,
        reason: "command-patch-rejected",
        rootKey,
        baseCanonicalRevision,
      };
    }
    recordEditorPresentationTargetIncrementalPatches(affectedNodeIds.size);
    this.#presentationRevisionByRootKey.set(rootKey, nextRevision);
    this.#sessionState.set(session.sessionId, {
      rootKey,
      rootId: publicationRootId,
      targetId,
      terminalRevision: null,
    });
    this.#options.onPatched(current);
    return {
      ok: true,
      rootKey,
      baseCanonicalRevision,
      presentationRevision: nextRevision,
    };
  }

  /** canonical layout 으로 되돌린다. 성공 시 restore publication revision, 실패 null. */
  #restoreSession(
    state: SessionPatchState,
  ): { baseCanonicalRevision: number; presentationRevision: number } | null {
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
      return null;
    }

    const affectedNodeIds = getSubtreeElementIds(current, currentSpan);
    const subtreeLayoutMap = new Map<string, ComputedLayout>();
    for (const elementId of affectedNodeIds) {
      const layout = layoutMap.get(elementId);
      if (!layout) return null;
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
    if (!result.applied) return null;
    recordEditorPresentationTargetIncrementalPatches(affectedNodeIds.size);
    this.#presentationRevisionByRootKey.set(state.rootKey, nextRevision);
    this.#options.onPatched(current);
    return {
      baseCanonicalRevision: current.baseCanonicalRevision,
      presentationRevision: nextRevision,
    };
  }
}

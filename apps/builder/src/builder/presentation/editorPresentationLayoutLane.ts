import type { CanvasLayoutNode } from "../workspace/canvas/layout/layoutNode";
import type { ComputedLayout } from "../workspace/canvas/layout/engines/LayoutEngine";
import {
  toEditorPresentationTargetKey,
  type EditorMutationDescriptor,
  type EditorPresentationTargetRef,
} from "./editorPresentationTypes";
import {
  getEditorMutationEffectRule,
  type EditorMutationUsedSizeEffect,
} from "./invalidation/editorMutationEffectRegistry";
import {
  createPresentationTargetedPublications,
  type CreatePresentationPublicationsResult,
} from "./editorLayoutPublication";

export {
  createCanonicalFullLayoutPublication,
  createLayoutOverlay,
  createPresentationTargetedPublications,
  LayoutPublicationChannel,
  PresentationLayoutPublicationStore,
  type CanonicalFullLayoutPublication,
  type CreatePresentationPublicationsInput,
  type CreatePresentationPublicationsResult,
  type LayoutOverlay,
  type LayoutPublication,
  type PresentationTargetedLayoutPublication,
} from "./editorLayoutPublication";

export interface PresentationLayoutTreeIndex {
  readonly childrenByParent: ReadonlyMap<string, readonly string[]>;
  readonly parentById: ReadonlyMap<string, string | null>;
  /** promotion 규칙이 읽는 layout/style 입력. 없으면 promotion은 fail-closed 한다. */
  readonly nodeById?: ReadonlyMap<string, CanvasLayoutNode>;
  /** targeted publication root partition을 위한 canonical node → rootKey index. */
  readonly rootKeyByNodeId?: ReadonlyMap<string, string>;
}

export interface PresentationLayoutPlan {
  readonly parentChain: readonly string[];
  readonly roots: readonly string[];
  readonly affectedNodeIds: ReadonlySet<string>;
}

export interface PublishPresentationLayoutInput<T> {
  readonly plan: PresentationLayoutPlan;
  readonly resolveNode: (
    rootId: string,
    affectedNodeIds: ReadonlySet<string>,
  ) => ReadonlyMap<string, T>;
}

export interface PublishedPresentationLayout<T> {
  readonly affectedNodeIds: ReadonlySet<string>;
  readonly layoutDelta: ReadonlyMap<string, T>;
  readonly roots: readonly string[];
  readonly writeCount: number;
}

function addSubtree(
  rootId: string,
  childrenByParent: ReadonlyMap<string, readonly string[]>,
  target: Set<string>,
): void {
  const pending = [rootId];
  while (pending.length > 0) {
    const nodeId = pending.pop()!;
    if (target.has(nodeId)) continue;
    target.add(nodeId);
    for (const childId of childrenByParent.get(nodeId) ?? []) {
      pending.push(childId);
    }
  }
}

function mergeUsedSizeEffects(
  current: EditorMutationUsedSizeEffect,
  next: EditorMutationUsedSizeEffect,
): EditorMutationUsedSizeEffect {
  if (current === "content-box" || next === "content-box") {
    return "content-box";
  }
  if (current === "self-box" || next === "self-box") return "self-box";
  return "none";
}

/**
 * descriptor 의 used-size 축을 registry 에서 읽는다.
 *
 * ADR-189 Phase 1 의 commit lane 이 같은 판정을 재사용한다 — 두 lane 이 서로 다른
 * diff 계층을 갖지 않게 하려면 이 함수가 유일한 진입점이어야 한다 (ADR-189 R4).
 */
export function getDescriptorUsedSizeEffect(
  descriptor: EditorMutationDescriptor,
): EditorMutationUsedSizeEffect {
  if (
    descriptor.type !== "style.patch" &&
    descriptor.type !== "geometry.patch"
  ) {
    return "none";
  }
  const axis = descriptor.type === "style.patch" ? "style" : "geometry";

  let effect: EditorMutationUsedSizeEffect = "none";
  for (const key of Object.keys(descriptor.patch)) {
    effect = mergeUsedSizeEffects(
      effect,
      getEditorMutationEffectRule(axis, key)?.usedSizeEffect ?? "none",
    );
  }
  return effect;
}

function getNodeStyle(
  node: CanvasLayoutNode | undefined,
): Record<string, unknown> {
  return (node?.props?.style ?? {}) as Record<string, unknown>;
}

function isOutOfFlow(node: CanvasLayoutNode | undefined): boolean {
  const position = getNodeStyle(node).position;
  return position === "absolute" || position === "fixed";
}

function isFullySized(node: CanvasLayoutNode | undefined): boolean {
  const style = getNodeStyle(node);
  const hasExplicitSize = (value: unknown): boolean =>
    value !== undefined && value !== null && value !== "auto";
  return hasExplicitSize(style.width) && hasExplicitSize(style.height);
}

type LayoutContainerDisplay = "block" | "flex" | "grid" | "none";

function getLayoutContainerDisplay(
  node: CanvasLayoutNode | undefined,
): LayoutContainerDisplay {
  const display = getNodeStyle(node).display;
  if (display === "none") return "none";
  if (display === "flex" || display === "grid") return display;
  return "block";
}

/** 부모가 자식 used-size 변경을 받아 in-flow 배치를 재분배하는 규칙표. */
function parentRedistributesUsedSize(
  parent: CanvasLayoutNode | undefined,
  child: CanvasLayoutNode | undefined,
): boolean {
  if (!parent || !child || isOutOfFlow(child)) return false;
  return getLayoutContainerDisplay(parent) !== "none";
}

function shouldPromoteUsedSizeParent(input: {
  readonly childId: string;
  readonly parentId: string;
  readonly sourceTargetId: string;
  readonly tree: PresentationLayoutTreeIndex;
  readonly usedSizeEffect: EditorMutationUsedSizeEffect;
}): boolean {
  if (input.usedSizeEffect === "none") return false;
  const child = input.tree.nodeById?.get(input.childId);
  const parent = input.tree.nodeById?.get(input.parentId);
  if (!child || !parent) return false;
  // 첫 promotion은 mutation 대상의 used-size 변화로 판단한다. 이후 조상으로
  // 계속 올릴 때는 이미 승격된 child가 fully-sized면 그 경계에서 멈춘다.
  if (input.childId !== input.sourceTargetId && isFullySized(child)) {
    return false;
  }
  return parentRedistributesUsedSize(parent, child);
}

/**
 * semantic target에서 layout root와 affected subtree를 계산한다.
 * mutation registry의 used-size 축과 layout container 규칙표가 함께 true인 경우에만
 * used-size 영향으로 parent를 상향한다. 테스트는 `promotionOverrideForTest` seam으로
 * 규칙을 대체할 수 있다.
 */
export function createPresentationLayoutPlan(input: {
  readonly targets: readonly EditorPresentationTargetRef[];
  readonly mutations?: readonly EditorMutationDescriptor[];
  readonly tree: PresentationLayoutTreeIndex;
  /** 테스트에서만 container 규칙을 대체할 수 있는 seam. */
  readonly promotionOverrideForTest?: (
    parentId: string,
    childId: string,
  ) => boolean;
}): PresentationLayoutPlan {
  const roots = new Set<string>();
  const parentChain = new Set<string>();

  for (const target of input.targets) {
    let rootId =
      target.kind === "canonical-node" ? target.nodeId : target.refId;
    let parentId = input.tree.parentById.get(rootId) ?? null;
    const visited = new Set([rootId]);
    const targetKey = toEditorPresentationTargetKey(target);
    const usedSizeEffect = (input.mutations ?? [])
      .filter(
        (mutation) =>
          toEditorPresentationTargetKey(mutation.target) === targetKey,
      )
      .reduce<EditorMutationUsedSizeEffect>(
        (effect, mutation) =>
          mergeUsedSizeEffects(effect, getDescriptorUsedSizeEffect(mutation)),
        "none",
      );
    const sourceTargetId =
      target.kind === "canonical-node" ? target.nodeId : target.refId;
    while (
      parentId &&
      (input.promotionOverrideForTest
        ? input.promotionOverrideForTest(parentId, rootId)
        : shouldPromoteUsedSizeParent({
            childId: rootId,
            parentId,
            sourceTargetId,
            tree: input.tree,
            usedSizeEffect,
          }))
    ) {
      if (visited.has(parentId)) break;
      visited.add(parentId);
      parentChain.add(parentId);
      rootId = parentId;
      parentId = input.tree.parentById.get(rootId) ?? null;
    }
    roots.add(rootId);
  }

  const affectedNodeIds = new Set<string>();
  for (const rootId of roots) {
    addSubtree(rootId, input.tree.childrenByParent, affectedNodeIds);
  }

  return Object.freeze({
    parentChain: Object.freeze([...parentChain]),
    roots: Object.freeze([...roots]),
    affectedNodeIds,
  });
}

/** targeted resolver가 반환한 affected 값만 delta에 기록한다. base map은 읽지 않는다. */
export function publishPresentationLayout<T>(
  input: PublishPresentationLayoutInput<T>,
): PublishedPresentationLayout<T> {
  const layoutDelta = new Map<string, T>();
  for (const rootId of input.plan.roots) {
    const resolved = input.resolveNode(rootId, input.plan.affectedNodeIds);
    for (const [nodeId, layout] of resolved) {
      if (input.plan.affectedNodeIds.has(nodeId)) {
        layoutDelta.set(nodeId, layout);
      }
    }
  }
  return Object.freeze({
    affectedNodeIds: input.plan.affectedNodeIds,
    layoutDelta,
    roots: input.plan.roots,
    writeCount: layoutDelta.size,
  });
}

/**
 * PresentationLayoutTreeIndex의 rootKey SSOT를 publication partition에 연결한다.
 * index가 없거나 node가 누락되면 targeted publication을 만들지 않는다.
 */
export function createPresentationLayoutPublications<T>(input: {
  readonly plan: PresentationLayoutPlan;
  readonly layoutDelta: ReadonlyMap<string, T>;
  readonly tree: PresentationLayoutTreeIndex;
  readonly baseCanonicalRevision: number;
  readonly planSequence: number;
  readonly presentationRevisionByRootKey: ReadonlyMap<string, number>;
}): CreatePresentationPublicationsResult<T> {
  const rootKeyByNodeId = input.tree.rootKeyByNodeId;
  if (!rootKeyByNodeId) {
    return { ok: false, reason: "unknown-root-key" };
  }
  return createPresentationTargetedPublications({
    plan: input.plan,
    layoutDelta: input.layoutDelta,
    rootKeyForNode: (nodeId) => rootKeyByNodeId.get(nodeId),
    baseCanonicalRevision: input.baseCanonicalRevision,
    planSequence: input.planSequence,
    presentationRevisionByRootKey: input.presentationRevisionByRootKey,
  });
}

function isGeometryKey(key: string): key is "x" | "y" | "width" | "height" {
  return key === "x" || key === "y" || key === "width" || key === "height";
}

/**
 * canonical node를 mutate하지 않고 presentation style/geometry를 layout input으로
 * 합성한다. unknown key는 layout lane에 흘리지 않고 그대로 무시한다.
 */
export function resolveCanonicalNodeWithPresentation(
  node: CanvasLayoutNode,
  target: EditorPresentationTargetRef,
  mutations: readonly EditorMutationDescriptor[],
): CanvasLayoutNode {
  if (target.kind !== "canonical-node" || target.nodeId !== node.id) {
    return node;
  }

  let next = node;
  for (const mutation of mutations) {
    if (
      toEditorPresentationTargetKey(mutation.target) !==
      toEditorPresentationTargetKey(target)
    ) {
      continue;
    }
    if (mutation.type === "style.patch") {
      const layoutPatch = Object.fromEntries(
        Object.entries(mutation.patch).filter(
          ([key]) =>
            getEditorMutationEffectRule("style", key)?.invalidation ===
            "layout",
        ),
      );
      if (Object.keys(layoutPatch).length === 0) continue;
      const props = (next.props ?? {}) as Record<string, unknown>;
      const style = (props.style ?? {}) as Record<string, unknown>;
      next = {
        ...next,
        props: { ...props, style: { ...style, ...layoutPatch } },
      };
    } else if (mutation.type === "geometry.patch") {
      const geometryStyle = Object.fromEntries(
        Object.entries(mutation.patch)
          .filter(([key]) => isGeometryKey(key))
          .map(([key, value]) => [
            key === "x" ? "left" : key === "y" ? "top" : key,
            value,
          ]),
      );
      if (Object.keys(geometryStyle).length === 0) continue;
      const props = (next.props ?? {}) as Record<string, unknown>;
      const style = (props.style ?? {}) as Record<string, unknown>;
      next = {
        ...next,
        props: { ...props, style: { ...style, ...geometryStyle } },
      };
    }
  }
  return next;
}

/** Layout map merge용 실제 엔진 결과 타입을 고정하는 convenience alias. */
export type PresentationComputedLayout = ComputedLayout;

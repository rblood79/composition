import type { CanvasLayoutNode } from "../workspace/canvas/layout/layoutNode";
import type { ComputedLayout } from "../workspace/canvas/layout/engines/LayoutEngine";
import {
  toEditorPresentationTargetKey,
  type EditorMutationDescriptor,
  type EditorPresentationTargetRef,
} from "./editorPresentationTypes";
import { getEditorMutationEffectRule } from "./invalidation/editorMutationEffectRegistry";

export interface PresentationLayoutTreeIndex {
  readonly childrenByParent: ReadonlyMap<string, readonly string[]>;
  readonly parentById: ReadonlyMap<string, string | null>;
}

export interface PresentationLayoutPlan {
  readonly roots: readonly string[];
  readonly affectedNodeIds: ReadonlySet<string>;
}

export interface PublishPresentationLayoutInput<T> {
  readonly plan: PresentationLayoutPlan;
  readonly previousLayoutMap: ReadonlyMap<string, T>;
  readonly resolveNode: (
    rootId: string,
    affectedNodeIds: ReadonlySet<string>,
  ) => ReadonlyMap<string, T>;
}

export interface PublishedPresentationLayout<T> {
  readonly affectedNodeIds: ReadonlySet<string>;
  readonly layoutMap: ReadonlyMap<string, T>;
  readonly roots: readonly string[];
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

/**
 * semantic target에서 layout root와 affected subtree를 계산한다.
 * `shouldPromoteParent`가 true인 경우에만 used-size 영향으로 parent를 상향한다.
 * 따라서 호출부가 모르는 부모 경계를 전역 문서 순회로 추정하지 않는다.
 */
export function createPresentationLayoutPlan(input: {
  readonly targets: readonly EditorPresentationTargetRef[];
  readonly tree: PresentationLayoutTreeIndex;
  readonly shouldPromoteParent?: (parentId: string, childId: string) => boolean;
}): PresentationLayoutPlan {
  const roots = new Set<string>();
  const promote = input.shouldPromoteParent ?? (() => false);

  for (const target of input.targets) {
    let rootId =
      target.kind === "canonical-node" ? target.nodeId : target.refId;
    let parentId = input.tree.parentById.get(rootId) ?? null;
    const visited = new Set([rootId]);
    while (parentId && promote(parentId, rootId)) {
      if (visited.has(parentId)) break;
      visited.add(parentId);
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
    roots: Object.freeze([...roots]),
    affectedNodeIds,
  });
}

/**
 * targeted resolver가 반환한 map만 기존 map에 병합한다.
 * affected subtree 밖의 값과 object identity는 그대로 유지된다.
 */
export function publishPresentationLayout<T>(
  input: PublishPresentationLayoutInput<T>,
): PublishedPresentationLayout<T> {
  const layoutMap = new Map(input.previousLayoutMap);
  for (const rootId of input.plan.roots) {
    const resolved = input.resolveNode(rootId, input.plan.affectedNodeIds);
    for (const [nodeId, layout] of resolved) {
      if (input.plan.affectedNodeIds.has(nodeId)) {
        layoutMap.set(nodeId, layout);
      }
    }
  }
  return Object.freeze({
    affectedNodeIds: input.plan.affectedNodeIds,
    layoutMap,
    roots: input.plan.roots,
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

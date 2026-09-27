import type { ResolvedNode } from "@composition/shared";

import {
  toEditorPresentationTargetKey,
  type EditorPresentationTargetRef,
} from "../../builder/presentation/editorPresentationTypes";
import type { EditorMutationPropagation } from "../../builder/presentation/editorPresentationTypes";

export interface PreviewPresentationProjectionIndex {
  readonly revision: number;
  resolve(
    target: EditorPresentationTargetRef,
    propagation?: EditorMutationPropagation,
  ): readonly string[];
}

const EMPTY_RENDER_KEYS: readonly string[] = Object.freeze([]);

export function buildPreviewPresentationProjectionIndex(
  roots: readonly ResolvedNode[],
  revision = 0,
): PreviewPresentationProjectionIndex {
  const renderKeysByTarget = new Map<string, Set<string>>();
  const inheritedRenderKeysByTarget = new Map<string, Set<string>>();
  const add = (
    target: EditorPresentationTargetRef,
    renderKey: string,
  ): void => {
    const targetKey = toEditorPresentationTargetKey(target);
    const renderKeys = renderKeysByTarget.get(targetKey);
    if (renderKeys) {
      renderKeys.add(renderKey);
    } else {
      renderKeysByTarget.set(targetKey, new Set([renderKey]));
    }
  };
  const addInherited = (
    target: EditorPresentationTargetRef,
    renderKey: string,
  ): void => {
    const targetKey = toEditorPresentationTargetKey(target);
    const renderKeys = inheritedRenderKeysByTarget.get(targetKey);
    if (renderKeys) renderKeys.add(renderKey);
    else inheritedRenderKeysByTarget.set(targetKey, new Set([renderKey]));
  };
  const hasOwnColor = (node: ResolvedNode): boolean => {
    const style = node.props?.style;
    return (
      style !== null &&
      typeof style === "object" &&
      !Array.isArray(style) &&
      Object.prototype.hasOwnProperty.call(style, "color")
    );
  };
  type RefContext = { readonly refId: string; readonly pathKey: string };
  const visit = (
    node: ResolvedNode,
    parentPath: string,
    refContexts: readonly RefContext[] = [],
    inheritedColorRoots: readonly string[] = [],
  ): void => {
    const renderKey = parentPath ? `${parentPath}/${node.id}` : node.id;
    add({ kind: "canonical-node", nodeId: node.id }, renderKey);
    if (node._resolvedFrom) {
      add({ kind: "canonical-node", nodeId: node._resolvedFrom }, renderKey);
    }

    const ownColor = hasOwnColor(node);
    if (ownColor) {
      addInherited({ kind: "canonical-node", nodeId: node.id }, renderKey);
      if (node._resolvedFrom) {
        addInherited(
          { kind: "canonical-node", nodeId: node._resolvedFrom },
          renderKey,
        );
      }
    } else {
      for (const rootId of inheritedColorRoots) {
        addInherited({ kind: "canonical-node", nodeId: rootId }, renderKey);
      }
    }

    // ref instance 아래 자손은 모든 조상 instance 기준 경로로 등록한다 — 편집기 synthetic id 는 가장 바깥
    //   instance 기준 (`<instance>/<중첩 ref>/<자식>`) 이고, 중첩 ref 자체를 편집할 때는 그 ref 기준이다.
    //   segment 는 해석기가 원본 형제 목록으로 센 `_pathSegment` 만 읽는다 — 해석 노드로 다시 세면 master name ·
    //   걸러진 목록 · instance 자식 합침 때문에 편집기 키와 어긋난다 (ADR-150 후속 MEDIUM-3).
    const nextRefContexts: readonly RefContext[] = node._resolvedFrom
      ? [...refContexts, { refId: node.id, pathKey: "" }]
      : refContexts;
    for (const child of node.children ?? []) {
      const segment = child._pathSegment;
      // instance 자기 자식은 소유 instance 문맥에 넣지 않는다 — 편집기에서 실제 노드 (최상위) 이거나 바깥 instance
      //   기준 경로 (중첩 ref) 다. 같은 segment origin 자식과 키가 겹친다 (MEDIUM-3 판독 1).
      const contexts =
        child._instanceOwnChild && node._resolvedFrom
          ? refContexts
          : nextRefContexts;
      const childRefContexts: readonly RefContext[] =
        segment === undefined
          ? []
          : contexts.map((context) => ({
              refId: context.refId,
              pathKey: context.pathKey
                ? `${context.pathKey}/${segment}`
                : segment,
            }));
      const childRenderKey = `${renderKey}/${child.id}`;
      for (const context of childRefContexts) {
        add(
          {
            kind: "ref-descendant",
            refId: context.refId,
            pathKey: context.pathKey,
          },
          childRenderKey,
        );
      }
      visit(
        child,
        renderKey,
        childRefContexts,
        ownColor
          ? [node.id, ...(node._resolvedFrom ? [node._resolvedFrom] : [])]
          : inheritedColorRoots,
      );
    }
  };

  for (const root of roots) visit(root, "");
  const frozen = new Map<string, readonly string[]>();
  for (const [targetKey, renderKeys] of renderKeysByTarget) {
    frozen.set(targetKey, Object.freeze([...renderKeys]));
  }
  const inheritedFrozen = new Map<string, readonly string[]>();
  for (const [targetKey, renderKeys] of inheritedRenderKeysByTarget) {
    inheritedFrozen.set(targetKey, Object.freeze([...renderKeys]));
  }
  return Object.freeze({
    revision,
    resolve: (
      target: EditorPresentationTargetRef,
      propagation: EditorMutationPropagation = "self",
    ) =>
      (propagation === "inherited-subtree" ? inheritedFrozen : frozen).get(
        toEditorPresentationTargetKey(target),
      ) ?? EMPTY_RENDER_KEYS,
  });
}

export const EMPTY_PREVIEW_PRESENTATION_PROJECTION_INDEX: PreviewPresentationProjectionIndex =
  Object.freeze({ revision: -1, resolve: () => EMPTY_RENDER_KEYS });

import type { ResolvedNode } from "@composition/shared";
import { getCanonicalRefPathSegment } from "../../adapters/canonical/canonicalRefResolution";

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
  const visit = (
    node: ResolvedNode,
    parentPath: string,
    refContext?: { readonly refId: string; readonly pathKey: string },
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

    const nextRefContext = node._resolvedFrom
      ? { refId: node.id, pathKey: "" }
      : refContext;
    for (const child of node.children ?? []) {
      const segment = getCanonicalRefPathSegment(child);
      const childRefContext = nextRefContext
        ? {
            refId: nextRefContext.refId,
            pathKey: nextRefContext.pathKey
              ? `${nextRefContext.pathKey}/${segment}`
              : segment,
          }
        : undefined;
      const childRenderKey = `${renderKey}/${child.id}`;
      if (childRefContext) {
        add(
          {
            kind: "ref-descendant",
            refId: childRefContext.refId,
            pathKey: childRefContext.pathKey,
          },
          childRenderKey,
        );
      }
      visit(
        child,
        renderKey,
        childRefContext,
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

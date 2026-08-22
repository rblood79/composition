import type { ResolvedNode } from "@composition/shared";
import { getCanonicalRefPathSegment } from "../../adapters/canonical/canonicalRefResolution";

import {
  toEditorPresentationTargetKey,
  type EditorPresentationTargetRef,
} from "../../builder/presentation/editorPresentationTypes";

export interface PreviewPresentationProjectionIndex {
  readonly revision: number;
  resolve(target: EditorPresentationTargetRef): readonly string[];
}

const EMPTY_RENDER_KEYS: readonly string[] = Object.freeze([]);

export function buildPreviewPresentationProjectionIndex(
  roots: readonly ResolvedNode[],
  revision = 0,
): PreviewPresentationProjectionIndex {
  const renderKeysByTarget = new Map<string, Set<string>>();
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
  const visit = (
    node: ResolvedNode,
    parentPath: string,
    refContext?: { readonly refId: string; readonly pathKey: string },
  ): void => {
    const renderKey = parentPath ? `${parentPath}/${node.id}` : node.id;
    add({ kind: "canonical-node", nodeId: node.id }, renderKey);
    if (node._resolvedFrom) {
      add({ kind: "canonical-node", nodeId: node._resolvedFrom }, renderKey);
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
      visit(child, renderKey, childRefContext);
    }
  };

  for (const root of roots) visit(root, "");
  const frozen = new Map<string, readonly string[]>();
  for (const [targetKey, renderKeys] of renderKeysByTarget) {
    frozen.set(targetKey, Object.freeze([...renderKeys]));
  }
  return Object.freeze({
    revision,
    resolve: (target: EditorPresentationTargetRef) =>
      frozen.get(toEditorPresentationTargetKey(target)) ?? EMPTY_RENDER_KEYS,
  });
}

export const EMPTY_PREVIEW_PRESENTATION_PROJECTION_INDEX: PreviewPresentationProjectionIndex =
  Object.freeze({ revision: -1, resolve: () => EMPTY_RENDER_KEYS });

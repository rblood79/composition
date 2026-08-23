import type {
  EditorMutationPropagation,
  EditorPresentationTargetRef,
} from "./editorPresentationTypes";
import { toEditorPresentationTargetKey } from "./editorPresentationTypes";

export interface SkiaPresentationProjectionIndex {
  resolve(
    target: EditorPresentationTargetRef,
    propagation?: EditorMutationPropagation,
  ): readonly string[];
}

const EMPTY_RENDER_IDS: readonly string[] = Object.freeze([]);

export class SkiaPresentationProjectionIndexBuilder {
  readonly #renderIdsByCanonicalNodeId = new Map<string, Set<string>>();
  readonly #renderIdsByInheritedCanonicalNodeId = new Map<
    string,
    Set<string>
  >();
  readonly #renderIdsByRefDescendant = new Map<string, Set<string>>();

  addCanonicalProjection(nodeId: string, renderId: string): void {
    if (!nodeId || !renderId) return;
    const ids = this.#renderIdsByCanonicalNodeId.get(nodeId);
    if (ids) {
      ids.add(renderId);
      return;
    }
    this.#renderIdsByCanonicalNodeId.set(nodeId, new Set([renderId]));
  }

  /** Register descendants proven to inherit the selected root's color. */
  addInheritedCanonicalProjection(nodeId: string, renderId: string): void {
    if (!nodeId || !renderId) return;
    const ids = this.#renderIdsByInheritedCanonicalNodeId.get(nodeId);
    if (ids) {
      ids.add(renderId);
      return;
    }
    this.#renderIdsByInheritedCanonicalNodeId.set(nodeId, new Set([renderId]));
  }

  addRefDescendantProjection(
    refId: string,
    pathKey: string,
    renderId: string,
  ): void {
    if (!refId || !pathKey || !renderId) return;
    const targetKey = toEditorPresentationTargetKey({
      kind: "ref-descendant",
      pathKey,
      refId,
    });
    const ids = this.#renderIdsByRefDescendant.get(targetKey);
    if (ids) ids.add(renderId);
    else this.#renderIdsByRefDescendant.set(targetKey, new Set([renderId]));
  }

  build(): SkiaPresentationProjectionIndex {
    const frozen = new Map<string, readonly string[]>();
    for (const [nodeId, ids] of this.#renderIdsByCanonicalNodeId) {
      frozen.set(nodeId, Object.freeze([...ids]));
    }
    const inherited = new Map<string, readonly string[]>();
    for (const [nodeId, ids] of this.#renderIdsByInheritedCanonicalNodeId) {
      inherited.set(nodeId, Object.freeze([...ids]));
    }
    for (const [targetKey, ids] of this.#renderIdsByRefDescendant) {
      frozen.set(targetKey, Object.freeze([...ids]));
    }
    return Object.freeze({
      resolve: (
        target: EditorPresentationTargetRef,
        propagation: EditorMutationPropagation = "self",
      ): readonly string[] => {
        const targetKey =
          target.kind === "canonical-node"
            ? target.nodeId
            : toEditorPresentationTargetKey(target);
        return propagation === "inherited-subtree"
          ? (inherited.get(targetKey) ?? EMPTY_RENDER_IDS)
          : (frozen.get(targetKey) ?? EMPTY_RENDER_IDS);
      },
    });
  }
}

export const EMPTY_SKIA_PRESENTATION_PROJECTION_INDEX: SkiaPresentationProjectionIndex =
  Object.freeze({ resolve: () => EMPTY_RENDER_IDS });

import type { EditorPresentationTargetRef } from "./editorPresentationTypes";

export interface SkiaPresentationProjectionIndex {
  resolve(target: EditorPresentationTargetRef): readonly string[];
}

const EMPTY_RENDER_IDS: readonly string[] = Object.freeze([]);

export class SkiaPresentationProjectionIndexBuilder {
  readonly #renderIdsByCanonicalNodeId = new Map<string, Set<string>>();

  addCanonicalProjection(nodeId: string, renderId: string): void {
    if (!nodeId || !renderId) return;
    const ids = this.#renderIdsByCanonicalNodeId.get(nodeId);
    if (ids) {
      ids.add(renderId);
      return;
    }
    this.#renderIdsByCanonicalNodeId.set(nodeId, new Set([renderId]));
  }

  build(): SkiaPresentationProjectionIndex {
    const frozen = new Map<string, readonly string[]>();
    for (const [nodeId, ids] of this.#renderIdsByCanonicalNodeId) {
      frozen.set(nodeId, Object.freeze([...ids]));
    }
    return Object.freeze({
      resolve: (target: EditorPresentationTargetRef): readonly string[] => {
        // ref-descendant projection/commit은 ADR-187 Phase 3에서 활성화한다.
        if (target.kind !== "canonical-node") return EMPTY_RENDER_IDS;
        return frozen.get(target.nodeId) ?? EMPTY_RENDER_IDS;
      },
    });
  }
}

export const EMPTY_SKIA_PRESENTATION_PROJECTION_INDEX: SkiaPresentationProjectionIndex =
  Object.freeze({ resolve: () => EMPTY_RENDER_IDS });

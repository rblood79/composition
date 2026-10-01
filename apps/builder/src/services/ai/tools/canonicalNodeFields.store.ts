/**
 * ADR-248 Phase 4e-7: the old canonical document's first-class fields (ADR-134) — applied and read
 * for the old store AI host (`aiHosts.store.ts`). It goes with the old store.
 */
import type { CanonicalNode } from "@composition/shared";
import { useCanonicalDocumentStore } from "../../../builder/stores/canonical/canonicalDocumentStore";
import { getNodeMap } from "../../../builder/stores/canonical/canonicalTraversalHelpers";
import { useStore } from "../../../builder/stores";
import type { CanonicalFieldPatch } from "./canonicalNodeFields";

export type { CanonicalFieldPatch };

/**
 * patch 를 canonical document 에 적용. 빈 patch 면 아무 것도 하지 않는다.
 *
 * `reusable` 변경은 문서에 직접 쓰지 않고 store `toggleComponentOrigin` 을 지난다 (ADR-236 Phase 3,
 * E2) — 직접 쓰면 systemOwned 가드 · 영향 확인 · instance 분리를 모두 건너뛰어, AI 가 system
 * origin 을 `reusable:false` 로 만들면 instance 가 원본을 잃었다. 거부되면 `reusable` 은 반영되지
 * 않고 호출자의 반영 확인이 잡는다.
 */
export async function applyCanonicalFields(
  nodeId: string,
  patch: CanonicalFieldPatch,
): Promise<boolean> {
  const { reusable, ...rest } = patch;
  let applied = false;
  if (Object.keys(rest).length > 0) {
    useCanonicalDocumentStore
      .getState()
      .updateNode(nodeId, rest as Partial<CanonicalNode>);
    applied = true;
  }
  if (reusable !== undefined) {
    const current = getNodeMap().get(nodeId) as
      { reusable?: boolean } | undefined;
    if ((current?.reusable === true) !== reusable) {
      const result = await useStore.getState().toggleComponentOrigin(nodeId);
      if (result) applied = true;
    } else {
      applied = true;
    }
  }
  return applied;
}

/** 노드의 현재 canonical 1차 필드 — 도구 응답에 싣는 읽기 표면. */
export function readStoreCanonicalFields(
  nodeId: string,
): CanonicalFieldPatch | undefined {
  const node = getNodeMap().get(nodeId) as
    (CanonicalNode & CanonicalFieldPatch) | undefined;
  if (!node) return undefined;

  const fields: CanonicalFieldPatch = {};
  if (node.type === "frame") {
    if (typeof node.clip === "boolean") fields.clip = node.clip;
    if (typeof node.placeholder === "boolean") {
      fields.placeholder = node.placeholder;
    }
  }
  if (node.slot !== undefined) fields.slot = node.slot;
  if (typeof node.reusable === "boolean") fields.reusable = node.reusable;

  return Object.keys(fields).length > 0 ? fields : undefined;
}

import { useStore } from "../../../stores";
import type { FillItem } from "../../../../types/builder/fill.types";
import { getActiveCanonicalDocument } from "../../../stores/canonical/canonicalElementsBridge";
import { getNodeMap } from "../../../stores/canonical/canonicalTraversalHelpers";
import {
  getSyntheticDescendantLookup,
  isSyntheticDescendantId,
} from "../../../stores/canonical/syntheticDescendantLookup";
import { readCanonicalNodeFillPayload } from "../../../../adapters/canonical/canonicalFillPayload";
import {
  resolveElementFills,
  type FillReadSource,
} from "../utils/fillMigration";

/**
 * fills 배열의 현재 값을 가져오는 헬퍼.
 *
 * 표시(useFillValues → useElementStyleContext → canonical 파생)와 **동일 소스**:
 * canonical 문서 우선, canonical 미가동(legacy 프로젝트)일 때만 elementsMap.
 * 과거 legacy elementsMap 단독 읽기는 canonical 파생과 어긋나는 순간
 * (표시 0건 ↔ 액션 실값) 소스 분열로 드래그마다 addFill 중복 누적을 만들었다
 * (2026-07-15 fills 파이프라인 복원).
 */
export function readStoreSelectedFills(): FillItem[] {
  const state = useStore.getState();
  const { selectedElementId, elementsMap } = state;
  if (!selectedElementId) return [];

  const doc = getActiveCanonicalDocument();
  if (doc) {
    // instance 안 자식 (synthetic) 은 canonical 맵에 없다 — 표시 (readStyleTargetNode) 와 같은 해석 노드.
    const node =
      getNodeMap().get(selectedElementId) ??
      getSyntheticDescendantLookup(selectedElementId)?.node;
    const source: FillReadSource | undefined = node
      ? {
          fills: readCanonicalNodeFillPayload(node) as FillItem[] | undefined,
          props: node.props as FillReadSource["props"],
        }
      : undefined;
    return resolveElementFills(source);
  }
  return resolveElementFills(elementsMap.get(selectedElementId));
}

/**
 * Fill reset of the old store: the selected element's own fills go. An instance's synthetic
 * child clears its patch (`null` — the origin's fills show again); an empty list is not written.
 */
export function resetStoreSelectedFills(): void {
  const state = useStore.getState();
  const selectedId = state.selectedElementId;
  const el = selectedId
    ? (state.elementsMap.get(selectedId) ??
      getSyntheticDescendantLookup(selectedId)?.node)
    : undefined;
  const currentFills = (el as { fills?: unknown[] } | undefined)?.fills;
  if (Array.isArray(currentFills) && currentFills.length > 0)
    state.updateSelectedFills(
      selectedId && isSyntheticDescendantId(selectedId) ? null : [],
    );
}

/**
 * Render-space projection id 식별 — canonical document id 공간과 분리(ADR-135/136 §9).
 *
 * **단일 불변식 (ADR-912 단계 4)**: 모든 render-space projection id 는
 *   (1) `projection:` prefix 로 시작하거나(collection row/cell/group 류), 또는
 *   (2) ADR-135 page-frame 의 `::page-frame::` infix 를 포함한다.
 * `isRenderProjectionId` 는 이 두 형태만 인식 → collection family 가 늘어나도
 * 새 `projection:<namespace>:` 를 emit 하기만 하면 boundary guard
 * (`assertCanonicalMoveTarget`)/canonical mutation 차단이 자동 적용된다(추가 등록 0).
 *
 * **boundary 계약**: projected id 는 canonical document / IndexedDB / history payload 에
 * 절대 저장 금지(canonical-rendering.md §9). 변환 함수(`resolveCollectionWriteTarget`)의
 * 입력으로만 쓰고, 출력에는 canonical id 만 둔다.
 */

/** 모든 render-space projection id 의 공통 prefix (단일 namespace root). */
export const RENDER_PROJECTION_PREFIX = "projection:";

/** ADR-135 page-frame projection 의 infix (prefix 가 아닌 중간 토큰). */
export const PAGE_FRAME_PROJECTION_INFIX = "::page-frame::";

/** collection row projection namespace (한 행 = template subtree 1벌 전개의 root). */
export const LISTBOX_ROW_PROJECTION_PREFIX = "projection:listbox-row:";
/** collection rows-group projection namespace (행 컨테이너). */
export const LISTBOX_ROWS_GROUP_PROJECTION_PREFIX = "projection:listbox-rows:";

export function toListBoxRowProjectionId(
  listBoxId: string,
  itemKey: string,
): string {
  return `${LISTBOX_ROW_PROJECTION_PREFIX}${listBoxId}:${itemKey}`;
}

export function toListBoxRowsGroupProjectionId(listBoxId: string): string {
  return `${LISTBOX_ROWS_GROUP_PROJECTION_PREFIX}${listBoxId}`;
}

/**
 * id 가 render-space projection id 인가.
 *
 * collection namespace(`projection:listbox-row:` 등)는 모두 `projection:` prefix 의
 * 하위이므로 **prefix 1개 + page-frame infix 1개** 판정으로 전 family 를 cover 한다.
 * 신규 collection(Table/GridList/Menu/...) 도 `projection:<ns>:` 형태면 자동 인식.
 */
export function isRenderProjectionId(id: string | null | undefined): boolean {
  return (
    typeof id === "string" &&
    (id.startsWith(RENDER_PROJECTION_PREFIX) ||
      id.includes(PAGE_FRAME_PROJECTION_INFIX))
  );
}

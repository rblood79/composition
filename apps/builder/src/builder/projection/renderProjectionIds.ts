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

/**
 * collection projection id 의 generic 생성기 (ADR-912 단계 4 C1).
 *
 * family namespace 는 prefix(`projection:<family>-row:`)에만 둔다 — metadata kind 는 단일
 * generic(`collection-row`/`collection-rows`)이라 downstream switch 가 family 수만큼 늘지
 * 않는다(no-classification). family 차이는 projectionId 문자열에만 반영.
 */
export function toCollectionRowProjectionId(
  family: string,
  ownerId: string,
  itemKey: string,
): string {
  return `${RENDER_PROJECTION_PREFIX}${family}-row:${ownerId}:${itemKey}`;
}

export function toCollectionRowsGroupProjectionId(
  family: string,
  ownerId: string,
): string {
  return `${RENDER_PROJECTION_PREFIX}${family}-rows:${ownerId}`;
}

/** collection row projection namespace (한 행 = template subtree 1벌 전개의 root). */
export const LISTBOX_ROW_PROJECTION_PREFIX = "projection:listbox-row:";
/** collection rows-group projection namespace (행 컨테이너). */
export const LISTBOX_ROWS_GROUP_PROJECTION_PREFIX = "projection:listbox-rows:";

export function toListBoxRowProjectionId(
  listBoxId: string,
  itemKey: string,
): string {
  return toCollectionRowProjectionId("listbox", listBoxId, itemKey);
}

export function toListBoxRowsGroupProjectionId(listBoxId: string): string {
  return toCollectionRowsGroupProjectionId("listbox", listBoxId);
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

/**
 * collection **row** projection kind 판정 (단일 진입점, ADR-912 단계 4 C1).
 *
 * listbox/gridlist 등 family 가 늘어도 downstream(write-target/interaction)은 본 helper 1곳만
 * 갱신하면 같은 handler 로 처리된다(본문 복제 0 — no-classification). family 차이는 projectionId
 * prefix + node.type 에 있고, metadata 변환 로직은 동형(listBoxId/itemKey/templateOriginId).
 */
export function isCollectionRowProjectionKind(
  kind: string | undefined | null,
): boolean {
  return kind === "listbox-row" || kind === "gridlist-row";
}

/** collection **rows-group**(행 컨테이너) projection kind 판정. */
export function isCollectionRowsGroupProjectionKind(
  kind: string | undefined | null,
): boolean {
  return kind === "listbox-rows" || kind === "gridlist-rows";
}

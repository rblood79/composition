/**
 * ADR-232 — 페이지 정렬 (align).
 *
 * 좌표 재계산이 아니라 **배치를 지우는 것** 이다. Home 을 제외한 모든 페이지의 placement 를
 * 삭제하면 컨테이너 레이아웃이 전부 흐름으로 되돌린다 (계산 0 · 쓰기 1 · Cmd+Z 1회).
 *
 * 종전 구현 (ADR-177) 은 breakpoint 크기와 Settings 방향으로 전 페이지 좌표를 다시 계산해
 * 문서에 batch 기록했다. 좌표가 문서 데이터가 아니게 되면서 그 계층 전체가 없어졌다.
 */

import { commitPagePlacementAlign } from "../../../stores/utils/pagePlacementCommit";

export function alignPagesToScreen(): void {
  commitPagePlacementAlign();
}

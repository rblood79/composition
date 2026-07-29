/**
 * 렌더 커버리지 기준면 — ADR-173 Phase 1
 *
 * content surface 는 뷰포트보다 이만큼 크게 그려두고, 그 안쪽 이동은
 * 스냅샷 blit 으로 때운다 (`SkiaRenderer.canBlitWithCameraTransform`).
 * 그런데 **거기에 무엇을 그릴지**를 정하는 것은 가시 페이지 집합이므로
 * (`buildVisiblePageSet`), 두 반경이 다르면 그 차이만큼은 페이지가 있어도
 * 빈 채로 래스터되어 blit 이 공백을 실어 나른다.
 *
 * 그래서 "그릴 수 있는 영역"과 "그린 영역"은 같은 상수에서 나온다.
 * 계약 고정: `scene/buildVisiblePageSet.test.ts`.
 */
export const CONTENT_COVERAGE_PADDING_CSS_PX = 512;

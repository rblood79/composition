/** ADR-248 Phase 4e-7: apart from the old overlay helpers (`skiaOverlayHelpers.ts` re-exports it). */

/**
 * 지금 화면에 보이는 영역의 scene rect.
 *
 * 미니맵의 뷰포트 사각형과 가이드 드래그 미리보기 선(ADR-181)이 같은 값을
 * 쓴다 — "보이는 범위" 라는 한 개념이라 두 벌로 두지 않는다.
 */
export function buildViewportSceneRect(
  cameraX: number,
  cameraY: number,
  cameraZoom: number,
  screenWidth: number,
  screenHeight: number,
) {
  return {
    x: -cameraX / cameraZoom,
    y: -cameraY / cameraZoom,
    width: screenWidth / cameraZoom,
    height: screenHeight / cameraZoom,
  };
}

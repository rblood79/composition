import {
  viewportToScreenPoint,
  viewportToScreenSize,
} from "../viewport/viewportTransforms";
import { CONTENT_COVERAGE_PADDING_CSS_PX } from "./renderCoverage";
import type { ScenePageFrame } from "./sceneSnapshotTypes";

/**
 * ADR-173 Phase 1 — 컬링 반경은 content surface 패딩과 **같은 값**이다.
 *
 * 구 값 200 은 패딩(512)보다 좁아, 그 차이인 312px 띠는 페이지가 있어도 빈
 * 채로 래스터됐다. 여기를 독립 리터럴로 되돌리지 말 것 (`renderCoverage.ts`).
 */
const DEFAULT_MARGIN = CONTENT_COVERAGE_PADDING_CSS_PX;

interface BuildVisiblePageSetInput {
  containerSize?: { height: number; width: number };
  margin?: number;
  pageFrames: ScenePageFrame[];
  panOffset: { x: number; y: number };
  zoom: number;
}

export function buildVisiblePageSet({
  containerSize,
  margin = DEFAULT_MARGIN,
  pageFrames,
  panOffset,
  zoom,
}: BuildVisiblePageSetInput): Set<string> {
  const screenWidth = containerSize?.width ?? 1920;
  const screenHeight = containerSize?.height ?? 1080;
  const visible = new Set<string>();

  for (const frame of pageFrames) {
    const screenPosition = viewportToScreenPoint(
      { x: frame.x, y: frame.y },
      zoom,
      panOffset,
    );
    const screenSize = viewportToScreenSize(
      { width: frame.width, height: frame.height },
      zoom,
    );
    const isInViewport = !(
      screenPosition.x + screenSize.width < -margin ||
      screenPosition.x > screenWidth + margin ||
      screenPosition.y + screenSize.height < -margin ||
      screenPosition.y > screenHeight + margin
    );

    if (isInViewport) {
      visible.add(frame.id);
    }
  }

  return visible;
}

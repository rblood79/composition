import {
  viewportToScreenPoint,
  viewportToScreenSize,
} from "../viewport/viewportTransforms";
import type { ScenePageFrame } from "./sceneSnapshotTypes";

const DEFAULT_MARGIN = 200;

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

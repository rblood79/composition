/**
 * 스냅 정렬선 렌더러 (ADR-179 Phase 2)
 *
 * 드래그 중 흡착 순간의 정렬선을 scene 좌표에 1 screen px 선으로 그린다.
 * 조작 표식(드래그 순간 피드백)이라 `withPageOcclusionClip` 미적용 —
 * §8.5 선택 박스 열 분류 (breakdown §3.3 판정). 색은 builder 시맨틱
 * `--accent` (무채색 — 명도 대비, css-tokens.md §builder accent).
 */

import type { CanvasKit, Canvas } from "canvaskit-wasm";
import type { SnapGuide } from "../interaction/snapGuides";
import { acquirePooledPaint, releasePooledPaint } from "./paints";
import { cssColorToHex, getCSSVariable } from "../utils/cssVariableReader";
import { hexToColor4fChannels } from "./themeWatcher";

/** --accent 미해석 시 폴백 — builder light accent (gray-700) */
const ACCENT_FALLBACK_HEX = 0x374151;

export function renderSnapGuides(
  ck: CanvasKit,
  canvas: Canvas,
  guides: readonly SnapGuide[],
  zoom: number,
): void {
  if (guides.length === 0) {
    return;
  }

  const [r, g, b] = hexToColor4fChannels(
    cssColorToHex(getCSSVariable("--accent"), ACCENT_FALLBACK_HEX),
  );
  const paint = acquirePooledPaint(ck);
  paint.setColor(ck.Color4f(r, g, b, 0.9));
  paint.setAntiAlias(true);
  paint.setStyle(ck.PaintStyle.Stroke);
  paint.setStrokeWidth(1 / (zoom === 0 ? 1 : zoom));
  for (const guide of guides) {
    if (guide.axis === "x") {
      canvas.drawLine(
        guide.position,
        guide.start,
        guide.position,
        guide.end,
        paint,
      );
    } else {
      canvas.drawLine(
        guide.start,
        guide.position,
        guide.end,
        guide.position,
        paint,
      );
    }
  }
  releasePooledPaint(paint);
}

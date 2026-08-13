/**
 * 수동 가이드 렌더러 — ADR-181 Phase 4
 *
 * 사용자가 눈금자에서 끌어낸 **상시 표시** 기준선. 스냅 정렬선
 * (`snapGuideRenderer.ts`) 과 같은 1 screen px 선이지만 성격이 다르다:
 *
 * | 축                | 스냅 정렬선           | 수동 가이드                        |
 * | ----------------- | --------------------- | ---------------------------------- |
 * | 수명              | 드래그 중 순간 피드백 | 문서 데이터 (persist + undo)       |
 * | §8.5 분류         | 조작 표식             | **콘텐츠성 chrome**                |
 * | occlusion / 클립  | 미적용                | `withPageOcclusionClip` + 페이지 rect |
 *
 * 그래서 색도 갈라야 한다. 스냅 웜 레드(#F24822)를 재사용하면 "지금 흡착
 * 중" 과 "여기 기준선이 있다" 가 같은 신호로 읽힌다. 시안 계열
 * (#59A8D7 — Figma 가이드 실측 계열, Photoshop/Illustrator 의 지속 가이드
 * 관례와도 같은 방향) 로 두면 스냅 레드와 선택 파랑(#3B82F6) 양쪽에서
 * 떨어진다. 선택 파랑과는 색상만이 아니라 **형태**로도 갈린다 — 가이드는
 * 페이지를 가로지르는 가는 선이고 핸들이 없다.
 *
 * 좌표는 scene 이다. 가이드 position 은 페이지-로컬 px 이므로 페이지 위치를
 * 더해 변환하며(빌더 `buildPageGuideTargets`), 그 덕에 페이지를 옮기면
 * (ADR-177) 가이드가 따라온다.
 */

import type { CanvasKit, Canvas } from "canvaskit-wasm";

import { acquirePooledPaint, releasePooledPaint } from "./paints";
import { hexToColor4fChannels } from "./themeWatcher";
import type { PageGuideRenderTarget } from "./skiaOverlayHelpers";

/** 수동 가이드 시안 (#59A8D7 — 스냅 레드/선택 파랑과 분리, 양 테마 공용) */
const PAGE_GUIDE_HEX = 0x59a8d7;
const PAGE_GUIDE_ALPHA = 0.9;

/**
 * 한 페이지의 가이드 전부를 그린다.
 *
 * 클립은 페이지 rect **1회** — 가이드마다 save/restore 하면 선 개수만큼
 * 상태 전환이 늘어난다. 클립이 필요한 이유는 선 길이가 페이지 rect 와 같아
 * 보이지만 실제로는 stroke 가 양쪽으로 반폭씩 번지고, breakpoint 크기를
 * 줄인 뒤 남은 가이드가 페이지 밖 좌표를 가질 수 있기 때문이다.
 */
export function renderPageGuides(
  ck: CanvasKit,
  canvas: Canvas,
  target: PageGuideRenderTarget,
  zoom: number,
): void {
  if (target.lines.length === 0) {
    return;
  }

  const invZoom = 1 / (zoom === 0 ? 1 : zoom);
  const [r, g, b] = hexToColor4fChannels(PAGE_GUIDE_HEX);
  const paint = acquirePooledPaint(ck);
  paint.setColor(ck.Color4f(r, g, b, PAGE_GUIDE_ALPHA));
  paint.setAntiAlias(true);
  paint.setStyle(ck.PaintStyle.Stroke);
  paint.setStrokeWidth(invZoom);

  const { x, y, width, height } = target.pageRect;
  canvas.save();
  canvas.clipRect(ck.XYWHRect(x, y, width, height), ck.ClipOp.Intersect, true);
  try {
    for (const line of target.lines) {
      // axis "x" = x 좌표를 고정하는 **세로선** (snapGuides 와 같은 어법)
      if (line.axis === "x") {
        canvas.drawLine(line.position, y, line.position, y + height, paint);
      } else {
        canvas.drawLine(x, line.position, x + width, line.position, paint);
      }
    }
  } finally {
    canvas.restore();
    releasePooledPaint(paint);
  }
}

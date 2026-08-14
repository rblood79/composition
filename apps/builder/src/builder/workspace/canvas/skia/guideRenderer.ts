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
 * **색은 스냅 정렬선과 같은 웜 레드**(#F24822)다. 도입 때는 "동시에 보이면
 * 구분이 안 된다" 는 이유로 시안(#59A8D7)으로 갈랐는데, Figma 는 가이드와
 * 스냅 표식에 같은 빨강을 쓰고 그 대비를 받아들인다 — 사용자 요청으로
 * Figma 정합을 택했다 (2026-08-14). 둘의 구분은 색이 아니라 **수명**이
 * 진다: 스냅 정렬선은 드래그 중에만 잠깐 서고 가이드는 계속 남아 있다.
 *
 * 선택 파랑(#3B82F6)과는 색상만이 아니라 **형태**로도 갈린다 — 가이드는
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

/** 수동 가이드 웜 레드 (#F24822 — Figma 가이드 실측값, 스냅 표식과 공용) */
const PAGE_GUIDE_HEX = 0xf24822;
/**
 * 기본(비선택) — 계속 떠 있는 선이라 콘텐츠를 덮지 않을 만큼만 선명하게.
 * 선택(1.0)과의 간격이 상태 차이를 만든다.
 */
const PAGE_GUIDE_ALPHA = 0.7;
/** 선택 — 완전 불투명. 연장선(점선)도 같은 값이라 한 선으로 읽힌다 */
const PAGE_GUIDE_SELECTED_ALPHA = 1;
/** 소속 미정 미리보기 — 같은 색·같은 두께, 알파만 낮춰 "아직 잠정" 을 표현 */
const PAGE_GUIDE_PREVIEW_ALPHA = 0.45;

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
  selectedGuideId?: string | null,
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
      // 선택된 선만 불투명하게 — 페이지 밖 연장선과 같은 알파라 경계에서
      // 실선↔점선만 갈리고 색은 이어진다
      paint.setColor(
        ck.Color4f(
          r,
          g,
          b,
          line.id === selectedGuideId
            ? PAGE_GUIDE_SELECTED_ALPHA
            : PAGE_GUIDE_ALPHA,
        ),
      );
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

/**
 * 드래그 중 **소속 미정** 미리보기 — 뷰포트를 가로지르는 선 1개.
 *
 * 확정 가이드와 성격이 갈린다. 이건 순간 피드백이라 §8.5 의 **조작 표식**
 * 열이고, 그래서 `withPageOcclusionClip` 도 페이지 rect 클립도 걸지 않는다
 * (스냅 정렬선과 같은 취급). 소속 페이지가 없으니 클립할 rect 자체가 없다.
 *
 * 소속이 정해지면 이 함수는 호출되지 않는다 — `resolveGuideDragPreview` 가
 * null 을 주고, 대신 `renderPageGuides` 가 그 페이지에 클립된 선을 그린다.
 * 선이 잘리기 시작하는 순간이 곧 "여기 놓으면 붙는다" 는 신호다.
 */
export function renderGuideDragPreview(
  ck: CanvasKit,
  canvas: Canvas,
  preview: { axis: "x" | "y"; scenePosition: number },
  viewport: { x: number; y: number; width: number; height: number },
  zoom: number,
): void {
  const invZoom = 1 / (zoom === 0 ? 1 : zoom);
  const [r, g, b] = hexToColor4fChannels(PAGE_GUIDE_HEX);
  const paint = acquirePooledPaint(ck);
  paint.setColor(ck.Color4f(r, g, b, PAGE_GUIDE_PREVIEW_ALPHA));
  paint.setAntiAlias(true);
  paint.setStyle(ck.PaintStyle.Stroke);
  paint.setStrokeWidth(invZoom);

  try {
    if (preview.axis === "x") {
      canvas.drawLine(
        preview.scenePosition,
        viewport.y,
        preview.scenePosition,
        viewport.y + viewport.height,
        paint,
      );
    } else {
      canvas.drawLine(
        viewport.x,
        preview.scenePosition,
        viewport.x + viewport.width,
        preview.scenePosition,
        paint,
      );
    }
  } finally {
    releasePooledPaint(paint);
  }
}

/** 선택된 가이드의 페이지 밖 연장선 — 점선 주기 (screen px) */
const SELECTED_EXTENSION_DASH_ON_PX = 4;
const SELECTED_EXTENSION_DASH_OFF_PX = 3;

/**
 * 선택된 가이드를 **선의 방향 끝까지** 연장한다 (Figma 어법).
 *
 * 페이지 안 구간은 `renderPageGuides` 가 이미 실선으로 그렸다. 여기서는 그
 * 바깥, 즉 **뷰포트 경계까지의 두 세그먼트**만 점선으로 잇는다. 선택된
 * 가이드가 다른 페이지·다른 요소와 어디서 맞는지 한눈에 보이게 하는 것이
 * 목적이라, 페이지 경계에서 끊기면 의미가 없다.
 *
 * 실선/점선의 갈림이 곧 **소속 표시**다 — 실선 구간이 이 가이드가 속한
 * 페이지고, 점선은 "여기까지 이어지지만 이 페이지 것은 아니다" 를 말한다.
 *
 * §8.5 분류는 **조작 표식**이다 (선택 박스와 같은 열): 선택은 순간 상태이고
 * 무엇을 조작 중인지 알려야 하므로, 페이지 클립도 occlusion 도 걸지 않는다.
 * 확정 가이드 본체가 콘텐츠성 chrome 인 것과 갈린다.
 */
export function renderSelectedGuideExtension(
  ck: CanvasKit,
  canvas: Canvas,
  line: { axis: "x" | "y"; position: number },
  pageRect: { x: number; y: number; width: number; height: number },
  viewport: { x: number; y: number; width: number; height: number },
  zoom: number,
): void {
  const invZoom = 1 / (zoom === 0 ? 1 : zoom);
  const [r, g, b] = hexToColor4fChannels(PAGE_GUIDE_HEX);

  const paint = acquirePooledPaint(ck);
  let dash: ReturnType<typeof ck.PathEffect.MakeDash> | null = null;
  try {
    paint.setColor(ck.Color4f(r, g, b, PAGE_GUIDE_SELECTED_ALPHA));
    paint.setAntiAlias(true);
    paint.setStyle(ck.PaintStyle.Stroke);
    paint.setStrokeWidth(invZoom);
    dash = ck.PathEffect.MakeDash([
      SELECTED_EXTENSION_DASH_ON_PX * invZoom,
      SELECTED_EXTENSION_DASH_OFF_PX * invZoom,
    ]);
    paint.setPathEffect(dash);

    // 페이지 앞뒤로 남는 구간만 그린다. 페이지가 뷰포트를 넘어가면 한쪽 또는
    // 양쪽이 음수 길이가 되므로 그 세그먼트는 건너뛴다.
    if (line.axis === "x") {
      const top = viewport.y;
      const bottom = viewport.y + viewport.height;
      if (pageRect.y > top) {
        canvas.drawLine(line.position, top, line.position, pageRect.y, paint);
      }
      const pageBottom = pageRect.y + pageRect.height;
      if (pageBottom < bottom) {
        canvas.drawLine(line.position, pageBottom, line.position, bottom, paint);
      }
    } else {
      const left = viewport.x;
      const right = viewport.x + viewport.width;
      if (pageRect.x > left) {
        canvas.drawLine(left, line.position, pageRect.x, line.position, paint);
      }
      const pageRight = pageRect.x + pageRect.width;
      if (pageRight < right) {
        canvas.drawLine(pageRight, line.position, right, line.position, paint);
      }
    }
  } finally {
    // PathEffect 는 WASM 객체 — paint 를 풀에 돌려주기 전에 떼고 지운다
    paint.setPathEffect(null);
    dash?.delete();
    releasePooledPaint(paint);
  }
}

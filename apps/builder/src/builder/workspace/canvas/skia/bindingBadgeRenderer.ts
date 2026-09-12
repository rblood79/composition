/**
 * bindingBadgeRenderer — ADR-212 Phase 6 (UI-7 / B3).
 *
 * data binding 이 걸린 캔버스 요소의 좌상단에 "테이블 배지"(작은 테이블 아이콘 + collection 이름)를
 * scene-로컬 좌표에서 그린다. 크기는 `withFixedScreenScale` 로 줌 독립(화면 px 고정). 색은
 * 상태(normal=blue / empty=amber / error=red, `getBindingBadgeColor`)를 따른다 — 목록 배지 어법과
 * 정합. 렌더 프리미티브(폰트 캐시·paint 수명·텍스트 측정)는 selectionRenderer 정본을 재사용한다.
 *
 * 클릭 히트는 페이지 타이틀과 같은 scene 좌표 방식이므로, 그린 배지의 scene rect 를 caller 가 넘긴
 * `boundsMapOut` 에 collection 별로 채운다 (BuilderCanvas onPointerDownCapture 가 이 맵으로 판정).
 * 빌더 chrome(선택/hover 마커와 같은 층) 이라 D3 대칭 대상이 아니다.
 */
import type { Canvas, CanvasKit, FontMgr } from "canvaskit-wasm";
import { SkiaDisposable } from "./disposable";
import { acquireScopedPaint } from "./paints";
import {
  acquireOverlayFont,
  measureGlyphRunWidth,
  withFixedScreenScale,
} from "./selectionRenderer";
import { getBindingBadgeColor } from "./semanticOverlayColors";
import type { BindingBadgeTarget } from "./skiaOverlayHelpers";

const BADGE_FONT_SIZE = 11; // 화면 px
const BADGE_PADDING_X = 6;
const BADGE_PADDING_Y = 3;
const BADGE_RADIUS = 4;
const BADGE_ICON_SIZE = 11; // 테이블 아이콘 한 변 (화면 px)
const BADGE_ICON_GAP = 4;
const BADGE_MAX_TEXT = 24; // 이름 최대 글자 (초과분은 …)

/** 배지의 scene 좌표 rect + 클릭 시 열 collection — hit region 판정용 */
export interface DataBadgeBounds {
  sceneX: number;
  sceneY: number;
  width: number;
  height: number;
  pageId: string | null;
  collectionId: string;
}

function clampName(name: string): string {
  if (name.length <= BADGE_MAX_TEXT) return name;
  return `${name.slice(0, BADGE_MAX_TEXT - 1)}…`;
}

/** 흰색 테이블 아이콘(외곽 + 가로/세로 격자선)을 로컬 (x,y) 에 size×size 로 그린다. */
function drawTableIcon(
  ck: CanvasKit,
  canvas: Canvas,
  x: number,
  y: number,
  size: number,
  paint: InstanceType<CanvasKit["Paint"]>,
): void {
  paint.setStyle(ck.PaintStyle.Stroke);
  paint.setStrokeWidth(1);
  const r = ck.RRectXY(ck.LTRBRect(x, y, x + size, y + size), 1.5, 1.5);
  canvas.drawRRect(r, paint);
  // 가로선 (헤더 구분)
  const midY = y + size / 3;
  canvas.drawLine(x, midY, x + size, midY, paint);
  // 세로선 (열 구분)
  const midX = x + size / 2;
  canvas.drawLine(midX, midY, midX, y + size, paint);
  paint.setStyle(ck.PaintStyle.Fill);
}

/**
 * 배지 하나를 그린다. `target.bounds` 는 요소 원본 박스(scene 좌표) — 배지는 그 좌상단에 앵커한다.
 * boundsMapOut 가 있으면 collectionId → scene rect 를 채운다 (여러 요소가 같은 collection 을
 * 바인딩하면 마지막 것이 남지만, 클릭은 어느 것이든 같은 편집기를 열므로 무해).
 */
export function renderBindingBadge(
  ck: CanvasKit,
  canvas: Canvas,
  target: BindingBadgeTarget,
  zoom: number,
  fontMgr: FontMgr | undefined,
  boundsMapOut?: Map<string, DataBadgeBounds>,
): void {
  if (!fontMgr) return;
  const font = acquireOverlayFont(
    ck,
    fontMgr,
    ck.FontWeight.Medium,
    BADGE_FONT_SIZE,
    { embolden: true },
  );
  if (!font) return;

  const label = clampName(target.name);
  const textWidth = measureGlyphRunWidth(font, label);
  const contentWidth = BADGE_ICON_SIZE + BADGE_ICON_GAP + textWidth;
  const badgeWidth = contentWidth + BADGE_PADDING_X * 2;
  const badgeHeight = BADGE_FONT_SIZE + BADGE_PADDING_Y * 2;

  const scope = new SkiaDisposable();
  try {
    const bgPaint = acquireScopedPaint(scope, ck);
    bgPaint.setAntiAlias(true);
    bgPaint.setStyle(ck.PaintStyle.Fill);
    bgPaint.setColor(getBindingBadgeColor(ck, target.state, 0.95));

    const fgPaint = acquireScopedPaint(scope, ck);
    fgPaint.setAntiAlias(true);
    fgPaint.setStyle(ck.PaintStyle.Fill);
    fgPaint.setColor(ck.Color4f(1, 1, 1, 1));

    withFixedScreenScale(canvas, zoom, target.bounds.x, target.bounds.y, () => {
      const rrect = ck.RRectXY(
        ck.LTRBRect(0, 0, badgeWidth, badgeHeight),
        BADGE_RADIUS,
        BADGE_RADIUS,
      );
      canvas.drawRRect(rrect, bgPaint);

      // 아이콘 (세로 중앙)
      const iconY = (badgeHeight - BADGE_ICON_SIZE) / 2;
      drawTableIcon(
        ck,
        canvas,
        BADGE_PADDING_X,
        iconY,
        BADGE_ICON_SIZE,
        fgPaint,
      );

      // 텍스트 (baseline 보정)
      const metrics = font.getMetrics();
      const ascent = metrics ? Math.abs(metrics.ascent) : BADGE_FONT_SIZE * 0.8;
      const descent = metrics
        ? Math.abs(metrics.descent)
        : BADGE_FONT_SIZE * 0.2;
      const textX = BADGE_PADDING_X + BADGE_ICON_SIZE + BADGE_ICON_GAP;
      const textY = (badgeHeight + ascent - descent) / 2;
      canvas.drawText(label, textX, textY, fgPaint, font);
    });

    if (boundsMapOut) {
      const inv = 1 / (zoom === 0 ? 1 : zoom);
      boundsMapOut.set(target.collectionId, {
        sceneX: target.bounds.x,
        sceneY: target.bounds.y,
        width: badgeWidth * inv,
        height: badgeHeight * inv,
        pageId: target.pageId,
        collectionId: target.collectionId,
      });
    }
  } finally {
    scope.dispose();
  }
}

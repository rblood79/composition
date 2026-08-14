/**
 * 스냅 정렬선·등간격·거리 측정 렌더러 (ADR-179 Phase 2 / Phase 4 + Alt 측정)
 *
 * 드래그 중 흡착 순간의 정렬선(line)·등간격 표시(spacing)와, 정적 Alt 홀드
 * 거리 측정(measure)을 scene 좌표에 1 screen px 선으로 그린다. 조작
 * 표식(순간 피드백)이라 `withPageOcclusionClip` 미적용 — §8.5 선택 박스 열
 * 분류 (breakdown §3.3 판정).
 *
 * 색은 웜 레드 상수 (2026-08-13 사용자 결정 — 초기 `--accent` 무채색에서
 * 전환). Figma #F24822 / Pen #DD3F17 실측 대조 후 Figma 값 채택: 순간
 * 피드백은 콘텐츠·선택 파랑·페이지 크롬과 혼동되지 않는 이질색이라는
 * 두 도구 공통 관례. 선택 파랑(OVERLAY_BLUE)과 같은 Skia 층 상수 어법 —
 * 테마 무관 신호색이라 CSS 변수 조회 없음.
 *
 * 등간격/측정 표시 = 구간 세그먼트 + 양끝 수직 틱 + 수치 배지 (Figma 어법 —
 * Pen v1.2.1 은 수치 없음, 실측 메모리 project-pen-v121-extraction-analysis
 * 참조). 배지는 웜 레드 배경 + 흰색 텍스트.
 */

import type { CanvasKit, Canvas, FontMgr, Paint } from "canvaskit-wasm";
import type { SnapGuide } from "../interaction/snapGuides";
import type { MeasureGuide } from "../interaction/measureGuides";
import { acquirePooledPaint, releasePooledPaint } from "./paints";
import { hexToColor4fChannels } from "./themeWatcher";
import {
  resolveOverlayTypeface,
  measureGlyphRunWidth,
} from "./selectionRenderer";

/** 스냅 가이드 웜 레드 (#F24822 — Figma 측정/가이드 실측값, 양 테마 공용) */
const SNAP_GUIDE_HEX = 0xf24822;

/** 간격/측정 세그먼트 양끝 틱 반길이 (screen px) */
const SPACING_TICK_HALF_PX = 4;
/** 정렬점 × 마커 반길이 (screen px — Pen F5t=4 전체 크기보다 약간 크게) */
const MARKER_HALF_PX = 3;
/** 수치 배지 설정 (screen px — invZoom 스케일) */
const BADGE_FONT_SIZE_PX = 10;
const BADGE_LINE_HEIGHT_PX = 12;
const BADGE_PADDING_X_PX = 4;
const BADGE_PADDING_Y_PX = 2;
const BADGE_RADIUS_PX = 3;
const BADGE_OFFSET_PX = 6;

/** 수치 배지 1건 — axis 세그먼트 중앙(mid)/직교(cross) 에 value 표시 */
interface ValueBadgeItem {
  axis: "x" | "y";
  mid: number;
  cross: number;
  value: number;
}

function acquireGuidePaint(
  ck: CanvasKit,
  guideColor: readonly [number, number, number],
  invZoom: number,
): Paint {
  const paint = acquirePooledPaint(ck);
  paint.setColor(ck.Color4f(guideColor[0], guideColor[1], guideColor[2], 0.9));
  paint.setAntiAlias(true);
  paint.setStyle(ck.PaintStyle.Stroke);
  paint.setStrokeWidth(invZoom);
  return paint;
}

/** 구간 세그먼트 + 양끝 수직 틱 — |──| 형 (Figma spacing handle 어법) */
function drawSegmentWithTicks(
  canvas: Canvas,
  axis: "x" | "y",
  cross: number,
  start: number,
  end: number,
  tick: number,
  paint: Paint,
): void {
  if (end - start <= 0) {
    return;
  }
  if (axis === "x") {
    canvas.drawLine(start, cross, end, cross, paint);
    canvas.drawLine(start, cross - tick, start, cross + tick, paint);
    canvas.drawLine(end, cross - tick, end, cross + tick, paint);
  } else {
    canvas.drawLine(cross, start, cross, end, paint);
    canvas.drawLine(cross - tick, start, cross + tick, start, paint);
    canvas.drawLine(cross - tick, end, cross + tick, end, paint);
  }
}

/** 수치 배지 일괄 렌더 — dimension label 과 동일 어법 (font/paint 1회 준비) */
function renderValueBadges(
  ck: CanvasKit,
  canvas: Canvas,
  items: readonly ValueBadgeItem[],
  invZoom: number,
  guideColor: readonly [number, number, number],
  fontMgr: FontMgr,
): void {
  if (items.length === 0) {
    return;
  }
  const typeface = resolveOverlayTypeface(fontMgr, {
    weight: ck.FontWeight.Medium,
    width: ck.FontWidth.Normal,
    slant: ck.FontSlant.Upright,
  });
  if (!typeface) {
    return;
  }

  const fontSize = BADGE_FONT_SIZE_PX * invZoom;
  const font = new ck.Font(typeface, fontSize);
  font.setSubpixel(true);
  const bgPaint = acquirePooledPaint(ck);
  bgPaint.setAntiAlias(true);
  bgPaint.setStyle(ck.PaintStyle.Fill);
  bgPaint.setColor(
    ck.Color4f(guideColor[0], guideColor[1], guideColor[2], 0.95),
  );
  // 웜 레드 배경 위 텍스트는 양 테마 공통 흰색 (dimension label 어법)
  const textPaint = acquirePooledPaint(ck);
  textPaint.setAntiAlias(true);
  textPaint.setStyle(ck.PaintStyle.Fill);
  textPaint.setColor(ck.Color4f(1, 1, 1, 1));

  try {
    const textHeight = BADGE_LINE_HEIGHT_PX * invZoom;
    const paddingX = BADGE_PADDING_X_PX * invZoom;
    const paddingY = BADGE_PADDING_Y_PX * invZoom;
    const radius = BADGE_RADIUS_PX * invZoom;
    const offset = BADGE_OFFSET_PX * invZoom;
    const metrics = font.getMetrics();
    const ascent = metrics ? Math.abs(metrics.ascent) : fontSize * 0.8;
    const descent = metrics ? Math.abs(metrics.descent) : fontSize * 0.2;

    for (const item of items) {
      const text = `${Math.round(item.value)}`;
      const textWidth = measureGlyphRunWidth(font, text);
      const badgeWidth = textWidth + paddingX * 2;
      const badgeHeight = textHeight + paddingY * 2;
      // axis "x" = 수평 세그먼트 → 배지를 선 위쪽에, "y" = 수직 세그먼트 →
      // 배지를 선 오른쪽에 (드래그 포인터와 겹치지 않는 방향)
      const badgeX =
        item.axis === "x" ? item.mid - badgeWidth / 2 : item.cross + offset;
      const badgeY =
        item.axis === "x"
          ? item.cross - offset - badgeHeight
          : item.mid - badgeHeight / 2;
      const rrect = ck.RRectXY(
        ck.LTRBRect(badgeX, badgeY, badgeX + badgeWidth, badgeY + badgeHeight),
        radius,
        radius,
      );
      canvas.drawRRect(rrect, bgPaint);
      const textY = badgeY + paddingY + (textHeight + ascent - descent) / 2;
      canvas.drawText(text, badgeX + paddingX, textY, textPaint, font);
    }
  } finally {
    font.delete();
    releasePooledPaint(textPaint);
    releasePooledPaint(bgPaint);
  }
}

export function renderSnapGuides(
  ck: CanvasKit,
  canvas: Canvas,
  guides: readonly SnapGuide[],
  zoom: number,
  fontMgr?: FontMgr,
): void {
  if (guides.length === 0) {
    return;
  }

  const invZoom = 1 / (zoom === 0 ? 1 : zoom);
  const guideColor = hexToColor4fChannels(SNAP_GUIDE_HEX);
  const paint = acquireGuidePaint(ck, guideColor, invZoom);
  const markerHalf = MARKER_HALF_PX * invZoom;
  const tick = SPACING_TICK_HALF_PX * invZoom;
  const badges: ValueBadgeItem[] = [];
  for (const guide of guides) {
    if (guide.kind === "line") {
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
      // 정렬점 × 마커 — 어느 점들이 맞았는지 표식 (Pen 어법: 선 위에
      // 중심 배치되어 등을 맞댄 화살촉처럼 읽힌다)
      for (const marker of guide.markers) {
        const cx = guide.axis === "x" ? guide.position : marker;
        const cy = guide.axis === "x" ? marker : guide.position;
        canvas.drawLine(
          cx - markerHalf,
          cy - markerHalf,
          cx + markerHalf,
          cy + markerHalf,
          paint,
        );
        canvas.drawLine(
          cx + markerHalf,
          cy - markerHalf,
          cx - markerHalf,
          cy + markerHalf,
          paint,
        );
      }
    } else {
      for (const segment of guide.segments) {
        drawSegmentWithTicks(
          canvas,
          guide.axis,
          guide.cross,
          segment.start,
          segment.end,
          tick,
          paint,
        );
        if (segment.end - segment.start > 0) {
          badges.push({
            axis: guide.axis,
            mid: (segment.start + segment.end) / 2,
            cross: guide.cross,
            value: guide.value,
          });
        }
      }
    }
  }
  releasePooledPaint(paint);

  // 수치 배지는 세그먼트 위에 그린다 (fontMgr 미로드 시 세그먼트만)
  if (fontMgr) {
    renderValueBadges(ck, canvas, badges, invZoom, guideColor, fontMgr);
  }
}

/** Alt 홀드 거리 측정 — 세그먼트+틱+수치 배지 (선택 bbox ↔ 호버 대상) */
export function renderMeasureGuides(
  ck: CanvasKit,
  canvas: Canvas,
  guides: readonly MeasureGuide[],
  zoom: number,
  fontMgr?: FontMgr,
): void {
  if (guides.length === 0) {
    return;
  }

  const invZoom = 1 / (zoom === 0 ? 1 : zoom);
  const guideColor = hexToColor4fChannels(SNAP_GUIDE_HEX);
  const paint = acquireGuidePaint(ck, guideColor, invZoom);
  const tick = SPACING_TICK_HALF_PX * invZoom;
  const badges: ValueBadgeItem[] = [];
  for (const guide of guides) {
    drawSegmentWithTicks(
      canvas,
      guide.axis,
      guide.cross,
      guide.start,
      guide.end,
      tick,
      paint,
    );
    badges.push({
      axis: guide.axis,
      mid: (guide.start + guide.end) / 2,
      cross: guide.cross,
      value: guide.value,
    });
  }
  releasePooledPaint(paint);

  if (fontMgr) {
    renderValueBadges(ck, canvas, badges, invZoom, guideColor, fontMgr);
  }
}

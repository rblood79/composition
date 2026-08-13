/**
 * 스냅 정렬선·등간격 렌더러 (ADR-179 Phase 2 / Phase 4)
 *
 * 드래그 중 흡착 순간의 정렬선(line)과 등간격 표시(spacing)를 scene 좌표에
 * 1 screen px 선으로 그린다. 조작 표식(드래그 순간 피드백)이라
 * `withPageOcclusionClip` 미적용 — §8.5 선택 박스 열 분류 (breakdown §3.3
 * 판정). 색은 builder 시맨틱 `--accent` (무채색 — 명도 대비, css-tokens.md
 * §builder accent).
 *
 * 등간격 표시 = 간격 구간 세그먼트 + 양끝 수직 틱 + 간격 수치 배지
 * (Figma 어법 — Pen v1.2.1 은 수치 없음, 실측 메모리
 * project-pen-v121-extraction-analysis 참조). 배지는 `--accent` 배경 +
 * `--fg-on-accent` 텍스트 (`.list-item.applied` 페어링과 동일).
 */

import type { CanvasKit, Canvas, FontMgr, Paint } from "canvaskit-wasm";
import type { SnapGuide, SnapSpacingGuide } from "../interaction/snapGuides";
import { acquirePooledPaint, releasePooledPaint } from "./paints";
import { cssColorToHex, getCSSVariable } from "../utils/cssVariableReader";
import { hexToColor4fChannels } from "./themeWatcher";
import { resolveOverlayTypeface } from "./selectionRenderer";

/** --accent 미해석 시 폴백 — builder light accent (gray-700) */
const ACCENT_FALLBACK_HEX = 0x374151;
/** --fg-on-accent 미해석 시 폴백 — 흰색 (light accent 는 어두운 회색) */
const ON_ACCENT_FALLBACK_HEX = 0xffffff;

/** 간격 세그먼트 양끝 틱 반길이 (screen px) */
const SPACING_TICK_HALF_PX = 4;
/** 수치 배지 설정 (screen px — invZoom 스케일) */
const BADGE_FONT_SIZE_PX = 10;
const BADGE_LINE_HEIGHT_PX = 12;
const BADGE_PADDING_X_PX = 4;
const BADGE_PADDING_Y_PX = 2;
const BADGE_RADIUS_PX = 3;
const BADGE_OFFSET_PX = 6;

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
  const accent = hexToColor4fChannels(
    cssColorToHex(getCSSVariable("--accent"), ACCENT_FALLBACK_HEX),
  );
  const paint = acquirePooledPaint(ck);
  paint.setColor(ck.Color4f(accent[0], accent[1], accent[2], 0.9));
  paint.setAntiAlias(true);
  paint.setStyle(ck.PaintStyle.Stroke);
  paint.setStrokeWidth(invZoom);
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
    } else {
      renderSpacingSegments(canvas, guide, invZoom, paint);
    }
  }
  releasePooledPaint(paint);

  // 수치 배지는 세그먼트 위에 그린다 (fontMgr 미로드 시 세그먼트만)
  if (fontMgr) {
    for (const guide of guides) {
      if (guide.kind === "spacing") {
        renderSpacingBadges(ck, canvas, guide, invZoom, accent, fontMgr);
      }
    }
  }
}

/** 간격 구간 세그먼트 + 양끝 수직 틱 — |──| 형 (Figma spacing handle 어법) */
function renderSpacingSegments(
  canvas: Canvas,
  guide: SnapSpacingGuide,
  invZoom: number,
  paint: Paint,
): void {
  const tick = SPACING_TICK_HALF_PX * invZoom;
  for (const segment of guide.segments) {
    if (segment.end - segment.start <= 0) {
      continue;
    }
    if (guide.axis === "x") {
      canvas.drawLine(
        segment.start,
        guide.cross,
        segment.end,
        guide.cross,
        paint,
      );
      canvas.drawLine(
        segment.start,
        guide.cross - tick,
        segment.start,
        guide.cross + tick,
        paint,
      );
      canvas.drawLine(
        segment.end,
        guide.cross - tick,
        segment.end,
        guide.cross + tick,
        paint,
      );
    } else {
      canvas.drawLine(
        guide.cross,
        segment.start,
        guide.cross,
        segment.end,
        paint,
      );
      canvas.drawLine(
        guide.cross - tick,
        segment.start,
        guide.cross + tick,
        segment.start,
        paint,
      );
      canvas.drawLine(
        guide.cross - tick,
        segment.end,
        guide.cross + tick,
        segment.end,
        paint,
      );
    }
  }
}

/** 세그먼트 중앙의 간격 수치 배지 — dimension label 과 동일 어법 */
function renderSpacingBadges(
  ck: CanvasKit,
  canvas: Canvas,
  guide: SnapSpacingGuide,
  invZoom: number,
  accent: readonly [number, number, number],
  fontMgr: FontMgr,
): void {
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
  bgPaint.setColor(ck.Color4f(accent[0], accent[1], accent[2], 0.95));
  const [tr, tg, tb] = hexToColor4fChannels(
    cssColorToHex(getCSSVariable("--fg-on-accent"), ON_ACCENT_FALLBACK_HEX),
  );
  const textPaint = acquirePooledPaint(ck);
  textPaint.setAntiAlias(true);
  textPaint.setStyle(ck.PaintStyle.Fill);
  textPaint.setColor(ck.Color4f(tr, tg, tb, 1));

  try {
    const text = `${Math.round(guide.value)}`;
    const glyphIds = font.getGlyphIDs(text);
    const glyphWidths = font.getGlyphWidths(glyphIds);
    const textWidth = glyphWidths.reduce((sum, w) => sum + w, 0);
    const textHeight = BADGE_LINE_HEIGHT_PX * invZoom;
    const paddingX = BADGE_PADDING_X_PX * invZoom;
    const paddingY = BADGE_PADDING_Y_PX * invZoom;
    const radius = BADGE_RADIUS_PX * invZoom;
    const offset = BADGE_OFFSET_PX * invZoom;
    const badgeWidth = textWidth + paddingX * 2;
    const badgeHeight = textHeight + paddingY * 2;
    const metrics = font.getMetrics();
    const ascent = metrics ? Math.abs(metrics.ascent) : fontSize * 0.8;
    const descent = metrics ? Math.abs(metrics.descent) : fontSize * 0.2;

    for (const segment of guide.segments) {
      if (segment.end - segment.start <= 0) {
        continue;
      }
      const mid = (segment.start + segment.end) / 2;
      // axis "x" = 수평 세그먼트 → 배지를 선 위쪽에, "y" = 수직 세그먼트 →
      // 배지를 선 오른쪽에 (드래그 포인터와 겹치지 않는 방향)
      const badgeX =
        guide.axis === "x" ? mid - badgeWidth / 2 : guide.cross + offset;
      const badgeY =
        guide.axis === "x"
          ? guide.cross - offset - badgeHeight
          : mid - badgeHeight / 2;
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

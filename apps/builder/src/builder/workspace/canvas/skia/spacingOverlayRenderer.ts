/**
 * ADR-222 — padding·gap 편집 오버레이 (breakdown §1.2 시각 계약).
 *
 * 선택 중 상시 얇은 핸들 (0값 포함) → hover 띠에만 사선 + 강조 핸들 + 값 배지 →
 * 드래그 중 사선 0 · 잡은 띠 하나에만 배지 (같은 속성의 다른 띠는 핸들 강조만) →
 * 인라인 입력 중 사선·배지 0 (DOM 입력이 값을 보인다). padding 은 OVERLAY_BLUE, gap 은 OVERLAY_PINK (semanticOverlayColors 정본).
 *
 * 조작 표식이지만 내용 자리를 가리키므로 호출부가 `withPageOcclusionClip` 을 씌운다
 * (§3.2 — 사선·핸들·배지 전부 가시 영역 clip 을 따른다). 기하는 spacingGeometry 가
 * 히트와 같은 입력으로 만든 띠다.
 */

import type { CanvasKit, Canvas, FontMgr } from "canvaskit-wasm";
import type { BoundingBox } from "../selection/types";
import { acquirePooledPaint, releasePooledPaint } from "./paints";
import { buildPath } from "./buildPath";
import { SkiaDisposable } from "./disposable";
import {
  DIMENSION_LABEL_BORDER_RADIUS,
  DIMENSION_LABEL_FONT_SIZE,
  DIMENSION_LABEL_PADDING_X,
  acquireOverlayFont,
  measureGlyphRunWidth,
} from "./selectionRenderer";
import {
  SELECTION_DIMENSION_LABEL_LINE_HEIGHT,
  SELECTION_DIMENSION_LABEL_PADDING_Y,
} from "../selectionOverlayGeometry";
import { OVERLAY_BLUE_RGB, OVERLAY_PINK_RGB } from "./semanticOverlayColors";
import {
  resolveSpacingHandleRect,
  type SpacingBand,
} from "../interaction/spacingGeometry";
import type { SpacingActiveTarget } from "../interaction/spacingPresentation";

/** 사선 간격 (화면 px, breakdown §1.2 제안값) */
const HATCH_SPACING_PX = 4;
const HATCH_ALPHA = 0.35;
const HATCH_MAX_LINES = 400;
/** 값 배지 (화면 px) */
// 값 배지는 선택 치수 레이블 (W × H) 과 같은 규격 — 폰트 12 Medium · 행 16 · 패딩 6/3 · 반경 4
const BADGE_FONT_SIZE_PX = DIMENSION_LABEL_FONT_SIZE;
const BADGE_LINE_HEIGHT_PX = SELECTION_DIMENSION_LABEL_LINE_HEIGHT;
const BADGE_PADDING_X_PX = DIMENSION_LABEL_PADDING_X;
const BADGE_PADDING_Y_PX = SELECTION_DIMENSION_LABEL_PADDING_Y;
const BADGE_RADIUS_PX = DIMENSION_LABEL_BORDER_RADIUS;
/** 핸들 위 배지 간격 (화면 px) */
const BADGE_OFFSET_PX = 8;

export interface SpacingOverlayInput {
  readonly bands: readonly SpacingBand[];
  /** owner 가시 영역 (조상 clip 반영) — 사선·핸들은 이 안에만, 배지는 예외 (조작 표식) */
  readonly clipRect: BoundingBox | null;
  readonly hoveredBandId: string | null;
  readonly active: SpacingActiveTarget | null;
  readonly zoom: number;
  readonly fontMgr?: FontMgr;
}

function bandColor(band: SpacingBand): readonly [number, number, number] {
  return band.kind === "gap" ? OVERLAY_PINK_RGB : OVERLAY_BLUE_RGB;
}

function drawHatch(
  ck: CanvasKit,
  canvas: Canvas,
  rect: BoundingBox,
  color: readonly [number, number, number],
  zoom: number,
): void {
  if (rect.width <= 0 || rect.height <= 0) return;
  const scope = new SkiaDisposable();
  const paint = acquirePooledPaint(ck);
  try {
    canvas.save();
    canvas.clipRect(
      ck.LTRBRect(rect.x, rect.y, rect.x + rect.width, rect.y + rect.height),
      ck.ClipOp.Intersect,
      true,
    );
    paint.setAntiAlias(true);
    paint.setStyle(ck.PaintStyle.Stroke);
    paint.setStrokeWidth(1 / zoom);
    paint.setColor(ck.Color4f(color[0], color[1], color[2], HATCH_ALPHA));
    const spacing = HATCH_SPACING_PX / zoom;
    const span = rect.width + rect.height;
    const step =
      span / spacing > HATCH_MAX_LINES ? span / HATCH_MAX_LINES : spacing;
    const path = scope.track(
      buildPath(ck, (sink) => {
        for (let d = -rect.height; d < rect.width; d += step) {
          sink.moveTo(rect.x + d, rect.y);
          sink.lineTo(rect.x + d + rect.height, rect.y + rect.height);
        }
      }),
    );
    canvas.drawPath(path, paint);
    canvas.restore();
  } finally {
    releasePooledPaint(paint);
    scope.dispose();
  }
}

function drawHandle(
  ck: CanvasKit,
  canvas: Canvas,
  band: SpacingBand,
  zoom: number,
  emphasized: boolean,
): void {
  const rect = resolveSpacingHandleRect(band, zoom, emphasized);
  const color = bandColor(band);
  const fill = acquirePooledPaint(ck);
  const stroke = acquirePooledPaint(ck);
  try {
    fill.setAntiAlias(true);
    fill.setStyle(ck.PaintStyle.Fill);
    fill.setColor(ck.Color4f(color[0], color[1], color[2], 1));
    stroke.setAntiAlias(true);
    stroke.setStyle(ck.PaintStyle.Stroke);
    stroke.setStrokeWidth(1 / zoom);
    stroke.setColor(ck.Color4f(1, 1, 1, 0.9));
    const radius = rect.height < rect.width ? rect.height / 2 : rect.width / 2;
    const rrect = ck.RRectXY(
      ck.LTRBRect(rect.x, rect.y, rect.x + rect.width, rect.y + rect.height),
      radius,
      radius,
    );
    canvas.drawRRect(rrect, stroke);
    canvas.drawRRect(rrect, fill);
  } finally {
    releasePooledPaint(stroke);
    releasePooledPaint(fill);
  }
}

function drawBadge(
  ck: CanvasKit,
  canvas: Canvas,
  band: SpacingBand,
  value: number,
  zoom: number,
  fontMgr: FontMgr,
): void {
  const invZoom = 1 / zoom;
  const fontSize = BADGE_FONT_SIZE_PX * invZoom;
  const font = acquireOverlayFont(ck, fontMgr, ck.FontWeight.Medium, fontSize, {
    embolden: true,
  });
  if (!font) return;
  const color = bandColor(band);
  const bg = acquirePooledPaint(ck);
  const text = acquirePooledPaint(ck);
  try {
    bg.setAntiAlias(true);
    bg.setStyle(ck.PaintStyle.Fill);
    bg.setColor(ck.Color4f(color[0], color[1], color[2], 0.95));
    text.setAntiAlias(true);
    text.setStyle(ck.PaintStyle.Fill);
    text.setColor(ck.Color4f(1, 1, 1, 1));

    const label = `${Math.round(value)}`;
    const textWidth = measureGlyphRunWidth(font, label);
    const textHeight = BADGE_LINE_HEIGHT_PX * invZoom;
    const paddingX = BADGE_PADDING_X_PX * invZoom;
    const paddingY = BADGE_PADDING_Y_PX * invZoom;
    const radius = BADGE_RADIUS_PX * invZoom;
    const offset = BADGE_OFFSET_PX * invZoom;
    const badgeWidth = textWidth + paddingX * 2;
    const badgeHeight = textHeight + paddingY * 2;
    const handle = resolveSpacingHandleRect(band, zoom, true);
    const cx = handle.x + handle.width / 2;
    const cy = handle.y + handle.height / 2;
    // 가로 띠 (axis y) 는 핸들 위, 세로 띠 (axis x) 는 핸들 오른쪽 — 포인터와 겹치지 않는 쪽
    const badgeX =
      band.axis === "y" ? cx - badgeWidth / 2 : cx + handle.width / 2 + offset;
    const badgeY =
      band.axis === "y"
        ? cy - handle.height / 2 - offset - badgeHeight
        : cy - badgeHeight / 2;
    canvas.drawRRect(
      ck.RRectXY(
        ck.LTRBRect(badgeX, badgeY, badgeX + badgeWidth, badgeY + badgeHeight),
        radius,
        radius,
      ),
      bg,
    );
    const metrics = font.getMetrics();
    const ascent = metrics ? Math.abs(metrics.ascent) : fontSize * 0.8;
    const descent = metrics ? Math.abs(metrics.descent) : fontSize * 0.2;
    const textY = badgeY + paddingY + (textHeight + ascent - descent) / 2;
    canvas.drawText(label, badgeX + paddingX, textY, text, font);
  } finally {
    releasePooledPaint(text);
    releasePooledPaint(bg);
  }
}

export function renderSpacingOverlay(
  ck: CanvasKit,
  canvas: Canvas,
  input: SpacingOverlayInput,
): void {
  const { bands, clipRect, hoveredBandId, active, zoom, fontMgr } = input;
  if (bands.length === 0) return;
  const activeIds = new Set(active?.bandIds ?? []);

  canvas.save();
  if (clipRect) {
    canvas.clipRect(
      ck.LTRBRect(
        clipRect.x,
        clipRect.y,
        clipRect.x + clipRect.width,
        clipRect.y + clipRect.height,
      ),
      ck.ClipOp.Intersect,
      true,
    );
  }
  // 1) hover 사선 — 조작 중이 아닐 때 hover 띠 하나만
  if (!active && hoveredBandId) {
    const hovered = bands.find((band) => band.id === hoveredBandId);
    if (hovered) drawHatch(ck, canvas, hovered.rect, bandColor(hovered), zoom);
  }

  // 2) 상시 핸들 — 활성/hover 는 두껍게
  for (const band of bands) {
    const emphasized =
      activeIds.has(band.id) || (!active && band.id === hoveredBandId);
    drawHandle(ck, canvas, band, zoom, emphasized);
  }
  canvas.restore();

  // 3) 값 배지 — hover 띠 또는 press/drag 중 **잡은 띠 하나** (인라인 입력 중은 DOM 이 값을 보인다).
  //    같은 속성의 다른 gap 띠 · Option 양쪽 변에는 배지를 반복하지 않는다 — Figma·Framer 모두
  //    드래그 위치에만 수치를 보이고 같은 값의 중복 표기는 없다 (2026-09-17 사용자 지적). 핸들 강조만 공유.
  if (!fontMgr) return;
  if (active && active.mode !== "input") {
    const grabbed = bands.find((band) => band.id === active.bandId);
    if (grabbed) drawBadge(ck, canvas, grabbed, grabbed.value, zoom, fontMgr);
  } else if (!active && hoveredBandId) {
    const hovered = bands.find((band) => band.id === hoveredBandId);
    if (hovered) drawBadge(ck, canvas, hovered, hovered.value, zoom, fontMgr);
  }
}

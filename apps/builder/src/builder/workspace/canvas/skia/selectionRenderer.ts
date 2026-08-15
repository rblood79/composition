/**
 * Skia Selection 오버레이 렌더러
 *
 * Pencil 방식 단일 캔버스: Selection Box, Transform Handles, Lasso를
 * CanvasKit으로 직접 렌더링한다.
 *
 * aiEffects.ts와 동일한 패턴(순수 함수 + SkiaDisposable).
 * 카메라 변환(translate + scale) 내부에서 씬-로컬 좌표로 호출된다.
 *
 * @see docs/RENDERING_ARCHITECTURE.md §5.11
 */

import type {
  CanvasKit,
  Canvas,
  Font,
  FontMgr,
  FontStyle,
} from "canvaskit-wasm";
import { SkiaDisposable } from "./disposable";
import { acquireScopedPaint } from "./paints";
import { strokeBoundsRect } from "./hoverRenderer";
import type { BoundingBox } from "../selection/types";
import { HANDLE_SIZE, HANDLE_CONFIGS } from "../selection/types";
import type { EditingSemanticsRole } from "../../../utils/editingSemantics";
import {
  getSemanticOverlayColor,
  OVERLAY_BLUE_R,
  OVERLAY_BLUE_G,
  OVERLAY_BLUE_B,
} from "./semanticOverlayColors";

function setSemanticStrokeColor(
  ck: CanvasKit,
  paint: InstanceType<CanvasKit["Paint"]>,
  semanticRole: EditingSemanticsRole | null,
): void {
  paint.setColor(getSemanticOverlayColor(ck, semanticRole, 1));
}

/**
 * 글리프 폭 합으로 텍스트 실폭을 잰다.
 *
 * 오버레이 배지/레이블은 CanvasKit Paragraph 를 쓰지 않고 Font 로 직접 그리므로
 * 폭 측정도 글리프 합산이다 — 네 곳(치수 레이블 / 프레임 타이틀 / 스냅 배지 /
 * collection remainder)이 같은 식을 쓴다.
 */
export function measureGlyphRunWidth(font: Font, text: string): number {
  const glyphIds = font.getGlyphIDs(text);
  return font.getGlyphWidths(glyphIds).reduce((sum, w) => sum + w, 0);
}

/**
 * fontMgr 로드 시점/이름 표기 차이에 견고하도록 Variable → static → generic
 * 순으로 6단계 fallback 한다. bc499fc4 이후 fontMgr 는 "Pretendard Variable"
 * / "Inter Variable" 로 로드되므로 legacy 이름과 generic fallback 도 포함.
 * (snapGuideRenderer 의 간격 수치 배지도 공유 — ADR-179 Phase 4)
 */
export function resolveOverlayTypeface(
  fontMgr: FontMgr,
  fontStyle: FontStyle,
): ReturnType<FontMgr["matchFamilyStyle"]> | null {
  return (
    fontMgr.matchFamilyStyle("Pretendard Variable", fontStyle) ??
    fontMgr.matchFamilyStyle("Inter Variable", fontStyle) ??
    fontMgr.matchFamilyStyle("Pretendard", fontStyle) ??
    fontMgr.matchFamilyStyle("Inter", fontStyle) ??
    fontMgr.matchFamilyStyle("sans-serif", fontStyle) ??
    fontMgr.matchFamilyStyle("", fontStyle)
  );
}

// ── Overlay Font 캐시 (simplify 효율 항목, 2026-08-14) ──
//
// 오버레이 라벨 6곳(치수/페이지 타이틀/collection remainder/스냅 배지/workflow ×2)이
// 호출마다 matchFamilyStyle(1–6회 WASM) + `new ck.Font()` 생성 → 프레임 끝 delete 를
// 반복했다 — 팬 1초(60Hz reference, 타이틀 5개 + 선택 1개) 기준 Font 생성/삭제 ≈ 360회/초.
// weight 축은 Normal/Medium 2종뿐이고 zoom 종속 크기는 `font.setSize` 로 갈아끼울 수
// 있으므로 (fontMgr 참조, weight.value) 당 Font 1개를 유지한다. 렌더는 단일 스레드
// 순차라 acquire → 사용 사이에 다른 acquire 가 끼어들 수 없어 크기 mutate 가 안전.
// fontMgr 교체(폰트 로드 완료 등 — nodePictureCache 의 font generation 과 같은 신호)는
// 참조 비교로 감지해 전체 재구축한다. 반환 Font 는 캐시 소유 — 호출부 delete/track 금지.

interface OverlayFontEntry {
  typeface: NonNullable<ReturnType<FontMgr["matchFamilyStyle"]>>;
  font: Font;
}

let _overlayFontMgr: FontMgr | null = null;
const _overlayFontByWeight = new Map<number, OverlayFontEntry>();

export function acquireOverlayFont(
  ck: CanvasKit,
  fontMgr: FontMgr,
  weight: NonNullable<FontStyle["weight"]>,
  fontSize: number,
): Font | null {
  if (_overlayFontMgr !== fontMgr) {
    clearOverlayFontCache();
    _overlayFontMgr = fontMgr;
  }
  const key = weight.value;
  const cached = _overlayFontByWeight.get(key);
  if (cached) {
    cached.font.setSize(fontSize);
    return cached.font;
  }
  const typeface = resolveOverlayTypeface(fontMgr, {
    weight,
    width: ck.FontWidth.Normal,
    slant: ck.FontSlant.Upright,
  });
  // 미해소(폰트 로드 전) 는 캐시하지 않는다 — 같은 fontMgr 에 폰트가 늦게 실려도
  // 다음 호출이 재시도한다.
  if (!typeface) return null;
  const font = new ck.Font(typeface, fontSize);
  font.setSubpixel(true);
  _overlayFontByWeight.set(key, { typeface, font });
  return font;
}

/** overlay font 캐시 해제 (fontMgr 교체 시 내부 호출 / 테스트·teardown 용). */
export function clearOverlayFontCache(): void {
  for (const entry of _overlayFontByWeight.values()) {
    entry.font.delete();
    entry.typeface.delete();
  }
  _overlayFontByWeight.clear();
  _overlayFontMgr = null;
}

/** Page Title 레이블 설정 */
const PAGE_TITLE_FONT_SIZE = 12; // 화면상 폰트 크기 (px)
const PAGE_TITLE_OFFSET_Y = 20; // 페이지 상단 위로 오프셋 (px)
const PAGE_TITLE_COLOR_R = 0x64 / 255; // slate-500 (#64748b)
const PAGE_TITLE_COLOR_G = 0x74 / 255;
const PAGE_TITLE_COLOR_B = 0x8b / 255;
const PAGE_TITLE_OPACITY = 0.8;

/** Dimension 레이블 설정 */
const DIMENSION_LABEL_FONT_SIZE = 12; // 화면상 폰트 크기 (px)
const DIMENSION_LABEL_PADDING_X = 6; // 레이블 수평 패딩
const DIMENSION_LABEL_PADDING_Y = 3; // 레이블 수직 패딩
const DIMENSION_LABEL_OFFSET_Y = 8; // 선택 박스 하단으로부터의 오프셋
const DIMENSION_LABEL_BG_R = 0x51 / 255; // 배경색 (#51a2ff)
const DIMENSION_LABEL_BG_G = 0xa2 / 255;
const DIMENSION_LABEL_BG_B = 0xff / 255;
const DIMENSION_LABEL_LINE_HEIGHT = 16; // 레이블 줄 높이
const DIMENSION_LABEL_BORDER_RADIUS = 4; // 배경 둥근 모서리

function setDimensionLabelBackgroundColor(
  ck: CanvasKit,
  paint: InstanceType<CanvasKit["Paint"]>,
  semanticRole: EditingSemanticsRole | null,
): void {
  if (semanticRole) {
    paint.setColor(getSemanticOverlayColor(ck, semanticRole, 1));
    return;
  }

  paint.setColor(
    ck.Color4f(
      DIMENSION_LABEL_BG_R,
      DIMENSION_LABEL_BG_G,
      DIMENSION_LABEL_BG_B,
      1,
    ),
  );
}

// ============================================
// Types
// ============================================

/** 라쏘 렌더 데이터 */
export interface LassoRenderData {
  x: number;
  y: number;
  width: number;
  height: number;
}

// ============================================
// Selection Box
// ============================================

/**
 * 선택 박스 테두리를 CanvasKit으로 렌더링한다.
 *
 * 씬-로컬 좌표계에서 호출. strokeWidth = 1/zoom으로 화면상 1px 유지.
 */
export function renderSelectionBox(
  ck: CanvasKit,
  canvas: Canvas,
  bounds: BoundingBox,
  zoom: number,
  semanticRole: EditingSemanticsRole | null = null,
): void {
  const sw = 1 / zoom;
  strokeBoundsRect(
    ck,
    canvas,
    bounds,
    getSemanticOverlayColor(ck, semanticRole, 1),
    sw,
    semanticRole === "instance" ? [sw, sw * 1.8] : null,
  );
}

// ============================================
// Transform Handles (코너 4개)
// ============================================

/**
 * 4개 코너 핸들을 CanvasKit으로 렌더링한다.
 *
 * 흰색 Fill + 파란 Stroke, 크기 = HANDLE_SIZE/zoom (화면상 6px 유지).
 *
 * 엣지 핸들은 **의도적으로 그리지 않는다** — 보이지 않는 히트 영역으로만 존재한다.
 * 판정은 `selection/types.ts::hitTestHandle` 의 좌표 계산(EDGE_HIT_THICKNESS)이
 * 담당하며 렌더러와 무관하다. 구 주석은 이 판정을 "PixiJS 히트 영역" 이라 적었는데
 * ADR-900 이후 사실이 아니다 (2026-08-15 정정).
 */
export function renderTransformHandles(
  ck: CanvasKit,
  canvas: Canvas,
  bounds: BoundingBox,
  zoom: number,
  semanticRole: EditingSemanticsRole | null = null,
): void {
  const scope = new SkiaDisposable();
  try {
    const handleSize = HANDLE_SIZE / zoom;
    const sw = 1 / zoom;
    const halfHandle = handleSize / 2;

    // Fill paint (흰색)
    const fillPaint = acquireScopedPaint(scope, ck);
    fillPaint.setAntiAlias(true);
    fillPaint.setStyle(ck.PaintStyle.Fill);
    fillPaint.setColor(ck.Color4f(1, 1, 1, 1));

    // Stroke paint (파란색)
    const strokePaint = acquireScopedPaint(scope, ck);
    strokePaint.setAntiAlias(true);
    strokePaint.setStyle(ck.PaintStyle.Stroke);
    strokePaint.setStrokeWidth(sw);
    setSemanticStrokeColor(ck, strokePaint, semanticRole);

    for (const config of HANDLE_CONFIGS) {
      if (!config.isCorner) continue;

      const cx = bounds.x + bounds.width * config.relativeX;
      const cy = bounds.y + bounds.height * config.relativeY;

      const rect = ck.LTRBRect(
        cx - halfHandle,
        cy - halfHandle,
        cx + halfHandle,
        cy + halfHandle,
      );

      canvas.drawRect(rect, fillPaint);
      canvas.drawRect(rect, strokePaint);
    }
  } finally {
    scope.dispose();
  }
}

// ============================================
// Dimension Labels (치수 표시)
// ============================================

/**
 * 선택된 요소의 크기(width × height)를 선택 박스 하단에 표시한다.
 *
 * Figma 스타일: 파란 배경의 둥근 레이블에 흰색 텍스트.
 * 씬-로컬 좌표계에서 호출되며, fontSize/padding은 1/zoom으로 스케일하여
 * 화면상 일정한 크기를 유지한다.
 */
export function renderDimensionLabels(
  ck: CanvasKit,
  canvas: Canvas,
  bounds: BoundingBox,
  zoom: number,
  fontMgr?: FontMgr,
  semanticRole: EditingSemanticsRole | null = null,
): void {
  // fontMgr 없으면 텍스트 렌더링 불가 — 박스만 표시
  if (!fontMgr) {
    // 폰트 매니저 없이 배경 박스만 렌더링
    const scope = new SkiaDisposable();
    try {
      const invZoom = 1 / zoom;
      const paddingX = DIMENSION_LABEL_PADDING_X * invZoom;
      const paddingY = DIMENSION_LABEL_PADDING_Y * invZoom;
      const offsetY = DIMENSION_LABEL_OFFSET_Y * invZoom;
      const borderRadius = DIMENSION_LABEL_BORDER_RADIUS * invZoom;

      // 대략적인 텍스트 크기 추정 (폰트 없이)
      const width = Math.round(bounds.width);
      const height = Math.round(bounds.height);
      const charCount = `${width} × ${height}`.length;
      const estimatedTextWidth =
        charCount * DIMENSION_LABEL_FONT_SIZE * 0.6 * invZoom;
      const estimatedTextHeight = DIMENSION_LABEL_FONT_SIZE * invZoom;

      const labelWidth = estimatedTextWidth + paddingX * 2;
      const labelHeight = estimatedTextHeight + paddingY * 2;
      const labelX = bounds.x + bounds.width / 2 - labelWidth / 2;
      const labelY = bounds.y + bounds.height + offsetY;

      const bgPaint = acquireScopedPaint(scope, ck);
      bgPaint.setAntiAlias(true);
      bgPaint.setStyle(ck.PaintStyle.Fill);
      setDimensionLabelBackgroundColor(ck, bgPaint, semanticRole);

      const rrect = ck.RRectXY(
        ck.LTRBRect(labelX, labelY, labelX + labelWidth, labelY + labelHeight),
        borderRadius,
        borderRadius,
      );
      canvas.drawRRect(rrect, bgPaint);
    } finally {
      scope.dispose();
    }
    return;
  }

  const scope = new SkiaDisposable();
  try {
    const invZoom = 1 / zoom;

    // 화면상 고정 크기를 위한 스케일 적용
    const fontSize = DIMENSION_LABEL_FONT_SIZE * invZoom;
    const paddingX = DIMENSION_LABEL_PADDING_X * invZoom;
    const paddingY = DIMENSION_LABEL_PADDING_Y * invZoom;
    const offsetY = DIMENSION_LABEL_OFFSET_Y * invZoom;
    const borderRadius = DIMENSION_LABEL_BORDER_RADIUS * invZoom;

    // 치수 텍스트 생성 (소수점 없이 정수로 표시)
    const width = Math.round(bounds.width);
    const height = Math.round(bounds.height);
    const dimensionText = `${width} × ${height}`;

    // 캐시 소유 Font — scope.track 금지 (acquireOverlayFont 주석 참조).
    const font = acquireOverlayFont(
      ck,
      fontMgr,
      ck.FontWeight.Medium,
      fontSize,
    );
    if (!font) return;

    const textWidth = measureGlyphRunWidth(font, dimensionText);
    const textHeight = DIMENSION_LABEL_LINE_HEIGHT * invZoom;

    // 레이블 배경 크기 및 위치 계산
    const labelWidth = textWidth + paddingX * 2;
    const labelHeight = textHeight + paddingY * 2;
    const labelX = bounds.x + bounds.width / 2 - labelWidth / 2;
    const labelY = bounds.y + bounds.height + offsetY;

    // 배경 RRect (둥근 모서리 사각형)
    const bgPaint = acquireScopedPaint(scope, ck);
    bgPaint.setAntiAlias(true);
    bgPaint.setStyle(ck.PaintStyle.Fill);
    setDimensionLabelBackgroundColor(ck, bgPaint, semanticRole);

    const rrect = ck.RRectXY(
      ck.LTRBRect(labelX, labelY, labelX + labelWidth, labelY + labelHeight),
      borderRadius,
      borderRadius,
    );
    canvas.drawRRect(rrect, bgPaint);

    // 텍스트 Paint (흰색)
    const textPaint = acquireScopedPaint(scope, ck);
    textPaint.setAntiAlias(true);
    textPaint.setStyle(ck.PaintStyle.Fill);
    textPaint.setColor(ck.Color4f(1, 1, 1, 1));

    // 텍스트 렌더링 (baseline 기준이므로 Y 위치 조정)
    const textX = labelX + paddingX;
    // baseline: line-height 중앙 + ascent 보정
    const fontMetrics = font.getMetrics();
    const ascent = fontMetrics ? Math.abs(fontMetrics.ascent) : fontSize * 0.8;
    const descent = fontMetrics
      ? Math.abs(fontMetrics.descent)
      : fontSize * 0.2;
    const textY = labelY + paddingY + (textHeight + ascent - descent) / 2;
    canvas.drawText(dimensionText, textX, textY, textPaint, font);
  } finally {
    scope.dispose();
  }
}

// ============================================
// Lasso Selection
// ============================================

/**
 * 라쏘(사각형 드래그) 선택 영역을 CanvasKit으로 렌더링한다.
 *
 * 반투명 파란 Fill + 파란 Stroke.
 */
export function renderLasso(
  ck: CanvasKit,
  canvas: Canvas,
  lasso: LassoRenderData,
  zoom: number,
): void {
  const scope = new SkiaDisposable();
  try {
    const sw = 1 / zoom;

    const rect = ck.LTRBRect(
      lasso.x,
      lasso.y,
      lasso.x + lasso.width,
      lasso.y + lasso.height,
    );

    // Fill (반투명)
    const fillPaint = acquireScopedPaint(scope, ck);
    fillPaint.setAntiAlias(true);
    fillPaint.setStyle(ck.PaintStyle.Fill);
    fillPaint.setColor(
      ck.Color4f(OVERLAY_BLUE_R, OVERLAY_BLUE_G, OVERLAY_BLUE_B, 0.1),
    );
    canvas.drawRect(rect, fillPaint);

    // Stroke
    const strokePaint = acquireScopedPaint(scope, ck);
    strokePaint.setAntiAlias(true);
    strokePaint.setStyle(ck.PaintStyle.Stroke);
    strokePaint.setStrokeWidth(sw);
    strokePaint.setColor(
      ck.Color4f(OVERLAY_BLUE_R, OVERLAY_BLUE_G, OVERLAY_BLUE_B, 0.8),
    );
    canvas.drawRect(rect, strokePaint);
  } finally {
    scope.dispose();
  }
}

// ============================================
// Page Title Label (Pencil Frame Title 스타일)
// ============================================

/**
 * 페이지 타이틀을 페이지 경계 좌상단 위에 표시한다.
 *
 * Pencil 앱의 Frame title과 동일한 방식.
 * 씬-로컬 좌표계에서 호출되며, fontSize는 1/zoom으로 스케일하여
 * 화면상 일정한 크기를 유지한다.
 */
export function renderPageTitle(
  ck: CanvasKit,
  canvas: Canvas,
  title: string,
  zoom: number,
  fontMgr?: FontMgr,
  isActive = false,
): { titleWidth: number } | null {
  if (!title || !fontMgr) return null;

  const scope = new SkiaDisposable();
  try {
    const invZoom = 1 / zoom;

    // 고정 폰트 사이즈로 렌더링하여 줌 시 글리프 간격 흔들림 방지.
    // 캐시 소유 Font — scope.track 금지 (acquireOverlayFont 주석 참조).
    const font = acquireOverlayFont(
      ck,
      fontMgr,
      isActive ? ck.FontWeight.Medium : ck.FontWeight.Normal,
      PAGE_TITLE_FONT_SIZE,
    );
    if (!font) return null;

    // 활성 페이지: selection 색상, 비활성: slate-500
    const textPaint = acquireScopedPaint(scope, ck);
    textPaint.setAntiAlias(true);
    textPaint.setStyle(ck.PaintStyle.Fill);
    if (isActive) {
      textPaint.setColor(
        ck.Color4f(OVERLAY_BLUE_R, OVERLAY_BLUE_G, OVERLAY_BLUE_B, 1),
      );
    } else {
      textPaint.setColor(
        ck.Color4f(
          PAGE_TITLE_COLOR_R,
          PAGE_TITLE_COLOR_G,
          PAGE_TITLE_COLOR_B,
          PAGE_TITLE_OPACITY,
        ),
      );
    }

    // canvas.scale로 줌 보정 → 폰트 사이즈가 항상 고정되어 글리프 메트릭 안정
    canvas.save();
    canvas.scale(invZoom, invZoom);

    // 화면 픽셀 좌표에서 위치 계산 후 pixel snap
    const textX = 0;
    const textY = Math.round(
      -PAGE_TITLE_OFFSET_Y + PAGE_TITLE_FONT_SIZE * 0.85,
    );

    canvas.drawText(title, textX, textY, textPaint, font);

    // 타이틀 폭은 drag hit-test 에서도 재사용되므로 항상 계산하여 반환한다.
    const titleWidth = measureGlyphRunWidth(font, title);

    canvas.restore();
    return { titleWidth };
  } finally {
    scope.dispose();
  }
}

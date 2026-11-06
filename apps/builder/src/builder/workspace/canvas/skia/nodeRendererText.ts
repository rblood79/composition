import type {
  CanvasKit,
  Canvas,
  FontMgr,
  Paragraph,
  Paint,
  EmbindEnumEntity,
} from "canvaskit-wasm";
import { spectrumFontVariations } from "@composition/rendering";
import {
  resolveFontVariantFeatures,
  resolveFontStretchWidth,
  DEFAULT_FONT_FEATURES,
} from "../layout/engines/cssResolver";
import {
  cssNormalBreakProcess,
  computeKeepAllWidth,
  preprocessBreakWordText,
} from "../utils/textWrapUtils";
import { USE_CANVAS2D_MEASURE } from "../wasm-bindings/featureFlags";
import { collapseTextWhiteSpace } from "../utils/textWhiteSpace";
import {
  isSyntheticSmallCaps,
  SMALL_CAPS_SCALE,
  splitSmallCapsRuns,
} from "../utils/smallCapsSynthesis";
import {
  needsFallback,
  measureWithCanvas2D,
} from "../utils/canvas2dSegmentCache";
import {
  cssFontFamilyList,
  measureFontBox,
  type TextMeasureStyle,
} from "../utils/textMeasure";
import { registerSkiaCacheDestroy, SkiaDisposable } from "./disposable";
import { acquirePooledPaint, releasePooledPaint } from "./paints";
import { buildPath } from "./buildPath";
import { skiaFontManager } from "./fontManager";
import { observe } from "../../../utils/perfMarks";
import { getCacheMetrics } from "./cacheMetrics";
import { renderCounters, renderScope } from "./renderCounters";
import { drainPendingWasmDisposals } from "./deferredDisposal";
import type { SkiaNodeData, SkiaTextRun } from "./nodeRendererTypes";
import { alignTextRuns } from "../utils/textRunAlign";
import { getTextParagraphCacheKey } from "./textParagraphKey";
import {
  getRetainedParagraphCount,
  lastParagraphMissReason,
  resolveRetainedParagraph,
  retainParagraph,
} from "./retainedParagraph";
import { resolveCssBaselineCorrection } from "./textGlyphCentering";
import {
  cssLetterSpacingShift,
  resolveCssDecorationLines,
} from "./textDecorationGeometry";

// paragraph 소유 = 텍스트 노드 (ADR-174). 구 전역 content-키 LRU 와 전환
// 플래그는 Phase 3 에서 제거됨 — 상한/퇴거 개념 자체가 사라졌고, 수명은
// 노드 수명이다 (해제 경로: retainedParagraph.releaseParagraphsIn).

// ── dev 계측 (ADR-174 Phase 0) ────────────────────────────────────────────
// paragraph 는 유일하게 계측 채널이 없던 캐시였고, 그것이 상한 스래싱 →
// 텍스트 소실이 조용히 진행된 이유이기도 하다. hit/miss/eviction/size 는 다른
// 캐시(nodePicture/paintPool)와 같은 `__composition_CACHE_METRICS__` 채널로,
// walk 당 draw 수와 고유 키 수(= 중복 계수, G1)는 census 로 노출한다.
const PARAGRAPH_METRICS_DEV = process.env.NODE_ENV === "development";
const PARAGRAPH_MISS_COUNTER = {
  first: "paragraphMissFirst",
  released: "paragraphMissReleased",
  key: "paragraphMissKey",
  fontMgr: "paragraphMissFontMgr",
} as const;

let censusActive = false;
let censusDraws = 0;
const censusKeys = new Set<string>();
const censusNodes = new Set<string>();

/**
 * 캐시 조회 직전에 호출 — hit/miss 와 무관하게 "이 프레임이 그린 텍스트" 1건.
 *
 * `nodes` 는 per-node retained 소유 시의 보유 개수, `keys` 는 현행 content 키의
 * 보유 개수다. 둘의 비가 retained 전환으로 잃는 dedup 크기 = 중복 계수 (G1).
 * 프레임을 가로질러 누적하므로 여러 프레임/여러 페이지를 훑어 문서 전체 집계에
 * 쓸 수 있다 (draws 만 프레임 반복에 비례해 부풀어난다).
 */
function observeParagraphDraw(
  key: string,
  elementId: string | undefined,
): void {
  if (!censusActive) return;
  censusDraws++;
  censusKeys.add(key);
  if (elementId !== undefined) censusNodes.add(elementId);
}

function syncParagraphMetricsSize(): void {
  if (PARAGRAPH_METRICS_DEV) {
    getCacheMetrics("paragraph").setSize(getRetainedParagraphCount());
  }
}

/**
 * 프레임 밖 pending 폐기 배수 — 캔버스 teardown / 명시 정리.
 *
 * retained paragraph 자체의 해제는 노드 사망 경로가 담당한다
 * (`releaseParagraphsIn` — registerSkiaNode 교체 / unregisterSkiaNode /
 * clearSkiaRegistry). 여기서는 그 경로가 예약해 둔 pending 폐기를 프레임
 * 밖에서 즉시 배수해 WASM 누수를 막는다 (R3).
 */
export function clearTextParagraphCache(): void {
  drainPendingWasmDisposals();
}

// 통합 해제 경로 등록 (ADR-153 Phase 2 레지스트리) — 캔버스 teardown 시 배수.
// paragraph 는 종전 이 레지스트리에 없어 unmount 시 WASM Paragraph 가 그대로
// 남았다 (ADR-174 Phase 1 에서 해소 — 폐기 경로 단일화의 일부).
registerSkiaCacheDestroy("paragraphCache", clearTextParagraphCache);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    drainPendingWasmDisposals();
  });
}

// dev 전용 디버그 전역 — ADR-174 실측/검증 probe (nodePictureCache 와 동일 패턴).
// census 는 "한 walk 이 그린 텍스트 draw 수 / 그 중 고유 캐시 키 수" 를 재며,
// 둘의 비(중복 계수)가 per-node retained 전환 시 잃는 dedup 크기다 (G1).
if (typeof window !== "undefined" && import.meta.env?.DEV) {
  (
    window as unknown as Record<string, unknown>
  ).__composition_PARAGRAPH_DEBUG__ = {
    size: (): number => getRetainedParagraphCount(),
    census: {
      start(): void {
        censusActive = true;
        censusDraws = 0;
        censusKeys.clear();
        censusNodes.clear();
      },
      stop(): void {
        censusActive = false;
      },
      report(): {
        active: boolean;
        draws: number;
        uniqueKeys: number;
        uniqueNodes: number;
        duplicationFactor: number;
        retainedCount: number;
      } {
        return {
          active: censusActive,
          draws: censusDraws,
          uniqueKeys: censusKeys.size,
          uniqueNodes: censusNodes.size,
          // per-node retained ÷ content-키 dedup — 노드 소유가 지불하는 중복 배수
          duplicationFactor:
            censusKeys.size === 0 ? 0 : censusNodes.size / censusKeys.size,
          // 실제 보유량 (G1 재측정의 관측 지점) — 살아 있는 텍스트 노드 수와 같다
          retainedCount: getRetainedParagraphCount(),
        };
      },
    },
  };
}

/** 텍스트를 그린 노드-로컬 원점 — ADR-027 D2 오버레이 정렬용 (executor 가 element-local 로 환산). */
export interface TextDrawPoint {
  drawX: number;
  drawY: number;
  /**
   * 그린 글자가 노드 상자 밖으로 나갔다 (`clipText` 가 아니면 자르지 않는다). hit bounds 밖 paint 라
   * damage 부분 재기록이 그 영역을 모른다 (ADR-263).
   */
  overflows: boolean;
}

/** 1 px 넘게 상자 밖이면 넘친 것으로 본다 (안티앨리어싱 · 반올림 여유). */
const PAINT_OVERFLOW_TOLERANCE = 1;

function paragraphOverflows(
  paragraph: Paragraph,
  drawX: number,
  drawY: number,
  width: number,
  height: number,
): boolean {
  const right = drawX + paragraph.getLongestLine();
  const bottom = drawY + paragraph.getHeight();
  return (
    drawX < -PAINT_OVERFLOW_TOLERANCE ||
    drawY < -PAINT_OVERFLOW_TOLERANCE ||
    right > width + PAINT_OVERFLOW_TOLERANCE ||
    bottom > height + PAINT_OVERFLOW_TOLERANCE
  );
}

export function renderText(
  ck: CanvasKit,
  canvas: Canvas,
  node: SkiaNodeData,
  fontMgr: FontMgr,
): TextDrawPoint | undefined {
  if (!node.text) return undefined;

  // fontMgr 교체 시 일괄 clear 는 없다 — retained entry 가 생성 시점 fontMgr 을
  // 들고 있어 resolveRetainedParagraph 가 per-entry 로 무효 판정 + 지연 폐기한다.

  const whiteSpace = node.text.whiteSpace ?? "normal";
  // CSS §4.1.1 공백 처리 — normal · nowrap 은 `\n` 도 공백으로 접는다 (DOM 과 같이).
  const processedText = collapseTextWhiteSpace(node.text.content, whiteSpace);

  const layoutMaxWidth =
    whiteSpace === "nowrap" || whiteSpace === "pre"
      ? 100000
      : node.text.maxWidth;
  const wordBreak = node.text.wordBreak ?? "normal";
  const overflowWrap = node.text.overflowWrap ?? "normal";
  const heightMultiplier = node.text.lineHeight
    ? node.text.lineHeight / node.text.fontSize
    : 0;
  const textIndent = node.text.textIndent ?? 0;
  const isEllipsis =
    node.text.textOverflow === "ellipsis" &&
    whiteSpace === "nowrap" &&
    !!node.text.clipText;

  const key = getTextParagraphCacheKey(node, processedText);

  // ADR-299 — a range-formatted text: its runs over the text the paragraph is built from. The
  // paragraph breaks its own lines (no Canvas 2D hints — one style cannot measure runs of several
  // sizes), as the layout measure does (`catalogTextMeasure` — the same runs, the same paragraph).
  const richRuns = node.text.runs?.length ? node.text.runs : undefined;
  const richText =
    richRuns &&
    wordBreak === "break-all" &&
    layoutMaxWidth < 100000 &&
    !isEllipsis
      ? Array.from(processedText).join("\u200B")
      : processedText;
  const alignedRuns = richRuns
    ? alignTextRuns(node.text.content, richRuns, richText)
    : undefined;

  // The painted baseline at the CSS line box's (`resolveCssBaselineCorrection`): SkParagraph rounds
  // it to whole px, Chrome rounds the font's ascent · descent instead.
  const cssBaselineShift = (paragraph: Paragraph): number => {
    const baseline = paragraph.getLineMetrics()[0]?.baseline;
    if (baseline === undefined) return 0;
    if (node.text!.baseline !== undefined)
      return node.text!.baseline - Math.round(baseline);
    const lineHeight = node.text!.lineHeight;
    if (!lineHeight) return 0;
    const font = measureFontBox(
      cssFontFamilyList(node.text!.fontFamilies),
      node.text!.fontSize,
      node.text!.fontWeight ?? 400,
      node.text!.locale,
    );
    if (!font) return 0;
    return resolveCssBaselineCorrection({
      lineHeight,
      fontAscent: font.ascent,
      fontDescent: font.descent,
      paragraphBaseline: baseline,
    });
  };

  const computeDrawY = (paragraph: Paragraph): number => {
    const verticalAlign = node.text!.verticalAlign;
    const hasExplicitBottomPadding =
      typeof node.text!.paddingBottom === "number" &&
      node.text!.paddingBottom >= 0;

    // explicit "top" 은 아래 paddingTop 분기로 보낸다 (2026-09-03, ADR-923 TextArea rows) — 종전엔
    //   explicit paddingBottom 이 있으면 "top" 도 여기서 중앙 배치돼 Style 패널 "top" 이 no-op 이었고,
    //   TextArea Input placeholder 가 rows 상자 중앙에 놓였다 (DOM `<textarea>` 는 위).
    if (
      hasExplicitBottomPadding &&
      (!verticalAlign || verticalAlign === "baseline")
    ) {
      // The line box (one line or many) centred in the content box, as the DOM centres it. Not by
      //   the glyphs' ink: that lifted a Badge's "gButton" above the same text in a Button (2026-11-02).
      const contentHeight =
        node.height - node.text!.paddingTop - (node.text!.paddingBottom ?? 0);
      return (
        node.text!.paddingTop +
        Math.max(0, (contentHeight - paragraph.getHeight()) / 2) +
        cssBaselineShift(paragraph)
      );
    }

    const shift = cssBaselineShift(paragraph);
    if (
      !verticalAlign ||
      verticalAlign === "top" ||
      verticalAlign === "baseline"
    ) {
      return node.text!.paddingTop + shift;
    }
    const textHeight = paragraph.getHeight();
    switch (verticalAlign) {
      case "middle":
        return (node.height - textHeight) / 2 + shift;
      case "bottom":
        return node.height - textHeight + shift;
      default:
        return node.text!.paddingTop + shift;
    }
  };

  // G4: text-shadow 2-pass — shadow를 원본 텍스트보다 먼저 렌더.
  // CSS 스펙: 첫 번째 shadow가 맨 위 → 역순 순회로 아래부터 렌더.
  // ColorFilter.MakeMatrix로 원본 paragraph 색상을 shadow 색상으로 오버라이드.
  const renderTextShadows = (
    paragraph: Paragraph,
    drawX: number,
    drawY: number,
  ): void => {
    if (!node.text!.textShadows?.length) return;
    for (let si = node.text!.textShadows.length - 1; si >= 0; si--) {
      const shadow = node.text!.textShadows[si];
      canvas.save();
      canvas.translate(shadow.offsetX, shadow.offsetY);

      let blurLayerAdded = false;
      if (shadow.sigma > 0) {
        const blurFilter = ck.ImageFilter.MakeBlur(
          shadow.sigma,
          shadow.sigma,
          ck.TileMode.Decal,
          null,
        );
        const blurPaint = acquirePooledPaint(ck);
        blurPaint.setImageFilter(blurFilter);
        canvas.saveLayer(blurPaint);
        releasePooledPaint(blurPaint);
        blurFilter.delete();
        blurLayerAdded = true;
      }

      // 행렬 레이아웃 (4x5 row-major):
      //   [0  0  0  0  sr]  R' = sr
      //   [0  0  0  0  sg]  G' = sg
      //   [0  0  0  0  sb]  B' = sb
      //   [0  0  0  sa 0 ]  A' = A * sa (원본 alpha에 shadow alpha 곱)
      const sr = shadow.color[0];
      const sg = shadow.color[1];
      const sb = shadow.color[2];
      const sa = shadow.color[3];
      const shadowFilter = ck.ColorFilter.MakeMatrix([
        0,
        0,
        0,
        0,
        sr,
        0,
        0,
        0,
        0,
        sg,
        0,
        0,
        0,
        0,
        sb,
        0,
        0,
        0,
        sa,
        0,
      ]);
      const shadowPaint = acquirePooledPaint(ck);
      shadowPaint.setColorFilter(shadowFilter);
      canvas.saveLayer(shadowPaint);
      releasePooledPaint(shadowPaint);
      // The layer holds the filter (sk_sp): drop the handle like the blur's (audit L11).
      shadowFilter.delete();

      canvas.drawParagraph(paragraph, drawX, drawY);

      canvas.restore(); // color filter saveLayer
      if (blurLayerAdded) canvas.restore(); // blur saveLayer
      canvas.restore(); // translate
    }
  };

  const drawTextWithPresentationColor = (
    paragraph: Paragraph,
    drawX: number,
    drawY: number,
  ): void => {
    const presentationColor = node.text!.presentationColor;
    const canonicalColor = node.text!.color;
    const presentationColorIsCanonical =
      !presentationColor ||
      !canonicalColor ||
      (presentationColor.length === canonicalColor.length &&
        presentationColor.every(
          (channel, index) => channel === canonicalColor[index],
        ));
    if (presentationColorIsCanonical) {
      canvas.drawParagraph(paragraph, drawX, drawY);
      return;
    }

    // Keep paragraph metrics and the retained paragraph cache canonical. The
    // presentation slot only changes the paint color for this draw pass.
    const colorFilter = ck.ColorFilter.MakeMatrix([
      0,
      0,
      0,
      0,
      presentationColor[0],
      0,
      0,
      0,
      0,
      presentationColor[1],
      0,
      0,
      0,
      0,
      presentationColor[2],
      0,
      0,
      0,
      presentationColor[3],
      0,
    ]);
    const colorPaint = acquirePooledPaint(ck);
    colorPaint.setColorFilter(colorFilter);
    canvas.saveLayer(colorPaint);
    releasePooledPaint(colorPaint);
    colorFilter.delete();
    canvas.drawParagraph(paragraph, drawX, drawY);
    canvas.restore();
  };

  // text-decoration lines as the Preview draws them (`resolveCssDecorationLines`): along each line's
  // advance (letter spacing included, as CSS), from the painted baseline — SkParagraph paints a line
  // at its baseline rounded to whole px.
  const drawCssDecorations = (
    paragraph: Paragraph,
    drawX: number,
    drawY: number,
  ): void => {
    const text = node.text!;
    if (alignedRuns) {
      drawRunDecorations(
        ck,
        canvas,
        paragraph,
        text,
        alignedRuns,
        drawX,
        drawY,
      );
      return;
    }
    if (!text.decoration) return;
    const font = measureFontBox(
      cssFontFamilyList(text.fontFamilies),
      text.fontSize,
      text.fontWeight ?? 400,
      text.locale,
    );
    const lines = paragraph.getLineMetrics();
    if (lines.length === 0) return;
    const color = text.decorationColor ?? text.presentationColor ?? text.color;
    const style = text.decorationStyle ?? "solid";
    const dpr =
      typeof globalThis.devicePixelRatio === "number"
        ? globalThis.devicePixelRatio
        : 1;
    const paint = acquirePooledPaint(ck);
    try {
      paint.setAntiAlias(true);
      paint.setColor(color);
      for (const line of lines) {
        if (line.width <= 0) continue;
        const x0 = drawX + line.left;
        const x1 = x0 + line.width;
        const decorated = resolveCssDecorationLines({
          fontSize: text.fontSize,
          fontAscent: font?.ascent ?? line.ascent,
          baseline: drawY + Math.round(line.baseline),
          dpr,
          decoration: text.decoration,
        });
        for (const { top, thickness } of decorated) {
          drawDecorationLine(ck, canvas, paint, style, x0, x1, top, thickness);
        }
      }
    } finally {
      paint.setStyle(ck.PaintStyle.Fill);
      paint.setPathEffect(null);
      paint.setStrokeWidth(1);
      releasePooledPaint(paint);
    }
  };

  // The retained hit and the fresh miss draw the same: shadows and text inside the `clipText` box
  // (ellipsis lays out one line). The hit path drew unclipped — a re-recorded fixed-height text
  // overflowed its box where the DOM clips it (audit M9).
  const drawParagraphBox = (
    paragraph: Paragraph,
    drawX: number,
    drawY: number,
  ): void => {
    const shouldClip = node.text?.clipText === true && !isEllipsis;
    if (shouldClip) {
      canvas.save();
      canvas.clipRect(
        ck.XYWHRect(0, 0, node.width, node.height),
        ck.ClipOp.Intersect,
        true,
      );
    }
    // Glyphs where CSS puts them: SkParagraph splits the letter spacing around each glyph.
    const glyphX = drawX + cssLetterSpacingShift(node.text?.letterSpacing);
    renderTextShadows(paragraph, glyphX, drawY);
    drawTextWithPresentationColor(paragraph, glyphX, drawY);
    // Decorations from the same origin: SkParagraph's line `left` already holds the leading half
    //   of the spacing, so the line spans the CSS advance (live Compare Mode 2026-11-02).
    drawCssDecorations(paragraph, glyphX, drawY);
    if (shouldClip) canvas.restore();
  };

  observeParagraphDraw(key, node.elementId);

  // 소유자는 이 텍스트 노드 객체다. 노드 identity 는 내용이 실제로 바뀔 때만
  // 교체되므로 (StoreRenderBridge.registerBuiltNode — 이동은 교체하지 않는다),
  // 팬/드래그 중에도 hit 이 유지된다.
  const retained = resolveRetainedParagraph(node, key, fontMgr);
  if (retained) {
    if (PARAGRAPH_METRICS_DEV) getCacheMetrics("paragraph").recordHit();
    const drawY = computeDrawY(retained.paragraph);
    const drawX = node.text.paddingLeft + textIndent + retained.alignOffset;
    drawParagraphBox(retained.paragraph, drawX, drawY);
    return {
      drawX,
      drawY,
      overflows:
        !(node.text?.clipText === true && !isEllipsis) &&
        paragraphOverflows(
          retained.paragraph,
          drawX,
          drawY,
          node.width,
          node.height,
        ),
    };
  }
  if (PARAGRAPH_METRICS_DEV) {
    getCacheMetrics("paragraph").recordMiss();
    // ADR-266 Phase 0: 미스 사유 · full 기록 안에서 새로 만든 paragraph 수
    renderCounters[PARAGRAPH_MISS_COUNTER[lastParagraphMissReason()]] += 1;
    if (renderScope.kind === "full") renderCounters.contentRecordedText += 1;
  }

  const scope = new SkiaDisposable();
  try {
    let textAlign: EmbindEnumEntity;
    const rawAlign = node.text.align;
    if (typeof rawAlign === "string") {
      const alignMap: Record<string, EmbindEnumEntity> = {
        left: ck.TextAlign.Left,
        center: ck.TextAlign.Center,
        right: ck.TextAlign.Right,
      };
      textAlign = alignMap[rawAlign] ?? ck.TextAlign.Left;
    } else {
      textAlign = rawAlign ?? ck.TextAlign.Left;
    }

    const fontWeightMap: Record<number, EmbindEnumEntity> = {
      100: ck.FontWeight.Thin,
      200: ck.FontWeight.ExtraLight,
      300: ck.FontWeight.Light,
      400: ck.FontWeight.Normal,
      500: ck.FontWeight.Medium,
      600: ck.FontWeight.SemiBold,
      700: ck.FontWeight.Bold,
      800: ck.FontWeight.ExtraBold,
      900: ck.FontWeight.Black,
    };
    const fontWeight =
      fontWeightMap[node.text.fontWeight ?? 400] ?? ck.FontWeight.Normal;

    const fontSlantMap: Record<number, EmbindEnumEntity> = {
      0: ck.FontSlant.Upright,
      1: ck.FontSlant.Italic,
      2: ck.FontSlant.Oblique,
    };
    const fontSlant =
      fontSlantMap[node.text.fontStyle ?? 0] ?? ck.FontSlant.Upright;

    const fontStretchStr = node.text.fontStretch ?? "normal";
    const fontWidthIndex = resolveFontStretchWidth(fontStretchStr);
    const fontWidthEnumValues = ck.FontWidth;
    const fontWidthEntries: [string, EmbindEnumEntity][] = [
      ["UltraCondensed", fontWidthEnumValues.UltraCondensed],
      ["ExtraCondensed", fontWidthEnumValues.ExtraCondensed],
      ["Condensed", fontWidthEnumValues.Condensed],
      ["SemiCondensed", fontWidthEnumValues.SemiCondensed],
      ["Normal", fontWidthEnumValues.Normal],
      ["SemiExpanded", fontWidthEnumValues.SemiExpanded],
      ["Expanded", fontWidthEnumValues.Expanded],
      ["ExtraExpanded", fontWidthEnumValues.ExtraExpanded],
      ["UltraExpanded", fontWidthEnumValues.UltraExpanded],
    ];
    const fontWidth =
      fontWidthEntries[fontWidthIndex - 1]?.[1] ?? fontWidthEnumValues.Normal;

    const fontVariantStr = node.text.fontVariant ?? "normal";
    const variantFeatures = resolveFontVariantFeatures(fontVariantStr);
    const fontFeatureTags = [...DEFAULT_FONT_FEATURES, ...variantFeatures];
    // small-caps 합성 (smallCapsSynthesis.ts): 번들 폰트에 smcp 가 없어 feature 태그만으로는 소문자
    //   그대로였다 — Chrome 처럼 소문자 run 을 대문자 × 0.7 로 그린다. 줄 높이는 strut 이 본문 크기로 고정.
    const synthSmallCaps = isSyntheticSmallCaps(fontVariantStr);

    const heightMultiplierOpt =
      heightMultiplier > 0 ? heightMultiplier : undefined;

    const resolvedFamilies = node.text.fontFamilies.map((f) =>
      skiaFontManager.resolveFamily(f),
    );

    const paraStyle = new ck.ParagraphStyle({
      textStyle: {
        fontFamilies: resolvedFamilies,
        locale: node.text!.locale,
        fontSize: node.text.fontSize,
        fontStyle: { weight: fontWeight, slant: fontSlant, width: fontWidth },
        color: node.text.color,
        letterSpacing: node.text.letterSpacing ?? 0,
        wordSpacing: node.text.wordSpacing ?? 0,
        ...(heightMultiplierOpt !== undefined
          ? { heightMultiplier: heightMultiplierOpt, halfLeading: true }
          : {}),
        ...(fontFeatureTags.length > 0
          ? { fontFeatures: fontFeatureTags }
          : {}),
      },
      textAlign,
      ...(heightMultiplierOpt !== undefined || synthSmallCaps
        ? {
            strutStyle: {
              strutEnabled: true,
              fontFamilies: resolvedFamilies,
              fontSize: node.text.fontSize,
              ...(heightMultiplierOpt !== undefined
                ? { heightMultiplier: heightMultiplierOpt, halfLeading: true }
                : {}),
              // (Runs of other sizes grow their line past the strut, as a CSS line box grows with
              //  its tallest inline box — ADR-299. A one-style text keeps the forced strut.)
              forceStrutHeight: !alignedRuns,
            },
          }
        : {}),
      ...(isEllipsis ? { maxLines: 1, ellipsis: "\u2026" } : {}),
    });

    let renderableText = alignedRuns ? richText : processedText;
    let effectiveLayoutWidth = isEllipsis ? node.text.maxWidth : layoutMaxWidth;

    if (!alignedRuns && !isEllipsis && layoutMaxWidth < 100000) {
      // ADR-051: Canvas 2D Break Hint Injection
      // Canvas 2D가 결정한 줄바꿈을 \n으로 삽입하여 CanvasKit 렌더링에 강제.
      // 측정(Canvas 2D)과 렌더링(CanvasKit)의 줄바꿈 일치를 구조적으로 보장.
      const c2dStyle: TextMeasureStyle = {
        locale: node.text.locale,
        fontSize: node.text.fontSize,
        fontFamily: node.text.fontFamilies.join(", "),
        fontWeight: node.text.fontWeight,
        fontStyle: node.text.fontStyle,
        fontVariant: node.text.fontVariant,
        fontStretch: node.text.fontStretch,
        letterSpacing: node.text.letterSpacing,
        wordSpacing: node.text.wordSpacing,
        lineHeight: node.text.lineHeight,
        wordBreak,
        overflowWrap,
        whiteSpace,
      };

      if (USE_CANVAS2D_MEASURE && !needsFallback(c2dStyle)) {
        const c2dResult = measureWithCanvas2D(
          processedText,
          c2dStyle,
          layoutMaxWidth,
        );
        renderableText = c2dResult.hintedText;
        // +1: Canvas 2D↔CanvasKit sub-pixel 차이로 인한 오발 줄바꿈 방지
        effectiveLayoutWidth = Math.max(
          layoutMaxWidth,
          Math.ceil(c2dResult.width) + 1,
        );
      } else if (wordBreak === "normal" && overflowWrap === "normal") {
        const result = cssNormalBreakProcess(
          ck,
          paraStyle,
          fontMgr,
          processedText,
          layoutMaxWidth,
        );
        renderableText = result.text;
        effectiveLayoutWidth = result.effectiveWidth;
      } else if (wordBreak === "break-all") {
        renderableText = Array.from(processedText).join("\u200B");
        effectiveLayoutWidth = layoutMaxWidth;
      } else if (overflowWrap === "break-word" || overflowWrap === "anywhere") {
        if (wordBreak === "keep-all") {
          effectiveLayoutWidth = computeKeepAllWidth(
            ck,
            paraStyle,
            fontMgr,
            processedText,
            layoutMaxWidth,
            true,
          );
        } else {
          renderableText = preprocessBreakWordText(
            ck,
            paraStyle,
            fontMgr,
            processedText,
            layoutMaxWidth,
          );
          effectiveLayoutWidth = layoutMaxWidth;
        }
      } else if (wordBreak === "keep-all") {
        effectiveLayoutWidth = computeKeepAllWidth(
          ck,
          paraStyle,
          fontMgr,
          processedText,
          layoutMaxWidth,
          false,
        );
      }
    }

    // ⚠️ per-call builder (`Make` + fontMgr 직접 전달) 금지 — 호출마다 새
    // FontCollection 이 만들어져, 아래 pushStyle 의 fontVariations 가 paragraph
    // 마다 ~5.78 MB variable font 인스턴스를 따로 보유하게 된다 (2026-07-31
    // 실측 — fontManager.getFontCollection() 주석 참조). 공유 collection 은
    // (typeface × variation) 인스턴스를 paragraph 간 공유해 이 비용을 없앤다.
    const builder = scope.track(
      ck.ParagraphBuilder.MakeFromFontCollection(
        paraStyle,
        observe("render.text.fontCollection", () =>
          skiaFontManager.getFontCollection(),
        ),
      ),
    );
    // Variable font: fontFeatures + fontVariations(wght axis)를 pushStyle로 명시 적용.
    // ParagraphStyle.textStyle만으로는 CanvasKit에서 Variable font의
    // weight/fontFeatures가 렌더링에 반영되지 않는 문제 대응.
    //
    // Decorations are not SkParagraph's: it places them from the font's underline metrics, the
    // Preview by Chrome's rules — `drawCssDecorations` draws them after the text (2026-11-02).
    const runTextStyle = (fontSize: number, run?: SkiaTextRun) =>
      new ck.TextStyle({
        fontFamilies: resolvedFamilies,
        locale: node.text!.locale,
        fontSize,
        fontStyle: {
          weight:
            run?.fontWeight !== undefined
              ? (fontWeightMap[run.fontWeight] ?? fontWeight)
              : fontWeight,
          slant:
            run?.fontStyle !== undefined
              ? (fontSlantMap[run.fontStyle] ?? fontSlant)
              : fontSlant,
          width: fontWidth,
        },
        color: run?.color ?? node.text!.color,
        letterSpacing: node.text!.letterSpacing ?? 0,
        wordSpacing: node.text!.wordSpacing ?? 0,
        ...(heightMultiplierOpt !== undefined
          ? { heightMultiplier: heightMultiplierOpt, halfLeading: true }
          : {}),
        ...(fontFeatureTags.length > 0
          ? { fontFeatures: fontFeatureTags }
          : {}),
        fontVariations: spectrumFontVariations(
          resolvedFamilies,
          run?.fontWeight ?? node.text!.fontWeight ?? 400,
          [50, 62.5, 75, 87.5, 100, 112.5, 125, 150, 200][fontWidthIndex - 1] ??
            100,
        ),
      });
    builder.pushStyle(runTextStyle(node.text.fontSize));
    if (alignedRuns) {
      // ADR-299 — each run in its own style over the node's (the small-caps synthesis inside it).
      const addPart = (text: string, run?: SkiaTextRun) => {
        const size = run?.fontSize ?? node.text!.fontSize;
        if (!synthSmallCaps) {
          builder.addText(text);
          return;
        }
        for (const part of splitSmallCapsRuns(text, fontVariantStr)) {
          if (!part.small) {
            builder.addText(part.text);
            continue;
          }
          builder.pushStyle(runTextStyle(size * SMALL_CAPS_SCALE, run));
          builder.addText(part.text);
          builder.pop();
        }
      };
      let at = 0;
      for (const run of alignedRuns) {
        if (run.start > at) addPart(renderableText.slice(at, run.start));
        builder.pushStyle(
          runTextStyle(run.fontSize ?? node.text.fontSize, run),
        );
        addPart(renderableText.slice(run.start, run.end), run);
        builder.pop();
        at = run.end;
      }
      if (at < renderableText.length) addPart(renderableText.slice(at));
    } else if (synthSmallCaps) {
      // 소문자 run 만 축소 TextStyle 로 — 공백 · 숫자 · 한글 · 대문자는 본문 크기 (Chrome 합성과 같다).
      const smallStyle = runTextStyle(node.text.fontSize * SMALL_CAPS_SCALE);
      for (const run of splitSmallCapsRuns(renderableText, fontVariantStr)) {
        if (run.small) {
          builder.pushStyle(smallStyle);
          builder.addText(run.text);
          builder.pop();
        } else {
          builder.addText(run.text);
        }
      }
    } else {
      builder.addText(renderableText);
    }
    const paragraph = observe("render.text.paragraph.build", () =>
      builder.build(),
    );
    observe("render.text.paragraph.layout", () =>
      paragraph.layout(effectiveLayoutWidth),
    );

    // ADR-299 — the measure's wrap width (`paragraphMetrics`: no less than min-content unless the
    // text breaks inside words, + 0.5 for a line that fits to the sub-pixel).
    if (alignedRuns && !isEllipsis && layoutMaxWidth < 100000) {
      const breaksWords =
        wordBreak === "break-all" ||
        overflowWrap === "break-word" ||
        overflowWrap === "anywhere";
      effectiveLayoutWidth =
        (breaksWords
          ? layoutMaxWidth
          : Math.max(layoutMaxWidth, paragraph.getMinIntrinsicWidth())) + 0.5;
      paragraph.layout(effectiveLayoutWidth);
    }

    // CanvasKit 큰 width 렌더링 실패 방지:
    // paragraph.layout(100000+) 시 텍스트가 보이지 않는 CanvasKit 내부 버그.
    // nowrap/pre → maxIntrinsicWidth + 1로 재레이아웃하여 정확한 폭 사용.
    // ellipsis 는 예외 — 이미 maxWidth 로 layout 했고 (maxLines 1 + ellipsis), intrinsic 폭으로
    //   다시 layout 하면 "…" 이 사라진다 (사용자 live 2026-09-20: Truncate Text 가 Preview 는
    //   "ABCDEFG AB…", Canvas 는 678px 한 줄 전부).
    if (layoutMaxWidth >= 100000 && !isEllipsis) {
      const maxIntrinsic = paragraph.getMaxIntrinsicWidth();
      effectiveLayoutWidth = Math.ceil(maxIntrinsic) + 1;
      paragraph.layout(effectiveLayoutWidth);
    }

    // Canvas 2D↔CanvasKit 오발 줄바꿈 교정:
    // hintedText에 \n이 없는데(Canvas 2D가 한 줄 판정) CanvasKit이 줄바꿈한 경우
    // → CanvasKit 자체 측정(getMaxIntrinsicWidth)으로 재layout
    // \n이 있는 다줄 텍스트는 의도된 줄바꿈이므로 건드리지 않음
    //
    // ⚠️ ADR-057 Phase A: break-all / break-word / anywhere 경로는
    // ZWS 삽입 또는 preprocessBreakWordText 변환으로 legitimate wrap을 만든다.
    // renderableText가 원본 processedText와 다르면 그 변환 결과를 신뢰하고
    // 교정 로직을 스킵 — 그렇지 않으면 break-all의 4줄 wrap이 1줄로 잘못 복구된다.
    if (
      !alignedRuns &&
      !isEllipsis &&
      layoutMaxWidth < 100000 &&
      !renderableText.includes("\n") &&
      renderableText === processedText
    ) {
      const lineMetrics = paragraph.getLineMetrics();
      if (lineMetrics.length > 1) {
        const maxIntrinsic = paragraph.getMaxIntrinsicWidth();
        effectiveLayoutWidth = Math.max(
          effectiveLayoutWidth,
          Math.ceil(maxIntrinsic) + 1,
        );
        paragraph.layout(effectiveLayoutWidth);
      }
    }

    let alignOffset = 0;
    if (effectiveLayoutWidth > layoutMaxWidth && layoutMaxWidth < 100000) {
      const widthDiff = effectiveLayoutWidth - layoutMaxWidth;
      if (textAlign === ck.TextAlign.Center) {
        alignOffset = -widthDiff / 2;
      } else if (textAlign === ck.TextAlign.Right) {
        alignOffset = -widthDiff;
      }
    } else if (!isEllipsis && layoutMaxWidth >= 100000) {
      // nowrap/pre + 명시 maxWidth 밴드 + center/right 정렬 (ADR-151 후속 2026-07-17):
      // nowrap 은 위(:566)에서 paragraph 를 intrinsic 폭으로 재layout 하므로 paragraph
      // 내부 align 이 무효가 된다 (폭 == 글자 폭) — CSS 는 white-space:nowrap 이어도
      // text-align 을 유지하므로 밴드 내 외부 offset 으로 정렬을 복원한다.
      // (발견 사례: 옛 IllustratedMessage placeholder ○ glyph 가 박스 좌측에 붙었다 — DOM 은
      // flex center. calendar 요일 등 nowrap+center escape 전반 동일 계열.)
      const band = node.text.maxWidth;
      if (
        typeof band === "number" &&
        band < 100000 &&
        band > effectiveLayoutWidth
      ) {
        const bandDiff = band - effectiveLayoutWidth;
        if (textAlign === ck.TextAlign.Center) {
          alignOffset = bandDiff / 2;
        } else if (textAlign === ck.TextAlign.Right) {
          alignOffset = bandDiff;
        }
      }
    }

    retainParagraph(node, paragraph, key, fontMgr, alignOffset);
    syncParagraphMetricsSize();
    const drawY = computeDrawY(paragraph);

    const drawX = node.text.paddingLeft + textIndent + alignOffset;
    drawParagraphBox(paragraph, drawX, drawY);
    return {
      drawX,
      drawY,
      overflows:
        !(node.text?.clipText === true && !isEllipsis) &&
        paragraphOverflows(paragraph, drawX, drawY, node.width, node.height),
    };
  } finally {
    scope.dispose();
  }
}

/**
 * ADR-299 Decision 2 — a range-formatted text's decoration lines: the ancestor's (CSS propagation —
 * in the decorating box's color and size, under every run) and then each run's own (`run mark ??
 * node's own`, in the run's color and size), along the run's glyph rects on each line, from the
 * line's painted baseline (SkParagraph's whole px — as the one-style `drawCssDecorations`).
 */
function drawRunDecorations(
  ck: CanvasKit,
  canvas: Canvas,
  paragraph: Paragraph,
  text: NonNullable<SkiaNodeData["text"]>,
  runs: readonly SkiaTextRun[],
  drawX: number,
  drawY: number,
): void {
  const ancestor = text.ancestorDecoration;
  if (!ancestor && !runs.some((run) => run.decoration)) return;
  const lines = paragraph.getLineMetrics();
  if (lines.length === 0) return;
  const families = cssFontFamilyList(text.fontFamilies);
  const style = text.decorationStyle ?? "solid";
  const dpr =
    typeof globalThis.devicePixelRatio === "number"
      ? globalThis.devicePixelRatio
      : 1;
  const lineOf = (top: number, bottom: number) => {
    const middle = (top + bottom) / 2;
    return (
      lines.find(
        (line) =>
          middle >= line.baseline - line.ascent &&
          middle <= line.baseline + line.descent,
      ) ?? lines[0]!
    );
  };
  const paint = acquirePooledPaint(ck);
  try {
    paint.setAntiAlias(true);
    const draw = (
      start: number,
      end: number,
      decoration: number,
      fontSize: number,
      fontWeight: number,
      color: Float32Array,
    ) => {
      if (!decoration || end <= start) return;
      const font = measureFontBox(families, fontSize, fontWeight, text.locale);
      paint.setColor(color);
      for (const box of paragraph.getRectsForRange(
        start,
        end,
        ck.RectHeightStyle.Tight,
        ck.RectWidthStyle.Tight,
      )) {
        const [left, top, right, bottom] = box.rect;
        if (right - left <= 0) continue;
        const line = lineOf(top!, bottom!);
        for (const { top: y, thickness } of resolveCssDecorationLines({
          fontSize,
          fontAscent: font?.ascent ?? line.ascent,
          baseline: drawY + Math.round(line.baseline),
          dpr,
          decoration,
        }))
          drawDecorationLine(
            ck,
            canvas,
            paint,
            style,
            drawX + left!,
            drawX + right!,
            y,
            thickness,
          );
      }
    };
    const color = text.presentationColor ?? text.color;
    let end = 0;
    for (const run of runs) end = Math.max(end, run.end);
    if (ancestor)
      draw(
        0,
        end,
        ancestor.decoration,
        ancestor.fontSize ?? text.fontSize,
        400,
        ancestor.color ?? color,
      );
    for (const run of runs)
      draw(
        run.start,
        run.end,
        run.decoration ?? 0,
        run.fontSize ?? text.fontSize,
        run.fontWeight ?? text.fontWeight ?? 400,
        text.decorationColor ?? run.color ?? color,
      );
  } finally {
    paint.setStyle(ck.PaintStyle.Fill);
    paint.setPathEffect(null);
    paint.setStrokeWidth(1);
    releasePooledPaint(paint);
  }
}

/**
 * One decoration line, `top` · `thickness` as CSS lays it. Solid is a rect; double a second line
 * one thickness under (over, for an overline — CSS keeps the pair inside the line's side); dotted ·
 * dashed · wavy stroke the centre line (Chrome: dots one thickness apart, dashes three thicknesses).
 */
function drawDecorationLine(
  ck: CanvasKit,
  canvas: Canvas,
  paint: Paint,
  style: NonNullable<NonNullable<SkiaNodeData["text"]>["decorationStyle"]>,
  x0: number,
  x1: number,
  top: number,
  thickness: number,
): void {
  if (style === "solid" || style === "double") {
    paint.setStyle(ck.PaintStyle.Fill);
    canvas.drawRect(ck.LTRBRect(x0, top, x1, top + thickness), paint);
    if (style === "double") {
      const second = top + thickness * 2;
      canvas.drawRect(ck.LTRBRect(x0, second, x1, second + thickness), paint);
    }
    return;
  }
  const y = top + thickness / 2;
  paint.setStyle(ck.PaintStyle.Stroke);
  paint.setStrokeWidth(thickness);
  if (style === "wavy") {
    const wave = Math.max(2, thickness * 3);
    const amp = Math.max(1, thickness * 1.5);
    const path = buildPath(ck, (sink) => {
      sink.moveTo(x0, y);
      for (let x = x0, up = true; x < x1; x += wave, up = !up) {
        sink.quadTo(
          x + wave / 2,
          up ? y - amp : y + amp,
          Math.min(x1, x + wave),
          y,
        );
      }
    });
    canvas.drawPath(path, paint);
    path.delete();
    return;
  }
  const dash = style === "dotted" ? thickness : thickness * 3;
  const effect = ck.PathEffect.MakeDash([dash, dash], 0);
  paint.setPathEffect(effect);
  canvas.drawLine(x0, y, x1, y, paint);
  paint.setPathEffect(null);
  effect?.delete();
}

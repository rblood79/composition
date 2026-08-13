/**
 * 눈금자(Ruler) 렌더러 — ADR-181 Phase 1
 *
 * 상단(가로)·좌측(세로) 눈금 스트립을 뷰포트 **화면 고정** 으로 그린다.
 * 문서 데이터가 아니라 순수 뷰포트 chrome 이라, 그려지는 모든 값은
 * `panOffset`(cameraX/Y)/`zoom` 의 함수다 — 씬 내용·선택 상태·페이지를
 * 읽지 않는다.
 *
 * **좌표계**: 오버레이 캔버스는 호출 시점에 이미 카메라 변환(translate+scale)이
 * 적용돼 있다 (`SkiaRenderer.renderScreenOverlay`). 화면 고정 chrome 은
 * 미니맵(`workflowMinimap.ts`)과 같은 어법으로 화면 좌표를 씬 좌표로 역산해
 * 그린다 — `scene = (screen - pan) / zoom`, 길이는 `screenLen / zoom`.
 * 변환 리셋(save/setMatrix)을 쓰지 않는 이유는 이 층의 기존 계약을 그대로
 * 따르기 위함이다.
 *
 * **눈금 값은 scene 좌표** 다. 페이지-로컬 원점으로 바꾸면 선택/활성 페이지에
 * 의존하게 되어 "카메라의 순수 함수" 계약(HC1·C11 — 전용 invalidation 카운터
 * 불요의 근거)이 깨진다.
 *
 * **색**: 이 Skia 오버레이 층은 테마 배선이 없고 중립 고정 상수 + alpha 로
 * 양 테마를 함께 만족시키는 것이 기존 어법이다 (`gridRenderer` slate 계열,
 * `selectionRenderer` 페이지 타이틀 slate-500). 여기서도 slate-500 계열
 * 단일 색상에 alpha 만 달리해 쓴다 — 확정 팔레트가 아니라 live 대조 후
 * 조정 대상 (breakdown §3 Phase 1 검증 항목).
 */

import type {
  CanvasKit,
  Canvas,
  Font,
  FontMgr,
  Paint,
  SkPicture,
  TextBlob,
} from "canvaskit-wasm";
import { acquirePooledPaint, releasePooledPaint } from "./paints";
import { resolveOverlayTypeface } from "./selectionRenderer";

/** 스트립 두께 (screen px) */
export const RULER_SIZE_PX = 20;

/** slate-500 (#64748b) — 페이지 타이틀과 같은 중립 계열 */
const RULER_R = 0x64 / 255;
const RULER_G = 0x74 / 255;
const RULER_B = 0x8b / 255;

const STRIP_ALPHA = 0.12;
const TICK_ALPHA = 0.5;
const MAJOR_TICK_ALPHA = 0.75;
const LABEL_ALPHA = 0.95;
const EDGE_ALPHA = 0.3;

/** 주 눈금(라벨 표시) 최소 화면 간격 — 라벨이 겹치지 않는 하한 */
const LABEL_MIN_SPACING_PX = 48;
/** 보조 눈금 최소 화면 간격 — 이보다 촘촘해지면 보조 눈금을 생략한다 */
const MINOR_MIN_SPACING_PX = 6;
/** 주 눈금 하나당 보조 눈금 분할 수 */
const MINOR_DIVISIONS = 5;

const MAJOR_TICK_LEN_PX = 8;
const MINOR_TICK_LEN_PX = 4;

const LABEL_FONT_SIZE_PX = 9;
/** 라벨을 눈금선에서 띄우는 여백 (screen px) */
const LABEL_GAP_PX = 3;

/** 한 프레임에 그릴 눈금 상한 — 비정상 zoom/카메라 값에서 루프 폭주 차단 */
const MAX_TICKS_PER_AXIS = 4096;

/**
 * 눈금 라벨 문자열 캐시 (HC1 — per-frame 문자열 할당 최소화).
 *
 * 키는 눈금의 scene 값이고, 값 집합은 현재 눈금 간격의 배수로 한정된다.
 * 간격이 바뀌면(=zoom 버킷 변경) 이전 배수는 다시 나오지 않으므로 통째로
 * 비운다. 멀리 팬 하는 동안 키가 늘어나는 것만 상한으로 막는다.
 */
let labelCacheInterval = 0;
let labelCache = new Map<number, string>();
const LABEL_CACHE_MAX = 512;

function tickLabel(value: number, interval: number): string {
  if (interval !== labelCacheInterval) {
    labelCacheInterval = interval;
    labelCache = new Map();
  } else if (labelCache.size > LABEL_CACHE_MAX) {
    labelCache.clear();
  }
  const hit = labelCache.get(value);
  if (hit !== undefined) return hit;
  // 간격이 1 미만으로 내려가는 줌에서도 자릿수가 폭발하지 않게 반올림한다
  const text = interval >= 1 ? String(Math.round(value)) : value.toFixed(1);
  labelCache.set(value, text);
  return text;
}

/**
 * 라벨 Font 캐시 (HC1).
 *
 * `new ck.Font()` + `delete()` 를 프레임마다 반복하면 WASM 왕복이 프레임 비용을
 * 지배한다. 크기는 `LABEL_FONT_SIZE_PX / zoom` 이라 **줌이 바뀔 때만** 변하므로,
 * 크기 하나만 들고 있다가 달라질 때 교체한다 (ascent 도 함께 캐시 — `getMetrics`
 * 역시 WASM 왕복이다).
 */
let cachedFont: Font | null = null;
let cachedFontSize = -1;
let cachedAscent = 0;

function acquireLabelFont(
  ck: CanvasKit,
  fontMgr: FontMgr,
  size: number,
): Font | null {
  if (cachedFont && Math.abs(cachedFontSize - size) < 1e-6) {
    return cachedFont;
  }
  const typeface = resolveOverlayTypeface(fontMgr, {
    weight: ck.FontWeight.Normal,
    width: ck.FontWidth.Normal,
    slant: ck.FontSlant.Upright,
  });
  if (!typeface) return null;

  cachedFont?.delete();
  clearLabelBlobs();
  releasePicture();
  const font = new ck.Font(typeface, size);
  font.setSubpixel(true);
  const metrics = font.getMetrics();
  cachedAscent = metrics ? Math.abs(metrics.ascent) : size * 0.8;
  cachedFont = font;
  cachedFontSize = size;
  return font;
}

/**
 * 눈금자 Picture 캐시 (HC1 — 정지 프레임의 재작업 제거).
 *
 * 눈금자는 카메라의 순수 함수라, 카메라·가시영역·뷰포트 크기가 그대로면
 * **그린 결과도 그대로**다. 그런데 오버레이 패스는 매 프레임 돌기 때문에 그때마다
 * 같은 그림을 다시 그리게 된다 (실측 1.3ms/frame = 예산 7.7%).
 *
 * 같은 키면 기록해 둔 Picture 를 재생만 한다 — draw 콜 1회. 팬/줌 중에는 키가
 * 매 프레임 바뀌어 재기록하지만, 그 경우 종전과 같은 비용이고 정지 상태(대부분의
 * 프레임)가 사실상 공짜가 된다.
 */
let cachedPicture: SkPicture | null = null;
let cachedPictureKey = "";

function releasePicture(): void {
  cachedPicture?.delete();
  cachedPicture = null;
  cachedPictureKey = "";
}

/**
 * 틱 세그먼트 → Path (HC1 — WASM 왕복이 눈금자 비용의 지배 항목이다).
 *
 * `path.moveTo`/`lineTo` 는 호출마다 JS↔WASM 경계를 넘는다. 눈금은 프레임당
 * 수백 개라 그 경계 비용만으로 예산을 넘겼다 (실측 ~800회 = +1.6ms).
 * `Path.MakeFromCmds` 는 명령 배열 하나를 **한 번** 넘기므로 왕복이 1회다.
 *
 * 버퍼는 모듈 스코프에서 재사용한다 — 프레임마다 수천 원소 배열을 새로 만들면
 * GC 압력이 그대로 돌아온다.
 */
let cmdBuffer = new Float32Array(0);

function ensureCmdBuffer(floats: number): Float32Array {
  if (cmdBuffer.length < floats) {
    cmdBuffer = new Float32Array(Math.max(floats, 1024));
  }
  return cmdBuffer;
}

/**
 * 라벨 TextBlob 캐시 (HC1 — 이 캐시가 눈금자 프레임 비용의 지배 항목이다).
 *
 * `canvas.drawText` 는 호출마다 내부에서 blob 을 새로 만든다. 한 프레임에 라벨이
 * 수십 개라 그 비용이 프레임을 지배했다 (실측 배칭 후에도 +1.8ms = 예산 11%).
 * 라벨 문자열은 눈금 간격의 배수라 프레임 사이에 거의 그대로 재등장하므로,
 * blob 을 들고 있으면 정지 프레임은 사실상 공짜가 된다.
 *
 * blob 은 특정 Font 인스턴스에 묶이므로 폰트(=크기) 교체 시 통째로 버린다.
 */
const labelBlobs = new Map<string, TextBlob>();
const LABEL_BLOB_MAX = 256;

function clearLabelBlobs(): void {
  for (const blob of labelBlobs.values()) blob.delete();
  labelBlobs.clear();
}

function acquireLabelBlob(
  ck: CanvasKit,
  font: Font,
  text: string,
): TextBlob | null {
  const hit = labelBlobs.get(text);
  if (hit) return hit;
  if (labelBlobs.size >= LABEL_BLOB_MAX) clearLabelBlobs();
  const blob = ck.TextBlob.MakeFromText(text, font);
  if (!blob) return null;
  labelBlobs.set(text, blob);
  return blob;
}

function labelAscent(size: number): number {
  return cachedAscent > 0 ? cachedAscent : size * 0.8;
}

/**
 * 1-2-5×10^n 계열에서 `minSpan` 이상인 최소값 — 눈금자 관례 간격.
 */
export function niceInterval(minSpan: number): number {
  const span = Math.max(minSpan, 1e-6);
  const base = Math.pow(10, Math.floor(Math.log10(span)));
  for (const m of [1, 2, 5]) {
    if (base * m >= span) return base * m;
  }
  return base * 10;
}

export interface RulerTickPlan {
  /** 라벨이 붙는 주 눈금 간격 (scene 단위) */
  major: number;
  /** 보조 눈금 간격 (scene 단위). 0 이면 보조 눈금 생략 */
  minor: number;
}

/**
 * zoom 에 대한 눈금 간격 결정 — 카메라의 순수 함수 (테스트 대상).
 */
export function resolveTickPlan(zoom: number): RulerTickPlan {
  const safeZoom = zoom > 0 ? zoom : 1;
  const major = niceInterval(LABEL_MIN_SPACING_PX / safeZoom);
  const minor = major / MINOR_DIVISIONS;
  return {
    major,
    minor: minor * safeZoom >= MINOR_MIN_SPACING_PX ? minor : 0,
  };
}

export interface RulerRenderOptions {
  /** 카메라 pan (screen px) */
  cameraX: number;
  cameraY: number;
  zoom: number;
  /** 뷰포트 CSS 크기 (screen px — dpr 적용 전) */
  screenWidth: number;
  screenHeight: number;
  /**
   * 가시 영역 좌단/상단 오프셋 (screen px). 캔버스가 full-bleed 라 좌측 패널
   * 영역이 캔버스 좌단을 덮는다 — 스트립은 캔버스 좌단이 아니라 **보이는**
   * 좌단에 붙어야 한다 (`canvasViewportInset.ts`).
   */
  insetLeft?: number;
  insetTop?: number;
}

function acquireFill(ck: CanvasKit, alpha: number, paints: Paint[]): Paint {
  const paint = acquirePooledPaint(ck);
  paint.setAntiAlias(true);
  paint.setStyle(ck.PaintStyle.Fill);
  paint.setColor(ck.Color4f(RULER_R, RULER_G, RULER_B, alpha));
  paints.push(paint);
  return paint;
}

function acquireStroke(
  ck: CanvasKit,
  alpha: number,
  widthScene: number,
  paints: Paint[],
): Paint {
  const paint = acquirePooledPaint(ck);
  paint.setAntiAlias(false);
  paint.setStyle(ck.PaintStyle.Stroke);
  paint.setStrokeWidth(widthScene);
  paint.setColor(ck.Color4f(RULER_R, RULER_G, RULER_B, alpha));
  paints.push(paint);
  return paint;
}

/** 구간 안 눈금 개수 (버퍼 크기 산정용) */
function countTicks(
  from: number,
  to: number,
  step: number,
  visibleFrom: number,
): number {
  const start = Math.max(Math.ceil(from / step), Math.ceil(visibleFrom / step));
  const end = Math.floor(to / step);
  return Math.max(0, Math.min(end - start + 1, MAX_TICKS_PER_AXIS));
}

/**
 * 눈금 세그먼트를 명령 버퍼에 기록한다.
 * `horizontal=true` 면 세로 눈금(가로 자), false 면 가로 눈금(세로 자).
 */
function writeTicks(
  cmds: Float32Array,
  offset: number,
  ck: CanvasKit,
  from: number,
  to: number,
  step: number,
  visibleFrom: number,
  horizontal: boolean,
  base: number,
  len: number,
  collect?: number[],
): number {
  let w = offset;
  let n = Math.max(Math.ceil(from / step), Math.ceil(visibleFrom / step));
  const end = Math.floor(to / step);
  for (let i = 0; n <= end && i < MAX_TICKS_PER_AXIS; n++, i++) {
    const v = n * step;
    if (w + 6 > cmds.length) break;
    if (horizontal) {
      cmds[w++] = ck.MOVE_VERB; cmds[w++] = v; cmds[w++] = base - len;
      cmds[w++] = ck.LINE_VERB; cmds[w++] = v; cmds[w++] = base;
    } else {
      cmds[w++] = ck.MOVE_VERB; cmds[w++] = base - len; cmds[w++] = v;
      cmds[w++] = ck.LINE_VERB; cmds[w++] = base; cmds[w++] = v;
    }
    collect?.push(v);
  }
  return w;
}

/**
 * 눈금자 스트립을 그린다. 오버레이 패스 말미(씬 clip 밖)에서 호출된다.
 */
export function renderRulers(
  ck: CanvasKit,
  canvas: Canvas,
  options: RulerRenderOptions,
  fontMgr?: FontMgr,
): void {
  const key = `${options.zoom}|${options.cameraX}|${options.cameraY}|${options.insetLeft ?? 0}|${options.insetTop ?? 0}|${options.screenWidth}|${options.screenHeight}|${fontMgr ? 1 : 0}`;
  if (cachedPicture && key === cachedPictureKey) {
    canvas.drawPicture(cachedPicture);
    return;
  }

  releasePicture();
  const recorder = new ck.PictureRecorder();
  try {
    const recording = recorder.beginRecording(
      ck.LTRBRect(-1e7, -1e7, 1e7, 1e7),
    );
    drawRulers(ck, recording, options, fontMgr);
    const picture = recorder.finishRecordingAsPicture();
    cachedPicture = picture;
    cachedPictureKey = key;
    canvas.drawPicture(picture);
  } finally {
    recorder.delete();
  }
}

function drawRulers(
  ck: CanvasKit,
  canvas: Canvas,
  options: RulerRenderOptions,
  fontMgr?: FontMgr,
): void {
  const { cameraX, cameraY, screenWidth, screenHeight } = options;
  const zoom = options.zoom > 0 ? options.zoom : 1;
  if (screenWidth <= 0 || screenHeight <= 0) return;

  const invZoom = 1 / zoom;
  const strip = RULER_SIZE_PX * invZoom;

  // 화면 → 씬 역산 (미니맵 어법)
  const toSceneX = (sx: number): number => (sx - cameraX) * invZoom;
  const toSceneY = (sy: number): number => (sy - cameraY) * invZoom;

  // 스트립의 기준은 캔버스 좌상단이 아니라 **가시 영역**의 좌상단이다
  const originX = options.insetLeft ?? 0;
  const originY = options.insetTop ?? 0;
  if (originX >= screenWidth || originY >= screenHeight) return;

  const left = toSceneX(originX);
  const right = toSceneX(screenWidth);
  const top = toSceneY(originY);
  const bottom = toSceneY(screenHeight);

  const { major, minor } = resolveTickPlan(zoom);
  const paints: Paint[] = [];

  try {
    // ── 스트립 배경 ──
    // 겹치지 않게 나눈다 (translucent 끼리 겹치면 코너만 두 번 어두워진다).
    const stripPaint = acquireFill(ck, STRIP_ALPHA, paints);
    canvas.drawRect(ck.LTRBRect(left, top, right, top + strip), stripPaint);
    canvas.drawRect(
      ck.LTRBRect(left, top + strip, left + strip, bottom),
      stripPaint,
    );

    // ── 안쪽 경계선 ──
    const edgePaint = acquireStroke(ck, EDGE_ALPHA, invZoom, paints);
    canvas.drawLine(left, top + strip, right, top + strip, edgePaint);
    canvas.drawLine(left + strip, top + strip, left + strip, bottom, edgePaint);

    const minorPaint =
      minor > 0 ? acquireStroke(ck, TICK_ALPHA, invZoom, paints) : null;
    const majorPaint = acquireStroke(ck, MAJOR_TICK_ALPHA, invZoom, paints);
    const majorLen = MAJOR_TICK_LEN_PX * invZoom;
    const minorLen = MINOR_TICK_LEN_PX * invZoom;

    // 눈금은 스트립 **안쪽 모서리**에서 자란다 (Figma 어법)
    const xTickBase = top + strip;
    const yTickBase = left + strip;
    // 좌상단 코너는 두 스트립이 만나는 곳 — 눈금·라벨을 그리지 않는다
    const xVisibleFrom = left + strip;
    const yVisibleFrom = top + strip;

    // ── 보조 눈금 ──
    // 눈금 하나당 drawLine 을 부르면 프레임당 수백 콜이 된다 (실측 +2.4ms/frame
    // = 예산 14% — HC1 위반). 축별로 Path 하나에 모아 draw 콜을 2회로 줄인다.
    if (minorPaint) {
      const xCount = countTicks(left, right, minor, xVisibleFrom);
      const yCount = countTicks(top, bottom, minor, yVisibleFrom);
      const cmds = ensureCmdBuffer((xCount + yCount) * 6);
      let w = 0;
      w = writeTicks(cmds, w, ck, left, right, minor, xVisibleFrom, true, xTickBase, minorLen);
      w = writeTicks(cmds, w, ck, top, bottom, minor, yVisibleFrom, false, yTickBase, minorLen);
      if (w > 0) {
        const path = ck.Path.MakeFromCmds(cmds.subarray(0, w));
        if (path) {
          canvas.drawPath(path, minorPaint);
          path.delete();
        }
      }
    }

    // ── 주 눈금 ──
    const majorXs: number[] = [];
    const majorYs: number[] = [];
    {
      const xCount = countTicks(left, right, major, xVisibleFrom);
      const yCount = countTicks(top, bottom, major, yVisibleFrom);
      const cmds = ensureCmdBuffer((xCount + yCount) * 6);
      let w = 0;
      w = writeTicks(cmds, w, ck, left, right, major, xVisibleFrom, true, xTickBase, majorLen, majorXs);
      w = writeTicks(cmds, w, ck, top, bottom, major, yVisibleFrom, false, yTickBase, majorLen, majorYs);
      if (w > 0) {
        const path = ck.Path.MakeFromCmds(cmds.subarray(0, w));
        if (path) {
          canvas.drawPath(path, majorPaint);
          path.delete();
        }
      }
    }

    // ── 라벨 (fontMgr 미로드면 눈금만) ──
    if (!fontMgr) return;
    const fontSize = LABEL_FONT_SIZE_PX * invZoom;
    const font = acquireLabelFont(ck, fontMgr, fontSize);
    if (!font) return;
    const textPaint = acquireFill(ck, LABEL_ALPHA, paints);
    {
      const gap = LABEL_GAP_PX * invZoom;
      const ascent = labelAscent(fontSize);

      // 가로: 눈금 오른쪽에 baseline 정렬
      const xLabelY = xTickBase - majorLen - gap;
      for (const v of majorXs) {
        const blob = acquireLabelBlob(ck, font, tickLabel(v, major));
        if (blob) canvas.drawTextBlob(blob, v + gap, xLabelY, textPaint);
      }

      // 세로: 90° 회전 (좁은 스트립에 네 자리 수를 담기 위한 눈금자 관례)
      const yLabelX = yTickBase - majorLen - gap;
      for (const v of majorYs) {
        canvas.save();
        canvas.translate(yLabelX, v + gap);
        canvas.rotate(-90, 0, 0);
        const blob = acquireLabelBlob(ck, font, tickLabel(v, major));
        if (blob) canvas.drawTextBlob(blob, 0, ascent, textPaint);
        canvas.restore();
      }
    }
  } finally {
    for (const paint of paints) {
      releasePooledPaint(paint);
    }
  }
}

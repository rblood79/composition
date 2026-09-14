/**
 * ADR-219 P0 — G0 spike (test-only)
 *
 * 설계 (breakdown §2.3) 의 기하 규칙 세 가지가 **Chrome 픽셀과 맞는가** 를 구현
 * 전에 잰다. Skia 쪽은 프로덕션 경로가 아니라 CanvasKit 에 직접 그린 **프로토타입**
 * 이다 — 이 파일의 기하 함수가 P1 `borderGeometry.ts` / P2 렌더러의 원형이 된다.
 * 그래서 이 파일은 parity leg 이 아니라 환경 probe 와 같은 부류다 (`productionPath`
 * 의 DRAW_ALLOWLIST) — 산출물은 어떤 parity 판정에도 입력되지 않고, 프로덕션 결선은
 * P2 가 production leg (G1/G2) 으로 따로 잰다.
 *
 * 세 케이스 (G0):
 *   1. `even-odd`   — 임의 폭 4값 + 비균일 반경 4값 + solid: 바깥 rrect − 안쪽 rrect
 *                     (안쪽 rx = r − 세로변 폭, ry = r − 가로변 폭) even-odd 채움
 *   2. `css-scale`  — `[80,0,0,0]` (축소 없음 · 현행 clamp 는 50 으로 자른다) 와
 *                     `[80,80,0,0]` (CSS §4.5 비례 축소 → 45) 두 상자
 *   3. `mask-alpha` — 반투명 색 변 마스크 (top·right 만, 인접 변 on): even-odd 로
 *                     그리면 코너 호가 한 번만 칠해진다. 현행 `renderPartialBorder`
 *                     식 (변마다 호 전체 · 폭 일정) 도 같이 재서 격차를 남긴다
 *
 * Preview leg 은 프로덕션 (`PreviewDriver`) 이고 longhand 를 그대로 그린다.
 * 프로덕션 Skia leg 도 같이 돌려 **before** 수치를 남긴다 — P2 gate 의 기준선이다.
 *
 * 판정: 요소 상자 region 에서 pixelmatch diffRatio ≤ 0.02 (198 `edge` 예산, G0
 * "region ≥ 0.98"). 통과시키려고 예산을 넓히지 않는다 — 넘으면 넘은 값을 기록한다.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CanvasKit } from "canvaskit-wasm";
import pixelmatch from "pixelmatch";
import type { CompositionDocument } from "@composition/shared";

import { buildPath } from "@/builder/workspace/canvas/skia/buildPath";
import { initCanvasKit } from "@/builder/workspace/canvas/skia/initCanvasKit";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";

import { CASE_PROJECT_ID } from "../cases/scaffold";
import { captureEnvironment } from "../harness/identity";
import { byteDiff } from "../harness/pixels";
import { PreviewDriver } from "../harness/previewDriver";
import { runSkiaLeg } from "../harness/skiaRunner";
import type { Rect } from "../harness/types";

type Radii = [number, number, number, number]; // tl tr br bl
type Widths = [number, number, number, number]; // t r b l

/** 198 `edge` 예산 — G0 "region ≥ 0.98" */
const MAX_DIFF_RATIO = 0.02;

const BLUE = "#2F6FEDFF";
const NAVY = "#102A5CFF";
const NAVY_HALF = "rgba(16, 42, 92, 0.5)";

// ── 기하 프로토타입 (P1 helper 의 원형) ─────────────────────────────

/**
 * CSS Backgrounds 3 §4.5 corner-overlap — 변마다 `L / (r_a + r_b)`, 최소값을
 * 전체 반경에 곱한다. 균일 r 에서는 `min(w,h)/2r` 라 현행 clamp 와 같은 값.
 */
function resolveCssCornerRadii(r: Radii, w: number, h: number): Radii {
  const [tl, tr, br, bl] = r.map((v) => Math.max(0, v)) as Radii;
  const f = Math.min(
    1,
    w / (tl + tr),
    w / (bl + br),
    h / (tl + bl),
    h / (tr + br),
  );
  return [tl * f, tr * f, br * f, bl * f];
}

/** CanvasKit 12-float rrect — [L,T,R,B, tlx,tly, trx,try, brx,bry, blx,bly] */
function rrect12(
  x: number,
  y: number,
  w: number,
  h: number,
  rx: Radii,
  ry: Radii,
): Float32Array {
  return Float32Array.of(
    x,
    y,
    x + w,
    y + h,
    rx[0],
    ry[0],
    rx[1],
    ry[1],
    rx[2],
    ry[2],
    rx[3],
    ry[3],
  );
}

/**
 * 안쪽 (padding box) 반경 — 코너의 가로 반경은 세로변 폭, 세로 반경은 가로변 폭을
 * 뺀다 (TL: rx = r − left, ry = r − top). Blink `BoxBorderPainter` 와 같은 기하.
 */
function innerRRect(
  x: number,
  y: number,
  w: number,
  h: number,
  r: Radii,
  bw: Widths,
): Float32Array {
  const [t, rt, b, l] = bw;
  const rx: Radii = [
    Math.max(0, r[0] - l),
    Math.max(0, r[1] - rt),
    Math.max(0, r[2] - rt),
    Math.max(0, r[3] - l),
  ];
  const ry: Radii = [
    Math.max(0, r[0] - t),
    Math.max(0, r[1] - t),
    Math.max(0, r[2] - b),
    Math.max(0, r[3] - b),
  ];
  return rrect12(x + l, y + t, w - l - rt, h - t - b, rx, ry);
}

function parseRgba(css: string): [number, number, number, number] {
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b, a = "1"] = m[1].split(",").map((s) => s.trim());
    return [Number(r) / 255, Number(g) / 255, Number(b) / 255, Number(a)];
  }
  const hex = css.replace("#", "");
  const n = parseInt(hex.slice(0, 6), 16);
  const a = hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, a];
}

interface BoxSpec {
  box: Rect;
  fill: string;
  radii: Radii;
  widths: Widths;
  borderColor?: string;
}

/** 배경 (border-box clip — 테두리 아래까지) + 테두리 띠 even-odd */
function drawBoxEvenOdd(ck: CanvasKit, canvas: unknown, spec: BoxSpec): void {
  const cv = canvas as import("canvaskit-wasm").Canvas;
  const { x, y, width: w, height: h } = spec.box;
  const r = resolveCssCornerRadii(spec.radii, w, h);
  const outer = rrect12(x, y, w, h, r, r);

  const fill = new ck.Paint();
  fill.setAntiAlias(true);
  fill.setColor(ck.Color4f(...parseRgba(spec.fill)));
  cv.drawRRect(outer, fill);
  fill.delete();

  if (spec.borderColor && spec.widths.some((v) => v > 0)) {
    const path = buildPath(ck, (p) => {
      p.addRRect(outer);
      p.addRRect(innerRRect(x, y, w, h, r, spec.widths));
      p.setFillType(ck.FillType.EvenOdd);
    });
    const border = new ck.Paint();
    border.setAntiAlias(true);
    border.setColor(ck.Color4f(...parseRgba(spec.borderColor)));
    cv.drawPath(path, border);
    border.delete();
    path.delete();
  }
}

/**
 * 현행 `renderPartialBorder` 식 (nodeRendererShapes.ts:93-164) 의 재현 — on 인 변마다
 * 폭 `w` 로 stroke 하고 인접 코너 호를 **각 변이 전체로** 그린다. 반투명에서 코너가
 * 두 번 칠해지는 것을 실측하기 위한 대조군이다.
 */
function drawBoxPartialStroke(
  ck: CanvasKit,
  canvas: unknown,
  spec: BoxSpec,
): void {
  const cv = canvas as import("canvaskit-wasm").Canvas;
  const { x, y, width: w, height: h } = spec.box;
  const r = resolveCssCornerRadii(spec.radii, w, h);

  const fill = new ck.Paint();
  fill.setAntiAlias(true);
  fill.setColor(ck.Color4f(...parseRgba(spec.fill)));
  cv.drawRRect(rrect12(x, y, w, h, r, r), fill);
  fill.delete();

  const sw = Math.max(...spec.widths);
  const inset = sw / 2;
  const ir: Radii = r.map((v) => Math.max(0, v - inset)) as Radii;
  const L = x + inset;
  const T = y + inset;
  const R = x + w - inset;
  const B = y + h - inset;
  const [top, right, bottom, left] = spec.widths.map((v) => v > 0);

  const paint = new ck.Paint();
  paint.setAntiAlias(true);
  paint.setStyle(ck.PaintStyle.Stroke);
  paint.setStrokeWidth(sw);
  paint.setColor(ck.Color4f(...parseRgba(spec.borderColor ?? NAVY)));

  const stroke = (build: Parameters<typeof buildPath>[1]) => {
    const p = buildPath(ck, build);
    cv.drawPath(p, paint);
    p.delete();
  };
  if (top)
    stroke((p) => {
      p.moveTo(L, T + ir[0]);
      if (ir[0] > 0) p.arcToTangent(L, T, L + ir[0], T, ir[0]);
      p.lineTo(R - ir[1], T);
      if (ir[1] > 0) p.arcToTangent(R, T, R, T + ir[1], ir[1]);
    });
  if (right)
    stroke((p) => {
      p.moveTo(R - ir[1], T);
      if (ir[1] > 0) p.arcToTangent(R, T, R, T + ir[1], ir[1]);
      p.lineTo(R, B - ir[2]);
      if (ir[2] > 0) p.arcToTangent(R, B, R - ir[2], B, ir[2]);
    });
  if (bottom)
    stroke((p) => {
      p.moveTo(R, B - ir[2]);
      if (ir[2] > 0) p.arcToTangent(R, B, R - ir[2], B, ir[2]);
      p.lineTo(L + ir[3], B);
      if (ir[3] > 0) p.arcToTangent(L, B, L, B - ir[3], ir[3]);
    });
  if (left)
    stroke((p) => {
      p.moveTo(L + ir[3], B);
      if (ir[3] > 0) p.arcToTangent(L, B, L, B - ir[3], ir[3]);
      p.lineTo(L, T + ir[0]);
      if (ir[0] > 0) p.arcToTangent(L, T, L + ir[0], T, ir[0]);
    });
  paint.delete();
}

function renderSpike(
  ck: CanvasKit,
  width: number,
  height: number,
  draw: (canvas: unknown) => void,
): Uint8Array {
  const surface = ck.MakeSurface(width, height);
  if (!surface) throw new Error("MakeSurface 실패");
  try {
    const canvas = surface.getCanvas();
    canvas.clear(ck.Color4f(1, 1, 1, 1));
    draw(canvas);
    surface.flush();
    const image = surface.makeImageSnapshot();
    const px = image.readPixels(0, 0, {
      width,
      height,
      colorType: ck.ColorType.RGBA_8888,
      alphaType: ck.AlphaType.Unpremul,
      colorSpace: ck.ColorSpace.SRGB,
    }) as Uint8Array | null;
    image.delete();
    if (!px) throw new Error("readPixels 실패");
    return new Uint8Array(px);
  } finally {
    surface.delete();
  }
}

// ── 문서 ─────────────────────────────────────────────────────────────

interface SpikeCase {
  id: string;
  viewport: { width: number; height: number };
  document: CompositionDocument;
  pageId: string;
  /** 요소 id → 프로토타입 입력 (상자는 Preview geometry 로 채운다) */
  boxes: Record<string, Omit<BoxSpec, "box">>;
}

function doc(
  prefix: string,
  width: number,
  height: number,
  children: unknown[],
): { document: CompositionDocument; pageId: string } {
  const pageId = `${prefix}-page`;
  return {
    pageId,
    document: {
      version: "composition-1.0",
      children: [
        {
          id: pageId,
          type: "frame",
          metadata: { type: "legacy-page", pageId },
          children: [
            {
              id: `${prefix}-body`,
              type: "body",
              props: {
                style: {
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: "20px",
                  width: `${width}px`,
                  height: `${height}px`,
                  paddingTop: "20px",
                  paddingRight: "20px",
                  paddingBottom: "20px",
                  paddingLeft: "20px",
                  backgroundColor: "#FFFFFFFF",
                  boxSizing: "border-box",
                },
              },
              children,
            },
          ],
        },
      ],
    } as unknown as CompositionDocument,
  };
}

const px = (n: number) => `${n}px`;
const sides = (w: Widths, color: string) => ({
  borderTopWidth: px(w[0]),
  borderRightWidth: px(w[1]),
  borderBottomWidth: px(w[2]),
  borderLeftWidth: px(w[3]),
  borderTopStyle: "solid",
  borderRightStyle: "solid",
  borderBottomStyle: "solid",
  borderLeftStyle: "solid",
  borderTopColor: color,
  borderRightColor: color,
  borderBottomColor: color,
  borderLeftColor: color,
});
const corners = (r: Radii) => ({
  borderTopLeftRadius: px(r[0]),
  borderTopRightRadius: px(r[1]),
  borderBottomRightRadius: px(r[2]),
  borderBottomLeftRadius: px(r[3]),
});

const EVEN_ODD_R: Radii = [24, 8, 32, 0];
const EVEN_ODD_W: Widths = [2, 10, 6, 14];
const MASK_R: Radii = [20, 20, 20, 20];
const MASK_W: Widths = [6, 6, 0, 0];

const CASES: SpikeCase[] = ((): SpikeCase[] => {
  const a = doc("adr219a", 240, 180, [
    {
      id: "adr219a-box",
      type: "frame",
      props: {
        style: {
          display: "block",
          width: "160px",
          height: "110px",
          backgroundColor: BLUE,
          boxSizing: "border-box",
          ...corners(EVEN_ODD_R),
          ...sides(EVEN_ODD_W, NAVY),
        },
      },
    },
  ]);
  const b = doc("adr219b", 240, 140, [
    {
      id: "adr219b-one",
      type: "frame",
      props: {
        style: {
          display: "block",
          width: "90px",
          height: "90px",
          backgroundColor: BLUE,
          boxSizing: "border-box",
          borderRadius: "80px 0 0 0",
        },
      },
    },
    {
      id: "adr219b-two",
      type: "frame",
      props: {
        style: {
          display: "block",
          width: "90px",
          height: "90px",
          backgroundColor: BLUE,
          boxSizing: "border-box",
          borderRadius: "80px 80px 0 0",
        },
      },
    },
  ]);
  const c = doc("adr219c", 240, 180, [
    {
      id: "adr219c-box",
      type: "frame",
      props: {
        style: {
          display: "block",
          width: "160px",
          height: "110px",
          backgroundColor: BLUE,
          boxSizing: "border-box",
          ...corners(MASK_R),
          ...sides(MASK_W, NAVY_HALF),
        },
      },
    },
  ]);
  return [
    {
      id: "even-odd",
      viewport: { width: 240, height: 180 },
      ...a,
      boxes: {
        "adr219a-box": {
          fill: BLUE,
          radii: EVEN_ODD_R,
          widths: EVEN_ODD_W,
          borderColor: NAVY,
        },
      },
    },
    {
      id: "css-scale",
      viewport: { width: 240, height: 140 },
      ...b,
      boxes: {
        "adr219b-one": {
          fill: BLUE,
          radii: [80, 0, 0, 0],
          widths: [0, 0, 0, 0],
        },
        "adr219b-two": {
          fill: BLUE,
          radii: [80, 80, 0, 0],
          widths: [0, 0, 0, 0],
        },
      },
    },
    {
      id: "mask-alpha",
      viewport: { width: 240, height: 180 },
      ...c,
      boxes: {
        "adr219c-box": {
          fill: BLUE,
          radii: MASK_R,
          widths: MASK_W,
          borderColor: NAVY_HALF,
        },
      },
    },
  ];
})();

// ── 측정 ─────────────────────────────────────────────────────────────

function crop(pixels: Uint8Array, frameWidth: number, box: Rect): Uint8Array {
  const x = Math.round(box.x);
  const y = Math.round(box.y);
  const w = Math.round(box.width);
  const h = Math.round(box.height);
  const out = new Uint8Array(w * h * 4);
  for (let row = 0; row < h; row++) {
    const src = ((y + row) * frameWidth + x) * 4;
    out.set(pixels.subarray(src, src + w * 4), row * w * 4);
  }
  return out;
}

interface Metric {
  diffRatio: number;
  maxByte: number;
  meanByte: number;
}

function measure(
  a: Uint8Array,
  b: Uint8Array,
  frameWidth: number,
  box: Rect,
): Metric {
  const ca = crop(a, frameWidth, box);
  const cb = crop(b, frameWidth, box);
  const w = Math.round(box.width);
  const h = Math.round(box.height);
  const diff = pixelmatch(
    new Uint8ClampedArray(ca.buffer.slice(0)),
    new Uint8ClampedArray(cb.buffer.slice(0)),
    undefined,
    w,
    h,
    { threshold: 0.1 },
  );
  const d = byteDiff(ca, cb);
  return {
    diffRatio: diff / (w * h),
    maxByte: d.maxByte,
    meanByte: d.meanByte,
  };
}

const fmt = (m: Metric) =>
  `ratio=${m.diffRatio.toFixed(5)} maxByte=${m.maxByte} mean=${m.meanByte.toFixed(2)}`;

let ck: CanvasKit;

describe("ADR-219 P0 — G0 spike (프로토타입 기하 ↔ Preview)", () => {
  beforeAll(async () => {
    ck = await initCanvasKit();
    await initCompositionEngineWasm();
  }, 180_000);

  for (const c of CASES) {
    describe(c.id, () => {
      let driver: PreviewDriver;
      let previewPixels: Uint8Array;
      let geometry: Record<string, Rect>;
      let spike: Uint8Array;
      let before: Uint8Array;
      let partial: Uint8Array | null = null;
      const results: Record<string, Record<string, Metric>> = {};

      beforeAll(async () => {
        const env = captureEnvironment({
          canvasKitVersion: "0.42.0",
          surfaceBackend: "gl",
          viewport: c.viewport,
          theme: "light",
        });
        driver = new PreviewDriver();
        await driver.start(c.viewport);
        const rendered = await driver.render(c.document, CASE_PROJECT_ID, env);
        const shot = await driver.capture();
        const rect = driver.element.getBoundingClientRect();
        expect(shot.width).toBe(Math.round(rect.width));
        previewPixels = shot.pixels;
        geometry = rendered.geometry;

        // 프로토타입 — Preview 의 실측 상자에 그린다 (레이아웃 축은 이 spike 의 대상이 아니다)
        const draw = (fn: typeof drawBoxEvenOdd) => (canvas: unknown) => {
          for (const [id, spec] of Object.entries(c.boxes)) {
            const box = geometry[id];
            if (!box) throw new Error(`Preview geometry 에 ${id} 없음`);
            fn(ck, canvas, { ...spec, box });
          }
        };
        spike = renderSpike(
          ck,
          c.viewport.width,
          c.viewport.height,
          draw(drawBoxEvenOdd),
        );
        if (c.id === "mask-alpha")
          partial = renderSpike(
            ck,
            c.viewport.width,
            c.viewport.height,
            draw(drawBoxPartialStroke),
          );

        // before — 프로덕션 Skia leg 그대로 (P2 기준선)
        before = runSkiaLeg(ck, c.document, {
          pageId: c.pageId,
          width: c.viewport.width,
          height: c.viewport.height,
          projectId: CASE_PROJECT_ID,
        }).pixels;

        for (const id of Object.keys(c.boxes)) {
          const box = geometry[id];
          results[id] = {
            spike: measure(spike, previewPixels, c.viewport.width, box),
            before: measure(before, previewPixels, c.viewport.width, box),
          };
          if (partial)
            results[id].partial = measure(
              partial,
              previewPixels,
              c.viewport.width,
              box,
            );
        }
      }, 240_000);

      afterAll(async () => {
        try {
          const { server } = await import("vitest/browser");
          await server.commands.writeFile(
            `tests/visual-parity/.artifacts/adr219-spike-${c.id}.json`,
            JSON.stringify({ case: c.id, geometry, results }, null, 2),
          );
        } finally {
          driver?.stop();
        }
      }, 60_000);

      it("Preview 가 요소를 그렸다", () => {
        for (const id of Object.keys(c.boxes)) {
          expect(geometry[id], `${id} geometry`).toBeTruthy();
          expect(geometry[id].width).toBeGreaterThan(0);
        }
      });

      it("프로토타입 기하 ↔ Preview: 요소 region diffRatio ≤ 0.02 (G0)", () => {
        for (const [id, m] of Object.entries(results)) {
          console.log(
            `[ADR-219 G0] ${c.id} ${id}: spike ${fmt(m.spike)} | before ${fmt(m.before)}` +
              (m.partial ? ` | partial-stroke ${fmt(m.partial)}` : ""),
          );
          expect(m.spike.diffRatio, `${id} spike`).toBeLessThanOrEqual(
            MAX_DIFF_RATIO,
          );
        }
      });
    });
  }
});

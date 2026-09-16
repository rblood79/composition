/**
 * ADR-219 G2 — 비균일 border 의 Skia ↔ Preview 대칭 (프로덕션 두 leg)
 *
 * P0 spike (`borderGeometrySpike`) 가 기하 식을 프로토타입으로 증명했다면, 여기는
 * **프로덕션 Skia 경로** (`runSkiaLeg` — buildBoxNodeData → renderBox) 가 같은 문서를
 * Preview 와 같은 픽셀로 그리는지 잰다. 직접 그리는 코드 0 (productionPath R3).
 *
 * 케이스 10 (통과 조건) + 1 (측정만) — breakdown §4 G2:
 *   반경 4값 ×2 (solid 테두리 / 테두리 없음, 그중 1 은 비례 축소 `[80,80,0,0]`) ·
 *   변 마스크 ×4 (solid 2 — 반투명 1 포함 · dashed 1 · dotted 1) ·
 *   임의 폭 4값 ×2 (solid · dashed) · 반경+폭 혼합 ×2 ·
 *   [측정만] 변 마스크 + double (미지원 — Skia 는 solid 강등, 기록된 비대칭)
 *
 * 판정: 요소 상자 region 의 pixelmatch diffRatio — solid ≤ 0.02 (198 edge 예산),
 * dashed/dotted ≤ 0.05 (③ 근사, ADR HC2 0.95). 예산을 넓혀 통과시키지 않는다.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CanvasKit } from "canvaskit-wasm";
import pixelmatch from "pixelmatch";
import type { CompositionDocument } from "@composition/shared";

import { initCanvasKit } from "@/builder/workspace/canvas/skia/initCanvasKit";
import { initEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/engineWasm";

import { CASE_PROJECT_ID } from "../cases/scaffold";
import { captureEnvironment } from "../harness/identity";
import { byteDiff } from "../harness/pixels";
import { PreviewDriver } from "../harness/previewDriver";
import { runSkiaLeg } from "../harness/skiaRunner";
import type { Rect } from "../harness/types";

type Radii = [number, number, number, number];
type Widths = [number, number, number, number];

const BUDGET = { solid: 0.02, dashed: 0.05, measureOnly: Infinity } as const;

const BLUE = "#2F6FEDFF";
const NAVY = "#102A5CFF";
const NAVY_HALF = "rgba(16, 42, 92, 0.5)";

const px = (n: number) => `${n}px`;
const sides = (w: Widths, color: string, style = "solid") => ({
  borderTopWidth: px(w[0]),
  borderRightWidth: px(w[1]),
  borderBottomWidth: px(w[2]),
  borderLeftWidth: px(w[3]),
  borderStyle: style,
  borderColor: color,
});
const corners = (r: Radii) => ({
  borderTopLeftRadius: px(r[0]),
  borderTopRightRadius: px(r[1]),
  borderBottomRightRadius: px(r[2]),
  borderBottomLeftRadius: px(r[3]),
});

interface ParityCase {
  id: string;
  budget: keyof typeof BUDGET;
  style: Record<string, string>;
  size?: { width: number; height: number };
}

const CASES: ParityCase[] = [
  {
    id: "radii4-solid",
    budget: "solid",
    style: {
      ...corners([24, 8, 32, 0]),
      borderWidth: "2px",
      borderStyle: "solid",
      borderColor: NAVY,
    },
  },
  {
    id: "radii4-scale-noborder",
    budget: "solid",
    style: { borderRadius: "80px 80px 0 0" },
    size: { width: 100, height: 100 },
  },
  {
    id: "mask-solid-top-left",
    budget: "solid",
    style: { borderRadius: "12px", ...sides([4, 0, 0, 4], NAVY) },
  },
  {
    id: "mask-solid-alpha-top-right",
    budget: "solid",
    style: { borderRadius: "20px", ...sides([6, 6, 0, 0], NAVY_HALF) },
  },
  {
    id: "mask-dashed-bottom",
    budget: "dashed",
    style: { borderRadius: "8px", ...sides([0, 0, 3, 0], NAVY, "dashed") },
  },
  {
    id: "mask-dotted-left-right",
    budget: "dashed",
    style: { borderRadius: "0px", ...sides([0, 4, 0, 4], NAVY, "dotted") },
  },
  {
    id: "widths4-solid",
    budget: "solid",
    style: { ...corners([24, 8, 32, 0]), ...sides([2, 10, 6, 14], NAVY) },
  },
  {
    id: "widths4-dashed",
    budget: "dashed",
    style: { borderRadius: "12px", ...sides([2, 6, 4, 8], NAVY, "dashed") },
  },
  {
    id: "mixed-top-corners",
    budget: "solid",
    style: { ...corners([16, 16, 0, 0]), ...sides([4, 4, 0, 0], NAVY) },
  },
  {
    id: "mixed-alpha-right-corners",
    budget: "solid",
    style: { ...corners([0, 12, 12, 0]), ...sides([1, 3, 5, 7], NAVY_HALF) },
  },
  {
    // 대조군 — 균일 dashed (종전 경로). 변별 dashed 근사가 균일 근사보다 나쁜지 본다.
    id: "control-uniform-dashed",
    budget: "measureOnly",
    style: {
      borderRadius: "12px",
      borderWidth: "4px",
      borderStyle: "dashed",
      borderColor: NAVY,
    },
  },
  {
    // 미지원 조합 — Skia 는 solid 강등 (HC2 기록된 비대칭). 수치만 남긴다.
    id: "mask-double-unsupported",
    budget: "measureOnly",
    style: { borderRadius: "8px", ...sides([4, 0, 4, 0], NAVY, "double") },
  },
];

function doc(c: ParityCase): {
  document: CompositionDocument;
  pageId: string;
  boxId: string;
} {
  const prefix = `adr219g2-${c.id}`;
  const pageId = `${prefix}-page`;
  const boxId = `${prefix}-box`;
  const size = c.size ?? { width: 160, height: 110 };
  return {
    pageId,
    boxId,
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
                  display: "block",
                  width: "240px",
                  height: "180px",
                  paddingTop: "20px",
                  paddingRight: "20px",
                  paddingBottom: "20px",
                  paddingLeft: "20px",
                  backgroundColor: "#FFFFFFFF",
                  boxSizing: "border-box",
                },
              },
              children: [
                {
                  id: boxId,
                  type: "frame",
                  props: {
                    style: {
                      display: "block",
                      width: px(size.width),
                      height: px(size.height),
                      backgroundColor: BLUE,
                      boxSizing: "border-box",
                      ...c.style,
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    } as unknown as CompositionDocument,
  };
}

const VIEWPORT = { width: 240, height: 180 };

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

function measure(a: Uint8Array, b: Uint8Array, box: Rect) {
  const ca = crop(a, VIEWPORT.width, box);
  const cb = crop(b, VIEWPORT.width, box);
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

let ck: CanvasKit;

describe("ADR-219 G2 — 비균일 border Skia ↔ Preview (프로덕션 두 leg)", () => {
  let driver: PreviewDriver;
  const results: Record<string, ReturnType<typeof measure>> = {};

  beforeAll(async () => {
    ck = await initCanvasKit();
    await initEngineWasm();
    driver = new PreviewDriver();
    await driver.start(VIEWPORT);
  }, 180_000);

  afterAll(async () => {
    try {
      const { server } = await import("vitest/browser");
      await server.commands.writeFile(
        "tests/visual-parity/.artifacts/adr219-g2.json",
        JSON.stringify(results, null, 2),
      );
    } finally {
      driver?.stop();
    }
  }, 60_000);

  for (const c of CASES) {
    it(`${c.id} — diffRatio ≤ ${BUDGET[c.budget]}`, async () => {
      const { document, pageId, boxId } = doc(c);
      const env = captureEnvironment({
        canvasKitVersion: "0.42.0",
        surfaceBackend: "gl",
        viewport: VIEWPORT,
        theme: "light",
      });
      const rendered = await driver.render(document, CASE_PROJECT_ID, env);
      const shot = await driver.capture();
      expect(shot.width).toBe(VIEWPORT.width);
      const box = rendered.geometry[boxId];
      expect(box, `Preview geometry ${boxId}`).toBeTruthy();

      const skia = runSkiaLeg(ck, document, {
        pageId,
        width: VIEWPORT.width,
        height: VIEWPORT.height,
        projectId: CASE_PROJECT_ID,
      });
      const skiaBox = skia.geometry[boxId];
      expect(skiaBox, `Skia geometry ${boxId}`).toBeTruthy();
      expect(Math.abs(skiaBox.x - box.x)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(skiaBox.y - box.y)).toBeLessThanOrEqual(0.5);

      const m = measure(skia.pixels, shot.pixels, box);
      results[c.id] = m;
      // 진단용 PNG (base64) — 통과해도 남긴다 (browser 러너는 통과 콘솔을 숨긴다)
      const { server } = await import("vitest/browser");
      const b64 = (bytes: Uint8Array) => {
        let bin = "";
        for (let i = 0; i < bytes.length; i++)
          bin += String.fromCharCode(bytes[i]);
        return btoa(bin);
      };
      await server.commands.writeFile(
        `tests/visual-parity/.artifacts/adr219-g2-${c.id}.skia.png.b64`,
        b64(skia.png),
      );
      await server.commands.writeFile(
        `tests/visual-parity/.artifacts/adr219-g2-${c.id}.preview.png.b64`,
        b64(shot.png),
      );
      console.log(
        `[ADR-219 G2] ${c.id}: ratio=${m.diffRatio.toFixed(5)} maxByte=${m.maxByte} mean=${m.meanByte.toFixed(2)}` +
          (c.budget === "measureOnly" ? " (측정만 — 미지원 조합)" : ""),
      );
      if (c.budget !== "measureOnly") {
        expect(m.diffRatio, c.id).toBeLessThanOrEqual(BUDGET[c.budget]);
      }
    }, 120_000);
  }
});

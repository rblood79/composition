/**
 * ADR-198 Phase 4b — cross-leg 예산 교정 (G3 positive)
 *
 * Phase 4a 는 계측기가 **무엇을 잡는지**를 같은 leg 두 번으로 증명했다. 여기는
 * 그 계측기를 원래 목적에 쓴다 — **Skia 와 Preview 를 실제로 맞대고**, 선언된
 * region 예산이 실제 격차를 담는지 본다.
 *
 * ## 이 파일이 조심하는 것
 *
 * Phase 4 를 4a/4b 로 쪼갠 이유가 여기 있다. 착수 시점 실측에서 두 leg 격차가
 * 예산의 76~304배였고 (maxByte 234~239), 그 상태에서 G3 를 "통과" 시키는 길은
 * 두 개뿐이었다 — 예산을 격차만큼 넓히거나, 발산을 고치거나. 전자는 게이트를
 * vacuous 하게 만든다 (R5). 사용자 결정으로 후자를 택했고, 그 발산은
 * `657d80467` 에서 수리됐다 (frame 배경 미방출 + hex8 채널 시프트).
 *
 * 그러므로 이 파일의 규율은 하나다: **예산은 실측이 정하되, 통과시키려고
 * 넓히지 않는다.** 남은 격차가 예산을 넘으면 그것은 예산 부족이 아니라 발견이고,
 * 넘은 값을 그대로 기록한다 (measurement-validity §1 Q2).
 *
 * ## 두 leg 이 원래 다를 수 있는 자리
 *
 * Skia 와 Chromium 은 다른 rasterizer 다. 같아야 하는 곳과 달라도 되는 곳을
 * region kind 로 미리 갈라 두었다 (`INITIAL_BUDGETS`):
 *
 * - `non-text` 단색 채움 — 사실상 같아야 한다 (Phase 0 실측: solid/gradient maxByte 0)
 * - `edge` AA·clip 경계 밴드 — 다르다 (Phase 0 실측: AA 59, clip 25)
 * - `text` — hinting/subpixel 로 가장 크다
 * - `raster` — 디코드/샘플링 차이
 *
 * kind 가 예산을 정하므로, **region kind 를 바꿔서 통과시키는 것도 예산을 넓히는
 * 것과 같다.** 케이스의 region 선언은 이 파일에서 건드리지 않는다.
 */

import { beforeAll, afterAll, describe, expect, it } from "vitest";
import type { CanvasKit } from "canvaskit-wasm";

import { initCanvasKit } from "@/builder/workspace/canvas/skia/initCanvasKit";
import { initCompositionEngineWasm } from "@/builder/workspace/canvas/wasm-bindings/compositionEngineWasm";

import { PILOT_CASES } from "../cases";
import { CASE_PROJECT_ID } from "../cases/scaffold";
import { runSkiaLegResult } from "../harness/skiaRunner";
import { PreviewDriver } from "../harness/previewDriver";
import { captureEnvironment } from "../harness/identity";
import { compareLegs, type ParityReport } from "../harness/compare";
import { byteDiff } from "../harness/pixels";
import type { LegResult, Rect, VisualParityCase } from "../harness/types";

/**
 * **케이스별 현재 판정을 못박는다.** 예산을 넓혀 초록을 만들지 않기 위한 장치이며
 * (R5), 발산이 고쳐지면 목록이 줄어 단언이 깨지고 기록 갱신을 강제한다.
 *
 * | 케이스 | 상태 (2026-08-31) |
 * | --- | --- |
 * | `basic-geometry-paint` | **통과** — 선언 예산 그대로 L3 pass. 잔여는 모서리 arc 의 AA(`maxByte 96`)뿐이고 비율이 0.00068 로 예산(0.001) 안이라 HC6 의 AND 조항이 막지 않는다 |
 * | `catalog-state-paint` | L1 통과 (2026-09-05) — (2026-08-31) 버튼이 x 140px / y 55px 어긋났다 → **ADR-923 Phase 5 (2026-09-02)** 로 위치 발산 0. 남아 있던 Button **폭** Δ2.66 / Δ2.80px 는 "텍스트 측정, ADR-923 범위 밖" 으로 기록돼 있었으나 실제 병인은 **하니스 폰트 비대칭**이었다 (Skia leg 은 앱 폰트 없는 tester 페이지, Preview leg 은 폰트 실은 iframe — `harness/setupFonts.ts`). tester 에 같은 폰트를 실으니 L1 이 통과했고, **그때부터 픽셀 층이 처음으로 실행된다** — 아래 5 region 은 새 발산이 아니라 L1 에 가려 한 번도 안 돌던 층의 첫 측정값이다 |
 * | `text-raster-resources` | text 2종 + `image-raster` (ratio 0.914) |
 *
 * basic 이 통과로 바뀐 경위: 착수 시점엔 세 region 이 `maxByte 145` 로 막혀 있었고
 * 그건 예산 문제가 아니라 **Skia 가 프레임 테두리를 아예 안 그리던 결함**이었다
 * (같은 자리에서 배경도 안 그리고 있었다 — `FrameSpec.render.shapes()`). 고친 뒤
 * 예산은 한 줄도 건드리지 않은 채 통과했다.
 *
 * 남은 것은 원인 미규명이다(text/raster · catalog 픽셀). `catalog-state-paint` 의 픽셀 층
 * 5 region 은 2026-09-05 이 처음 측정이며 `button-disabled-fill` 0.899 는 **90% 픽셀이
 * 다르다** — 예산 문제가 아니라 disabled Button 채우기의 실제 시각 발산으로 보인다.
 * 별도 조사 대상이며 여기서는 값을 못박아 두어 좋아지거나 나빠지면 드러나게 한다.
 */
const KNOWN_OVER_BUDGET: Record<string, string[]> = {
  "basic-geometry-paint": [],
  // 2026-09-05 하니스 폰트 수리로 L1 이 통과하면서 픽셀 층이 처음 돌았다. 아래는 그
  // 첫 측정값이다 — 새로 생긴 발산이 아니라 L1 에 가려 안 보이던 것이다.
  "catalog-state-paint": [
    "clip-fill",
    "clip-boundary",
    "button-enabled-fill",
    "button-disabled-fill",
    "button-labels",
  ],
  "text-raster-resources": ["heading-text", "paragraph-text", "image-raster"],
  // ADR-205 — 텍스트 래스터 기본 격차(maxByte 204)는 위 케이스와 같은 자리다.
  // 자간 축의 판정은 이 목록이 아니라 **줄 수**가 한다: 결선이 끊기면 두 leg 의 줄
  // 수가 갈려 L1 geometry 가 먼저 깨진다 (KNOWN_LAYERS 의 L1:pass 가 그 계약).
  "text-letter-spacing": ["letter-spacing-control-text"],
};

/** 층별 현재 판정. 어느 층이 좋아지거나 나빠져도 드러난다. */
const KNOWN_LAYERS: Record<string, string> = {
  "basic-geometry-paint":
    "env:pass live:pass L0:pass L1:pass L2:skip L3:pass L4:pass",
  "catalog-state-paint":
    "env:pass live:pass L0:pass L1:pass L2:skip L3:fail L4:fail",
  "text-raster-resources":
    "env:pass live:pass L0:pass L1:pass L2:skip L3:fail L4:fail",
  "text-letter-spacing":
    "env:pass live:pass L0:pass L1:pass L2:skip L3:pass L4:fail",
};

let ck: CanvasKit;

function skiaEnv(c: VisualParityCase) {
  return captureEnvironment({
    canvasKitVersion: "0.42.0",
    surfaceBackend: "sw",
    viewport: { width: c.viewport.width, height: c.viewport.height },
    theme: c.theme,
  });
}

function previewEnv(c: VisualParityCase) {
  // backend 는 환경 체크섬에서 제외되는 필드다 — Preview 는 CanvasKit 을 쓰지
  // 않으므로 두 leg 이 다른 값을 보고해도 identity 는 갈리지 않는다.
  return captureEnvironment({
    canvasKitVersion: "0.42.0",
    surfaceBackend: "gl",
    viewport: { width: c.viewport.width, height: c.viewport.height },
    theme: c.theme,
  });
}

function cropBox(
  pixels: Uint8Array,
  frameWidth: number,
  box: Rect,
): Uint8Array {
  const out = new Uint8Array(box.width * box.height * 4);
  for (let row = 0; row < box.height; row++) {
    const src = ((box.y + row) * frameWidth + box.x) * 4;
    out.set(pixels.subarray(src, src + box.width * 4), row * box.width * 4);
  }
  return out;
}

/**
 * region 을 안쪽으로 `inset` 만큼 깎아 다시 잰다.
 *
 * **이건 통과시키려는 장치가 아니라 진단이다.** 두 rasterizer 의 격차는 두 가지
 * 성격이 있고 둘은 처방이 다르다:
 *
 * - **경계 밴드**: 안쪽은 바이트가 같고 테두리 몇 px 만 크게 다르다 → AA/서브픽셀,
 *   Phase 0 에서 이미 실측된 정상 차이 (`edge` kind 가 이걸 위해 있다).
 * - **채움 자체**: 안쪽도 다르다 → 색·토큰·그리기 경로가 실제로 갈렸다. 예산으로
 *   덮으면 안 되는 것.
 *
 * 전체 maxByte 만 보면 둘이 구분되지 않아서 예산을 올리는 쪽으로 손이 간다.
 */
function insetMetrics(
  a: Uint8Array,
  b: Uint8Array,
  frameWidth: number,
  box: Rect,
  inset: number,
): { maxByte: number; changedFraction: number } | null {
  const inner: Rect = {
    x: box.x + inset,
    y: box.y + inset,
    width: box.width - inset * 2,
    height: box.height - inset * 2,
  };
  if (inner.width <= 0 || inner.height <= 0) return null;
  const d = byteDiff(
    cropBox(a, frameWidth, inner),
    cropBox(b, frameWidth, inner),
  );
  return { maxByte: d.maxByte, changedFraction: d.changedFraction };
}

/**
 * 프레임 전체를 **요소 경계에서 band px 이내**와 그 바깥으로 갈라 따로 잰다.
 *
 * region 단위 inset 으로는 이걸 못 가른다 - region 안에 자식 요소가 들어 있으면
 * 자식의 경계가 부모 region 의 "안쪽" 에 남기 때문이다 (실측: outer-fill 은
 * inset3 에서도 maxByte 가 안 떨어졌는데, 그 안에 inner 상자의 경계가 있었다).
 *
 * 두 rasterizer 가 경계에서만 갈리는지 채움에서도 갈리는지를 가르는 것이
 * 예산 판단의 전부다.
 */
function edgeSplit(
  a: Uint8Array,
  b: Uint8Array,
  frame: { width: number; height: number },
  geometry: Record<string, Rect>,
  band: number,
): {
  band: number;
  edge: { maxByte: number; changed: number; pixels: number };
  fill: { maxByte: number; changed: number; pixels: number };
} {
  const isEdge = new Uint8Array(frame.width * frame.height);
  for (const box of Object.values(geometry)) {
    const x0 = Math.floor(box.x);
    const y0 = Math.floor(box.y);
    const x1 = Math.ceil(box.x + box.width);
    const y1 = Math.ceil(box.y + box.height);
    for (let y = y0 - band; y <= y1 + band; y++) {
      if (y < 0 || y >= frame.height) continue;
      for (let x = x0 - band; x <= x1 + band; x++) {
        if (x < 0 || x >= frame.width) continue;
        const insideCore =
          x >= x0 + band && x < x1 - band && y >= y0 + band && y < y1 - band;
        if (!insideCore) isEdge[y * frame.width + x] = 1;
      }
    }
  }

  let eMax = 0;
  let eChanged = 0;
  let ePixels = 0;
  let fMax = 0;
  let fChanged = 0;
  let fPixels = 0;
  for (let i = 0; i < frame.width * frame.height; i++) {
    let d = 0;
    for (let ch = 0; ch < 4; ch++) {
      const delta = Math.abs(a[i * 4 + ch] - b[i * 4 + ch]);
      if (delta > d) d = delta;
    }
    if (isEdge[i]) {
      ePixels++;
      if (d > eMax) eMax = d;
      if (d > 0) eChanged++;
    } else {
      fPixels++;
      if (d > fMax) fMax = d;
      if (d > 0) fChanged++;
    }
  }
  return {
    band,
    edge: {
      maxByte: eMax,
      changed: eChanged / Math.max(1, ePixels),
      pixels: ePixels,
    },
    fill: {
      maxByte: fMax,
      changed: fChanged / Math.max(1, fPixels),
      pixels: fPixels,
    },
  };
}

/**
 * 큰 델타가 **어디에** 있는지 거친 지도로 낸다.
 *
 * region 요약(maxByte/changed)은 "얼마나 다른가" 만 말하고 "어디가" 를 말하지
 * 않는다. 모서리 arc 인지, 테두리 선인지, 면 전체인지에 따라 원인이 완전히
 * 다르므로 좌표 분포를 같이 남긴다.
 */
function deltaMap(
  a: Uint8Array,
  b: Uint8Array,
  frame: { width: number; height: number },
  cols = 40,
  rows = 20,
): { grid: string[]; hotspots: { x: number; y: number; d: number }[] } {
  const cw = frame.width / cols;
  const ch = frame.height / rows;
  const cell = new Uint8Array(cols * rows);
  const hotspots: { x: number; y: number; d: number }[] = [];

  for (let y = 0; y < frame.height; y++) {
    for (let x = 0; x < frame.width; x++) {
      const i = (y * frame.width + x) * 4;
      let d = 0;
      for (let c = 0; c < 4; c++) {
        const delta = Math.abs(a[i + c] - b[i + c]);
        if (delta > d) d = delta;
      }
      if (d === 0) continue;
      const ci =
        Math.min(rows - 1, Math.floor(y / ch)) * cols +
        Math.min(cols - 1, Math.floor(x / cw));
      if (d > cell[ci]) cell[ci] = d;
      if (d > 64 && hotspots.length < 60) hotspots.push({ x, y, d });
    }
  }

  const glyph = (d: number) =>
    d === 0 ? "." : d <= 2 ? "-" : d <= 16 ? "+" : d <= 64 ? "o" : "#";
  const grid: string[] = [];
  for (let r = 0; r < rows; r++) {
    let line = "";
    for (let c = 0; c < cols; c++) line += glyph(cell[r * cols + c]);
    grid.push(line);
  }
  return { grid, hotspots };
}

/** 한 줄에 담기는 region 요약 — 통과했을 때도 남아야 하는 값이다. */
function formatRegions(r: ParityReport): string {
  return r.regions
    .map(
      (m) =>
        `${m.regionId}[${m.kind}] ratio=${m.diffRatio.toFixed(5)}/${m.budget.maxDiffRatio} ` +
        `maxByte=${m.maxByte}/${m.budget.maxByte} mean=${m.meanByte.toFixed(2)} ` +
        `changed=${m.changedFraction.toFixed(4)}${m.blocked ? " BLOCKED" : ""}`,
    )
    .join("\n    ");
}

describe("ADR-198 Phase 4b — Skia ↔ Preview cross-leg (G3 positive)", () => {
  beforeAll(async () => {
    ck = await initCanvasKit();
    await initCompositionEngineWasm();
  }, 180_000);

  for (const c of PILOT_CASES) {
    describe(c.id, () => {
      let driver: PreviewDriver;
      let report: ParityReport;
      let skia: LegResult;
      let preview: LegResult;

      beforeAll(async () => {
        skia = runSkiaLegResult(
          ck,
          c.document,
          {
            pageId: c.pageId,
            width: c.viewport.width,
            height: c.viewport.height,
            projectId: CASE_PROJECT_ID,
          },
          skiaEnv(c),
        );

        driver = new PreviewDriver();
        await driver.start(c.viewport);
        const rendered = await driver.render(
          c.document,
          CASE_PROJECT_ID,
          previewEnv(c),
        );
        const shot = await driver.capture();

        // 캡처 배율 1:1 재확인 (R14). 다른 해상도끼리 비교하면 리샘플링 오차가
        // 예산 안에 숨어 두 leg 이 실제보다 가까워 보인다.
        const rect = driver.element.getBoundingClientRect();
        expect(
          shot.width,
          `캡처 배율이 1 이 아니다 (shot ${shot.width} vs css ${rect.width})`,
        ).toBe(Math.round(rect.width));

        preview = { ...rendered, pixels: shot.pixels, png: shot.png };

        report = compareLegs(
          c,
          { leg: skia, env: skiaEnv(c) },
          { leg: preview, env: previewEnv(c) },
          {
            frame: { width: c.viewport.width, height: c.viewport.height },
            varianceFloor: 0,
          },
        );
      }, 240_000);

      // 산출물은 통과했을 때도 남아야 한다 - browser mode 러너는 통과한 테스트의
      // 콘솔을 숨긴다 (Phase 3 실측). 진단을 콘솔로만 내면 초록일 때 아무것도
      // 안 남고, 그러면 "예산이 실측에서 나왔다" 를 나중에 확인할 수 없다.
      afterAll(async () => {
        try {
          const { server } = await import("vitest/browser");
          await server.commands.writeFile(
            `tests/visual-parity/.artifacts/${c.id}.crossleg.json`,
            JSON.stringify(
              {
                case: c.id,
                layers: report.layers,
                failures: report.failures,
                regions: report.regions.map((m) => ({
                  regionId: m.regionId,
                  kind: m.kind,
                  box: m.box,
                  diffRatio: m.diffRatio,
                  maxByte: m.maxByte,
                  meanByte: m.meanByte,
                  changedFraction: m.changedFraction,
                  budget: m.budget,
                  blocked: m.blocked,
                  inset: [1, 2, 3].map((n) => ({
                    n,
                    ...insetMetrics(
                      skia.pixels!,
                      preview.pixels!,
                      c.viewport.width,
                      m.box,
                      n,
                    ),
                  })),
                })),
                edgeSplit: [1, 2, 3].map((band) =>
                  edgeSplit(
                    skia.pixels!,
                    preview.pixels!,
                    c.viewport,
                    skia.geometry,
                    band,
                  ),
                ),
                geometry: { skia: skia.geometry, preview: preview.geometry },
                deltaMap: deltaMap(skia.pixels!, preview.pixels!, c.viewport),
                // 경계를 가로지르는 세로 슬라이스 — 어느 leg 이 무슨 색을 놓는지
                // 픽셀 단위로 본다 (요약 지표로는 "누가 무엇을" 이 안 보인다).
                edgeSlice: (() => {
                  const first = Object.values(skia.geometry)[1];
                  if (!first) return null;
                  const x = Math.round(first.x + first.width / 2);
                  const rows: Record<string, string> = {};
                  for (
                    let y = Math.max(0, Math.round(first.y) - 2);
                    y < Math.round(first.y) + 8;
                    y++
                  ) {
                    const i = (y * c.viewport.width + x) * 4;
                    const px = (arr: Uint8Array) =>
                      Array.from(arr.subarray(i, i + 4)).join(",");
                    rows[`y=${y}`] =
                      `skia ${px(skia.pixels!)} | preview ${px(preview.pixels!)}`;
                  }
                  return { x, rows };
                })(),
              },
              null,
              2,
            ),
          );
        } finally {
          driver?.stop();
        }
      }, 60_000);

      it("두 leg 이 같은 문서·환경·노드로 출발한다 (L0)", () => {
        const l0 = report.layers.find((l) => l.layer === "L0");
        console.log(
          `[ADR-198 P4b] ${c.id} L0=${l0?.status} ` +
            `skia(fixture=${skia.fixtureChecksum} env=${skia.environmentChecksum}) ` +
            `preview(fixture=${preview.fixtureChecksum} env=${preview.environmentChecksum})`,
        );
        expect(l0?.status).toBe("pass");
      });

      it("두 leg 모두 살아 있다 (live)", () => {
        console.log(
          `[ADR-198 P4b] ${c.id} live: skia painted=${skia.paintedNodeCount} ` +
            `preview painted=${preview.paintedNodeCount}`,
        );
        expect(report.layers.find((l) => l.layer === "live")?.status).toBe(
          "pass",
        );
      });

      it("예산을 넘는 region 이 실측 목록과 정확히 일치한다", () => {
        console.log(
          `[ADR-198 P4b] ${c.id} regions:\n    ${formatRegions(report)}`,
        );

        // **이 목록은 예산을 넓히지 않기 위한 장치다.** G3 positive 는 아직
        // 미충족이고, 그 사실을 초록으로 덮는 대신 "지금 어디가 얼마나 넘는가"
        // 를 못박는다. 발산이 고쳐지면 목록이 줄어 이 단언이 깨지고, 그때
        // 기록을 갱신하는 것이 올바른 대응이다 (Phase 0/2/3 과 같은 ratchet).
        const blocked = report.regions
          .filter((m) => m.blocked)
          .map((m) => m.regionId);
        expect(blocked, formatRegions(report)).toEqual(
          KNOWN_OVER_BUDGET[c.id] ?? [],
        );
      });

      it("층별 판정이 실측과 일치한다", () => {
        const actual = report.layers
          .map((l) => `${l.layer}:${l.status}`)
          .join(" ");
        console.log(`[ADR-198 P4b] ${c.id} layers=${actual}`);

        // skip 을 통과로 세지 않는다 — 사유 없는 skip 은 그 자체가 결함이다.
        for (const l of report.layers)
          if (l.status === "skip")
            expect(l.reason, `${l.layer} skip 사유 없음`).toBeTruthy();

        expect(actual).toBe(KNOWN_LAYERS[c.id]);
      });
    });
  }
});

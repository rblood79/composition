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
 * **G3 positive 는 아직 미충족이다.** Phase 4b 실측(2026-08-31)이 남긴 발산 3건을
 * 여기에 못박는다 — 예산을 넓혀 초록을 만들지 않기 위한 장치다 (R5).
 *
 * | 케이스 | 남은 발산 | 성격 |
 * | --- | --- | --- |
 * | `basic-geometry-paint` | 채움 region 이 maxByte 145 | 경계 밴드만이 아니다. 요소 경계에서 3px 바깥으로 나가도 maxByte 145 가 남는다 (changed 0.0016) — 모서리 arc 가 유력하나 미규명 |
 * | `catalog-state-paint` | L1 geometry — 버튼 위치가 x 140px / y 55px 어긋난다 | 래스터가 아니라 **레이아웃**이 갈렸다. 픽셀 층은 그래서 실행되지 않는다 (해석 불가) |
 * | `text-raster-resources` | text 2종 예산 초과 + `image-raster` diffRatio 0.914 | 텍스트는 hinting 으로 예상 범위지만 이미지는 91% 가 다르다 — 한쪽이 안 그리는 쪽에 가깝다 |
 *
 * 셋 다 **원인 미규명**이며 수리는 프로덕션 scope 라 별도 승인 대상이다
 * (breakdown §7). 여기서는 현재 값을 고정만 한다.
 */
const KNOWN_OVER_BUDGET: Record<string, string[]> = {
  "basic-geometry-paint": ["body-fill", "outer-fill", "outer-border-radius"],
  // L1 에서 멈춰 픽셀 층이 아예 안 돈다 — region 목록이 비는 것이 정상이다.
  "catalog-state-paint": [],
  "text-raster-resources": ["heading-text", "paragraph-text", "image-raster"],
};

/** 층별 현재 판정. 어느 층이 좋아지거나 나빠져도 드러난다. */
const KNOWN_LAYERS: Record<string, string> = {
  "basic-geometry-paint":
    "env:pass live:pass L0:pass L1:pass L2:skip L3:fail L4:pass",
  "catalog-state-paint":
    "env:pass live:pass L0:pass L1:fail L2:skip L3:skip L4:skip",
  "text-raster-resources":
    "env:pass live:pass L0:pass L1:pass L2:skip L3:fail L4:fail",
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

      it("[미해결 기록] 예산을 넘는 region 이 실측 목록과 정확히 일치한다", () => {
        console.log(
          `[ADR-198 P4b] ${c.id} regions:\n    ${formatRegions(report)}`,
        );

        // **이 목록은 예산을 넓히지 않기 위한 장치다.** G3 positive 는 아직
        // 미충족이고, 그 사실을 초록으로 덮는 대신 "지금 어디가 얼마나 넘는가"
        // 를 못박는다. 발산이 고쳐지면 목록이 줄어 이 단언이 깨지고, 그때
        // 기록을 갱신하는 것이 올바른 대응이다 (Phase 0/2/3 과 같은 ratchet).
        const blocked = report.regions.filter((m) => m.blocked).map((m) => m.regionId);
        expect(blocked, formatRegions(report)).toEqual(
          KNOWN_OVER_BUDGET[c.id] ?? [],
        );
      });

      it("[미해결 기록] 층별 판정이 실측과 일치한다", () => {
        const actual = report.layers.map((l) => `${l.layer}:${l.status}`).join(" ");
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

/**
 * ADR-198 Phase 0 — G0 doctor fixture + SW↔GL rasterizer delta (R13)
 *
 * 두 가지를 한 번에 판정한다:
 *
 * 1. **doctor (HC11)** — CanvasKit 이 실제로 살아 있고 우리가 요청한 색이
 *    지정 좌표에 찍히는가. "캡처가 성공했다" 가 "렌더가 성공했다" 를 뜻하지
 *    않는다는 vgpu 규율 #1 의 이식 — 검은 프레임/빈 프레임은 두 leg 이 완벽히
 *    일치해 parity PASS 로 둔갑한다.
 * 2. **R13 (SW↔GL)** — 게이트는 결정성을 위해 `MakeSurface`(SW) 로 굽지만
 *    프로덕션 Builder 는 `MakeWebGLCanvasSurface`(Ganesh/GL) 로 굽는다
 *    (`createSurface.ts:29`, `SkiaRenderer.ts:1126`). 두 rasterizer 의 delta 가
 *    L3 예산(≤0.001) 밖이면 게이트의 주장 범위를 "software-rasterized Skia vs
 *    Preview" 로 좁혀야 한다. 이 테스트가 그 실측이다.
 *
 ## 이 파일은 parity leg 이 아니다 — **환경 probe** 다
 *
 * 여기서는 씬이 아니라 도형을 직접 그린다. "이 host 에서 CanvasKit 이 살아 있는가",
 * "SW 와 GL 래스터가 얼마나 다른가" 를 재려면 렌더 파이프라인이 아니라 알려진
 * 도형이 필요하기 때문이다. 이 파일의 산출물은 **어떤 parity 판정에도 입력되지
 * 않는다** — 그래서 `productionPath.browser.test.ts` 의 직접-draw 금지 규칙에서
 * 명시 예외로 등록돼 있다 (침묵 예외 금지).
 *
 * host 결정: pinned @vitest/browser Chromium + offscreen `MakeSurface`
 * (ADR-198 Soft Constraint 의 fallback). `initCanvasKit` 이 `window` 와
 * Vite `BASE_URL` 에 의존하므로 순수 Node host 는 프로덕션 초기화를 복제해야
 * 하고, 그건 HC3 위반이다.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { CanvasKit, Surface } from "canvaskit-wasm";
import { initCanvasKit } from "@/builder/workspace/canvas/skia/initCanvasKit";
import { byteDiff, rgbaHash, pixelVariance, pixelAt } from "../harness/pixels";

const W = 64;
const H = 64;

/** doctor 색 — Phase 0 은 토큰 해석 전이라 리터럴. 토큰 경로는 Phase 1 L2 담당. */
const DOCTOR_RGBA: [number, number, number, number] = [0x2f, 0x6f, 0xed, 0xff];
const BG_RGBA: [number, number, number, number] = [0xff, 0xff, 0xff, 0xff];

let ck: CanvasKit;

/** 두 backend 가 공유하는 draw — 채워진 사각형 + 라운드 모서리 + 보더. */
function drawDoctorScene(canvas: ReturnType<Surface["getCanvas"]>): void {
  canvas.clear(ck.Color(...BG_RGBA));

  const fill = new ck.Paint();
  fill.setColor(ck.Color(...DOCTOR_RGBA));
  fill.setStyle(ck.PaintStyle.Fill);
  fill.setAntiAlias(true);
  const rect = ck.LTRBRect(12, 12, 52, 52);
  canvas.drawRRect(ck.RRectXY(rect, 8, 8), fill);
  fill.delete();

  const stroke = new ck.Paint();
  stroke.setColor(ck.Color(0x10, 0x2a, 0x5c, 0xff));
  stroke.setStyle(ck.PaintStyle.Stroke);
  stroke.setStrokeWidth(2);
  stroke.setAntiAlias(true);
  canvas.drawRRect(ck.RRectXY(rect, 8, 8), stroke);
  stroke.delete();
}

function readSurface(surface: Surface): Uint8Array {
  surface.flush();
  const image = surface.makeImageSnapshot();
  if (!image) throw new Error("makeImageSnapshot 실패");
  const pixels = image.readPixels(0, 0, {
    width: W,
    height: H,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB,
  }) as Uint8Array | null;
  image.delete();
  if (!pixels) throw new Error("readPixels 실패");
  return new Uint8Array(pixels);
}

/** SW backend — 게이트가 쓸 경로 (HC4 `surfaceBackend: "sw"`). */
function renderSW(): Uint8Array {
  const surface = ck.MakeSurface(W, H);
  if (!surface) throw new Error("MakeSurface(SW) 생성 실패");
  try {
    drawDoctorScene(surface.getCanvas());
    return readSurface(surface);
  } finally {
    surface.delete();
  }
}

/** GL backend — 프로덕션 Builder 가 쓰는 경로 (createSurface.ts:29). */
function renderGL(): { pixels: Uint8Array; canvas: HTMLCanvasElement } | null {
  const el = document.createElement("canvas");
  el.width = W;
  el.height = H;
  document.body.appendChild(el);
  const surface = ck.MakeWebGLCanvasSurface(el);
  if (!surface) {
    el.remove();
    return null;
  }
  try {
    drawDoctorScene(surface.getCanvas());
    return { pixels: readSurface(surface), canvas: el };
  } finally {
    surface.delete();
  }
}

describe("ADR-198 Phase 0 — G0 doctor + R13 SW↔GL delta", () => {
  beforeAll(async () => {
    ck = await initCanvasKit();
  }, 60_000);

  it("doctor: SW leg 이 살아 있고 지정 좌표가 요청한 색이다 (HC11)", () => {
    const pixels = renderSW();

    // liveness — 빈/단색 프레임이면 분산이 0 이다
    const variance = pixelVariance(pixels);
    expect(variance).toBeGreaterThan(0);

    // 요청한 색이 중앙에 실제로 찍혔는가
    const center = pixelAt(pixels, W, 32, 32);
    expect(center).toEqual(DOCTOR_RGBA);

    // 배경도 요청한 값이어야 한다 (검은 프레임 오판 차단)
    expect(pixelAt(pixels, W, 2, 2)).toEqual(BG_RGBA);

    console.log(
      `[ADR-198 G0] SW doctor: hash=${rgbaHash(pixels)} variance=${variance.toFixed(1)} center=${center.join(",")}`,
    );
  });

  it("결정성: SW leg 10회 연속 해시 동일 + maxByte 0 (HC5/G2)", () => {
    const first = renderSW();
    const baseHash = rgbaHash(first);
    const hashes = new Set<string>([baseHash]);
    let worstMaxByte = 0;

    for (let i = 1; i < 10; i++) {
      const next = renderSW();
      hashes.add(rgbaHash(next));
      worstMaxByte = Math.max(worstMaxByte, byteDiff(first, next).maxByte);
    }

    console.log(
      `[ADR-198 G2] SW 10-run: distinct=${hashes.size} hash=${baseHash} worstMaxByte=${worstMaxByte}`,
    );
    expect(hashes.size).toBe(1);
    expect(worstMaxByte).toBe(0);
  });

  it("R13: SW rasterizer 와 프로덕션 GL rasterizer 의 delta 를 실측한다", () => {
    const sw = renderSW();
    const gl = renderGL();

    if (!gl) {
      throw new Error(
        "MakeWebGLCanvasSurface 생성 실패 — 이 환경에서는 R13 을 측정할 수 없다. " +
          "게이트가 GL 을 대변한다고 주장하기 전에 GL 가용 러너에서 재측정할 것.",
      );
    }

    const diff = byteDiff(sw, gl.pixels);
    const glVariance = pixelVariance(gl.pixels);
    const glCenter = pixelAt(gl.pixels, W, 32, 32);
    gl.canvas.remove();

    // GL leg 도 살아 있어야 비교가 의미를 갖는다
    expect(glVariance).toBeGreaterThan(0);

    console.log(
      `[ADR-198 R13] SW↔GL: maxByte=${diff.maxByte} meanByte=${diff.meanByte.toFixed(4)} ` +
        `changedFraction=${diff.changedFraction.toFixed(6)} ` +
        `swHash=${rgbaHash(sw)} glHash=${rgbaHash(gl.pixels)} ` +
        `glCenter=${glCenter.join(",")} L3budget=0.001`,
    );

    // Phase 0 은 실측이 목적 — 여기서 예산을 강제하지 않는다.
    // 판정은 G0 에서 이 수치를 읽고 ADR 주장 범위를 확정한다.
    expect(diff.totalBytes).toBe(W * H * 4);
  });
});

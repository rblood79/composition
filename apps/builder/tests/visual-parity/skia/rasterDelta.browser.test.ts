/**
 * ADR-198 Phase 0 / R13 — SW↔GL delta 의 **소재** 를 가른다.
 *
 * doctor.browser.test.ts 가 "전체 프레임에서 2.09% 가 다르다" 를 냈다. 그 수치만으로는
 * 두 해석이 모두 성립한다:
 *
 *   (a) AA 경계 밴드만 다르다 → region 정책으로 흡수 가능, 내부 solid 는 정확히 같다
 *   (b) 전역이 다르다 (색공간/감마/premultiply) → SW leg 은 GL 을 대변할 수 없다
 *
 * (a) 와 (b) 는 ADR 이 주장할 수 있는 범위가 정반대다. 그래서 도형을 3종으로 나눠
 * 각각의 delta 를 따로 잰다 — measurement-validity §1 Q2 (유리한 경우만 재지 말 것).
 *
 * ## 이 파일은 parity leg 이 아니다 — **환경 probe** 다
 *
 * 씬이 아니라 도형을 직접 그린다. 래스터라이저 자체의 차이를 재는 것이 목적이라
 * 렌더 파이프라인을 태우면 변수만 늘어난다. 이 파일의 산출물은 **어떤 parity
 * 판정에도 입력되지 않는다** — 그래서 `productionPath.browser.test.ts` 의
 * 직접-draw 금지 규칙에 명시 예외로 등록돼 있다 (침묵 예외 금지).
 */

import { describe, it, expect, beforeAll } from "vitest";
import type { CanvasKit, Canvas, Surface } from "canvaskit-wasm";
import { initCanvasKit } from "@/builder/workspace/canvas/skia/initCanvasKit";
import { byteDiff, pixelVariance } from "../harness/pixels";

const W = 64;
const H = 64;

let ck: CanvasKit;

type Scene = (canvas: Canvas) => void;

/** 축 정렬 + AA off — AA 를 배제한 순수 fill. (b) 를 검출하는 대조군. */
const hardRect: Scene = (canvas) => {
  canvas.clear(ck.Color(255, 255, 255, 255));
  const p = new ck.Paint();
  p.setColor(ck.Color(47, 111, 237, 255));
  p.setStyle(ck.PaintStyle.Fill);
  p.setAntiAlias(false);
  canvas.drawRect(ck.LTRBRect(16, 16, 48, 48), p);
  p.delete();
};

/** 라운드 모서리 + AA on — (a) 를 검출. */
const aaRoundRect: Scene = (canvas) => {
  canvas.clear(ck.Color(255, 255, 255, 255));
  const p = new ck.Paint();
  p.setColor(ck.Color(47, 111, 237, 255));
  p.setStyle(ck.PaintStyle.Fill);
  p.setAntiAlias(true);
  canvas.drawRRect(ck.RRectXY(ck.LTRBRect(16, 16, 48, 48), 10, 10), p);
  p.delete();
};

/** 선형 그라디언트 — dithering 차이를 검출. */
const gradient: Scene = (canvas) => {
  canvas.clear(ck.Color(255, 255, 255, 255));
  const p = new ck.Paint();
  p.setStyle(ck.PaintStyle.Fill);
  p.setShader(
    ck.Shader.MakeLinearGradient(
      [0, 0],
      [W, H],
      [ck.Color4f(0.18, 0.44, 0.93, 1), ck.Color4f(0.93, 0.27, 0.44, 1)],
      [0, 1],
      ck.TileMode.Clamp,
    ),
  );
  canvas.drawRect(ck.LTRBRect(0, 0, W, H), p);
  p.delete();
};

/** 그림자 / blur — MaskFilter 경로. */
const blurShadow: Scene = (canvas) => {
  canvas.clear(ck.Color(255, 255, 255, 255));
  const p = new ck.Paint();
  p.setColor(ck.Color(47, 111, 237, 255));
  p.setStyle(ck.PaintStyle.Fill);
  p.setAntiAlias(true);
  p.setMaskFilter(ck.MaskFilter.MakeBlur(ck.BlurStyle.Normal, 4, false));
  canvas.drawRect(ck.LTRBRect(18, 18, 46, 46), p);
  p.delete();
};

/** clip edge — 축 정렬 clip 안의 AA off fill. clip 경계만 변수. */
const clipEdge: Scene = (canvas) => {
  canvas.clear(ck.Color(255, 255, 255, 255));
  canvas.save();
  canvas.clipRRect(
    ck.RRectXY(ck.LTRBRect(12, 12, 52, 52), 12, 12),
    ck.ClipOp.Intersect,
    true,
  );
  const p = new ck.Paint();
  p.setColor(ck.Color(47, 111, 237, 255));
  p.setStyle(ck.PaintStyle.Fill);
  p.setAntiAlias(false);
  canvas.drawRect(ck.LTRBRect(0, 0, W, H), p);
  p.delete();
  canvas.restore();
};

function read(surface: Surface): Uint8Array {
  surface.flush();
  const image = surface.makeImageSnapshot();
  if (!image) throw new Error("makeImageSnapshot 실패");
  const px = image.readPixels(0, 0, {
    width: W,
    height: H,
    colorType: ck.ColorType.RGBA_8888,
    alphaType: ck.AlphaType.Unpremul,
    colorSpace: ck.ColorSpace.SRGB,
  }) as Uint8Array | null;
  image.delete();
  if (!px) throw new Error("readPixels 실패");
  return new Uint8Array(px);
}

function renderSW(scene: Scene): Uint8Array {
  const s = ck.MakeSurface(W, H);
  if (!s) throw new Error("MakeSurface 실패");
  try {
    scene(s.getCanvas());
    return read(s);
  } finally {
    s.delete();
  }
}

function renderGL(scene: Scene): Uint8Array {
  const el = document.createElement("canvas");
  el.width = W;
  el.height = H;
  document.body.appendChild(el);
  const s = ck.MakeWebGLCanvasSurface(el);
  if (!s) {
    el.remove();
    throw new Error("MakeWebGLCanvasSurface 실패 — GL 미가용 환경");
  }
  try {
    scene(s.getCanvas());
    return read(s);
  } finally {
    s.delete();
    el.remove();
  }
}

/** 주어진 사각 영역만 잘라낸 RGBA. */
function crop(px: Uint8Array, l: number, t: number, r: number, b: number) {
  const out = new Uint8Array((r - l) * (b - t) * 4);
  let o = 0;
  for (let y = t; y < b; y++) {
    for (let x = l; x < r; x++) {
      const i = (y * W + x) * 4;
      out[o++] = px[i];
      out[o++] = px[i + 1];
      out[o++] = px[i + 2];
      out[o++] = px[i + 3];
    }
  }
  return out;
}

describe("ADR-198 Phase 0 / R13 — SW↔GL delta 의 소재", () => {
  beforeAll(async () => {
    ck = await initCanvasKit();
  }, 60_000);

  const cases: Array<{ name: string; scene: Scene; family: string }> = [
    { name: "hard-rect (AA off)", scene: hardRect, family: "solid fill" },
    { name: "aa-roundrect", scene: aaRoundRect, family: "antialiasing" },
    { name: "linear-gradient", scene: gradient, family: "gradient dithering" },
    { name: "blur-shadow", scene: blurShadow, family: "blur/shadow" },
    { name: "clip-edge", scene: clipEdge, family: "clip edges" },
  ];

  for (const c of cases) {
    it(`${c.name}: 전체 / 내부 delta 를 분리 실측`, () => {
      const sw = renderSW(c.scene);
      const gl = renderGL(c.scene);

      expect(pixelVariance(sw)).toBeGreaterThan(0);
      expect(pixelVariance(gl)).toBeGreaterThan(0);

      const full = byteDiff(sw, gl);
      // 도형 내부 (경계 AA 밴드에서 4px 이상 안쪽) — 순수 fill 영역
      const inner = byteDiff(
        crop(sw, 24, 24, 40, 40),
        crop(gl, 24, 24, 40, 40),
      );

      console.log(
        `[ADR-198 R13] ${c.name} (${c.family}) — ` +
          `full: maxByte=${full.maxByte} changedFraction=${full.changedFraction.toFixed(6)} | ` +
          `inner: maxByte=${inner.maxByte} changedFraction=${inner.changedFraction.toFixed(6)}`,
      );

      expect(full.totalBytes).toBe(W * H * 4);
    });
  }
});

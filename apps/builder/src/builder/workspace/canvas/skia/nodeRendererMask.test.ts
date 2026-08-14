import { afterEach, describe, expect, it, vi } from "vitest";
import type { Canvas, CanvasKit } from "canvaskit-wasm";
import {
  applyMaskImage,
  buildMaskGradientShader,
  clearMaskCache,
} from "./nodeRendererMask";
import type { RadialGradientFill } from "./types";

/**
 * mask 경로 gradient shader 의 인자 계약 검증 — 실 CanvasKit 없이 mock 으로
 * 호출 인자만 잠근다. fills.ts applyFill 와의 대칭이 목적: radial 의
 * localMatrix(타원 y-scale) 가 mask 경로에서만 빠졌던 회귀 방지.
 * (mask-image 는 현재 producer 0 휴면 — CSS_SUPPORT_MATRIX §mask — 이라
 * 라이브 검증 불가, 인자 계약 테스트가 유일한 감시자.)
 */
function mockCk() {
  return {
    TileMode: { Repeat: "repeat", Clamp: "clamp" },
    Shader: {
      MakeLinearGradient: vi.fn((...args: unknown[]) => ({
        delete() {},
        args,
      })),
      MakeTwoPointConicalGradient: vi.fn((...args: unknown[]) => ({
        delete() {},
        args,
      })),
      MakeSweepGradient: vi.fn((...args: unknown[]) => ({
        delete() {},
        args,
      })),
    },
  };
}

function mockMaskApplyCk() {
  const resultShader = { delete: vi.fn() };
  const makeShaderWithChildren = vi.fn(() => resultShader);

  class MockPaint {
    blendMode: unknown = null;
    shader: unknown = null;

    setAntiAlias(): void {}
    setStyle(): void {}
    setColor(): void {}
    setStrokeWidth(): void {}
    setStrokeCap(): void {}
    setStrokeJoin(): void {}
    setBlendMode(mode: unknown): void {
      this.blendMode = mode;
    }
    setPathEffect(): void {}
    setShader(shader: unknown): void {
      this.shader = shader;
    }
    setImageFilter(): void {}
    setColorFilter(): void {}
  }

  const ck = {
    Paint: MockPaint,
    PaintStyle: { Fill: 0 },
    StrokeCap: { Butt: 0 },
    StrokeJoin: { Miter: 0 },
    BlendMode: { SrcOver: 0, DstIn: 1 },
    BLACK: Float32Array.of(0, 0, 0, 1),
    LTRBRect: vi.fn((...args: number[]) => args),
    RuntimeEffect: {
      Make: vi.fn(() => ({ makeShaderWithChildren })),
    },
  };

  return { ck, makeShaderWithChildren, resultShader };
}

afterEach(() => {
  clearMaskCache();
});

describe("buildMaskGradientShader — radial localMatrix 계약", () => {
  function makeRadial(matrix?: Float32Array): RadialGradientFill {
    return {
      type: "radial-gradient",
      center: [50, 40],
      startRadius: 0,
      endRadius: 50,
      colors: [Float32Array.of(0, 0, 0, 1), Float32Array.of(1, 1, 1, 1)],
      positions: [0, 1],
      ...(matrix ? { matrix } : {}),
    };
  }

  it("타원 matrix 가 localMatrix 인자(8번째)로 전달된다 (fills.ts applyFill 대칭)", () => {
    const ck = mockCk();
    const matrix = Float32Array.of(1, 0, 0, 0, 0.5, 20, 0, 0, 1);
    buildMaskGradientShader(ck as unknown as CanvasKit, makeRadial(matrix));

    const call = ck.Shader.MakeTwoPointConicalGradient.mock.calls[0];
    expect(call[7]).toBe(matrix);
  });

  it("원형(matrix 부재)이면 localMatrix 는 undefined", () => {
    const ck = mockCk();
    buildMaskGradientShader(ck as unknown as CanvasKit, makeRadial());

    const call = ck.Shader.MakeTwoPointConicalGradient.mock.calls[0];
    expect(call[7]).toBeUndefined();
  });
});

describe("applyMaskImage — 현재 mask layer DstIn 합성", () => {
  it("alpha mask는 offscreen 재캡처 없이 현재 layer에 DstIn으로 그린다", () => {
    const { ck } = mockMaskApplyCk();
    const canvas = { drawRect: vi.fn() };
    const maskShader = { delete: vi.fn() };

    applyMaskImage(
      ck as unknown as CanvasKit,
      canvas as unknown as Canvas,
      100,
      80,
      maskShader,
      "alpha",
    );

    const drawnPaint = canvas.drawRect.mock.calls[0]?.[1] as
      | { blendMode: unknown; shader: unknown }
      | undefined;
    expect(canvas.drawRect).toHaveBeenCalledTimes(1);
    expect(drawnPaint?.shader).toBe(maskShader);
    expect(drawnPaint?.blendMode).toBe(ck.BlendMode.DstIn);
    expect(ck.RuntimeEffect.Make).not.toHaveBeenCalled();
  });

  it("luminance mask는 mask shader를 alpha source로 변환한 뒤 DstIn으로 그린다", () => {
    const { ck, makeShaderWithChildren, resultShader } = mockMaskApplyCk();
    const canvas = { drawRect: vi.fn() };
    const maskShader = { delete: vi.fn() };

    applyMaskImage(
      ck as unknown as CanvasKit,
      canvas as unknown as Canvas,
      100,
      80,
      maskShader,
      "luminance",
    );

    const drawnPaint = canvas.drawRect.mock.calls[0]?.[1] as
      | { blendMode: unknown; shader: unknown }
      | undefined;
    expect(makeShaderWithChildren).toHaveBeenCalledWith(
      expect.any(Float32Array),
      [maskShader],
    );
    expect(drawnPaint?.shader).toBe(resultShader);
    expect(drawnPaint?.blendMode).toBe(ck.BlendMode.DstIn);
    expect(resultShader.delete).toHaveBeenCalledTimes(1);
  });
});

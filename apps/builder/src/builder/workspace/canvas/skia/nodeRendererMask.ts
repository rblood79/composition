/**
 * CanvasKit DstIn 기반 mask-image 렌더링.
 *
 * CSS mask-image(gradient/image)를 alpha/luminance 모드로 적용한다.
 * alpha는 native DstIn, luminance는 RuntimeEffect로 mask alpha를 변환한다.
 *
 * @see fills.ts — mesh-gradient SkSL 패턴 참조
 * @see docs/RENDERING_ARCHITECTURE.md §5.5 Fill 시스템
 */

import type { CanvasKit, Canvas } from "canvaskit-wasm";
import type { FillStyle } from "./types";
import { maybeAmplifyOklab } from "./oklabInterpolation";
import { flattenColors } from "./fills";
import { acquirePooledPaint, releasePooledPaint } from "./paints";

// ============================================
// SkSL Shader Source
// ============================================

/**
 * mask shader를 DstIn source로 변환하는 SkSL.
 *
 * mode == 0 → alpha 모드 (mask.a 사용)
 * mode == 1 → luminance 모드 (CSS luminance 공식: ITU-R BT.709 계수)
 */
export const MASK_SKSL = `
  uniform shader mask;
  uniform int mode;

  half4 main(float2 coord) {
    half4 m = mask.eval(coord);
    half a = (mode == 0) ? m.a : dot(m.rgb, half3(0.2126, 0.7152, 0.0722));
    return half4(1.0, 1.0, 1.0, a);
  }
`;

// ============================================
// Effect Cache
// ============================================

/** RuntimeEffect 인스턴스 캐시. 모듈 수명 동안 1회만 컴파일 */
let cachedEffect: unknown | null = null;

/**
 * mask RuntimeEffect를 반환한다. 최초 호출 시 컴파일, 이후 캐시 반환.
 * 컴파일 실패 시 Error를 throw하여 호출자가 graceful fallback을 처리하게 한다.
 */
function getMaskEffect(ck: CanvasKit): unknown {
  if (!cachedEffect) {
    cachedEffect = ck.RuntimeEffect.Make(MASK_SKSL);
    if (!cachedEffect) {
      throw new Error("[nodeRendererMask] SkSL compilation failed");
    }
  }
  return cachedEffect;
}

// ============================================
// Gradient Shader Builder (mask 전용)
// ============================================

/**
 * FillStyle에서 mask용 gradient Shader를 생성한다.
 * 반환된 Shader는 호출자가 delete() 해야 한다.
 * gradient 이외의 fill 타입이거나 생성 실패 시 null 반환.
 */
export function buildMaskGradientShader(
  ck: CanvasKit,
  fill: FillStyle,
): { delete(): void } | null {
  switch (fill.type) {
    case "linear-gradient": {
      const { colors: fillColors, positions: fillPositions } =
        maybeAmplifyOklab(fill.colors, fill.positions, fill.interpolation);
      return (
        ck.Shader.MakeLinearGradient(
          fill.start,
          fill.end,
          flattenColors(fillColors),
          fillPositions,
          fill.repeating ? ck.TileMode.Repeat : ck.TileMode.Clamp,
        ) ?? null
      );
    }
    case "radial-gradient": {
      const { colors: fillColors, positions: fillPositions } =
        maybeAmplifyOklab(fill.colors, fill.positions, fill.interpolation);
      return (
        ck.Shader.MakeTwoPointConicalGradient(
          fill.center,
          fill.startRadius,
          fill.center,
          fill.endRadius,
          flattenColors(fillColors),
          fillPositions,
          fill.repeating ? ck.TileMode.Repeat : ck.TileMode.Clamp,
          // localMatrix — 비대칭 radius(타원) y-scale. fills.ts applyFill 와 동일
          // 계약 (누락 시 타원 radial mask 가 원형으로 렌더).
          fill.matrix,
        ) ?? null
      );
    }
    case "angular-gradient": {
      const { colors: fillColors, positions: fillPositions } =
        maybeAmplifyOklab(fill.colors, fill.positions, fill.interpolation);
      return (
        ck.Shader.MakeSweepGradient(
          fill.cx,
          fill.cy,
          flattenColors(fillColors),
          fillPositions,
          fill.repeating ? ck.TileMode.Repeat : ck.TileMode.Clamp,
          fill.rotationMatrix ?? null,
          0,
        ) ?? null
      );
    }
    default:
      return null;
  }
}

// ============================================
// Mask Mode Resolution
// ============================================

/**
 * CSS mask-mode 결정 (CSS Masking Level 1 match-source 알고리즘 근사).
 *
 * 우선순위:
 * 1. explicitMode 명시 → 그대로 사용
 * 2. gradient 타입 → alpha (CSS 스펙: gradient는 항상 alpha)
 * 3. SVG URL → luminance (SVG mask 기본 모드)
 * 4. 그 외 → alpha
 */
export function determineMaskMode(
  imageUrl?: string,
  sourceType?: string,
  explicitMode?: "alpha" | "luminance",
): "alpha" | "luminance" {
  if (explicitMode) return explicitMode;
  if (sourceType === "gradient") return "alpha";
  if (imageUrl?.endsWith(".svg")) return "luminance";
  return "alpha";
}

// ============================================
// Core: applyMaskImage
// ============================================

/**
 * 현재 열려 있는 mask saveLayer에 mask-image를 적용한다.
 *
 * 호출자는 요소 content를 먼저 그린 뒤 이 함수를 호출해야 한다. mask shader를
 * DstIn source로 그려 destination(content)의 alpha를 mask alpha와 교차시키며,
 * 호출자가 이후 saveLayer를 restore해 부모 layer에 합성한다.
 *
 * luminance 모드만 RuntimeEffect로 mask shader를 alpha shader로 변환한다.
 */
export function applyMaskImage(
  ck: CanvasKit,
  canvas: Canvas,
  width: number,
  height: number,
  maskShader: unknown,
  mode: "alpha" | "luminance",
): void {
  let luminanceShader: { delete(): void } | null = null;
  const paint = acquirePooledPaint(ck);

  try {
    let sourceShader = maskShader;
    if (mode === "luminance") {
      const effect = getMaskEffect(ck) as {
        makeShaderWithChildren(
          uniforms: Float32Array,
          children: unknown[],
        ): { delete(): void } | null;
      };
      luminanceShader = effect.makeShaderWithChildren(new Float32Array([1]), [
        maskShader,
      ]);
      if (!luminanceShader) return;
      sourceShader = luminanceShader;
    }

    paint.setShader(sourceShader as Parameters<typeof paint.setShader>[0]);
    paint.setBlendMode(ck.BlendMode.DstIn);
    canvas.drawRect(ck.LTRBRect(0, 0, width, height), paint);
  } finally {
    releasePooledPaint(paint);
    luminanceShader?.delete();
  }
}

// ============================================
// Cache Cleanup
// ============================================

/**
 * RuntimeEffect 캐시를 해제한다.
 * CanvasKit 재초기화(HMR, 테스트 환경 teardown) 시 호출 필요.
 */
export function clearMaskCache(): void {
  if (
    cachedEffect &&
    typeof (cachedEffect as { delete(): void }).delete === "function"
  ) {
    (cachedEffect as { delete(): void }).delete();
  }
  cachedEffect = null;
}

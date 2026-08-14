/**
 * SkSL RuntimeEffect 기반 mask-image 렌더링.
 *
 * CSS mask-image(gradient/image)를 alpha/luminance 모드로 적용한다.
 * mesh-gradient 패턴(fills.ts)과 동일하게 CanvasKit RuntimeEffect.Make(SkSL) 사용.
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
 * content + mask 두 shader를 합성하는 SkSL.
 *
 * mode == 0 → alpha 모드 (mask.a 사용)
 * mode == 1 → luminance 모드 (CSS luminance 공식: ITU-R BT.709 계수)
 */
export const MASK_SKSL = `
  uniform shader content;
  uniform shader mask;
  uniform int mode;

  half4 main(float2 coord) {
    half4 c = content.eval(coord);
    half4 m = mask.eval(coord);
    half a = (mode == 0) ? m.a : dot(m.rgb, half3(0.2126, 0.7152, 0.0722));
    return c * a;
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
// Offscreen Surface Pool (GPU 리소스 재사용)
// ============================================

interface PooledSurface {
  surface: {
    getCanvas(): Canvas;
    flush(): void;
    makeImageSnapshot(): unknown;
    delete(): void;
  };
  width: number;
  height: number;
}

/** 동일 크기 surface를 재사용하여 매 프레임 GPU alloc/dealloc 방지 */
let surfacePool: PooledSurface | null = null;

function acquireSurface(
  ck: CanvasKit,
  w: number,
  h: number,
): PooledSurface | null {
  const cw = Math.ceil(w);
  const ch = Math.ceil(h);

  // 기존 surface가 같은 크기이면 재사용
  if (surfacePool && surfacePool.width === cw && surfacePool.height === ch) {
    return surfacePool;
  }

  // 크기 다르면 이전 surface 해제 후 새로 생성
  if (surfacePool) {
    surfacePool.surface.delete();
    surfacePool = null;
  }

  const surface = ck.MakeSurface(cw, ch);
  if (!surface) return null;

  surfacePool = {
    surface: surface as PooledSurface["surface"],
    width: cw,
    height: ch,
  };
  return surfacePool;
}

/** mask surface pool 해제 (HMR/teardown 시 호출) */
export function clearMaskSurfacePool(): void {
  if (surfacePool) {
    surfacePool.surface.delete();
    surfacePool = null;
  }
}

// ============================================
// Core: applyMaskImage
// ============================================

/**
 * mask-image를 canvas에 적용한다.
 *
 * 처리 순서:
 * 1. offscreen surface에 content 렌더 → snapshot → content shader
 * 2. maskShader (gradient 또는 image — 호출자 책임으로 전달)
 * 3. RuntimeEffect로 alpha/luminance 합성 후 main canvas에 drawRect
 *
 * 리소스 관리: 생성한 SkObject는 모두 함수 내에서 delete() 처리.
 * offscreen surface는 pooling으로 재사용 (동일 크기 시 GPU alloc 스킵).
 */
export function applyMaskImage(
  ck: CanvasKit,
  canvas: Canvas,
  width: number,
  height: number,
  maskShader: unknown,
  mode: "alpha" | "luminance",
  renderContent: (offCanvas: Canvas) => void,
): void {
  const pooled = acquireSurface(ck, width, height);
  if (!pooled) return;

  const offCanvas = pooled.surface.getCanvas();
  offCanvas.clear(ck.TRANSPARENT);
  renderContent(offCanvas);
  pooled.surface.flush();

  const snapshot = pooled.surface.makeImageSnapshot();
  if (!snapshot) return;

  let contentShader: { delete(): void } | null = null;
  let resultShader: { delete(): void } | null = null;
  const paint = acquirePooledPaint(ck);

  try {
    contentShader = (
      snapshot as {
        makeShaderOptions(
          tx: unknown,
          ty: unknown,
          fm: unknown,
          mm: unknown,
        ): { delete(): void };
      }
    ).makeShaderOptions(
      ck.TileMode.Clamp,
      ck.TileMode.Clamp,
      ck.FilterMode.Linear,
      ck.MipmapMode.None,
    );

    const effect = getMaskEffect(ck) as {
      makeShaderWithChildren(
        uniforms: Float32Array,
        children: unknown[],
      ): { delete(): void };
    };
    const uniforms = new Float32Array([mode === "alpha" ? 0 : 1]);
    resultShader = effect.makeShaderWithChildren(uniforms, [
      contentShader,
      maskShader,
    ]);

    paint.setShader(resultShader as Parameters<typeof paint.setShader>[0]);
    canvas.drawRect(ck.LTRBRect(0, 0, width, height), paint);
  } finally {
    releasePooledPaint(paint);
    resultShader?.delete();
    contentShader?.delete();
    (snapshot as { delete(): void }).delete();
    // surface는 pool에 유지 (delete 안 함)
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
  clearMaskSurfacePool();
}

/**
 * FillItem → FillStyle (Skia) 변환 레이어
 *
 * UI 모델(FillItem)을 Skia 렌더링 모델(FillStyle)로 변환
 * Phase 1: ColorFillItem → ColorFill만 지원
 *
 * @see apps/builder/src/builder/workspace/canvas/skia/types.ts
 * @see apps/builder/src/builder/workspace/canvas/skia/fills.ts (applyFill)
 */

import type {
  FillItem,
  ColorFillItem,
  LinearGradientFillItem,
  RadialGradientFillItem,
  AngularGradientFillItem,
  ImageFillItem,
  MeshGradientFillItem,
} from "../../../../types/builder/fill.types";
import { FillType } from "../../../../types/builder/fill.types";
import type {
  ColorFill,
  LinearGradientFill,
  RadialGradientFill,
  AngularGradientFill,
  ImageFill,
  MeshGradientFill,
  FillStyle,
} from "../../../workspace/canvas/skia/types";
import {
  getSkImage,
  loadSkImage,
} from "../../../workspace/canvas/skia/imageCache";
import {
  isCanvasKitInitialized,
  getCanvasKit,
} from "../../../workspace/canvas/skia/initCanvasKit";
import { hex8ToFloat32 } from "./colorUtils";

/**
 * ColorFillItem → Skia ColorFill 변환
 */
function colorFillItemToSkia(item: ColorFillItem): ColorFill {
  const float32 = hex8ToFloat32(item.color);
  return {
    type: "color",
    rgba: [
      float32[0],
      float32[1],
      float32[2],
      float32[3] * item.opacity, // Fill opacity 적용
    ],
  };
}

/**
 * LinearGradientFillItem → Skia LinearGradientFill 변환
 */
function linearGradientFillItemToSkia(
  item: LinearGradientFillItem,
  width: number,
  height: number,
): LinearGradientFill {
  const colors = item.stops.map((s) => {
    const c = hex8ToFloat32(s.color);
    return Float32Array.of(c[0], c[1], c[2], c[3] * item.opacity);
  });
  const positions = item.stops.map((s) => s.position);

  // CSS linear-gradient 각도는 12시 기준 시계방향 (0deg=bottom→top, 180deg=top→bottom)
  // CanvasKit은 3시 기준 (cos/sin) → CSS 기준 맞추기 위해 -90° 오프셋
  const rad = ((item.rotation - 90) * Math.PI) / 180;
  const cx = width / 2;
  const cy = height / 2;
  const len = Math.max(width, height) / 2;
  const start: [number, number] = [
    cx - Math.cos(rad) * len,
    cy - Math.sin(rad) * len,
  ];
  const end: [number, number] = [
    cx + Math.cos(rad) * len,
    cy + Math.sin(rad) * len,
  ];

  return {
    type: "linear-gradient",
    start,
    end,
    colors,
    positions,
  };
}

/**
 * RadialGradientFillItem → Skia RadialGradientFill 변환
 */
function radialGradientFillItemToSkia(
  item: RadialGradientFillItem,
  width: number,
  height: number,
): RadialGradientFill {
  const colors = item.stops.map((s) => {
    const c = hex8ToFloat32(s.color);
    return Float32Array.of(c[0], c[1], c[2], c[3] * item.opacity);
  });
  const positions = item.stops.map((s) => s.position);

  const centerX = item.center.x * width;
  const centerY = item.center.y * height;

  // fill 모델 radius(비율 0~1)를 타원으로 표현: 반지름 rx 원을 y-scale(ry/rx)
  // localMatrix 로 눌러 (rx, ry) 타원 생성. 과거 max(rx, ry) 원형 근사는 CSS
  // `radial-gradient(rw% rh% at ...)` 와 falloff 크기가 어긋났다 (2026-07-15 정정).
  // radius 무효(≤0) 시 legacy max 원형 유지.
  const rx = item.radius.width * width;
  const ry = item.radius.height * height;
  const hasEllipse = rx > 0 && ry > 0;
  const endRadius = hasEllipse ? rx : Math.max(rx, ry, 1);
  const scaleY = hasEllipse ? ry / rx : 1;
  const matrix =
    hasEllipse && scaleY !== 1
      ? // y-scale around (centerX, centerY) — row-major 3x3
        Float32Array.of(1, 0, 0, 0, scaleY, centerY * (1 - scaleY), 0, 0, 1)
      : undefined;

  return {
    type: "radial-gradient",
    center: [centerX, centerY],
    startRadius: 0,
    endRadius,
    colors,
    positions,
    ...(matrix ? { matrix } : {}),
  };
}

/**
 * AngularGradientFillItem → Skia AngularGradientFill 변환
 */
function angularGradientFillItemToSkia(
  item: AngularGradientFillItem,
  width: number,
  height: number,
): AngularGradientFill {
  const colors = item.stops.map((s) => {
    const c = hex8ToFloat32(s.color);
    return Float32Array.of(c[0], c[1], c[2], c[3] * item.opacity);
  });
  const positions = item.stops.map((s) => s.position);

  // CSS conic-gradient: `from Ndeg` = 12시(top) 기준 시계 방향 N°에서 시작
  // CanvasKit MakeSweepGradient: 0deg = 3시(right)에서 시계 방향
  // startAngle/endAngle이 WASM 빌드에서 무시되므로 localMatrix 회전으로 보정:
  // θ = rotation - 90 (rotation=0 → -90° = 3시→12시 이동). 과거 -90° 고정 행렬은
  // item.rotation 을 무시해 CSS `from Ndeg` 와 시작 각도가 어긋났다 (2026-07-15 정정).
  const centerX = item.center.x * width;
  const centerY = item.center.y * height;
  const theta = ((item.rotation - 90) * Math.PI) / 180;
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return {
    type: "angular-gradient",
    cx: centerX,
    cy: centerY,
    colors,
    positions,
    // θ rotation matrix around (centerX, centerY) — row-major 3x3
    rotationMatrix: Float32Array.of(
      cos,
      -sin,
      centerX - centerX * cos + centerY * sin,
      sin,
      cos,
      centerY - centerX * sin - centerY * cos,
      0,
      0,
      1,
    ),
  };
}

// ============================================
// CSS background-* 파싱 헬퍼
// ============================================

/**
 * CSS background-repeat 값을 CanvasKit TileMode로 변환
 *
 * repeat       → Repeat / Repeat
 * no-repeat    → Decal / Decal
 * repeat-x     → Repeat / Decal
 * repeat-y     → Decal / Repeat
 * space/round  → Repeat (근사치)
 */
function parseBgRepeat(
  repeat: string | undefined,
  ck: ReturnType<typeof getCanvasKit>,
): { x: unknown; y: unknown } {
  switch ((repeat ?? "repeat").trim()) {
    case "no-repeat":
      return { x: ck.TileMode.Decal, y: ck.TileMode.Decal };
    case "repeat-x":
      return { x: ck.TileMode.Repeat, y: ck.TileMode.Decal };
    case "repeat-y":
      return { x: ck.TileMode.Decal, y: ck.TileMode.Repeat };
    case "repeat":
    case "space":
    case "round":
    default:
      return { x: ck.TileMode.Repeat, y: ck.TileMode.Repeat };
  }
}

/**
 * CSS background-size 값을 [targetWidth, targetHeight]로 변환
 *
 * cover   → 짧은 축 기준 스케일 (잘림 허용)
 * contain → 긴 축 기준 스케일 (전체 표시)
 * auto    → 이미지 원본 크기
 * px/% 값 → 지정 크기
 */
function parseBgSize(
  size: string | undefined,
  containerW: number,
  containerH: number,
  imgW: number,
  imgH: number,
): [number, number] {
  const s = (size ?? "auto").trim();

  if (s === "cover") {
    const scale = Math.max(containerW / imgW, containerH / imgH);
    return [imgW * scale, imgH * scale];
  }
  if (s === "contain") {
    const scale = Math.min(containerW / imgW, containerH / imgH);
    return [imgW * scale, imgH * scale];
  }
  if (s === "auto") {
    return [imgW, imgH];
  }

  // "100%" / "100px" / "100px 50%" 형식 파싱
  const parts = s.split(/\s+/);
  const resolveOne = (
    v: string,
    containerSize: number,
    naturalSize: number,
  ): number => {
    if (v === "auto") return naturalSize;
    if (v.endsWith("%")) return (parseFloat(v) / 100) * containerSize;
    return parseFloat(v) || naturalSize;
  };

  const tw = resolveOne(parts[0], containerW, imgW);
  const th = parts[1]
    ? resolveOne(parts[1], containerH, imgH)
    : imgH * (tw / imgW);
  return [tw, th];
}

/**
 * CSS background-position 값을 [offsetX, offsetY]로 변환
 *
 * 키워드: center / top / right / bottom / left
 * 단위: px / %
 *
 * offsetX/Y는 targetWidth/Height 기준의 이미지 좌상단 좌표
 */
function parseBgPosition(
  pos: string | undefined,
  containerW: number,
  containerH: number,
  targetW: number,
  targetH: number,
): [number, number] {
  const p = (pos ?? "center").trim();

  // 단일 키워드 처리
  if (p === "center")
    return [(containerW - targetW) / 2, (containerH - targetH) / 2];
  if (p === "top") return [(containerW - targetW) / 2, 0];
  if (p === "bottom") return [(containerW - targetW) / 2, containerH - targetH];
  if (p === "left") return [0, (containerH - targetH) / 2];
  if (p === "right") return [containerW - targetW, (containerH - targetH) / 2];

  const parts = p.split(/\s+/);
  const resolveX = (v: string): number => {
    if (v === "center") return (containerW - targetW) / 2;
    if (v === "left") return 0;
    if (v === "right") return containerW - targetW;
    if (v.endsWith("%")) return (parseFloat(v) / 100) * (containerW - targetW);
    return parseFloat(v) || 0;
  };
  const resolveY = (v: string): number => {
    if (v === "center") return (containerH - targetH) / 2;
    if (v === "top") return 0;
    if (v === "bottom") return containerH - targetH;
    if (v.endsWith("%")) return (parseFloat(v) / 100) * (containerH - targetH);
    return parseFloat(v) || 0;
  };

  const ox = resolveX(parts[0]);
  const oy = parts[1] ? resolveY(parts[1]) : (containerH - targetH) / 2;
  return [ox, oy];
}

/**
 * ImageFillItem → Skia ImageFill 변환
 * Phase 4: imageCache에서 동기 조회 (캐시 미스 시 비동기 로딩 트리거)
 */
function imageFillItemToSkia(
  item: ImageFillItem,
  width: number,
  height: number,
): ImageFill | null {
  if (!item.url || !isCanvasKitInitialized()) return null;

  const skImage = getSkImage(item.url);

  // 캐시 미스 — 백그라운드 로딩 트리거 후 null 반환 (다음 렌더에서 캐시 히트)
  if (!skImage) {
    loadSkImage(item.url);
    return null;
  }

  const ck = getCanvasKit();

  // mode → 변환 매트릭스 계산
  const imgWidth = skImage.width();
  const imgHeight = skImage.height();
  let matrix: Float32Array | undefined;

  if (item.mode === "stretch") {
    // 단순 스케일 (종횡비 무시)
    matrix = Float32Array.of(
      width / imgWidth,
      0,
      0,
      0,
      height / imgHeight,
      0,
      0,
      0,
      1,
    );
  } else if (item.mode === "fill") {
    // 커버: 짧은 축 기준 스케일 (잘림 허용)
    const scale = Math.max(width / imgWidth, height / imgHeight);
    const tx = (width - imgWidth * scale) / 2;
    const ty = (height - imgHeight * scale) / 2;
    matrix = Float32Array.of(scale, 0, tx, 0, scale, ty, 0, 0, 1);
  } else {
    // fit: 긴 축 기준 스케일 (전체 표시)
    const scale = Math.min(width / imgWidth, height / imgHeight);
    const tx = (width - imgWidth * scale) / 2;
    const ty = (height - imgHeight * scale) / 2;
    matrix = Float32Array.of(scale, 0, tx, 0, scale, ty, 0, 0, 1);
  }

  return {
    type: "image",
    image: skImage,
    tileModeX: ck.TileMode.Clamp,
    tileModeY: ck.TileMode.Clamp,
    tileMode: ck.TileMode.Clamp,
    sampling: ck.FilterMode.Linear,
    matrix,
  };
}

/**
 * CSS background-image url() + background-size/position/repeat → Skia ImageFill 변환
 *
 * CSS style 속성의 background-image/size/position/repeat를 파싱하여
 * 적절한 matrix와 TileMode를 계산한다.
 *
 * @param url        - 이미지 URL (url() 제거 후 순수 URL)
 * @param width      - 컨테이너 너비 (px)
 * @param height     - 컨테이너 높이 (px)
 * @param bgSize     - CSS background-size 값 (cover/contain/auto/px/%)
 * @param bgPosition - CSS background-position 값 (center/top/50%/10px 등)
 * @param bgRepeat   - CSS background-repeat 값 (repeat/no-repeat/repeat-x/repeat-y)
 */
export function cssBgImageToSkia(
  url: string,
  width: number,
  height: number,
  bgSize?: string,
  bgPosition?: string,
  bgRepeat?: string,
): ImageFill | null {
  if (!url || !isCanvasKitInitialized()) return null;

  const skImage = getSkImage(url);
  if (!skImage) {
    loadSkImage(url);
    return null;
  }

  const ck = getCanvasKit();
  const imgW = skImage.width();
  const imgH = skImage.height();

  // 1. background-size → 렌더 크기 계산
  const [targetW, targetH] = parseBgSize(bgSize, width, height, imgW, imgH);

  // 2. background-position → 이미지 좌상단 오프셋
  const [offsetX, offsetY] = parseBgPosition(
    bgPosition,
    width,
    height,
    targetW,
    targetH,
  );

  // 3. 매트릭스 조합: scale → translate
  //    CanvasKit 3x3 row-major: [scaleX, skewX, transX, skewY, scaleY, transY, 0, 0, 1]
  const scaleX = targetW / imgW;
  const scaleY = targetH / imgH;
  const matrix = Float32Array.of(
    scaleX,
    0,
    offsetX,
    0,
    scaleY,
    offsetY,
    0,
    0,
    1,
  );

  // 4. background-repeat → TileMode
  const tileMode = parseBgRepeat(bgRepeat, ck);

  return {
    type: "image",
    image: skImage,
    tileModeX: tileMode.x,
    tileModeY: tileMode.y,
    tileMode: tileMode.x, // 하위 호환 fallback
    sampling: ck.FilterMode.Linear,
    matrix,
  };
}

/**
 * MeshGradientFillItem → Skia MeshGradientFill 변환
 * Phase 4: N×M 포인트 → colors 배열
 */
function meshGradientFillItemToSkia(
  item: MeshGradientFillItem,
  width: number,
  height: number,
): MeshGradientFill | null {
  if (!item.points || item.points.length === 0) return null;

  const colors = item.points.map((p) => {
    const c = hex8ToFloat32(p.color);
    return Float32Array.of(c[0], c[1], c[2], c[3] * item.opacity);
  });

  return {
    type: "mesh-gradient",
    rows: item.rows,
    columns: item.columns,
    colors,
    width,
    height,
  };
}

/**
 * FillItem → FillStyle 변환
 * Phase 4: Color + 3종 Gradient + Image + MeshGradient 지원
 */
export function fillItemToFillStyle(
  item: FillItem,
  width = 100,
  height = 100,
): FillStyle | null {
  if (!item.enabled) return null;

  switch (item.type) {
    case FillType.Color:
      return colorFillItemToSkia(item);
    case FillType.LinearGradient:
      return linearGradientFillItemToSkia(item, width, height);
    case FillType.RadialGradient:
      return radialGradientFillItemToSkia(item, width, height);
    case FillType.AngularGradient:
      return angularGradientFillItemToSkia(item, width, height);
    case FillType.Image:
      return imageFillItemToSkia(item, width, height);
    case FillType.MeshGradient:
      return meshGradientFillItemToSkia(item, width, height);
    default:
      return null;
  }
}

/**
 * fills 배열 → Skia 렌더링 데이터 변환
 * Phase 1: 마지막 enabled fill의 fillColor만 반환
 *
 * @returns fillColor Float32Array (0-1 범위) 또는 null
 */
export function fillsToSkiaFillColor(fills: FillItem[]): Float32Array | null {
  if (!fills || fills.length === 0) return null;

  // 마지막 enabled fill 찾기 (시각적으로 가장 위)
  for (let i = fills.length - 1; i >= 0; i--) {
    const fill = fills[i];
    if (!fill.enabled) continue;

    const fillStyle = fillItemToFillStyle(fill);
    if (fillStyle && fillStyle.type === "color") {
      return Float32Array.of(
        fillStyle.rgba[0],
        fillStyle.rgba[1],
        fillStyle.rgba[2],
        fillStyle.rgba[3],
      );
    }
  }

  return null;
}

/**
 * fills 배열 → 비-color fill 의 대표 단색 fallback (top enabled 기준)
 *
 * gradient(linear/radial/angular)는 첫 stop, mesh 는 첫 point 색을 사용한다.
 * image 는 대표색이 없으므로 건너뛴다 (그 아래 fill 로 계속 탐색).
 * alpha 는 hex8 alpha × fill.opacity 합성 — fillsToSkiaFillColor 와 동일 규약.
 *
 * 용도: catalog 경로(buildSpecNodeData)에서 color fill 이 없는 fills 에도
 * bg box 방출(border-radius 해소)을 유도하고, gradient shader 실패/이미지
 * 로딩 중의 graceful fallback 색을 제공한다. 실제 페인트는 box.fill(FillStyle)
 * shader 가 성공하는 한 이 색을 덮는다.
 */
export function fillsToSkiaFallbackColor(
  fills: FillItem[],
): Float32Array | null {
  if (!fills || fills.length === 0) return null;

  for (let i = fills.length - 1; i >= 0; i--) {
    const fill = fills[i];
    if (!fill.enabled) continue;

    let colorHex8: string | undefined;
    if (
      fill.type === FillType.LinearGradient ||
      fill.type === FillType.RadialGradient ||
      fill.type === FillType.AngularGradient
    ) {
      colorHex8 = fill.stops[0]?.color;
    } else if (fill.type === FillType.MeshGradient) {
      colorHex8 = fill.points[0]?.color;
    } else {
      // color 는 fillsToSkiaFillColor 담당, image 는 대표색 없음
      continue;
    }
    if (!colorHex8) continue;

    const c = hex8ToFloat32(colorHex8);
    return Float32Array.of(c[0], c[1], c[2], c[3] * fill.opacity);
  }

  return null;
}

/**
 * fills 배열 → FillStyle 변환 (그래디언트 포함)
 * 마지막 enabled fill의 FillStyle 반환
 *
 * @returns FillStyle 또는 null
 */
export function fillsToSkiaFillStyle(
  fills: FillItem[],
  width: number,
  height: number,
): FillStyle | null {
  if (!fills || fills.length === 0) return null;

  for (let i = fills.length - 1; i >= 0; i--) {
    const fill = fills[i];
    if (!fill.enabled) continue;

    const fillStyle = fillItemToFillStyle(fill, width, height);
    if (fillStyle) return fillStyle;
  }

  return null;
}

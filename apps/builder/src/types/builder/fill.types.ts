/**
 * Fill System Type Definitions
 *
 * Color Picker Phase 1: Fill 데이터 모델
 * - Pencil 앱의 6종 Fill 타입을 지원하는 타입 시스템
 * - Phase 1: ColorFillItem만 UI 연결, 나머지는 타입만 정의
 *
 * @see docs/COLOR_PICKER.md
 * @see apps/builder/src/builder/workspace/canvas/skia/types.ts (Skia FillStyle)
 */

// ============================================
// Fill Type Enum
// ============================================

/** Fill 타입 열거형 (Pencil 6종 대응) */
export enum FillType {
  Color = "color",
  Image = "image",
  LinearGradient = "linear-gradient",
  RadialGradient = "radial-gradient",
  AngularGradient = "angular-gradient",
  MeshGradient = "mesh-gradient",
}

// ============================================
// Gradient Stop
// ============================================

/** 그래디언트 색상 스톱 */
export interface GradientStop {
  color: string; // "#RRGGBBAA"
  position: number; // 0.0 ~ 1.0
}

// ============================================
// Base Fill Item
// ============================================

/** 기본 Fill 아이템 (모든 타입 공통) */
export interface BaseFillItem {
  id: string;
  enabled: boolean; // on/off 토글
  opacity: number; // 0.0 ~ 1.0 (Fill 레벨 불투명도)
  blendMode: BlendMode;
}

// ============================================
// Fill Item Variants
// ============================================

/** 단색 Fill */
export interface ColorFillItem extends BaseFillItem {
  type: FillType.Color;
  color: string; // "#RRGGBBAA"
}

/** 선형 그래디언트 Fill */
export interface LinearGradientFillItem extends BaseFillItem {
  type: FillType.LinearGradient;
  stops: GradientStop[];
  rotation: number; // 0 ~ 360 degrees
}

/** 방사형 그래디언트 Fill */
export interface RadialGradientFillItem extends BaseFillItem {
  type: FillType.RadialGradient;
  stops: GradientStop[];
  center: { x: number; y: number }; // 0.0 ~ 1.0 (비율)
  radius: { width: number; height: number };
}

/** 각도형 그래디언트 Fill */
export interface AngularGradientFillItem extends BaseFillItem {
  type: FillType.AngularGradient;
  stops: GradientStop[];
  center: { x: number; y: number };
  rotation: number;
}

/** 이미지 Fill (Phase 4) */
export interface ImageFillItem extends BaseFillItem {
  type: FillType.Image;
  url: string;
  mode: "stretch" | "fill" | "fit";
}

/** 메쉬 그래디언트 Fill (Phase 4) */
export interface MeshGradientFillItem extends BaseFillItem {
  type: FillType.MeshGradient;
  rows: number;
  columns: number;
  points: MeshPoint[];
}

export interface MeshPoint {
  position: [number, number];
  color: string;
  leftHandle?: [number, number];
  rightHandle?: [number, number];
  topHandle?: [number, number];
  bottomHandle?: [number, number];
}

// ============================================
// Fill Item Union
// ============================================

/** Fill 아이템 유니온 타입 */
export type FillItem =
  | ColorFillItem
  | LinearGradientFillItem
  | RadialGradientFillItem
  | AngularGradientFillItem
  | ImageFillItem
  | MeshGradientFillItem;

// ============================================
// Blend Mode
// ============================================

/** 블렌드 모드 (CanvasKit 대응) */
export type BlendMode =
  | "normal" // SrcOver
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion";

// ============================================
// Color Input Mode
// ============================================

/** 색상 입력 모드 */
export type ColorInputMode = "rgba" | "hex" | "css" | "hsl" | "hsb";

// ============================================
// Border Config (CSS border 기반)
// ============================================

/** Border 설정 (CSS border 매핑) */
export interface BorderConfig {
  fills: FillItem[];
  width: BorderWidth;
  style: BorderStyleValue;
  radius: BorderRadius;
}

/** 보더 너비 (CSS borderWidth 매핑) */
export type BorderWidth =
  string | { top: string; right: string; bottom: string; left: string };

/** 보더 스타일 */
export type BorderStyleValue =
  "none" | "solid" | "dashed" | "dotted" | "double" | "groove" | "ridge";

/** 보더 반경 (CSS borderRadius 매핑) */
export type BorderRadius =
  | string
  | {
      topLeft: string;
      topRight: string;
      bottomRight: string;
      bottomLeft: string;
    };

// ============================================
// Factory Functions
// ============================================

/** 기본 ColorFillItem 생성 */
export function createDefaultColorFill(color = "#000000FF"): ColorFillItem {
  return {
    id: crypto.randomUUID(),
    type: FillType.Color,
    color,
    enabled: true,
    opacity: 1,
    blendMode: "normal",
  };
}

/** 타입별 기본 FillItem 생성 */
export function createDefaultFill(type: FillType = FillType.Color): FillItem {
  switch (type) {
    case FillType.Color:
      return createDefaultColorFill();
    case FillType.LinearGradient:
      return {
        id: crypto.randomUUID(),
        type: FillType.LinearGradient,
        stops: [
          { color: "#000000FF", position: 0 },
          { color: "#FFFFFFFF", position: 1 },
        ],
        rotation: 0,
        enabled: true,
        opacity: 1,
        blendMode: "normal",
      };
    case FillType.RadialGradient:
      return {
        id: crypto.randomUUID(),
        type: FillType.RadialGradient,
        stops: [
          { color: "#000000FF", position: 0 },
          { color: "#FFFFFFFF", position: 1 },
        ],
        center: { x: 0.5, y: 0.5 },
        radius: { width: 0.5, height: 0.5 },
        enabled: true,
        opacity: 1,
        blendMode: "normal",
      };
    case FillType.AngularGradient:
      return {
        id: crypto.randomUUID(),
        type: FillType.AngularGradient,
        stops: [
          { color: "#000000FF", position: 0 },
          { color: "#FFFFFFFF", position: 1 },
        ],
        center: { x: 0.5, y: 0.5 },
        rotation: 0,
        enabled: true,
        opacity: 1,
        blendMode: "normal",
      };
    case FillType.Image:
      return {
        id: crypto.randomUUID(),
        type: FillType.Image,
        url: "",
        mode: "fill",
        enabled: true,
        opacity: 1,
        blendMode: "normal",
      };
    case FillType.MeshGradient:
      return {
        id: crypto.randomUUID(),
        type: FillType.MeshGradient,
        rows: 2,
        columns: 2,
        points: [
          { position: [0, 0], color: "#FF0000FF" },
          { position: [1, 0], color: "#FFFF00FF" },
          { position: [0, 1], color: "#0000FFFF" },
          { position: [1, 1], color: "#00FF00FF" },
        ],
        enabled: true,
        opacity: 1,
        blendMode: "normal",
      };
  }
}

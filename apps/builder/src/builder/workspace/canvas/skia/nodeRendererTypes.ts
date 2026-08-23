import type {
  EmbindEnumEntity,
  Image as SkImage,
  Paragraph,
} from "canvaskit-wasm";
import type { ClipPathShape } from "../styleConversion/styleConverter";
import type {
  DropShadowEffect,
  EffectStyle,
  FillStyle,
  MaskImageStyle,
  TextShadow,
} from "./types";

export interface PartialBorderData {
  sides: { top?: boolean; right?: boolean; bottom?: boolean; left?: boolean };
  strokeColor: Float32Array;
  strokeWidth: number;
  strokeDasharray?: number[];
  borderRadius: [number, number, number, number];
}

export interface SkiaNodeData {
  type:
    | "box"
    | "text"
    | "image"
    | "container"
    | "line"
    | "arc"
    | "icon_path"
    | "partial_border";
  elementId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  effects?: EffectStyle[];
  blendMode?: string;
  box?: {
    fillColor: Float32Array;
    fill?: FillStyle;
    borderRadius: number | [number, number, number, number];
    strokeColor?: Float32Array;
    strokeWidth?: number;
    strokeStyle?:
      | "solid"
      | "dashed"
      | "dotted"
      | "double"
      | "groove"
      | "ridge"
      | "inset"
      | "outset";
    outlineColor?: Float32Array;
    outlineWidth?: number;
    outlineOffset?: number;
    /** G1+G2: CSS box-shadow 목록. renderBoxShadows()에서 RRect로 직접 렌더 */
    shadows?: DropShadowEffect[];
  };
  /** ADR-187: canonical top-level fill을 실제로 소비하는 draw color slot들. */
  presentationFillTargets?: readonly SkiaPresentationFillTarget[];
  /** ADR-187 Phase 5: style paint가 소비하는 mutable stroke color slots. */
  presentationStrokeTargets?: readonly SkiaPresentationStrokeTarget[];
  /** ADR-187 Phase 5: box-shadow가 소비하는 mutable effect slots. */
  presentationShadowTargets?: readonly SkiaPresentationShadowTarget[];
  text?: {
    content: string;
    fontFamilies: string[];
    fontSize: number;
    fontWeight?: number;
    fontStyle?: number;
    color: Float32Array;
    align?: EmbindEnumEntity | "left" | "center" | "right";
    letterSpacing?: number;
    wordSpacing?: number;
    lineHeight?: number;
    decoration?: number;
    paddingLeft: number;
    paddingTop: number;
    paddingBottom?: number;
    maxWidth: number;
    autoCenter?: boolean;
    verticalAlign?: "top" | "middle" | "bottom" | "baseline";
    whiteSpace?: "normal" | "nowrap" | "pre" | "pre-wrap" | "pre-line";
    wordBreak?: "normal" | "break-all" | "keep-all";
    overflowWrap?: "normal" | "break-word" | "anywhere";
    textOverflow?: "ellipsis" | "clip";
    decorationStyle?: "solid" | "dashed" | "dotted" | "double" | "wavy";
    decorationColor?: Float32Array;
    textIndent?: number;
    fontVariant?: string;
    fontStretch?: string;
    clipText?: boolean;
    /** G4: CSS text-shadow 목록 (shadow-first 2-pass 렌더링) */
    textShadows?: TextShadow[];
  };
  image?: {
    skImage: SkImage | null;
    contentX: number;
    contentY: number;
    contentWidth: number;
    contentHeight: number;
    altText?: string;
  };
  line?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    strokeColor: Float32Array;
    strokeWidth: number;
    strokeDasharray?: number[];
    strokeCap?: "butt" | "round" | "square";
  };
  arc?: {
    cx: number;
    cy: number;
    radius: number;
    startAngle: number;
    sweepAngle: number;
    strokeColor: Float32Array;
    strokeWidth: number;
    strokeCap?: "butt" | "round" | "square";
  };
  partialBorder?: PartialBorderData;
  iconPath?: {
    paths: string[];
    circles?: Array<{ cx: number; cy: number; r: number }>;
    cx: number;
    cy: number;
    size: number;
    strokeColor: Float32Array;
    strokeWidth: number;
  };
  /** CSS mask-image. nodeRendererMask.ts의 SkSL RuntimeEffect로 처리 */
  maskImage?: MaskImageStyle;
  transform?: Float32Array;
  clipPath?: ClipPathShape;
  clipChildren?: boolean;
  scrollOffset?: { scrollTop: number; scrollLeft: number };
  scrollbar?: {
    vertical?: { trackHeight: number; thumbHeight: number; thumbY: number };
    horizontal?: { trackWidth: number; thumbWidth: number; thumbX: number };
  };
  contentMinHeight?: number;
  zIndex?: number;
  isStackingContext?: boolean;
  /** CSS position: sticky — visitElement에서 post-layout 좌표 보정 */
  isSticky?: boolean;
  /** CSS position: fixed — viewport 기준 고정 */
  isFixed?: boolean;
  /** sticky top 값 (px) */
  stickyTop?: number;
  /** sticky left 값 (px) */
  stickyLeft?: number;
  children?: SkiaNodeData[];
}

export interface SkiaPresentationFillTarget {
  /** box fillColor / line·arc strokeColor가 공유하는 mutable Color4f slot. */
  readonly color: Float32Array;
  /** canonical fill alpha 위에 유지할 primitive 고유 opacity. */
  readonly opacityMultiplier: number;
  /**
   * gradient background이 소비하는 mutable stop color slots.
   * `color`는 기존 fallback/primitive slot이고, 이 배열이 있으면 paint lane이
   * shader를 재생성하지 않고 기존 FillStyle 배열만 교체한다.
   */
  readonly gradientColors?: readonly Float32Array[];
  /** gradient stop position slots (`FillStyle.positions`의 동일 배열). */
  readonly gradientPositions?: number[];
  /** gradient target과 canonical fill을 연결하는 semantic fill id. */
  readonly fillId?: string;
  /** gradient geometry를 재계산하지 않기 위한 build-time 기준 크기. */
  readonly gradientWidth?: number;
  readonly gradientHeight?: number;
}

export interface SkiaPresentationStrokeTarget {
  /** box.strokeColor와 공유하는 mutable Color4f slot. */
  readonly color: Float32Array;
}

export interface SkiaPresentationShadowTarget {
  /** node.effects 안의 기존 drop-shadow object를 직접 갱신한다. */
  readonly effect: DropShadowEffect;
}

export type ParagraphCache = Map<string, Paragraph>;

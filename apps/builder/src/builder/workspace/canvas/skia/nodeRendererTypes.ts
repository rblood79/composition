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

export type ParagraphCache = Map<string, Paragraph>;

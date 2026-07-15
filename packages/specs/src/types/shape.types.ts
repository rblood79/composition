/**
 * Shape Types
 *
 * Component Spec에서 사용하는 도형 타입 정의
 * React와 PIXI 렌더러 모두에서 해석 가능한 도형 구조
 *
 * @packageDocumentation
 */

import type { TokenRef } from "./token.types";

/**
 * 색상 값 (토큰 참조 또는 직접 값)
 */
export type ColorValue = TokenRef | string | number;

/**
 * 모든 Shape의 공통 속성
 * Border/Shadow 타겟팅을 위한 id 포함
 */
export interface ShapeBase {
  /** 고유 식별자 (Border/Shadow 적용 대상 지정용) */
  id?: string;
}

/**
 * Shape 유니온 타입
 * 모든 Shape는 ShapeBase를 포함 (& 교차 타입)
 */
export type Shape =
  | (RectShape & ShapeBase)
  | (RoundRectShape & ShapeBase)
  | (CircleShape & ShapeBase)
  | (ArcShape & ShapeBase)
  | (TextShape & ShapeBase)
  | (ShadowShape & ShapeBase)
  | (BorderShape & ShapeBase)
  | (ContainerShape & ShapeBase)
  | (GradientShape & ShapeBase)
  | (ImageShape & ShapeBase)
  | (LineShape & ShapeBase)
  | (IconFontShape & ShapeBase);

/**
 * 사각형
 */
export interface RectShape {
  type: "rect";
  x: number;
  y: number;
  width: number | "auto";
  height: number | "auto";
  fill?: ColorValue;
  fillAlpha?: number;
}

/**
 * 둥근 사각형
 */
export interface RoundRectShape {
  type: "roundRect";
  x: number;
  y: number;
  width: number | "auto";
  height: number | "auto";
  radius: number | [number, number, number, number]; // [tl, tr, br, bl]
  fill?: ColorValue;
  fillAlpha?: number;
}

/**
 * 원
 */
export interface CircleShape {
  type: "circle";
  x: number;
  y: number;
  radius: number;
  fill?: ColorValue;
  fillAlpha?: number;
  /** 테두리 색상 (stroke 기반 링 표현용) */
  stroke?: ColorValue;
  /** 테두리 두께 */
  strokeWidth?: number;
}

/**
 * 호 (Arc) — 원형 진행률 표시 등에 사용
 *
 * stroke 기반 부분 원호를 그린다.
 * startAngle/sweepAngle은 도(degree) 단위, 12시 방향 = -90°.
 */
export interface ArcShape {
  type: "arc";
  /** 중심 X */
  x: number;
  /** 중심 Y */
  y: number;
  /** 외부 반지름 */
  radius: number;
  /** 호 시작 각도 (degree, 3시 방향 = 0°) */
  startAngle: number;
  /** 호 스윕 각도 (degree, 양수 = 시계방향) */
  sweepAngle: number;
  /** 선 두께 */
  strokeWidth: number;
  /** 선 색상 */
  stroke: ColorValue;
  /** 선 끝 모양 */
  strokeCap?: "butt" | "round" | "square";
}

/**
 * 텍스트
 */
export interface TextShape {
  type: "text";
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  fontWeight?: string | number;
  fontStyle?: "normal" | "italic";
  fill?: ColorValue;
  align?: "left" | "center" | "right";
  baseline?: "top" | "middle" | "bottom";

  /**
   * 텍스트 glyph 세로 정렬 (CSS `vertical-align` 대응, nodeRendererText computeDrawY 소비).
   * baseline(좌표 계산용)과 별개 — "middle" 이면 `(node.height - textHeight)/2` 진짜 세로 중앙.
   * 미지정 시 top 정렬(위쪽). Style 패널 Typography Vertical Align 과 동일 축.
   */
  verticalAlign?: "top" | "middle" | "bottom" | "baseline";

  /** 줄 높이 (배수, 예: 1.5) */
  lineHeight?: number;

  /** 자간 (px) */
  letterSpacing?: number;

  /**
   * 텍스트 장식 (CSS `text-decoration-line`)
   *
   * 단일 값 또는 공백 구분 조합 허용:
   * `"none" | "underline" | "overline" | "line-through"` +
   * `"underline overline"`, `"underline line-through"`, `"overline line-through"`,
   * `"underline overline line-through"`
   */
  textDecoration?: string;

  /** 텍스트 장식 스타일 (CSS `text-decoration-style`) */
  decorationStyle?: "solid" | "dashed" | "dotted" | "double" | "wavy";

  /** 텍스트 장식 색상 (CSS `text-decoration-color`) */
  decorationColor?: string;

  /** 텍스트 변환 */
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";

  /** 최대 너비 (말줄임 처리) */
  maxWidth?: number;

  /** 오버플로우 처리 */
  overflow?: "visible" | "ellipsis" | "clip";

  /** 줄 수 제한 (multiline 텍스트) */
  maxLines?: number;

  /** 줄바꿈 제어 — "nowrap"이면 다중 줄 보정 로직 우회 */
  whiteSpace?: "normal" | "nowrap" | "pre";
}

/**
 * 그림자
 *
 * [적용 방식]
 * - target이 없으면: shapes 배열에서 바로 앞의 도형에 적용
 * - target이 있으면: 해당 id를 가진 도형에 적용
 */
export interface ShadowShape {
  type: "shadow";

  /** 적용 대상 shape의 id (없으면 이전 shape에 적용) */
  target?: string;

  /** 그림자가 적용될 영역 (target 없이 직접 지정 시) */
  x?: number;
  y?: number;
  width?: number | "auto";
  height?: number | "auto";
  radius?: number | [number, number, number, number];

  /** 그림자 오프셋 */
  offsetX: number;
  offsetY: number;

  /** 블러 반경 */
  blur: number;

  /** 확산 (CSS spread) */
  spread?: number;

  /** 그림자 색상 */
  color: ColorValue;

  /** 투명도 */
  alpha?: number;

  /** 내부 그림자 여부 */
  inset?: boolean;
}

/**
 * CSS border-style 값 집합 (Skia nodeRendererBorders 8종 렌더 대응).
 */
export type BorderStyleValue =
  | "solid"
  | "dashed"
  | "dotted"
  | "double"
  | "groove"
  | "ridge"
  | "inset"
  | "outset";

/**
 * 테두리
 *
 * [적용 방식]
 * - target이 없으면: shapes 배열에서 바로 앞의 도형 윤곽에 적용
 * - target이 있으면: 해당 id를 가진 도형에 적용
 */
export interface BorderShape {
  type: "border";

  /** 적용 대상 shape의 id (없으면 이전 shape에 적용) */
  target?: string;

  /** 테두리가 적용될 영역 (target 없이 직접 지정 시) */
  x?: number;
  y?: number;
  width?: number | "auto";
  height?: number | "auto";

  /** 테두리 두께 */
  borderWidth: number;

  /** 테두리 색상 */
  color: ColorValue;

  /**
   * 테두리 스타일. Skia 렌더러(nodeRendererBorders)가 8종 전부 지원하고,
   * 사용자 style.borderStyle(패널 select)도 8종을 방출하므로 CSS border-style
   * 전체 집합을 수용한다. sides(partial_border) 경로는 dashed/dotted 만 dasharray
   * 로 표현하고 나머지는 solid 선으로 degrade.
   */
  style?: BorderStyleValue;

  /** 모서리 반경 */
  radius?: number | [number, number, number, number];

  /** 특정 변만 적용 */
  sides?: {
    top?: boolean;
    right?: boolean;
    bottom?: boolean;
    left?: boolean;
  };
}

/**
 * 컨테이너 레이아웃 설정
 */
export interface ContainerLayout {
  /** 레이아웃 타입 */
  display?: "flex" | "block" | "grid" | "none";

  /** 포지션 타입 */
  position?: "relative" | "absolute";

  /** absolute 포지션일 때 위치 */
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;

  /** z-index (레이어 순서) */
  zIndex?: number;

  // ─── Flex 레이아웃 ───
  flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
  flexWrap?: "nowrap" | "wrap" | "wrap-reverse";
  justifyContent?:
    | "flex-start"
    | "center"
    | "flex-end"
    | "space-between"
    | "space-around"
    | "space-evenly";
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch" | "baseline";
  alignContent?:
    | "flex-start"
    | "center"
    | "flex-end"
    | "stretch"
    | "space-between"
    | "space-around";

  // ─── Grid 레이아웃 ───
  gridTemplateColumns?: string; // "1fr 1fr" | "repeat(3, 100px)"
  gridTemplateRows?: string;
  gridGap?: number | [number, number]; // [rowGap, columnGap]
  gridAutoFlow?: "row" | "column" | "dense";

  // ─── 공통 ───
  gap?: number;
  rowGap?: number;
  columnGap?: number;
  padding?: number | [number, number, number, number];
  margin?: number | [number, number, number, number];

  // ─── 자식 요소용 (flex item) ───
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | "auto";
  alignSelf?: "auto" | "flex-start" | "center" | "flex-end" | "stretch";
}

/**
 * 컨테이너 (자식 요소 그룹)
 */
export interface ContainerShape {
  type: "container";
  x: number;
  y: number;
  width?: number | "auto";
  height?: number | "auto";
  children: Shape[];
  clip?: boolean;

  /** 레이아웃 설정 (@pixi/layout 연동) */
  layout?: ContainerLayout;
}

/**
 * 그라디언트 (ColorPicker, Slider 등에서 사용)
 */
export interface GradientShape {
  type: "gradient";
  x: number;
  y: number;
  width: number | "auto";
  height: number | "auto";
  radius?: number | [number, number, number, number];
  gradient: {
    type: "linear" | "radial" | "conic";
    angle?: number; // linear/conic gradient 각도 (0-360)
    stops: Array<{
      offset: number; // 0-1
      color: ColorValue;
    }>;
  };
}

/**
 * 이미지
 */
export interface ImageShape {
  type: "image";
  x: number;
  y: number;
  width: number | "auto";
  height: number | "auto";
  src: string;
  fit?: "contain" | "cover" | "fill" | "none";
  radius?: number | [number, number, number, number];
}

/**
 * 선
 */
export interface LineShape {
  type: "line";
  x1: number | "auto";
  y1: number | "auto";
  x2: number | "auto";
  y2: number | "auto";
  stroke: ColorValue;
  strokeWidth: number;
  strokeDasharray?: number[];
  strokeCap?: "butt" | "round" | "square";
}

/**
 * 아이콘 (SVG 경로 기반)
 *
 * Lucide 등 아이콘 라이브러리의 SVG 경로 데이터를 사용하여
 * CanvasKit Path로 렌더링. 원본 viewBox는 24x24 기준.
 */
export interface IconFontShape {
  type: "icon_font";
  /** 아이콘 이름 (lucideIcons 레지스트리에서 조회) */
  iconName: string;
  /** 아이콘 라이브러리 (기본: 'lucide') */
  iconFontFamily?: string;
  /** 아이콘 중심 X 좌표 */
  x: number;
  /** 아이콘 중심 Y 좌표 */
  y: number;
  /** 렌더링 크기 (px, 기본: 16) */
  fontSize?: number;
  /** 선 두께 (기본: 2) — Lucide 기본 strokeWidth */
  strokeWidth?: number;
  /** 채우기 색상 (stroke 색상으로 사용) */
  fill?: ColorValue;
  /** 수평 정렬: "center" 시 containerWidth 기준 중앙 배치 */
  align?: "left" | "center" | "right";
  /** 수직 정렬: "middle" 시 containerHeight 기준 수직 중앙 배치 */
  baseline?: "top" | "middle" | "bottom";
}

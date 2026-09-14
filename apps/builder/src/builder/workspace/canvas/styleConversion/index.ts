/**
 * styleConversion — CSS 값을 렌더러 입력으로 바꾸는 변환 계층.
 *
 * - `styleConverter` — CSS 스타일 → 렌더 속성(transform/fill/stroke/text) 변환
 * - `borderGeometry` — border 축 키 10 (shorthand 2 + longhand 8) 판독 단일 진입점 (ADR-219)
 * - `paddingUtils`   — CSS padding 파싱 + 콘텐츠 영역 계산
 * - `tagSpecMap`     — 잔존 spec 3개(Frame/Group/Slot) registry 진입점
 *
 * 소비처는 Skia 렌더 경로(`skia/build*NodeData`, `renderCommands`)와 레이아웃
 * 경로(`layout/engines`) 양쪽이다 — 그래서 `skia/` 안이 아니라 형제 디렉터리다.
 *
 * `styleConversion`은 과거 sprite 계층에서 분리된 순수 변환 계층이다.
 * 현재는 Skia 렌더 데이터와 layout engine이 공통으로 사용한다.
 */

// Style Converter
export {
  convertStyle,
  cssColorToHex,
  cssColorToAlpha,
  parseCSSSize,
} from "./styleConverter";
export {
  resolveBorderGeometry,
  resolveCssCornerRadii,
  resolveInnerCornerRadii,
  isBorderGeometryProp,
  BORDER_GEOMETRY_KEYS,
  BORDER_RADIUS_LONGHANDS,
  BORDER_WIDTH_LONGHANDS,
  BORDER_RADIUS_AXIS_KEYS,
  BORDER_WIDTH_AXIS_KEYS,
} from "./borderGeometry";
export type {
  BorderGeometry,
  BorderGeometryBase,
  CornerRadii,
  SideWidths,
} from "./borderGeometry";
export type {
  CSSStyle,
  RenderTransform,
  RenderFillStyle,
  RenderStrokeStyle,
  RenderTextStyle,
  ConvertedStyle,
} from "./styleConverter";

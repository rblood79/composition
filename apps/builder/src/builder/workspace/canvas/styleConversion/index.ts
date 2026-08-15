/**
 * styleConversion — CSS 값을 렌더러 입력으로 바꾸는 변환 계층.
 *
 * - `styleConverter` — CSS 스타일 → 렌더 속성(transform/fill/stroke/text) 변환
 * - `paddingUtils`   — CSS padding 파싱 + 콘텐츠 영역 계산
 * - `tagSpecMap`     — 잔존 spec 3개(Frame/Group/Slot) registry 진입점
 *
 * 소비처는 Skia 렌더 경로(`skia/build*NodeData`, `renderCommands`)와 레이아웃
 * 경로(`layout/engines`) 양쪽이다 — 그래서 `skia/` 안이 아니라 형제 디렉터리다.
 *
 * **디렉터리명 유래**: 구 이름은 `sprites/` 였다. ADR-100 Phase 9 에서 PixiJS
 * Sprite 컴포넌트(BoxSprite / TextSprite / ImageSprite / ElementSprite)가 전부
 * 삭제되고 위 3개만 남았는데 이름은 그대로였다 — 2026-08-15 잔재 스윕에서
 * 내용에 맞게 고쳤다. 같은 이유로 `PixiTransform` 등 타입 4개도 `Render*` 로
 * 바뀌었다 (해당 렌더러는 PixiJS 가 아니라 Skia 다).
 */

// Style Converter
export {
  convertStyle,
  cssColorToHex,
  cssColorToAlpha,
  parseCSSSize,
} from "./styleConverter";
export type {
  CSSStyle,
  RenderTransform,
  RenderFillStyle,
  RenderStrokeStyle,
  RenderTextStyle,
  ConvertedStyle,
} from "./styleConverter";

/**
 * useResetStyles - 경량 스타일 리셋 훅
 *
 * 🚀 Phase 4.2c: 래퍼 컴포넌트 최적화
 * - 섹션 래퍼 (TransformSection 등)는 resetStyles만 필요
 * - useStyleActions의 useCopyPaste 훅 오버헤드 제거
 * - 안정적인 함수 참조 반환 (host 의 `resetStyles` — 구 store 는 `resetStoreStyles`)
 *
 * 🚀 Body 기본값 보존: Reset 시 컴포넌트 기본값으로 복원
 */

import { useStylesHost } from "../stylesHost";

/**
 * Style Panel 4섹션(Transform / Layout / Appearance / Typography)이 `useHasDirtyStyles` 로 검사하는
 * prop 의 합집합 — reset 버튼 표시 범위의 SSOT.
 *
 * Why: "modify N" 뱃지·Modified Styles 패널(`useDirtyStyleProps`)은 이 범위로만 modified 를 세야
 * reset 버튼과 정합한다. 이 union 밖 키(grid placement: gridColumnStart/End/gridRowStart/End/gridArea,
 * flex shorthand, objectFit 등)는 어느 섹션도 reset 으로 편집하지 않으므로 — modify 가 전 키를 세면
 * grid 자식(ProgressBarValue 등)이 "modify 5" 인데 reset 버튼은 0인 비대칭이 생긴다(2026-06-24).
 * 각 섹션의 {TRANSFORM,LAYOUT,APPEARANCE,TYPOGRAPHY}_PROPS 와 동일 — 섹션 PROPS 변경 시 동반 갱신.
 */
export const PANEL_STYLE_PROPS: readonly string[] = [
  // Transform
  "width",
  "height",
  // ADR-177 이 Transform 에 position row 를 추가하며 `TRANSFORM_PROPS` 에만
  //   들어가 있었다 — reset 은 되는데 modify 가 세지 않는 비대칭
  //   (`panelStylePropsUnion.static` 가 잡는 그 케이스, 2026-08-15 정정).
  "position",
  "top",
  "left",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "alignSelf",
  "justifySelf",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "aspectRatio",
  // Typography
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "color",
  "textAlign",
  "textDecoration",
  "textTransform",
  "verticalAlign",
  "whiteSpace",
  "wordBreak",
  "overflowWrap",
  "textOverflow",
  // Layout
  "display",
  "flexDirection",
  "flexWrap",
  "alignItems",
  "justifyContent",
  "gap",
  "rowGap",
  "columnGap",
  "padding",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  // Appearance
  "backgroundColor",
  "opacity",
  "borderColor",
  "borderWidth",
  "borderRadius",
  "borderStyle",
  // ADR-219 — 비균일 저장 형태 (longhand 8). 전역 (base 비교).
  "borderTopLeftRadius",
  "borderTopRightRadius",
  "borderBottomRightRadius",
  "borderBottomLeftRadius",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "boxShadow",
  "filter",
  "overflow",
];

/**
 * 선택된 요소의 특정 속성들이 기본값과 다른지 확인하는 훅
 * 리셋 버튼 조건부 표시용
 */
export function useHasDirtyStyles(properties: readonly string[]): boolean {
  return useStylesHost().useDirtyStyleProps(properties).length > 0;
}

/**
 * 선택된 요소의 "실제로 변경된(baseline 과 다른)" style prop 목록을 반환하는 훅.
 *
 * Modified Styles 패널 / "modify N" 뱃지가 reset 버튼(`useHasDirtyStyles`)과 동일 baseline 비교를
 * 공유하도록 한다. element 와 부모 체인을 store 에서 읽어 `computeDirtyStyleProps` 에 위임.
 */
export function useDirtyStyleProps(): string[] {
  return useStylesHost().useDirtyStyleProps(PANEL_STYLE_PROPS);
}

/**
 * resetStyles 함수만 반환하는 경량 훅
 * Section 래퍼 컴포넌트용
 *
 * Reset 시 컴포넌트의 기본 스타일 값으로 복원 (완전 삭제가 아님)
 */
export function useResetStyles(): (properties: readonly string[]) => void {
  return useStylesHost().resetStyles;
}

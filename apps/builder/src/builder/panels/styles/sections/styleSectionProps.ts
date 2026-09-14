/**
 * Style 탭 dirty·reset 범위 (탭 dot · PANEL_STYLE_PROPS 정합 가드가 이 리터럴을 읽는다).
 * 절은 Fill · Border · Effect 셋으로 나뉘었다 (panel-ui 02, 2026-09-14) — 각 절 reset 은
 * 아래 FILL/BORDER/EFFECT_PROPS 가 맡고, 이 배열은 그 합집합 + overflow 다.
 */
export const APPEARANCE_PROPS = [
  "backgroundColor",
  "opacity",
  "borderColor",
  "borderWidth",
  "borderRadius",
  "borderStyle",
  "boxShadow",
  // 컨트롤은 Layout 탭 Size 절로 옮겼지만 (panel-ui 01) TRANSFORM_PROPS 에 넣으면
  //   ADR-154 responsive 허용 목록이 넓어진다 — reset·modify 범위는 여기 그대로 두고
  //   Size 절 reset 은 SIZE_PROPS 가 overflow 를 따로 더한다.
  "overflow",
];

/** Fill 절 reset 범위 — fills (canonical) 는 절이 따로 비운다 */
export const FILL_PROPS = ["backgroundColor"];

/** Border 절 reset 범위 */
export const BORDER_PROPS = [
  "borderColor",
  "borderWidth",
  "borderRadius",
  "borderStyle",
];

/** Effect 절 reset 범위 */
export const EFFECT_PROPS = ["opacity", "boxShadow"];

export const LAYOUT_PROPS = [
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
];

/**
 * Size ∪ Position (Layout 탭) — responsiveEligible · panelStylePropsUnion 정적 가드가 이
 * 리터럴을 읽으므로 spread 없이 나열한다 (= ADR-154 breakpoint override 허용 목록).
 */
/** Spacing 절 reset 범위 (LAYOUT_PROPS 의 부분집합 — Layout 절 reset 은 여전히 전부) */
export const SPACING_PROPS = [
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
];

export const TRANSFORM_PROPS = [
  "width",
  "height",
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
];

/** Position 절 reset 범위 */
export const POSITION_PROPS = ["position", "top", "left"];

/** Size 절 reset 범위 = TRANSFORM_PROPS − POSITION_PROPS + overflow (컨트롤이 여기 있다) */
export const SIZE_PROPS = [
  ...TRANSFORM_PROPS.filter((prop) => !POSITION_PROPS.includes(prop)),
  "overflow",
];

export const TYPOGRAPHY_PROPS = [
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
];

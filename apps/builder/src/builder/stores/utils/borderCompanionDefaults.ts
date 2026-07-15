/**
 * Border 편집기 계약 (companion write) — 2026-07-15.
 *
 * CSS `border-style` 초기값이 `none` 이라, borderColor/borderWidth 만 인라인으로
 * 써도 브라우저(Preview DOM)는 테두리를 그리지 않는다. Skia catalog/spec/box 3경로도
 * border 그리기 gate 가 서로 달라 (catalog=borderColor 필요, spec=width+color 동시
 * 필요, box=width|color) 경로별 편차가 있었다. borderColor/borderWidth/borderStyle
 * 중 하나를 처음 설정할 때 나머지 축의 기본값을 store(인라인 style)에 동반 기록해
 * DOM/Skia 4경로가 항상 동일한 3필드를 받도록 한다 (Figma 류 편집기 관례). SSOT(store)
 * 단일 지점에 불변식을 두어 경로별 gate 편차를 구조적으로 소멸시킨다.
 *   - 기본 color: lightColors.border(#d4d4d4) 고정 — DOM↔Skia 동일 hex 로 시각 대칭.
 *   - 기본 width: 1 (숫자 — NUMERIC_STYLE_PROPS 정책과 정합, DOM 은 px 로 직렬화).
 *   - borderStyle="none" 은 테두리 숨김 의도이므로 width/color companion 을 주입하지 않는다.
 */

const BORDER_COMPANION_TRIGGER_PROPS = new Set([
  "borderColor",
  "borderWidth",
  "borderStyle",
]);
const DEFAULT_COMPANION_BORDER_STYLE = "solid";
const DEFAULT_COMPANION_BORDER_WIDTH = 1;
const DEFAULT_COMPANION_BORDER_COLOR = "#d4d4d4"; // lightColors.border (neutral-300)

/**
 * border 축 하나가 설정된 직후(삭제 분기 제외) 호출하여, DOM/Skia 4경로가 테두리를
 * 그리기 위해 필요한 나머지 축(style/width/color)을 store 인라인 style 에 보완 기록한다.
 */
export function applyBorderCompanionDefaults(
  style: Record<string, unknown>,
  property: string,
): void {
  if (!BORDER_COMPANION_TRIGGER_PROPS.has(property)) return;

  // borderStyle 축 보완: property 자체가 borderStyle 이면 사용자 선택값을 유지하고,
  // color/width 를 설정한 경우에만 solid 로 채운다.
  if (property !== "borderStyle" && style.borderStyle == null) {
    style.borderStyle = DEFAULT_COMPANION_BORDER_STYLE;
  }

  // borderStyle="none" — 테두리 숨김 의도. width/color companion 주입 안 함.
  if (style.borderStyle === "none") return;

  if (style.borderWidth == null) {
    style.borderWidth = DEFAULT_COMPANION_BORDER_WIDTH;
  }
  if (style.borderColor == null) {
    style.borderColor = DEFAULT_COMPANION_BORDER_COLOR;
  }
}

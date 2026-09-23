/**
 * ADR-233 round 3 h1 — 선택 표시 (indicator) 를 가진 컴포넌트의 채움 (`fills`) 이 칠하는 곳.
 *
 * catalog 정본은 이런 컴포넌트의 `fill.default.selected` 를 **선택 표시 색**으로 정의한다
 * (Radio: 선택 점). Skia `radio` primitive 도 root 배경색을 선택 점에 칠하고 행 배경은 그리지
 * 않는다. DOM 은 같은 색을 RAC 행 (`label`) 배경이 아니라 수동 CSS 가 선택 표시를 그리는 CSS
 * 변수로 보내야 두 leg 가 같은 곳을 칠한다. 표에 없는 타입은 종전대로 행 배경.
 *
 * Checkbox 등 다른 선택 컨트롤은 같은 비대칭이 있으나 ADR-233 범위 밖 — 표에 추가하면 같은 경로를 탄다.
 */
export const INDICATOR_FILL_CSS_VAR: Readonly<Record<string, string>> = {
  Radio: "--radio-color",
};

export function getIndicatorFillCssVar(type: string): string | undefined {
  return INDICATOR_FILL_CSS_VAR[type];
}

/**
 * inline style 의 `backgroundColor` 를 선택 표시 CSS 변수로 옮긴다 (표에 있는 타입만).
 * 값이 `var(--co-…, baseline)` (ADR-230 상태 변형 inline) 이어도 그대로 옮긴다 — 변수는 같은
 * 요소에서 해소된다.
 */
export function routeIndicatorFillStyle<T extends object>(
  type: string,
  style: T | undefined,
): T | undefined {
  const cssVar = getIndicatorFillCssVar(type);
  const record = style as Record<string, unknown> | undefined;
  if (!cssVar || !record || record.backgroundColor == null) return style;
  const { backgroundColor, ...rest } = record;
  return { ...rest, [cssVar]: backgroundColor } as T;
}

/**
 * colorTokenToCss — D3 색 TokenRef(`{color.X}`) → CSS 값 변환 (DOM 인라인 style 용).
 *
 * **ADR-912 진로 1번 StatusLight proof slice (2026-06-06)**: catalog 발효 leaf 중 시각 구조가
 * archetype 의 "background=컨테이너" 가정에서 벗어나는 outlier(예: StatusLight = dot 인디케이터)는
 * generated CSS(`react-aria-{Type}[data-variant] { background }`, 컨테이너에 칠함)를 쓸 수 없다.
 * 이런 leaf 의 DOM 컴포넌트가 rule 색(`resolveComponentRule(type).variants[v].fill.default.base`,
 * TokenRef)을 dot/sub-element 에 직접 인라인 적용할 때 본 헬퍼로 CSS 값을 얻는다.
 *
 * **표는 하나 (ADR-293)**: `{color.X}` → CSS 값 표는 `@composition/rendering` 의 `colorTokenCssValue`
 * (`tokenResolver.ts`, 생성 CSS 가 쓰는 표) 가 정본이다. 여기는 그 표를 읽기만 한다 — 2026-10-30 전까지
 * 이 파일에 복제본이 있었고 named hue `-subtle` · `elevated` · `disabled` 가 빠져 테마 resolver 의 변수
 * 이름이 생성 CSS 와 어긋났다 (`--purple-subtle` vs `--hue-purple-subtle`).
 */

import { colorTokenCssNames, colorTokenCssValue } from "@composition/rendering";

/**
 * CSS 변수 이름 (`fg-muted`) → 그 변수를 CSS 값으로 쓰는 색 token 이름 (`neutral-subdued`).
 * token 이름과 변수 이름이 같은 색 (`accent-subtle`) 은 표에 없어도 그대로 읽힌다.
 */
export function colorTokenOfCssVar(name: string): string | undefined {
  const css = `var(--${name})`;
  for (const token of colorTokenCssNames())
    if (colorTokenCssValue(token) === css) return token;
  return undefined;
}

/**
 * `{color.X}` TokenRef 또는 직접 CSS 값을 CSS 색 문자열로 변환.
 * - `{color.yellow}` → `var(--hue-yellow)` (light yellow-500 / dark yellow-400 — semantic-palette.css)
 * - 이미 CSS 값(`var(...)`, `#fff`, `rgb(...)`, `oklch(...)`)이면 그대로 passthrough.
 * - 미매핑 토큰은 fallback(기본 `var(--fg-muted)`).
 */
export function colorTokenToCss(
  value: string | undefined,
  fallback = "var(--fg-muted)",
): string {
  if (value == null) return fallback;
  const v = String(value);
  // `{color.X}` 추출
  const m = v.match(/^\{color\.([a-z0-9-]+)\}$/i);
  if (m) return colorTokenCssValue(m[1]!) ?? fallback;
  // 이미 CSS 값
  return v;
}

/**
 * colorTokenToCss — D3 색 TokenRef(`{color.X}`) → CSS 값 변환 (DOM 인라인 style 용).
 *
 * **ADR-912 진로 1번 StatusLight proof slice (2026-06-06)**: catalog 발효 leaf 중 시각 구조가
 * archetype 의 "background=컨테이너" 가정에서 벗어나는 outlier(예: StatusLight = dot 인디케이터)는
 * generated CSS(`react-aria-{Type}[data-variant] { background }`, 컨테이너에 칠함)를 쓸 수 없다.
 * 이런 leaf 의 DOM 컴포넌트가 rule 색(`resolveComponentRule(type).variants[v].fill.default.base`,
 * TokenRef)을 dot/sub-element 에 직접 인라인 적용할 때 본 헬퍼로 CSS 값을 얻는다.
 *
 * **SSOT 정합 (drift 주의)**: 본 매핑은 `packages/specs/src/renderers/utils/tokenResolver.ts` 의
 * COLOR_TOKEN_TO_CSS + NAMED_COLOR_TO_CSS(build-time CSS 생성 source)의 shared 대응이다. specs ←
 * shared 의존 방향 때문에 tokenResolver 를 직접 import 할 수 없어 복제한다. **정답 검증**:
 * `packages/shared/src/components/styles/generated/{Type}.css` 의 `[data-variant] { background }` 값과
 * 본 헬퍼 결과가 일치해야 한다(둘 다 같은 tokenResolver 매핑 파생). css-tokens.md 가 매핑 SSOT.
 * 토큰/매핑 추가 시 generated CSS 와 대조.
 */

import { SEMANTIC_PALETTE_MAP } from "@composition/specs";

/** S2 시맨틱 + named color 토큰 → CSS 값 (tokenResolver 매핑 shared 대응, css-tokens.md SSOT). */
const COLOR_TOKEN_CSS: Record<string, string> = {
  // --- 시맨틱 (S2) ---
  accent: "var(--accent)",
  "on-accent": "var(--fg-on-accent)",
  "accent-subtle": "var(--accent-subtle)",
  neutral: "var(--fg)",
  "neutral-subdued": "var(--fg-muted)",
  "neutral-subtle": "var(--bg-muted)",
  // status — generated/semantic-palette.css 가 light/dark 단계를 정의 (ADR-193, semanticPaletteMap 파생)
  negative: "var(--negative)",
  "on-negative": "var(--color-white)",
  informative: "var(--informative)",
  positive: "var(--positive)",
  notice: "var(--notice)",
  // --- Surface / Border / Special ---
  base: "var(--bg)",
  raised: "var(--bg-raised)",
  "layer-1": "var(--bg-overlay)",
  "layer-2": "var(--bg-inset)",
  border: "var(--border)",
  transparent: "transparent",
  white: "var(--color-white)",
  black: "var(--color-black)",
  // --- Named hue — `--hue-{token}` 은 generated/semantic-palette.css 가 테마별 팔레트 단계로 정의 (ADR-193).
  //     `--indigo` 류 접두 없는 이름은 preview-system tint preset 이 점유하므로 접두 필수.
  //     단계 정본은 packages/specs semanticPaletteMap.ts (Skia colors.ts 와 같은 표 — semanticAlias.symmetry.test 가 대조).
  purple: "var(--hue-purple)",
  gray: "var(--hue-gray)",
  red: "var(--hue-red)",
  orange: "var(--hue-orange)",
  yellow: "var(--hue-yellow)",
  blue: "var(--hue-blue)",
  indigo: "var(--hue-indigo)",
  cyan: "var(--hue-cyan)",
  pink: "var(--hue-pink)",
  turquoise: "var(--hue-turquoise)",
  fuchsia: "var(--hue-fuchsia)",
  magenta: "var(--hue-magenta)",
  celery: "var(--hue-celery)",
  chartreuse: "var(--hue-chartreuse)",
  seafoam: "var(--hue-seafoam)",
  cinnamon: "var(--hue-cinnamon)",
  brown: "var(--hue-brown)",
  silver: "var(--hue-silver)",
};

// hover/pressed 파생 — tokenResolver 와 동일 규칙 (ADR-193 후속). 이전엔 키가 없어 fallback `--fg-muted` 로 떨어졌다 (review l2).
for (const [token, entry] of Object.entries(SEMANTIC_PALETTE_MAP)) {
  if (token.endsWith("-subtle")) continue;
  COLOR_TOKEN_CSS[`${token}-hover`] ??=
    `color-mix(in srgb, var(${entry.cssVar}) 85%, black)`;
  COLOR_TOKEN_CSS[`${token}-pressed`] ??=
    `color-mix(in srgb, var(${entry.cssVar}) 75%, black)`;
}
COLOR_TOKEN_CSS["accent-hover"] ??= "color-mix(in srgb, var(--accent) 85%, black)";
COLOR_TOKEN_CSS["accent-pressed"] ??= "color-mix(in srgb, var(--accent) 75%, black)";
COLOR_TOKEN_CSS["neutral-hover"] ??= "color-mix(in srgb, var(--bg-muted) 85%, black)";
COLOR_TOKEN_CSS["neutral-pressed"] ??= "color-mix(in srgb, var(--bg-muted) 75%, black)";

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
  if (m) return COLOR_TOKEN_CSS[m[1]] ?? fallback;
  // 이미 CSS 값
  return v;
}

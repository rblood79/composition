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

/** S2 시맨틱 + named color 토큰 → CSS 값 (tokenResolver 매핑 shared 대응, css-tokens.md SSOT). */
const COLOR_TOKEN_CSS: Record<string, string> = {
  // --- 시맨틱 (S2) ---
  accent: "var(--accent)",
  "on-accent": "var(--fg-on-accent)",
  "accent-subtle": "var(--accent-subtle)",
  neutral: "var(--fg)",
  "neutral-subdued": "var(--fg-muted)",
  "neutral-subtle": "var(--bg-muted)",
  negative: "var(--negative)",
  "on-negative": "var(--color-white)",
  informative: "var(--color-info-600)",
  positive: "var(--color-green-600)",
  notice: "var(--color-warning-600)",
  // --- Surface / Border / Special ---
  base: "var(--bg)",
  raised: "var(--bg-raised)",
  "layer-1": "var(--bg-overlay)",
  "layer-2": "var(--bg-inset)",
  border: "var(--border)",
  transparent: "transparent",
  white: "var(--color-white)",
  black: "var(--color-black)",
  // --- Named color (S2 global semantic 없음 — generated CSS 정답지 기준) ---
  purple: "var(--color-purple-600)",
  gray: "var(--color-neutral-500)",
  red: "var(--color-red-600)",
  orange: "var(--color-orange-600)",
  yellow: "var(--color-yellow-500)",
  blue: "var(--color-blue-600)",
  indigo: "var(--color-indigo-700)",
  cyan: "var(--color-cyan-600)",
  pink: "var(--color-pink-600)",
  turquoise: "var(--color-teal-500)",
  fuchsia: "var(--color-fuchsia-600)",
  magenta: "var(--color-pink-700)",
  celery: "var(--color-lime-600)",
  chartreuse: "var(--color-lime-500)",
  // Spectrum 전용 hue — Tailwind 에 같은 이름이 없어 가장 가까운 family 로 고정. Skia colors.ts 와 같은 단계
  // (semanticAlias.symmetry.test 가 대조). 예전 var(--seafoam) 등은 어디에도 정의가 없던 undefined 참조.
  seafoam: "var(--color-teal-700)",
  cinnamon: "var(--color-amber-800)",
  brown: "var(--color-yellow-900)",
  silver: "var(--color-gray-400)",
};

/**
 * `{color.X}` TokenRef 또는 직접 CSS 값을 CSS 색 문자열로 변환.
 * - `{color.yellow}` → `var(--color-yellow-500)`
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

/**
 * ADR-916 P2-CAT ② L0 — primitive ↔ CSS typography parity (독립 권위 leg).
 *
 * catalog 정적 스냅샷의 fontSize/lineHeight 는 `resolveToken`(primitive typography.ts)
 * 으로 숫자화된다. 그 값이 CSS Preview 의 `--text-*`(shared-tokens.css)와 발산하면
 * CSS↔Skia 시각 발산(D3 위반)이다. 이 모듈은 CSS 파일 **텍스트를 직접 파싱**해
 * (resolveToken 미경유 = shared-fault 회피) 독립 권위로 대조한다.
 *
 * 순수 파서 — DOM/브라우저 미의존, live 영향 0.
 */

/** CSS root font-size 기준 (rem → px). Tailwind v4 표준 16px. */
const ROOT_FONT_PX = 16;

/**
 * `<n>rem` → px. rem 만 지원(catalog typography 는 전부 rem). 비-rem 은 throw
 * (조용한 fallback 금지 — 발산을 숫자로 만들지 않음).
 */
export function cssFontSizeToPx(value: string): number {
  const m = value.trim().match(/^([\d.]+)rem$/);
  if (!m) {
    throw new Error(`[typographyCssParity] rem fontSize 아님: ${value}`);
  }
  return parseFloat(m[1]) * ROOT_FONT_PX;
}

/**
 * `calc(<a> / <b>)` line-height 배율 × fontSize_px → px.
 * CSS line-height 는 unitless 배율(calc 로 fontSize 독립 표현)이라 fontSize 를
 * 곱해 px 로 만든다. 부동소수 오차는 반올림(primitive 는 정수 px).
 */
export function cssLineHeightToPx(value: string, fontSizePx: number): number {
  const m = value.trim().match(/^calc\(\s*([\d.]+)\s*\/\s*([\d.]+)\s*\)$/);
  if (!m) {
    throw new Error(
      `[typographyCssParity] calc(a / b) line-height 아님: ${value}`,
    );
  }
  const ratio = parseFloat(m[1]) / parseFloat(m[2]);
  return Math.round(ratio * fontSizePx);
}

/**
 * ADR-916 P2-CAT ② R10 — 알려진 primitive↔CSS 발산 ledger (침묵 skip 금지).
 *
 * L0 oracle 이 검출한 실발산을 **명시 등록**한다. positive 전수 대조는 이 ledger 에
 * 등록된 발산만 예외 처리하고, 그 외 신규 발산은 RED 로 잡는다(발산이 조용히
 * 늘어나는 것을 차단). 실수정(어느 값이 정본인지 판정 + Skia/DOM 동시 정렬)은
 * 별도 D3 symmetric 단위(R10) — 본 ledger 는 "발산 존재 + 양값"만 기록한다.
 *
 * key = `${token}:${channel}`. value = { primitive, css, note }.
 */
export const KNOWN_TYPOGRAPHY_DIVERGENCES: ReadonlyMap<
  string,
  { primitive: number; css: number; note: string }
> = new Map([
  [
    "text-xl:lineHeight",
    {
      primitive: 30,
      css: 28,
      note:
        "primitive typography.ts 주석 '20 × 1.5 = 30' vs CSS calc(1.75 / 1.25) × 20px = 28. " +
        "실수정(정본 판정 + Skia/DOM 동시 정렬)은 별도 D3 symmetric 단위.",
    },
  ],
]);

/** 파싱 결과 — token name(예: "text-sm") → px. */
export interface CssTypographyTokens {
  fontSize: Map<string, number>;
  lineHeight: Map<string, number>;
}

/**
 * CSS 텍스트에서 `--text-*` fontSize + `--text-*--line-height` 를 파싱.
 * line-height 는 pairing fontSize(px)를 곱해 px 화한다. fontSize 미존재 name 의
 * line-height 는 skip(pairing 불가).
 */
export function parseCssTypographyTokens(css: string): CssTypographyTokens {
  const fontSize = new Map<string, number>();
  const lineHeight = new Map<string, number>();

  // --text-<name>: <n>rem;  (line-height suffix 제외)
  const fsRe = /--text-([a-z0-9-]+?):\s*([\d.]+rem)\s*;/gi;
  for (const m of css.matchAll(fsRe)) {
    const name = m[1];
    if (name.endsWith("--line-height")) continue; // suffix 는 아래에서
    fontSize.set(`text-${name}`, cssFontSizeToPx(m[2]));
  }

  // --text-<name>--line-height: calc(a / b);
  const lhRe = /--text-([a-z0-9-]+?)--line-height:\s*(calc\([^)]+\))\s*;/gi;
  for (const m of css.matchAll(lhRe)) {
    const key = `text-${m[1]}`;
    const fsPx = fontSize.get(key);
    if (fsPx === undefined) continue; // pairing fontSize 없으면 skip
    lineHeight.set(key, cssLineHeightToPx(m[2], fsPx));
  }

  return { fontSize, lineHeight };
}

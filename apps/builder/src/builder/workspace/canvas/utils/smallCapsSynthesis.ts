/**
 * font-variant: small-caps 합성 (2026-09-20, 사용자 지시).
 *
 * 번들 폰트 (Pretendard · Inter Variable) 에는 `smcp` OpenType feature 가 없다 → Chrome 은 소문자를
 * **대문자 글리프 × 0.7 크기** 로 합성한다 (Blink `kSmallCapsFontSizeMultiplier`). CanvasKit 은 feature
 * 태그만 넘기면 폰트에 없으니 아무것도 안 해 소문자 그대로 그렸다 (Preview "BYE BYE" ↔ Canvas "bye bye").
 *
 * 측정은 Canvas 2D `ctx.font = "small-caps …"` 가 Chrome DOM 과 같은 값을 낸다 (실측 "bye bye" 16px
 * Pretendard: DOM 44.0625 == ctx 44.0625) — `buildFontString` 이 접두어를 붙인다. 렌더는 여기서 나눈
 * run 마다 CanvasKit TextStyle 을 push 한다 (소문자 run 은 대문자 · fontSize × SMALL_CAPS_SCALE).
 */

/** Blink 의 합성 small-caps 배율. */
export const SMALL_CAPS_SCALE = 0.7;

export interface SmallCapsRun {
  text: string;
  /** true 면 대문자로 바뀐 글자 — 축소 크기로 그린다. */
  small: boolean;
}

/** CSS `font-variant-caps` 값 — Canvas 2D `ctx.fontVariantCaps` 도 같은 집합을 받는다. */
const FONT_VARIANT_CAPS = new Set([
  "small-caps",
  "all-small-caps",
  "petite-caps",
  "all-petite-caps",
  "unicase",
  "titling-caps",
]);

export function normalizeFontVariantCaps(
  fontVariant: string | undefined,
): string {
  const v = fontVariant?.trim().toLowerCase() ?? "normal";
  return FONT_VARIANT_CAPS.has(v) ? v : "normal";
}

/** 측정 ctx 에 font-variant-caps 를 싣는다 (`ctx.font =` 뒤에 — shorthand 가 normal 로 되돌린다). */
export function applyFontVariantCaps(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  fontVariant: string | undefined,
): void {
  if (!("fontVariantCaps" in ctx)) return;
  const next = normalizeFontVariantCaps(fontVariant);
  const target = ctx as { fontVariantCaps: string };
  if (target.fontVariantCaps !== next) target.fontVariantCaps = next;
}

/**
 * 렌더 합성 대상 — Chrome 이 폰트에 feature 가 없을 때 글리프를 합성하는 값. small-caps · petite-caps 는
 * 소문자만, all-* 는 전부 (Chrome 실측 2026-09-20: all-small-caps 는 숫자·한글까지 0.7). unicase ·
 * titling-caps 는 Chrome 도 합성하지 않는다 (feature 태그만).
 */
export function isSyntheticSmallCaps(fontVariant: string | undefined): boolean {
  const v = normalizeFontVariantCaps(fontVariant);
  return v !== "normal" && v !== "unicase" && v !== "titling-caps";
}

const isLowercaseLetter = (ch: string): boolean =>
  ch !== ch.toUpperCase() && ch === ch.toLowerCase();

/**
 * 텍스트를 (합성 대상 run · 그 외 run) 으로 나눈다. small-caps · petite-caps: 소문자만 (`\n` · 공백 ·
 * 숫자 · 한글 · 대문자는 본문 크기). all-small-caps · all-petite-caps: `\n` 만 빼고 전부 축소 — Chrome 이
 * 텍스트 전체를 합성 폰트 (× 0.7) 로 그린다 (숫자 · 한글 포함).
 */
export function splitSmallCapsRuns(
  text: string,
  fontVariant: string | undefined,
): SmallCapsRun[] {
  const v = normalizeFontVariantCaps(fontVariant);
  const allCaps = v === "all-small-caps" || v === "all-petite-caps";
  const runs: SmallCapsRun[] = [];
  for (const ch of text) {
    const small = allCaps ? ch !== "\n" : isLowercaseLetter(ch);
    const out = small ? ch.toUpperCase() : ch;
    const last = runs[runs.length - 1];
    if (last && last.small === small) last.text += out;
    else runs.push({ text: out, small });
  }
  return runs;
}

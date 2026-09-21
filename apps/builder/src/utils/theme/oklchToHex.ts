/**
 * oklch → hex 변환 순수 함수
 *
 * oklch → oklab → linear-srgb → srgb → hex 변환 체인
 * culori 라이브러리 없이 순수 수학 연산만 사용 (번들 크기 절약)
 *
 * @see https://www.w3.org/TR/css-color-4/#color-conversion-code
 */

/** oklch → oklab 변환 */
function oklchToOklab(
  l: number,
  c: number,
  h: number,
): [number, number, number] {
  const hRad = (h * Math.PI) / 180;
  return [l, c * Math.cos(hRad), c * Math.sin(hRad)];
}

/** oklab → linear-srgb 변환 */
function oklabToLinearSrgb(
  L: number,
  a: number,
  b: number,
): [number, number, number] {
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  return [
    +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** linear-srgb → srgb 감마 보정 */
function linearToSrgb(c: number): number {
  if (c <= 0.0031308) return 12.92 * c;
  return 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

/** 0~1 float → 0~255 정수 (clamp 포함) */
function toUint8(v: number): number {
  return Math.max(0, Math.min(255, Math.round(v * 255)));
}

/**
 * oklch 색상을 hex 문자열로 변환
 *
 * @param l - Lightness (0~1)
 * @param c - Chroma (0~0.4)
 * @param h - Hue (0~360)
 * @returns '#rrggbb' hex 문자열
 */
export function oklchToHex(l: number, c: number, h: number): string {
  const [L, a, b] = oklchToOklab(l, c, h);
  const [lr, lg, lb] = oklabToLinearSrgb(L, a, b);
  const r = toUint8(linearToSrgb(lr));
  const g = toUint8(linearToSrgb(lg));
  const bVal = toUint8(linearToSrgb(lb));

  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bVal.toString(16).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────
// ADR-227 — 역변환 (hex → oklch). 사용자가 accent 를 hex 로 주면 tint 프리셋과 같은 (c, h) 로
//   접어 두 leg 가 같은 파생 (L 55% accent · hover/pressed mix · subtle · chart) 을 쓴다.
//   CSS 쪽은 `--tint: #hex` 를 `oklch(from var(--tint) L c h)` 가 같은 식으로 읽는다.
// ─────────────────────────────────────────────

function srgbToLinear(c: number): number {
  if (c <= 0.04045) return c / 12.92;
  return Math.pow((c + 0.055) / 1.055, 2.4);
}

function linearSrgbToOklab(
  r: number,
  g: number,
  b: number,
): [number, number, number] {
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ];
}

/** `#rgb` / `#rrggbb` / `#rrggbbaa` → `{ l, c, h }` (h 는 0~360). 파싱 실패면 null. */
export function hexToOklch(
  hex: string,
): { l: number; c: number; h: number } | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(hex.trim());
  if (!m) return null;
  let s = m[1]!;
  if (s.length === 3) s = s.split("").map((ch) => ch + ch).join("");
  const r = parseInt(s.slice(0, 2), 16) / 255;
  const g = parseInt(s.slice(2, 4), 16) / 255;
  const b = parseInt(s.slice(4, 6), 16) / 255;
  const [L, a, bb] = linearSrgbToOklab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b));
  const c = Math.sqrt(a * a + bb * bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c, h };
}

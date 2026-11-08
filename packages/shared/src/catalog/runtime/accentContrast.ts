/**
 * WCAG 2 대비 (순수 · 의존 0) — ADR-302 사다리 생성 (`ladderGenerate.ts`) 과 G3 가 읽는다.
 * (ADR-290 의 명도 탐색 `solveLightness` 는 ADR-302 사다리 생성으로 대체돼 삭제.)
 */

/** WCAG 2 상대 휘도 — hex6 (`#rrggbb`). hex 가 아니면 NaN. */
export function relativeLuminance(hex: string): number {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return Number.NaN;
  const n = parseInt(m[1]!, 16);
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel((n >> 16) & 0xff) +
    0.7152 * channel((n >> 8) & 0xff) +
    0.0722 * channel(n & 0xff)
  );
}

/** WCAG 2 대비 (1 ~ 21). 어느 쪽이든 hex 가 아니면 NaN. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

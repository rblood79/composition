/**
 * Layout 섹션 Columns · Rows 의 트랙 목록 (2026-10-16 사용자 보고).
 *
 * 개수 n 은 `repeat(n, minmax(0, 1fr))` 로 쓴다 — 칸이 grid 의 정해 둔 크기만 나눈다. 단독 `1fr` 은
 * CSS 에서 `minmax(auto, 1fr)` 라 안의 요소 width · height 를 크게 늘리면 칸이 그 요소에 맞춰 커져
 * 격자가 grid 크기를 벗어났다 (Canvas 엔진 · Chrome 모두). Figma 처럼 칸은 grid 크기 그대로, 큰 요소는
 * 칸을 넘친다.
 */

/**
 * One even track: the grid's size shared, never grown by an item. A plain `1fr` (written before
 * 2026-10-16) is not one — the field shows it as text, and typing the count rewrites it.
 */
const EVEN_TRACK = /^minmax\(\s*0(?:px)?\s*,\s*1fr\s*\)$/;

/** `n` even tracks. */
export function gridTrackTemplate(count: number): string {
  return `repeat(${count}, minmax(0, 1fr))`;
}

/**
 * The count of an even template (`repeat(n, minmax(0, 1fr))` or a list of those — `""` when
 * empty); null for any other template (the field shows it as text).
 */
export function gridTrackCount(template: string): string | null {
  const value = template.trim();
  if (!value) return "";
  const repeat = /^repeat\(\s*(\d+)\s*,\s*(.+)\)$/.exec(value);
  if (repeat) return EVEN_TRACK.test(repeat[2]!.trim()) ? repeat[1]! : null;
  const tokens = value.match(/minmax\([^)]*\)|\S+/g) ?? [];
  return tokens.every((token) => EVEN_TRACK.test(token))
    ? String(tokens.length)
    : null;
}

/** A typed count becomes `n` even tracks; empty removes the template; other text is kept. */
export function gridTemplateOf(input: string): string {
  const value = input.trim();
  if (!value) return "";
  const count = Number(value);
  return Number.isInteger(count) && count > 0 ? gridTrackTemplate(count) : value;
}

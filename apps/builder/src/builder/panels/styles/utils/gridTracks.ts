/**
 * Layout 섹션 Columns · Rows 의 트랙 목록 (2026-10-16 사용자 보고).
 *
 * 개수 n 은 `repeat(n, minmax(0, 1fr))` 로 쓴다 — 칸이 grid 의 정해 둔 크기만 나눈다. 단독 `1fr` 은
 * CSS 에서 `minmax(auto, 1fr)` 라 안의 요소 width · height 를 크게 늘리면 칸이 그 요소에 맞춰 커져
 * 격자가 grid 크기를 벗어났다 (Canvas 엔진 · Chrome 모두). Figma 처럼 칸은 grid 크기 그대로, 큰 요소는
 * 칸을 넘친다.
 */

/** `n` even tracks. */
export function gridTrackTemplate(count: number): string {
  return `repeat(${count}, minmax(0, 1fr))`;
}

/** A typed count becomes `n` even tracks; empty removes the template; other text is kept. */
export function gridTemplateOf(input: string): string {
  const value = input.trim();
  if (!value) return "";
  const count = Number(value);
  return Number.isInteger(count) && count > 0 ? gridTrackTemplate(count) : value;
}

/**
 * One track of the Layout section's track list (Figma grid — 2026-10-16 사용자 지시 「열·행별 크기
 * 설정부터 진행해」): Fixed (`120px`), Fill — a share of the grid size (`minmax(0, 2fr)`, the weight) —
 * or Hug — its largest item (`auto`).
 */
export type GridTrack =
  | { kind: "fixed"; px: number }
  | { kind: "fill"; weight: number }
  | { kind: "hug" };

const NUMBER = String.raw`\d+(?:\.\d+)?`;

function trackOfToken(token: string): GridTrack | null {
  const value = token.trim();
  const px = new RegExp(`^(${NUMBER})(?:px)?$`).exec(value);
  if (px) return { kind: "fixed", px: Number(px[1]) };
  const fill =
    new RegExp(`^minmax\\(\\s*0(?:px)?\\s*,\\s*(${NUMBER})fr\\s*\\)$`).exec(
      value,
    ) ?? new RegExp(`^(${NUMBER})fr$`).exec(value);
  if (fill) return { kind: "fill", weight: Number(fill[1]) };
  if (value === "auto") return { kind: "hug" };
  return null;
}

/** Top-level tokens of a template (a `repeat(…)` / `minmax(…)` is one token). */
function topLevelTokens(template: string): string[] {
  const tokens: string[] = [];
  let depth = 0;
  let current = "";
  for (const char of template.trim()) {
    if (char === "(") depth++;
    if (char === ")") depth--;
    if (/\s/.test(char) && depth === 0) {
      if (current) tokens.push(current);
      current = "";
    } else current += char;
  }
  if (current) tokens.push(current);
  return tokens;
}

/**
 * The tracks of a template — `[]` when empty; null for a template the list cannot show (`%`,
 * `auto-fill`, a `minmax` with a length minimum, named lines …): the field keeps it as text.
 */
export function gridTrackList(template: string): GridTrack[] | null {
  const tracks: GridTrack[] = [];
  for (const token of topLevelTokens(template)) {
    const repeat = /^repeat\(\s*(\d+)\s*,\s*(.+)\)$/.exec(token);
    if (repeat) {
      const inner = gridTrackList(repeat[2]!);
      const count = Number(repeat[1]);
      if (!inner?.length || count < 1) return null;
      for (let i = 0; i < count; i++) tracks.push(...inner);
      continue;
    }
    const track = trackOfToken(token);
    if (!track) return null;
    tracks.push(track);
  }
  return tracks;
}

function trackToken(track: GridTrack): string {
  if (track.kind === "fixed") return `${track.px}px`;
  if (track.kind === "hug") return "auto";
  return `minmax(0, ${track.weight}fr)`;
}

/** The template of a track list — even Fill tracks stay `repeat(n, minmax(0, 1fr))`. */
export function gridTrackListTemplate(tracks: readonly GridTrack[]): string {
  if (!tracks.length) return "";
  if (tracks.every((track) => track.kind === "fill" && track.weight === 1))
    return gridTrackTemplate(tracks.length);
  return tracks.map(trackToken).join(" ");
}

/** A track as the track field shows it: `120px` · `2fr` (Fill weight) · `fit-content` (Hug). */
export function gridTrackValue(track: GridTrack): string {
  if (track.kind === "fixed") return `${track.px}px`;
  if (track.kind === "hug") return "fit-content";
  return `${track.weight}fr`;
}

/** The track a field value names (`120px` · `120` · `2fr` · `fit-content` · `auto`); else null. */
export function gridTrackOfValue(value: string): GridTrack | null {
  const text = value.trim();
  if (text === "fit-content" || text === "fit" || text === "auto")
    return { kind: "hug" };
  const track = trackOfToken(text);
  if (!track) return null;
  if (track.kind === "fixed" && track.px <= 0) return null;
  if (track.kind === "fill" && track.weight <= 0) return null;
  return track;
}

/** `count` tracks: the first ones kept, new ones Fill (1) — a count edit keeps the sized tracks. */
export function gridTrackListResized(
  tracks: readonly GridTrack[],
  count: number,
): GridTrack[] {
  const out = tracks.slice(0, count);
  while (out.length < count) out.push({ kind: "fill", weight: 1 });
  return out;
}

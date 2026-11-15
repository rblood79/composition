/**
 * ADR-310 Phase 8 — a virtual-scrolled Table's column widths: the px each of its shared column
 * tracks (`_tableTracks` — the Canvas's grid, `tableTracks.ts`) takes at the scroll box's width,
 * for RAC's `TableLayout` (`columnWidths`). RAC's own `TableColumnLayout` rounds each width to a
 * whole px and reads a selection or drag Column without a width as `1fr`; the Canvas lays the
 * tracks out as a CSS grid — so the `Layout` takes the grid's widths.
 *
 * The CSS Grid track sizing algorithm (css-grid-2 §12) for the closed set of tracks a Column makes
 * (`catalogColumnTrack`): `Npx`, `N%`, `minmax(<px|%>, Nfr)`, `minmax(Npx, N%)` — no content-sized
 * track, so §12.5 leaves each base at its fixed minimum. Free space first grows the fixed tracks to
 * their limits (§12.6 — equally, freezing at a limit), then the fr tracks share what is left
 * (§12.7.1, a track whose minimum beats its share sized as inflexible). Pure.
 */
interface Track {
  base: number;
  limit: number;
  /** The flex factor of an `fr` max (0 = fixed). */
  flex: number;
}

const LENGTH = /^(\d+(?:\.\d+)?)(px|%)$/;
const FR = /^(\d+(?:\.\d+)?)fr$/;

function length(value: string, width: number): number | undefined {
  const match = LENGTH.exec(value.trim());
  if (!match) return undefined;
  const number = Number(match[1]);
  return match[2] === "%" ? (number * width) / 100 : number;
}

function parseTrack(track: string, width: number): Track | undefined {
  const text = track.trim();
  const minmax = /^minmax\((.+),(.+)\)$/.exec(text);
  if (!minmax) {
    const fixed = length(text, width);
    return fixed === undefined
      ? undefined
      : { base: fixed, limit: fixed, flex: 0 };
  }
  const min = length(minmax[1]!, width);
  if (min === undefined) return undefined;
  const fr = FR.exec(minmax[2]!.trim());
  if (fr) return { base: min, limit: min, flex: Number(fr[1]) };
  const max = length(minmax[2]!, width);
  if (max === undefined) return undefined;
  // (A max below the min is the min — css-grid-2 §7.2.4.)
  return { base: min, limit: Math.max(min, max), flex: 0 };
}

/** The tracks' px widths at `width` (undefined when a track is not one a Column makes). */
export function catalogTableTrackWidths(
  tracks: readonly string[],
  width: number,
): number[] | undefined {
  const parsed = tracks.map((track) => parseTrack(track, width));
  if (parsed.some((track) => !track)) return undefined;
  const sized = parsed as Track[];
  // §12.6 Maximize Tracks: the free space grows the fixed tracks equally up to their limits.
  let free = width - sized.reduce((sum, track) => sum + track.base, 0);
  let growing = sized.filter((track) => track.limit > track.base);
  while (free > 1e-9 && growing.length) {
    const share = free / growing.length;
    let spent = 0;
    for (const track of growing) {
      const grow = Math.min(share, track.limit - track.base);
      track.base += grow;
      spent += grow;
    }
    free -= spent;
    growing = growing.filter((track) => track.limit - track.base > 1e-9);
  }
  // §12.7.1 Find the Size of an fr: the leftover over the flex factors; a flexible track whose
  // base beats its share is sized as inflexible and the share found again.
  const flexible = new Set(sized.filter((track) => track.flex > 0));
  for (;;) {
    if (!flexible.size) break;
    const leftover =
      width -
      sized
        .filter((track) => !flexible.has(track))
        .reduce((sum, track) => sum + track.base, 0);
    const flexSum = Math.max(
      1,
      [...flexible].reduce((sum, track) => sum + track.flex, 0),
    );
    const fr = Math.max(0, leftover) / flexSum;
    const inflexible = [...flexible].filter(
      (track) => track.base > fr * track.flex,
    );
    if (inflexible.length) {
      for (const track of inflexible) flexible.delete(track);
      continue;
    }
    for (const track of flexible)
      track.base = Math.max(track.base, fr * track.flex);
    break;
  }
  return sized.map((track) => track.base);
}

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

/** A track list's tracks (spaces inside parentheses stay — `minmax(75px, 1fr)`). */
function splitTracks(list: string): string[] {
  const tracks: string[] = [];
  let depth = 0;
  let track = "";
  for (const char of list) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (/\s/.test(char) && !depth) {
      if (track) tracks.push(track);
      track = "";
    } else track += char;
  }
  if (track) tracks.push(track);
  return tracks;
}

const PX_MIN_MAX = /\b(min|max)\(\s*([\d.]+)px\s*,\s*([\d.]+)px\s*\)/;

/** The device's px of the columns that follow it (`useCatalogTableDeviceColumns` — the DOM runtime's). */
export interface CatalogTableDeviceColumns {
  /** The selection column's CSS variable (`CATALOG_SELECTION_COLUMN_VAR`). */
  readonly selectionVar: string;
  /** `{size.table.selection-column}` at this device (S2 40 · touch 52). */
  readonly selection: number;
  /** The drag column at this device (S2 16 · touch 20). */
  readonly drag: number;
}

/**
 * The tracks the DOM's grid lays a Table's row on at this device — the `Layout` sizes the columns
 * as the Preview draws them. The Canvas's tracks (`_tableTracks`) hold the desktop px; a selection
 * column without an authored width follows S2 `{size.table.selection-column}` (40 · touch 52 — its
 * device track `_tableDeviceTracks`, clamped by an authored px floor · max) and a dragging Table's
 * first column the device-scaled 16 (`_allowsDragging` — the DOM's `catalogDeviceScaledCss`).
 * (The device values come from the DOM runtime: a static import from the virtual chunk would split
 * their modules into chunks of their own — +1.3 KB on the initial bundle, measured.)
 */
export function catalogDeviceColumnTracks(
  tracks: readonly string[],
  /** The Row's `_tableDeviceTracks`. */
  deviceTracks: string | undefined,
  drag: boolean,
  device: CatalogTableDeviceColumns,
): readonly string[] {
  const split = deviceTracks ? splitTracks(deviceTracks) : [];
  const out = (split.length === tracks.length ? split : [...tracks]).map(
    (track) => {
      let text = track.replaceAll(
        `var(${device.selectionVar})`,
        `${device.selection}px`,
      );
      for (let match; (match = PX_MIN_MAX.exec(text)); ) {
        const pick = match[1] === "min" ? Math.min : Math.max;
        text = text.replace(
          match[0],
          `${pick(Number(match[2]), Number(match[3]))}px`,
        );
      }
      return text;
    },
  );
  if (drag && out.length) out[0] = `${device.drag}px`;
  return out;
}

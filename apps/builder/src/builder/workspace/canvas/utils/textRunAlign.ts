/**
 * ADR-299 — run ranges over a text, carried to the text the paragraph is built from. White-space
 * processing (`collapseTextWhiteSpace` — spaces and segment breaks fold, lines trim) removes
 * characters and the break hints (`\n` for a Canvas 2D line break, `​` for `break-all`) insert
 * or replace them: the run of each kept character goes with it, an inserted hint takes its
 * neighbour's run. The paint and the layout measure align the same way, so their paragraphs are
 * built from the same styled runs.
 */
export interface TextRunRange {
  readonly start: number;
  readonly end: number;
}

const HINTS = new Set(["\n", "​"]);
const SPACE = /\s/;

/**
 * `ranges` (over `source`) as ranges over `target`, each with its own fields. Characters outside
 * every range (a label suffix) stay outside. Empty ranges are dropped.
 */
export function alignTextRuns<T extends TextRunRange>(
  source: string,
  ranges: readonly T[],
  target: string,
): T[] {
  if (source === target) return ranges.filter((run) => run.end > run.start);
  const owner = new Int32Array(source.length).fill(-1);
  ranges.forEach((run, index) => {
    for (let at = run.start; at < run.end && at < source.length; at++)
      owner[at] = index;
  });
  const out = new Int32Array(target.length).fill(-1);
  let i = 0;
  for (let j = 0; j < target.length; j++) {
    const char = target[j]!;
    if (i < source.length && source[i] === char) {
      out[j] = owner[i]!;
      i++;
      continue;
    }
    if (HINTS.has(char)) {
      // A space the hint replaced (the next characters line up again) — else an insertion.
      if (
        i < source.length &&
        SPACE.test(source[i]!) &&
        (j + 1 >= target.length ||
          i + 1 >= source.length ||
          source[i + 1] === target[j + 1])
      ) {
        out[j] = owner[i]!;
        i++;
      } else out[j] = owner[Math.max(0, Math.min(i, source.length) - 1)] ?? -1;
      continue;
    }
    // Folded white space: skip source characters until this one.
    while (i < source.length && source[i] !== char && SPACE.test(source[i]!))
      i++;
    out[j] = i < source.length ? owner[i]! : -1;
    if (i < source.length) i++;
  }
  const result: T[] = [];
  let start = 0;
  for (let j = 1; j <= target.length; j++) {
    if (j < target.length && out[j] === out[start]) continue;
    const index = out[start]!;
    if (index >= 0 && j > start)
      result.push({ ...ranges[index]!, start, end: j });
    start = j;
  }
  return result;
}

/** The ranges inside `[from, to)`, shifted to start at 0 (one hard-broken line of a `pre` text). */
export function sliceTextRuns<T extends TextRunRange>(
  ranges: readonly T[],
  from: number,
  to: number,
): T[] {
  const out: T[] = [];
  for (const run of ranges) {
    const start = Math.max(run.start, from);
    const end = Math.min(run.end, to);
    if (end > start) out.push({ ...run, start: start - from, end: end - from });
  }
  return out;
}

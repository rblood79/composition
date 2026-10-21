/**
 * The data-store collections whose table object changed between two snapshots (added, removed or
 * replaced — the store replaces a table on every change). The Builder refreshes the bound rows of
 * exactly these (`workspace.refreshRows(ids)`).
 *
 * **Why (2026-10-21)**: the Builder refreshed every bound collection unconditionally when the
 * workspace mounted, although the root had already resolved its rows from the data store that
 * the boot initializes before opening it — a second whole resolve of every page root with a bound
 * owner (7,731 of 10,664 records on a 22-page document: ~125 ms of the first frame, ~520 ms at a
 * 4× CPU throttle — `.agent/runs/2026-10-21-canvas-perf-regression/lever3/`). The mount now
 * refreshes only what changed since the root read the store.
 */
export function changedCollectionIds<T>(
  next: ReadonlyMap<string, T>,
  previous: ReadonlyMap<string, T>,
): string[] {
  if (next === previous) return [];
  return [...new Set([...next.keys(), ...previous.keys()])].filter(
    (id) => next.get(id) !== previous.get(id),
  );
}

/**
 * ADR-310 Phase 8 — the flow a virtual-scrolled list's `ListLayout` can place as the Canvas does,
 * read from the list's engine input (`getDrawnLayoutStyle` — the Canvas's, the same in the
 * Preview's root): one line of items in order, stretched across the line — a block list
 * (vertical), a one-column grid (GridList `stack`), or a flex list without wrap and without
 * reverse (`flexDirection` — vertical `column`, horizontal `row`, the author's Styles). A
 * wrapping · reversed flex, a many-column grid, or items aligned off the stretch are not one
 * `ListLayout` line: refused (the panel says so; the Preview draws the
 * list as it is). The S2 lists (ListBox · GridList · Tree · Menu) have no `orientation` prop —
 * a horizontal list is the author's flex row. Pure, no imports (the panel's chunk reads it too).
 */
export type CatalogVirtualFlow =
  | { readonly orientation: "vertical" | "horizontal" }
  | { readonly refused: "flow" };

const STRETCH = new Set([undefined, "", "normal", "stretch"]);

export function catalogVirtualFlow(
  style: Readonly<Record<string, unknown>>,
): CatalogVirtualFlow {
  const display = String(style.display ?? "block");
  // (`contents` — an element-less root: its rows are its parent's to place, as a block list's.)
  if (display === "block" || display === "flow-root" || display === "contents")
    return { orientation: "vertical" };
  // (A one-column grid stacks its rows — GridList `stack`: `minmax(0, 1fr)`, items stretched.)
  if (display === "grid" || display === "inline-grid") {
    const columns = style.gridTemplateColumns;
    const single =
      columns === undefined ||
      (Array.isArray(columns) && columns.length <= 1);
    return single &&
      !String(style.gridAutoFlow ?? "row").startsWith("column") &&
      STRETCH.has(style.justifyItems as never) &&
      STRETCH.has(style.alignItems as never)
      ? { orientation: "vertical" }
      : { refused: "flow" };
  }
  if (display !== "flex" && display !== "inline-flex")
    return { refused: "flow" };
  const direction = String(style.flexDirection ?? "row");
  const wrap = String(style.flexWrap ?? "nowrap");
  if (
    direction.endsWith("reverse") ||
    wrap !== "nowrap" ||
    !STRETCH.has(style.alignItems as never)
  )
    return { refused: "flow" };
  return { orientation: direction === "row" ? "horizontal" : "vertical" };
}

/**
 * ADR-310 Phase 8 (Decision 10 · R12) — a virtual-scrolled list's RAC `Layout` and its options,
 * made from the values the Canvas lays the list out with (breakpoint · 「Layout 옵션 표」 — §4.8):
 * the template rows' resolved size along the list's direction (fixed → `rowSize`, varying →
 * `estimatedRowSize`), the list's gap and padding, a section header's size, a Table's row and
 * header heights. A grid's `GridLayout` options come from its type and props at the scroll width
 * (`virtualGrid.ts` — 사용자 결정 7). A list whose box a `Layout` cannot place the same way is
 * refused. Pure.
 */
export interface CatalogVirtualSize {
  readonly width: number;
  readonly height: number;
}

export interface CatalogVirtualInput {
  readonly kind: "list" | "table";
  readonly orientation?: "vertical" | "horizontal";
  readonly rowGap: number;
  readonly columnGap: number;
  readonly padding: {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
  };
  /** The drawn rows (a Table's body rows) in order. */
  readonly rows: readonly CatalogVirtualSize[];
  /** Section headers · a Table's header row. */
  readonly headings?: readonly CatalogVirtualSize[];
  /** A Table's shared column tracks (`_tableTracks` — the Canvas's grid, engine input form). */
  readonly columnTracks?: readonly string[];
  /** A Table Row's own border + padding above · below its cells (the Canvas's row box). */
  readonly rowEdge?: { readonly top: number; readonly bottom: number };
}

export type CatalogVirtualLayout =
  | {
      readonly kind: "list";
      readonly options: {
        readonly orientation: "vertical" | "horizontal";
        readonly rowSize?: number;
        readonly estimatedRowSize?: number;
        readonly headingSize?: number;
        readonly estimatedHeadingSize?: number;
        readonly gap: number;
        readonly padding: number;
      };
    }
  | {
      /** The options follow the scroll width (`catalogVirtualGridOptions`). */
      readonly kind: "grid";
      readonly type: string;
      readonly props: Readonly<Record<string, unknown>>;
    }
  | {
      readonly kind: "table";
      readonly options: {
        readonly rowHeight?: number;
        readonly estimatedRowHeight?: number;
        readonly headingHeight?: number;
        /**
         * The Canvas's column tracks — the `TableLayout` sizes the columns as the grid does
         * (`catalogTableTrackWidths`), not RAC's whole-px `TableColumnLayout`.
         */
        readonly columnTracks?: readonly string[];
        /** The Row's border + padding: a row is its cells plus these (the cells start below top). */
        readonly rowEdge: { readonly top: number; readonly bottom: number };
      };
    };

/** Why a list cannot be virtual-scrolled (the panel says it). */
export type CatalogVirtualRefusal =
  /** A `ListLayout`'s padding is one value: the list's four sides differ. */
  | "padding"
  /** A waterfall is RAC's `WaterfallLayout` — not placed by the Canvas yet. */
  | "waterfall"
  /** Not one line of stretched items (`catalogVirtualFlow` — a wrapping · reversed flex, a grid). */
  | "flow"
  /**
   * A horizontal list whose items have no one px width (a `ListLayout` cannot measure it so) —
   * read in the Preview's chunk only, as `padding`: the list draws as it is there.
   */
  | "itemSize";

/** Sizes equal within half a pixel: fixed; else the average as an estimate. */
function sizeOf(values: readonly number[]): { fixed?: number; estimate?: number } {
  if (!values.length) return {};
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max - min <= 0.5) return { fixed: values[0] };
  return {
    estimate: Math.round(values.reduce((sum, value) => sum + value, 0) / values.length),
  };
}

/** A row's estimate where no row is laid out (the Preview · Publish root — RAC measures the rows). */
const ESTIMATED_ROW = 40;

export function catalogVirtualLayout(
  input: CatalogVirtualInput,
): CatalogVirtualLayout | { readonly refused: CatalogVirtualRefusal } {
  // (No laid-out row — the Preview · Publish root draws without the engine: a list · Table
  //  estimates and RAC measures each row as it shows it — its CSS size, the Canvas's.)
  if (input.kind === "table") {
    const row = input.rows.length
      ? sizeOf(input.rows.map((rect) => rect.height))
      : { estimate: ESTIMATED_ROW };
    const heading = input.headings?.[0]?.height;
    return {
      kind: "table",
      options: {
        ...(row.fixed !== undefined ? { rowHeight: row.fixed } : {}),
        ...(row.estimate !== undefined ? { estimatedRowHeight: row.estimate } : {}),
        ...(heading !== undefined ? { headingHeight: heading } : {}),
        ...(input.columnTracks?.length
          ? { columnTracks: input.columnTracks }
          : {}),
        rowEdge: input.rowEdge ?? { top: 0, bottom: 0 },
      },
    };
  }
  const { top, right, bottom, left } = input.padding;
  if (top !== right || top !== bottom || top !== left)
    return { refused: "padding" };
  const orientation = input.orientation ?? "vertical";
  const along = (rect: CatalogVirtualSize) =>
    orientation === "vertical" ? rect.height : rect.width;
  const row = input.rows.length
    ? sizeOf(input.rows.map(along))
    : { estimate: ESTIMATED_ROW };
  const heading = sizeOf((input.headings ?? []).map(along));
  return {
    kind: "list",
    options: {
      orientation,
      ...(row.fixed !== undefined ? { rowSize: row.fixed } : {}),
      ...(row.estimate !== undefined ? { estimatedRowSize: row.estimate } : {}),
      ...(heading.fixed !== undefined ? { headingSize: heading.fixed } : {}),
      ...(heading.estimate !== undefined
        ? { estimatedHeadingSize: heading.estimate }
        : {}),
      gap: orientation === "vertical" ? input.rowGap : input.columnGap,
      padding: top,
    },
  };
}

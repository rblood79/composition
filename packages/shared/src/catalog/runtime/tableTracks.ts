/**
 * ADR-257 — a Table's column tracks (대안 C2): the header row and every Row are each a grid with
 * the same explicit track list, built here from the Columns' S2 width props. A track list keeps
 * the RAC/S2 column meaning whatever the cells' padding (CSS flex would add the padding outside
 * the basis — ADR-257 Context 5).
 *
 * Values are S2 1.8.0 `ColumnSize` (`width` · `defaultWidth` — a px number, `"Nfr"`, `"N%"`) and
 * `ColumnStaticSize` (`minWidth` · `maxWidth` — a px number, `"N%"`). Defaults are RAC's
 * (`TableColumnLayout` — width `1fr`, min width 75px; S2 does not override them). RAC clamps a
 * static width by its min/max too (`calculateColumnSizes`). A selection column (a Column holding
 * `Checkbox[slot=selection]`) is S2's fixed column when it authors no width (S2 TableView
 * `width/minWidth` 40 · touch 52 — the device token `{size.table.selection-column}`: the Canvas
 * track is its px, the DOM's its CSS variable, `deviceTrack`).
 *
 * Combinations a grid track cannot express (ADR-257 사용자 결정 3 (a) — stored, not applied, the
 * Design panel names them): `Nfr` + `maxWidth`, a px width with a `%` min/max, a `%` width with a
 * px max. Their ignored bound is reported in `ignored`.
 */

/** RAC `TableColumnLayout` default min width (`getDefaultMinWidth ?? 75`). */
export const CATALOG_COLUMN_DEFAULT_MIN_WIDTH = 75;
/** S2 TableView selection checkbox column (scale medium — `TableView.tsx` width/minWidth 40). */
export const CATALOG_SELECTION_COLUMN_WIDTH = 40;
/**
 * ADR-295 후속 — the selection column's device width in the DOM (S2 40 · touch 52, not × 1.25 —
 * `{size.table.selection-column}`, the theme sheet's two sets).
 */
export const CATALOG_SELECTION_COLUMN_VAR =
  "--catalog-token-size-table-selection-column";
/**
 * ADR-295 후속 — S2 TableView drag column (`TableView.tsx` `allowsDragging` — width/minWidth 16 at
 * scale medium, 20 at large = × 1.25: the device-scaled 16). RAC's reference Table adds the same
 * column (`allowsDragging && <Column />`); the composition root prepends its track when the
 * Table drags (`collectionDragState.ts`).
 */
export const CATALOG_DRAG_COLUMN_WIDTH = 16;
/**
 * ADR-315 Phase 4 — a Column · Cell record whose column is hidden and kept (the Builder's Canvas —
 * `catalogProjectTableColumns`' `keepHidden`): not drawn and in no track (`catalogHiddenAtRest` ·
 * `catalogTableRowTracks`), still a record — the author selects it in Layers and turns 「Hidden by
 * default」 off.
 */
export const CATALOG_COLUMN_HIDDEN_PROP = "_columnHidden";
/** A Column · Cell record's side when its column is pinned (`start` · `end`) — `tableColumns.ts`. */
export const CATALOG_COLUMN_PINNED_PROP = "_pinned";
/**
 * ADR-315 Phase 5 증분 5f — a pinned row's Row record: its side (`top` · `bottom` — the resolver's
 * `withPinnedRow`, never authored). The DOM keeps it in view (`data-pinned-row` · `Table.css`).
 */
export const CATALOG_PINNED_ROW_PROP = "_pinnedRow";
/** ADR-315 Phase 5 증분 5f — a Table record whose rows its viewers pin now (the resolver's mark). */
export const CATALOG_ROW_PINNABLE_PROP = "_rowPinnable";
/**
 * ADR-315 Phase 7 — a Table record with a column pinned now (the column projection's mark —
 * `tableColumns.ts`). The DOM gives the Table `data-pinned-columns`, which the sheet's pinned-column
 * rules are scoped to (`Table.css`): their `:has()` cost every Table's scroll · sort the style
 * work of a pinned one (HC4 A/B, breakdown §9 Phase 7).
 */
export const CATALOG_TABLE_PINNED_COLUMNS_PROP = "_pinnedColumns";
/**
 * ADR-315 Phase 5 증분 5f — a Table record's pinned rows (their keys, a side each joined by `\n`:
 * `top\u0000bottom`): the virtual `Layout` builds them wherever the view is — the Table's own
 * value, so a pin is a change of the Table record (its `Virtualizer` takes new options).
 */
export const CATALOG_TABLE_PINNED_ROWS_PROP = "_pinnedRows";
/**
 * A pinned Column · Cell record at its side's edge — the start side's last column, the end side's
 * first: the line between the pinned columns and the ones scrolling under them (the Column · Cell
 * rule's `pinned-edge` block, through the derived `pinnedEdge` — `presence.ts`).
 */
export const CATALOG_COLUMN_PINNED_EDGE_PROP = "_pinnedEdge";
/**
 * ADR-315 Phase 4 — S2 `ColumnWithMenu`: the resolved Column prop that says the column has its
 * menu (S2's `isMenu` — its content is the menu Button, no side padding, an end line). The resolver
 * writes it (`catalogColumnHasMenu`, the Table's switches read through the header) before the
 * Column's rule variant, its Table's part rule and the DOM read it — one condition for the three.
 */
export const CATALOG_COLUMN_MENU_PROP = "isMenu";

const FR = /^([1-9]\d*)fr$/;
const PERCENT = /^(\d+)%$/;

type Size =
  | { kind: "px"; value: number }
  | { kind: "fr"; value: number }
  | { kind: "pct"; value: number };

/** The stored value check (`ColumnSize` · `ColumnStaticSize`) — the document validator's. */
export { catalogColumnSizeFits } from "../document/valueType";

function parseSize(value: unknown): Size | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0)
    return { kind: "px", value };
  if (typeof value !== "string") return undefined;
  const fr = FR.exec(value);
  if (fr) return { kind: "fr", value: Number(fr[1]) };
  const pct = PERCENT.exec(value);
  if (pct) return { kind: "pct", value: Number(pct[1]) };
  return undefined;
}

export interface CatalogColumnTrack {
  /** The CSS grid track (`120px` · `minmax(75px, 1fr)` · `minmax(75px, 25%)` …). */
  readonly track: string;
  /** Authored bounds a track cannot express (stored, not applied). */
  readonly ignored?: readonly ("minWidth" | "maxWidth")[];
  /**
   * The DOM's track when it follows the device (a selection column without an authored width —
   * `CATALOG_SELECTION_COLUMN_VAR`, clamped as `track` is); absent = `track` on every device.
   */
  readonly deviceTrack?: string;
}

export interface CatalogColumnInput {
  readonly props: Readonly<Record<string, unknown>>;
  /** The column holds the selection checkbox (`Checkbox[slot=selection]`). */
  readonly selection?: boolean;
  /**
   * The selection column's px (`{size.table.selection-column}` — desktop 40, the Canvas's);
   * default `CATALOG_SELECTION_COLUMN_WIDTH`.
   */
  readonly selectionWidth?: number;
}

/** One Column's track (RAC `calculateColumnSizes` meaning, as one CSS grid track). */
export function catalogColumnTrack({
  props,
  selection,
  selectionWidth = CATALOG_SELECTION_COLUMN_WIDTH,
}: CatalogColumnInput): CatalogColumnTrack {
  const authoredWidth = parseSize(props.width) ?? parseSize(props.defaultWidth);
  const width: Size =
    authoredWidth ??
    (selection
      ? { kind: "px", value: selectionWidth }
      : { kind: "fr", value: 1 });
  const parsedMin = parseSize(props.minWidth);
  const min: Size =
    parsedMin && parsedMin.kind !== "fr"
      ? parsedMin
      : {
          kind: "px",
          value:
            selection && !authoredWidth
              ? selectionWidth
              : CATALOG_COLUMN_DEFAULT_MIN_WIDTH,
        };
  const parsedMax = parseSize(props.maxWidth);
  const max = parsedMax && parsedMax.kind !== "fr" ? parsedMax : undefined;
  const ignored: ("minWidth" | "maxWidth")[] = [];
  const done = (track: string): CatalogColumnTrack =>
    ignored.length ? { track, ignored } : { track };
  if (width.kind === "fr") {
    // A fr track has no upper limit (CSS grid): its max width is stored, not applied.
    if (max) ignored.push("maxWidth");
    return done(
      `minmax(${min.kind === "px" ? `${min.value}px` : `${min.value}%`}, ${width.value}fr)`,
    );
  }
  if (width.kind === "px") {
    let value = width.value;
    // (RAC: hypothetical = max(min, min(base, max)) — the max first, the min wins.)
    if (max?.kind === "px") value = Math.min(value, max.value);
    else if (max) ignored.push("maxWidth");
    if (min.kind === "px") value = Math.max(value, min.value);
    else ignored.push("minWidth");
    const track = done(`${value}px`);
    if (!selection || authoredWidth) return track;
    // The selection column's device width — its own floor too, so an authored px max cannot cut
    // it; an authored px floor clamps it as above.
    const device = `var(${CATALOG_SELECTION_COLUMN_VAR})`;
    if (parsedMin?.kind !== "px") return { ...track, deviceTrack: device };
    const capped =
      max?.kind === "px" ? `min(${device}, ${max.value}px)` : device;
    return { ...track, deviceTrack: `max(${capped}, ${parsedMin.value}px)` };
  }
  // A percentage width: `%` bounds clamp it as constants; a px floor (the default 75 or an
  // authored one) is the track's minimum — `minmax(75px, 25%)` = max(75px, 25%) when the row has
  // room; a px max cannot be expressed.
  let pct = width.value;
  if (max?.kind === "pct") pct = Math.min(pct, max.value);
  else if (max) ignored.push("maxWidth");
  if (min.kind === "pct") return done(`${Math.max(pct, min.value)}%`);
  return done(`minmax(${min.value}px, ${pct}%)`);
}

/**
 * A Table's tracks from its Columns in order: `list` — one track per column (the Canvas's px) —
 * and `deviceTracks`, the DOM's track list when a track follows the device (`deviceTrack`).
 */
export function catalogTableColumnTracks(
  columns: readonly CatalogColumnInput[],
): { list: string[]; deviceTracks?: string } {
  const tracks = columns.map((column) => catalogColumnTrack(column));
  const list = tracks.map((track) => track.track);
  return tracks.some((track) => track.deviceTrack)
    ? {
        list,
        deviceTracks: tracks
          .map((track) => track.deviceTrack ?? track.track)
          .join(" "),
      }
    : { list };
}

// ── Records: the shared track list of a Table's rows ─────────────────────────

/** The record shape the track derivation reads (a structural subset of `CatalogConsumerNode`). */
interface TrackRecord {
  readonly id: string;
  readonly parentId: string;
  readonly children: readonly string[];
  readonly props: Readonly<Record<string, unknown>>;
}
type TrackLookup<T extends TrackRecord> = (id: string) => T | undefined;
type TrackTypeOf<T extends TrackRecord> = (node: T) => string;

const TRACK_TABLE_TYPES: ReadonlySet<string> = new Set(["Table"]);

function recordChildren<T extends TrackRecord>(
  node: T,
  get: TrackLookup<T>,
): T[] {
  return node.children.flatMap((id) => {
    const child = get(id);
    return child ? [child] : [];
  });
}

/**
 * The Table whose header row · Row this is (Row → TableBody → Table; ADR-315 Phase 5 — a nested
 * Row, a group's · a data row's child, goes up through its parent Rows).
 */
export function catalogTrackTableOf<T extends TrackRecord>(
  node: T,
  get: TrackLookup<T>,
  typeOf: TrackTypeOf<T>,
): T | undefined {
  const type = typeOf(node);
  const up = (record: T | undefined) =>
    record ? get(record.parentId) : undefined;
  let body = type === "Row" ? up(node) : undefined;
  while (body && typeOf(body) === "Row") body = up(body);
  const table =
    type === "TableHeader"
      ? up(node)
      : // (ADR-315 Phase 5 증분 5c — a totals row's footer is a row group too.)
        body && (typeOf(body) === "TableBody" || typeOf(body) === "TableFooter")
        ? up(body)
        : undefined;
  return table && TRACK_TABLE_TYPES.has(typeOf(table)) ? table : undefined;
}

/** The Table's Columns, in header order. */
function tableColumns<T extends TrackRecord>(
  table: T,
  get: TrackLookup<T>,
  typeOf: TrackTypeOf<T>,
): T[] {
  return recordChildren(table, get)
    .filter((child) => typeOf(child) === "TableHeader")
    .flatMap((header) =>
      recordChildren(header, get).filter((child) => typeOf(child) === "Column"),
    );
}

/**
 * A Row in its Table's footer (ADR-315 5c — the totals row) or one of its Cells: S2 `TableFooter`'s
 * row (S2 체크리스트 §9.3 — the Row · Cell rule's `in-footer` block, out of the selection).
 */
export function catalogTableFooterPart<T extends TrackRecord>(
  node: T,
  get: TrackLookup<T>,
  typeOf: TrackTypeOf<T>,
): boolean {
  const type = typeOf(node);
  const row =
    type === "Row" ? node : type === "Cell" ? get(node.parentId) : undefined;
  if (!row || typeOf(row) !== "Row") return false;
  const footer = get(row.parentId);
  return !!footer && typeOf(footer) === "TableFooter";
}

/** A Column · Cell holding the selection checkbox (`Checkbox[slot=selection]`, in it or one frame down). */
export function catalogTableSelectionColumn<T extends TrackRecord>(
  column: T,
  get: TrackLookup<T>,
  typeOf: TrackTypeOf<T>,
): boolean {
  const within = (node: T, depth: number): boolean =>
    recordChildren(node, get).some(
      (child) =>
        (typeOf(child) === "Checkbox" && child.props.slot === "selection") ||
        (depth > 0 && within(child, depth - 1)),
    );
  if (within(column, 1)) return true;
  // (ADR-315 Phase 5 증분 5c — a totals row's cell holds no checkbox (the row is not selected):
  //  it is the selection cell by its place — the selection Column's among the header's.)
  if (typeOf(column) !== "Cell" || !catalogTableFooterPart(column, get, typeOf))
    return false;
  const row = get(column.parentId)!;
  const table = get(get(row.parentId)!.parentId);
  const header = table
    ? recordChildren(table, get).find((part) => typeOf(part) === "TableHeader")
    : undefined;
  if (!header) return false;
  const place = recordChildren(row, get).indexOf(column);
  const columns = recordChildren(header, get);
  return place >= 0 && !!columns[place] && within(columns[place]!, 1);
}

/**
 * The track list a Table's header row · Row lays out on (`display: grid` — Canvas `styleOf`, DOM
 * `catalogDomStyle` · the Table parts) — `catalogTableColumnTracks` of its Columns, the selection
 * column at `selectionWidth` (desktop 40). Undefined for any other record or a Table without
 * Columns.
 */
export function catalogTableRowTracks<T extends TrackRecord>(
  node: T,
  get: TrackLookup<T>,
  typeOf: TrackTypeOf<T>,
  selectionWidth?: number,
): ReturnType<typeof catalogTableColumnTracks> | undefined {
  const table = catalogTrackTableOf(node, get, typeOf);
  if (!table) return undefined;
  // (A Table not selecting with checkboxes has no selection column — Phase 3, 2026-11-18.)
  // (ADR-315 Phase 4: a hidden Column the Builder keeps as a record has no track.)
  const columns = tableColumns(table, get, typeOf).filter(
    (column) =>
      column.props[CATALOG_COLUMN_HIDDEN_PROP] !== true &&
      !(
        !checkboxSelection(table) &&
        catalogTableSelectionColumn(column, get, typeOf)
      ),
  );
  if (!columns.length) return undefined;
  const inputs = columns.map((column) => ({
    props: column.props,
    ...(catalogTableSelectionColumn(column, get, typeOf)
      ? { selection: true, selectionWidth }
      : {}),
  }));
  return catalogTableColumnTracks(inputs);
}

/**
 * Records whose tracks read `owner` (`catalogDerivedPropsDependents`): a Table, its
 * header (its Columns), a Column (its width props) or a checkbox in a Column (the selection
 * column) reaches the header row and every Row of its Table.
 */
export function catalogTableTrackDependents<T extends TrackRecord>(
  owner: T,
  get: TrackLookup<T>,
  typeOf: TrackTypeOf<T>,
): T[] {
  const type = typeOf(owner);
  const up = (record: T | undefined) =>
    record ? get(record.parentId) : undefined;
  const table = TRACK_TABLE_TYPES.has(type)
    ? owner
    : type === "TableHeader"
      ? up(owner)
      : type === "Column"
        ? up(up(owner))
        : type === "Checkbox"
          ? [up(owner), up(up(owner))]
              .filter((record): record is T => !!record)
              .map((record) =>
                typeOf(record) === "Column" ? up(up(record)) : undefined,
              )
              .find((record) => !!record)
          : undefined;
  // (ADR-295 후속 C7: a selection checkbox also makes the Column · Cell holding it — in it or one frame
  //  down — S2's checkbox column part, `_tableSelectionPart`.)
  const holders =
    type === "Checkbox"
      ? [up(owner), up(up(owner))].filter(
          (record): record is T =>
            !!record &&
            (typeOf(record) === "Column" || typeOf(record) === "Cell"),
        )
      : [];
  if (!table || !TRACK_TABLE_TYPES.has(typeOf(table))) return holders;
  return [
    ...holders,
    ...recordChildren(table, get).flatMap((part) => {
      const partType = typeOf(part);
      if (partType === "TableHeader") return [part];
      if (partType !== "TableBody" && partType !== "TableFooter") return [];
      return recordChildren(part, get).filter((row) => typeOf(row) === "Row");
    }),
  ];
}

/** S2 `selectionStyle` highlight (RAC `selectionBehavior="replace"`). */
/**
 * S2 TableView selects with its checkbox column only with a selection mode and the `checkbox`
 * style (RAC `useTableOptions` gives `selectionBehavior: null` for `selectionMode` none).
 */
function checkboxSelection(table: TrackRecord): boolean {
  const mode = table.props.selectionMode;
  return (
    (mode === "single" || mode === "multiple") &&
    table.props.selectionStyle !== "highlight"
  );
}

/**
 * ADR-257 Phase 3 — S2 adds its selection checkbox column only while the Table selects with
 * checkboxes (`TableView.tsx` — `selectionMode !== 'none' && selectionBehavior === 'toggle' &&
 * selectionStyle === 'checkbox'`; 2026-11-18 — `selectionMode` none too): otherwise the Column
 * holding `Checkbox[slot=selection]` and each Row's Cell holding one are not there — on the Canvas
 * (`catalogHiddenAtRest`), in the DOM and in the track list.
 */
export function catalogTableSelectionPartHidden<T extends TrackRecord>(
  node: T,
  get: TrackLookup<T>,
  typeOf: TrackTypeOf<T>,
): boolean {
  const type = typeOf(node);
  if (type !== "Column" && type !== "Cell") return false;
  const row = get(node.parentId);
  const table = row ? catalogTrackTableOf(row, get, typeOf) : undefined;
  return (
    !!table &&
    !checkboxSelection(table) &&
    catalogTableSelectionColumn(node, get, typeOf)
  );
}

/** The selection Columns · Cells of a Table (`catalogTableSelectionPartHidden`). */
export function catalogTableSelectionParts<T extends TrackRecord>(
  table: T,
  get: TrackLookup<T>,
  typeOf: TrackTypeOf<T>,
): T[] {
  if (!TRACK_TABLE_TYPES.has(typeOf(table))) return [];
  const rowCells = (row: T): T[] =>
    recordChildren(row, get).flatMap((child) =>
      typeOf(child) === "Row" ? rowCells(child) : [child],
    );
  return recordChildren(table, get)
    .flatMap((part) =>
      typeOf(part) === "TableHeader"
        ? recordChildren(part, get)
        : typeOf(part) === "TableBody" || typeOf(part) === "TableFooter"
          ? recordChildren(part, get)
              .filter((row) => typeOf(row) === "Row")
              // (ADR-315 Phase 5 — a Row's child Rows' cells too.)
              .flatMap((row) => rowCells(row))
          : [],
    )
    .filter(
      (part) =>
        (typeOf(part) === "Column" || typeOf(part) === "Cell") &&
        catalogTableSelectionColumn(part, get, typeOf),
    );
}

/** ADR-257 Phase 2 — a Cell record's column span (`colSpan`, whole ≥ 1; default 1). */
export function catalogCellSpan(node: {
  readonly props: Readonly<Record<string, unknown>>;
}): number {
  const span = node.props.colSpan;
  return typeof span === "number" && Number.isInteger(span) && span >= 1
    ? span
    : 1;
}

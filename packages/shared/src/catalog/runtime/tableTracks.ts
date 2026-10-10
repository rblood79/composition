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
 * `Checkbox[slot=selection]`) is S2's fixed 40px column when it authors no width (S2 TableView
 * `width/minWidth 40`).
 *
 * Combinations a grid track cannot express (ADR-257 사용자 결정 3 (a) — stored, not applied, the
 * Design panel names them): `Nfr` + `maxWidth`, a px width with a `%` min/max, a `%` width with a
 * px max. Their ignored bound is reported in `ignored`.
 */

/** RAC `TableColumnLayout` default min width (`getDefaultMinWidth ?? 75`). */
export const CATALOG_COLUMN_DEFAULT_MIN_WIDTH = 75;
/** S2 TableView selection checkbox column (scale medium — `TableView.tsx` width/minWidth 40). */
export const CATALOG_SELECTION_COLUMN_WIDTH = 40;

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
}

export interface CatalogColumnInput {
  readonly props: Readonly<Record<string, unknown>>;
  /** The column holds the selection checkbox (`Checkbox[slot=selection]`). */
  readonly selection?: boolean;
}

/** One Column's track (RAC `calculateColumnSizes` meaning, as one CSS grid track). */
export function catalogColumnTrack({
  props,
  selection,
}: CatalogColumnInput): CatalogColumnTrack {
  const authoredWidth = parseSize(props.width) ?? parseSize(props.defaultWidth);
  const width: Size =
    authoredWidth ??
    (selection
      ? { kind: "px", value: CATALOG_SELECTION_COLUMN_WIDTH }
      : { kind: "fr", value: 1 });
  const parsedMin = parseSize(props.minWidth);
  const min: Size =
    parsedMin && parsedMin.kind !== "fr"
      ? parsedMin
      : {
          kind: "px",
          value:
            selection && !authoredWidth
              ? CATALOG_SELECTION_COLUMN_WIDTH
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
    return done(`${value}px`);
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

/** A Table's track list from its Columns in order (empty string = no columns). */
export function catalogTableColumnTracks(
  columns: readonly CatalogColumnInput[],
): string {
  return columns.map((column) => catalogColumnTrack(column).track).join(" ");
}

// ── Records: the shared track list of a Table · TableView's rows ─────────────

/** The record shape the track derivation reads (a structural subset of `CatalogConsumerNode`). */
interface TrackRecord {
  readonly id: string;
  readonly parentId: string;
  readonly children: readonly string[];
  readonly props: Readonly<Record<string, unknown>>;
}
type TrackLookup<T extends TrackRecord> = (id: string) => T | undefined;
type TrackTypeOf<T extends TrackRecord> = (node: T) => string;

const TRACK_TABLE_TYPES: ReadonlySet<string> = new Set(["Table", "TableView"]);

function recordChildren<T extends TrackRecord>(
  node: T,
  get: TrackLookup<T>,
): T[] {
  return node.children.flatMap((id) => {
    const child = get(id);
    return child ? [child] : [];
  });
}

/** The Table · TableView whose header row · Row this is (Row → TableBody → Table). */
export function catalogTrackTableOf<T extends TrackRecord>(
  node: T,
  get: TrackLookup<T>,
  typeOf: TrackTypeOf<T>,
): T | undefined {
  const type = typeOf(node);
  const up = (record: T | undefined) =>
    record ? get(record.parentId) : undefined;
  const table =
    type === "TableHeader"
      ? up(node)
      : type === "Row" && typeOf(up(node) ?? node) === "TableBody"
        ? up(up(node))
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

/** A Column · Cell holding the selection checkbox (`Checkbox[slot=selection]`, in it or one frame down). */
function isSelectionColumn<T extends TrackRecord>(
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
  return within(column, 1);
}

/**
 * The track list a Table's header row · Row lays out on (`display: grid` — Canvas `styleOf`, DOM
 * `catalogDomStyle` · the TableView parts). Undefined for any other record or a Table without
 * Columns.
 */
export function catalogTableRowTracks<T extends TrackRecord>(
  node: T,
  get: TrackLookup<T>,
  typeOf: TrackTypeOf<T>,
): string | undefined {
  const table = catalogTrackTableOf(node, get, typeOf);
  if (!table) return undefined;
  // (A highlight-selection Table has no selection column — Phase 3.)
  const columns = tableColumns(table, get, typeOf).filter(
    (column) =>
      !(highlightSelection(table) && isSelectionColumn(column, get, typeOf)),
  );
  if (!columns.length) return undefined;
  return catalogTableColumnTracks(
    columns.map((column) => ({
      props: column.props,
      ...(isSelectionColumn(column, get, typeOf) ? { selection: true } : {}),
    })),
  );
}

/**
 * Records whose tracks read `owner` (`catalogDerivedPropsDependents`): a Table · TableView, its
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
  if (!table || !TRACK_TABLE_TYPES.has(typeOf(table))) return [];
  return recordChildren(table, get).flatMap((part) => {
    const partType = typeOf(part);
    if (partType === "TableHeader") return [part];
    if (partType !== "TableBody") return [];
    return recordChildren(part, get).filter((row) => typeOf(row) === "Row");
  });
}

/** S2 `selectionStyle` highlight (RAC `selectionBehavior="replace"`). */
function highlightSelection(table: TrackRecord): boolean {
  return table.props.selectionStyle === "highlight";
}

/**
 * ADR-257 Phase 3 — S2 adds its selection checkbox column only for `selectionStyle` checkbox
 * (`TableView.tsx` — `selectionBehavior === 'toggle' && selectionStyle === 'checkbox'`): in a
 * highlight Table the Column holding `Checkbox[slot=selection]` and each Row's Cell holding one
 * are not there — on the Canvas (`catalogHiddenAtRest`), in the DOM and in the track list.
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
    highlightSelection(table) &&
    isSelectionColumn(node, get, typeOf)
  );
}

/** The selection Columns · Cells of a Table · TableView (`catalogTableSelectionPartHidden`). */
export function catalogTableSelectionParts<T extends TrackRecord>(
  table: T,
  get: TrackLookup<T>,
  typeOf: TrackTypeOf<T>,
): T[] {
  if (!TRACK_TABLE_TYPES.has(typeOf(table))) return [];
  return recordChildren(table, get)
    .flatMap((part) =>
      typeOf(part) === "TableHeader"
        ? recordChildren(part, get)
        : typeOf(part) === "TableBody"
          ? recordChildren(part, get)
              .filter((row) => typeOf(row) === "Row")
              .flatMap((row) => recordChildren(row, get))
          : [],
    )
    .filter(
      (part) =>
        (typeOf(part) === "Column" || typeOf(part) === "Cell") &&
        isSelectionColumn(part, get, typeOf),
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

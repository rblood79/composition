import {
  CATALOG_DATA_DISABLED_TYPES,
  CATALOG_REPEAT_TYPES,
  CATALOG_ROW_ITEM_TYPES,
  CATALOG_SECTION_TYPES,
} from "../document/collectionItems";
import { catalogFilterBarChipRows } from "../runtime/filterBar";
import {
  CATALOG_UNAVAILABLE_DATE_TYPES,
  CATALOG_UNAVAILABLE_FIELD,
} from "../document/unavailableDates";
import { CATALOG_UNAVAILABLE_DATA_PROP } from "../runtime/unavailableDates";
import { catalogAvatarCssSize } from "../document/avatarSizeValue";
import { bindTemplateValue } from "../document/templateBindingValue";
import {
  catalogSiteLanguage,
  catalogTemplateProps,
} from "../document/templateLocalizedProps";
import { catalogLabeledValueFits } from "../document/labeledValue";
import { isRichText } from "../document/textRuns";
import { catalogPartConditionProps } from "../document/derivedVariantProps";
import type {
  AuthoredValue,
  RichText,
  TextRunMarks,
  BreakpointName,
  CatalogFillLayer,
  CatalogResolvedFillLayer,
  CatalogLibrary,
  DataBindingRef,
  FillSizing,
  LayoutWrites,
  NodeResponsiveLayer,
  NodeThemeOverride,
  DefinitionId,
  CatalogPresentWhen,
  CatalogShowWhen,
  DisplayStateName,
  InstanceAddress,
  LibraryDescendantPatch,
  NodeEntry,
  NodeId,
  PropValue,
  PropWrites,
  Scalar,
  StateName,
  StateRules,
  TemplateId,
  ViewEntry,
  ViewQuery,
  VisualWrites,
  WriteValue,
  ViewConditionGroup,
} from "../document/types";
import {
  innerOwnerPlace,
  layeredOverride,
  overridesAt,
} from "./templateOwners";
import type { CatalogRowQuery } from "../runtime/viewQuery";
import { CatalogGraph } from "../document/graph";
import {
  componentPropertiesOf,
  componentPropertyWrites,
  type ComponentPropertyWrite,
} from "../document/componentProperties";
import { catalogCalendarDurationFits } from "../document/valueType";
import { isInOwnCollection, isInOwnGroup } from "../document/collectionItems";
import {
  CATALOG_SIZE_PASS_THROUGH,
  CATALOG_DENSITY_PROPAGATION_OWNER,
  CATALOG_SIZE_PROPAGATION,
  CATALOG_OVERFLOW_MODE_OWNERS,
  CATALOG_SIZE_STEP,
  CATALOG_SIZE_STEP_COMPACT,
  CATALOG_SIZE_CONTEXT_OF,
  CATALOG_OWNER_CONTEXT_PROPS,
} from "../document/sizePropagation";
import {
  CATALOG_BOOLEAN_VARIANTS,
  CATALOG_EMPHASIS_FROM_GROUP,
  CATALOG_GROUP_TURNS_ON,
  CATALOG_VARIANT_FROM_OWNER,
} from "../document/s2PropAlignment";
import { CatalogValidationError } from "../document/validation";
import { CATALOG_LINK_OUT_OWNERS } from "../document/itemLinks";
import { catalogContextualHelpGlyph } from "../document/contextualHelp";
import {
  CATALOG_FORM_CONTEXT_KEYS,
  CATALOG_FORM_FIELDS,
} from "../document/formContext";
import { OWNER_DRAWN_PART_HOSTS } from "../resolvers/resolveDelegatedChildFontSize";
import {
  catalogTokenValue,
  readThemeTokenValue,
} from "../document/themedToken";
import {
  compileFieldTemplate,
  interpolateFieldTemplate,
} from "../../collections/fieldTemplate";
import { ROW_TEMPLATE_BINDABLE_PROP_KEYS } from "../../collections/rowTemplateBindableProps";
import { resolveTableColumnKey } from "../../collections/resolveCollectionItems";
import { classifyTableCellDisplay } from "../../collections/cellValue";
import { catalogNearestSkeletonOwner } from "./skeletonOwner";
import {
  catalogPageWindow,
  PAGINATION_PAGE_SIZES,
} from "../document/pageWindow";
import { catalogRowDisplaySize } from "../document/types";
import { viewSortOrder } from "../../collections/view/sortOrder";
import {
  catalogRowSortsEqual,
  type CatalogRowSorts,
} from "../runtime/tableSort";
import { CATALOG_TREE_CELL_PROP } from "../runtime/tableTreeCell";
import {
  CATALOG_PINNED_ROW_PROP,
  CATALOG_ROW_PINNABLE_PROP,
  CATALOG_TABLE_PINNED_ROWS_PROP,
} from "../runtime/tableTracks";
import {
  CATALOG_DETAIL_ROW_SUFFIX,
  CATALOG_GROUP_PLACEHOLDER_SUFFIX,
  catalogTableStateRowSlices,
  type CatalogRowGroups,
  type CatalogRowSlices,
} from "../runtime/tableRowSlices";
import {
  CATALOG_ROW_MERGE_DOWN_PROP,
  CATALOG_ROW_MERGE_UP_PROP,
  CATALOG_ROW_EDIT_PROP,
  CATALOG_ROW_EDIT_NOTE_PROP,
  CATALOG_ROW_EDITED_FIELDS_PROP,
  catalogMergeEdges,
  catalogMergedRows,
} from "../runtime/tableCellMerge";
import { catalogRowListMeta } from "../runtime/dataBinding";
import {
  CATALOG_ROW_STRIPED_PROP,
  CATALOG_ROW_STRIPE_RUNS_PROP,
  catalogStripedRows,
} from "../runtime/tableStripes";
import {
  CATALOG_COLUMN_MENU_PROP,
  CATALOG_TABLE_AUTHORED_SORT_PROP,
  CATALOG_TABLE_EXPANDED_PROP,
  catalogColumnHasMenu,
  catalogProjectTableColumns,
  catalogViewAuthoredSort,
} from "./tableColumns";
import type {
  CatalogTableState,
  CatalogTableStateSource,
} from "../runtime/tableState";

export interface ResolvedCatalogNode {
  sourceId: NodeId | TemplateId;
  instancePath: readonly (NodeId | TemplateId)[];
  definitionId: DefinitionId;
  props: Readonly<Record<string, PropValue>>;
  visual: Readonly<Record<string, Scalar>>;
  /** Typed box layout declarations (definition layout, then matching conditional/part rules). */
  layout: Readonly<Record<string, string>>;
  /**
   * The layout keys an author wrote (node/template layout, library template origin style, an
   * instance position, responsive layers) — not the definition or rule layout, which a DOM
   * consumer already gets from the component stylesheet. Absent when nothing was authored.
   */
  authoredLayout?: Readonly<Record<string, string>>;
  sizing: Readonly<Record<string, number | null>>;
  /** Authored paint layers (Phase 4a); absent = the definition's fill. Colors are `#RRGGBBAA` (ADR-298). */
  fills?: readonly CatalogResolvedFillLayer[];
  /** ADR-224 fill intent after the breakpoint cascade. */
  fillSizing?: FillSizing;
  themeOverride?: NodeThemeOverride;
  /** The author's DOM `id` (`metadata.htmlId`). */
  htmlId?: string;
  /** The author's class names and accessible name (`metadata.className` · `ariaLabel`). */
  className?: string;
  ariaLabel?: string;
  slot?: { name: string; required: boolean };
  name?: string;
  regions?: readonly { name: string; required: boolean }[];
  placeholder?: boolean;
  /** State-origin display state (outer instance layer wins over its template's). */
  displayState?: DisplayStateName;
  /** ADR-256 Decision 7 — the node's value condition (`NodeEntry.presentWhen`). */
  presentWhen?: CatalogPresentWhen;
  /** ADR-256 Decision 7 — the states in which the node is there (`NodeEntry.showWhen`). */
  showWhen?: CatalogShowWhen;
  /**
   * The values each state gives this node (the keys its state rules write, in the rules' order —
   * definition, overrides, the instance's own): a consumer that draws states itself (the DOM, by
   * RAC's render state) reads them; `visual` holds them only when resolved in that state.
   */
  stateVisual?: Readonly<Partial<Record<StateName, Readonly<Values>>>>;
  /**
   * A data row's key on every node the row projects (not the first row, which keeps the row
   * template position's identity): the record identity's row segment.
   */
  rowKey?: string;
  /** A data row's index (the delivered rows' order) on the row's root node. */
  rowIndex?: number;
  /**
   * ADR-256 Phase 9 — a calendar month block copy's month offset (not a data row: the Layers
   * panel projects `rowIndex` nodes as row leaves).
   */
  monthIndex?: number;
  /**
   * On a bound ListBox/GridList, or a bound Table's body, that grows with its rows (no bounded
   * height — ADR-157 sample policy): the collection's row count. The Builder Canvas builds the rows
   * its page shows (`rowSample`) and marks the rest ("+N more"); the DOM shows every row.
   */
  rowCount?: number;
  /**
   * With `rowCount`: the rows the DOM lays out (the delivered window — `CatalogBoundRows`), of
   * which the Builder built the first (`resolveCatalogNode`'s `rowSample`).
   */
  rowsShown?: number;
  /**
   * On a virtual-scrolled Table's body in the Preview · Publish: its records are a window of the
   * rows (`CatalogRowWindow`) — every row's key and where the window starts.
   */
  rowWindow?: CatalogRowWindowKeys;
  /**
   * A windowed run's row left as it is (`CatalogRowWindow.kept`): a place holder at `rowIndex` —
   * nothing else of it is resolved. The consumer puts the row's existing record there.
   */
  rowKept?: true;
  /** ADR-315 Phase 5 증분 5e — a data row's detail row (`nestTableRows`): its cell spans the columns. */
  rowDetail?: true;
  children: readonly ResolvedCatalogNode[];
}
/** A data row a bound collection shows (the rows stay in the data store — H1). */
export interface CatalogBoundRow {
  /** Stable row key: the item's collection key and the record identity's row segment. */
  key: string;
  /** What the row template's `{field}` placeholders read (row fields + label/description/icon/value). */
  values: Readonly<Record<string, unknown>>;
  /**
   * ADR-322 Phase 4 — the item's own key when `key` took a repeat mark (`a~3` — a key another row
   * carries too): a Cascader keys its items by the data's key, a repeated one is not a value.
   */
  itemKey?: string;
  /**
   * The item's child rows (`useTreeData.getChildren` — the binding's `fieldMap.children`): a bound
   * Tree shows them inside the row, the same item template again.
   */
  children?: readonly CatalogBoundRow[];
  /**
   * ADR-315 Phase 5 — a bound Table's group row (`catalogGroupBoundRows`): the Column grouped at
   * its level, its data row count, its level (0 = outer) and whether it is expanded. Its `values`
   * are that Column's group value and each Column's aggregate; its `children` the next level.
   */
  group?: {
    readonly column: string;
    readonly count: number;
    readonly depth: number;
    readonly expanded: boolean;
    /**
     * ADR-315 Phase 5 증분 5g — the rows a server's answer to this group's rows has when it is not
     * the group's count (asked again once, it still differs — §4.3.3: said, never passed quietly).
     */
    readonly mismatch?: number;
  };
  /** ADR-315 Phase 5 — the child a collapsed group holds in place of its rows (never drawn). */
  placeholder?: true;
  /**
   * ADR-315 Phase 5 증분 5d — a bound Table's row of a tree (its binding names child rows —
   * `catalogTreeBoundRows`): its level (0 = top), whether it is expanded and has child rows. A
   * collapsed one holds a placeholder child (the DOM) or none (the Builder's Canvas).
   */
  tree?: {
    readonly depth: number;
    readonly expanded: boolean;
    readonly parent: boolean;
  };
  /**
   * ADR-315 Phase 5 증분 5e — a data row's detail row (its open row's child — `catalogDetailRows`):
   * the Row template's detail Row, reading the row's values.
   */
  detail?: true;
  /**
   * ADR-315 Phase 5 증분 5f — a pinned row (the Table state's `pinnedRows` — `CatalogRowPins`): it
   * stands at the top or the bottom of the rows, out of their sort, page and window, and stays in
   * view while the Table scrolls (`position: sticky`).
   */
  pinned?: "top" | "bottom";
  /**
   * ADR-315 Phase 6 — the Columns (「Merge same values」 — their keys) in which this row runs into
   * the row above (`up` — its value is not drawn) · the row below (`down` — no line under it):
   * `catalogMergedRows`, over the rows shown.
   */
  merge?: {
    readonly up?: readonly string[];
    readonly down?: readonly string[];
  };
  /**
   * ADR-317 Phase 4 — a Table 「Edit marks」's data row with an edit not saved yet (the Preview
   * session's — `CatalogRowEditMark`): new or changed, its changed fields.
   */
  edit?: {
    /** ADR-324 — a 「모아서 저장」 row's save status too (`conflict` · `failed` · `pending` · `unlinked`). */
    readonly status:
      "new" | "dirty" | "conflict" | "failed" | "pending" | "unlinked";
    readonly fields: readonly string[];
    readonly note?: string;
  };
  /**
   * ADR-317 Phase 5 — a striped Table's data row (`catalogStripedRows` — over every row shown, in
   * their order): `on` = shaded; `runs` = the merged Columns (by key) whose run's first row's stripe
   * is not its own (the run's = `!on`) — the run is one cell to the eye.
   */
  stripe?: {
    readonly on: boolean;
    readonly runs?: readonly string[];
  };
}
/**
 * The rows of a binding; `undefined` = unknown (not loaded) — the template items stay. `kind`
 * "items" (default) = the rows a collection repeats (the item reader's label/value fields, the
 * window limit); "records" = the collection's own records (a Chart's data — no window, raw fields).
 */
/**
 * ADR-284 — a binding as the row source sees it: with its view resolved for the bound node (the
 * composition root's row wrapper — `catalogBindingQuery`).
 */
export type CatalogRowBinding = DataBindingRef & { query?: CatalogRowQuery };
export type CatalogRowSource = ((
  binding: CatalogRowBinding,
  kind?: "items" | "records",
  /** The bound node — what a `key` template sees (its page's variables). */
  ownerId?: NodeId,
  /** ADR-294 — the bound node's instance path (a view reading an origin's input variable). */
  instancePath?: readonly string[],
  /**
   * A bound Table's state as its rows read it (the Preview's Table state — its sort · search ·
   * column filters, each Column as its field): the source filters and orders its rows by it
   * before its display cuts them, and says which sort they are in (`CatalogBoundRows.sorted`).
   */
  slices?: CatalogRowSlices,
) => CatalogBoundRows | undefined) & {
  /**
   * ADR-310 Phase 7 — a paged list's pages (`rowDisplay` `pages`): the count (absent = unknown — a
   * cursor-only endpoint steps back and forth) and the page shown. Absent = not paged here (the
   * Builder: a Pagination draws its authored sample).
   */
  readonly pages?: (
    listId: NodeId,
    paginationId: NodeId,
  ) =>
    | { readonly count?: number; readonly page: number; readonly size?: number }
    | undefined;
  /**
   * ADR-315 Phase 4 — a column chooser's rows (`columnsOf`): the Table's data columns, each its
   * Column key and header text. Absent = not known here (the Builder: the chooser's Menu is
   * closed — its template item draws once).
   */
  readonly tableColumns?: (
    tableId: NodeId,
    chooserId: NodeId,
  ) => readonly { readonly key: string; readonly label: string }[] | undefined;
  /**
   * ADR-320 Phase 3 — a filter bar's run-time tree (its scope's — the Preview session's). Absent =
   * not known here (the Builder: the chips are the authored start).
   */
  readonly filterTree?: (barId: NodeId) => ViewConditionGroup;
};
/** `useAsyncList`'s load state of a collection (S2 `LoadingState` — the states a load passes). */
export type CatalogLoadingState =
  "loading" | "sorting" | "loadingMore" | "error" | "idle" | "filtering";
/**
 * A binding's delivered rows; `total` = the collection's row count when it holds more (the window),
 * `loadingState` = its load (the Preview session's — the Canvas loads nothing and sends none).
 */
export type CatalogBoundRows = readonly CatalogBoundRow[] & {
  readonly total?: number;
  readonly loadingState?: CatalogLoadingState;
  /**
   * S2 `disabledKeys` by a data field (부록 D.3 2단계, 2026-11-23): the keys of the rows the
   * binding's disabled field (`fieldMap.disabled`) marks — every row's, not the window's.
   */
  readonly disabledKeys?: readonly string[];
  /**
   * S2 `isDateUnavailable` from data (부록 D.3 2단계, 2026-11-23): the dates the binding's
   * 「Unavailable date」 field (`fieldMap.unavailable`, to `unavailableEnd`) names — every row the
   * view passes, not the window's — a day as ISO text, a period as an ISO interval (`start/end`).
   */
  readonly unavailableDates?: readonly string[];
  /**
   * ADR-322 Phase 4 (사용자 결정 5) — a Cascader level's table: the row field that names the item of
   * the level above (`fieldMap.levelParent`, as a row key) — the level shows, under each item above,
   * the rows whose field is that item's key.
   */
  readonly levelParent?: string;
  /** ADR-284 — the binding's view result (absent = no view). */
  readonly view?: CatalogViewResultMeta;
  /** The Table sort the rows are already in (the row source ordered them before its window). */
  readonly sorted?: CatalogRowSorts;
  /**
   * ADR-315 Phase 5 증분 5c — a totals row's values (`CatalogRowSlices.totals`): each Column's
   * aggregate over every row the slices keep, by Column key.
   */
  readonly totals?: Readonly<Record<string, unknown>>;
  /**
   * ADR-315 Phase 5 증분 5d — the binding names its rows' child rows (`fieldMap.children` ·
   * `parentId`): a Table reads its rows again as a tree (`CatalogRowSlices.tree`).
   */
  readonly nested?: true;
  /**
   * ADR-315 Phase 5 증분 5g — the rows' request cannot ask for rows by key (a server's pages on an
   * endpoint that names no such request): a Table of them pins no row (`catalogTableSliceServable`).
   */
  readonly pinsRefused?: true;
  /** ADR-315 Phase 5 증분 5g — the server's pinned rows are more than the keys pinned (§4.3.3). */
  readonly pinMismatch?: true;
};
/**
 * ADR-284 Decision 3 — what a view's result covers: `matched` rows of `loaded` source rows (before
 * the display window); `complete` = the source rows are all of the data (a local collection) —
 * absent when not known (an API page). A run value, never stored in the document.
 */
export interface CatalogViewResultMeta {
  readonly matched: number;
  readonly loaded: number;
  readonly complete?: boolean;
  /** Conditions whose field or reference does not resolve (skipped). */
  readonly broken: readonly string[];
  /** Conditions that applied (not skipped). */
  readonly applied: number;
  /** The server's count for the view's query (only when the server gave it). */
  readonly total?: number;
  /** The rows are the server's answer to the view (the request carried it). */
  readonly served?: boolean;
  /** Conditions the request could not carry (the server's rows are not narrowed by them). */
  readonly unsent?: number;
  /** ADR-284 Decision 5 — the sort variable's RAC descriptor (a Table sorted by it shows it). */
  readonly sort?: {
    readonly column: string;
    readonly direction: "ascending" | "descending";
  };
}
/** Bound components that show their collection's load (`useAsyncList.loadingState`). */
/**
 * ADR-295 Phase 2 — the theme token each resolved value came from, by the values object (`visual` of a
 * resolved node): a key holds the ref (`{typography.text-sm}`) while its last write was a library token.
 * The DOM writes such a font size as the token's variable, so the device set (desktop · touch) reaches
 * it as it reaches the generated sheets; the Canvas reads the number (desktop, 사용자 결정 7).
 */
const RESOLVED_TOKEN_REFS = new WeakMap<object, Record<string, string>>();
/**
 * ADR-298 D4 행간 계약 — what the document's writes on one record's visual said about its line: a font
 * size from a typography token (its ref), a line-height token's px, an authored line height at all. The
 * record's `lineHeight` is a ratio (the rule's px ÷ its font size), so `finishLineHeight` turns these into
 * that ratio once every write is in.
 */
/** ADR-310 Phase 4 — the rows a bound Table's Row template repeats over (`boundTableRows`). */
interface BoundTableRows {
  /** The delivered rows. */
  readonly rowSet: readonly CatalogBoundRow[];
  /** `rowSet` in the Preview's header sort. */
  readonly ordered: readonly CatalogBoundRow[];
  /** The rows drawn: the ones a fixed height holds, else the Builder's sample. */
  readonly shown: readonly CatalogBoundRow[];
  readonly fixed: boolean;
  /**
   * The Builder's sample (it draws what the height holds, cut) — the Preview keeps every row its
   * display mode delivers and scrolls (a virtual Table: the `Virtualizer` places the visible ones).
   */
  readonly sampled: boolean;
  /** ADR-284 Decision 5: its view sorts by a variable (that sort, when the rows carry it). */
  readonly sortedByView?: { readonly sort: unknown };
}
interface LineWrites {
  fontRef?: string;
  linePx?: number;
  lineAuthored?: boolean;
}
const LINE_WRITES = new WeakMap<object, LineWrites>();
/**
 * ADR-298 D5 — the token refs the document wrote (a node's · template node's · override's `TokenUse`),
 * a subset of `RESOLVED_TOKEN_REFS` (which also holds the definitions' rule tokens). The DOM writes these
 * as the token's variable; a rule token keeps the value its sheet was built with.
 */
const AUTHORED_TOKEN_REFS = new WeakMap<object, Record<string, string>>();
/**
 * ADR-298 Phase 3 — the theme color token a resolved fill layer's (or gradient stop's) color came from,
 * by that object: the record holds the token's `#RRGGBBAA` in its color mode (the Canvas paints it), the
 * DOM writes the token's variable so a color-mode change reaches it through CSS.
 */
const FILL_TOKEN_REFS = new WeakMap<object, string>();

/** The theme token ref a resolved fill layer's or stop's color came from, else undefined. */
export function catalogFillTokenRef(item: object): string | undefined {
  return FILL_TOKEN_REFS.get(item);
}

/** Every token ref of resolved fills in order (`""` = a literal color) — the DOM's change check (F12). */
export function catalogFillTokenRefs(
  fills: readonly CatalogResolvedFillLayer[] | undefined,
): string {
  const out: string[] = [];
  for (const layer of fills ?? []) {
    out.push(FILL_TOKEN_REFS.get(layer) ?? "");
    if ("stops" in layer)
      for (const stop of layer.stops) out.push(FILL_TOKEN_REFS.get(stop) ?? "");
  }
  return out.join("|");
}

/** A theme color token's value as a fill color (`#RRGGBBAA`), else undefined. */
export function catalogFillColorOf(value: unknown): string | undefined {
  if (value === "transparent") return "#00000000";
  if (typeof value !== "string") return undefined;
  const hex = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.exec(value.trim())?.[1];
  if (!hex) return undefined;
  return `#${hex.length === 6 ? `${hex}ff` : hex}`.toLowerCase();
}

/** Visuals whose line ratio `finishLineHeight` set — the ratio travels with the font size to an instance's root. */
const LINE_FINISHED = new WeakSet<object>();
/**
 * The library's slot pass-through (`codeCatalogLibrary` binds an origin's inner node of the same
 * type to `{slot}`) with no instance value is no slot — RAC reads an absent `slot` as its default
 * one. Other unfilled placeholders stay authored (`{icon}` hides its glyph by it). Why
 * (2026-11-09): the literal reached the DOM (`<div role=dialog slot="{slot}">`) and RAC's slotted
 * contexts as a slot name.
 */
function withoutUnboundSlot(props: Props, bindings: Props): void {
  if (props.slot === "{slot}" && !Object.hasOwn(bindings, "slot"))
    delete props.slot;
}

const TYPOGRAPHY_FONT_REF = /^\{typography\.(text-[a-z0-9-]+)\}$/;

/** The token ref of `values[key]` as resolved (`undefined` = a literal, an authored px, no record). */
export function catalogResolvedTokenRef(
  values: object,
  key: string,
): string | undefined {
  return RESOLVED_TOKEN_REFS.get(values)?.[key];
}

/**
 * ADR-298 D5 (F12) — whether two resolved value objects read the same keys from the same tokens: a record
 * whose value stayed but whose source changed (a literal 12 → `{spacing.md}`) is a changed record for the
 * DOM, which writes the token's variable.
 */
export function catalogSameResolvedTokenRefs(
  left: object,
  right: object,
): boolean {
  return [RESOLVED_TOKEN_REFS, AUTHORED_TOKEN_REFS].every((map) => {
    const a = map.get(left) ?? {};
    const b = map.get(right) ?? {};
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length &&
      keys.every((key) => a[key] === b[key])
    );
  });
}

/** `{ ...visual, ...extra }` with `visual`'s token refs. */
function extendedVisual<T extends object>(visual: T, extra: object): T {
  const out = { ...visual, ...extra };
  copyResolvedTokenRefs(out, visual);
  return out;
}

/** Copies the token refs of `source`'s keys onto `target` (a values object built from another). */
export function copyResolvedTokenRefs(
  target: object,
  source: object,
  keys: readonly string[] = Object.keys(source),
): void {
  for (const map of [RESOLVED_TOKEN_REFS, AUTHORED_TOKEN_REFS]) {
    const refs = map.get(source);
    const own = map.get(target);
    if (!refs && !own) continue;
    const out = own ?? {};
    for (const key of keys) {
      if (refs?.[key]) out[key] = refs[key]!;
      else delete out[key];
    }
    map.set(target, out);
  }
}

/** The token ref the document wrote for `key` of a resolved values object (ADR-298 D5), else undefined. */
export function catalogAuthoredTokenRef(
  values: object,
  key: string,
): string | undefined {
  return AUTHORED_TOKEN_REFS.get(values)?.[key];
}

const LOADING_STATE_TYPES: ReadonlySet<string> = new Set([
  "Table",
  "ListBox",
  "GridList",
  "Tree",
  "Menu",
  "Select",
  "ComboBox",
  "Skeleton",
  // ADR-314 Phase 4 — S2 CardView `loadingState`: its SkeletonCollection's items and its end
  //   sentinel's spinner (`delegatedDom.runtime.ts` `cardview`).
  "CardView",
]);
/** Bound collections whose rows the Builder samples when they grow with them (ADR-157). */
const SAMPLED_ROW_OWNERS: ReadonlySet<string> = new Set([
  "ListBox",
  "GridList",
  // (ADR-310 Phase 1: the families that started repeating their item — a sample, not the window.)
  "CardView",
  "Menu",
  "SelectBoxGroup",
]);
/**
 * A box that grows with its content: no bounded height (the old sample policy's `viewportHeight ==
 * null`). ADR-310 Phase 8 — such a list has no scroll box: it cannot virtual-scroll.
 */
export function catalogGrowsWithRows(
  visual: Readonly<Record<string, Scalar>>,
  sizing: Readonly<Record<string, number | null>>,
): boolean {
  const open = (value: unknown) =>
    value === undefined ||
    value === null ||
    value === "auto" ||
    value === "fit-content" ||
    value === "none";
  return (
    sizing.height == null &&
    sizing.maxHeight == null &&
    open(visual.height) &&
    open(visual.maxHeight)
  );
}
const rowCountOf = (rowSet: readonly CatalogBoundRow[]) =>
  (rowSet as CatalogBoundRows).total ?? rowSet.length;
/** The rows a row set lays out in the DOM (a sample keeps the delivered count). */
const rowsShownOf = (rowSet: readonly CatalogBoundRow[]) =>
  (rowSet as { delivered?: number }).delivered ?? rowSet.length;
/** A px length (`320` · `"320px"`); anything else (`%` · keywords) is not one. */
function pxLength(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  const match =
    typeof value === "string" ? /^(\d+(?:\.\d+)?)px$/.exec(value) : null;
  return match ? Number(match[1]) : undefined;
}
/**
 * The page height a row sample counts with: the page root's authored px height, else the
 * breakpoint's screen (`screenHeight`). The resolver and the composition root read it the same.
 */
export function catalogSamplePageHeight(
  sizing: Readonly<Record<string, number | null>>,
  visual: Readonly<Record<string, unknown>>,
  screenHeight: number,
): number {
  const authored = sizing.height ?? pxLength(visual.height);
  return typeof authored === "number" && authored > 0 ? authored : screenHeight;
}
/**
 * A sampled list's laid-out rows: the pitch line to line, the rows one line holds (a grid's), and
 * where its first row starts below its page's top (a list lower on the page shows fewer rows).
 */
export interface CatalogRowPitch {
  readonly pitch: number;
  readonly perLine: number;
  readonly start: number;
}
/**
 * A virtual-scrolled Table's row window in the Preview · Publish (2026-11-19): the rows that become
 * records — `[start, start + limit)` of the rows after the sort. The rest stay data: the DOM gives
 * RAC a keyed Row without content for each (`rowWindow.keys`), and moves the window as they show.
 */
export interface CatalogRowWindow {
  readonly start: number;
  readonly limit: number;
  /**
   * A window move: the row at `index` (its key) already has its records and nothing else changed —
   * the resolver leaves it out (`ResolvedCatalogNode.rowKept`) and the consumer keeps what it has.
   */
  readonly kept?: (index: number, key: string) => boolean;
}
/** The window of a row owner (its resolved identity — `instancePath::sourceId`); none = every row. */
export type CatalogRowWindowSource = (
  owner: string,
) => CatalogRowWindow | undefined;
/** A windowed row owner's rows as its record carries them (`ResolvedCatalogNode.rowWindow`). */
export interface CatalogRowWindowKeys {
  /** The owner the window is asked for (`CatalogRowWindowSource`'s argument). */
  readonly owner: string;
  /** The first record row's place in `keys`. */
  readonly start: number;
  /** Every row's key, in the order shown. */
  readonly keys: readonly string[];
  /**
   * ADR-315 Phase 5 — a grouped Table's rows nest (breakdown §5.4 「행 창과 펼침」): `keys` are the
   * rows its open groups show, in order (a group, then its rows), and this is each one's depth
   * (0 = a top row). The records stay flat — the DOM puts each row inside the row before it of
   * one depth less.
   */
  readonly depths?: readonly number[];
  /** With `depths`: the closed groups' keys — each holds one empty child row (RAC opens it). */
  readonly closed?: ReadonlySet<string>;
  /**
   * ADR-315 Phase 5 증분 5f — the pinned rows at the start (`top`) and the end (`bottom`) of
   * `keys`: records whatever the window (they stay in view — `position: sticky`); the window
   * (`start`) is cut from the rows between them.
   */
  readonly pinned?: { readonly top: number; readonly bottom: number };
}
const ROW_KEYS = new WeakMap<object, readonly string[]>();
/** A row set as a Table's runtime sort last ordered it (`boundTableRows`). */
const SORTED_ROWS = new WeakMap<
  object,
  { sort: CatalogRowSorts; rows: readonly CatalogBoundRow[] }
>();
/**
 * ADR-315 Phase 5 — a grouped run's rows as its open groups show them (TanStack's expanded row
 * model): each group, then the rows of an open one, its own rows not read into it — with each
 * row's depth and the closed groups. A closed group's placeholder child is not a row shown.
 */
interface CatalogShownGroupRows {
  readonly rows: readonly CatalogBoundRow[];
  readonly depths: readonly number[];
  readonly closed: ReadonlySet<string>;
}
const SHOWN_GROUP_ROWS = new WeakMap<object, CatalogShownGroupRows>();
function catalogShownGroupRows(
  rowSet: readonly CatalogBoundRow[],
): CatalogShownGroupRows {
  const held = SHOWN_GROUP_ROWS.get(rowSet);
  if (held) return held;
  const rows: CatalogBoundRow[] = [];
  const depths: number[] = [];
  const closed = new Set<string>();
  const visit = (list: readonly CatalogBoundRow[], depth: number) => {
    for (const row of list) {
      if (row.placeholder) continue;
      const { children, ...own } = row;
      rows.push(children ? own : row);
      depths.push(depth);
      if (
        (row.group && !row.group.expanded) ||
        (row.tree?.parent && !row.tree.expanded)
      )
        closed.add(row.key);
      else if (children) visit(children, depth + 1);
    }
  };
  visit(rowSet, 0);
  const meta = rowSet as CatalogBoundRows;
  const shown: CatalogShownGroupRows = {
    rows: Object.assign(rows, {
      ...(meta.loadingState !== undefined
        ? { loadingState: meta.loadingState }
        : {}),
      ...(meta.view ? { view: meta.view } : {}),
      ...(meta.totals ? { totals: meta.totals } : {}),
    }),
    depths,
    closed,
  };
  SHOWN_GROUP_ROWS.set(rowSet, shown);
  return shown;
}
/**
 * ADR-315 Phase 5 증분 5e — a bound Table's rows with its detail rows (breakdown §5.4 「상세 행」):
 * each data row with no child rows of its own (a group's · a tree's leaf too) is expandable — an
 * open one holds its detail row (`detail` — its values, the Row template's detail Row), a closed
 * one a placeholder child (react-aria counts it expandable — as a closed group) or, on the
 * Builder's Canvas (`closedChild: false`), none. The rows' meta (counts · totals · sort · window)
 * stays on the list.
 */
const DETAIL_ROWS = new WeakMap<
  object,
  { readonly signature: string; readonly rows: readonly CatalogBoundRow[] }
>();
function catalogDetailRows(
  rowSet: readonly CatalogBoundRow[],
  expanded: ReadonlySet<string>,
  closedChild: boolean,
): readonly CatalogBoundRow[] {
  const signature = JSON.stringify([[...expanded], closedChild]);
  const held = DETAIL_ROWS.get(rowSet);
  if (held?.signature === signature) return held.rows;
  const visit = (
    rows: readonly CatalogBoundRow[],
    depth: number,
  ): CatalogBoundRow[] =>
    rows.map((row) => {
      // (ADR-315 Phase 5 증분 5f — a pinned row is no expandable row: its detail would scroll
      //  away under it.)
      if (row.placeholder || row.pinned) return row;
      if (row.group || row.tree?.parent)
        return row.children
          ? { ...row, children: visit(row.children, depth + 1) }
          : row;
      const open = expanded.has(row.key);
      const children = open
        ? [
            {
              key: `${row.key}${CATALOG_DETAIL_ROW_SUFFIX}`,
              values: row.values,
              detail: true as const,
            },
          ]
        : closedChild
          ? [
              {
                key: `${row.key}${CATALOG_GROUP_PLACEHOLDER_SUFFIX}`,
                values: {},
                placeholder: true as const,
              },
            ]
          : undefined;
      return {
        ...row,
        ...(children ? { children } : {}),
        tree: { depth: row.tree?.depth ?? depth, expanded: open, parent: true },
      };
    });
  const out = Object.assign(visit(rowSet, 0), catalogRowListMeta(rowSet));
  DETAIL_ROWS.set(rowSet, { signature, rows: out });
  return out;
}
const rowWindowOf = (rowSet: readonly CatalogBoundRow[] | undefined) =>
  (rowSet as { window?: CatalogRowWindowKeys } | undefined)?.window;
/** A windowed run's row the consumer keeps (`CatalogRowWindow.kept`): its place holder. */
const keptRowOf = (
  rowSet: readonly CatalogBoundRow[],
  index: number,
  key: string,
): ResolvedCatalogNode | undefined =>
  (rowSet as { kept?: CatalogRowWindow["kept"] }).kept?.(index, key)
    ? {
        sourceId: "catalog:row-kept" as NodeId,
        instancePath: [],
        definitionId: "" as DefinitionId,
        props: {},
        visual: {},
        layout: {},
        sizing: {},
        rowIndex: index,
        rowKept: true,
        rowWindow: rowWindowOf(rowSet),
        children: [],
      }
    : undefined;
/**
 * ADR-315 Phase 5 증분 5c — a bound Table's totals row (its footer's rows read it): the row source's
 * totals (`CatalogBoundRows.totals` — every Column key, null where it has no aggregate).
 */
const catalogTotalsRow = (
  rowSet: readonly CatalogBoundRow[],
): CatalogBoundRow => ({
  key: "totals",
  values: (rowSet as CatalogBoundRows).totals ?? {},
});
/**
 * A run's row at `place` (in the run as resolved) — its place in the whole run: a windowed run's
 * rows start at the window's (`start`), its pinned rows (ADR-315 Phase 5 증분 5f) are the whole
 * run's first · last.
 */
const rowIndexOf = (
  rowSet: readonly CatalogBoundRow[] | undefined,
  place: number,
): number => {
  const window = rowWindowOf(rowSet);
  if (!window) return place;
  const pinned = window.pinned;
  if (!pinned) return window.start + place;
  if (place < pinned.top) return place;
  const length = rowSet!.length;
  if (place >= length - pinned.bottom)
    return window.keys.length - (length - place);
  return window.start + (place - pinned.top);
};
/**
 * ADR-315 Phase 6 — a run's rows as the resolver draws them: a merged Column's runs cut at the run's
 * ends (`catalogMergeEdges` — its first row shows its value, its last draws its line) and, with
 * merged rows, a kept row (`CatalogRowWindow.kept`) beside a row resolved now is resolved again —
 * its neighbour may run into it now, the window having moved.
 */
function runRowsOf(segment: readonly CatalogBoundRow[]): {
  data: (place: number) => CatalogBoundRow;
  kept: (place: number) => ResolvedCatalogNode | undefined;
} {
  const edges = catalogMergeEdges(segment);
  const keptAt = (place: number) =>
    place >= 0 && place < segment.length
      ? keptRowOf(segment, rowIndexOf(segment, place), segment[place]!.key)
      : undefined;
  return {
    data: (place) => edges?.get(place) ?? segment[place]!,
    kept: (place) => {
      const kept = keptAt(place);
      return kept && edges && !(keptAt(place - 1) && keptAt(place + 1))
        ? undefined
        : kept;
    },
  };
}
/** What the Builder's row sample counts with (`resolveCatalogNode`'s `rowSample`). */
export interface CatalogRowSampleBasis {
  /** The page height when the resolved root authors none (the breakpoint's screen). */
  readonly screenHeight: number;
  /** A sampled list's measured pitch, by its resolved identity (`instancePath::sourceId`). */
  readonly pitchOf?: (owner: string) => CatalogRowPitch | undefined;
}
/**
 * The smallest row a sampled list draws (S2 control height XS — ListBoxItem XS's minimum): before
 * a list's pitch is measured its sample counts with it, so the page never shows a row not built.
 */
export const CATALOG_ROW_SAMPLE_MIN_ROW_HEIGHT = 20;
/**
 * The rows a sampled list builds on a page `pageHeight` tall: the lines the page shows from the
 * list's first row down (`start`), plus one. Before its rows are measured, the rows of the smallest
 * row height over the whole page (the composition root measures them and builds the list again,
 * later).
 */
export function catalogRowSampleCount(
  pageHeight: number,
  pitch: CatalogRowPitch | undefined,
): number {
  if (!pitch || !(pitch.pitch > 0))
    return Math.ceil(pageHeight / CATALOG_ROW_SAMPLE_MIN_ROW_HEIGHT) + 1;
  const shown = Math.max(0, pageHeight - pitch.start);
  return Math.max(1, pitch.perLine) * (Math.ceil(shown / pitch.pitch) + 1);
}
// (ADR-310 Decision 7: the row item types are the collection type table's — `collectionItems.ts`.)
export { CATALOG_ROW_ITEM_TYPES };
/** The shortest row a Table density gives (compact: line 24 + padding 4 × 2). */
const TABLE_MIN_ROW_HEIGHT = 32;
/**
 * An owned row template's writes without its sample content (2026-10-14): a literal content prop
 * (the ADR-162 allowlist) is what the item showed before the rows; a `{field}` one reads the row.
 * An empty one is no sample — the author cleared the text (a Table row's selection Checkbox):
 * dropping it brought the origin's default back (「Checkbox」 in every row, 2026-11-15).
 */
function withoutSampleContent(writes: PropWrites): PropWrites {
  const kept: Record<string, PropWrites[string]> = {};
  for (const [key, write] of Object.entries(writes)) {
    const literal =
      (ROW_TEMPLATE_BINDABLE_PROP_KEYS as readonly string[]).includes(key) &&
      write.kind === "set" &&
      typeof write.value === "string" &&
      write.value !== "" &&
      !write.value.includes("{");
    if (!literal) kept[key] = write;
  }
  return kept as PropWrites;
}
/**
 * Where a row's text goes in an item's children (ADR-310 Phase 1): `label` · `content` = every
 * literal text child takes that field (a Breadcrumb's label · a TabPanel's content); `slots` = a
 * Card's `Text[slot=title]` takes the label and `Text[slot=description]` the description — S2
 * CardView's `<Text slot="title">{item.title}</Text>`.
 */
type CatalogRowLabel = "label" | "content" | "slots";
const CARD_ROW_SLOTS: Readonly<Record<string, string>> = {
  title: "label",
  description: "description",
};
/** The row field a literal text child takes (`undefined` = it keeps its own text). */
function rowLabelField(
  rowLabel: CatalogRowLabel | undefined,
  props: Record<string, unknown>,
  type: string,
): string | undefined {
  if (!rowLabel) return undefined;
  if (props.slot === "separator") return undefined;
  // (A Card's own title · description Text lost its sample text to the row — `withoutSampleContent`.)
  if (rowLabel === "slots")
    return typeof props.slot === "string" &&
      (props.children === undefined ||
        (typeof props.children === "string" && !props.children.includes("{")))
      ? CARD_ROW_SLOTS[props.slot]
      : undefined;
  // (A TabPanel's body Text reads the row's content where it is empty — and an owned body Text's
  //  sample text is already gone: `withoutSampleContent`, ADR-310 Phase 2.)
  if (rowLabel === "content")
    return type === "Text" &&
      (props.children === undefined || props.children === "")
      ? rowLabel
      : undefined;
  if (typeof props.children !== "string" || props.children.includes("{"))
    return undefined;
  return rowLabel;
}
/**
 * ADR-310 Phase 5 — a group's items (Radio · Checkbox · ToggleButton · SegmentedControlItem): the
 * prop that keys the item in its group (RAC's group `value` for a Radio · Checkbox) and the prop its
 * text is (`children` · `label` — the row's `label` when the template's own text was sample text).
 */
const GROUP_ROW_ITEM: Readonly<Record<string, { key: string; text: string }>> =
  {
    Radio: { key: "value", text: "children" },
    Checkbox: { key: "value", text: "children" },
    ToggleButton: { key: "id", text: "label" },
    SegmentedControlItem: { key: "id", text: "label" },
    ActionButton: { key: "id", text: "label" },
    // ADR-322 Phase 4 — a bound Cascader's item: its key is the data's (`itemKey` — a repeated key
    // stays repeated, the field refuses it), its name the row's label.
    CascaderItem: { key: "id", text: "label" },
  };
/** The row is the item: its key prop takes the row's key (a group item shows the row's label). */
function keyRowItem(
  type: string,
  props: Record<string, unknown>,
  row: CatalogBoundRow,
): void {
  // ADR-320 — a filter chip's texts are its row's (a switched-off condition's chip is dimmed).
  if (type === "FilterChip") {
    for (const key of ["field", "comparison", "value", "label"])
      props[key] = String(row.values[key] ?? "");
    props.isDisabled = row.values.enabled === false;
    // (ADR-320 Phase 3 — the root item the chip shows: its run-time menus write that item.)
    props.conditionId = row.key;
    return;
  }
  const group = GROUP_ROW_ITEM[type];
  props[type === "TabPanel" ? "itemId" : (group?.key ?? "id")] =
    type === "CascaderItem" ? (row.itemKey ?? row.key) : row.key;
  if (group && props[group.text] === undefined)
    props[group.text] = String(row.values.label ?? row.key);
}
/**
 * A row template item's content defaults (its origin's literal `label` · `description` …) are sample
 * content too: the row's `{label}` binding reads the row, not the origin's "Option" (ADR-310 Phase 1
 * — a bound SelectBoxGroup drew "Option" per row).
 */
function dropLiteralContent(props: Record<string, unknown>): void {
  for (const key of ROW_TEMPLATE_BINDABLE_PROP_KEYS)
    if (typeof props[key] === "string" && !(props[key] as string).includes("{"))
      delete props[key];
}
/** A row value: `{field}` templates read the row (a `{{ state }}` template is not a row field). */
function bindRowValue(value: PropValue, row: CatalogBoundRow): PropValue {
  // ADR-299 — a range-formatted text reads the row in each run (a `{field}` token is never split).
  if (isRichText(value)) {
    let changed = false;
    const runs = value.runs.map((run) => {
      const text = bindRowValue(run.text, row) as string;
      if (text === run.text) return run;
      changed = true;
      return { ...run, text: String(text) };
    });
    return changed ? { kind: "text", runs } : value;
  }
  if (typeof value !== "string" || !value.includes("{") || value.includes("{{"))
    return value;
  const compiled = compileFieldTemplate(value);
  return compiled
    ? interpolateFieldTemplate(compiled, row.values as Record<string, unknown>)
    : value;
}
/** A data value as a Table cell's text (the list kinds joined, the rest counted). */
function tableCellText(value: unknown): string {
  const display = classifyTableCellDisplay(value);
  return display.kind === "text"
    ? display.text
    : `${display.items.join(", ")}${display.overflow ? ` +${display.overflow}` : ""}`;
}
/** Stamp a row's key on a projected row subtree. */
function withRowKey(
  node: ResolvedCatalogNode,
  key: string,
): ResolvedCatalogNode {
  // (A row inside a row — a repeated section's item rows (ADR-310 ②), a bound list inside a data
  //  row — keeps its own key under the outer one: two section rows' first items stay two records.)
  return {
    ...node,
    rowKey: node.rowKey === undefined ? key : `${key}/${node.rowKey}`,
    children: node.children.map((child) => withRowKey(child, key)),
  };
}
/**
 * `useTreeData` — a bound Tree's row with child rows (`CatalogBoundRow.children`): the row's own
 * sample items (a template's nested TreeItems) give way to the same item template again for each
 * child row, inside the row — the reference's `<Collection items={item.children}>` with the same
 * render function. Other rows stay as they are.
 */
function nestTreeRows(
  node: ResolvedCatalogNode,
  data: CatalogBoundRow,
  project: (row: CatalogBoundRow) => ResolvedCatalogNode | undefined,
  isTreeItem: (node: ResolvedCatalogNode) => boolean,
  isInstance: (node: ResolvedCatalogNode) => boolean,
  isTableRow?: (node: ResolvedCatalogNode) => boolean,
): ResolvedCatalogNode {
  if (!isTreeItem(node))
    return isTableRow?.(node)
      ? nestTableRows(node, data, project, isTableRow)
      : node;
  // (A TreeItem instance — 「TreeItem/Default」 — holds its TreeItem as its template root; its own
  // nested items — the starter's 「Node 1.1」 — are samples.)
  if (isInstance(node))
    return {
      ...node,
      children: node.children.flatMap((child) =>
        !isTreeItem(child)
          ? [child]
          : isInstance(child)
            ? []
            : [nestTreeRows(child, data, project, isTreeItem, isInstance)],
      ),
    };
  const nested = (data.children ?? []).flatMap((child) => {
    const projected = project(child);
    return projected
      ? [
          nestTreeRows(
            withRowKey(projected, child.key),
            child,
            project,
            isTreeItem,
            isInstance,
          ),
        ]
      : [];
  });
  return {
    ...node,
    children: [
      ...node.children.filter((child) => !isTreeItem(child)),
      ...nested,
    ],
  };
}
/**
 * ADR-315 Phase 5 — a bound Table's row with child rows (a group row's — `catalogGroupBoundRows` —
 * or a data row's `children`): the same Row template again for each child row, after the row's
 * own Cells — RAC's nested `<Row>` (the expandable rows of `treeColumn`). The child Rows stand on
 * the row's outermost layer, beside its Cells.
 */
function nestTableRows(
  node: ResolvedCatalogNode,
  data: CatalogBoundRow,
  project: (row: CatalogBoundRow) => ResolvedCatalogNode | undefined,
  isTableRow: (node: ResolvedCatalogNode) => boolean,
): ResolvedCatalogNode {
  // (ADR-315 Phase 5 증분 5e — the Row template's own Rows are its detail row: a detail row is
  //  that Row, read with its row's values — in the place of the row; any other row leaves it. A
  //  Row instance's first child is its template root — a layer of the same record, not a detail.)
  if (data.detail) {
    const detail = rowDetailOf(node, isTableRow);
    return detail
      ? {
          // (Its key on every layer; ADR-317 Phase 5 — drawn with its row's stripe.)
          ...withRowLayerProps(
            detail,
            { id: data.key, ...stripedRowProps(data.stripe) },
            isTableRow,
          ),
          rowDetail: true,
          ...(node.rowIndex !== undefined ? { rowIndex: node.rowIndex } : {}),
          ...(node.rowWindow ? { rowWindow: node.rowWindow } : {}),
        }
      : node;
  }
  const own = withRowLayerProps(
    withPinnedRow(withoutRowDetail(node, isTableRow), data.pinned, isTableRow),
    {
      ...mergedRowProps(data.merge),
      ...editedRowProps(data.edit),
      ...stripedRowProps(data.stripe),
    },
    isTableRow,
  );
  if (!data.children?.length) return own;
  const nested = data.children.flatMap((child) => {
    const projected = project(child);
    return projected
      ? [
          nestTableRows(
            withRowKey(projected, child.key),
            child,
            project,
            isTableRow,
          ),
        ]
      : [];
  });
  return { ...own, children: [...own.children, ...nested] };
}
/** A Row with its pinned side on every layer (a Row instance's record reads its innermost one). */
function withPinnedRow(
  row: ResolvedCatalogNode,
  side: CatalogBoundRow["pinned"],
  isTableRow: (node: ResolvedCatalogNode) => boolean,
): ResolvedCatalogNode {
  if (!side) return row;
  const marked = (node: ResolvedCatalogNode): ResolvedCatalogNode => ({
    ...node,
    props: { ...node.props, [CATALOG_PINNED_ROW_PROP]: side },
  });
  return {
    ...marked(row),
    children: row.children.map((child, index) =>
      isTableRow(child)
        ? // (A Row instance's first child is its template root — a layer of the same record.)
          index === 0
          ? withPinnedRow(child, side, isTableRow)
          : child
        : // (Its Cells too, with their first layer — a Cell instance's record reads its innermost
          //  one: a Cell drawn again when its row is pinned · unpinned measures · offers the side
          //  it is at now — its record was unchanged, live 2026-11-21.)
          {
            ...marked(child),
            ...(child.children[0]
              ? {
                  children: [
                    marked(child.children[0]),
                    ...child.children.slice(1),
                  ],
                }
              : {}),
          },
    ),
  };
}
/**
 * A bound Row with `props` on every layer — a Row instance's record reads its innermost one (its
 * first child, a Row, is its template root): the column projection marks its Cells by Column key
 * (`catalogProjectTableColumns`).
 */
function withRowLayerProps(
  row: ResolvedCatalogNode,
  props: Readonly<Record<string, PropValue>>,
  isTableRow: (node: ResolvedCatalogNode) => boolean,
): ResolvedCatalogNode {
  if (!Object.keys(props).length) return row;
  const [first, ...rest] = row.children;
  return {
    ...row,
    props: { ...row.props, ...props },
    ...(first && isTableRow(first)
      ? { children: [withRowLayerProps(first, props, isTableRow), ...rest] }
      : {}),
  };
}
/** ADR-315 Phase 6 — a row's merge, by Column key. */
const mergedRowProps = (
  merge: CatalogBoundRow["merge"],
): Record<string, PropValue> => ({
  ...(merge?.up ? { [CATALOG_ROW_MERGE_UP_PROP]: merge.up } : {}),
  ...(merge?.down ? { [CATALOG_ROW_MERGE_DOWN_PROP]: merge.down } : {}),
});
/** ADR-317 Phase 4 — a row's edit status and its changed fields. */
const editedRowProps = (
  edit: CatalogBoundRow["edit"],
): Record<string, PropValue> =>
  edit
    ? {
        [CATALOG_ROW_EDIT_PROP]: edit.status,
        [CATALOG_ROW_EDITED_FIELDS_PROP]: edit.fields,
        ...(edit.note ? { [CATALOG_ROW_EDIT_NOTE_PROP]: edit.note } : {}),
      }
    : {};
/** ADR-317 Phase 5 — a striped Table's row stripe and its merged runs whose stripe is not its own. */
const stripedRowProps = (
  stripe: CatalogBoundRow["stripe"],
): Record<string, PropValue> =>
  stripe
    ? {
        [CATALOG_ROW_STRIPED_PROP]: stripe.on,
        ...(stripe.runs ? { [CATALOG_ROW_STRIPE_RUNS_PROP]: stripe.runs } : {}),
      }
    : {};
/**
 * ADR-315 Phase 5 증분 5e — a resolved Row's detail Row: a Row among its children but the first —
 * a Row instance's first child is its template root (a layer of the same record); its own
 * children (the cells, the detail Row) follow it.
 */
function rowDetailOf(
  row: ResolvedCatalogNode,
  isTableRow: (node: ResolvedCatalogNode) => boolean,
): ResolvedCatalogNode | undefined {
  return row.children.slice(1).find(isTableRow);
}
/** A resolved Row without its detail Row. */
function withoutRowDetail(
  row: ResolvedCatalogNode,
  isTableRow: (node: ResolvedCatalogNode) => boolean,
): ResolvedCatalogNode {
  if (!rowDetailOf(row, isTableRow)) return row;
  return {
    ...row,
    children: row.children.filter(
      (child, index) => index === 0 || !isTableRow(child),
    ),
  };
}
export interface CatalogResolutionSelection {
  include(
    sourceId: NodeId | TemplateId,
    instancePath: readonly (NodeId | TemplateId)[],
  ): boolean;
  onVisit?: (sourceId: NodeId | TemplateId) => void;
  /**
   * Owned `children` of an included node that may pass `include` (a subset of `node.children`).
   * `undefined` tests every owned child. Only the owned-children loop reads it; template
   * children, fill-slot children and replacements keep their `include` checks.
   */
  ownedChildren?: (
    sourceId: NodeId,
    instancePath: readonly (NodeId | TemplateId)[],
  ) => readonly NodeId[] | undefined;
}
type Values = Record<string, Scalar>;
/**
 * ADR-256 Phase 8c — hosts a part rule's `via` reaches through to their owner: a Disclosure's
 * header Heading (the trigger Button's content is styled from the Disclosure's sheet), and a
 * calendar's month · year picker (RAC renders no element — its Select's trigger is styled from the
 * calendar header's rules, 2026-10-13).
 */
export const CATALOG_PART_RULE_PASS_HOSTS: Readonly<
  Record<string, ReadonlySet<string>>
> = {
  Heading: new Set(["Disclosure"]),
  // (2026-11-13: a field's control Group passes its rules to its button's glyph —
  //  `.react-aria-Button .react-aria-Icon svg`: the clear cross · picker chevron · calendar.)
  Group: new Set(["SearchField", "ComboBox", "DatePicker", "DateRangePicker"]),
  // (2026-11-18 S2 structure: the pickers sit in the header row's heading group — CalendarMonth.)
  CalendarMonthPicker: new Set(["CalendarMonth"]),
  CalendarYearPicker: new Set(["CalendarMonth"]),
};
/**
 * `via` wrappers whose owner's rules reach the parts in a layout frame inside them (wrapper type →
 * owner types): an S2 Card's `TextContext` reaches a title · description in a `div` in its Content —
 * S2 CollectionCard's meta row (2026-11-24 — the DOM's Card sheet is a descendant selector).
 */
const CATALOG_PART_RULE_FRAMED_WRAPPERS: Readonly<
  Record<string, ReadonlySet<string>>
> = {
  Content: new Set(["Card"]),
};
/**
 * Layout rows a part rule's owner reaches through like a `frame`: S2's `DisclosureHeader` (the
 * Disclosure title Heading's row, 2026-11-18 — the Disclosure sheet styles the Heading and trigger
 * in it).
 */
const PART_RULE_LAYOUT_FRAMES: ReadonlySet<string> = new Set([
  "frame",
  "DisclosureHeader",
  // (2026-11-18: a Slider's label container · field input — S2 `labelContainer` · `fieldInput()`:
  //  the Slider sheet styles the Label, value text, track and thumbs in them.)
  "SliderLabelContainer",
  "SliderFieldInput",
]);
/** Resolved props: scalars and structured values (string lists, item lists). */
type Props = Record<string, PropValue>;
/** The resolving node's parent (and its parent: `via` part rules reach through one wrapper). */
type ParentContext = {
  definitionId: DefinitionId;
  props: Props;
  /** The parent's resolution state (its display state, else the context's): its part rules'. */
  state?: StateName;
  parent?: ParentContext;
  /**
   * A composite instance projecting its template root: the root is the instance's own element
   * (the consumer tree collapses the two), so part rules read past it to the structural parent.
   */
  collapsed?: boolean;
};
/** The nearest context that is an element of its own (collapsed composite instances skipped). */
const structuralParent = (
  context: ParentContext | undefined,
): ParentContext | undefined => {
  let current = context;
  while (current?.collapsed) current = current.parent;
  return current;
};
type InstanceRoot = {
  props: Props;
  visual: Values;
  sizing: Record<string, number | null>;
  /** Authored layout of the instance position (template node / patch), over the root's rules. */
  layout: Record<string, string>;
  /** The instance position's display state: it replaces the template root's own. */
  displayState?: DisplayStateName;
  /**
   * The instance position's authored fill layers (and their sizing): the one element the author
   * edits is the instance, so they replace the template root's (ADR-248 4e-12).
   */
  fills?: readonly CatalogFillLayer[];
  fillSizing?: FillSizing;
  /**
   * The composite definition whose template root this is (ADR-253): its project override is the
   * origin's style, so it lands on the root — over the root's own values, under the values the
   * instance position authored.
   */
  origin?: DefinitionId;
  /** State rules the instance position authored (outer layers last): over the origin's. */
  stateRules?: readonly StateRules[];
};
/**
 * Accepted boolean props a display state sets, the way the old Canvas and Preview read a state
 * origin (`readForcedVariantStates`: RAC `isSelected` / `isDisabled` / `isExpanded`).
 */
export const DISPLAY_STATE_PROPS: Readonly<
  Partial<Record<DisplayStateName, Readonly<Record<string, boolean>>>>
> = {
  selected: { isSelected: true },
  unselected: { isSelected: false },
  disabled: { isDisabled: true },
  collapsed: { isExpanded: false },
};
/** The state rules a display state resolves (`ResolutionContext.state` of that node). */
const DISPLAY_PAINT_STATE: Readonly<
  Partial<Record<DisplayStateName, StateName>>
> = {
  selected: "selected",
  disabled: "disabled",
  hover: "hover",
  pressed: "pressed",
  focusVisible: "focusVisible",
};
/** Descendant patches a library composite template node applies to that composite's template. */
type LibraryPatchScope = {
  instances: readonly (NodeId | TemplateId)[];
  patches: readonly LibraryDescendantPatch[];
  /**
   * Slot fills of that template node (`LibraryTemplateNode.slotFills`): at the composite's slot
   * position, the node's own children projected in place of the position's default children.
   */
  fills?: readonly {
    templatePath: readonly TemplateId[];
    project: (parent: ParentContext) => ResolvedCatalogNode[];
  }[];
};
const sameIds = (left: readonly string[], right: readonly string[]): boolean =>
  left.length === right.length &&
  left.every((id, index) => id === right[index]);
const same = (left: InstanceAddress, right: InstanceAddress): boolean =>
  left.instances.length === right.instances.length &&
  left.templatePath.length === right.templatePath.length &&
  left.instances.every((id, index) => id === right.instances[index]) &&
  left.templatePath.every((id, index) => id === right.templatePath[index]);

/** Desktop-first cascade: the layers below desktop that apply at a breakpoint, in order. */
const CASCADE: Readonly<
  Record<BreakpointName, readonly ("tablet" | "mobile")[]>
> = {
  desktop: [],
  tablet: ["tablet"],
  mobile: ["tablet", "mobile"],
};
const VISIBILITY_FALLBACK: Readonly<
  Record<BreakpointName, readonly BreakpointName[]>
> = {
  desktop: ["desktop"],
  tablet: ["tablet", "desktop"],
  mobile: ["mobile", "tablet", "desktop"],
};
/** A node's display at a breakpoint: its own value, else the next larger breakpoint's. */
export function catalogNodeVisibleAt(
  node: Pick<NodeEntry, "visibility">,
  breakpoint: BreakpointName,
): boolean {
  for (const name of VISIBILITY_FALLBACK[breakpoint]) {
    const shown = node.visibility?.[name];
    if (shown !== undefined) return shown;
  }
  return true;
}
function cascadeFillSizing(
  node: NodeEntry,
  layers: readonly NodeResponsiveLayer[],
): FillSizing | undefined {
  let result: Record<string, { factor: number } | null> | undefined =
    node.fillSizing ? { ...node.fillSizing } : undefined;
  for (const layer of layers)
    if (layer.fillSizing) result = { ...result, ...layer.fillSizing };
  return result;
}

/** Project entry lookup and immutable code library are kept in separate ID spaces. */
export function resolveCatalogNode(
  graph: CatalogGraph,
  id: NodeId,
  state?: StateName,
  selection?: CatalogResolutionSelection,
  breakpoint: BreakpointName = "desktop",
  /** Color mode library tokens read their theme token in (`catalogTokenValue`); absent = build-time values. */
  tokenMode?: "light" | "dark",
  /** Data rows of bound collections (ADR-248 4e-4e); absent = bound collections show their template items. */
  rows?: CatalogRowSource,
  /**
   * ADR-315 — a bound Table's Preview state (runtime, never the document); absent = the authored
   * defaults. Its `sort` orders the rows (ADR-257 Phase 4 — the first entry, until Phase 2).
   */
  tableState?: CatalogTableStateSource,
  /**
   * The Builder's sample (ADR-157): a bound list that grows with its rows builds the rows its page
   * shows — the resolved root's height (its authored px height, else `screenHeight`) over the
   * list's measured pitch (`catalogRowSampleCount`) — and keeps the collection's count
   * (`rowCount`) for the rest. Absent = every row (the Preview · Publish).
   */
  rowSample?: CatalogRowSampleBasis,
  /** The Preview · Publish's row windows (a virtual-scrolled Table); absent = every row. */
  rowWindow?: CatalogRowWindowSource,
): ResolvedCatalogNode {
  const library: CatalogLibrary = graph.library;
  /** A library origin's literal texts are shown in it (`catalogTemplateProps`). */
  const siteLanguage = catalogSiteLanguage(graph);
  // (Set again from the root's own height when the root is resolved — before any row.)
  let samplePageHeight = rowSample?.screenHeight ?? 0;
  /** A sampled owner's rows (`owner` = its resolved identity): the first its page shows. */
  const sampledRows = (
    rowSet: readonly CatalogBoundRow[],
    owner: string,
  ): readonly CatalogBoundRow[] => {
    if (!rowSample) return rowSet;
    const sampleLimit = catalogRowSampleCount(
      samplePageHeight,
      rowSample.pitchOf?.(owner),
    );
    if (rowSet.length <= sampleLimit) return rowSet;
    const meta = rowSet as CatalogBoundRows;
    return Object.assign(rowSet.slice(0, sampleLimit), {
      total: rowCountOf(rowSet),
      delivered: rowSet.length,
      ...(meta.totals ? { totals: meta.totals } : {}),
      ...(meta.loadingState !== undefined
        ? { loadingState: meta.loadingState }
        : {}),
      ...(meta.view ? { view: meta.view } : {}),
    });
  };
  /** A windowed owner's rows (`rowWindow`): the window's, with every row's key kept. */
  const windowedRows = (
    rowSet: readonly CatalogBoundRow[],
    owner: string,
  ): readonly CatalogBoundRow[] => {
    const window = rowWindow?.(owner);
    if (!window) return rowSet;
    // (ADR-315 Phase 5 증분 5f — the pinned rows first · last stay records; the window is cut
    //  from the rows between them.)
    let top = 0;
    while (top < rowSet.length && rowSet[top]!.pinned === "top") top += 1;
    let bottom = 0;
    while (
      bottom < rowSet.length - top &&
      rowSet[rowSet.length - 1 - bottom]!.pinned === "bottom"
    )
      bottom += 1;
    const middle = rowSet.length - top - bottom;
    if (middle <= window.limit) return rowSet;
    const start =
      top +
      Math.max(
        0,
        Math.min(Math.floor(window.start) - top, middle - window.limit),
      );
    let keys = ROW_KEYS.get(rowSet);
    if (!keys) ROW_KEYS.set(rowSet, (keys = rowSet.map((row) => row.key)));
    const meta = rowSet as CatalogBoundRows;
    const cut = rowSet.slice(start, start + window.limit);
    return Object.assign(
      top || bottom
        ? [
            ...rowSet.slice(0, top),
            ...cut,
            ...rowSet.slice(rowSet.length - bottom),
          ]
        : cut,
      {
        total: rowCountOf(rowSet),
        delivered: rowSet.length,
        ...(meta.totals ? { totals: meta.totals } : {}),
        window: {
          owner,
          start,
          keys,
          ...(top || bottom ? { pinned: { top, bottom } } : {}),
        },
        ...(window.kept ? { kept: window.kept } : {}),
        ...(meta.loadingState !== undefined
          ? { loadingState: meta.loadingState }
          : {}),
        ...(meta.view ? { view: meta.view } : {}),
      },
    );
  };
  /**
   * ADR-315 Phase 5 — a windowed owner's group rows (breakdown §5.4 「행 창과 펼침」): the window
   * is cut from the rows its open groups show (`catalogShownGroupRows`) — flat records, each row's
   * depth in the window's keys. Rows that all fit (or no window) stay nested — a group's rows
   * read into its record.
   */
  /** ADR-315 Phase 5 증분 5d — the Canvas tree Column of the Table being resolved (its cells). */
  let canvasTreeColumn: string | undefined;
  const windowedGroupRows = (
    rowSet: readonly CatalogBoundRow[],
    owner: string,
  ): readonly CatalogBoundRow[] => {
    if (!rowWindow?.(owner)) return rowSet;
    const shown = catalogShownGroupRows(rowSet);
    const windowed = windowedRows(shown.rows, owner);
    const window = rowWindowOf(windowed);
    if (!window) return rowSet;
    return Object.assign(windowed, {
      window: { ...window, depths: shown.depths, closed: shown.closed },
    });
  };
  const lookupEntry = (entryId: string) => graph.getEntry(entryId);
  const responsiveLayers = (node: NodeEntry): NodeResponsiveLayer[] =>
    CASCADE[breakpoint]
      .map((name) => node.responsive?.[name])
      .filter((layer): layer is NodeResponsiveLayer => !!layer);
  /** A node's authored fill layers and their cascaded sizing (`InstanceRoot` paint). */
  const instancePaint = (
    node: NodeEntry,
    layers: readonly NodeResponsiveLayer[],
  ): Pick<InstanceRoot, "fills" | "fillSizing"> => {
    const fillSizing = cascadeFillSizing(node, layers);
    return {
      ...(node.fills ? { fills: node.fills } : {}),
      ...(fillSizing ? { fillSizing } : {}),
    };
  };
  /** Authored node output fields that only exist when the node declares them. */
  const authoredExtras = (
    node: NodeEntry,
    layers: readonly NodeResponsiveLayer[],
  ) => {
    const fillSizing = cascadeFillSizing(node, layers);
    return {
      ...(node.fills ? { fills: resolvedFills(node.fills) } : {}),
      ...(fillSizing ? { fillSizing } : {}),
      ...(node.themeOverride ? { themeOverride: node.themeOverride } : {}),
      ...(node.metadata?.htmlId ? { htmlId: node.metadata.htmlId } : {}),
      ...(node.metadata?.className
        ? { className: node.metadata.className }
        : {}),
      ...(node.metadata?.ariaLabel
        ? { ariaLabel: node.metadata.ariaLabel }
        : {}),
    };
  };
  const source = graph.getEntry(id);
  if (source?.kind !== "node")
    throw new CatalogValidationError("NODE_REQUIRED", id);
  const lookupDefinition = (definitionId: DefinitionId) => {
    const definition = graph.getDefinition(definitionId);
    if (!definition)
      throw new CatalogValidationError("DANGLING_DEFINITION", definitionId);
    return definition;
  };
  /** The type a template position shows (its definition, through composite template roots). */
  /**
   * The definition whose part rules a context owns: a composite instance's are its template root's
   * (the consumer tree draws the two as one element — an author's child of a Form instance sits in
   * the Form's element, which its sheet's selectors reach). 2026-10-10: a side Form's label column
   * (Form → field → Label, `via`).
   */
  const ruleDefinitionOf = (definitionId: DefinitionId) => {
    const definition = lookupDefinition(definitionId);
    if (definition.mode !== "composite" || !definition.templateRootId)
      return definition;
    // (An unlocked origin's root is its copy — ADR-282.)
    const rootId = definition.templateRootId;
    const template = rootId.startsWith("lib:")
      ? library.templates.get(rootId as `lib:template:${string}`)
      : graph.getEntry(rootId);
    return template && "definitionId" in template
      ? lookupDefinition(template.definitionId)
      : definition;
  };
  /**
   * A resolved node is a TreeItem (a bound Tree's row — `nestTreeRows`) — or a Cascader's item,
   * except a level with its own table (ADR-322 Phase 4, 사용자 결정 5): that level's rows are its
   * table's, under the row above — not the row's child rows.
   */
  const isTreeItemRecord = (node: ResolvedCatalogNode) => {
    const name = ruleDefinitionOf(node.definitionId).name;
    if (name === "TreeItem") return true;
    if (name !== "CascaderItem") return false;
    if (!repeats(node.sourceId)) return true;
    const entry = graph.getEntry(node.sourceId as NodeId);
    return !(entry?.kind === "node" && entry.binding);
  };
  /** ADR-315 Phase 5 — a resolved node is a Table's Row (a bound Table's row — `nestTableRows`). */
  const isTableRowRecord = (node: ResolvedCatalogNode) =>
    ruleDefinitionOf(node.definitionId).name === "Row";
  /**
   * ADR-315 Phase 5 증분 5e — a bound Table's Row template holds a detail Row (a Row among its
   * children — `setTableDetailRow`): the template is the Table's own Row (its 「Rows」 slot's).
   */
  const tableHasDetailRow = (table: NodeEntry): boolean => {
    const holds = (ids: readonly NodeId[]) =>
      ids.some((id) => {
        const row = graph.getEntry(id);
        return (
          row?.kind === "node" &&
          row.repeat === true &&
          row.children.some(
            (child) => templateTypeName(child as TemplateId) === "Row",
          )
        );
      });
    return table.descendantOverrides.some(
      (override) =>
        override.kind === "fillSlot" &&
        (holds(override.childIds) ||
          override.childIds.some((id) => {
            const part = graph.getEntry(id);
            return part?.kind === "node" && holds(part.children);
          })),
    );
  };
  /** A resolved node instantiates a composite (its template root is its child). */
  const isInstanceRecord = (node: ResolvedCatalogNode) => {
    const definition = lookupDefinition(node.definitionId);
    return definition.mode === "composite" && !!definition.templateRootId;
  };
  /**
   * ADR-310 — the collection item a bound list repeats per data row: a project node marked `repeat`
   * (an owned item, or a project template's position). A library template position never is.
   */
  const repeats = (id: string): boolean => {
    if (id.startsWith("lib:")) return false;
    const entry = graph.getEntry(id as NodeId);
    return entry?.kind === "node" && entry.repeat === true;
  };
  /**
   * ADR-310 Phase 5 (Decision 2) — the rows a repeated item or section shows, the first that
   * answers: ① its own binding (`<Collection items={other}>` — a list's second data, sampled on the
   * Canvas like a bound list's), ② the outer row's child rows (a repeated section's items —
   * `<Collection items={item.children}>`, the binding's `fieldMap.children`), ③ the owner's rows.
   * `undefined` = not repeated here (a static item, or rows not loaded — the template shows).
   */
  const repeatRows = (
    id: string,
    instancePath: readonly (NodeId | TemplateId)[],
    ownerRows: readonly CatalogBoundRow[] | undefined,
    outerRow: CatalogBoundRow | undefined,
  ): readonly CatalogBoundRow[] | undefined => {
    if (!repeats(id)) return undefined;
    const entry = graph.getEntry(id as NodeId) as NodeEntry;
    if (entry.binding && entry.binding.key === undefined) {
      const all = rows?.(entry.binding, "items", entry.id, instancePath);
      // (ADR-322 Phase 4 — a Cascader level's own table: under the item above, the rows whose
      //  「parent level」 field is that item's key — `itemKey`, the data's.)
      const own =
        all?.levelParent && outerRow
          ? all.filter(
              (row) =>
                String(row.values[all.levelParent!] ?? "") ===
                (outerRow.itemKey ?? outerRow.key),
            )
          : all;
      return own ? sampledRows(own, `${instancePath.join("/")}::${id}`) : own;
    }
    // (A Select's value shape repeats per item of its Select — before the rows passed down to it.)
    const valueRows = selectValueRows(id, instancePath);
    if (valueRows) return valueRows;
    return (
      outerRow?.children ??
      ownerRows ??
      paginationRows(id) ??
      chooserRows(id) ??
      filterChipRows(id)
    );
  };
  /**
   * S2 체크리스트 §9.3 (Picker `renderValue`, 사용자 결정 2026-11-23) — a node repeated in a Select's
   * SelectValue (its value's shape) repeats per item of the Select: the Select's bound rows, else its
   * own items (`id` · `label`). Every copy carries its row key (`selectValueRuns`) — the Canvas and the
   * DOM show the selected ones (`selectValueTemplate.ts`).
   */
  const selectValueRuns = new Set<string>();
  const selectValueRows = (
    id: string,
    instancePath: readonly (NodeId | TemplateId)[],
  ): readonly CatalogBoundRow[] | undefined => {
    let child = id;
    let inValue = false;
    for (
      let owner = graph.ownerOf(id as NodeId);
      owner;
      owner = graph.ownerOf(owner as NodeId)
    ) {
      const entry = graph.getEntry(owner as NodeId);
      if (entry?.kind !== "node") return undefined;
      const type = ruleDefinitionOf(entry.definitionId).name;
      if (type === "SelectValue") inValue = true;
      if (type !== "Select") {
        child = owner;
        continue;
      }
      if (!inValue) {
        // (A Select origin's SelectValue is a template position the author fills.)
        const fill = entry.descendantOverrides.find(
          (override) =>
            override.kind === "fillSlot" &&
            override.childIds.includes(child as NodeId),
        );
        const at =
          fill?.kind === "fillSlot"
            ? fill.address.templatePath[fill.address.templatePath.length - 1]
            : undefined;
        if (!at || templateTypeName(at) !== "SelectValue") return undefined;
      }
      selectValueRuns.add(id);
      if (entry.binding && entry.binding.key === undefined)
        return rows?.(entry.binding, "items", entry.id, instancePath);
      return selectItemRows(entry);
    }
    return undefined;
  };
  /** A static Select's items as rows: its key and its label text (the item's `{label}` part). */
  const selectItemRows = (select: NodeEntry): CatalogBoundRow[] => {
    const out: CatalogBoundRow[] = [];
    const labelOf = (item: NodeEntry): string | undefined => {
      for (const override of item.descendantOverrides) {
        if (override.kind !== "patch") continue;
        const path = override.address.templatePath;
        const at = path[path.length - 1];
        const template = at?.startsWith("lib:")
          ? library.templates.get(at as `lib:template:${string}`)
          : undefined;
        const text = override.props?.children;
        if (
          template?.props?.children === "{label}" &&
          text?.kind === "set" &&
          typeof text.value === "string"
        )
          return text.value;
      }
      const own = item.props.label ?? item.props.children;
      return own?.kind === "set" && typeof own.value === "string"
        ? own.value
        : undefined;
    };
    const visit = (ids: readonly NodeId[]) => {
      for (const itemId of ids) {
        const item = graph.getEntry(itemId);
        if (item?.kind !== "node") continue;
        const type = ruleDefinitionOf(item.definitionId).name;
        if (type === "ListBoxItem") {
          const idProp = item.props.id;
          const key =
            idProp?.kind === "set" && idProp.value !== undefined
              ? String(idProp.value)
              : item.id;
          out.push({ key, values: { id: key, label: labelOf(item) ?? key } });
        } else if (type === "ListBox" || type === "ListBoxSection")
          visit(item.children);
      }
    };
    for (const override of select.descendantOverrides)
      if (override.kind === "fillSlot") visit(override.childIds);
    visit(select.children);
    return out;
  };
  /**
   * ADR-315 Phase 4 — a column chooser's item repeats per data column of its Table: a row per
   * column (`id` = the Column key, `label` = its header text). The chooser is the nearest ancestor
   * with `columnsOf`.
   */
  const chooserRows = (id: string): CatalogBoundRow[] | undefined => {
    for (
      let owner = graph.ownerOf(id as NodeId);
      owner;
      owner = graph.ownerOf(owner as NodeId)
    ) {
      const entry = graph.getEntry(owner as NodeId);
      if (entry?.kind !== "node") return undefined;
      if (!entry.columnsOf) continue;
      return rows?.tableColumns?.(entry.columnsOf, entry.id)?.map((column) => ({
        key: column.key,
        values: { id: column.key, label: column.label },
      }));
    }
    return undefined;
  };
  /**
   * ADR-320 Phase 2 · 3 — a connected filter bar's chip repeats per root item of its tree (the
   * Preview: its scope's run-time tree; the Builder: its authored start): `id` = the item's id, the
   * chip's texts in the site's language. The bar is the nearest ancestor with `filtersOf`.
   */
  const filterChipRows = (id: string): CatalogBoundRow[] | undefined => {
    for (
      let owner = graph.ownerOf(id as NodeId);
      owner;
      owner = graph.ownerOf(owner as NodeId)
    ) {
      const entry = graph.getEntry(owner as NodeId);
      if (entry?.kind !== "node") return undefined;
      if (!entry.filtersOf) continue;
      const read = (entryId: string) => graph.getEntry(entryId as NodeId);
      // (No run-time tree here — the Builder — reads the authored start: the default.)
      return catalogFilterBarChipRows(
        entry,
        read,
        siteLanguage,
        rows?.filterTree?.(entry.id),
      );
    }
    return undefined;
  };
  /**
   * ADR-310 Phase 7 (사용자 결정 6) — a connected Pagination's number button repeats per page of
   * its list: a row per page (`id` = `label` = the number). The Pagination is the nearest ancestor
   * with `pagesOf`.
   */
  const paginationRows = (id: string): CatalogBoundRow[] | undefined => {
    let inSelect = false;
    for (
      let owner = graph.ownerOf(id as NodeId);
      owner;
      owner = graph.ownerOf(owner as NodeId)
    ) {
      const entry = graph.getEntry(owner as NodeId);
      if (entry?.kind !== "node") return undefined;
      if (ruleDefinitionOf(entry.definitionId).name === "Select")
        inSelect = true;
      if (!entry.pagesOf) continue;
      // (2026-11-19 — its 「Rows per page」 Select's item repeats per size: 10 · 20 · 50 · 100.)
      if (inSelect)
        return PAGINATION_PAGE_SIZES.map((size) => {
          const key = String(size);
          return { key, values: { id: key, label: key } };
        });
      if (!rows?.pages) return undefined;
      const pages = rows.pages(entry.pagesOf, entry.id);
      if (!pages) return undefined;
      const range = entry.props.pageRange;
      return catalogPageWindow(
        pages.page,
        pages.count ?? 0,
        range?.kind === "set" ? range.value : undefined,
      ).map((page) => {
        const key = String(page);
        return { key, values: { id: key, label: key } };
      });
    }
    return undefined;
  };
  /**
   * 2026-11-19 — the page size a Pagination's 「Rows per page」 Select shows: its list's — the running
   * Preview's (the viewer's pick), else the list node's own Rows per page. Undefined = the Select is
   * no connected Pagination's.
   */
  const paginationPageSize = (selectId: string): number | undefined => {
    const pager = graph.getEntry(graph.ownerOf(selectId as NodeId) as NodeId);
    if (pager?.kind !== "node" || !pager.pagesOf) return undefined;
    const pages = rows?.pages?.(pager.pagesOf, pager.id);
    if (pages?.size !== undefined) return pages.size;
    const list = graph.getEntry(pager.pagesOf);
    return list?.kind === "node" && list.rowDisplay?.mode === "pages"
      ? catalogRowDisplaySize(list.rowDisplay)
      : undefined;
  };
  /**
   * `<Skeleton isLoading={list.isLoading}>` without a second binding (2026-11-19 사용자 결정): a
   * Skeleton follows the load of the content bound inside it — loading while any of those
   * collections is `loading` (S2 example's `useAsyncList` state), else not. Its content is the
   * document nodes whose nearest Skeleton (or SkeletonCollection) owner is this one. `undefined` = no
   * bound content (or no load to read — the Canvas): the authored `isLoading` stands.
   */
  const skeletonContentLoading = (skeletonId: string): boolean | undefined => {
    if (!rows || !graph.hasBoundNodes()) return undefined;
    const project = graph.getEntry(graph.projectId);
    let bound = false;
    for (const collectionId of project?.kind === "project"
      ? (project.collectionIds ?? [])
      : [])
      for (const id of graph.bindingsOf(collectionId)) {
        if (
          catalogNearestSkeletonOwner(
            graph,
            id,
            (entry) => ruleDefinitionOf(entry.definitionId).name,
          ) !== skeletonId
        )
          continue;
        const entry = graph.getEntry(id as NodeId);
        if (entry?.kind !== "node" || !entry.binding) continue;
        const state = rows(entry.binding, "items", entry.id)?.loadingState;
        if (state === undefined) continue;
        if (state === "loading") return true;
        bound = true;
      }
    return bound ? false : undefined;
  };
  /**
   * ADR-310 Decision 11 — an unbound list's load is its runs' (items repeated over data of their
   * own, ①): idle when every run is, else the first loading run's state; none without runs.
   */
  const runsLoadingState = (
    node: NodeEntry,
    instancePath: readonly (NodeId | TemplateId)[],
  ): CatalogBoundRows["loadingState"] | undefined => {
    let state: CatalogBoundRows["loadingState"] | undefined;
    for (const id of [
      ...node.children,
      ...node.descendantOverrides.flatMap((override) =>
        override.kind === "fillSlot" ? override.childIds : [],
      ),
    ]) {
      const entry = graph.getEntry(id);
      if (
        entry?.kind !== "node" ||
        !entry.repeat ||
        !entry.binding ||
        entry.binding.key !== undefined
      )
        continue;
      const run = rows?.(entry.binding, "items", entry.id, [
        ...instancePath,
        entry.id,
      ])?.loadingState;
      if (run && run !== "idle") return run;
      state ??= run ?? "idle";
    }
    return state;
  };
  const isSection = (node: NodeEntry): boolean =>
    CATALOG_SECTION_TYPES.has(ruleDefinitionOf(node.definitionId).name);
  const templateTypeName = (templateId: TemplateId): string => {
    const template = templateId.startsWith("lib:")
      ? library.templates.get(templateId as `lib:template:${string}`)
      : graph.getEntry(templateId);
    if (!template || ("kind" in template && template.kind !== "node"))
      return "";
    let definition = graph.getDefinition(template.definitionId);
    for (
      let depth = 0;
      definition?.mode === "composite" && depth < 16;
      depth++
    ) {
      const rootId = definition.templateRootId;
      const root = rootId?.startsWith("lib:")
        ? library.templates.get(rootId as `lib:template:${string}`)
        : rootId
          ? graph.getEntry(rootId)
          : undefined;
      if (!root || ("kind" in root && root.kind !== "node")) break;
      definition = graph.getDefinition(root.definitionId);
    }
    return definition?.name ?? "";
  };
  /** ADR-256 Phase 9 — a calendar's shown months (the nearest Calendar · RangeCalendar context's). */
  const calendarMonthCount = (context: ParentContext | undefined): number => {
    for (let cursor = context; cursor; cursor = cursor.parent) {
      const name = ruleDefinitionOf(cursor.definitionId).name;
      if (name === "Calendar" || name === "RangeCalendar") {
        const duration = cursor.props.visibleDuration;
        return catalogCalendarDurationFits(duration) && "months" in duration
          ? duration.months
          : 1;
      }
    }
    return 1;
  };
  /**
   * An owned child into its parent's resolved children — every owned-children path (an owned
   * node's children, a filled slot's) goes through here, so a month block repeats wherever it sits.
   */
  const pushOwnedChild = (
    out: ResolvedCatalogNode[],
    child: NodeEntry,
    resolved: ResolvedCatalogNode | undefined,
    context: ParentContext | undefined,
  ): void => {
    if (repeatsPerMonth(ruleDefinitionOf(child.definitionId).name, context))
      pushCalendarMonths(out, resolved, context);
    else push(out, resolved);
  };
  /**
   * The calendar parts repeated per shown month: a heading group (`CalendarMonth` — S2's
   * `div.heading` in the header row), and a grid not inside one (S2 1.8.2 `Calendar.tsx` — the grid
   * row holds one `CalendarGrid` per month, 2026-11-18). A grid inside a month block is that block's.
   */
  const repeatsPerMonth = (
    name: string,
    context: ParentContext | undefined,
  ): boolean => {
    if (name === "CalendarMonth") return true;
    if (name !== "CalendarGrid") return false;
    for (let cursor = context; cursor; cursor = cursor.parent) {
      const parent = ruleDefinitionOf(cursor.definitionId).name;
      if (parent === "CalendarMonth") return false;
      if (parent === "Calendar" || parent === "RangeCalendar") return true;
    }
    return false;
  };
  /**
   * ADR-256 Phase 9 — a calendar's per-month part is a repeat template (S2's `Array.from({length:
   * visibleMonths}, (_, i) => …)` — a heading group, a grid): one copy per shown month, each its own
   * record (`rowKey`) whose index (`monthIndex`) is the month offset of the heading · grid in it. The
   * copies edit the one template node.
   */
  const pushCalendarMonths = (
    out: ResolvedCatalogNode[],
    month: ResolvedCatalogNode | undefined,
    context: ParentContext | undefined,
  ): void => {
    if (!month) return;
    const count = calendarMonthCount(context);
    for (let index = 0; index < count; index++)
      out.push(
        index === 0
          ? { ...month, monthIndex: 0 }
          : {
              ...withRowKey(
                month,
                month.rowKey !== undefined
                  ? `${month.rowKey}~month${index}`
                  : `month${index}`,
              ),
              monthIndex: index,
            },
      );
  };
  /** The theme token ref of a library token value (`{typography.text-sm}`), else undefined. */
  const tokenRefOf = (
    value: AuthoredValue | number | null,
  ): string | undefined =>
    value !== null &&
    typeof value === "object" &&
    "kind" in value &&
    value.kind === "token"
      ? graph.getToken(value.tokenId)?.ref
      : undefined;
  const noteTokenRef = (
    target: object,
    key: string,
    value: AuthoredValue | number | null | undefined,
    map: WeakMap<object, Record<string, string>> = RESOLVED_TOKEN_REFS,
  ) => {
    const ref = value === undefined ? undefined : tokenRefOf(value);
    const refs = map.get(target);
    if (ref) {
      if (refs) refs[key] = ref;
      else map.set(target, { [key]: ref });
    } else if (refs) delete refs[key];
  };
  const resolvedRichText = (value: RichText): RichText => {
    let changed = false;
    const runs = value.runs.map((run) => {
      if (!run.marks) return run;
      let marks: Record<string, unknown> | undefined;
      for (const [key, mark] of Object.entries(run.marks)) {
        if (typeof mark !== "object" || mark === null) continue;
        marks ??= { ...run.marks };
        const token = graph.getToken(mark.tokenId);
        if (!token)
          throw new CatalogValidationError("DANGLING_TOKEN", mark.tokenId);
        marks[key] = catalogTokenValue(token, tokenMode);
      }
      if (!marks) return run;
      for (const [key, mark] of Object.entries(run.marks))
        if (typeof mark === "object" && mark !== null) {
          noteTokenRef(marks, key, mark);
          noteTokenRef(marks, key, mark, AUTHORED_TOKEN_REFS);
        }
      changed = true;
      return { ...run, marks: marks as TextRunMarks };
    });
    return changed ? { kind: "text", runs } : value;
  };
  const tokenValue = (value: AuthoredValue): PropValue => {
    if (typeof value !== "object" || !("kind" in value)) return value;
    // (ADR-284 Phase 6 — a value condition resolves with the record's variables, as `{{ }}`.)
    if (value.kind === "when" || value.kind === "var") return value;
    // Persisted LabeledValue dates are values, not token references.
    if (catalogLabeledValueFits(value)) return value;
    // ADR-299 — a run's marks resolve like a visual's values (a token → its value in the color mode,
    // its ref noted on the marks object for the DOM's variable — ADR-298 D5).
    if (value.kind === "text") return resolvedRichText(value);
    const token = graph.getToken(value.tokenId);
    if (!token)
      throw new CatalogValidationError("DANGLING_TOKEN", value.tokenId);
    return catalogTokenValue(token, tokenMode);
  };
  /**
   * Authored layout writes onto a resolved layout. An authored write replaces a part rule's length — its
   * token ref goes with it; a token write (ADR-298 Phase 3 — inset · gap longhands) puts the token's px
   * (the engine reads CSS text) and notes the ref, also as the document's (the DOM writes its variable).
   */
  const applyLayoutWrites = (
    target: Record<string, string>,
    writes: LayoutWrites | undefined,
  ): void => {
    for (const [key, write] of Object.entries(writes ?? {})) {
      if (!write || write.kind === "remove") continue;
      const value = write.kind === "set" ? write.value : undefined;
      if (value === undefined) delete target[key];
      else if (typeof value === "string") target[key] = value;
      else {
        const read = tokenValue(value);
        target[key] = typeof read === "number" ? `${read}px` : String(read);
      }
      noteTokenRef(target, key, value);
      noteTokenRef(target, key, value, AUTHORED_TOKEN_REFS);
    }
  };
  /** `Object.assign(target, source)` for resolved layouts, with the token refs of the copied keys. */
  const assignLayout = (
    target: Record<string, string>,
    source: Readonly<Record<string, string>> | undefined,
  ): void => {
    if (!source) return;
    Object.assign(target, source);
    copyResolvedTokenRefs(target, source);
  };
  /**
   * ADR-298 Phase 3 — a node's fill layers as a record holds them: a color token (a layer's · a gradient
   * stop's) becomes its `#RRGGBBAA` in this resolution's color mode, its ref noted on the new object
   * (`catalogFillTokenRef`). Layers without a token are returned as they are.
   */
  const resolvedFills = (
    fills: readonly CatalogFillLayer[] | undefined,
  ): readonly CatalogResolvedFillLayer[] | undefined => {
    if (!fills) return undefined;
    const color = (value: unknown): { color: string; ref?: string } => {
      if (typeof value === "string") return { color: value };
      const use = value as { kind?: string; tokenId?: string };
      if (use?.kind !== "token" || !use.tokenId)
        throw new CatalogValidationError("FILL_COLOR", String(use?.tokenId));
      const token = graph.getToken(use.tokenId as never);
      if (!token)
        throw new CatalogValidationError("DANGLING_TOKEN", use.tokenId);
      const hex = catalogFillColorOf(catalogTokenValue(token, tokenMode));
      if (!hex)
        throw new CatalogValidationError("TOKEN_TYPE_MISMATCH", use.tokenId);
      return { color: hex, ref: token.ref };
    };
    let changed = false;
    const out = fills.map((layer) => {
      if (layer.kind === "color") {
        if (typeof layer.color === "string") return layer;
        changed = true;
        const read = color(layer.color);
        const resolved = { ...layer, color: read.color };
        if (read.ref) FILL_TOKEN_REFS.set(resolved, read.ref);
        return resolved;
      }
      if (!("stops" in layer)) return layer;
      if (layer.stops.every((stop) => typeof stop.color === "string"))
        return layer;
      changed = true;
      const stops = layer.stops.map((stop) => {
        if (typeof stop.color === "string") return stop;
        const read = color(stop.color);
        const resolved = { ...stop, color: read.color };
        if (read.ref) FILL_TOKEN_REFS.set(resolved, read.ref);
        return resolved;
      });
      return { ...layer, stops };
    });
    return (changed ? out : fills) as readonly CatalogResolvedFillLayer[];
  };
  const applyValues = (
    target: Props,
    values: Readonly<Record<string, AuthoredValue>>,
  ): void => {
    for (const [key, value] of Object.entries(values)) {
      target[key] = tokenValue(value);
      noteTokenRef(target, key, value);
    }
  };
  const applyWrites = (
    target: Record<string, PropValue | null>,
    writes: Readonly<Record<string, WriteValue<AuthoredValue | number | null>>>,
  ): void => {
    for (const [key, write] of Object.entries(writes)) {
      if (write.kind === "mask") {
        delete target[key];
        noteTokenRef(target, key, undefined);
        noteTokenRef(target, key, undefined, AUTHORED_TOKEN_REFS);
      } else if (write.kind === "set") {
        target[key] = write.value === null ? null : tokenValue(write.value);
        noteTokenRef(target, key, write.value);
        noteTokenRef(target, key, write.value, AUTHORED_TOKEN_REFS);
        if (key === "fontSize" || key === "lineHeight")
          noteLineWrite(target, key, write.value);
      }
      // remove resets this local layer; the inherited value remains visible.
    }
  };
  const noteLineWrite = (
    target: object,
    key: "fontSize" | "lineHeight",
    value: AuthoredValue | number | null,
  ) => {
    const state = LINE_WRITES.get(target) ?? {};
    LINE_WRITES.set(target, state);
    const ref = value === null ? undefined : tokenRefOf(value);
    if (key === "fontSize") {
      state.fontRef = ref && TYPOGRAPHY_FONT_REF.test(ref) ? ref : undefined;
      return;
    }
    state.lineAuthored = true;
    const px = ref ? (target as Record<string, unknown>)[key] : undefined;
    state.linePx = typeof px === "number" ? px : undefined;
  };
  /**
   * ADR-298 D4 ① ② — the line ratio of a record whose writes set a typography font size or a line-height
   * token: ② a line-height token is px, held as px ÷ the final font size; ① with no authored line height,
   * a font size token brings its pair (`{typography.<name>--line-height}`) ÷ that size — the rule's ratio
   * was for the rule's font size.
   */
  const finishLineHeight = (visual: Record<string, PropValue | null>) => {
    const state = LINE_WRITES.get(visual);
    if (!state) return;
    LINE_WRITES.delete(visual);
    const fontSize = visual.fontSize;
    if (typeof fontSize !== "number" || !(fontSize > 0)) return;
    if (state.linePx !== undefined) {
      visual.lineHeight = state.linePx / fontSize;
      LINE_FINISHED.add(visual);
      return;
    }
    if (state.lineAuthored || !state.fontRef) return;
    const name = TYPOGRAPHY_FONT_REF.exec(state.fontRef)![1]!;
    const pair = readThemeTokenValue(
      `{typography.${name === "text-md" ? "text-base" : name}--line-height}`,
      "number",
      tokenMode ?? "light",
    );
    if (typeof pair === "number") {
      visual.lineHeight = pair / fontSize;
      LINE_FINISHED.add(visual);
    }
  };
  /** `ResolvedCatalogNode.stateVisual` of the state rule layers a node takes, lowest first. */
  const stateValues = (
    layers: readonly (StateRules | undefined)[],
  ): ResolvedCatalogNode["stateVisual"] => {
    let out: Partial<Record<StateName, Values>> | undefined;
    for (const rules of layers) {
      if (!rules) continue;
      for (const name in rules) {
        const writes = rules[name as StateName];
        if (writes)
          applyWrites(
            ((out ??= {})[name as StateName] ??= {}) as Record<
              string,
              PropValue | null
            >,
            writes,
          );
      }
    }
    if (!out) return undefined;
    for (const name of Object.keys(out) as StateName[])
      if (Object.keys(out[name]!).length === 0) delete out[name];
    return Object.keys(out).length ? out : undefined;
  };
  /**
   * Structural ancestor type names, nearest first (collapsed composite layers skipped). An owned
   * origin instance is its template root's type: a TreeItem node in an owned TreeItem instance
   * (placed since 2026-10-14) sits in a TreeItem, not a "TreeItem/Default".
   */
  function* ancestorTypes(
    context: ParentContext | undefined,
  ): Generator<string> {
    for (
      let cursor = structuralParent(context);
      cursor;
      cursor = structuralParent(cursor.parent)
    )
      yield ruleDefinitionOf(cursor.definitionId).name;
  }
  const base = (definitionId: DefinitionId) => {
    const definition = lookupDefinition(definitionId);
    const props: Props = {};
    const visual: Values = {};
    const layout: Record<string, string> = {
      ...("layout" in definition ? definition.layout : undefined),
    };
    applyValues(props, definition.defaults);
    applyValues(visual, definition.visual);
    return { definition, props, visual, layout };
  };
  const matches = (
    condition: Readonly<Record<string, Scalar>> | undefined,
    values: Props,
  ): boolean =>
    !condition ||
    Object.entries(condition).every(([key, value]) => values[key] === value);
  /** Conditional rules of the node's own definition, then part rules of its parent definition. */
  const applyTypedRules = (
    definitionId: DefinitionId,
    props: Props,
    visual: Values,
    layout: Record<string, string>,
    parent: ParentContext | undefined,
    nodeState: StateName | undefined = state,
  ): void => {
    const definition = lookupDefinition(definitionId);
    if ("conditionalRules" in definition)
      for (const rule of definition.conditionalRules ?? [])
        if (
          matches(rule.when, props) &&
          (rule.state === undefined || rule.state === nodeState)
        ) {
          if (rule.visual) applyValues(visual, rule.visual);
          if (rule.layout) {
            Object.assign(layout, rule.layout);
            // (ADR-295 후속: a `scaled` maximum's length token — the DOM writes its device formula.)
            for (const key of Object.keys(rule.layout))
              noteTokenRef(layout, key, rule.layoutTokens?.[key as "maxWidth"]);
          }
        }
    let near = structuralParent(parent);
    // (ADR-315 Phase 5 증분 5e — a Row inside a Row (a detail row — RAC's nested `<Row>`, drawn as a
    //  row of its Table's body) takes the rules a body row takes: its owner is the body.)
    if (ruleDefinitionOf(definitionId).name === "Row")
      while (near && ruleDefinitionOf(near.definitionId).name === "Row")
        near = structuralParent(near.parent);
    if (!near) return;
    // A toggle's part rules are descendant selectors (`.react-aria-Checkbox .react-aria-CheckboxButton`,
    // `.react-aria-CheckboxButton … .checkbox`): a layout frame the author put inside the toggle
    // passes them through (ADR-256 Phase 3 review m1). So does a TreeItem's chevron rule
    // (`.react-aria-TreeItem .react-aria-Button[slot="chevron"]` — Phase 5 Round 12). Other
    // owners' rules stop at the frame.
    const passHostOwner = (
      context: ParentContext,
    ): ParentContext | undefined => {
      const owners =
        CATALOG_PART_RULE_PASS_HOSTS[
          lookupDefinition(context.definitionId).name
        ];
      if (!owners) return undefined;
      const above = pastFrames(structuralParent(context.parent));
      return above && owners.has(lookupDefinition(above.definitionId).name)
        ? above
        : undefined;
    };
    const pastFrames = (context: ParentContext | undefined) => {
      let cursor = context;
      while (
        cursor &&
        PART_RULE_LAYOUT_FRAMES.has(lookupDefinition(cursor.definitionId).name)
      )
        cursor = structuralParent(cursor.parent);
      return cursor;
    };
    // (A Disclosure's sheet is descendant selectors too — `.react-aria-Disclosure .react-aria-Heading`,
    // `… .react-aria-Button[slot='trigger']`: a frame around its Heading passes them, Phase 8 판독 M1.)
    const toggleFamily = (context: ParentContext | undefined) => {
      const name = context && lookupDefinition(context.definitionId).name;
      return (
        !!name &&
        (OWNER_DRAWN_PART_HOSTS[name] !== undefined ||
          Object.values(OWNER_DRAWN_PART_HOSTS).includes(name) ||
          name === "TreeItemContent" ||
          name === "Disclosure" ||
          // (S2 SideNavPanel's nav sits in its content `div` — a frame, 2026-11-18 — and a Tag's
          //  icon · avatar · text in its content `div`, S2 `TagWrapper`.)
          name === "SideNavPanel" ||
          name === "Tag" ||
          // (2026-11-18: a Slider's rows — its label container · field input.)
          name === "Slider" ||
          name === "RangeSlider")
      );
    };
    // (A `via` wrapper whose owner's rules reach a frame in it — a Card's Content,
    //  `CATALOG_PART_RULE_FRAMED_WRAPPERS`.)
    const framedWrapper = (context: ParentContext | undefined) => {
      const owners =
        context &&
        CATALOG_PART_RULE_FRAMED_WRAPPERS[
          lookupDefinition(context.definitionId).name
        ];
      const above = owners && structuralParent(context.parent);
      return !!above && owners.has(ruleDefinitionOf(above.definitionId).name);
    };
    const pastNear = pastFrames(near);
    const owner =
      toggleFamily(pastNear) || (pastNear !== near && framedWrapper(pastNear))
        ? pastNear!
        : near;
    const grandNear = structuralParent(owner.parent);
    const grandHost = toggleFamily(pastFrames(grandNear))
      ? pastFrames(grandNear)
      : grandNear;
    // ADR-256 Phase 8c: a Disclosure's header Heading passes its owner's rules to its trigger's
    // content (`.react-aria-Button[slot='trigger'] > .react-aria-Text` — the sheet reaches through
    // the Heading): the grandparent of the trigger's chevron and title is the Disclosure.
    const passedOwner = grandHost && passHostOwner(grandHost);
    const grand = passedOwner ?? grandHost;
    // The parent's own rules, then the grandparent's `via` rules (through this node's parent): a
    // selector reaching through the wrapper from its owner is the more specific one in the sheet.
    // A side Form's label column reaches its fields at any depth (`formFieldLabelPartRules` — the
    // sheet's `--form-label-width` is inherited, as S2's Form context): the nearest Form's `via`
    // rules through the field (2026-10-10).
    let form: ParentContext | undefined;
    if (CATALOG_FORM_FIELDS.has(lookupDefinition(owner.definitionId).name)) {
      form = structuralParent(owner.parent);
      while (form && ruleDefinitionOf(form.definitionId).name !== "Form")
        form = structuralParent(form.parent);
    }
    const owners: Array<{ owner: ParentContext; via?: DefinitionId }> = [
      { owner },
      ...(grand ? [{ owner: grand, via: owner.definitionId }] : []),
      ...(form && form !== grand
        ? [{ owner: form, via: owner.definitionId }]
        : []),
    ];
    // (A child's unsaved condition props — a notification Badge's digits — as an owner's.)
    const childConditions = catalogPartConditionProps(
      ruleDefinitionOf(definitionId).name,
      props,
    );
    for (const { owner: ruleOwner, via } of owners) {
      // (An instance's own children are its root's: a Button instance's own Icon takes the Button
      // rule's icon size, as the template's Icon does — ADR-259 Phase 2, a NumberField's stepper
      // glyphs once its Group's children are owned copies.)
      const own = lookupDefinition(ruleOwner.definitionId);
      const ownerDefinition =
        via || !("partRules" in own && own.partRules?.length)
          ? ruleDefinitionOf(ruleOwner.definitionId)
          : own;
      if (!("partRules" in ownerDefinition)) continue;
      // (Such an instance's props are its own writes: its root's defaults fill the rest.)
      const ownerProps =
        !via && ownerDefinition !== own && "defaults" in ownerDefinition
          ? ({
              ...(ownerDefinition.defaults ?? {}),
              ...ruleOwner.props,
            } as typeof ruleOwner.props)
          : ruleOwner.props;
      // (The wrapper a `via` rule names is its type: an owned instance of the type's origin — a
      // detached Select's trigger, `origin-component-button` — is that type, G5 example 3.)
      const viaType = via && (ruleDefinitionOf(via) as { id?: string }).id;
      for (const rule of ownerDefinition.partRules ?? [])
        if (
          rule.child.definitionId === definitionId &&
          (rule.child.via === via ||
            (viaType !== undefined && rule.child.via === viaType)) &&
          matches(rule.child.props, childConditions) &&
          (!via || matches(rule.child.viaProps, owner.props)) &&
          matches(
            rule.when,
            catalogPartConditionProps(ownerDefinition.name, ownerProps),
          ) &&
          (rule.state === undefined ||
            rule.state === (ruleOwner.state ?? state))
        ) {
          if (rule.visual) applyValues(visual, rule.visual);
          if (rule.layout) {
            Object.assign(layout, rule.layout);
            // ADR-295 Phase 3c-3b: a margin's length token (the DOM writes its device formula).
            for (const key of Object.keys(rule.layout))
              noteTokenRef(
                layout,
                key,
                rule.layoutTokens?.[key as "marginLeft"],
              );
          }
        }
    }
  };
  const findOverride = (definitionId: DefinitionId) => {
    if (!definitionId.startsWith("lib:")) return undefined;
    return graph.getDefinitionOverride(definitionId);
  };
  /** Resolved values of the keys a composite instance authored (not its definition defaults). */
  const instanceRoot = (
    propKeys: readonly string[],
    props: Props,
    visualKeys: readonly string[],
    visual: Values,
    sizing: Readonly<Record<string, number | null>>,
    layout: Readonly<Record<string, string>> = {},
    paint: Pick<InstanceRoot, "fills" | "fillSizing"> = {},
    from: Pick<InstanceRoot, "origin" | "stateRules"> = {},
  ): InstanceRoot => {
    const root: InstanceRoot = {
      props: {},
      visual: {},
      sizing: { ...sizing },
      layout: { ...layout },
      ...(paint.fills ? { fills: paint.fills } : {}),
      ...(paint.fillSizing ? { fillSizing: paint.fillSizing } : {}),
      ...from,
    };
    for (const key of propKeys) if (key in props) root.props[key] = props[key];
    for (const key of visualKeys)
      if (key in visual) root.visual[key] = visual[key];
    // (ADR-298 D4: a line ratio the font size token brought goes along with it.)
    if (LINE_FINISHED.has(visual) && "fontSize" in root.visual)
      root.visual.lineHeight = visual.lineHeight;
    copyResolvedTokenRefs(root.visual, visual, Object.keys(root.visual));
    copyResolvedTokenRefs(root.layout, layout);
    return root;
  };
  /**
   * Bindings a composite offers its own template: its accepted keys (the declared edit schema),
   * valued from the resolved props, then the declared default. Nested composites bind their own
   * template; an outer binding never reaches an inner composite's placeholders.
   */
  const templateBindings = (
    definitionId: DefinitionId,
    props: Props,
    /** A row template item: its content defaults are sample content (`dropLiteralContent`). */
    rowStart?: boolean,
  ): Props | undefined => {
    const definition = lookupDefinition(definitionId);
    if (definition.mode !== "composite") return undefined;
    const bindings: Props = {};
    for (const key of Object.keys(definition.accepts)) {
      const fallback =
        definition.defaults[key] === undefined ||
        (rowStart &&
          (ROW_TEMPLATE_BINDABLE_PROP_KEYS as readonly string[]).includes(key))
          ? undefined
          : definition.defaults[key];
      const value =
        props[key] ??
        (fallback === undefined ? undefined : tokenValue(fallback));
      if (value !== undefined) bindings[key] = value;
    }
    // (S2 체크리스트 §9.3 — the keys another prop's value picks: AlertDialog's button variant ·
    //  title glyph · auto-focus button.)
    const maps =
      "bindingMaps" in definition ? definition.bindingMaps : undefined;
    for (const [key, map] of Object.entries(maps ?? {})) {
      const chosen = bindings[map.from];
      const value =
        chosen !== undefined && Object.hasOwn(map.values, String(chosen))
          ? map.values[String(chosen)]
          : map.otherwise;
      if (value !== undefined) bindings[key] = value;
    }
    return bindings;
  };
  /**
   * ADR-261 Decision 4 — what a user component's properties write in one unfolding of its
   * template: keyed by that projection's instance path (the composite position's), then by the
   * origin node a property drives. The composite position sets it from its own resolved props (an
   * instance's value, or an outer instance's patch on a nested one); no value = the node's own.
   */
  const propertyScopes = new Map<string, Map<string, ComponentPropertyWrite>>();
  const scopeKey = (path: readonly string[]) => path.join("\u0001");
  const scopeProperties = (
    path: readonly string[],
    definitionId: DefinitionId,
    props: Props,
  ): void => {
    const properties = componentPropertiesOf(lookupDefinition(definitionId));
    if (!properties) return;
    const writes = componentPropertyWrites(properties, (key) => props[key]);
    if (writes.size) propertyScopes.set(scopeKey(path), writes);
    else propertyScopes.delete(scopeKey(path));
  };
  /** A composite's authored root keys without its property keys (not its template root's props). */
  const withoutPropertyKeys = (
    definitionId: DefinitionId,
    keys: readonly string[],
  ): readonly string[] => {
    const properties = componentPropertiesOf(lookupDefinition(definitionId));
    if (!properties) return keys;
    const own = new Set(properties.map((property) => property.key));
    return keys.filter((key) => !own.has(key));
  };
  /**
   * An owner's `size` set on the child it propagates to (`CATALOG_SIZE_PROPAGATION` — RSP context:
   * a group's size reaches its items, an item's its label). The owner wins over the child's own
   * value, like the old `override: true` propagation; a size the child does not offer stays out.
   */
  const applyOwnerSize = (
    definitionId: DefinitionId,
    props: Props,
    parent: ParentContext | undefined,
  ): void => {
    const definition = lookupDefinition(definitionId);
    // (A toggle takes its group's size wherever it sits in the group — the nearest group of its
    // type, as its values do: straight in the group, not only in its items box — Codex Round 21.)
    const groupType = CATALOG_SIZE_CONTEXT_OF[definition.name];
    if (groupType && definition.accepts.size === "string") {
      let cursor = structuralParent(parent);
      while (cursor && lookupDefinition(cursor.definitionId).name !== groupType)
        cursor = structuralParent(cursor.parent);
      const groupSize = cursor?.props.size;
      if (typeof groupSize === "string") {
        const choices =
          "propChoices" in definition
            ? definition.propChoices?.size
            : undefined;
        if (!choices || choices.map(String).includes(groupSize))
          props.size = groupSize;
        return;
      }
    }
    let owner = structuralParent(parent);
    // (A Group · frame between takes no size — the owner's reaches through it, as RAC's context:
    // a field's control Group (ADR-256 Phase 6b), a Group around a group's item (Round 21).)
    while (
      owner &&
      CATALOG_SIZE_PASS_THROUGH.has(lookupDefinition(owner.definitionId).name)
    )
      owner = structuralParent(owner.parent);
    const ownerSize = owner?.props.size;
    if (typeof ownerSize !== "string" && typeof ownerSize !== "number") return;
    const ownerName = lookupDefinition(owner!.definitionId).name;
    if (
      !CATALOG_SIZE_PROPAGATION[ownerName]?.includes(definition.name) ||
      !["string", "avatarSize"].includes(definition.accepts.size)
    )
      return;
    // (A child whose rule names the owner's look one step apart — `CATALOG_SIZE_STEP`.)
    // (A compact owner may step further — `CATALOG_SIZE_STEP_COMPACT`.)
    const size =
      (owner!.props.density === "compact"
        ? CATALOG_SIZE_STEP_COMPACT[ownerName]?.[definition.name]?.[
            String(ownerSize)
          ]
        : undefined) ??
      CATALOG_SIZE_STEP[ownerName]?.[definition.name]?.[String(ownerSize)] ??
      ownerSize;
    const choices =
      "propChoices" in definition ? definition.propChoices?.size : undefined;
    if (choices && !choices.map(String).includes(size)) return;
    props.size = size;
  };
  /**
   * S2 density context (2026-10-10): a Table's `density` reaches the Columns · Cells in it
   * (`CATALOG_DENSITY_PROPAGATION_OWNER` — S2 table density rows every cell). The owner wins:
   * the parts carry no editable density (`editorHidden`), so nothing authored competes.
   */
  const applyOwnerDensity = (
    definitionId: DefinitionId,
    props: Props,
    parent: ParentContext | undefined,
  ): void => {
    const definition = lookupDefinition(definitionId);
    const ownerType = CATALOG_DENSITY_PROPAGATION_OWNER[definition.name];
    if (!ownerType || definition.accepts.density !== "string") return;
    let owner = structuralParent(parent);
    while (owner && lookupDefinition(owner.definitionId).name !== ownerType)
      owner = structuralParent(owner.parent);
    const density = owner?.props.density;
    if (typeof density === "string") props.density = density;
    if (ownerType === "Tabs" && owner) {
      props.orientation = owner.props.orientation ?? "horizontal";
      props.labelBehavior = owner.props.labelBehavior ?? "show";
    }
  };
  /**
   * ADR-257 Phase 3 — S2 `overflowMode`: the nearest Table's value reaches its
   * Columns · Cells, a GridList's its items (`CATALOG_OVERFLOW_MODE_OWNERS`) — the parts have no
   * editor for it.
   */
  const applyOwnerOverflowMode = (
    definitionId: DefinitionId,
    props: Props,
    parent: ParentContext | undefined,
  ): void => {
    const definition = lookupDefinition(definitionId);
    const owners = CATALOG_OVERFLOW_MODE_OWNERS[definition.name];
    if (!owners || definition.accepts.overflowMode !== "string") return;
    let owner = structuralParent(parent);
    while (owner && !owners.includes(lookupDefinition(owner.definitionId).name))
      owner = structuralParent(owner.parent);
    const mode = owner?.props.overflowMode;
    if (typeof mode === "string") props.overflowMode = mode;
  };
  /**
   * ADR-315 Phase 4 — S2 `ColumnWithMenu`'s `isMenu` (`catalogColumnHasMenu`): the Column's own
   * resize · hide · pin · filter, or a switch of its Table (read through the header, as `overflowMode`).
   * Written before the Column's rule variants — its `is-menu` block, the Table's end line part rule
   * and the DOM read this one value. The selection column (`Checkbox[slot=selection]`) has none.
   */
  const applyColumnMenu = (
    definitionId: DefinitionId,
    props: Props,
    parent: ParentContext | undefined,
    children: readonly string[],
  ): void => {
    if (lookupDefinition(definitionId).name !== "Column") return;
    let table = structuralParent(parent);
    while (table && lookupDefinition(table.definitionId).name !== "Table")
      table = structuralParent(table.parent);
    // (S2 `isMenu` — `allowsResizing || !!menuItems`: a Column holding MenuItems has a menu, §9.2.)
    const hasMenuItems = children.some(
      (childId) => templateTypeName(childId as TemplateId) === "MenuItem",
    );
    if (
      (catalogColumnHasMenu(props, table?.props) || hasMenuItems) &&
      !children.some(
        (childId) =>
          templateTypeName(childId as TemplateId) === "Checkbox" &&
          authoredScalar(childId, "slot") === "selection",
      )
    )
      props[CATALOG_COLUMN_MENU_PROP] = true;
    else delete props[CATALOG_COLUMN_MENU_PROP];
  };
  /** A template · node's own authored prop value (a library template's raw, a node's `set`). */
  const authoredScalar = (id: string, key: string): unknown => {
    const entry = id.startsWith("lib:")
      ? library.templates.get(id as `lib:template:${string}`)
      : graph.getEntry(id);
    const value =
      entry && "props" in entry
        ? (entry.props as Record<string, unknown> | undefined)?.[key]
        : undefined;
    return value && typeof value === "object" && "kind" in value
      ? (value as { value?: unknown }).value
      : value;
  };
  /**
   * ADR-259 Phase 1 — S2 ListView · Menu `hideLinkOutIcon`: the nearest GridList · Menu's value
   * reaches its items (`CATALOG_LINK_OUT_OWNERS` — S2 gives it through context; an item has no
   * editor for it). The owner wins: absent there, the item's copy is cleared.
   */
  const applyOwnerHideLinkOut = (
    definitionId: DefinitionId,
    props: Props,
    parent: ParentContext | undefined,
  ): void => {
    const definition = lookupDefinition(definitionId);
    const ownerType = CATALOG_LINK_OUT_OWNERS[definition.name];
    if (!ownerType || definition.accepts.hideLinkOutIcon !== "boolean") return;
    let owner = structuralParent(parent);
    while (owner && lookupDefinition(owner.definitionId).name !== ownerType)
      owner = structuralParent(owner.parent);
    if (owner?.props.hideLinkOutIcon === true) props.hideLinkOutIcon = true;
    else delete props.hideLinkOutIcon;
  };
  /**
   * ADR-259 Phase 3 — S2 `ContextualHelp`: its trigger's glyph is its variant's
   * (`catalogContextualHelpGlyph` — `help` · `info`, S2 `ContextualHelp.tsx:210`). The help wins:
   * S2 draws no other icon there.
   */
  const applyContextualHelpGlyph = (
    definitionId: DefinitionId,
    props: Props,
    parent: ParentContext | undefined,
  ): void => {
    if (lookupDefinition(definitionId).name !== "Icon") return;
    const button = structuralParent(parent);
    if (
      !button ||
      lookupDefinition(button.definitionId).name !== "ActionButton"
    )
      return;
    const help = structuralParent(button.parent);
    if (!help || lookupDefinition(help.definitionId).name !== "ContextualHelp")
      return;
    props.iconName = catalogContextualHelpGlyph(help.props.variant);
  };
  /**
   * S2 Form context (`formContext.ts`): a field takes the nearest Form's value for each context
   * key it did not author — S2 `useFormProps` fills only `undefined` keys. The Form reaches through
   * any element between (React context), the nearest Form wins.
   */
  /** S2 context props (`CATALOG_OWNER_CONTEXT_PROPS`): the nearest owner's value, unless authored. */
  const applyOwnerContext = (
    definitionId: DefinitionId,
    props: Props,
    parent: ParentContext | undefined,
    authored: ReadonlySet<string>,
  ): void => {
    const definition = lookupDefinition(definitionId);
    const context = CATALOG_OWNER_CONTEXT_PROPS[definition.name];
    if (!context) return;
    let owner = structuralParent(parent);
    let within = !context.within;
    while (
      owner &&
      lookupDefinition(owner.definitionId).name !== context.owner
    ) {
      if (lookupDefinition(owner.definitionId).name === context.within)
        within = true;
      owner = structuralParent(owner.parent);
    }
    if (!owner || !within) return;
    for (const key of context.keys) {
      if (authored.has(key) || !(key in definition.accepts)) continue;
      const value = owner.props[key];
      if (value !== undefined) props[key] = value;
    }
  };
  const applyFormContext = (
    definitionId: DefinitionId,
    props: Props,
    parent: ParentContext | undefined,
    authored: ReadonlySet<string>,
  ): void => {
    const definition = lookupDefinition(definitionId);
    if (!CATALOG_FORM_FIELDS.has(definition.name)) return;
    let form = structuralParent(parent);
    while (form && lookupDefinition(form.definitionId).name !== "Form")
      form = structuralParent(form.parent);
    if (!form) return;
    for (const key of CATALOG_FORM_CONTEXT_KEYS) {
      if (authored.has(key) || !(key in definition.accepts)) continue;
      const value = form.props[key];
      if (value !== undefined) props[key] = value;
    }
  };
  /**
   * S2 toggle 강조 context (`CATALOG_EMPHASIS_FROM_GROUP`, 2026-10-10): 그룹 안의 Checkbox ·
   * Radio 는 가장 가까운 자기 그룹의 `isEmphasized` 를 쓴다 — S2 는 그룹 값이 toggle 자신의
   * prop 을 **이긴다** (`isInCheckboxGroup ? ctx?.isEmphasized : props.isEmphasized`), 그룹이
   * 안 켰으면 toggle 의 것도 꺼진다.
   */
  const applyOwnerEmphasis = (
    definitionId: DefinitionId,
    props: Props,
    parent: ParentContext | undefined,
  ): void => {
    const definition = lookupDefinition(definitionId);
    const groupType = CATALOG_EMPHASIS_FROM_GROUP[definition.name];
    if (!groupType) return;
    let group = structuralParent(parent);
    while (group && lookupDefinition(group.definitionId).name !== groupType)
      group = structuralParent(group.parent);
    if (!group) return;
    if (group.props.isEmphasized === true) props.isEmphasized = true;
    else delete props.isEmphasized;
  };
  /** 그룹의 상태 상속: S2 ToggleButton은 명시적인 false도 자식 값보다 우선한다. */
  const applyGroupTurnsOn = (
    definitionId: DefinitionId,
    props: Props,
    parent: ParentContext | undefined,
  ): void => {
    const entry = CATALOG_GROUP_TURNS_ON[lookupDefinition(definitionId).name];
    if (!entry) return;
    let group = structuralParent(parent);
    while (group && lookupDefinition(group.definitionId).name !== entry.group)
      group = structuralParent(group.parent);
    if (!group) return;
    for (const key of entry.keys)
      if (
        group.props[key] === true ||
        (entry.overridesFalse && group.props[key] === false)
      )
        props[key] = group.props[key];
  };
  /**
   * S2 CardView context (`CATALOG_VARIANT_FROM_OWNER`, 2026-10-10): CardView 의 `variant` 를
   * 안의 Card 중 자기 값을 안 적은 것이 입는다 (S2 `ctx = {size, variant}` — 작성 값이 이긴다).
   */
  const applyOwnerVariant = (
    definitionId: DefinitionId,
    props: Props,
    parent: ParentContext | undefined,
    authored: ReadonlySet<string>,
  ): void => {
    const definition = lookupDefinition(definitionId);
    const ownerType = CATALOG_VARIANT_FROM_OWNER[definition.name];
    if (!ownerType || authored.has("variant")) return;
    let owner = structuralParent(parent);
    while (owner && lookupDefinition(owner.definitionId).name !== ownerType)
      owner = structuralParent(owner.parent);
    const variant = owner?.props.variant;
    if (typeof variant === "string") props.variant = variant;
  };
  /**
   * S2 강조 · quiet boolean 축 (`CATALOG_BOOLEAN_VARIANTS`, 2026-10-10): 공개 prop 은 boolean
   * (`isEmphasized`) 이고 rule 변형은 내부 운반 값 (`editorHidden` variant) 이다 — 여기서
   * 파생하므로 Canvas rule paint 와 DOM 이 종전 record 그대로 읽는다. 작성자 variant 는 이제
   * 패널에 없다 — 남은 값은 옛 문서의 것으로, 로드 전환이 지웠거나 기본값이다.
   */
  const applyBooleanVariant = (
    definitionId: DefinitionId,
    props: Props,
  ): void => {
    const definition = lookupDefinition(definitionId);
    const mapping = CATALOG_BOOLEAN_VARIANTS[definition.name];
    if (!mapping) return;
    if (
      props[mapping.prop] === true &&
      (props.variant === undefined || props.variant === "default")
    )
      props.variant = mapping.variant;
  };
  const applyPropVisualRules = (
    definitionId: DefinitionId,
    props: Props,
    visual: Values,
  ): void => {
    const definition = lookupDefinition(definitionId);
    if (!("propVisualRules" in definition) || !definition.propVisualRules)
      return;
    for (const [prop, choices] of Object.entries(definition.propVisualRules)) {
      const choice = props[prop];
      if (typeof choice !== "string" && typeof choice !== "number") continue;
      const selected = choices[String(choice)];
      if (selected) applyValues(visual, selected);
    }
    if (definition.name === "Avatar") {
      const diameter = catalogAvatarCssSize(props.size);
      visual.width = diameter;
      visual.height = diameter;
    }
  };
  const stateVisual = (
    definitionId: DefinitionId,
    nodeState: StateName | undefined = state,
  ): VisualWrites[] => {
    if (!nodeState) return [];
    const definition = lookupDefinition(definitionId);
    const rule = definition.stateRules[nodeState];
    const override = findOverride(definitionId)?.stateRules[nodeState];
    return [rule, override].filter((item): item is VisualWrites => !!item);
  };
  /**
   * ADR-282: the bindings of an unlocked origin whose copy is drawn as owned nodes (the Library
   * page card's ◆ — the copy root itself, no instance): the origin's defaults (its override's over
   * the library's), as its locked sample showed them. Set while that subtree resolves.
   */
  let ownedForkBindings: Props | undefined;
  const resolveOwned = (
    ...args: Parameters<typeof resolveOwnedNode>
  ): ResolvedCatalogNode | undefined => {
    const origin = graph.definitionOfTemplateRoot(args[0].id);
    if (!origin?.startsWith("lib:")) return resolveOwnedNode(...args);
    const outer = ownedForkBindings;
    const defaults: Props = {};
    applyWrites(defaults, findOverride(origin)?.defaults ?? {});
    // (The open page's display text first — what no prop binds, e.g. an item's `{label}`.)
    ownedForkBindings = {
      ...graph.originDisplayBindings(origin),
      ...templateBindings(origin, defaults),
    };
    try {
      return resolveOwnedNode(...args);
    } finally {
      ownedForkBindings = outer;
    }
  };
  const resolveOwnedNode = (
    node: NodeEntry,
    instancePath: readonly (NodeId | TemplateId)[],
    inherited?: {
      props: Props;
      visual: Values;
      slot?: { name: string; required: boolean };
    },
    parent?: ParentContext,
    /**
     * A data row over an owned node (2026-10-14): `rowStart` on a bound collection's own first item
     * (the row template — its literal content is sample content, its key the row's), `row` on what
     * it holds, `rowSet` passed to an owned part with no item of its own (TagGroup > TagList).
     */
    ownedRowing?: {
      row?: CatalogBoundRow;
      rowStart?: boolean;
      rowLabel?: CatalogRowLabel;
      rowSet?: readonly CatalogBoundRow[];
      sampleOwner?: NodeId;
    },
  ): ResolvedCatalogNode | undefined => {
    // `useListData.getItem(key)` — a keyed binding is one item: its descendants read its fields
    // (a container), a collection repeats it alone. Inside a data row the key may name the row's
    // fields (ADR-284 — `{teamId}`: the Teams row a Users row points at · `{id}`: an Orders count
    // grouped by user, the reverse count); its own item wins over the row it sits in.
    // (ADR-310 ①: an item repeated over its own binding shows one of those rows — the binding is
    //  the repetition's, not a list it holds.)
    const nodeBinding =
      node.repeat && ownedRowing?.rowStart ? undefined : node.binding;
    const rowKey =
      node.binding?.key !== undefined && ownedRowing?.row
        ? bindRowValue(node.binding.key, ownedRowing.row)
        : node.binding?.key;
    const keyedRows =
      node.binding?.key !== undefined && rows
        ? rows(
            rowKey === node.binding.key
              ? node.binding
              : { ...node.binding, key: String(rowKey) },
            "items",
            node.id,
            instancePath,
          )
        : undefined;
    const ownedRow = keyedRows?.[0] ?? ownedRowing?.row;
    const sampleOwner = ownedRowing?.rowStart
      ? node.id
      : ownedRowing?.sampleOwner;
    // (A Breadcrumb row's label text is the row's label — as on a template position.)
    const ownedType = ruleDefinitionOf(node.definitionId).name;
    const ownedRowLabel = ownedRow
      ? ownedType === "TabPanel"
        ? ("content" as const)
        : ownedType === "Breadcrumb"
          ? ("label" as const)
          : ownedType === "Card"
            ? ("slots" as const)
            : ownedRowing?.rowLabel
      : undefined;
    selection?.onVisit?.(node.id);
    if (node.enabled === false) return undefined;
    if (!catalogNodeVisibleAt(node, breakpoint)) return undefined;
    const layers = responsiveLayers(node);
    const { definition, props, visual, layout } = base(node.definitionId);
    const override = findOverride(node.definitionId);
    if (override) {
      applyWrites(props, override.defaults as PropWrites);
      applyWrites(visual, override.visual);
    }
    if (inherited) {
      Object.assign(props, inherited.props);
      Object.assign(visual, inherited.visual);
      copyResolvedTokenRefs(visual, inherited.visual);
    }
    if (ownedRow && ownedRowing?.rowStart) dropLiteralContent(props);
    applyWrites(
      props,
      ownedRow && sampleOwner ? withoutSampleContent(node.props) : node.props,
    );
    if (ownedForkBindings) {
      for (const key of Object.keys(node.props))
        if (key in props)
          props[key] = bindTemplateValue(props[key], ownedForkBindings);
      withoutUnboundSlot(props, ownedForkBindings);
    }
    // ADR-310 Phase 7 — a connected Pagination's number group: the window it shows (its first ·
    // last page and gaps read it — `catalogPaginationPartHidden`), the shown page `aria-current`
    // and not quiet (shadcn `PaginationLink isActive` — outline among ghosts), the last page's number.
    // (The Pagination above a part — across its navigation frame: shadcn's `Field` + `nav` pair,
    //  2026-11-19.)
    const paginationAbove = (id: string | undefined): NodeEntry | undefined => {
      for (
        let owner = id ? graph.ownerOf(id as NodeId) : undefined;
        owner;
        owner = graph.ownerOf(owner as NodeId)
      ) {
        const entry = graph.getEntry(owner as NodeId);
        if (entry?.kind !== "node") return undefined;
        const name = ruleDefinitionOf(entry.definitionId).name;
        if (name === "Pagination") return entry;
        if (name !== "frame") return undefined;
      }
      return undefined;
    };
    const pagerOf = (groupId: string | undefined) => {
      const pager = paginationAbove(groupId);
      return pager?.pagesOf ? pager : undefined;
    };
    // (A Pagination's 「Icons only」 — 2026-11-19: its step buttons show the chevron alone — the word's
    //  Text hides, `catalogPaginationPartHidden` — and the word becomes the name.)
    if (ownedType === "ActionButton") {
      const pagination = paginationAbove(node.id);
      const controls = pagination?.props.controls;
      const word = node.props.label;
      if (
        controls?.kind === "set" &&
        controls.value === "iconsOnly" &&
        word?.kind === "set" &&
        typeof word.value === "string" &&
        word.value !== ""
      )
        props["aria-label"] = word.value;
    }
    // (Its 「Rows per page」 Select shows the list's page size — the viewer's in a running Preview,
    //  else the list's own Rows per page (the Canvas): 사용자 「table 의 시작값을 받아오게」 2026-11-19.
    //  The Canvas draws the trigger's own text — the Select origin's SelectValue reads `{placeholder}`.)
    if (ownedType === "Select") {
      const size = paginationPageSize(node.id);
      if (size !== undefined) {
        delete props.defaultValue;
        props.value = String(size);
        // (Also a size the Select does not offer — the list's own Rows per page, say 5.)
        props.placeholder = String(size);
      }
    }
    if (ownedType === "ActionButtonGroup" || ownedType === "ActionButton") {
      const groupId =
        ownedType === "ActionButtonGroup" ? node.id : graph.ownerOf(node.id);
      const pager = pagerOf(groupId);
      const pages = pager && rows?.pages?.(pager.pagesOf!, pager.id);
      // (Connected without pages — the Canvas draws the template once: a window of that one page, so
      //  the sample's last page 「10」 does not show a count the list does not have.)
      if (pager && !pages && ownedType === "ActionButtonGroup") {
        props._pageWindow = { start: 1, end: 1 };
        props._pageCount = 1;
      }
      if (pager && pages) {
        const range = pager.props.pageRange;
        const window = catalogPageWindow(
          pages.page,
          pages.count ?? 0,
          range?.kind === "set" ? range.value : undefined,
        );
        if (ownedType === "ActionButtonGroup") {
          props._pageWindow = {
            start: window[0] ?? 1,
            end: window.at(-1) ?? 0,
          };
          props._pageCount = pages.count ?? 0;
        } else if (ownedRow && ownedRowing?.rowStart) {
          const current = ownedRow.key === String(pages.page);
          props.isQuiet = !current;
          if (current) props["aria-current"] = "page";
          else delete props["aria-current"];
        } else if (props.id === "last") props.label = String(pages.count ?? "");
      }
    }
    if (ownedRow) {
      // ADR-310 Phase 4: a Cell that shows one field (`{status}`) shows it as a Table's data cell
      // does (`classifyTableCellDisplay` — a list joined, the rest counted).
      const cellField =
        ownedType === "Cell" && typeof props.children === "string"
          ? /^\{([^{}|]+)\}$/.exec(props.children)?.[1]?.trim()
          : undefined;
      // As on a row template position: only content props read the row (ADR-162 allowlist).
      for (const key of ROW_TEMPLATE_BINDABLE_PROP_KEYS)
        if (key in props) props[key] = bindRowValue(props[key], ownedRow);
      if (ownedRowing?.rowStart) keyRowItem(ownedType, props, ownedRow);
      const labelField = rowLabelField(ownedRowing?.rowLabel, props, ownedType);
      if (labelField)
        props.children = String(ownedRow.values[labelField] ?? "");
      if (cellField !== undefined && cellField in ownedRow.values) {
        const group =
          ownedRow.group?.column === cellField ? ownedRow.group : undefined;
        props.children =
          // (ADR-315 Phase 5 — a group row's grouped cell: its value and its row count.)
          group
            ? `${tableCellText(ownedRow.values[cellField])} (${
                // (ADR-315 Phase 5 증분 5g — a server's group whose rows' answer is not its count.)
                group.mismatch !== undefined
                  ? `${group.count} ≠ ${group.mismatch}`
                  : group.count
              })`
            : tableCellText(ownedRow.values[cellField]);
        // (The Builder's Canvas: its top group's cell — the tree column's (`_treeColumn`) — draws
        //  the expand button the DOM's RAC Cell draws (`CatalogTableCell`), closed. The DOM reads
        //  RAC's render props and takes no mark.)
        if (!tableState && group?.depth === 0)
          props[CATALOG_TREE_CELL_PROP] = group.expanded ? "open" : "closed";
        // (ADR-315 Phase 5 증분 5d — a tree's top row with child rows: its tree Column's cell.)
        else if (
          !tableState &&
          ownedRow.tree?.depth === 0 &&
          ownedRow.tree.parent &&
          cellField === canvasTreeColumn
        )
          props[CATALOG_TREE_CELL_PROP] = ownedRow.tree.expanded
            ? "open"
            : "closed";
      }
    }
    // `useAsyncList`'s `loadingState` beside its items (`<TableView loadingState={list.loadingState}>`
    // · `<Skeleton isLoading={list.isLoading}>`): a bound Table · Skeleton reads its collection's load.
    const loadingType = rows ? ownedType : undefined;
    if (loadingType && LOADING_STATE_TYPES.has(loadingType)) {
      if (loadingType === "Skeleton") {
        // (2026-11-19: the content bound inside it — no binding of its own.)
        const loading = skeletonContentLoading(node.id);
        if (loading !== undefined) props.isLoading = loading;
      } else {
        const state = nodeBinding
          ? (keyedRows ?? rows!(nodeBinding, "items", node.id))?.loadingState
          : runsLoadingState(node, instancePath);
        if (state) props.loadingState = state;
      }
    }
    // S2 `disabledKeys` by a data field (부록 D.3 2단계, 2026-11-23): a bound collection's rows its
    // disabled field marks join the keys it names (Canvas · DOM · dispatcher read the one list).
    const disabledRows =
      rows && nodeBinding && CATALOG_DATA_DISABLED_TYPES.has(ownedType)
        ? (keyedRows ?? rows(nodeBinding, "items", node.id))?.disabledKeys
        : undefined;
    // S2 `isDateUnavailable` from data (부록 D.3 2단계): the dates a date component's binding names
    // (its 「Unavailable date」 field, over the rows its conditions pass) — Canvas · DOM read them.
    const unavailableRows =
      rows &&
      nodeBinding?.fieldMap?.[CATALOG_UNAVAILABLE_FIELD] &&
      CATALOG_UNAVAILABLE_DATE_TYPES.has(ownedType)
        ? (keyedRows ?? rows(nodeBinding, "items", node.id))?.unavailableDates
        : undefined;
    if (unavailableRows) props[CATALOG_UNAVAILABLE_DATA_PROP] = unavailableRows;
    if (disabledRows?.length)
      props.disabledKeys = [
        ...new Set([
          ...(Array.isArray(props.disabledKeys)
            ? props.disabledKeys.map(String)
            : []),
          ...disabledRows,
        ]),
      ];
    applyFormContext(
      node.definitionId,
      props,
      parent,
      new Set([
        ...Object.keys(inherited?.props ?? {}),
        ...Object.keys(node.props),
      ]),
    );
    applyOwnerContext(
      node.definitionId,
      props,
      parent,
      new Set([
        ...Object.keys(inherited?.props ?? {}),
        ...Object.keys(node.props),
      ]),
    );
    applyOwnerSize(node.definitionId, props, parent);
    applyOwnerDensity(node.definitionId, props, parent);
    applyOwnerOverflowMode(node.definitionId, props, parent);
    applyColumnMenu(node.definitionId, props, parent, node.children);
    applyOwnerHideLinkOut(node.definitionId, props, parent);
    applyContextualHelpGlyph(node.definitionId, props, parent);
    applyOwnerEmphasis(node.definitionId, props, parent);
    applyGroupTurnsOn(node.definitionId, props, parent);
    applyOwnerVariant(
      node.definitionId,
      props,
      parent,
      new Set([
        ...Object.keys(inherited?.props ?? {}),
        ...Object.keys(node.props),
      ]),
    );
    applyBooleanVariant(node.definitionId, props);
    applyPropVisualRules(node.definitionId, props, visual);
    applyTypedRules(node.definitionId, props, visual, layout, parent);
    applyWrites(visual, node.visual);
    applyLayoutWrites(layout, node.layout);
    const ownLayout: Record<string, string> = {};
    applyLayoutWrites(ownLayout, node.layout);
    for (const layer of layers) {
      if (layer.visual) applyWrites(visual, layer.visual);
      applyLayoutWrites(layout, layer.layout);
      applyLayoutWrites(ownLayout, layer.layout);
    }
    finishLineHeight(visual);
    const self: ParentContext = {
      definitionId: node.definitionId,
      props,
      parent,
    };
    const sizing: Record<string, number | null> = {};
    applyWrites(sizing, node.sizing);
    for (const layer of layers)
      if (layer.sizing) applyWrites(sizing, layer.sizing);
    // The page's own height decides its sample (a page 500 tall shows fewer rows than 1,000).
    if (rowSample && node.id === id)
      samplePageHeight = catalogSamplePageHeight(
        sizing,
        visual,
        rowSample.screenHeight,
      );
    const children: ResolvedCatalogNode[] = [];
    // A bound Chart reads the records as its data (the old Canvas's `_chartRows`, the DOM
    // Chart's bound rows); the other bound composites repeat their item template per row.
    const charted =
      definition.mode === "composite" &&
      !!definition.templateRootId &&
      templateTypeName(definition.templateRootId) === "Chart";
    const records =
      nodeBinding && rows && charted
        ? rows(nodeBinding, "records", node.id, instancePath)
        : undefined;
    // (A bound Table's state — the Preview's: its rows are read filtered · sorted, once its header
    //  says which field each Column shows — below, `tableRowSlices`. A view sorted by a variable
    //  keeps that sort: the state's steps aside.)
    // (ADR-315 Phase 4 — a Table's state, bound or not: its column slices project the columns of
    //  any Table — `catalogProjectTableColumns`; its data slices are a bound Table's.)
    const ownTableState =
      tableState &&
      definition.mode === "composite" &&
      !!definition.templateRootId &&
      templateTypeName(definition.templateRootId) === "Table"
        ? tableState(`${instancePath.join("/")}::${node.id}`)
        : undefined;
    const boundTableState =
      nodeBinding && rows && !charted && !keyedRows ? ownTableState : undefined;
    const headerState: CatalogTableState | undefined =
      boundTableState && viewSortsByVariable(node.binding, lookupEntry)
        ? { ...boundTableState, sort: undefined }
        : boundTableState;
    const stated =
      !!headerState?.sort?.length ||
      !!headerState?.search ||
      !!headerState?.filters ||
      !!headerState?.grouping?.length ||
      !!headerState?.pinnedRows;
    let rowSet =
      nodeBinding && rows && !charted
        ? (keyedRows ??
          (stated
            ? undefined
            : rows(nodeBinding, "items", node.id, instancePath)))
        : undefined;
    let rowsRead = !stated;
    if (
      definition.mode === "composite" &&
      definition.templateRootId &&
      (!selection || selection.include(definition.templateRootId, instancePath))
    ) {
      scopeProperties(instancePath, node.definitionId, props);
      const templateRootId = definition.templateRootId;
      const project = (shownRows: readonly CatalogBoundRow[] | undefined) =>
        projectTemplate(
          node,
          templateRootId,
          instancePath,
          [templateRootId],
          { ...self, collapsed: true },
          templateBindings(
            node.definitionId,
            props,
            !!ownedRow && ownedRowing?.rowStart,
          ),
          instanceRoot(
            withoutPropertyKeys(node.definitionId, [
              ...Object.keys(node.props),
              ...(ownedRowing?.rowStart ? ["id"] : []),
              // (The collection's load reaches the template root — the Table record.)
              ...(props.loadingState !== undefined ? ["loadingState"] : []),
              // (The rows a data field disables reach it too — S2 `disabledKeys`.)
              ...(disabledRows?.length ? ["disabledKeys"] : []),
              // (The dates its data names too — S2 `isDateUnavailable`.)
              ...(unavailableRows ? [CATALOG_UNAVAILABLE_DATA_PROP] : []),
              // (ADR-315 Phase 5 — a group row's tree cell mark reaches the Cell's root.)
              ...(props[CATALOG_TREE_CELL_PROP] !== undefined
                ? [CATALOG_TREE_CELL_PROP]
                : []),
              // (An icons-only Pagination step button's word as its name · its 「Rows per page」
              //  Select's value — 2026-11-19.)
              ...(props["aria-label"] !== undefined ? ["aria-label"] : []),
              ...(ownedType === "Select" &&
              paginationPageSize(node.id) !== undefined
                ? ["value"]
                : []),
            ]),
            props,
            [
              ...Object.keys(node.visual),
              ...layers.flatMap((layer) => Object.keys(layer.visual ?? {})),
            ],
            visual,
            sizing,
            // The instance's authored layout and fills reach its template root (the record the
            // author edits): its own layout over the root's rules, its fills over the root's.
            ownLayout,
            instancePaint(node, layers),
            {
              origin: node.definitionId,
              stateRules: node.stateRules ? [node.stateRules] : [],
            },
          ),
          undefined,
          shownRows
            ? // (A keyed item is also the row its template's own positions read.)
              {
                rowSet: shownRows,
                ...(keyedRows?.[0] ? { row: keyedRows[0] } : {}),
              }
            : records
              ? { records }
              : ownedRow
                ? {
                    row: ownedRow,
                    ...(ownedRowLabel ? { rowLabel: ownedRowLabel } : {}),
                    ...(sampleOwner ? { sampleOwner } : {}),
                  }
                : ownedRowing?.rowSet
                  ? { rowSet: ownedRowing.rowSet }
                  : undefined,
        );
      const tableId = `${instancePath.join("/")}::${node.id}`;
      // ADR-310 Phase 4: a bound Table repeats its Row template — over the rows sorted and cut
      // first (`boundTableRows`), then its body counts them (`finishBoundTable`).
      /** ADR-315 Phase 5 — the grouping the rows were read in (its Columns stand first). */
      let groupedBy: readonly string[] | undefined;
      /** ADR-315 Phase 5 증분 5d — the rows were read as a tree (`CatalogRowSlices.tree`). */
      let nestedNow = false;
      /**
       * ADR-315 Phase 5 증분 5e — its Row template holds a detail Row: each data row expands to it
       * (`catalogDetailRows` — the open rows the Table state's, none on the Builder's Canvas).
       */
      const detailNow =
        templateTypeName(templateRootId) === "Table" && tableHasDetailRow(node);
      /**
       * ADR-315 Phase 6 — the Columns whose same values run together (「Merge same values」): read
       * from the Table as first resolved; its rows are then projected again with their merge.
       */
      let mergeKeys: readonly string[] = [];
      const finishTable = (rowSlices: CatalogRowSlices | undefined) => {
        if (!rowsRead && nodeBinding && rows) {
          rowSet = rows(nodeBinding, "items", node.id, instancePath, rowSlices);
          rowsRead = true;
        }
        const detailed =
          rowSet && detailNow
            ? catalogDetailRows(
                rowSet,
                new Set(headerState?.expandedKeys ?? []),
                !!tableState,
              )
            : rowSet;
        const shownSet = detailed;
        const table =
          shownSet && templateTypeName(templateRootId) === "Table"
            ? boundTableRows(
                shownSet,
                tableBoxHeight(
                  templateRootId,
                  visual,
                  sizing,
                  "height" in node.visual ||
                    layers.some(
                      (layer) => layer.visual && "height" in layer.visual,
                    ),
                ),
                templateRootId,
                tableId,
                viewSortsByVariable(node.binding, lookupEntry),
                rowSlices?.sorts,
                mergeKeys,
                props.isStriped === true,
              )
            : undefined;
        groupedBy =
          rowSlices?.groups && rowSet?.[0]?.group
            ? rowSlices.groups.keys
            : undefined;
        nestedNow = !!rowSet?.[0]?.tree;
        return withRowPinning(
          withTableGroups(
            withAuthoredSort(
              finishBoundTable(project(table?.shown ?? shownSet), table),
              // (ADR-315 Phase 4 증분 6 — its view's sort, by field key: the header shows it. Not a
              //  Table its view's variable sorts — the variable's, ADR-284 Decision 5.)
              nodeBinding &&
                !table?.sortedByView &&
                !viewSortsByVariable(node.binding, lookupEntry)
                ? viewAuthoredSort(node.binding, lookupEntry)
                : undefined,
            ),
            rowSlices?.groups,
            shownSet,
          ),
          // (ADR-315 Phase 5 증분 5g — rows whose request cannot ask for rows by key: a pinned
          //  row of another page could not be shown — no row menu.)
          !!groupedBy ||
            nestedNow ||
            !!(rowSet as CatalogBoundRows | undefined)?.pinsRefused,
          shownSet,
        );
      };
      // (Each Column's field, read from the Table's header — the Table without rows; the rows'
      //  source filters · sorts · groups by them before its window · page cuts them.)
      // (ADR-315 Phase 5 증분 5d — the Builder's Canvas: the Column a tree's top rows hold their
      //  expand button in — the first data Column the author shows, `catalogProjectTableColumns`'s
      //  rule without a Table state.)
      const outerTreeColumn = canvasTreeColumn;
      // (ADR-315 Phase 5 증분 5e — a Table with a detail row: each row's first data cell too.)
      if (detailNow && !tableState) {
        const bare = project(undefined);
        canvasTreeColumn = bare
          ? headerColumnsOf(bare).find(
              ({ column }) => column.props.defaultHidden !== true,
            )?.key
          : undefined;
      }
      const firstSlices = stated
        ? tableRowSlices(headerState!, project(undefined))
        : undefined;
      let finished = finishTable(firstSlices);
      // (ADR-315 Phase 6 — a Table with a merged Column: its rows again, with their merge.)
      if (finished && templateTypeName(templateRootId) === "Table") {
        mergeKeys = headerColumnsOf(finished)
          .filter(({ column }) => column.props.mergeSameValues === true)
          .map(({ key }) => key);
        if (mergeKeys.length && rowSet) finished = finishTable(firstSlices);
      }
      // (ADR-315 Phase 5 — a Table its author groups (a Column's 「Grouped」) and whose state does
      //  not say otherwise: its rows are read again, grouped. The Builder's Canvas too (no Table
      //  state — the author's default, closed groups without a child row: `closedChild`).)
      // (ADR-315 Phase 5 증분 5c — a Table with a totals row too: its rows are read again with
      //  the totals — every row the state keeps.)
      // (ADR-315 Phase 5 증분 5d — a Table whose binding names its rows' child rows: read again as
      //  a tree (every level searched · sorted, the collapsed rows' child rows not read out) —
      //  with or without a state. The Builder's Canvas: every row collapsed, without a child row.)
      const nestedRows =
        templateTypeName(templateRootId) === "Table" &&
        !!(rowSet as CatalogBoundRows | undefined)?.nested &&
        !rowSet?.[0]?.tree &&
        !rowSet?.[0]?.group;
      if (
        nodeBinding &&
        rows &&
        !charted &&
        !keyedRows &&
        finished &&
        (nestedRows ||
          (!stated &&
            ((headerState?.grouping === undefined &&
              tableGroupedByAuthor(finished)) ||
              tableHasTotals(finished))))
      ) {
        const bare = project(undefined);
        const slices = tableRowSlices(headerState ?? {}, bare, nestedRows);
        if (nestedRows && !tableState && bare)
          canvasTreeColumn = headerColumnsOf(bare).find(
            ({ column }) => column.props.defaultHidden !== true,
          )?.key;
        if (slices?.groups || slices?.totals || slices?.tree) {
          rowsRead = false;
          finished = finishTable(
            tableState
              ? slices
              : {
                  ...slices,
                  ...(slices.groups
                    ? { groups: { ...slices.groups, closedChild: false } }
                    : {}),
                  ...(slices.tree
                    ? { tree: { ...slices.tree, closedChild: false } }
                    : {}),
                },
          );
        }
      }
      canvasTreeColumn = outerTreeColumn;
      // (ADR-315 Phase 4 — the columns shown and their order: the authored defaults, a Table
      //  state's over them. The rows above were read by every authored Column — a hidden one is
      //  searched · sorted · filtered as before, breakdown §4.4.)
      push(
        children,
        finished && lookupDefinition(finished.definitionId).name === "Table"
          ? catalogProjectTableColumns(
              finished,
              // (A kept row's place holder has no definition — `keptRowOf`.)
              (resolved) =>
                resolved.rowKept
                  ? ""
                  : lookupDefinition(resolved.definitionId).name,
              groupedBy
                ? { ...ownTableState, grouping: groupedBy, detail: detailNow }
                : ownTableState?.grouping || nestedNow || detailNow
                  ? {
                      ...ownTableState,
                      grouping: undefined,
                      nested: nestedNow || detailNow,
                      detail: detailNow,
                    }
                  : ownTableState,
              // (No Table state to read: the Builder's Canvas — a hidden Column stays a record
              //  the author can select, drawn nowhere.)
              !tableState,
            )
          : finished,
      );
    }
    if (!rowsRead && nodeBinding && rows)
      rowSet = rows(nodeBinding, "items", node.id, instancePath);
    const ownedChildren =
      selection?.ownedChildren?.(node.id, instancePath) ?? node.children;
    // (A Cascader's row template is its own item beside the origin's parts — ADR-322 Phase 4.)
    const childRows =
      (["Tabs", "TabList", "Cascader"].includes(ownedType)
        ? rowSet
        : undefined) ?? ownedRowing?.rowSet;
    const ownedItems = childRows
      ? ownedChildren.filter((childId) => {
          const child = graph.getEntry(childId);
          return (
            child?.kind === "node" &&
            CATALOG_ROW_ITEM_TYPES.has(
              ruleDefinitionOf(child.definitionId).name,
            )
          );
        })
      : [];
    const passRows =
      childRows && (ownedItems.length === 0 || ownedType === "Tabs")
        ? childRows
        : undefined;
    for (const childId of ownedChildren) {
      const childPath = [...instancePath, childId];
      if (selection && !selection.include(childId, childPath)) continue;
      const child = graph.getEntry(childId);
      if (child?.kind !== "node")
        throw new CatalogValidationError("DANGLING_CHILD", childId);
      // ADR-310: an item (or section) marked `repeat` is a run of rows — its own data (①), the
      // outer row's child rows (②) or the owner's (③); the other items are static.
      const segment = child.repeat
        ? repeatRows(childId, childPath, childRows, ownedRow)
        : undefined;
      if (segment) {
        const run = runRowsOf(segment);
        segment.forEach((_, place) => {
          // (A windowed run's rows keep their place in the whole run — identity and `rowIndex`.)
          const data = run.data(place);
          const index = rowIndexOf(segment, place);
          const kept = run.kept(place);
          if (kept) return void children.push(kept);
          const projectRow = (row: CatalogBoundRow) =>
            resolveOwned(child, childPath, undefined, self, {
              row,
              rowStart: true,
            });
          const projected = projectRow(data);
          if (projected)
            push(children, {
              // (ADR-315 Phase 5 — a Table row's child rows nest in it: `nestTableRows`.)
              ...nestTreeRows(
                index === 0 &&
                  !selectValueRuns.has(childId) &&
                  !["Tab", "TabPanel"].includes(
                    ruleDefinitionOf(child.definitionId).name,
                  )
                  ? projected
                  : withRowKey(projected, data.key),
                data,
                projectRow,
                // (ADR-322 Phase 4 — a Cascader's own row item nests its child rows, a Tree's way.)
                (node) =>
                  ruleDefinitionOf(node.definitionId).name === "CascaderItem" &&
                  isTreeItemRecord(node),
                isInstanceRecord,
                isTableRowRecord,
              ),
              rowIndex: index,
            });
        });
        continue;
      }
      pushOwnedChild(
        children,
        child,
        resolveOwned(
          child,
          childPath,
          undefined,
          self,
          ownedRow || passRows || (childRows && isSection(child))
            ? {
                ...(ownedRow ? { row: ownedRow } : {}),
                // (A static section's items read the owner's rows too — ③ inside a section.)
                ...(passRows || (childRows && isSection(child))
                  ? { rowSet: passRows ?? childRows! }
                  : {}),
                ...(ownedRowLabel ? { rowLabel: ownedRowLabel } : {}),
                ...(sampleOwner ? { sampleOwner } : {}),
              }
            : undefined,
        ),
        self,
      );
    }
    for (const rule of stateVisual(node.definitionId))
      applyWrites(visual, rule);
    if (state && node.stateRules?.[state])
      applyWrites(visual, node.stateRules[state]);
    const ownStates = stateValues([
      lookupDefinition(node.definitionId).stateRules,
      findOverride(node.definitionId)?.stateRules,
      node.stateRules,
    ]);
    return {
      sourceId: node.id,
      instancePath,
      definitionId: node.definitionId,
      props,
      visual,
      ...(childRows?.length === 0 && ["Tabs", "TabList"].includes(ownedType)
        ? { rowCount: 0, rowsShown: 0 }
        : {}),
      ...(ownStates ? { stateVisual: ownStates } : {}),
      layout,
      sizing,
      ...(Object.keys(ownLayout).length ? { authoredLayout: ownLayout } : {}),
      ...authoredExtras(node, layers),
      slot: node.slot ?? inherited?.slot,
      ...(node.presentWhen ? { presentWhen: node.presentWhen } : {}),
      ...(node.showWhen ? { showWhen: node.showWhen } : {}),
      name: node.name,
      regions: node.regions,
      placeholder: node.placeholder,
      children,
    };
  };
  /**
   * ADR-310 Phase 4 — the rows a bound Table's Row template repeats over: sorted by the Preview's
   * header sort (ADR-257 Phase 4 — by the field value, over every delivered row; a Table whose view
   * sorts by a variable keeps the view's order — ADR-284 Decision 5), then cut — a Table with a px
   * height (its Styles height — the origin's default 400) takes the rows that height can hold, one
   * without grows with every row (the Builder samples them, its TableBody's measured pitch).
   */
  /**
   * A Table's px height — what its record's box reads (`sizing.height ?? visual.height`): the
   * instance's authored height over its origin template root's (the default 400). A keyword · `%`
   * height is none (사용자 결정 2026-11-19: the height is the Styles height — no `heightMode`).
   */
  const tableBoxHeight = (
    rootId: TemplateId,
    visual: Readonly<Record<string, unknown>>,
    sizing: Readonly<Record<string, number | null>>,
    /** The instance authored its own `visual.height` (a keyword over the root's px). */
    ownVisualHeight: boolean,
  ): number | undefined => {
    const template = rootId.startsWith("lib:")
      ? library.templates.get(rootId as `lib:template:${string}`)
      : graph.getEntry(rootId);
    const rootVisual: Props = {};
    const rootSizing: Record<string, number | null> = {};
    if (template && "kind" in template) {
      if (template.kind === "node") {
        applyWrites(rootVisual, template.visual);
        applyWrites(rootSizing, template.sizing);
      }
    } else if (template) applyValues(rootVisual, template.visual);
    const height =
      sizing.height ??
      rootSizing.height ??
      // (A masked height of its own leaves the root's — the record still reads the root's.)
      pxLength(
        ownVisualHeight && visual.height !== undefined
          ? visual.height
          : rootVisual.height,
      );
    return typeof height === "number" && height > 0 ? height : undefined;
  };
  /**
   * A Table's state as its rows read it (`catalogTableStateRowSlices`): each Column as its field —
   * the sort with where the Column puts its empty values, the search over the searchable Columns,
   * the column filters. `bare` = the Table without rows — its header's Columns name them (the
   * selection column is none of them — `Checkbox[slot=selection]`). Undefined = no slice left.
   */
  const tableRowSlices = (
    state: CatalogTableState,
    bare: ResolvedCatalogNode | undefined,
    /** ADR-315 Phase 5 증분 5d — its rows have child rows (`CatalogBoundRows.nested`). */
    nested?: boolean,
  ): CatalogRowSlices | undefined => {
    const typeOf = (resolved: ResolvedCatalogNode) =>
      lookupDefinition(resolved.definitionId).name;
    const header = bare?.children.find(
      (child) => typeOf(child) === "TableHeader",
    );
    // (The Table state names a Column by its Column key — the field it shows,
    //  `resolveTableColumnKey`: its place among all the header's Columns.)
    const columns = (header?.children ?? [])
      .filter((child) => typeOf(child) === "Column")
      .flatMap((child, index) =>
        child.children.some(
          (part) =>
            typeOf(part) === "Checkbox" && part.props.slot === "selection",
        )
          ? []
          : [
              {
                key: resolveTableColumnKey(child.props, index),
                sortEmptyValues: child.props.sortEmptyValues,
                allowsSearching: child.props.allowsSearching,
                defaultGrouped: child.props.defaultGrouped,
                aggregate: child.props.aggregate,
              },
            ],
      );
    return catalogTableStateRowSlices(state, columns, {
      ...bare?.props,
      // (ADR-315 Phase 5 증분 5c — a totals row: a row in its footer — the 「Totals」 slot.)
      totals: !!bare && tableHasTotals(bare),
      nested: !!nested,
    });
  };
  /** ADR-315 Phase 5 증분 5c — a resolved Table has a totals row (a Row in its TableFooter). */
  const tableHasTotals = (table: ResolvedCatalogNode): boolean => {
    const typeOf = (resolved: ResolvedCatalogNode) =>
      lookupDefinition(resolved.definitionId).name;
    return table.children.some(
      (part) =>
        typeOf(part) === "TableFooter" &&
        part.children.some((row) => typeOf(row) === "Row"),
    );
  };
  const boundTableRows = (
    rowSet: readonly CatalogBoundRow[],
    /** The Table's px height (`tableBoxHeight`); none = it grows with its rows. */
    height: number | undefined,
    rootId: TemplateId,
    /** The bound node's record identity (the instance — its template root collapses into it). */
    tableId: string,
    /** ADR-284: the node's view sorts by a variable (the Table's own runtime sort steps aside). */
    sortedByVariable: boolean,
    /** The Table's header sort as its rows read it (`tableRowSlices`). */
    rowSort: CatalogRowSorts | undefined,
    /** ADR-315 Phase 6 — the Columns whose same values run together, in the order shown. */
    mergeKeys: readonly string[] = [],
    /** ADR-317 Phase 5 — the Table's 「Striped rows」. */
    striped = false,
  ): BoundTableRows => {
    const variableSort = (rowSet as { view?: CatalogViewResultMeta }).view
      ?.sort;
    const sortedByView = variableSort !== undefined || sortedByVariable;
    const sort = sortedByView ? undefined : rowSort;
    let ordered = rowSet;
    // (The rows' source sorts them before its window · page — `CatalogBoundRows.sorted`. A source
    //  that does not is sorted here: the rows it delivered, among themselves.)
    const delivered = (rowSet as CatalogBoundRows).sorted;
    if (sort && !catalogRowSortsEqual(delivered, sort)) {
      // (The same rows sorted the same way are the same run — a window move reads its rows
      //  again unchanged, `compositionRoot.moveRowWindow`: sorting 10,000 rows for each.)
      const held = SORTED_ROWS.get(rowSet);
      ordered =
        held && catalogRowSortsEqual(held.sort, sort)
          ? held.rows
          : Array.from(
              viewSortOrder(
                rowSet.length,
                sort.map((entry) => ({
                  valueAt: (index: number) => rowSet[index]!.values[entry.key],
                  direction: entry.direction,
                  ...(entry.empty ? { empty: entry.empty } : {}),
                })),
              ),
              (index) => rowSet[index]!,
            );
      if (ordered !== held?.rows)
        SORTED_ROWS.set(rowSet, { sort, rows: ordered });
    }
    const template = rootId.startsWith("lib:")
      ? library.templates.get(rootId as `lib:template:${string}`)
      : graph.getEntry(rootId);
    // (The Builder draws the rows a px height holds — its sample. The Preview keeps every row its
    //  display mode delivers — a window · a page · all of them — and the Table scrolls inside its
    //  height: a page of 20 in a 400 Table showed 14, 2026-11-19 사용자 보고 「Rows per page 동작이
    //  되지않는다」.)
    const fixed = typeof height === "number" && !!rowSample;
    // (ADR-315 Phase 6 — over every row in the order shown: before a box height · a window cuts.)
    ordered = catalogMergedRows(ordered, mergeKeys);
    // (ADR-317 Phase 5 — over every row in the order shown too: a window keeps each row's.)
    if (striped) ordered = catalogStripedRows(ordered);
    const bodyId = (
      template && "children" in template ? template.children : []
    ).find(
      (childId: string) =>
        templateTypeName(childId as TemplateId) === "TableBody",
    );
    const instancePath = tableId.slice(0, tableId.lastIndexOf("::"));
    const shown = fixed
      ? ordered.slice(0, Math.ceil(height! / TABLE_MIN_ROW_HEIGHT) + 1)
      : rowSample
        ? sampledRows(ordered, `${instancePath}::${bodyId}`)
        : // (The window is the bound node's — its `rowDisplay` says whether it has one. ADR-315
          //  Phase 5: a grouped run's, over the rows its open groups show.)
          ordered.find((row) => !row.pinned)?.group ||
            ordered.find((row) => !row.pinned)?.tree
          ? windowedGroupRows(ordered, tableId)
          : windowedRows(ordered, tableId);
    // (ADR-315 Phase 5 증분 5c — the totals are over every row: the rows shown carry them — a
    //  fixed height's cut · a sort's order are new lists.)
    const totals = (rowSet as CatalogBoundRows).totals;
    if (totals && shown !== rowSet && !(shown as CatalogBoundRows).totals)
      Object.assign(shown, { totals });
    return {
      rowSet,
      ordered,
      shown,
      fixed,
      sampled: !!rowSample,
      ...(sortedByView ? { sortedByView: { sort: variableSort } } : {}),
    };
  };
  /** A resolved Table's header Columns with each one's Column key (the selection column is none). */
  const headerColumnsOf = (
    table: ResolvedCatalogNode,
  ): { column: ResolvedCatalogNode; key: string }[] => {
    const typeOf = (resolved: ResolvedCatalogNode) =>
      lookupDefinition(resolved.definitionId).name;
    const header = table.children.find(
      (child) => typeOf(child) === "TableHeader",
    );
    return (header?.children ?? [])
      .filter((child) => typeOf(child) === "Column")
      .flatMap((child, index) =>
        child.children.some(
          (part) =>
            typeOf(part) === "Checkbox" && part.props.slot === "selection",
        )
          ? []
          : [{ column: child, key: resolveTableColumnKey(child.props, index) }],
      );
  };
  /** ADR-315 Phase 5 — a resolved Table has a Column its author groups by (「Grouped」). */
  const tableGroupedByAuthor = (table: ResolvedCatalogNode): boolean =>
    headerColumnsOf(table).some(
      ({ column }) => column.props.defaultGrouped === true,
    );
  /**
   * ADR-315 Phase 5 — a grouped Table's record: the group rows open now (`CATALOG_TABLE_EXPANDED_PROP`
   * — RAC `expandedKeys`, their row keys). Its `treeColumn` is marked by the column projection
   * (`catalogProjectTableColumns` — the outer grouped Column, on every layer of its record).
   */
  /**
   * ADR-315 Phase 5 증분 5f — a Table whose viewers pin rows (「Row pinning」 — `allowsRowPinning`):
   * its record says whether its rows are pinnable now (`_rowPinnable` — a flat Table's: a group ·
   * a tree row holds rows). The DOM gives each data row its row menu then.
   */
  const withRowPinning = (
    table: ResolvedCatalogNode | undefined,
    nested: boolean,
    rowSet: readonly CatalogBoundRow[] | undefined,
  ): ResolvedCatalogNode | undefined => {
    if (!table) return table;
    const pinnable = table.props.allowsRowPinning === true && !nested;
    // (Its pinned rows' keys: the rows first · last — `CATALOG_TABLE_PINNED_ROWS_PROP`.)
    const top: string[] = [];
    const bottom: string[] = [];
    for (const row of rowSet ?? [])
      if (row.pinned === "top") top.push(row.key);
      else if (row.pinned === "bottom") bottom.push(row.key);
    if (!pinnable && !top.length && !bottom.length) return table;
    return {
      ...table,
      props: {
        ...table.props,
        ...(pinnable ? { [CATALOG_ROW_PINNABLE_PROP]: true } : {}),
        ...(top.length || bottom.length
          ? {
              [CATALOG_TABLE_PINNED_ROWS_PROP]: `${top.join("\n")}\u0000${bottom.join("\n")}`,
            }
          : {}),
      } as typeof table.props,
    };
  };
  const withTableGroups = (
    table: ResolvedCatalogNode | undefined,
    groups: CatalogRowGroups | undefined,
    rowSet: readonly CatalogBoundRow[] | undefined,
  ): ResolvedCatalogNode | undefined => {
    // (ADR-315 Phase 5 증분 5d — a tree's rows too: its open rows.)
    if (
      !table ||
      !(
        (groups?.keys.length && rowSet?.[0]?.group) ||
        // (ADR-315 Phase 5 증분 5f — a pinned row first is no expandable row.)
        rowSet?.find((row) => !row.pinned)?.tree
      )
    )
      return table;
    const expanded: string[] = [];
    const visit = (rows: readonly CatalogBoundRow[]) => {
      for (const row of rows)
        if (row.group?.expanded || row.tree?.expanded) {
          expanded.push(row.key);
          visit(row.children ?? []);
        }
    };
    visit(rowSet);
    return {
      ...table,
      props: {
        ...table.props,
        [CATALOG_TABLE_EXPANDED_PROP]: JSON.stringify(expanded),
      } as typeof table.props,
    };
  };
  /** A bound Table after its Row template repeated (`boundTableRows`): the clip and the counts. */
  /**
   * ADR-315 Phase 4 증분 6 — a bound Table with the sort its rows are in as authored
   * (`CATALOG_TABLE_AUTHORED_SORT_PROP`): the header shows it until a Table state's sort stands in.
   */
  const withAuthoredSort = (
    resolved: ResolvedCatalogNode | undefined,
    authoredSort: string | undefined,
  ): ResolvedCatalogNode | undefined =>
    resolved &&
    authoredSort &&
    lookupDefinition(resolved.definitionId).name === "Table"
      ? {
          ...resolved,
          props: {
            ...resolved.props,
            [CATALOG_TABLE_AUTHORED_SORT_PROP]: authoredSort,
          } as typeof resolved.props,
        }
      : resolved;
  const finishBoundTable = (
    projected: ResolvedCatalogNode | undefined,
    table: BoundTableRows | undefined,
  ): ResolvedCatalogNode | undefined => {
    if (!projected || !table) return projected;
    const typeOf = (resolved: ResolvedCatalogNode) =>
      lookupDefinition(resolved.definitionId).name;
    if (typeOf(projected) !== "Table") return projected;
    const body = projected.children.find(
      (child) => typeOf(child) === "TableBody",
    );
    if (!body) return projected;
    // (Only the Builder's sample is cut. The Preview cuts nothing: its Table scrolls (`Table.css`),
    //  and RAC's `Virtualizer` places a virtual Table's rows absolutely in a body of no height — a
    //  clipping body hid every row, 2026-11-19 사용자 보고.)
    const clip = table.sampled;
    return {
      ...projected,
      // ADR-284 Decision 5: a Table sorted by its view's variable shows the variable's sort and
      // leaves its header press to the rule that writes it (no runtime sort of its own).
      ...(table.sortedByView
        ? {
            props: {
              ...projected.props,
              sortDescriptor: table.sortedByView.sort,
              _sortByVariable: true,
            } as typeof projected.props,
          }
        : {}),
      // Table.css clips the outer table (`overflow: hidden`): rows past its height are cut.
      ...(clip
        ? { visual: extendedVisual(projected.visual, { overflow: "hidden" }) }
        : {}),
      children: projected.children.map((child) =>
        child === body
          ? {
              ...body,
              // The rows past a fixed height are cut.
              ...(clip
                ? {
                    visual: extendedVisual(body.visual, { overflow: "hidden" }),
                  }
                : {}),
              // The other modes grow with every row (the Builder samples them).
              ...(table.fixed
                ? {}
                : {
                    rowCount: rowCountOf(table.rowSet),
                    rowsShown: table.ordered.length,
                    ...(rowWindowOf(table.shown)
                      ? { rowWindow: rowWindowOf(table.shown)! }
                      : {}),
                  }),
            }
          : child,
      ),
    };
  };
  const projectTemplate = (
    owner: NodeEntry,
    templateId: TemplateId,
    instancePath: readonly (NodeId | TemplateId)[],
    path: readonly TemplateId[],
    parent?: ParentContext,
    bindings?: Props,
    /**
     * Instance root values: the owning composite instance's authored props, visual and sizing,
     * applied on its template root after the template's own values and before path overrides.
     */
    root?: InstanceRoot,
    /** Descendant patches of the library composite template node whose template this is. */
    patches?: LibraryPatchScope,
    /**
     * Data rows: `rowSet` = the bound instance's rows (its template root repeats its first item
     * position per row and drops the other item positions); `row` = the row this subtree projects,
     * `rowStart` on the row template position itself (its sample content is not the row's);
     * `rowLabel` on a Breadcrumb row's children (its label text is the row's label — the old
     * Canvas crumb's `children: row.label`); `records` = a bound Chart's data.
     */
    rowing?: {
      rowSet?: readonly CatalogBoundRow[];
      row?: CatalogBoundRow;
      rowStart?: boolean;
      rowLabel?: CatalogRowLabel;
      records?: readonly CatalogBoundRow[];
      /**
       * The owned row template (a bound collection's first own item, 2026-10-14) whose positions
       * this projects: its literal content writes are its sample content, not the row's.
       */
      sampleOwner?: NodeId;
    },
  ): ResolvedCatalogNode | undefined => {
    selection?.onVisit?.(templateId);
    const template = templateId.startsWith("lib:")
      ? library.templates.get(templateId as `lib:template:${string}`)
      : graph.getEntry(templateId);
    if (!template || ("kind" in template && template.kind !== "node"))
      throw new CatalogValidationError("DANGLING_TEMPLATE", templateId);
    // A bound collection inside a project component: the binding is the template node's (the
    // instance holds none), read as an owned node's is — rows · a keyed item · a Chart's records —
    // at this instance path, so its view reads the instance's input variables (ADR-294 R6). The
    // instance's own binding (`rowing` on its template root) wins. A composite position's rows go
    // to the root it collapses into (as an owned instance's do); another node's to its children.
    // (ADR-310 ①: a position repeated over its own binding shows one of those rows.)
    const ownBinding =
      "kind" in template &&
      rows &&
      !rowing?.rowSet &&
      !rowing?.records &&
      !(rowing?.rowStart && template.repeat)
        ? template.binding
        : undefined;
    const charted = !!ownBinding && templateTypeName(templateId) === "Chart";
    const ownRows =
      ownBinding && !charted
        ? rows!(
            ownBinding.key !== undefined && rowing?.row
              ? {
                  ...ownBinding,
                  key: String(bindRowValue(ownBinding.key, rowing.row)),
                }
              : ownBinding,
            "items",
            templateId as NodeId,
            instancePath,
          )
        : undefined;
    const ownRecords = charted
      ? rows!(ownBinding!, "records", templateId as NodeId, instancePath)
      : undefined;
    const ownRowing = ownRecords
      ? { records: ownRecords }
      : ownRows
        ? {
            rowSet: ownRows,
            // (A keyed item is also the row its own positions read.)
            ...(ownBinding!.key !== undefined && ownRows[0]
              ? { row: ownRows[0] }
              : {}),
          }
        : undefined;
    const nestedOwnRowing =
      ownRowing && lookupDefinition(template.definitionId).mode === "composite"
        ? ownRowing
        : undefined;
    if (ownRowing && !nestedOwnRowing) rowing = { ...rowing, ...ownRowing };
    const row = rowing?.row;
    // An override address starts at its owner instance (`validateInstanceAddress`); the
    // resolution path also carries the ancestors above the owner when resolving from one of them.
    // ADR-260 Decision 11: the owner's override and those of the project template nodes on the
    // way (a component inside the component), the outer ones winning.
    const found = overridesAt(lookupEntry, owner, instancePath, path);
    const { structural, patch: layeredPatch } = layeredOverride(found);
    const change = structural?.override ?? found[0]?.override;
    // An inner owner's replacement · slot contents are positions of the template it sits in.
    const innerPlace =
      structural && structural.owner !== owner
        ? innerOwnerPlace(
            lookupEntry,
            (id) => graph.ownerOf(id),
            library,
            instancePath,
            structural.owner,
          )
        : undefined;
    if (structural && structural.owner !== owner && !innerPlace)
      throw new CatalogValidationError("DANGLING_TEMPLATE", templateId);
    if (change?.kind === "replace") {
      const replacement = graph.getEntry(change.replacementId);
      if (replacement?.kind !== "node")
        throw new CatalogValidationError(
          "DANGLING_CHILD",
          change.replacementId,
        );
      // ADR-261 Phase 5: a visibility property of the enclosing instance still shows or hides
      // its nested instance once swapped (Figma: 「Show icon」 + 「Icon」 on one layer) — under the
      // instance's own show / hide (the node's `enabled`, as a direct write wins on a template
      // position; review H1). A property-driven swap keeps no copied value (`instanceProperty.ts`).
      const shown = propertyScopes
        .get(scopeKey(instancePath))
        ?.get(templateId)?.enabled;
      // (With neither, the position's origin value: a hidden origin layer stays hidden.)
      if (
        (replacement.enabled ??
          shown ??
          ("kind" in template ? template.enabled : undefined)) === false
      )
        return undefined;
      if (innerPlace)
        return projectTemplate(
          owner,
          replacement.id,
          innerPlace.instancePath,
          [...innerPlace.templatePath, replacement.id],
          parent,
        );
      return resolveOwned(
        replacement,
        [...instancePath, replacement.id],
        undefined,
        parent,
      );
    }
    const libraryPatch =
      patches && sameIds(patches.instances, instancePath)
        ? patches.patches.find((item) => sameIds(item.templatePath, path))
        : undefined;
    // (ADR-261 Decision 4: what the enclosing instance's properties write on this origin node —
    // under the instance's direct write at this position, over the node's own.)
    const propertyWrite = propertyScopes
      .get(scopeKey(instancePath))
      ?.get(templateId);
    const enabled =
      layeredPatch?.enabled ??
      libraryPatch?.enabled ??
      propertyWrite?.enabled ??
      template.enabled ??
      true;
    if (!enabled) return undefined;
    // S2 체크리스트 §9.3: a position there only while its origin prop is given (S2 AlertDialog's
    // `{cancelLabel && <Button>}`).
    if (
      template.presentWith &&
      String(bindings?.[template.presentWith] ?? "") === ""
    )
      return undefined;
    // A path patch's authoring fields (Phase 4b) layer over the template node's own.
    // (A position holding the instance's own child list carries its field writes too.)
    const patch = layeredPatch;
    const visibleBy = patch?.visibility
      ? patch
      : "kind" in template
        ? template
        : undefined;
    if (visibleBy && !catalogNodeVisibleAt(visibleBy, breakpoint))
      return undefined;
    const templateLayers = "kind" in template ? responsiveLayers(template) : [];
    const patchLayers = patch
      ? responsiveLayers(patch as unknown as NodeEntry)
      : [];
    const { definition, props, visual, layout } = base(template.definitionId);
    const override = findOverride(template.definitionId);
    if (override) {
      applyWrites(props, override.defaults);
      applyWrites(visual, override.visual);
    }
    if (row && rowing?.rowStart) dropLiteralContent(props);
    // (An inner owner's row template item — its literal content is sample content, as an owned
    // one's is.)
    if ("kind" in template)
      applyWrites(
        props,
        row && rowing?.sampleOwner === templateId
          ? withoutSampleContent(template.props)
          : template.props,
      );
    else applyValues(props, catalogTemplateProps(template, siteLanguage));
    if (libraryPatch?.props) applyValues(props, libraryPatch.props);
    if (bindings) {
      for (const key of Object.keys(template.props))
        if (key in props) props[key] = bindTemplateValue(props[key], bindings);
      withoutUnboundSlot(props, bindings);
    }
    if (propertyWrite?.props) Object.assign(props, propertyWrite.props);
    // The origin this root belongs to (ADR-253): its project override is the origin's own style,
    // so every instance draws it — over the root's template values, under the instance's.
    // (Its prop defaults are the origin's accepted keys: they reach the template as bindings.)
    const originOverride = root?.origin ? findOverride(root.origin) : undefined;
    // (A composite position takes them all: its instance contract is its accepts plus its template
    // root's — `instanceContract` — and they go on to that root, as an owned instance's do.)
    if (root)
      for (const [key, value] of Object.entries(root.props))
        if (
          key in definition.accepts ||
          definition.mode === "composite" ||
          // (ADR-315 Phase 5 — the resolver's own mark, no authored prop: a group's tree cell.)
          key === CATALOG_TREE_CELL_PROP ||
          // (S2 `isDateUnavailable` from data — the dates the instance's binding names.)
          key === CATALOG_UNAVAILABLE_DATA_PROP
        )
          props[key] = value;
    // The template node's px size, then the instance's (as visual · layout: the instance wins —
    // 2026-11-11, the root's spread first let a user component's template width beat it).
    const sizing: Record<string, number | null> = {};
    if ("kind" in template) {
      applyWrites(sizing, template.sizing);
      for (const layer of templateLayers)
        if (layer.sizing) applyWrites(sizing, layer.sizing);
    }
    if (root) Object.assign(sizing, root.sizing);
    if (patch) {
      if (patch.props)
        applyWrites(
          props,
          row &&
            (rowing?.sampleOwner === owner.id ||
              found.some((item) => item.owner.id === rowing?.sampleOwner))
            ? withoutSampleContent(patch.props)
            : patch.props,
        );
      if (patch.sizing) applyWrites(sizing, patch.sizing);
      for (const layer of patchLayers)
        if (layer.sizing) applyWrites(sizing, layer.sizing);
    }
    if (row) {
      // Only content props read the row (ADR-162 allowlist): a user's `{…}` text elsewhere stays.
      for (const key of ROW_TEMPLATE_BINDABLE_PROP_KEYS)
        if (key in props) props[key] = bindRowValue(props[key], row);
      // The row is the item: its collection key is the row's.
      if (rowing?.rowStart)
        keyRowItem(templateTypeName(templateId), props, row);
      const labelField = rowLabelField(
        rowing?.rowLabel,
        props,
        templateTypeName(templateId),
      );
      if (labelField) props.children = String(row.values[labelField] ?? "");
    }
    // (The owned node's `loadingState` beside its items — a bound Table · Skeleton in the template.)
    const ownLoading = ownRows?.loadingState;
    const templateType = ruleDefinitionOf(template.definitionId).name;
    if (templateType === "Skeleton") {
      const loading = skeletonContentLoading(template.id);
      if (loading !== undefined) props.isLoading = loading;
    } else if (ownLoading && LOADING_STATE_TYPES.has(templateType))
      props.loadingState = ownLoading;
    if (rowing?.records)
      props.data = rowing.records.map(
        (record) => record.values,
      ) as unknown as PropValue;
    // (ADR-278: a path patch's display state sits between the instance root layer's and the
    // template node's — the Components page opens an overlay origin's body with `open`.)
    const shownState =
      root?.displayState ??
      patch?.displayState ??
      // (An unlocked origin's copy node keeps the library node's — ADR-282.)
      template.displayState;
    // Inside its RAC collection (its keys) or group (its value) an item's selection is the
    // owner's, so a selection display state of the item template (a selected state origin) is not
    // forced there (ADR-256 후속 7 — the groups).
    const itemName = lookupDefinition(template.definitionId).name;
    const offeredState =
      (shownState === "selected" || shownState === "unselected") &&
      (isInOwnCollection(itemName, ancestorTypes(parent)) ||
        isInOwnGroup(itemName, ancestorTypes(parent)))
        ? undefined
        : shownState;
    // A display state replaces the template's own default; a value the instance authored for
    // this position (its root layer or path patch) is more specific and stays.
    const instanceAuthored = new Set([
      ...Object.keys(root?.props ?? {}),
      ...Object.keys(patch?.props ?? {}),
    ]);
    // An authored value against the state's own prop (an instance of the selected origin set
    // unselected) ends the state at this position: RAC draws the authored value in the DOM, and the
    // state would keep the Canvas on the origin's paint (2026-10-09 Checkbox).
    const displayState = Object.entries(
      (offeredState && DISPLAY_STATE_PROPS[offeredState]) ?? {},
    ).some(
      ([key, value]) =>
        definition.accepts[key] === "boolean" &&
        instanceAuthored.has(key) &&
        props[key] !== value,
    )
      ? undefined
      : offeredState;
    if (displayState)
      for (const [key, value] of Object.entries(
        DISPLAY_STATE_PROPS[displayState] ?? {},
      ))
        if (definition.accepts[key] === "boolean" && !instanceAuthored.has(key))
          props[key] = value;
    const nodeState = catalogNodeState(displayState, state);
    // (A display state's values stay over the Form context — as the authored ones.)
    applyFormContext(
      template.definitionId,
      props,
      parent,
      new Set([
        ...instanceAuthored,
        ...Object.keys(
          (displayState && DISPLAY_STATE_PROPS[displayState]) ?? {},
        ),
      ]),
    );
    applyOwnerContext(template.definitionId, props, parent, instanceAuthored);
    applyOwnerSize(template.definitionId, props, parent);
    // (A palette Table's Columns · Cells are its origin's template nodes — ADR-257 Phase 3: the
    // Table's `density` · `overflowMode` reach them here too.)
    applyOwnerDensity(template.definitionId, props, parent);
    applyOwnerOverflowMode(template.definitionId, props, parent);
    applyColumnMenu(
      template.definitionId,
      props,
      parent,
      // (At an instance's template root its own children follow the template's — a palette
      //  Column's MenuItems, S2 `menuItems` §9.2.)
      [
        ...("children" in template ? template.children : []),
        ...(root ? owner.children : []),
      ],
    );
    applyOwnerHideLinkOut(template.definitionId, props, parent);
    applyContextualHelpGlyph(template.definitionId, props, parent);
    applyOwnerEmphasis(template.definitionId, props, parent);
    applyGroupTurnsOn(template.definitionId, props, parent);
    applyOwnerVariant(template.definitionId, props, parent, instanceAuthored);
    applyBooleanVariant(template.definitionId, props);
    applyPropVisualRules(template.definitionId, props, visual);
    applyTypedRules(
      template.definitionId,
      props,
      visual,
      layout,
      parent,
      nodeState,
    );
    // Authored template layout (origin style) is the node's own declaration, like inline style
    // over the rule and parent delegation; an instance position's layout reaches its root.
    // (A library template node's breakpoint layers — its plain values, the same cascade.)
    const libraryLayers =
      !("kind" in template) && template.responsive
        ? CASCADE[breakpoint].flatMap((name) => {
            const layer = template.responsive?.[name];
            return layer ? [layer] : [];
          })
        : [];
    const authoredLayout: Record<string, string> = {
      ...(!("kind" in template) ? template.layout : undefined),
      ...Object.assign({}, ...libraryLayers.map((layer) => layer.layout)),
      ...libraryPatch?.layout,
    };
    if ("kind" in template) {
      applyLayoutWrites(authoredLayout, template.layout);
      for (const layer of templateLayers)
        applyLayoutWrites(authoredLayout, layer.layout);
    }
    assignLayout(layout, authoredLayout);
    if (root) assignLayout(layout, root.layout);
    const templateAuthored: Record<string, string> = {};
    assignLayout(templateAuthored, authoredLayout);
    assignLayout(templateAuthored, root?.layout);
    if (patch) {
      for (const target of [layout, templateAuthored]) {
        applyLayoutWrites(target, patch.layout);
        for (const layer of patchLayers)
          applyLayoutWrites(target, layer.layout);
      }
    }
    // Authored template visual is the node's own value: it wins over definition rules, the same
    // order as an authored node's visual writes in resolveOwned.
    if ("kind" in template) {
      applyWrites(visual, template.visual);
      for (const layer of templateLayers)
        if (layer.visual) applyWrites(visual, layer.visual);
    } else {
      applyValues(visual, template.visual);
      for (const layer of libraryLayers)
        if (layer.visual) applyValues(visual, layer.visual);
    }
    if (originOverride) applyWrites(visual, originOverride.visual);
    if (libraryPatch?.visual) applyValues(visual, libraryPatch.visual);
    if (root) Object.assign(visual, root.visual);
    const self: ParentContext = {
      definitionId: template.definitionId,
      props,
      parent,
      ...(nodeState ? { state: nodeState } : {}),
    };
    if (patch?.visual) applyWrites(visual, patch.visual);
    for (const layer of patchLayers)
      if (layer.visual) applyWrites(visual, layer.visual);
    finishLineHeight(visual);
    // This position's fills: a path patch's, else the owning instance's (template root), else the
    // template node's own — the output fields below and a nested instance's root read the same.
    const ownPaint =
      "kind" in template ? instancePaint(template, templateLayers) : {};
    const fills = patch?.fills ?? root?.fills ?? ownPaint.fills;
    const fillSizing = patch?.fillSizing
      ? cascadeFillSizing(
          { fillSizing: patch.fillSizing } as NodeEntry,
          patchLayers,
        )
      : (root?.fillSizing ?? ownPaint.fillSizing);
    const templatePaint: Pick<InstanceRoot, "fills" | "fillSizing"> = {
      ...(fills ? { fills } : {}),
      ...(fillSizing ? { fillSizing } : {}),
    };
    // State rules from above this root (ADR-253), in order: its origin's, the origin's project
    // override, then the ones the instance position authored.
    const receivedStateRules: StateRules[] = root?.origin
      ? [
          lookupDefinition(root.origin).stateRules,
          ...(originOverride ? [originOverride.stateRules] : []),
          ...(root.stateRules ?? []),
        ]
      : [];
    const availableRows = rowing?.rowSet;
    const rowSet =
      availableRows &&
      SAMPLED_ROW_OWNERS.has(templateTypeName(templateId)) &&
      catalogGrowsWithRows(visual, sizing)
        ? sampledRows(availableRows, `${instancePath.join("/")}::${templateId}`)
        : availableRows;
    const itemPositions = rowSet
      ? template.children.filter((childId) =>
          CATALOG_ROW_ITEM_TYPES.has(templateTypeName(childId)),
        )
      : [];
    // The rows reach the item positions below a part without them (TagGroup > TagList > Tag).
    const passRows =
      rowSet &&
      (itemPositions.length === 0 || templateTypeName(templateId) === "Tabs")
        ? rowSet
        : undefined;
    const rowLabel = row
      ? templateTypeName(templateId) === "TabPanel"
        ? ("content" as const)
        : templateTypeName(templateId) === "Breadcrumb"
          ? ("label" as const)
          : templateTypeName(templateId) === "Card"
            ? ("slots" as const)
            : rowing?.rowLabel
      : undefined;
    const childRowing =
      row || passRows
        ? {
            ...(row ? { row } : {}),
            ...(passRows ? { rowSet: passRows } : {}),
            ...(rowLabel ? { rowLabel } : {}),
            ...(row && rowing?.sampleOwner
              ? { sampleOwner: rowing.sampleOwner }
              : {}),
          }
        : undefined;
    /** This node's template children (`ids`) projected under `childrenParent`, rows repeated. */
    const projectChildren = (
      ids: readonly TemplateId[],
      childrenParent: ParentContext | undefined,
      rowParent: ParentContext | undefined,
    ): ResolvedCatalogNode[] => {
      const out: ResolvedCatalogNode[] = [];
      for (const childId of ids) {
        if (selection && !selection.include(childId, instancePath)) continue;
        // (ADR-322 Phase 4 — a bound Cascader: its origin's sample items give way to its rows.)
        if (
          rowSet &&
          childId.startsWith("lib:") &&
          templateTypeName(childId) === "CascaderItem"
        )
          continue;
        const childPath = [...path, childId];
        // ADR-310: a position marked `repeat` (a project template node) is the rows' template; the
        // others — and a library template's positions, which carry no mark — are static.
        const segment = repeatRows(childId, instancePath, rowSet, row);
        if (segment) {
          const projectRow = (data: CatalogBoundRow) =>
            projectTemplate(
              owner,
              childId,
              instancePath,
              childPath,
              rowParent,
              bindings,
              undefined,
              patches,
              { row: data, rowStart: true },
            );
          const run = runRowsOf(segment);
          segment.forEach((_, place) => {
            // (A windowed run's rows keep their place in the whole run — identity and `rowIndex`.)
            const data = run.data(place);
            const index = rowIndexOf(segment, place);
            const kept = run.kept(place);
            if (kept) return void out.push(kept);
            const projected = projectRow(data);
            if (projected)
              push(out, {
                ...nestTreeRows(
                  index === 0 &&
                    !selectValueRuns.has(childId) &&
                    !["Tab", "TabPanel"].includes(templateTypeName(childId))
                    ? projected
                    : withRowKey(projected, data.key),
                  data,
                  projectRow,
                  isTreeItemRecord,
                  isInstanceRecord,
                  isTableRowRecord,
                ),
                rowIndex: index,
              });
          });
          continue;
        }
        const projected = projectTemplate(
          owner,
          childId,
          instancePath,
          childPath,
          childrenParent,
          bindings,
          undefined,
          patches,
          childRowing,
        );
        if (repeatsPerMonth(templateTypeName(childId), childrenParent))
          pushCalendarMonths(out, projected, childrenParent);
        else push(out, projected);
      }
      return out;
    };
    // Children of this node that fill slot positions of the composite it instantiates
    // (`slotFills`) are projected there, not after the composite's root.
    const slotFills =
      "slotFills" in template && template.slotFills ? template.slotFills : [];
    const filledIds = new Set<TemplateId>(
      slotFills.flatMap((fill) => fill.childIds),
    );
    const ownChildIds = filledIds.size
      ? template.children.filter((childId) => !filledIds.has(childId))
      : template.children;
    const nestedScope = (
      nestedPath: readonly (NodeId | TemplateId)[],
    ): LibraryPatchScope | undefined => {
      const nestedPatches =
        "descendantPatches" in template &&
        template.descendantPatches &&
        !rowing?.rowStart
          ? template.descendantPatches
          : undefined;
      if (!nestedPatches && !slotFills.length) return undefined;
      return {
        instances: nestedPath,
        patches: nestedPatches ?? [],
        ...(slotFills.length
          ? {
              fills: slotFills.map((fill) => ({
                templatePath: fill.templatePath,
                project: (slot: ParentContext) =>
                  projectChildren(fill.childIds, slot, slot),
              })),
            }
          : {}),
      };
    };
    const children: ResolvedCatalogNode[] = [];
    if (definition.mode === "composite" && definition.templateRootId) {
      const nestedPath = [...instancePath, templateId];
      // A slot of the nested composite the instance holds as its own list (a placed Select's
      // ListBox items, 2026-10-14) repeats there: the rows go in with it. (Its template positions
      // repeat here — `projectChildren` of the fill.)
      const nestedRoot = definition.templateRootId as TemplateId;
      const ownedNestedRows =
        rowSet &&
        !row &&
        owner.descendantOverrides.some(
          (item) =>
            item.kind === "fillSlot" &&
            same(item.address, {
              instances: nestedPath.slice(nestedPath.lastIndexOf(owner.id)),
              templatePath: [nestedRoot],
            }),
        );
      if (
        !selection ||
        selection.include(definition.templateRootId, nestedPath)
      ) {
        scopeProperties(nestedPath, template.definitionId, props);
        push(
          children,
          projectTemplate(
            owner,
            definition.templateRootId,
            nestedPath,
            [definition.templateRootId],
            { ...self, collapsed: true },
            templateBindings(
              template.definitionId,
              props,
              !!row && rowing?.rowStart,
            ),
            withDisplayState(
              displayState,
              instanceRoot(
                withoutPropertyKeys(template.definitionId, [
                  ...Object.keys(template.props),
                  ...Object.keys(patch?.props ?? {}),
                  // What the instance above authored for this root goes on to the root it
                  // collapses into, as its visual does (ADR-260 follow-up — a RadioGroup
                  // component's instance set Orientation and its group stayed vertical).
                  ...Object.keys(root?.props ?? {}),
                  ...(rowing?.rowStart ? ["id"] : []),
                ]),
                props,
                [
                  // What this position got from above goes on to the root it collapses into.
                  ...Object.keys(root?.visual ?? {}),
                  ...Object.keys(originOverride?.visual ?? {}),
                  ...Object.keys(template.visual),
                  ...Object.keys(patch?.visual ?? {}),
                  // (and its breakpoint layers' — a Mobile border on a Menu's Button was dropped
                  // here, 2026-10-15)
                  ...templateLayers.flatMap((layer) =>
                    Object.keys(layer.visual ?? {}),
                  ),
                  ...patchLayers.flatMap((layer) =>
                    Object.keys(layer.visual ?? {}),
                  ),
                ],
                visual,
                sizing,
                // The position's authored layout with its path patch and their layers (the patch's
                // margin on a Menu's Button was dropped with `authoredLayout`, 2026-10-15).
                templateAuthored,
                templatePaint,
                {
                  origin: template.definitionId,
                  stateRules: [
                    ...(template.stateRules ? [template.stateRules] : []),
                    ...receivedStateRules,
                    ...(patch?.stateRules ? [patch.stateRules] : []),
                  ],
                },
              ),
            ),
            nestedScope(nestedPath),
            nestedOwnRowing ??
              (row
                ? {
                    row,
                    ...(rowLabel ? { rowLabel } : {}),
                    ...(rowing?.sampleOwner
                      ? { sampleOwner: rowing.sampleOwner }
                      : {}),
                  }
                : ownedNestedRows
                  ? { rowSet }
                  : undefined),
          ),
        );
      }
    }
    // A composite position's own children are drawn inside the root it collapses into (ADR-253:
    // a field's stepper is an instance of the Button origin that holds its glyph): that root's
    // rules reach them, as they reach the root's own template children.
    let childParent = self;
    if (definition.mode === "composite" && template.children.length) {
      let inner = children[0];
      while (inner) {
        const innerDefinition = lookupDefinition(
          inner.definitionId as DefinitionId,
        );
        const first = inner.children[0];
        if (
          innerDefinition.mode !== "composite" ||
          first?.sourceId !== innerDefinition.templateRootId
        )
          break;
        inner = first;
      }
      if (inner)
        childParent = {
          definitionId: inner.definitionId as DefinitionId,
          props: inner.props as Props,
          parent,
          ...(nodeState ? { state: nodeState } : {}),
        };
    }
    // The slot position of the composite this node's template sits in, filled by that node
    // (`slotFills`): its default children give way to the fill.
    const libraryFill =
      patches?.fills && sameIds(patches.instances, instancePath)
        ? patches.fills.find((item) => sameIds(item.templatePath, path))
        : undefined;
    if (libraryFill) children.push(...libraryFill.project(self));
    else children.push(...projectChildren(ownChildIds, childParent, self));
    let ownedRowItems = 0;
    if (change?.kind === "fillSlot" && innerPlace) {
      // An inner owner's slot contents: template positions of the instance (ADR-260 Decision 11).
      // A bound collection's own items (a bound ListBox inside a component) repeat per row as the
      // owned ones below do: the item marked `repeat` is the row template, the others are static.
      children.length = 0;
      const rowItems = rowSet
        ? change.childIds.filter((childId) =>
            CATALOG_ROW_ITEM_TYPES.has(templateTypeName(childId)),
          )
        : [];
      ownedRowItems = rowItems.filter(repeats).length;
      for (const childId of change.childIds) {
        if (selection && !selection.include(childId, innerPlace.instancePath))
          continue;
        const childPath = [...innerPlace.templatePath, childId];
        const segment = repeatRows(
          childId,
          innerPlace.instancePath,
          rowSet,
          row,
        );
        if (segment) {
          const projectRow = (data: CatalogBoundRow) =>
            projectTemplate(
              owner,
              childId,
              innerPlace.instancePath,
              childPath,
              self,
              undefined,
              undefined,
              undefined,
              { row: data, rowStart: true, sampleOwner: childId as NodeId },
            );
          const run = runRowsOf(segment);
          segment.forEach((_, place) => {
            // (A windowed run's rows keep their place in the whole run — identity and `rowIndex`.)
            const data = run.data(place);
            const index = rowIndexOf(segment, place);
            const kept = run.kept(place);
            if (kept) return void children.push(kept);
            const projected = projectRow(data);
            if (projected)
              push(children, {
                ...nestTreeRows(
                  index === 0 &&
                    !selectValueRuns.has(childId) &&
                    !["Tab", "TabPanel"].includes(templateTypeName(childId))
                    ? projected
                    : withRowKey(projected, data.key),
                  data,
                  projectRow,
                  isTreeItemRecord,
                  isInstanceRecord,
                  isTableRowRecord,
                ),
                rowIndex: index,
              });
          });
          continue;
        }
        push(
          children,
          projectTemplate(
            owner,
            childId,
            innerPlace.instancePath,
            childPath,
            self,
            undefined,
            undefined,
            undefined,
            childRowing,
          ),
        );
      }
    } else if (change?.kind === "fillSlot") {
      children.length = 0;
      // A bound collection whose items are its own nodes (placed since 2026-10-14, or added by its
      // "+"): the item marked `repeat` is the row template, repeated per row; the other items are
      // static (ADR-310).
      const rowItems = rowSet
        ? change.childIds.filter((childId) => {
            const child = graph.getEntry(childId);
            return (
              child?.kind === "node" &&
              CATALOG_ROW_ITEM_TYPES.has(
                ruleDefinitionOf(child.definitionId).name,
              )
            );
          })
        : [];
      ownedRowItems = rowItems.filter(repeats).length;
      for (const childId of change.childIds) {
        const childPath = [...instancePath, childId];
        if (selection && !selection.include(childId, childPath)) continue;
        const child = graph.getEntry(childId);
        if (child?.kind !== "node")
          throw new CatalogValidationError("DANGLING_CHILD", childId);
        const segment = child.repeat
          ? repeatRows(childId, childPath, rowSet, row)
          : undefined;
        if (segment) {
          const projectRow = (data: CatalogBoundRow) =>
            resolveOwned(child, childPath, undefined, self, {
              row: data,
              rowStart: true,
            });
          const run = runRowsOf(segment);
          segment.forEach((_, place) => {
            // (A windowed run's rows keep their place in the whole run — identity and `rowIndex`.)
            const data = run.data(place);
            const index = rowIndexOf(segment, place);
            const kept = run.kept(place);
            if (kept) return void children.push(kept);
            const projected = projectRow(data);
            if (projected)
              push(children, {
                ...nestTreeRows(
                  index === 0 &&
                    !selectValueRuns.has(childId) &&
                    !["Tab", "TabPanel"].includes(
                      ruleDefinitionOf(child.definitionId).name,
                    )
                    ? projected
                    : withRowKey(projected, data.key),
                  data,
                  projectRow,
                  isTreeItemRecord,
                  isInstanceRecord,
                  isTableRowRecord,
                ),
                rowIndex: index,
              });
          });
          continue;
        }
        // (ADR-315 Phase 5 증분 5c — a bound Table's footer: its rows read the totals row — each
        //  Column's aggregate over every row the state keeps, `CatalogBoundRows.totals`.)
        const totalsRow =
          rowSet && templateTypeName(templateId) === "TableFooter"
            ? catalogTotalsRow(rowSet)
            : undefined;
        if (totalsRow) {
          pushOwnedChild(
            children,
            child,
            resolveOwned(child, childPath, undefined, self, { row: totalsRow }),
            self,
          );
          continue;
        }
        // (A filled slot's owned children repeat like any owned children — a month block put back
        // in its calendar's frame, 판독 R1.)
        pushOwnedChild(
          children,
          child,
          resolveOwned(
            child,
            childPath,
            undefined,
            self,
            row ||
              (rowSet &&
                (!rowItems.length ||
                  templateTypeName(templateId) === "Tabs" ||
                  isSection(child)))
              ? {
                  ...(row ? { row } : {}),
                  // (ADR-310: a Card's owned title · description Text read the row's fields.)
                  ...(row && rowLabel ? { rowLabel } : {}),
                  // (A static section's items read the owner's rows too — ③ inside a section.)
                  ...(rowSet &&
                  (!rowItems.length ||
                    templateTypeName(templateId) === "Tabs" ||
                    isSection(child))
                    ? { rowSet }
                    : {}),
                  ...(rowing?.sampleOwner
                    ? { sampleOwner: rowing.sampleOwner }
                    : {}),
                }
              : undefined,
          ),
          self,
        );
      }
      // (ADR-310: a bound collection with no item of its own has no row template — binding it adds
      //  one, marked `repeat` (`catalogBindingCommand`); the origin's items are not read as one.)
    }
    for (const rule of stateVisual(template.definitionId, nodeState))
      applyWrites(visual, rule);
    if (nodeState && template.stateRules?.[nodeState])
      applyWrites(visual, template.stateRules[nodeState]);
    if (nodeState)
      for (const rules of receivedStateRules)
        if (rules[nodeState]) applyWrites(visual, rules[nodeState]);
    if (nodeState && patch?.stateRules?.[nodeState])
      applyWrites(visual, patch.stateRules[nodeState]);
    const templateStates = stateValues([
      lookupDefinition(template.definitionId).stateRules,
      findOverride(template.definitionId)?.stateRules,
      template.stateRules,
      ...receivedStateRules,
      patch?.stateRules,
    ]);
    return {
      sourceId: templateId,
      instancePath,
      definitionId: template.definitionId,
      props,
      visual,
      ...(templateStates ? { stateVisual: templateStates } : {}),
      layout,
      sizing,
      ...(Object.keys(templateAuthored).length
        ? { authoredLayout: templateAuthored }
        : {}),
      ...("kind" in template ? authoredExtras(template, templateLayers) : {}),
      ...(templatePaint.fills
        ? { fills: resolvedFills(templatePaint.fills) }
        : {}),
      ...(templatePaint.fillSizing
        ? { fillSizing: templatePaint.fillSizing }
        : {}),
      slot: template.slot,
      ...(template.presentWhen ? { presentWhen: template.presentWhen } : {}),
      ...(template.showWhen ? { showWhen: template.showWhen } : {}),
      ...(displayState ? { displayState } : {}),
      ...(rowSet?.length === 0 &&
      ["Tabs", "TabList"].includes(templateTypeName(templateId))
        ? { rowCount: 0, rowsShown: 0 }
        : {}),
      ...(rowSet &&
      (itemPositions.some(repeats) || ownedRowItems > 0) &&
      SAMPLED_ROW_OWNERS.has(templateTypeName(templateId)) &&
      catalogGrowsWithRows(visual, sizing)
        ? { rowCount: rowCountOf(rowSet), rowsShown: rowsShownOf(rowSet) }
        : {}),
      children,
    };
  };
  const resolved = resolveOwned(source, [source.id]);
  if (!resolved) throw new CatalogValidationError("NODE_DISABLED", id);
  return resolved;
}

/** A node's resolution state: its display state's state rules, else the context state. */
export function catalogNodeState(
  displayState: DisplayStateName | undefined,
  state?: StateName,
): StateName | undefined {
  return (displayState && DISPLAY_PAINT_STATE[displayState]) ?? state;
}

function withDisplayState(
  displayState: DisplayStateName | undefined,
  root: InstanceRoot,
): InstanceRoot {
  return displayState ? { ...root, displayState } : root;
}

function push(
  children: ResolvedCatalogNode[],
  child: ResolvedCatalogNode | undefined,
): void {
  if (child) children.push(child);
}

/**
 * ADR-315 Phase 4 증분 6 — the sort a bound Table's view leaves its rows in, by field key
 * (`catalogViewAuthoredSort` — the text its record carries for the header to show).
 */
function viewAuthoredSort(
  binding: DataBindingRef | undefined,
  lookupEntry: (id: string) => unknown,
): string | undefined {
  if (!binding) return undefined;
  const views: ViewQuery[] = [];
  if (binding.view) views.push(binding.view);
  else {
    const seen = new Set<string>();
    for (let id: string | undefined = binding.viewId; id && !seen.has(id);) {
      seen.add(id);
      const view = lookupEntry(id) as ViewEntry | undefined;
      if (view?.kind !== "view") return undefined;
      views.unshift(view);
      id = "viewId" in view.source ? (view.source.viewId as string) : undefined;
    }
  }
  if (!views.some((view) => view.sort?.length)) return undefined;
  const collection = lookupEntry(binding.collectionId) as
    | { kind?: string; schema?: readonly { id?: string; key?: string }[] }
    | undefined;
  return collection?.kind === "collection"
    ? catalogViewAuthoredSort(views, collection.schema ?? [])
    : undefined;
}

/**
 * ADR-284 Decision 5 — a binding's view (built-in, or the shared one it reads) sorts by a variable:
 * a Table bound so is that variable's (사용자 결정 2 — the others keep ADR-257's runtime sort).
 */
function viewSortsByVariable(
  binding: DataBindingRef | undefined,
  lookupEntry: (id: string) => unknown,
): boolean {
  if (!binding) return false;
  const sort =
    binding.view?.sort ??
    (() => {
      const shared = binding.viewId ? lookupEntry(binding.viewId) : undefined;
      return shared && (shared as { kind?: string }).kind === "view"
        ? (shared as ViewEntry).sort
        : undefined;
    })();
  return !!sort?.some((entry) => "variableId" in entry);
}

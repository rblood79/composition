import {
  getIconData,
  lightColors,
  resolveToken,
  spacing,
  typography,
} from "@composition/rendering";
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import { originForksOf } from "../../../../../packages/shared/src/catalog/document/originFork";
import {
  componentPageMembers,
  LIBRARY_COMPONENT_PAGE,
  LOCAL_COMPONENT_PAGE,
} from "../../../../../packages/shared/src/catalog/document/componentPages";
import type { CatalogCommand } from "../../../../../packages/shared/src/catalog/commands/compose";
import type { CatalogOperation } from "../../../../../packages/shared/src/catalog/transactions/transaction";
import type {
  CatalogReader,
  DefinitionId,
  EntryId,
  InstanceAddress,
  LibraryDefinitionId,
  LibraryTemplateId,
  NodeEntry,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
  childPositions,
  type CatalogPosition,
} from "../../../../../packages/shared/src/catalog/resolution/positions";
import { resolveCatalogRuleCanvasBox } from "../../../../../packages/shared/src/catalog/resolvers/resolveCatalogRuleCanvasBox";
import { catalogChildKind } from "../../../../../packages/shared/src/catalog/nesting/nestingRules";
import { catalogBuiltinOrigins } from "./layouts";
import type { CatalogComponentsViewId } from "./originViewNode";
import {
  catalogDefinitionTitle,
  catalogOriginOverride,
  COMPONENTS_VIEW,
  componentsViewRoot,
  isComponentsViewRoot,
  isPageCard,
  isProjectComponentsView,
  PROJECT_ORIGIN_VIEW_NODE,
  projectComponentCardId,
  projectComponentOriginCellId,
  isThemeSample,
  ORIGIN_VIEW_NODE,
  originCardId,
  originInstanceId,
  originOfEditableSample,
  originOfPageInstance,
  originOfSample,
  originSampleId,
  componentPageNodeId,
  themeSampleId,
} from "./originView";
import {
  catalogCreationProps,
  catalogCreationStyle,
  catalogPaletteDefinitionId,
} from "./paletteInsert";

/**
 * The Components page (user 2026-10-05, sample `docs/design/components.PNG`): one derived page
 * that draws every built-in component origin as a numbered card, in palette order over a few
 * columns, after the theme's cards (01–04: colors, type scale, icons, spacing — read from the
 * theme token tables in the workspace's color mode). A card shows the origin (◆ — its one editable sample: its props and styles are the
 * project's override of that origin, `originView` holds the edit rules) with its slots empty, an instance (◇) beside it filled, a collection's item, then its instances (◇): variants × states (a line per variant when
 * it has state variants — `<origin>--<state>`, instances of the origin — else its variants side
 * by side); a card draws no line of sizes (user 2026-10-06: it took most of a card). All of it is graph view entries (never saved, exported or indexed). The
 * Layers tree lists the page as card → origin and instances (`catalogComponentsPageRows`).
 */
/**
 * The body's grid columns per breakpoint, each as wide as its cards (user 2026-10-25 「desktop
 * 3*auto, tablet 2*auto, mobile 1*auto」) — the base and the tablet · mobile layers.
 */
const BODY_COLUMNS = { desktop: 3, tablet: 2, mobile: 1 } as const;
const autoTracks = (count: number) => Array(count).fill("auto").join(" ");
const GAP = 16;
const PAGE_PADDING = 16;
const CARD_PADDING = 24;
/** The width a card's line fills before it breaks onto the next line. */
const LINE_WIDTH = 512;
const CELL_GAP = 16;
/** Narrow cells a line holds. */
const PER_LINE = 5;
/** A composed origin's cell (a field, a list): wide enough to lay its parts out. */
const COMPOSED_CELL_WIDTH = 240;
/**
 * Origins whose largest size is wider than the composed cell (a date range's two inputs do not
 * shrink): their cell's width.
 */
const WIDER_CELL: Readonly<Record<string, number>> = { DateRangePicker: 360 };
/** Icons the Icons card shows (those the registry holds). */
const SAMPLE_ICONS = [
  "house",
  "search",
  "bell",
  "circle-user",
  "settings",
  "mail",
  "calendar",
  "chart-line",
  "shield",
  "pencil",
  "square-pen",
  "circle-check",
  "x",
  "info",
  "triangle-alert",
  "lock",
  "upload",
  "download",
  "star",
  "heart",
  "trash-2",
];
const ICON = "lib:definition:type-Icon";
const TYPE_BASE = "text-base";
// (A field's control Group — ADR-256 Phase 6b: a field, not a collection.)
const CONTROL_GROUP = "lib:definition:type-Group";
/**
 * ADR-278: the overlay origins whose card draws the body (Modal · Popover · Tooltip) open beside
 * the trigger (user decision 2, 2026-10-21 — the Origin line, right of ◆). A picker's Popover
 * (a Select's list, a DatePicker's calendar) stays closed: its body is a part, not a slot.
 */
const OPEN_BODY_ORIGINS: ReadonlySet<string> = new Set([
  "Dialog",
  "Popover",
  "Tooltip",
  "ContextualHelp",
  "Menu",
]);
/**
 * Overlay origins whose card draws the origin alone — no filled instance beside its open body
 * (user 2026-10-25 「61.dialog, 62.popover, 63. 모두 instance 객체 삭제」).
 */
const ORIGIN_ONLY_CARDS: ReadonlySet<string> = new Set([
  "Dialog",
  "Popover",
  "ContextualHelp",
]);
/** Origins whose card draws no Variants line (user 2026-10-25 「… - Variants 제거」). */
const NO_VARIANTS_LINE: ReadonlySet<string> = new Set([
  "CardView",
  "Badge",
  "Meter",
  "StatusLight",
  "InlineAlert",
  "Card",
]);
const CLOSED_OVERLAY_TYPES: ReadonlySet<string> = new Set([
  "lib:definition:type-Modal",
  "lib:definition:type-Popover",
  "lib:definition:type-Tooltip",
]);
const COLOR_FAMILIES = ["accent", "neutral", "negative", "border"];
const COLOR_SURFACES = [
  "base",
  "raised",
  "layer-1",
  "layer-2",
  "elevated",
  "disabled",
  "transparent",
  "white",
  "black",
];

const node = (
  id: NodeId,
  definitionId: NodeEntry["definitionId"],
  fields: Partial<NodeEntry> = {},
): NodeEntry => ({
  kind: "node",
  id,
  definitionId,
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...fields,
});
const part = (...path: string[]) =>
  `${ORIGIN_VIEW_NODE}/${path.join("/")}` as NodeId;
const FRAME = "lib:definition:type-frame";
const titleCase = (value: string) =>
  value.replace(
    /(^|-)([a-z])/g,
    (_, dash: string, letter: string) =>
      `${dash ? " " : ""}${letter.toUpperCase()}`,
  );

const set = <T>(value: T) => ({ kind: "set" as const, value });
/** The marks of an origin and of an instance (the Layers rows' dots, in a caption). */
const ORIGIN_MARK = "◆";
const INSTANCE_MARK = "◇";

/** What a card shows of one origin: its variants and state variants. */
interface OriginFacets {
  variants: string[];
  defaultVariant: string | undefined;
  /** State variant definitions (`<origin>--<state>`), library order. */
  states: { id: LibraryDefinitionId; name: string }[];
  /** The origin's template has children (a composed component: drawn larger). */
  composed: boolean;
  /** The origin fills its container's width (a field, a list): its cell is a fixed width. */
  fills: boolean;
}
function originFacets(
  graph: CatalogGraph,
  originId: LibraryDefinitionId,
  stateIds: readonly LibraryDefinitionId[],
): OriginFacets {
  // (The card's layout reads the library template — an unlocked origin's copy keeps its card.)
  const library = graph.codeLibrary;
  const origin = library.definitions.get(originId);
  const root =
    origin && "templateRootId" in origin && origin.templateRootId
      ? library.templates.get(origin.templateRootId as LibraryTemplateId)
      : undefined;
  const type = root
    ? (library.definitions.get(root.definitionId as LibraryDefinitionId) as
        | {
            propChoices?: Readonly<Record<string, readonly unknown[]>>;
            defaults?: Readonly<Record<string, unknown>>;
          }
        | undefined)
    : undefined;
  const choices = (prop: string) =>
    (type?.propChoices?.[prop] ?? []).map(String);
  const variant = root?.props.variant ?? type?.defaults?.variant;
  return {
    variants: choices("variant"),
    defaultVariant: variant === undefined ? undefined : String(variant),
    states: stateIds.map((id) => ({
      id,
      name: titleCase(id.slice(id.indexOf("--") + 2)),
    })),
    composed: (root?.children.length ?? 0) > 0,
    fills:
      (root?.visual?.width ??
        resolveCatalogRuleCanvasBox(
          String(root?.definitionId ?? "").replace("lib:definition:type-", ""),
          undefined,
        ).width) === "100%",
  };
}

/**
 * A collection origin's item origin: the origin with state variants its template holds — under
 * the root or one container down (a TabList's tabs) — **in a declared slot, or more than once**
 * (a Pagination's buttons) — and that item's parts to fill in when it is drawn alone (`label`:
 * its text; the others hold a `{placeholder}` and are switched off). `undefined` = not a
 * collection (or a picker: its items are drawn in a popup). One such origin outside any slot is
 * a part, not an item — a Menu's, Select's, SearchField's or an overlay's trigger Button. **Why
 * (2026-10-21)**: 7 Library cards drew the Button's 5 states as their "Item" (the trigger, held
 * once under the root, was found before — or instead of — the MenuItem in the popup).
 */
function originItems(
  graph: CatalogGraph,
  originId: LibraryDefinitionId,
  stateIds: ReadonlyMap<string, readonly LibraryDefinitionId[]>,
) {
  const library = graph.codeLibrary;
  const templateOf = (definitionId: string | undefined) => {
    const definition = definitionId
      ? library.definitions.get(definitionId as LibraryDefinitionId)
      : undefined;
    const rootId =
      definition && "templateRootId" in definition
        ? (definition.templateRootId as LibraryTemplateId | undefined)
        : undefined;
    const root = rootId ? library.templates.get(rootId) : undefined;
    return rootId && root ? { rootId, root } : undefined;
  };
  const own = templateOf(originId);
  if (!own) return undefined;
  const children = own.root.children.map((id) =>
    library.templates.get(id as LibraryTemplateId),
  );
  if (children.some((child) => child?.definitionId === CONTROL_GROUP))
    return undefined;
  // The state-holding origins the template holds at any depth, with whether their holder is a
  // slot — level by level (the root's own children first). ADR-278: a closed overlay (a
  // picker's Popover) is not entered — its items are drawn in a popup the card does not open;
  // an overlay origin's own body (drawn open on its card) is.
  const opensBody = OPEN_BODY_ORIGINS.has(
    library.definitions.get(originId)?.name ?? "",
  );
  const held: {
    definitionId: string;
    holder: LibraryTemplateId;
    /** The holder is a collection's slot (a ListBox's · Menu's · TabList's items). */
    collectionSlot: boolean;
  }[] = [];
  const holderTypeName = (holder: (typeof own)["root"]) =>
    holder.definitionId.startsWith("lib:definition:type-")
      ? holder.definitionId.slice("lib:definition:type-".length)
      : (library.definitions.get(holder.definitionId as LibraryDefinitionId)
          ?.name ?? "");
  let level = [own.root];
  while (level.length > 0) {
    const next: typeof level = [];
    for (const holder of level)
      for (const id of holder.children) {
        const node = library.templates.get(id as LibraryTemplateId);
        if (!node) continue;
        if (stateIds.has(node.definitionId))
          held.push({
            definitionId: node.definitionId,
            holder: holder.id,
            collectionSlot:
              Boolean(holder.slot) &&
              catalogChildKind(holderTypeName(holder)).kind === "items",
          });
        if (opensBody || !CLOSED_OVERLAY_TYPES.has(node.definitionId))
          next.push(node);
      }
    level = next;
  }
  // An item: held in a collection's slot, or held more than once by one holder (a Pagination's
  // buttons, a Toolbar's). One held once — a trigger Button, a Dialog's Close, a ContextualHelp
  // footer's Link — is a part.
  const origin = held.find(
    (candidate) =>
      candidate.collectionSlot ||
      held.filter(
        (other) =>
          other.definitionId === candidate.definitionId &&
          other.holder === candidate.holder,
      ).length > 1,
  )?.definitionId as LibraryDefinitionId | undefined;
  const item = templateOf(origin);
  if (!origin || !item) return undefined;
  // (A crumb Link's `{href}` is the item's address, not a content place — ADR-256 Phase 5a.)
  const placeholder = (props: Readonly<Record<string, unknown>> | undefined) =>
    Object.entries(props ?? {}).some(
      ([key, value]) =>
        key !== "href" && typeof value === "string" && /^\{.+\}$/.test(value),
    );
  let labelled = false;
  const parts = item.root.children.flatMap((id) => {
    const child = library.templates.get(id as LibraryTemplateId);
    if (!child || !placeholder(child.props)) return [];
    // The item's name: its first part that reads the owner's label, title or children (a
    // ListBoxItem's label Text, a Disclosure's header).
    const label =
      !labelled &&
      typeof child.props?.children === "string" &&
      /^\{(label|title|children)\}$/.test(child.props.children);
    labelled ||= label;
    return [{ path: [item.rootId, id as LibraryTemplateId], label }];
  });
  return { origin, parts };
}

/**
 * An origin's declared slots (its template nodes with `slot`, root first): each slot's path from
 * the template root and the paths of what it holds (switched off to show the slot empty).
 */
function originSlots(graph: CatalogGraph, originId: LibraryDefinitionId) {
  const library = graph.codeLibrary;
  const origin = library.definitions.get(originId);
  const rootId =
    origin && "templateRootId" in origin
      ? (origin.templateRootId as LibraryTemplateId | undefined)
      : undefined;
  const slots: {
    name: string;
    path: LibraryTemplateId[];
    contents: LibraryTemplateId[][];
  }[] = [];
  const visit = (path: LibraryTemplateId[]) => {
    const node = library.templates.get(path[path.length - 1]!);
    if (!node) return;
    if (node.slot)
      slots.push({
        name: node.slot.name,
        path,
        contents: node.children.map((child) => [
          ...path,
          child as LibraryTemplateId,
        ]),
      });
    for (const child of node.children)
      visit([...path, child as LibraryTemplateId]);
  };
  if (rootId) visit([rootId]);
  return slots;
}

/**
 * The Layers rows read so far, by the page's root entry (a new one each time the page is laid out)
 * and the document revision they were read at: a step (Delete component removes the ◆ root) runs
 * the Layers rebuild before the page is laid out again, and rows read before it would still name
 * the removed root (user 2026-10-21 — DANGLING_CHILD on the dissolve step).
 */
const pageRows = new WeakMap<
  object,
  Map<string, { revision: number; rows: CatalogPosition[] }>
>();
/**
 * The Layers rows of a Components page node, where they differ from its drawn children: the page
 * lists its cards (a group per component, numbered order) and a card what it holds — the origin,
 * the origin's parts and its instances, side by side; the column, line and cell frames are
 * layout only. `undefined` = the node's own children (an origin's own template).
 */
export function catalogComponentsPageRows(
  reader: CatalogReader,
  position: CatalogPosition,
): CatalogPosition[] | undefined {
  // (One derived page is shown at a time.)
  const page =
    reader.getEntry(ORIGIN_VIEW_NODE) ??
    reader.getEntry(PROJECT_ORIGIN_VIEW_NODE);
  if (!page) return undefined;
  let rows = pageRows.get(page);
  if (!rows) pageRows.set(page, (rows = new Map()));
  const known = rows.get(position.identity);
  if (known && known.revision === reader.revision) return known.rows;
  const read = readPageRows(reader, position);
  if (!read) return undefined;
  rows.set(position.identity, { revision: reader.revision, rows: read });
  return read;
}
function readPageRows(
  reader: CatalogReader,
  position: CatalogPosition,
): CatalogPosition[] | undefined {
  if (position.target.kind !== "node") return undefined;
  const id = position.target.id;
  const isPageRoot = isComponentsViewRoot(id);
  if (!isPageRoot && !isPageCard(id)) return undefined;
  // A row's identity carries its drawn ancestry: rows are found by walking the page's frames.
  const found: CatalogPosition[] = [];
  const walk = (from: CatalogPosition, wanted: (id: string) => boolean) => {
    for (const child of childPositions(reader, from)) {
      if (wanted(child.sourceId)) found.push(child);
      else if (child.definitionId === FRAME) walk(child, wanted);
    }
  };
  // A project component's origin (the Local page's ◆ — ADR-279, the definition's template root).
  const isProjectOrigin = (nodeId: string) =>
    nodeId.startsWith("project:node:") &&
    !nodeId.startsWith(ORIGIN_VIEW_NODE) &&
    reader.definitionOfTemplateRoot(nodeId as NodeId) !== undefined;
  // The project components page lists its cards as the Library page does — a group row per
  // component (the Canvas selects the card the same way), in the project's order — and a card
  // its origin (2026-10-22 user 「Library 와 동일한 통일된 패턴」; before, the origins stood
  // directly under the page body and a selected card had no row).
  if (id === PROJECT_ORIGIN_VIEW_NODE) {
    walk(position, isPageCard);
    const order = new Map<string, number>(
      catalogProjectComponents(reader).map((component, index) => [
        projectComponentCardId(component.id),
        index,
      ]),
    );
    // (The 「No components」 card of an empty page is a note, not a component: no row.)
    return found
      .filter((card) => order.has(card.sourceId))
      .sort((a, b) => order.get(a.sourceId)! - order.get(b.sourceId)!);
  }
  if (isPageRoot) {
    // The cards in their numbered order (the columns hold them in drawn order).
    walk(position, isPageCard);
    const order = new Map<string, number>(
      catalogBuiltinOrigins(reader.library).map((item, index) => [
        originCardId(item.id),
        index,
      ]),
    );
    const theme = found.filter((card) => !order.has(card.sourceId));
    return [
      ...theme,
      ...found
        .filter((card) => order.has(card.sourceId))
        .sort((a, b) => order.get(a.sourceId)! - order.get(b.sourceId)!),
    ];
  }
  // A card: the origin and its instances (a theme card: its values; a Local card: its ◆), side
  // by side.
  walk(
    position,
    (nodeId) =>
      originOfEditableSample(nodeId) !== undefined ||
      originOfPageInstance(nodeId) !== undefined ||
      isThemeSample(nodeId) ||
      isProjectOrigin(nodeId),
  );
  return found;
}

/** A sample in a line and the caption lines under it. */
interface PageCell {
  sample: NodeId;
  captions: readonly NodeId[];
}

/**
 * The drawing kit of a components page: its entries (each computed on read), the theme colors,
 * and what a page is made of — numbered cards of named lines on a grid body.
 */
function pageKit(graph: CatalogGraph, mode: "light" | "dark") {
  const library = graph.library;
  // The page's own colors are the theme's (read in the workspace's color mode).
  const color = (name: string) => String(resolveToken(`{color.${name}}`, mode));
  const MUTED_COLOR = color("neutral-subdued");
  const entries = new Map<NodeId, () => NodeEntry>();
  const fixed = (entry: NodeEntry) => {
    entries.set(entry.id, () => entry);
    return entry.id;
  };
  const textId = catalogPaletteDefinitionId(library, "Text");
  const text = (
    id: NodeId,
    value: string,
    style: Record<string, unknown>,
    name = value,
  ) =>
    fixed(
      node(id, textId, {
        name,
        props: catalogCreationProps(library, textId, "Text", {
          children: value,
        }),
        ...catalogCreationStyle({ style }),
      }),
    );
  const frame = (
    id: NodeId,
    name: string,
    children: NodeId[],
    style: Record<string, unknown>,
  ) =>
    fixed(
      node(id, FRAME, {
        name,
        children,
        ...catalogCreationStyle({ style: { display: "flex", ...style } }),
      }),
    );
  /** A cell's caption (`at` > 0: a muted second line). */
  const caption = (id: NodeId, value: string, at = 0) =>
    text(id, value, {
      fontSize: at === 0 ? 11 : 10,
      color: MUTED_COLOR,
    });
  /**
   * A named line of cells (user 2026-10-25 — no frame per line or per cell): its name, then its
   * cells in grids of `perLine` columns — the samples on the first row, their captions on the
   * rows under it, so each sample stands over its caption. Captions sit on one baseline (`end`);
   * the Origin line's samples on top (`start`: the origin's empty slot is shorter than the filled
   * instance beside it — 2026-10-21). `track`: a fixed column width (a sample that fills its
   * cell). The grids are `<id>/1`, `<id>/2` … (the first holds a card's ◆).
   */
  const line = (
    id: string,
    name: string | undefined,
    cells: readonly PageCell[],
    options: {
      alignItems?: "end" | "start";
      track?: number;
      perLine?: number;
    } = {},
  ): NodeId[] => {
    const perLine = Math.max(
      1,
      options.perLine ??
        (options.track
          ? Math.floor((LINE_WIDTH + CELL_GAP) / (options.track + CELL_GAP))
          : PER_LINE),
    );
    const ids: NodeId[] =
      name === undefined
        ? []
        : [
            text(`${id}/label` as NodeId, name, {
              fontSize: 12,
              fontWeight: 600,
            }),
          ];
    for (let at = 0; at < cells.length; at += perLine) {
      const chunk = cells.slice(at, at + perLine);
      const rows = Math.max(0, ...chunk.map((cell) => cell.captions.length));
      ids.push(
        frame(
          `${id}/${at / perLine + 1}` as NodeId,
          name ?? "Samples",
          [
            ...chunk.map((cell) => cell.sample),
            ...Array.from({ length: rows }, (_, row) =>
              chunk.flatMap((cell) =>
                cell.captions[row] ? [cell.captions[row]] : [],
              ),
            ).flat(),
          ],
          {
            display: "grid",
            gridTemplateColumns: chunk
              .map(() => (options.track ? `${options.track}px` : "auto"))
              .join(" "),
            alignItems: options.alignItems ?? "end",
            columnGap: `${CELL_GAP}px`,
            rowGap: "6px",
          },
        ),
      );
    }
    return ids;
  };

  const cards: NodeId[] = [];
  /** A numbered card (numbered in the order the cards are made): its title, then its lines. */
  const card = (
    cardId: NodeId,
    titleId: NodeId,
    name: string,
    lines: NodeId[],
    caption: string = name,
  ) => {
    const title = text(
      titleId,
      `${String(cards.length + 1).padStart(2, "0")}. ${caption.toUpperCase()}`,
      { fontSize: 12, fontWeight: 700 },
    );
    cards.push(
      // (Its grid column's width — user 2026-10-25 「카드들 모두 width 100%」.)
      frame(cardId, name, [title, ...lines], {
        width: "100%",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 12,
        padding: CARD_PADDING,
        backgroundColor: color("base"),
        borderRadius: 12,
      }),
    );
  };

  /**
   * The cards in their numbered order under the root — a body, named by its type in Layers as a
   * page's body is (user 2026-10-14) — on a grid of columns as wide as their cards, three on
   * desktop, two on tablet, one on mobile (user 2026-10-25: no column frames). Its width is the
   * breakpoint's page width, as a page body's (the composition root's page frame); its height
   * the body rule's `100%` (user 2026-10-25).
   */
  const finish = (rootId: NodeId) => {
    const columns = (breakpoint: "tablet" | "mobile") => ({
      layout: catalogCreationStyle({
        style: { gridTemplateColumns: autoTracks(BODY_COLUMNS[breakpoint]) },
      }).layout!,
    });
    fixed(
      node(rootId, "lib:definition:type-body", {
        children: cards,
        responsive: { tablet: columns("tablet"), mobile: columns("mobile") },
        ...catalogCreationStyle({
          style: {
            display: "grid",
            gridTemplateColumns: autoTracks(BODY_COLUMNS.desktop),
            gap: GAP,
            padding: PAGE_PADDING,
            backgroundColor: color("neutral-subtle"),
          },
        }),
      }),
    );
    return entries;
  };
  return {
    library,
    color,
    MUTED_COLOR,
    entries,
    fixed,
    text,
    frame,
    caption,
    line,
    card,
    finish,
  };
}

export function catalogComponentsPageEntries(
  graph: CatalogGraph,
  mode: "light" | "dark" = "light",
  /** Filled with the origins' display text (`CatalogGraph.setOriginDisplayBindings`). */
  display = new Map<string, Readonly<Record<string, string>>>(),
): Map<NodeId, () => NodeEntry> {
  const { library, color, entries, fixed, text, frame, caption, line, card, finish } =
    pageKit(graph, mode);
  // ADR-282: the card's structure is the library template's (stable ids); an unlocked origin's
  // instances project its copy, so every address the page writes goes through the copies.
  const code = graph.codeLibrary;
  const forks = originForksOf((id) => graph.getEntry(id), graph.projectId);
  const copyOf = new Map<string, string>();
  for (const fork of forks.values())
    for (const [templateId, nodeId] of Object.entries(fork.templateMap))
      copyOf.set(templateId, nodeId);
  const throughCopies = <T extends string>(ids: readonly T[]): T[] =>
    ids.map((id) => (copyOf.get(id) ?? id) as T);
  const address = (
    instances: readonly string[],
    templatePath: readonly string[],
  ) =>
    ({
      instances: throughCopies(instances),
      templatePath: throughCopies(templatePath),
    }) as InstanceAddress;
  const stateIds = new Map<string, LibraryDefinitionId[]>();
  for (const id of library.definitions.keys()) {
    const at = id.indexOf("--");
    if (at < 0) continue;
    const base = id.slice(0, at);
    stateIds.set(base, [...(stateIds.get(base) ?? []), id]);
  }

  // The theme first (01–04): its colors, type scale, icons and spacing — the values every
  // component below is drawn with.
  const theme = (...path: string[]) => part("theme", ...path);
  /** A theme value over its caption lines (the first names it with its mark). */
  const captioned = (
    key: string,
    name: string,
    sample: NodeId,
    ...lines: string[]
  ): PageCell => ({
    sample,
    captions: lines.map((value, at) =>
      caption(theme(key, name, "caption", String(at)), value, at),
    ),
  });
  // Each theme card follows the component cards: the base value as its origin (◆), the values
  // derived from it as instances (◇) — a grouping for reading, not a document relation.
  const origins = (key: string, cells: PageCell[]) =>
    line(theme(key, "line", "origin"), "Origin", cells);
  {
    // A family's head (`accent`) is the origin; `accent-hover`, `on-accent` derive from it.
    // Surfaces derive from `base`. The raw palette the tint and neutral pick from is left out —
    // the card shows the semantic colors components are drawn with.
    const names = Object.keys(lightColors);
    const groups = new Map<string, string[]>(
      [...COLOR_FAMILIES, "surface"].map((key) => [key, []]),
    );
    const heads: string[] = [];
    for (const name of names) {
      const family = name.replace(/^on-/, "").split("-")[0]!;
      const semantic = COLOR_FAMILIES.includes(family);
      if ((semantic && name === family) || name === "base") heads.push(name);
      else if (semantic) groups.get(family)!.push(name);
      else if (COLOR_SURFACES.includes(name)) groups.get("surface")!.push(name);
    }
    for (const [key, list] of groups) if (!list.length) groups.delete(key);
    const swatch = (name: string, mark: string, label = name) =>
      captioned(
        "colors",
        name,
        frame(themeSampleId("colors", name), name, [], {
          width: 44,
          height: 44,
          flexShrink: 0,
          backgroundColor: color(name),
          borderRadius: 8,
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: color("border"),
        }),
        `${mark} ${label}`,
        color(name),
      );
    card(theme("colors", "card"), theme("colors", "title"), "Colors", [
      ...origins(
        "colors",
        heads.map((name) => swatch(name, ORIGIN_MARK)),
      ),
      ...[...groups].flatMap(([group, list]) =>
        line(
          theme("colors", "line", group),
          titleCase(group),
          list.map((name) =>
            swatch(
              name,
              INSTANCE_MARK,
              // `accent-hover` under Accent reads `hover`; `on-accent` keeps its name.
              name.startsWith(`${group}-`)
                ? name.slice(group.length + 1)
                : name,
            ),
          ),
        ),
      ),
    ]);
  }
  {
    const sizes = Object.entries(typography)
      .filter(([name]) => !name.includes("--"))
      .sort((a, b) => Number(b[1]) - Number(a[1]));
    const lineHeights = typography as unknown as Record<string, number>;
    const sample = ([name, size]: [string, unknown], mark: string) =>
      captioned(
        "typography",
        name,
        text(
          themeSampleId("typography", name),
          "Aa 가나다 123",
          { fontSize: Number(size) },
          name,
        ),
        // `text-md` declares no line height of its own.
        `${mark} ${name} · ${size}px${
          lineHeights[`${name}--line-height`] === undefined
            ? ""
            : ` / ${lineHeights[`${name}--line-height`]}px`
        }`,
      );
    const base = sizes.find(([name]) => name === TYPE_BASE) ?? sizes[0]!;
    // The sizes one to a row, each caption beside its sample.
    const rows = sizes
      .filter((entry) => entry !== base)
      .map((entry) => sample(entry, INSTANCE_MARK));
    card(theme("typography", "card"), theme("typography", "title"), "Typography", [
      ...origins("typography", [sample(base, ORIGIN_MARK)]),
      text(theme("typography", "line", "sizes", "label"), "Sizes", {
        fontSize: 12,
        fontWeight: 600,
      }),
      frame(
        theme("typography", "line", "sizes", "1"),
        "Sizes",
        rows.flatMap((row) => [row.sample, ...row.captions]),
        {
          display: "grid",
          gridTemplateColumns: "auto auto",
          alignItems: "center",
          columnGap: `${CELL_GAP}px`,
          rowGap: "10px",
        },
      ),
    ]);
  }
  {
    const icon = (name: string, mark: string, iconName = name) =>
      captioned(
        "icons",
        name,
        fixed(
          node(themeSampleId("icons", name), ICON, {
            name,
            props: { iconName: set(iconName) },
          }),
        ),
        `${mark} ${name}`,
      );
    const icons = SAMPLE_ICONS.filter((name) => getIconData(name));
    card(theme("icons", "card"), theme("icons", "title"), "Icons", [
      ...origins("icons", [icon("Icon", ORIGIN_MARK, "star")]),
      ...line(
        theme("icons", "line", "instances"),
        "Instances",
        icons.map((name) => icon(name, INSTANCE_MARK)),
        { perLine: 7 },
      ),
    ]);
  }
  {
    const box = ([name, size]: [string, unknown], mark: string) =>
      captioned(
        "spacing",
        name,
        frame(themeSampleId("spacing", name), name, [], {
          width: Number(size),
          height: Number(size),
          flexShrink: 0,
          backgroundColor: color("accent-subtle"),
          borderWidth: 1,
          borderStyle: "solid",
          borderColor: color("accent"),
        }),
        `${mark} ${name}`,
        `${size}px`,
      );
    const steps = Object.entries(spacing);
    const base = steps.find(([name]) => name === "md") ?? steps[0]!;
    card(theme("spacing", "card"), theme("spacing", "title"), "Spacing", [
      ...origins("spacing", [box(base, ORIGIN_MARK)]),
      ...line(
        theme("spacing", "line", "sizes"),
        "Sizes",
        steps
          .filter((step) => step !== base)
          .map((step) => box(step, INSTANCE_MARK)),
        { perLine: 7 },
      ),
    ]);
  }

  /**
   * ADR-282 Decision 3: an unlocked origin's ◆ is its copy's root itself (an owned node — every
   * edit command works on it, as on a Local page card's); the holder draws it in place of the
   * sample while the copy is there (read on each read).
   */
  const drawCopy = (holder: NodeId, sampleId: NodeId, copyRoot: NodeId) => {
    const laidOut = entries.get(holder)!();
    entries.set(holder, () => ({
      ...laidOut,
      children: laidOut.children.map((child) =>
        child === sampleId && graph.getEntry(copyRoot) ? copyRoot : child,
      ),
    }));
  };
  const cardOrigins = new Set<string>(
    catalogBuiltinOrigins(library).map((origin) => origin.id),
  );
  catalogBuiltinOrigins(library).forEach((origin) => {
    const facets = originFacets(
      graph,
      origin.id,
      stateIds.get(origin.id) ?? [],
    );
    const base = (...path: string[]) => part("origin", origin.id, ...path);
    // A composed origin without states (a field, a list) fills a fixed cell; a stateful one
    // (Button, Checkbox) is as small as a leaf. A base part that fills its container (the
    // Input — ADR-253) takes the same cell: a `%` width of a fit-content cell is nothing.
    const wide =
      (facets.composed || origin.category === "parts") &&
      facets.states.length === 0 &&
      facets.fills;
    const cellWidth = wide
      ? (WIDER_CELL[origin.name] ?? COMPOSED_CELL_WIDTH)
      : undefined;
    // The origin's own sample: its fields = the project's override (read on each read). Its
    // declared slots show empty (the pen.dev design-system page: a component's master shows its
    // slots hatched, the instance beside it what fills them — the instance is what a page uses):
    // what each slot holds is laid out but not drawn, so the slot keeps the size its contents
    // take (a ToggleButtonGroup's is its buttons' height, not a fixed box) and the chrome
    // hatches it (`catalogSlotMarks`). A slot the origin leaves empty (a Table's columns) has no
    // such size: it takes a box of its own. A root slot holding repeated items lays out **one of
    // each** (a ListBox's first item, a Toolbar's first button and its separator): the box is an
    // item's size, not the whole list's. **Why (2026-10-21)**: a GridList's and a CardView's
    // hatched box was the three stacked items' ~500px (user: 「slot 빗금 상자 높이」).
    const sampleId = originSampleId(origin.id);
    const slots = originSlots(graph, origin.id);
    // (A fit-content origin's slot takes a width of its own: a `%` of fit-content is nothing.)
    const SLOT_BOX = { width: set(wide ? "100%" : 160), minHeight: set(40) };
    const unfilled = (slot: (typeof slots)[number]) =>
      slot.contents.length === 0;
    const slotPatches = slots.flatMap((slot) => [
      ...(slot.path.length === 1 || !unfilled(slot)
        ? []
        : [
            {
              kind: "patch" as const,
              address: address([sampleId], slot.path),
              visual: SLOT_BOX,
            },
          ]),
      ...slot.contents.map((templatePath, index) => {
        const definitionOf = (path: LibraryTemplateId[]) =>
          code.templates.get(path[path.length - 1]!)?.definitionId;
        const repeat =
          slot.path.length === 1 &&
          slot.contents.findIndex(
            (other) => definitionOf(other) === definitionOf(templatePath),
          ) < index;
        return {
          kind: "patch" as const,
          address: address([sampleId], templatePath),
          ...(repeat ? { enabled: false } : { visual: { opacity: set(0) } }),
        };
      }),
    ]);
    // ADR-278: an overlay origin's body (its root's Modal · Popover · Tooltip child) is drawn
    // open beside the trigger — a display state at that position; the page's instances and the
    // page canvas keep it closed.
    const originRootId = (
      code.definitions.get(origin.id) as
        { templateRootId?: LibraryTemplateId } | undefined
    )?.templateRootId;
    const overlayId = OPEN_BODY_ORIGINS.has(origin.name)
      ? code.templates
          .get(originRootId!)
          ?.children.find((id) =>
            CLOSED_OVERLAY_TYPES.has(
              code.templates.get(id as LibraryTemplateId)?.definitionId ?? "",
            ),
          )
      : undefined;
    // (ADR-282: an unlocked origin's ◆ is its copy's root — `drawCopy`; its instances follow.)
    const forkRoot = forks.get(origin.id)?.templateRootId;
    const samplePatches = [
      ...slotPatches,
      ...(originRootId && overlayId
        ? [
            {
              kind: "patch" as const,
              address: address(
                [sampleId],
                [originRootId, overlayId as LibraryTemplateId],
              ),
              displayState: "open" as const,
            },
          ]
        : []),
    ];
    entries.set(sampleId, () => {
      const override = catalogOriginOverride(graph, origin.id);
      return node(sampleId, origin.id, {
        name: catalogDefinitionTitle(graph, origin.id),
        props: override?.defaults ?? {},
        visual: override?.visual ?? {},
        ...(samplePatches.length > 0
          ? { descendantOverrides: samplePatches }
          : {}),
      });
    });
    /** An instance of the origin (or of one of its state variants) over its caption. */
    const instance = (
      key: string,
      label: string,
      definitionId: LibraryDefinitionId,
      props: NodeEntry["props"],
    ): PageCell => ({
      sample: fixed(
        node(originInstanceId(origin.id, key), definitionId, {
          name: `${origin.name} / ${key
            .split("/")
            .map(titleCase)
            .join(" / ")}`,
          props,
        }),
      ),
      captions: [caption(base("caption", key), `${INSTANCE_MARK} ${label}`)],
    });
    /** The instances of one variant's line: at rest, then each state. */
    const stateCells = (variant: string | undefined) => {
      const key = variant ?? "default";
      const props: NodeEntry["props"] =
        variant === undefined ? {} : { variant: set(variant) };
      return [
        instance(`${key}/default`, "Default", origin.id, props),
        ...facets.states.map((state) =>
          instance(`${key}/${state.name}`, state.name, state.id, props),
        ),
      ];
    };
    // The origin (its slots empty) and, where a slot holds something, an instance of it beside
    // it: the component as a page uses it.
    const filled =
      !ORIGIN_ONLY_CARDS.has(origin.name) &&
      slots.some((slot) => !unfilled(slot));
    // ADR-278 (user decision 2): the open body stands right of the trigger — a line of its own
    // (the trigger node draws no box of its own, `display: contents`). The frame is layout only
    // (not a Layers row on a derived page).
    const bodyLine = overlayId
      ? frame(base("origin", "body-line"), "Body line", [sampleId], {
          flexDirection: "row",
          gap: 12,
          alignItems: "flex-start",
        })
      : undefined;
    const originCells: PageCell[] = [
      {
        sample: bodyLine ?? sampleId,
        captions: [
          caption(base("caption", "origin"), `${ORIGIN_MARK} ${origin.name}`),
        ],
      },
      ...(filled ? [instance("instance", origin.name, origin.id, {})] : []),
    ];
    // The card's other lines (variants, states, items, types) — the Origin line goes first.
    const lines: NodeId[] = [];
    const items = originItems(graph, origin.id, stateIds);
    if (items) {
      // A collection: the states are its item origin's (the collection's own variant only tints
      // its hover) — the item at rest and in each state, drawn on its own so its display state
      // shows (inside the collection the collection's selection decides).
      const states = [items.origin, ...(stateIds.get(items.origin) ?? [])];
      // The item origin itself first (◆ — its editable sample, as a card's origin: its props and
      // styles are the project's override of the item origin; user 2026-10-13 「Item 줄 맨 앞에 ◆
      // 원본 칸」), its parts filled in as the instances beside it — unless it has a card of its
      // own (a ButtonGroup's Button, a Breadcrumbs' Link): a sample stands in one place.
      const itemSampleId = originSampleId(items.origin);
      const itemTitle = catalogDefinitionTitle(graph, items.origin);
      const itemOriginCell = !cardOrigins.has(items.origin);
      // (An unlocked item origin's ◆ is its copy's root, as a card's origin — ADR-282.)
      const itemFork = forks.get(items.origin)?.templateRootId;
      // (Its parts read its holder's props: the copy root shows the sample's 「Item」 and leaves
      // the other placeholders empty — their `presentWhen` drops them, as the sample's patches.)
      if (itemOriginCell) {
        const shown: Record<string, string> = {};
        for (const part of items.parts)
          for (const [key, value] of Object.entries(
            code.templates.get(part.path.at(-1)!)?.props ?? {},
          )) {
            const bound =
              key !== "href" && typeof value === "string"
                ? /^\{(\w+)\}$/.exec(value)?.[1]
                : undefined;
            if (bound)
              shown[bound] = part.label && key === "children" ? "Item" : "";
          }
        display.set(items.origin, shown);
      }
      if (itemOriginCell)
        entries.set(itemSampleId, () => {
          const override = catalogOriginOverride(graph, items.origin);
          return node(itemSampleId, items.origin, {
            name: itemTitle,
            props: override?.defaults ?? {},
            visual: override?.visual ?? {},
            descendantOverrides: items.parts.map((item) => ({
              kind: "patch" as const,
              address: address([itemSampleId], item.path),
              ...(item.label
                ? { props: { children: set("Item") } }
                : { enabled: false }),
            })),
          });
        });
      lines.push(
        ...line(base("line", "items"), "Item", [
          ...(itemOriginCell
            ? [
                {
                  sample: itemSampleId,
                  captions: [
                    caption(
                      base("caption", "item-origin"),
                      // (Its type — the origin's own name carries its state: `ListBoxItem/Selected`.)
                      `${ORIGIN_MARK} ${itemTitle.split("/")[0]}`,
                    ),
                  ],
                },
              ]
            : []),
          ...states.map((stateId): PageCell => {
            const title = catalogDefinitionTitle(graph, stateId);
            const label = title
              .slice(title.indexOf("/") + 1)
              .replace(/\//g, " / ");
            const id = originInstanceId(origin.id, `item/${label}`);
            const stateRoot = code.definitions.get(stateId);
            // A state variant's template root is the nested instance the patch goes through.
            const instances = [
              id,
              ...(stateId !== items.origin &&
              stateRoot &&
              "templateRootId" in stateRoot &&
              stateRoot.templateRootId
                ? [stateRoot.templateRootId]
                : []),
            ];
            return {
              sample: fixed(
                node(id, stateId, {
                  name: `${origin.name} / Item / ${label}`,
                  descendantOverrides: items.parts.map((item) => ({
                    kind: "patch" as const,
                    address: address(instances, item.path),
                    ...(item.label
                      ? { props: { children: set("Item") } }
                      : { enabled: false }),
                  })),
                }),
              ),
              captions: [
                caption(base("caption", "item", label), `${INSTANCE_MARK} ${label}`),
              ],
            };
          }),
        ]),
      );
      // (Read on each read, as the card's Origin line — ADR-282.)
      if (itemOriginCell && itemFork)
        drawCopy(base("line", "items", "1"), itemSampleId, itemFork);
    } else if (facets.states.length > 0 && facets.variants.length > 1) {
      // Variants × states: a line per variant.
      for (const variant of facets.variants)
        lines.push(
          ...line(base("line", variant), titleCase(variant), stateCells(variant), {
            track: cellWidth,
          }),
        );
    } else if (
      facets.variants.length > 1 &&
      !NO_VARIANTS_LINE.has(origin.name)
    ) {
      // No states: the variants side by side.
      lines.push(
        ...line(
          base("line", "variants"),
          "Variants",
          facets.variants.map((variant) =>
            instance(variant, titleCase(variant), origin.id, {
              variant: set(variant),
            }),
          ),
          { track: cellWidth },
        ),
      );
    } else if (facets.states.length > 0) {
      lines.push(
        ...line(base("line", "states"), "States", stateCells(undefined), {
          track: cellWidth,
        }),
      );
    }
    // The palette's creation variants of the origin (a Chart's chart types — user 2026-10-06):
    // an instance of each, with the props the palette creates it with, two to a line.
    if (origin.kinds && origin.kinds.length > 1) {
      const width = (LINE_WIDTH - CELL_GAP) / 2;
      lines.push(
        ...line(
          base("line", "types"),
          "Types",
          origin.kinds.map((kind) => ({
            sample: fixed(
              node(originInstanceId(origin.id, `type/${kind.key}`), origin.id, {
                name: `${origin.name} / ${kind.label}`,
                props: catalogCreationProps(
                  library,
                  origin.id,
                  origin.name,
                  kind.initialProps,
                ),
                ...catalogCreationStyle({ style: { width } }),
              }),
            ),
            captions: [
              caption(
                base("caption", "type", kind.key),
                `${INSTANCE_MARK} ${kind.label}`,
              ),
            ],
          })),
          { track: width },
        ),
      );
    }
    // A card of the Origin line alone holds its cells itself — no line name, no line frame
    // (user 2026-10-25 「Origin 하나뿐인 카드만, 그룹까지 제거」): the card draws the ◆ after its
    // title (`registerDrawnOrigins`). Otherwise the Origin line is the first line, its first grid
    // the ◆ holder.
    const alone = lines.length === 0;
    const holder = bodyLine ?? (alone ? base("card") : base("line", "origin", "1"));
    if (!alone)
      lines.unshift(
        ...line(base("line", "origin"), "Origin", originCells, {
          alignItems: "start",
          track: cellWidth,
        }),
      );
    // (A base part's card is titled as one: the Parts section closes the page — 2026-10-21.)
    card(
      base("card"),
      base("title"),
      origin.name,
      alone
        ? originCells.flatMap((cell) => [cell.sample, ...cell.captions])
        : lines,
      // (An unlocked origin's card says so — its template is the project's copy, ADR-282 R6.)
      `${origin.category === "parts" ? `${origin.name} · part` : origin.name}${forkRoot ? " · unlocked" : ""}`,
    );
    // (Read on each read: a reset — or an undo of the unlock — removes the copy before the page
    // is laid out again; the holder draws the sample until then, as a Local card's cell does.)
    if (forkRoot) drawCopy(holder, sampleId, forkRoot);
  });

  // Palette order, row by row.
  return finish(ORIGIN_VIEW_NODE);
}

/**
 * The project components page (user 2026-10-14): a numbered card per component made with Create
 * component, in the project's order — its origin node itself (◆ — ADR-260: the node stands on a
 * page; the card draws that very node, so selecting, editing and deleting it there is doing so to
 * the origin; no instance beside it — user 2026-10-14 「origin 만 있으면 된다」). An origin inside
 * another listed origin is drawn in that one's card only (a node is drawn once on a page — its
 * record identity is its node id).
 */
export function catalogProjectComponentsPageEntries(
  graph: CatalogGraph,
  mode: "light" | "dark" = "light",
): Map<NodeId, () => NodeEntry> {
  const { MUTED_COLOR, entries, text, card, finish } = pageKit(graph, mode);
  const components = catalogProjectComponents(graph);
  for (const component of components) {
    const base = (...path: string[]) =>
      `${projectComponentCardId(component.id).slice(0, -"/card".length)}/${path.join("/")}` as NodeId;
    // The origin's cell: the template root itself (ADR-279 — the definition owns it; edited
    // here), under the card's title only (user 2026-10-14 — no "Origin" line label, no
    // caption). Read on each read: a dissolved component leaves the cell empty until the page
    // is laid out again.
    const originCell = projectComponentOriginCellId(component.id);
    entries.set(originCell, () =>
      node(originCell, FRAME, {
        name: component.name,
        children: graph.getEntry(component.rootId) ? [component.rootId] : [],
        ...catalogCreationStyle({
          style: {
            display: "flex",
            flexDirection: "column",
            width: LINE_WIDTH,
            flexShrink: 0,
          },
        }),
      }),
    );
    card(
      projectComponentCardId(component.id),
      base("title"),
      component.name,
      [originCell],
    );
  }
  // An empty page says what fills it.
  if (components.length === 0)
    card(
      `${PROJECT_ORIGIN_VIEW_NODE}/empty/card` as NodeId,
      `${PROJECT_ORIGIN_VIEW_NODE}/empty/title` as NodeId,
      "No components",
      [
        text(
          `${PROJECT_ORIGIN_VIEW_NODE}/empty/text` as NodeId,
          "Select a node and choose Create component.",
          { fontSize: 12, color: MUTED_COLOR },
        ),
      ],
    );
  return finish(PROJECT_ORIGIN_VIEW_NODE);
}

/**
 * The project's components the project components page lists (project order): every component —
 * its origin on a page, or deleted (its definition keeps it, hidden — Restore origin on an
 * instance brings it back): the page is where a deleted origin is found (user 2026-10-14).
 */
export function catalogProjectComponents(
  graph: CatalogReader,
): { id: EntryId<"definition">; name: string; rootId: NodeId }[] {
  const project = graph.getEntry(graph.projectId);
  if (project?.kind !== "project") return [];
  return project.definitionIds.flatMap((id) => {
    const definition = graph.getEntry(id);
    return definition?.kind === "definition" &&
      definition.usage !== "layout" &&
      definition.templateRootId &&
      graph.getEntry(definition.templateRootId)
      ? [
          {
            id: definition.id,
            name: definition.name,
            rootId: definition.templateRootId,
          },
        ]
      : [];
  });
}

/**
 * ADR-279 Decision 3 · 6: the Local page cards' scene boxes for the Canvas header layer — each
 * card gets a header (the component's name: double-click renames, × deletes the component) as a
 * page frame does. Empty unless the Local page is drawn.
 */
export function catalogProjectComponentCardFrames(
  graph: CatalogReader,
  root: {
    recordsOfSource(id: string): readonly string[];
    domInputs: ReadonlyMap<string, { parentId?: string }>;
    getGeometry(
      ids: Iterable<string>,
    ): ReadonlyMap<
      string,
      { x: number; y: number; width: number; height: number }
    >;
  },
): {
  id: EntryId<"definition">;
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
}[] {
  if (!graph.getEntry(PROJECT_ORIGIN_VIEW_NODE)) return [];
  const frames: ReturnType<typeof catalogProjectComponentCardFrames> = [];
  for (const component of catalogProjectComponents(graph)) {
    const cardId = projectComponentCardId(component.id);
    const stored = componentPageNodeId(cardId);
    const [record] = root.recordsOfSource(
      graph.getEntry(stored) ? stored : cardId,
    );
    if (!record) continue;
    // Geometry is parent-relative: the card's scene box sums its ancestors' (column · page root).
    const chain: string[] = [];
    for (
      let at: string | undefined = record;
      at && at !== "catalog:root";
      at = root.domInputs.get(at)?.parentId
    )
      chain.push(at);
    const boxes = root.getGeometry(chain);
    const box = boxes.get(record);
    if (!box) continue;
    let x = 0;
    let y = 0;
    for (const id of chain) {
      const ancestor = boxes.get(id);
      if (!ancestor) continue;
      x += ancestor.x;
      y += ancestor.y;
    }
    frames.push({
      id: component.id,
      title: component.name,
      x,
      y,
      width: box.width,
      height: box.height,
    });
  }
  return frames;
}

/** The page's card ids (the body's children), in drawn order. */
export function catalogComponentsPageCards(
  graph: CatalogGraph,
  view: CatalogComponentsViewId = COMPONENTS_VIEW,
): NodeId[] {
  const root = graph.getEntry(componentsViewRoot(view));
  return root?.kind === "node" ? [...root.children] : [];
}

/** ADR-282 Phase 3: the document page a Components tab page is stored as. */
export const catalogComponentPageId = (
  view: CatalogComponentsViewId,
): EntryId<"page"> =>
  isProjectComponentsView(view) ? LOCAL_COMPONENT_PAGE : LIBRARY_COMPONENT_PAGE;

/** Whether the project stores this Components tab page (made the first time it opened). */
export function catalogComponentPageStored(
  graph: CatalogReader,
  view: CatalogComponentsViewId,
): boolean {
  const project = graph.getEntry(graph.projectId);
  const pageId = catalogComponentPageId(view);
  return (
    project?.kind === "project" &&
    !!project.componentPageIds?.includes(pageId) &&
    graph.getEntry(pageId)?.kind === "page"
  );
}

/**
 * ADR-282 Phase 3 (user 2026-10-25 「library-body = home-body」): the page as document entries,
 * made the first time the tab opens it — its derived entries stored under short document ids
 * (`componentPageNodeId`), the ◆ cells holding a reference to their origin
 * (`NodeEntry.originOf` — the origin's sample or template root is the view's, drawn first), the
 * samples left to the view. One step, no history entry (the caller runs it on open).
 */
export function catalogComponentPageCreation(
  graph: CatalogGraph,
  view: CatalogComponentsViewId,
  mode?: "light" | "dark",
): CatalogCommand {
  return (reader) => {
    const project = reader.getEntry(reader.projectId);
    if (project?.kind !== "project") throw new Error("PROJECT_ROOT_REQUIRED");
    const pageId = catalogComponentPageId(view);
    const entries = isProjectComponentsView(view)
      ? catalogProjectComponentsPageEntries(graph, mode)
      : catalogComponentsPageEntries(graph, mode);
    const ops: CatalogOperation[] = storedPageNodes(reader, entries).map(
      (entry) => ({ kind: "put", entry }),
    );
    ops.push(
      {
        kind: "put",
        entry: {
          kind: "page",
          id: pageId,
          route: isProjectComponentsView(view) ? "/local" : "/library",
          name: isProjectComponentsView(view) ? "Local" : "Library",
          children: [componentsViewRoot(view)],
        },
      },
      {
        kind: "put",
        entry: {
          ...project,
          componentPageIds: [...(project.componentPageIds ?? []), pageId],
        },
      },
    );
    return { label: "Create components page", ops };
  };
}

/**
 * A page's derived entries as document nodes (`include`: the view ids to take — all but the
 * samples by default): ids under `componentPageNodeId`, each ◆ cell's first child — a library
 * origin's sample, or a template root a definition · override owns — kept as `originOf`.
 */
function storedPageNodes(
  reader: CatalogReader,
  entries: ReadonlyMap<NodeId, () => NodeEntry>,
  include: (viewId: NodeId) => boolean = () => true,
): NodeEntry[] {
  const stored = (id: string) => componentPageNodeId(id);
  const address = (value: InstanceAddress): InstanceAddress => ({
    instances: value.instances.map(stored) as InstanceAddress["instances"],
    templatePath: value.templatePath,
  });
  const nodes: NodeEntry[] = [];
  const taken = new Map<string, string>();
  for (const [id, compute] of entries) {
    if (originOfSample(id) || !include(id)) continue;
    // (Two view ids under one hash would make one node of two.)
    const other = taken.get(stored(id));
    if (other !== undefined && other !== id)
      throw new Error(`COMPONENT_PAGE_ID_COLLISION:${other}:${id}`);
    taken.set(stored(id), id);
    const entry = compute();
    let originOf: DefinitionId | undefined;
    const children = entry.children.filter((child) => {
      const origin =
        originOfSample(child) ??
        (child.startsWith(ORIGIN_VIEW_NODE)
          ? undefined
          : reader.definitionOfTemplateRoot(child));
      if (!origin) return true;
      originOf = origin;
      return false;
    });
    nodes.push({
      ...entry,
      id: stored(entry.id),
      children: children.map(stored),
      descendantOverrides: entry.descendantOverrides.map((override) =>
        override.kind === "patch"
          ? { ...override, address: address(override.address) }
          : override.kind === "fillSlot"
            ? {
                ...override,
                address: address(override.address),
                childIds: override.childIds.map(stored),
              }
            : {
                ...override,
                address: address(override.address),
                replacementId: stored(override.replacementId),
              },
      ),
      ...(originOf ? { originOf } : {}),
    } as NodeEntry);
  }
  return nodes;
}

/**
 * ADR-282 Phase 3 — the stored Local page follows the project's components: a card for each
 * component it has none for (after the body's last card), none for a component that is gone (its
 * ◆ cell drew nothing). Its other content — moved cards, edited frames — stays the user's.
 * `undefined` = nothing to do. The caller runs it as a step the project takes (no history).
 */
export function catalogLocalPageSync(
  graph: CatalogGraph,
  mode?: "light" | "dark",
): CatalogCommand | undefined {
  const root = graph.storedEntry(PROJECT_ORIGIN_VIEW_NODE);
  if (root?.kind !== "node") return undefined;
  const subtree = (id: string): string[] => {
    const entry = graph.storedEntry(id);
    return entry?.kind === "node"
      ? [id, ...entry.children.flatMap(subtree)]
      : [id];
  };
  // The components the page has a card for: its ◆ cells' origins.
  const cells = new Map<string, NodeId>();
  for (const id of subtree(PROJECT_ORIGIN_VIEW_NODE)) {
    const entry = graph.storedEntry(id);
    if (entry?.kind === "node" && entry.originOf)
      cells.set(entry.originOf, entry.id);
  }
  const wanted = new Set(
    catalogProjectComponents(graph).map((item) => item.id),
  );
  const gone = [...cells].filter(([origin]) => !wanted.has(origin as never));
  const added = [...wanted].filter((id) => !cells.has(id));
  const empty = componentPageNodeId(`${PROJECT_ORIGIN_VIEW_NODE}/empty/card`);
  const emptyGone = added.length > 0 && !!graph.storedEntry(empty);
  const entries = catalogProjectComponentsPageEntries(graph, mode);
  // A card's title follows its component's name (a rename) while it is still the page's own
  // `NN. NAME` — a title the user wrote stays.
  const titles: NodeEntry[] = [];
  for (const [origin] of cells) {
    if (!wanted.has(origin as never)) continue;
    const viewId =
      `${projectComponentCardId(origin).slice(0, -"/card".length)}/title` as NodeId;
    const stored = graph.storedEntry(componentPageNodeId(viewId));
    const fresh = entries.get(viewId)?.();
    if (stored?.kind !== "node" || !fresh) continue;
    const text = (entry: NodeEntry) => {
      const value = entry.props.children;
      return value && typeof value === "object" && "value" in value
        ? String(value.value)
        : undefined;
    };
    const was = text(stored);
    if (was && /^\d{2}\. /.test(was) && was !== text(fresh))
      titles.push({
        ...stored,
        props: { ...stored.props, children: fresh.props.children! },
      });
  }
  if (!gone.length && !added.length && !emptyGone && !titles.length)
    return undefined;
  return (reader) => {
    const ops: CatalogOperation[] = [];
    const parents = new Map<string, NodeEntry>();
    const parentOf = (id: string) => {
      const owner = reader.ownerOf(id);
      const entry = owner
        ? (parents.get(owner) ?? reader.getEntry(owner))
        : undefined;
      return entry?.kind === "node" ? entry : undefined;
    };
    const removeCard = (cardId: string) => {
      const parent = parentOf(cardId);
      if (parent)
        parents.set(parent.id, {
          ...parent,
          children: parent.children.filter((child) => child !== cardId),
        });
      for (const id of subtree(cardId))
        ops.push({ kind: "remove", id: id as NodeId });
    };
    for (const [, cell] of gone) {
      const card = reader.ownerOf(cell);
      if (card) removeCard(card);
    }
    if (emptyGone) removeCard(empty);
    for (const title of titles) ops.push({ kind: "put", entry: title });
    if (added.length) {
      const cardIds = new Set(
        added.map((id) => projectComponentCardId(id) as string),
      );
      const inCard = (id: NodeId) =>
        [...cardIds].some(
          (card) => id === card || id.startsWith(card.slice(0, -"card".length)),
        );
      for (const entry of storedPageNodes(reader, entries, inCard))
        ops.push({ kind: "put", entry });
      // After the body's last card.
      const body = parents.get(root.id) ?? root;
      parents.set(root.id, {
        ...body,
        children: [
          ...body.children,
          ...added.map((id) => componentPageNodeId(projectComponentCardId(id))),
        ],
      });
    }
    for (const entry of parents.values()) ops.push({ kind: "put", entry });
    return { label: "Sync components page", ops };
  };
}

/** The ◆ cells whose drawn origin the view registers (per graph — cleared with the view). */
const drawnCells = new WeakMap<CatalogGraph, Set<NodeId>>();
/**
 * ADR-282 Phase 3: a stored page's ◆ cells draw their origin first — an unlocked or project
 * origin's template root (its owner's), else a library origin's sample (a view entry).
 */
function registerDrawnOrigins(graph: CatalogGraph, pageId: EntryId<"page">) {
  const cells = drawnCells.get(graph) ?? new Set<NodeId>();
  drawnCells.set(graph, cells);
  for (const id of componentPageMembers(
    (entryId) => graph.storedEntry(entryId),
    graph.projectId,
  )) {
    const entry = graph.storedEntry(id);
    if (entry?.kind !== "node" || !entry.originOf) continue;
    const origin = entry.originOf;
    if (!componentPageOwns(graph, pageId, id)) continue;
    cells.add(entry.id);
    // (A card that holds its ◆ draws it after its title — user 2026-10-25.)
    graph.setViewChildren(entry.id, isPageCard(entry.id) ? 1 : 0, () => {
      const owner = origin.startsWith("lib:")
        ? catalogOriginOverride(graph, origin as LibraryDefinitionId)
        : graph.getEntry(origin);
      const root =
        owner?.kind === "definition" || owner?.kind === "definitionOverride"
          ? owner.templateRootId
          : undefined;
      if (root && graph.storedEntry(root)) return [root];
      const sample = originSampleId(origin as LibraryDefinitionId);
      return origin.startsWith("lib:") && graph.isViewEntry(sample)
        ? [sample]
        : [];
    });
  }
}
/** Whether a stored node is under a component page (its owner chain reaches `pageId`). */
function componentPageOwns(
  graph: CatalogGraph,
  pageId: string,
  id: string,
): boolean {
  for (
    let cursor: string | undefined = id;
    cursor;
    cursor = graph.ownerOf(cursor)
  )
    if (cursor === pageId) return true;
  return false;
}

/**
 * Show a components page — the built-in origins' (`COMPONENTS_VIEW`) or the project's components
 * (`PROJECT_COMPONENTS_VIEW`) — or stop showing one (`undefined`). A page the project stores
 * (ADR-282 Phase 3) is the document's: the view adds only its samples and the origins its ◆
 * cells draw. Otherwise the page is derived view entries.
 */
export function setCatalogComponentsView(
  graph: CatalogGraph,
  view: CatalogComponentsViewId | undefined,
  mode?: "light" | "dark",
): void {
  for (const id of graph.viewEntryIds())
    if (id.startsWith(ORIGIN_VIEW_NODE))
      graph.setViewEntry(id as NodeId, undefined);
  for (const id of drawnCells.get(graph) ?? [])
    graph.setViewChildren(id, 0);
  drawnCells.delete(graph);
  const display = new Map<string, Readonly<Record<string, string>>>();
  graph.setOriginDisplayBindings(display);
  if (!view) return;
  const stored = catalogComponentPageStored(graph, view);
  for (const [id, compute] of isProjectComponentsView(view)
    ? catalogProjectComponentsPageEntries(graph, mode)
    : catalogComponentsPageEntries(graph, mode, display))
    if (!stored || originOfSample(id)) graph.setViewEntry(id, compute);
  if (stored) registerDrawnOrigins(graph, catalogComponentPageId(view));
}

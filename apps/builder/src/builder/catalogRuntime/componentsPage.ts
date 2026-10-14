import {
  getIconData,
  lightColors,
  resolveToken,
  spacing,
  typography,
} from "@composition/rendering";
import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import type {
  CatalogReader,
  EntryId,
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
  originSampleId,
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
const COLUMNS = 6;
const COLUMN_WIDTH = 560;
const GAP = 24;
const PAGE_PADDING = 32;
const CARD_PADDING = 24;
export const COMPONENTS_PAGE_WIDTH =
  COLUMN_WIDTH * COLUMNS + GAP * (COLUMNS - 1) + PAGE_PADDING * 2;
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
  const library = graph.library;
  const origin = library.definitions.get(originId);
  const root =
    origin && "templateRootId" in origin && origin.templateRootId
      ? library.templates.get(origin.templateRootId)
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
 * the root or one container down (a TabList's tabs) — and that item's parts to fill in when it
 * is drawn alone (`label`: its text; the others hold a `{placeholder}` and are switched off).
 * `undefined` = not a collection (or a picker: its items are drawn in a popup).
 */
function originItems(
  graph: CatalogGraph,
  originId: LibraryDefinitionId,
  stateIds: ReadonlyMap<string, readonly LibraryDefinitionId[]>,
) {
  const library = graph.library;
  const templateOf = (definitionId: string | undefined) => {
    const definition = definitionId
      ? library.definitions.get(definitionId as LibraryDefinitionId)
      : undefined;
    const rootId =
      definition && "templateRootId" in definition
        ? definition.templateRootId
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
  const origin = [
    ...children,
    ...children.flatMap((child) =>
      (child?.children ?? []).map((id) =>
        library.templates.get(id as LibraryTemplateId),
      ),
    ),
  ].find((child) => child && stateIds.has(child.definitionId))?.definitionId as
    LibraryDefinitionId | undefined;
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
  const library = graph.library;
  const origin = library.definitions.get(originId);
  const rootId =
    origin && "templateRootId" in origin ? origin.templateRootId : undefined;
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

/** The Layers rows read so far, by the page's root entry (a new one each time the page is laid out). */
const pageRows = new WeakMap<object, Map<string, CatalogPosition[]>>();
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
  let known = rows.get(position.identity);
  if (!known) {
    const read = readPageRows(reader, position);
    if (!read) return undefined;
    rows.set(position.identity, (known = read));
  }
  return known;
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
  // The project components page: its origins themselves (a card holds one — the row deletes it).
  if (id === PROJECT_ORIGIN_VIEW_NODE) {
    walk(
      position,
      (nodeId) =>
        nodeId.startsWith("project:node:") &&
        !nodeId.startsWith(ORIGIN_VIEW_NODE) &&
        reader.definitionOfTemplateRoot(nodeId as NodeId) !== undefined,
    );
    return found;
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
  // A card: the origin and its instances (a theme card: its values), side by side.
  walk(
    position,
    (nodeId) =>
      originOfEditableSample(nodeId) !== undefined ||
      originOfPageInstance(nodeId) !== undefined ||
      isThemeSample(nodeId),
  );
  return found;
}

/**
 * The page's entries by id (`ORIGIN_VIEW_NODE` = its root); each is computed on read. `heights`
 * = the cards' drawn heights (by card id): the columns are balanced by them instead of the
 * estimate (the workspace measures the first layout, then lays the page out again).
 */
/**
 * The drawing kit of a derived components page: its entries (each computed on read), the theme
 * colors, and the frames a page is made of — captioned cells, named lines, numbered cards.
 */
function pageKit(
  graph: CatalogGraph,
  heights: ReadonlyMap<string, number> | undefined,
  mode: "light" | "dark",
) {
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
  /** A sample over its caption (`width`: a fixed cell the sample may fill). */
  const cell = (
    id: NodeId,
    caption: string,
    sampleId: NodeId,
    width?: number,
  ) =>
    frame(
      id,
      caption,
      [
        sampleId,
        text(`${id}/caption` as NodeId, caption, {
          fontSize: 11,
          color: MUTED_COLOR,
        }),
      ],
      {
        flexDirection: "column",
        gap: 6,
        ...(width ? { width, flexShrink: 0 } : { alignItems: "flex-start" }),
      },
    );
  /** A named line of cells. */
  const row = (id: NodeId, name: string, cells: NodeId[]) =>
    frame(
      id,
      name,
      [
        text(`${id}/label` as NodeId, name, { fontSize: 12, fontWeight: 600 }),
        frame(`${id}/cells` as NodeId, "Samples", cells, {
          flexDirection: "row",
          flexWrap: "wrap",
          alignItems: "flex-end",
          gap: 16,
        }),
      ],
      { flexDirection: "column", gap: 10 },
    );

  const cards: { id: NodeId; weight: number }[] = [];
  /** A numbered card (numbered in the order the cards are made). */
  const card = (
    cardId: NodeId,
    titleId: NodeId,
    name: string,
    rows: NodeId[],
    weight: number,
  ) => {
    const title = text(
      titleId,
      `${String(cards.length + 1).padStart(2, "0")}. ${name.toUpperCase()}`,
      { fontSize: 12, fontWeight: 700 },
    );
    cards.push({
      id: frame(cardId, name, [title, ...rows], {
        flexDirection: "column",
        gap: 20,
        padding: CARD_PADDING,
        backgroundColor: color("base"),
        borderRadius: 12,
      }),
      weight: heights?.get(cardId) ?? weight,
    });
  };

  /**
   * Lay the cards down the columns (each next card on the lightest one) under the root frame — a
   * body, named by its type in Layers as a page's body is (user 2026-10-14).
   */
  const finish = (rootId: NodeId) => {
    const columns = Array.from({ length: COLUMNS }, () => ({
      cards: [] as NodeId[],
      weight: 0,
    }));
    for (const card of cards) {
      const column = columns.reduce((lightest, candidate) =>
        candidate.weight < lightest.weight ? candidate : lightest,
      );
      column.cards.push(card.id);
      column.weight += card.weight + GAP;
    }
    fixed(
      node(rootId, "lib:definition:type-body", {
        children: columns.map((column, index) =>
          frame(
            `${rootId}/column/${index + 1}` as NodeId,
            `Column ${index + 1}`,
            column.cards,
            {
              flexDirection: "column",
              gap: GAP,
              width: COLUMN_WIDTH,
              flexShrink: 0,
            },
          ),
        ),
        ...catalogCreationStyle({
          style: {
            display: "flex",
            flexDirection: "row",
            alignItems: "flex-start",
            gap: GAP,
            padding: PAGE_PADDING,
            width: COMPONENTS_PAGE_WIDTH,
            backgroundColor: color("neutral-subtle"),
            // The view's root container is the viewport wide: keep the page its own width.
            flexShrink: 0,
          },
        }),
      }),
    );
    return entries;
  };
  return { library, color, MUTED_COLOR, entries, fixed, text, frame, cell, row, card, finish };
}

export function catalogComponentsPageEntries(
  graph: CatalogGraph,
  heights?: ReadonlyMap<string, number>,
  mode: "light" | "dark" = "light",
): Map<NodeId, () => NodeEntry> {
  const { library, color, MUTED_COLOR, entries, fixed, text, frame, cell, row, card, finish } =
    pageKit(graph, heights, mode);
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
  const captioned = (id: NodeId, sampleId: NodeId, ...lines: string[]) =>
    frame(
      id,
      lines[0]!,
      [
        sampleId,
        ...lines.map((line, at) =>
          text(`${id}/caption/${at}` as NodeId, line, {
            fontSize: at === 0 ? 11 : 10,
            ...(at === 0 ? {} : { color: MUTED_COLOR }),
          }),
        ),
      ],
      { flexDirection: "column", gap: 4, alignItems: "flex-start" },
    );
  // Each theme card follows the component cards: the base value as its origin (◆), the values
  // derived from it as instances (◇) — a grouping for reading, not a document relation.
  const origins = (key: string, cells: NodeId[]) =>
    row(theme(key, "row", "origin"), "Origin", cells);
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
    const swatch = (name: string, mark: string, caption = name) =>
      captioned(
        theme("colors", name),
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
        `${mark} ${caption}`,
        color(name),
      );
    card(
      theme("colors", "card"),
      theme("colors", "title"),
      "Colors",
      [
        origins(
          "colors",
          heads.map((name) => swatch(name, ORIGIN_MARK)),
        ),
        ...[...groups].map(([group, list]) =>
          row(
            theme("colors", "row", group),
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
      ],
      60 + (groups.size + 1) * 110,
    );
  }
  {
    const sizes = Object.entries(typography)
      .filter(([name]) => !name.includes("--"))
      .sort((a, b) => Number(b[1]) - Number(a[1]));
    const lineHeights = typography as unknown as Record<string, number>;
    const sample = ([name, size]: [string, unknown], mark: string) =>
      captioned(
        theme("typography", name),
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
    card(
      theme("typography", "card"),
      theme("typography", "title"),
      "Typography",
      [
        origins("typography", [sample(base, ORIGIN_MARK)]),
        frame(
          theme("typography", "row", "sizes"),
          "Sizes",
          [
            text(theme("typography", "row", "sizes", "label"), "Sizes", {
              fontSize: 12,
              fontWeight: 600,
            }),
            ...sizes
              .filter((entry) => entry !== base)
              .map((entry) => sample(entry, INSTANCE_MARK)),
          ],
          { flexDirection: "column", gap: 14 },
        ),
      ],
      120 + sizes.reduce((sum, [, size]) => sum + Number(size) * 1.4 + 34, 0),
    );
  }
  {
    const icon = (name: string, mark: string, iconName = name) =>
      captioned(
        theme("icons", name),
        fixed(
          node(themeSampleId("icons", name), ICON, {
            name,
            props: { iconName: set(iconName) },
          }),
        ),
        `${mark} ${name}`,
      );
    const icons = SAMPLE_ICONS.filter((name) => getIconData(name));
    card(
      theme("icons", "card"),
      theme("icons", "title"),
      "Icons",
      [
        origins("icons", [icon("Icon", ORIGIN_MARK, "star")]),
        row(
          theme("icons", "row", "instances"),
          "Instances",
          icons.map((name) => icon(name, INSTANCE_MARK)),
        ),
      ],
      150 + Math.ceil(icons.length / 7) * 60,
    );
  }
  {
    const box = ([name, size]: [string, unknown], mark: string) =>
      captioned(
        theme("spacing", name),
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
    card(
      theme("spacing", "card"),
      theme("spacing", "title"),
      "Spacing",
      [
        origins("spacing", [box(base, ORIGIN_MARK)]),
        row(
          theme("spacing", "row", "sizes"),
          "Sizes",
          steps
            .filter((step) => step !== base)
            .map((step) => box(step, INSTANCE_MARK)),
        ),
      ],
      250,
    );
  }

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
    // (IconButton, Checkbox) is as small as a leaf. A base part that fills its container (the
    // Input — ADR-253) takes the same cell: a `%` width of a fit-content cell is nothing.
    const wide =
      (facets.composed || origin.category === "parts") &&
      facets.states.length === 0 &&
      facets.fills;
    const cellWidth = wide
      ? (WIDER_CELL[origin.name] ?? COMPOSED_CELL_WIDTH)
      : undefined;
    // Estimated drawn height of a line of `count` cells (columns are balanced by it).
    const lineHeight = (count: number) => {
      const perLine = wide
        ? Math.max(
            1,
            Math.floor(
              (COLUMN_WIDTH - CARD_PADDING * 2) /
                ((WIDER_CELL[origin.name] ?? COMPOSED_CELL_WIDTH) + 16),
            ),
          )
        : 5;
      return Math.ceil(count / perLine) * (wide ? 220 : 64) + 30;
    };
    // The origin's own sample: its fields = the project's override (read on each read). Its
    // declared slots show empty (the pen.dev design-system page: a component's master shows its
    // slots hatched, the instance beside it what fills them — the instance is what a page uses):
    // what each slot holds is laid out but not drawn, so the slot keeps the size its contents
    // take (a ToggleButtonGroup's is its buttons' height, not a fixed box) and the chrome
    // hatches it (`catalogSlotMarks`). A slot the origin leaves empty (a Table's columns) has no
    // such size: it takes a box of its own.
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
              address: { instances: [sampleId], templatePath: slot.path },
              visual: SLOT_BOX,
            },
          ]),
      ...slot.contents.map((templatePath) => ({
        kind: "patch" as const,
        address: { instances: [sampleId], templatePath },
        visual: { opacity: set(0) },
      })),
    ]);
    entries.set(sampleId, () => {
      const override = catalogOriginOverride(graph, origin.id);
      return node(sampleId, origin.id, {
        name: catalogDefinitionTitle(graph, origin.id),
        props: override?.defaults ?? {},
        visual: override?.visual ?? {},
        ...(slotPatches.length > 0 ? { descendantOverrides: slotPatches } : {}),
      });
    });
    /** An instance of the origin (or of one of its state variants) in a captioned cell. */
    const instance = (
      key: string,
      caption: string,
      definitionId: LibraryDefinitionId,
      props: NodeEntry["props"],
    ) =>
      cell(
        base("cell", key),
        `${INSTANCE_MARK} ${caption}`,
        fixed(
          node(originInstanceId(origin.id, key), definitionId, {
            name: `${origin.name} / ${key
              .split("/")
              .map(titleCase)
              .join(" / ")}`,
            props,
          }),
        ),
        cellWidth,
      );
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
    const filled = slots.some((slot) => !unfilled(slot));
    const rows: NodeId[] = [
      row(base("row", "origin"), "Origin", [
        cell(
          base("cell", "origin"),
          `${ORIGIN_MARK} ${origin.name}`,
          sampleId,
          cellWidth,
        ),
        ...(filled ? [instance("instance", origin.name, origin.id, {})] : []),
      ]),
    ];
    let weight = 60 + lineHeight(filled ? 2 : 1);
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
      if (itemOriginCell) entries.set(itemSampleId, () => {
        const override = catalogOriginOverride(graph, items.origin);
        return node(itemSampleId, items.origin, {
          name: itemTitle,
          props: override?.defaults ?? {},
          visual: override?.visual ?? {},
          descendantOverrides: items.parts.map((item) => ({
            kind: "patch" as const,
            address: { instances: [itemSampleId], templatePath: item.path },
            ...(item.label
              ? { props: { children: set("Item") } }
              : { enabled: false }),
          })),
        });
      });
      rows.push(
        row(base("row", "items"), "Item", [
          ...(itemOriginCell
            ? [
                cell(
                  base("cell", "item-origin"),
                  // (Its type — the origin's own name carries its state: `ListBoxItem/Selected`.)
                  `${ORIGIN_MARK} ${itemTitle.split("/")[0]}`,
                  itemSampleId,
                ),
              ]
            : []),
          ...states.map((stateId) => {
            const title = catalogDefinitionTitle(graph, stateId);
            const caption = title
              .slice(title.indexOf("/") + 1)
              .replace(/\//g, " / ");
            const id = originInstanceId(origin.id, `item/${caption}`);
            const stateRoot = library.definitions.get(stateId);
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
            return cell(
              base("cell", "item", caption),
              `${INSTANCE_MARK} ${caption}`,
              fixed(
                node(id, stateId, {
                  name: `${origin.name} / Item / ${caption}`,
                  descendantOverrides: items.parts.map((item) => ({
                    kind: "patch" as const,
                    address: { instances, templatePath: item.path },
                    ...(item.label
                      ? { props: { children: set("Item") } }
                      : { enabled: false }),
                  })),
                }),
              ),
            );
          }),
        ]),
      );
      weight += lineHeight(states.length + (itemOriginCell ? 1 : 0));
    } else if (facets.states.length > 0 && facets.variants.length > 1) {
      // Variants × states: a line per variant.
      for (const variant of facets.variants)
        rows.push(
          row(base("row", variant), titleCase(variant), stateCells(variant)),
        );
      weight += facets.variants.length * lineHeight(1 + facets.states.length);
    } else if (facets.variants.length > 1) {
      // No states: the variants side by side.
      rows.push(
        row(
          base("row", "variants"),
          "Variants",
          facets.variants.map((variant) =>
            instance(variant, titleCase(variant), origin.id, {
              variant: set(variant),
            }),
          ),
        ),
      );
      weight += lineHeight(facets.variants.length);
    } else if (facets.states.length > 0) {
      rows.push(row(base("row", "states"), "States", stateCells(undefined)));
      weight += lineHeight(1 + facets.states.length);
    }
    // The palette's creation variants of the origin (a Chart's chart types — user 2026-10-06):
    // an instance of each, with the props the palette creates it with, two to a line.
    if (origin.kinds && origin.kinds.length > 1) {
      const width = (COLUMN_WIDTH - CARD_PADDING * 2 - 16) / 2;
      rows.push(
        row(
          base("row", "types"),
          "Types",
          origin.kinds.map((kind) =>
            cell(
              base("cell", "type", kind.key),
              `${INSTANCE_MARK} ${kind.label}`,
              fixed(
                node(
                  originInstanceId(origin.id, `type/${kind.key}`),
                  origin.id,
                  {
                    name: `${origin.name} / ${kind.label}`,
                    props: catalogCreationProps(
                      library,
                      origin.id,
                      origin.name,
                      kind.initialProps,
                    ),
                    ...catalogCreationStyle({ style: { width } }),
                  },
                ),
              ),
              width,
            ),
          ),
        ),
      );
      weight += Math.ceil(origin.kinds.length / 2) * 240 + 30;
    }
    card(base("card"), base("title"), origin.name, rows, weight);
  });

  // Palette order down the columns.
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
  heights?: ReadonlyMap<string, number>,
  mode: "light" | "dark" = "light",
): Map<NodeId, () => NodeEntry> {
  const { MUTED_COLOR, entries, text, card, finish } = pageKit(
    graph,
    heights,
    mode,
  );
  const components = catalogProjectComponents(graph);
  const roots = new Set<string>(components.map((item) => item.rootId));
  const insideOf = (rootId: NodeId): string | undefined => {
    for (let at = graph.ownerOf(rootId); at; at = graph.ownerOf(at))
      if (roots.has(at))
        return components.find((item) => item.rootId === at)?.name;
    return undefined;
  };
  const width = COLUMN_WIDTH - CARD_PADDING * 2;
  for (const component of components) {
    const base = (...path: string[]) =>
      `${projectComponentCardId(component.id).slice(0, -"/card".length)}/${path.join("/")}` as NodeId;
    const outer = insideOf(component.rootId);
    // The origin's cell: the node itself, under the card's title only (user 2026-10-14 — no
    // "Origin" line label, no caption). Read on each read: a deleted origin leaves the cell
    // empty until the page is laid out again. An origin inside another one is drawn in that
    // one's card: its own card says where it is.
    const originCell = projectComponentOriginCellId(component.id);
    const where = outer
      ? text(base("origin", "where"), `In ${outer}`, {
          fontSize: 11,
          color: MUTED_COLOR,
        })
      : undefined;
    entries.set(originCell, () =>
      node(originCell, FRAME, {
        name: component.name,
        children: where
          ? [where]
          : graph.getEntry(component.rootId)
            ? [component.rootId]
            : [],
        ...catalogCreationStyle({
          style: {
            display: "flex",
            flexDirection: "column",
            width,
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
      heights?.get(projectComponentCardId(component.id)) ?? 420,
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
      100,
    );
  return finish(PROJECT_ORIGIN_VIEW_NODE);
}

/**
 * The project's components the project components page lists (project order): those whose origin
 * stands on a page (or in a layout). A deleted origin's component is not listed — as Figma's
 * assets list only the main components on the canvas; its instances stay and restore it.
 */
export function catalogProjectComponents(
  graph: CatalogReader,
): { id: EntryId<"definition">; name: string; rootId: NodeId }[] {
  const project = graph.getEntry(graph.projectId);
  if (project?.kind !== "project") return [];
  const standsOnAPage = (rootId: string) => {
    let top = rootId;
    for (let at = graph.ownerOf(rootId); at; at = graph.ownerOf(at)) top = at;
    const holder = graph.getEntry(top);
    return (
      holder?.kind === "page" ||
      (holder?.kind === "definition" && holder.usage === "layout")
    );
  };
  return project.definitionIds.flatMap((id) => {
    const definition = graph.getEntry(id);
    return definition?.kind === "definition" &&
      definition.usage !== "layout" &&
      definition.originRef === true &&
      definition.templateRootId &&
      graph.getEntry(definition.templateRootId) &&
      standsOnAPage(definition.templateRootId)
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

/** The page's card ids (a column's children), in drawn order. */
export function catalogComponentsPageCards(
  graph: CatalogGraph,
  view: CatalogComponentsViewId = COMPONENTS_VIEW,
): NodeId[] {
  const root = graph.getEntry(componentsViewRoot(view));
  if (root?.kind !== "node") return [];
  return root.children.flatMap((columnId) => {
    const column = graph.getEntry(columnId);
    return column?.kind === "node" ? [...column.children] : [];
  });
}

/**
 * Show a derived components page in the graph's view entries — the built-in origins'
 * (`COMPONENTS_VIEW`) or the project's components (`PROJECT_COMPONENTS_VIEW`) — or stop showing
 * one (`undefined`). `heights`: see `catalogComponentsPageEntries`.
 */
export function setCatalogComponentsView(
  graph: CatalogGraph,
  view: CatalogComponentsViewId | undefined,
  heights?: ReadonlyMap<string, number>,
  mode?: "light" | "dark",
): void {
  for (const id of graph.viewEntryIds())
    if (id.startsWith(ORIGIN_VIEW_NODE))
      graph.setViewEntry(id as NodeId, undefined);
  if (!view) return;
  for (const [id, compute] of isProjectComponentsView(view)
    ? catalogProjectComponentsPageEntries(graph, heights, mode)
    : catalogComponentsPageEntries(graph, heights, mode))
    graph.setViewEntry(id, compute);
}

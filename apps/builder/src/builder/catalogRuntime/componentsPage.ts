import type { CatalogGraph } from "../../../../../packages/shared/src/catalog/document/graph";
import type {
  CatalogReader,
  LibraryDefinitionId,
  LibraryTemplateId,
  NodeEntry,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
  childPositions,
  nodePosition,
  type CatalogPosition,
} from "../../../../../packages/shared/src/catalog/resolution/positions";
import {
  getIconData,
  lightColors,
  resolveToken,
  spacing,
  typography,
} from "@composition/rendering";
import { catalogBuiltinOrigins } from "./layouts";
import {
  catalogDefinitionTitle,
  catalogOriginOverride,
  isLibraryOrigin,
  isPageCard,
  isPagePart,
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
 * project's override of that origin, `originView` holds the edit rules), the origin taken apart
 * (its template's children), then its instances (◇): variants × states (a line per variant when
 * it has state variants — `<origin>--<state>`, instances of the origin — else its variants side
 * by side) and sizes. All of it is graph view entries (never saved, exported or indexed). The
 * Layers tree lists the page as card → origin, parts and instances (`catalogComponentsPageRows`).
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
/** Icons the Icons card shows (those the registry holds). */
const SAMPLE_ICONS = [
  "house", "search", "bell", "circle-user", "settings", "mail", "calendar",
  "chart-line", "shield", "pencil", "square-pen", "circle-check", "x", "info",
  "triangle-alert", "lock", "upload", "download", "star", "heart", "trash-2",
];
const ICON = "lib:definition:type-Icon";
const TYPE_BASE = "text-base";
const SELECT_TRIGGER = "lib:definition:type-SelectTrigger";
const COLOR_FAMILIES = ["accent", "neutral", "negative", "border"];
const COLOR_SURFACES = [
  "base", "raised", "layer-1", "layer-2", "elevated", "disabled",
  "transparent", "white", "black",
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
  value.replace(/(^|-)([a-z])/g, (_, dash: string, letter: string) =>
    `${dash ? " " : ""}${letter.toUpperCase()}`,
  );

const set = <T,>(value: T) => ({ kind: "set" as const, value });
/** The marks of an origin and of an instance (the Layers rows' dots, in a caption). */
const ORIGIN_MARK = "◆";
const INSTANCE_MARK = "◇";

/** What a card shows of one origin: its variants, sizes and state variants. */
interface OriginFacets {
  variants: string[];
  defaultVariant: string | undefined;
  sizes: string[];
  /** State variant definitions (`<origin>--<state>`), library order. */
  states: { id: LibraryDefinitionId; name: string }[];
  /** The origin's template has children (a composed component: drawn larger). */
  composed: boolean;
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
    sizes: choices("size"),
    states: stateIds.map((id) => ({
      id,
      name: titleCase(id.slice(id.indexOf("--") + 2)),
    })),
    composed: (root?.children.length ?? 0) > 0,
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
  if (children.some((child) => child?.definitionId === SELECT_TRIGGER))
    return undefined;
  const origin = [
    ...children,
    ...children.flatMap((child) =>
      (child?.children ?? []).map((id) =>
        library.templates.get(id as LibraryTemplateId),
      ),
    ),
  ].find((child) => child && stateIds.has(child.definitionId))?.definitionId as
    | LibraryDefinitionId
    | undefined;
  const item = templateOf(origin);
  if (!origin || !item) return undefined;
  const placeholder = (props: Readonly<Record<string, unknown>> | undefined) =>
    Object.values(props ?? {}).some(
      (value) => typeof value === "string" && /^\{.+\}$/.test(value),
    );
  let labelled = false;
  const parts = item.root.children.flatMap((id) => {
    const child = library.templates.get(id as LibraryTemplateId);
    if (!child || !placeholder(child.props)) return [];
    const label =
      !labelled &&
      child.definitionId === "lib:definition:text" &&
      (child.props?.slot === undefined || child.props.slot === "label");
    labelled ||= label;
    return [
      { path: [item.rootId, id as LibraryTemplateId], label },
    ];
  });
  return {
    origin,
    parts,
    /** The collection draws a trigger button, not its list (Menu). */
    trigger: own.root.definitionId === "lib:definition:type-Menu",
  };
}

/**
 * An origin taken apart: its template's direct children, one of each kind in template order
 * (`count` of them; `instance` = the part is another origin's instance — a Toolbar's Button).
 */
function originParts(graph: CatalogGraph, originId: LibraryDefinitionId) {
  const library = graph.library;
  const origin = library.definitions.get(originId);
  const root =
    origin && "templateRootId" in origin && origin.templateRootId
      ? library.templates.get(origin.templateRootId)
      : undefined;
  const type = root
    ? (library.definitions.get(root.definitionId as LibraryDefinitionId) as
        | { defaults?: Readonly<Record<string, unknown>> }
        | undefined)
    : undefined;
  // A part's `{prop}` value is its owner's prop: drawn alone, it reads the origin's own value
  // (its template root's, else the type's default), else its own name.
  const filled = (
    props: Readonly<Record<string, unknown>> | undefined,
    name: string,
  ) =>
    Object.fromEntries(
      Object.entries(props ?? {}).map(([key, value]) => {
        const owner =
          typeof value === "string" ? /^\{(\w+)\}$/.exec(value)?.[1] : undefined;
        const read = owner
          ? (root?.props?.[owner] ?? type?.defaults?.[owner] ?? name)
          : value;
        return [key, set(typeof read === "object" ? name : read)];
      }),
    ) as NodeEntry["props"];
  const parts = new Map<
    string,
    {
      definitionId: NodeEntry["definitionId"];
      name: string;
      instance: boolean;
      count: number;
      props: NodeEntry["props"];
      /** The template's own patches of the part (an item's label and icon), as the node's. */
      overrides: (id: NodeId) => NodeEntry["descendantOverrides"];
    }
  >();
  for (const childId of root?.children ?? []) {
    const child = library.templates.get(childId as LibraryTemplateId);
    if (!child) continue;
    const known = parts.get(child.definitionId);
    if (known) {
      known.count += 1;
      continue;
    }
    const definitionId = child.definitionId as LibraryDefinitionId;
    parts.set(child.definitionId, {
      definitionId,
      name: catalogDefinitionTitle(graph, definitionId),
      instance: isLibraryOrigin(definitionId),
      count: 1,
      props: filled(child.props, catalogDefinitionTitle(graph, definitionId)),
      overrides: (id) =>
        (child.descendantPatches ?? []).map((patch) => ({
          kind: "patch" as const,
          address: { instances: [id], templatePath: patch.templatePath },
          ...(patch.props
            ? { props: filled(patch.props, catalogDefinitionTitle(graph, definitionId)) }
            : {}),
          ...(patch.enabled === undefined ? {} : { enabled: patch.enabled }),
        })),
    });
  }
  return [...parts.values()];
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
  const page = reader.getEntry(ORIGIN_VIEW_NODE);
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
  const isPageRoot = id === ORIGIN_VIEW_NODE;
  if (!isPageRoot && !isPageCard(id)) return undefined;
  // A row's identity carries its drawn ancestry: rows are found by walking the page's frames.
  const found: CatalogPosition[] = [];
  const walk = (from: CatalogPosition, wanted: (id: string) => boolean) => {
    for (const child of childPositions(reader, from)) {
      if (wanted(child.sourceId)) found.push(child);
      else if (child.definitionId === FRAME) walk(child, wanted);
    }
  };
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
  // A card: the origin, its parts and its instances (a theme card: its values), side by side.
  walk(
    position,
    (nodeId) =>
      originOfEditableSample(nodeId) !== undefined ||
      isPagePart(nodeId) ||
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
export function catalogComponentsPageEntries(
  graph: CatalogGraph,
  heights?: ReadonlyMap<string, number>,
  mode: "light" | "dark" = "light",
): Map<NodeId, () => NodeEntry> {
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

  const stateIds = new Map<string, LibraryDefinitionId[]>();
  for (const id of library.definitions.keys()) {
    const at = id.indexOf("--");
    if (at < 0) continue;
    const base = id.slice(0, at);
    stateIds.set(base, [...(stateIds.get(base) ?? []), id]);
  }

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
    // Surfaces derive from `base`; the palette is the raw colors the tint and neutral pick from.
    const names = Object.keys(lightColors);
    const groups = new Map<string, string[]>(
      [...COLOR_FAMILIES, "surface", "palette"].map((key) => [key, []]),
    );
    const heads: string[] = [];
    for (const name of names) {
      const family = name.replace(/^on-/, "").split("-")[0]!;
      const semantic = COLOR_FAMILIES.includes(family);
      if ((semantic && name === family) || name === "base") heads.push(name);
      else
        groups
          .get(
            semantic
              ? family
              : COLOR_SURFACES.includes(name)
                ? "surface"
                : "palette",
          )!
          .push(name);
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
        `${mark} ${name} · ${size}px / ${lineHeights[`${name}--line-height`] ?? "-"}px`,
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
          steps.filter((step) => step !== base).map((step) => box(step, INSTANCE_MARK)),
        ),
      ],
      250,
    );
  }

  catalogBuiltinOrigins(library).forEach((origin) => {
    const facets = originFacets(graph, origin.id, stateIds.get(origin.id) ?? []);
    const base = (...path: string[]) => part("origin", origin.id, ...path);
    // A composed origin without states (a field, a list) fills a fixed cell; a stateful one
    // (IconButton, Checkbox) is as small as a leaf.
    const wide = facets.composed && facets.states.length === 0;
    const cellWidth = wide ? COMPOSED_CELL_WIDTH : undefined;
    // Estimated drawn height of a line of `count` cells (columns are balanced by it).
    const lineHeight = (count: number) => {
      const perLine = wide
        ? Math.floor((COLUMN_WIDTH - CARD_PADDING * 2) / (COMPOSED_CELL_WIDTH + 16))
        : 5;
      return Math.ceil(count / perLine) * (wide ? 220 : 64) + 30;
    };
    // The origin's own sample: its fields = the project's override (read on each read).
    const sampleId = originSampleId(origin.id);
    entries.set(sampleId, () => {
      const override = catalogOriginOverride(graph, origin.id);
      return node(sampleId, origin.id, {
        name: catalogDefinitionTitle(graph, origin.id),
        props: override?.defaults ?? {},
        visual: override?.visual ?? {},
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
    const rows: NodeId[] = [
      row(base("row", "origin"), "Origin", [
        cell(
          base("cell", "origin"),
          `${ORIGIN_MARK} ${origin.name}`,
          sampleId,
          cellWidth,
        ),
      ]),
    ];
    let weight = 60 + lineHeight(1);
    // The origin taken apart: its template's children, one of each kind.
    const parts = originParts(graph, origin.id);
    if (parts.length > 0) {
      rows.push(
        row(
          base("row", "parts"),
          "Parts",
          parts.map((item, at) =>
            cell(
              base("cell", `part-${at}`),
              `${item.instance ? `${INSTANCE_MARK} ` : ""}${item.name}${
                item.count > 1 ? ` ×${item.count}` : ""
              }`,
              fixed(
                node(base("part", String(at)), item.definitionId, {
                  name: item.name,
                  props: item.props,
                  descendantOverrides: item.overrides(base("part", String(at))),
                }),
              ),
            ),
          ),
        ),
      );
      weight += 94;
    }
    const items = originItems(graph, origin.id, stateIds);
    if (items) {
      // A collection: the states are its item origin's (the collection's own variant only tints
      // its hover) — the item at rest and in each state, drawn on its own so its display state
      // shows (inside the collection the collection's selection decides).
      const states = [items.origin, ...(stateIds.get(items.origin) ?? [])];
      rows.push(
        row(
          base("row", "items"),
          "Item states",
          states.map((stateId) => {
            const title = catalogDefinitionTitle(graph, stateId);
            const caption = title.slice(title.indexOf("/") + 1).replace(/\//g, " / ");
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
        ),
      );
      weight += lineHeight(states.length);
      // A Menu's own variant paints its trigger button (the one collection whose box is not
      // its list): its variants show, as a Button's do.
      if (items.trigger && facets.variants.length > 1) {
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
      }
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
    if (facets.sizes.length > 1) {
      rows.push(
        row(
          base("row", "sizes"),
          "Sizes",
          facets.sizes.map((size) =>
            instance(`size/${size}`, size.toUpperCase(), origin.id, {
              size: set(size),
            }),
          ),
        ),
      );
      weight += lineHeight(facets.sizes.length);
    }
    card(base("card"), base("title"), origin.name, rows, weight);
  });

  // Palette order down the columns, each next card on the lightest column so far.
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
    node(ORIGIN_VIEW_NODE, "lib:definition:type-body", {
      name: "Components",
      children: columns.map((column, index) =>
        frame(part("column", String(index + 1)), `Column ${index + 1}`, column.cards, {
          flexDirection: "column",
          gap: GAP,
          width: COLUMN_WIDTH,
          flexShrink: 0,
        }),
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
}

/** The page's card ids (a column's children), in drawn order. */
export function catalogComponentsPageCards(graph: CatalogGraph): NodeId[] {
  const root = graph.getEntry(ORIGIN_VIEW_NODE);
  if (root?.kind !== "node") return [];
  return root.children.flatMap((columnId) => {
    const column = graph.getEntry(columnId);
    return column?.kind === "node" ? [...column.children] : [];
  });
}

/**
 * Show (or stop showing) the Components page in the graph's view entries (`heights`: see
 * `catalogComponentsPageEntries`).
 */
export function setCatalogComponentsView(
  graph: CatalogGraph,
  on: boolean,
  heights?: ReadonlyMap<string, number>,
  mode?: "light" | "dark",
): void {
  for (const id of graph.viewEntryIds())
    if (id.startsWith(ORIGIN_VIEW_NODE))
      graph.setViewEntry(id as NodeId, undefined);
  if (!on) return;
  for (const [id, compute] of catalogComponentsPageEntries(graph, heights, mode))
    graph.setViewEntry(id, compute);
}

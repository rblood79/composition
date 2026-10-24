import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { resolveToken } from "@composition/rendering";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  LibraryDefinitionId,
  NodeId,
  ProjectEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  LIBRARY_COMPONENT_PAGE,
  projectInstancesOf,
  withoutComponentPages,
} from "../../../../../../packages/shared/src/catalog/document/componentPages";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { resolveCatalogNode } from "../../../../../../packages/shared/src/catalog/resolution/resolver";
import { CANVAS_VIEWPORT } from "../../../../../../packages/shared/src/catalog/runtime/canvasBreakpoints";
import {
  catalogSlotBand,
  catalogSlotMarks,
} from "../../workspace/canvas/catalog/catalogChrome";
import { resolveCatalogClickRecord } from "../canvasPick";
import { CatalogLayerTreeStore } from "../layerTree";
import {
  catalogComponentRole,
  catalogComponentState,
} from "../componentActions";
import { catalogComponentsPageCards } from "../componentsPage";
import { catalogBuiltinOrigins } from "../layouts";
import { getPaletteItems } from "../../panels/components/paletteItems";
import {
  CatalogOriginEditError,
  COMPONENTS_VIEW,
  ORIGIN_VIEW_NODE,
  originCardId,
  originInstanceId,
  originSampleId,
  componentPageNodeId,
  isPageCard,
} from "../originView";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 4e (user 2026-10-01 · 2026-10-05): the Navigator Components tab opens the Components
 * page — one derived page (never in the document) that draws every built-in component origin
 * (the types the Components palette registers) by palette category, each with its state variants
 * as instances beside it. Root edits on an origin's sample are the project's defaults for that
 * origin (every instance shows them, undo takes them back); its children, its other fields, the
 * state variants and the page's own frames are not editable (user decision: root only).
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;

async function open() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:origin-view" as EntryId<"project">,
        name: "Origin view",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr248-4e-origin-view-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  // Button (ADR-276): its origin root takes `label` (a Button's text is a template child).
  const button = catalogBuiltinOrigins(library).find(
    (origin) => origin.name === "Button",
  )!;
  // A Button placed on the page (an instance of the origin).
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: PLACED,
          definitionId: button.id,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [PLACED],
      newId: workspace.newId,
    }),
  );
  return { workspace, library, button };
}
const graphOf = (workspace: CatalogWorkspace) => workspace.runtime.graph;
/**
 * A card's lines (user 2026-10-25 — no frame per line or per cell): after the title, each line's
 * name (a Text) and its grids (frames named as the line) — a grid's first row the samples, the
 * rows under it their captions.
 */
const cardLines = (card: NodeEntry, nodeOf: (id: string) => NodeEntry) => {
  const lines: { name: string; grids: NodeEntry[] }[] = [];
  for (const child of card.children.slice(1).map(nodeOf)) {
    if (
      child.definitionId !== "lib:definition:type-frame" ||
      child.layout?.gridTemplateColumns === undefined
    )
      continue;
    const last = lines.at(-1);
    if (last && last.name === child.name) last.grids.push(child);
    else lines.push({ name: child.name!, grids: [child] });
  }
  return lines;
};
/** A line's cells: each sample and the name of the caption under it. */
const lineCells = (
  line: { grids: NodeEntry[] },
  nodeOf: (id: string) => NodeEntry,
) =>
  line.grids.flatMap((grid) => {
    const columns = String(
      (grid.layout?.gridTemplateColumns as { value: string }).value,
    ).split(" ").length;
    const children = grid.children.map(nodeOf);
    return children.slice(0, columns).map((sample, at) => ({
      name: children[columns + at]!.name,
      sample,
    }));
  });
/**
 * A card of the Origin line alone holds its cells itself (user 2026-10-25 — no line name, no line
 * frame): after the title, each sample and then its caption.
 */
const aloneCells = (card: NodeEntry, nodeOf: (id: string) => NodeEntry) => {
  const children = card.children.slice(1).map(nodeOf);
  return children.flatMap((sample, at) =>
    at % 2 === 0 ? [{ sample, name: children[at + 1]!.name }] : [],
  );
};
/** A Components page node's id: its stored one once the page is stored (ADR-282 Phase 3). */
const pageNode = (workspace: CatalogWorkspace, viewId: string): NodeId => {
  const stored = componentPageNodeId(viewId);
  return (
    graphOf(workspace).storedEntry(stored) ? stored : viewId
  ) as NodeId;
};
const placedLabel = (workspace: CatalogWorkspace) =>
  resolveCatalogNode(graphOf(workspace), PLACED).props.label;

describe("ADR-248 4e library origin view", () => {
  it("lists one built-in origin per palette component, in palette order", async () => {
    const { library } = await open();
    const origins = catalogBuiltinOrigins(library);
    expect(origins.length).toBeGreaterThan(30);
    expect(
      origins.every((origin) => origin.id.startsWith("lib:definition:origin-")),
    ).toBe(true);
    // State variants (`--hover` …) are not listed; each origin once.
    expect(origins.some((origin) => origin.id.includes("--"))).toBe(false);
    expect(new Set(origins.map((origin) => origin.id)).size).toBe(
      origins.length,
    );
    expect(origins.map((origin) => origin.name)).toEqual(
      expect.arrayContaining(["Button", "ToggleButton", "TextField"]),
    );
  });

  it("opening an origin shows the Components page (stored as the project's Library page the first time — ADR-282 Phase 3) with its sample selected", async () => {
    const { workspace, library, button } = await open();
    const sampleId = originSampleId(button.id);
    const revealed: string[] = [];
    workspace.subscribeRevealRecord((identity) => revealed.push(identity));
    workspace.showDefinition(button.id);
    expect(workspace.session.getSnapshot().definitionView).toBe(
      COMPONENTS_VIEW,
    );
    // The Canvas is asked to bring that component's card into view.
    expect(revealed).toEqual([
      workspace.itemsOfNode(pageNode(workspace, originCardId(button.id)), 1)[0]!
        .identity,
    ]);
    expect(
      workspace.session.getSnapshot().selection.map((item) => item.target),
    ).toEqual([{ kind: "node", id: sampleId }]);
    const roots = [...workspace.root.domInputs.values()].filter(
      (record) => record.parentId === "catalog:root",
    );
    expect(roots.map((record) => record.sourceId)).toEqual([ORIGIN_VIEW_NODE]);
    // Layers: the stored page is a page (user 2026-10-25) — body > cards > lines; the Origin
    // line's first row is the origin (its sample), the other lines' the instances.
    const store = new CatalogLayerTreeStore(
      {
        readModel: workspace.readModel,
        graph: graphOf(workspace),
        subscribeSteps: (listener) =>
          workspace.runtime.subscribeSteps(listener),
      },
      COMPONENTS_VIEW,
    );
    const [root] = store.getSnapshot();
    expect(root!.role).toBe(undefined);
    expect(root!.body).toBe(true);
    const expandTo = (...records: string[]) =>
      store.setExpanded(
        new Set(
          records.flatMap((record) => {
            const path = record.split("::")[0]!.split("/");
            return path.map(
              (id, at) => `${path.slice(0, at + 1).join("/")}::${id}`,
            );
          }),
        ),
      );
    const rowOf = (
      rows: ReturnType<typeof store.getSnapshot>,
      id: string,
    ): (typeof rows)[number] | undefined => {
      for (const row of rows) {
        if (row.id === id) return row;
        const found = rowOf(row.children ?? [], id);
        if (found) return found;
      }
      return undefined;
    };
    const sampleRecord = workspace.itemsOfNode(sampleId, 1)[0]!.identity;
    const hoverRecord = workspace.itemsOfNode(
      pageNode(workspace, originInstanceId(button.id, "primary/Hover")),
      1,
    )[0]!.identity;
    expandTo(sampleRecord, hoverRecord);
    const originRow = rowOf(store.getSnapshot(), sampleRecord)!;
    expect(originRow.role).toBe("origin");
    expect(originRow.name).toBe("Button");
    expect(originRow.hasChildren).toBe(true);
    const hoverRow = rowOf(store.getSnapshot(), hoverRecord)!;
    expect(hoverRow.role).toBe("instance");
    // The card's frames are rows (a page's frames): the card under the body, then its line.
    const names = sampleRecord
      .split("::")[0]!
      .split("/")
      .map((id) => (graphOf(workspace).getEntry(id) as NodeEntry | undefined)?.name);
    expect(names.filter(Boolean).slice(0, 2)).toEqual(["Button", "Origin"]);
    expect(catalogComponentRole(graphOf(workspace), sampleId)).toBe("origin");
    const hover = pageNode(
      workspace,
      originInstanceId(button.id, "primary/Hover"),
    );
    expect(catalogComponentRole(graphOf(workspace), hover)).toBe("instance");
    // Every drawn node has a position (selection, panels): the Button origin and its states.
    for (const id of [sampleId, hover]) {
      const [item] = workspace.itemsOfNode(id, 1);
      expect(workspace.positionOfRecord(item!.identity)).toBeDefined();
    }
    // A Canvas click picks the sample or instance under it; a card's own frames pick the card.
    const records = workspace.root.domInputs;
    const recordOf = (id: string) =>
      workspace.itemsOfNode(id as NodeId, 1)[0]!.identity;
    const caption = [...records.values()].find(
      (record) =>
        record.sourceId ===
        componentPageNodeId(
          `${ORIGIN_VIEW_NODE}/origin/${button.id}/caption/primary/Hover`,
        ),
    )!;
    expect(resolveCatalogClickRecord(records, caption.id, undefined)).toBe(
      recordOf(pageNode(workspace, originCardId(button.id))),
    );
    for (const id of [sampleId, hover])
      expect(resolveCatalogClickRecord(records, recordOf(id), undefined)).toBe(
        recordOf(id),
      );
    // The page is the document's (a component page — not a route, not Preview's); its samples are
    // not. Opening it made no history step.
    const graph = graphOf(workspace);
    const exported = graph.exportDocument();
    expect(exported.entries[ORIGIN_VIEW_NODE]).toBeDefined();
    expect(exported.entries[sampleId]).toBe(undefined);
    expect(exported.entries[LIBRARY_COMPONENT_PAGE]).toMatchObject({
      kind: "page",
      children: [ORIGIN_VIEW_NODE],
    });
    const project = exported.entries[graph.projectId] as ProjectEntry;
    expect(project.componentPageIds).toEqual([LIBRARY_COMPONENT_PAGE]);
    expect(project.pageIds).not.toContain(LIBRARY_COMPONENT_PAGE);
    expect(
      withoutComponentPages(exported).entries[ORIGIN_VIEW_NODE],
    ).toBeUndefined();
    // (The fixture's own insert only.)
    expect(workspace.history.getSnapshot().labels).toEqual(["Insert"]);
    // The showcase instances are not the project's (what an origin edit is said to reach).
    expect(projectInstancesOf(graph, button.id)).toEqual([PLACED]);
    workspace.showDefinition(undefined);
    expect(graph.getEntry(ORIGIN_VIEW_NODE)).toBeDefined();
    expect(graph.viewEntryIds()).toEqual([]);
    workspace.dispose();
  });

  it("the page: a card per built-in origin on a three-column grid — variants × states, captions", async () => {
    const { workspace, library } = await open();
    workspace.showDefinition(COMPONENTS_VIEW);
    const graph = graphOf(workspace);
    const nodeOf = (id: string) =>
      graph.getEntry(pageNode(workspace, id)) as NodeEntry;
    // Every palette origin has one card, directly under the body.
    const cards = catalogComponentsPageCards(graph).map(nodeOf);
    const THEME = ["Colors", "Typography", "Icons", "Spacing"];
    expect(
      cards
        .map((card) => card.name)
        .filter((name) => !THEME.includes(name!))
        .sort(),
    ).toEqual(
      catalogBuiltinOrigins(library)
        .map((origin) => origin.name)
        .sort(),
    );
    // The theme's cards are numbered 01–04, the components from 05; their values are the
    // theme token tables' (a swatch per color, a sample per type size, a box per spacing step).
    const titleOf = (name: string) =>
      nodeOf(cards.find((candidate) => candidate.name === name)!.children[0]!)
        .name;
    expect(THEME.map(titleOf)).toEqual([
      "01. COLORS",
      "02. TYPOGRAPHY",
      "03. ICONS",
      "04. SPACING",
    ]);
    expect(titleOf(catalogBuiltinOrigins(library)[0]!.name)).toMatch(/^05\. /);
    const themeNode = (path: string) =>
      nodeOf(`${ORIGIN_VIEW_NODE}/theme/${path}`);
    expect(themeNode("colors/accent/sample").visual).toMatchObject({
      backgroundColor: {
        kind: "set",
        value: resolveToken("{color.accent}", "light"),
      },
    });
    // Colors lists the semantic colors only — no row of the raw palette they pick from.
    const linesOf = (name: string) =>
      cardLines(cards.find((candidate) => candidate.name === name)!, nodeOf);
    const cellsOf = (line: { grids: NodeEntry[] }) => lineCells(line, nodeOf);
    expect(linesOf("Colors").map((line) => line.name)).toEqual([
      "Origin",
      "Accent",
      "Neutral",
      "Negative",
      "Border",
      "Surface",
    ]);
    expect(themeNode("typography/text-xl/sample").visual).toMatchObject({
      fontSize: { kind: "set", value: 20 },
    });
    expect(themeNode("icons/search/sample").props).toEqual({
      iconName: { kind: "set", value: "search" },
    });
    // A theme card reads as a component card: its base value as the origin, the rest as instances.
    const spacingRows = linesOf("Spacing");
    expect(spacingRows.map((row) => row.name)).toEqual(["Origin", "Sizes"]);
    expect(cellsOf(spacingRows[0]!).map((cell) => cell.name)).toEqual([
      "◆ md",
    ]);
    expect(cellsOf(spacingRows[1]!)[0]!.name).toBe("◇ 2xs");
    const colorRows = linesOf("Colors");
    expect(cellsOf(colorRows[0]!).map((cell) => cell.name)).toEqual(
      expect.arrayContaining(["◆ accent", "◆ neutral", "◆ base"]),
    );
    expect(cellsOf(colorRows[1]!).map((cell) => cell.name)).toEqual(
      expect.arrayContaining(["◇ hover", "◇ on-accent"]),
    );
    expect(themeNode("spacing/md/sample").sizing).toMatchObject({
      width: { kind: "set", value: 16 },
    });
    const card = cards.find((candidate) => candidate.name === "Button")!;
    const title = nodeOf(card.children[0]!);
    const rows = linesOf("Button");
    expect(title.name).toMatch(/^\d\d\. BUTTON$/);
    // The origin, then its instances: a line per variant (no line of sizes — a size is a prop
    // of every instance, and the line took most of a card).
    expect(rows.map((row) => row.name)).toEqual([
      "Origin",
      "Accent",
      "Primary",
      "Secondary",
      "Negative",
      "Premium",
      "Genai",
    ]);
    const sampleOf = (cell: { sample: NodeEntry }) => cell.sample;
    const origin = "lib:definition:origin-component-button";
    // The origin's cell holds its one editable sample, marked as the origin.
    const [originCell] = cellsOf(rows[0]!);
    expect(originCell!.name).toBe("◆ Button");
    expect(sampleOf(originCell!).id).toBe(originSampleId(origin));
    // A variant's line: instances (marked) of the origin at rest, then of its state variants.
    const primary = cellsOf(rows[2]!);
    expect(primary.map((cell) => cell.name)).toEqual([
      "◇ Default",
      "◇ Disabled",
      "◇ Hover",
      "◇ Pressed",
      "◇ Focus Visible",
    ]);
    expect(primary.map((cell) => sampleOf(cell).definitionId)).toEqual(
      ["", "--disabled", "--hover", "--pressed", "--focus-visible"].map(
        (state) => `${origin}${state}`,
      ),
    );
    // A card has no Parts row (it drew the origin once more; what a collection holds is its
    // Item row).
    expect(linesOf("TextField").map((row) => row.name)).not.toContain("Parts");
    // A collection shows its item origin's states (not its own variants — they only tint its
    // hover): the item drawn on its own, its label filled in and its placeholders off.
    const gridRows = linesOf("GridList");
    expect(gridRows.map((row) => row.name)).toEqual(["Origin", "Item"]);
    // A field with a control Group (ADR-256 Phase 6b — a ComboBox's list items sit in its ListBox
    // part) is not a collection: no Item line.
    expect(linesOf("ComboBox").map((row) => row.name)).not.toContain("Item");
    // The Origin row: the origin (its slot empty) and an instance of it (the slot filled).
    expect(cellsOf(gridRows[0]!).map((cell) => cell.name)).toEqual([
      "◆ GridList",
      "◇ GridList",
    ]);
    // The Item row opens with the item origin itself (◆ — its editable sample; user 2026-10-13
    // 「Item 줄 맨 앞에 ◆ 원본 칸」), then its instances (◇) at rest and in each state.
    const ITEM_ORIGIN =
      "lib:definition:origin-component-gridlist-item-default" as LibraryDefinitionId;
    const [itemOriginCell, ...itemCells] = cellsOf(gridRows[1]!);
    expect(itemOriginCell!.name).toBe("◆ GridListItem");
    const itemSample = sampleOf(itemOriginCell!);
    expect(itemSample.id).toBe(originSampleId(ITEM_ORIGIN));
    expect(itemSample.definitionId).toBe(ITEM_ORIGIN);
    expect(
      catalogComponentState(graph, itemSample.id, COMPONENTS_VIEW),
    ).toMatchObject({
      originOf: { definitionId: ITEM_ORIGIN },
    });
    // (Its label filled in as the instances' — the origin's `{label}` alone draws nothing.)
    expect(
      itemSample.descendantOverrides.find(
        (item) => item.kind === "patch" && item.props,
      ),
    ).toMatchObject({
      address: { instances: [itemSample.id] },
      props: { children: { kind: "set", value: "Item" } },
    });
    expect(itemCells.map((cell) => cell.name)[0]).toMatch(/^◇ /);
    // Every page node stands in one place (no item origin's sample is drawn twice).
    const placed = new Map<string, number>();
    const visit = (id: string) => {
      for (const child of (graph.getEntry(id) as NodeEntry | undefined)
        ?.children ?? []) {
        placed.set(child, (placed.get(child) ?? 0) + 1);
        visit(child);
      }
    };
    visit(ORIGIN_VIEW_NODE);
    expect([...placed].filter(([, count]) => count > 1)).toEqual([]);
    expect(placed.get(originSampleId(ITEM_ORIGIN))).toBe(1);
    // An item origin with a card of its own (a ButtonGroup's Button) is not drawn again.
    const buttonGroup = cards.find(
      (candidate) => candidate.name === "ButtonGroup",
    );
    if (buttonGroup) {
      const groupRows = linesOf("ButtonGroup");
      const itemRow = groupRows.find((row) => row.name === "Item");
      if (itemRow)
        expect(cellsOf(itemRow).map((cell) => cell.name)[0]).toMatch(/^◇ /);
    }
    // A root edit on the item origin's sample is that origin's project default.
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: itemSample.id }],
        visual: { paddingTop: { kind: "set", value: 20 } },
      }),
    );
    const project = graph.getEntry(graph.projectId);
    const overrides =
      project?.kind === "project"
        ? project.overrideIds.map((id) => graph.getEntry(id))
        : [];
    expect(overrides).toContainEqual(
      expect.objectContaining({
        kind: "definitionOverride",
        targetId: ITEM_ORIGIN,
        visual: { paddingTop: { kind: "set", value: 20 } },
      }),
    );
    workspace.undo();
    expect(itemCells.map((cell) => sampleOf(cell).definitionId)).toEqual(
      [
        "",
        "--unselected",
        "--disabled",
        "--hover",
        "--pressed",
        "--focus-visible",
      ].map(
        (state) =>
          `lib:definition:origin-component-gridlist-item-default${state}`,
      ),
    );
    const hoverItem = sampleOf(itemCells[3]!);
    expect(catalogComponentRole(graph, hoverItem.id)).toBe("instance");
    expect(
      hoverItem.descendantOverrides.find(
        (item) => item.kind === "patch" && item.props,
      ),
    ).toMatchObject({
      address: {
        instances: [
          hoverItem.id,
          "lib:template:component-gridlist-item-default--hover",
        ],
        templatePath: [
          "lib:template:component-gridlist-item-default",
          "lib:template:component-gridlist-item-default__label",
        ],
      },
      props: { children: { kind: "set", value: "Item" } },
    });
    const accentHover = sampleOf(cellsOf(rows[1]!)[2]!);
    expect(accentHover.definitionId).toBe(`${origin}--hover`);
    expect(accentHover.props).toEqual({
      variant: { kind: "set", value: "accent" },
    });
    expect(catalogComponentRole(graph, accentHover.id)).toBe("instance");
    // No instance of a card sets a size.
    expect(
      rows.flatMap((row) =>
        cellsOf(row).map((cell) => sampleOf(cell).props.size),
      ),
    ).toEqual(rows.flatMap((row) => cellsOf(row).map(() => undefined)));
    // A Chart card draws an instance per chart type — the palette's creation variants of the
    // origin, each with the props the palette creates it with.
    const cardOf = (name: string) =>
      cards.find((candidate) => candidate.name === name)!;
    // Dialog · Popover · ContextualHelp draw their origin alone — its body open, no filled
    // instance beside it (user 2026-10-25).
    for (const name of ["Dialog", "Popover", "ContextualHelp"])
      expect([
        name,
        aloneCells(cardOf(name), nodeOf).map((cell) => cell.name),
      ]).toEqual([name, [`◆ ${name}`]]);
    // These cards draw no Variants line (user 2026-10-25) — the Origin line alone, held by the
    // card itself: no line name or frame, the ◆ after the title (user 2026-10-25).
    for (const name of [
      "CardView",
      "Badge",
      "Meter",
      "StatusLight",
      "InlineAlert",
      "Card",
    ])
      expect([name, linesOf(name).length]).toEqual([name, 0]);
    const meter = cardOf("Meter");
    expect(aloneCells(meter, nodeOf).map((cell) => cell.name)).toEqual([
      "◆ Meter",
    ]);
    expect(nodeOf(meter.children[1]!).id).toBe(
      originSampleId("lib:definition:origin-component-meter" as LibraryDefinitionId),
    );
    expect(
      (graph.storedEntry(pageNode(workspace, originCardId(
        "lib:definition:origin-component-meter" as LibraryDefinitionId,
      ))) as NodeEntry).originOf,
    ).toBe("lib:definition:origin-component-meter");
    const chartRows = linesOf("Chart");
    // (No Variants row — the Chart has no variant axis, 2026-10-12.)
    expect(chartRows.map((row) => row.name)).toEqual(["Origin", "Types"]);
    const chartTypes = cellsOf(chartRows[1]!);
    expect(chartTypes.map((cell) => cell.name)).toEqual(
      ["Area", "Bar", "Line", "Pie", "Radar", "Radial", "Scatter"].map(
        (name) => `◇ ${name} Chart`,
      ),
    );
    expect(chartTypes.map((cell) => sampleOf(cell).props.chartType)).toEqual(
      ["area", "bar", "line", "pie", "radar", "radial", "scatter"].map(
        (value) => ({
          kind: "set",
          value,
        }),
      ),
    );
    expect(sampleOf(chartTypes[0]!).definitionId).toBe(
      "lib:definition:origin-component-chart",
    );
    expect(catalogComponentRole(graph, sampleOf(chartTypes[0]!).id)).toBe(
      "instance",
    );
    const rectOf = (id: string) => {
      const [record] = workspace.root.recordsOfSource(id);
      return workspace.root.getGeometry([record!]).get(record!)!;
    };
    // The chart types are drawn two to a line (each half the card's inner width).
    const chartRects = chartTypes.map((cell) => rectOf(sampleOf(cell).id));
    expect(chartRects.map((rect) => rect.width)).toEqual(
      chartTypes.map(() => 248),
    );
    expect(chartRects.every((rect) => rect.height > 0)).toBe(true);
    // A Menu's trigger button has the Button's metrics at the same size (padding, min width).
    // ADR-278: the card draws the Menu's body (its Popover, open) beside the trigger, so the
    // sample's box is wider and taller than the trigger's (the 2026-10-21 test checks the body).
    const menuSample = originSampleId(
      "lib:definition:origin-component-menu" as LibraryDefinitionId,
    );
    const menuRect = rectOf(menuSample);
    const [menuRecord] = workspace.root.recordsOfSource(menuSample);
    const triggerRecord = workspace.root.canvasInputs.get(menuRecord!)!
      .children[0]!;
    const triggerRect = workspace.root
      .getGeometry([triggerRecord])
      .get(triggerRecord)!;
    const buttonRect = rectOf(
      originSampleId(
        "lib:definition:origin-component-button" as LibraryDefinitionId,
      ),
    );
    expect([triggerRect.width, triggerRect.height]).toEqual([
      buttonRect.width,
      buttonRect.height,
    ]);
    expect(menuRect.width).toBeGreaterThan(buttonRect.width);
    expect(menuRect.height).toBeGreaterThan(buttonRect.height);
    // The body is a grid of three columns as wide as their cards (user 2026-10-25), the cards
    // directly in it in their numbered order, row by row; it is the breakpoint's page wide (a
    // page body's width — desktop, tablet, mobile) and as tall as its cards (`height: 100%`).
    const body = nodeOf(ORIGIN_VIEW_NODE);
    expect(body.layout).toMatchObject({
      display: { kind: "set", value: "grid" },
      gridTemplateColumns: { kind: "set", value: "auto auto auto" },
    });
    expect(body.children.every((id) => isPageCard(id))).toBe(true);
    // Every card is its column's width (`width: 100%`).
    expect(
      new Set(body.children.map((id) => JSON.stringify(nodeOf(id).visual.width))),
    ).toEqual(new Set([JSON.stringify({ kind: "set", value: "100%" })]));
    const boxes = body.children.map((id) => rectOf(id));
    expect(new Set(boxes.slice(0, 3).map((box) => box.x)).size).toBe(3);
    // (Cards in one column are equally wide.)
    expect(boxes.filter((_, at) => at % 3 === 0).every((box) => box.width === boxes[0]!.width)).toBe(true);
    expect(boxes[3]!.x).toBe(boxes[0]!.x);
    expect(boxes[3]!.y).toBeGreaterThan(boxes[0]!.y);
    expect(rectOf(ORIGIN_VIEW_NODE).width).toBe(CANVAS_VIEWPORT.desktop.width);
    const lastCard = boxes.at(-1)!;
    expect(rectOf(ORIGIN_VIEW_NODE).height).toBeCloseTo(
      Math.max(...boxes.map((box) => box.y + box.height)) + 16,
      0,
    );
    expect(lastCard.y).toBeGreaterThan(CANVAS_VIEWPORT.desktop.height);
    // Three columns on desktop, two on tablet, one on mobile (the body's breakpoint layers).
    for (const [breakpoint, columns] of [
      ["tablet", 2],
      ["mobile", 1],
    ] as const) {
      workspace.setBreakpoint(breakpoint);
      const xs = body.children.map((id) => rectOf(id).x);
      expect([
        breakpoint,
        rectOf(ORIGIN_VIEW_NODE).width,
        new Set(xs).size,
        xs[columns],
      ]).toEqual([
        breakpoint,
        CANVAS_VIEWPORT[breakpoint].width,
        columns,
        xs[0],
      ]);
    }
    workspace.setBreakpoint("desktop");
    workspace.dispose();
  });

  it("a root edit is the origin's project default: every instance shows it, undo takes it back", async () => {
    const { workspace, button } = await open();
    const SAMPLE = originSampleId(button.id);
    const before = placedLabel(workspace);
    workspace.showDefinition(button.id);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: SAMPLE }],
        props: { label: { kind: "set", value: "Go" } },
        visual: { paddingTop: { kind: "set", value: 20 } },
      }),
    );
    const project = graphOf(workspace).getEntry(graphOf(workspace).projectId);
    const override =
      project?.kind === "project"
        ? graphOf(workspace).getEntry(project.overrideIds[0]!)
        : undefined;
    expect(override).toMatchObject({
      kind: "definitionOverride",
      targetId: button.id,
      defaults: { label: { kind: "set", value: "Go" } },
      visual: { paddingTop: { kind: "set", value: 20 } },
    });
    // The sample shows its override as own values; the placed instance follows.
    expect((graphOf(workspace).getEntry(SAMPLE) as NodeEntry).props).toEqual({
      label: { kind: "set", value: "Go" },
    });
    expect(placedLabel(workspace)).toBe("Go");
    // The panels read it as the sample's own value (resettable).
    expect(
      workspace.readModel.ownFields({ kind: "node", id: SAMPLE }).props,
    ).toEqual({ label: { kind: "set", value: "Go" } });
    const sample = [...workspace.root.domInputs.values()].find(
      (record) => record.sourceId === SAMPLE,
    )!;
    // The Canvas draws the new label in the sample (a template text reads `{label}`).
    const subtree = (id: string): unknown[] => {
      const record = workspace.root.domInputs.get(id)!;
      return [record.props, ...record.children.flatMap(subtree)];
    };
    expect(JSON.stringify(subtree(sample.id))).toContain('"Go"');
    // A second edit (the override exists: a value-only step) redraws the sample too, and a
    // subscribed panel read follows it.
    const seen: unknown[] = [];
    const unsubscribe = workspace.readModel.subscribeOwnFields(
      { kind: "node", id: SAMPLE },
      (fields) => seen.push(fields.props.label),
    );
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: SAMPLE }],
        props: { label: { kind: "set", value: "Next" } },
      }),
    );
    expect(JSON.stringify(subtree(sample.id))).toContain('"Next"');
    expect(seen.at(-1)).toEqual({ kind: "set", value: "Next" });
    unsubscribe();
    workspace.undo();
    // One history step each; undo restores.
    expect(workspace.history.getSnapshot().labels.at(-1)).toBeDefined();
    workspace.undo();
    expect(placedLabel(workspace)).toBe(before);
    workspace.dispose();
  });

  it("anything but the root's props and base styles is refused", async () => {
    const { workspace, button } = await open();
    const SAMPLE = originSampleId(button.id);
    workspace.showDefinition(button.id);
    const steps = workspace.history.getSnapshot().labels.length;
    expect(() =>
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: SAMPLE }],
          breakpoint: "mobile",
          visual: { paddingTop: { kind: "set", value: 4 } },
        }),
      ),
    ).toThrow(CatalogOriginEditError);
    expect(() =>
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: SAMPLE }],
          sizing: { width: { kind: "set", value: 300 } },
        }),
      ),
    ).toThrow(CatalogOriginEditError);
    expect(workspace.history.getSnapshot().labels.length).toBe(steps);
    // The stored page's own nodes take edits as a page's do (user 2026-10-25 — library-body is a
    // page's body): an instance beside the origin, the body.
    for (const id of [
      pageNode(workspace, originInstanceId(button.id, "primary/Hover")),
      ORIGIN_VIEW_NODE,
    ]) {
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id }],
          visual: { paddingTop: { kind: "set", value: 4 } },
        }),
      );
      workspace.undo();
    }
    // A write that skips the origin view's translation never stages the sample.
    let code: string | undefined;
    try {
      workspace.root.execute(
        setFields({
          targets: [{ kind: "node", id: SAMPLE }],
          props: { label: { kind: "set", value: "X" } },
        }),
      );
    } catch (error) {
      code = (error as { code?: string }).code;
    }
    expect(code).toBe("VIEW_ENTRY_READ_ONLY");
    workspace.dispose();
  });

  it("the Component section: the sample is the origin (its instances), a placed one an instance", async () => {
    const { workspace, button } = await open();
    const SAMPLE = originSampleId(button.id);
    workspace.showDefinition(button.id);
    const graph = graphOf(workspace);
    expect(catalogComponentState(graph, SAMPLE, COMPONENTS_VIEW)).toMatchObject(
      {
        originOf: {
          definitionId: button.id,
          project: false,
          instanceIds: [PLACED],
        },
      },
    );
    expect(catalogComponentState(graph, PLACED, COMPONENTS_VIEW)).toMatchObject(
      {
        instanceOf: {
          definitionId: button.id,
          project: false,
          instanceIds: [PLACED],
        },
      },
    );
    workspace.dispose();
  });
  it("draws each origin as the DOM sizes it: circle height, owner-sized glyphs and members, track variants, slots", async () => {
    const { workspace, button } = await open();
    const lib = (name: string) =>
      `lib:definition:origin-component-${name}` as LibraryDefinitionId;
    const recordOf = (id: string) =>
      workspace.root.recordsOfSource(pageNode(workspace, id))[0]!;
    const rectOf = (id: string) =>
      workspace.root.getGeometry([recordOf(id)]).get(recordOf(id))!;
    const inputOf = (record: string) =>
      workspace.root.canvasInputs.get(record)!;
    const under = (record: string, binding: string): string[] =>
      inputOf(record).children.flatMap((child) => [
        ...(inputOf(child).bindingId === binding ? [child] : []),
        ...under(child, binding),
      ]);
    // Instances of an origin at a size, placed on the page (the Components page draws no sizes).
    const sized = (origin: string, size: string) =>
      `project:node:sized-${origin}-${size}` as NodeId;
    const sizedPairs = [
      ...["S", "M", "L"].map((size) => ["progresscircle", size] as const),
      ...[
        "select",
        "combobox",
        "datepicker",
        "daterangepicker",
        "numberfield",
      ].flatMap((origin) => [[origin, "XS"] as const, [origin, "XL"] as const]),
      ["avatargroup", "XL"] as const,
      ["buttongroup", "XS"] as const,
    ];
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: sizedPairs.map(([origin, size]) => ({
          kind: "node" as const,
          id: sized(origin, size),
          definitionId: lib(origin),
          children: [],
          props: { size: { kind: "set" as const, value: size } },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        })),
        rootIds: sizedPairs.map(([origin, size]) => sized(origin, size)),
        newId: workspace.newId,
      }),
    );
    // A ProgressCircle is its diameter square (the `progress` archetype drops a bar's height).
    for (const [key, diameter] of [
      ["S", 24],
      ["M", 32],
      ["L", 64],
    ] as const) {
      const rect = rectOf(sized("progresscircle", key));
      expect([rect.width, rect.height]).toEqual([diameter, diameter]);
    }
    // A field's button is a FieldButton instance (ComboBox · DatePicker · DateRangePicker), a
    // Select's trigger a Button instance (ADR-253): the glyph is the Button's scale.
    // (The field's own button — not the nav glyphs of a picker's calendar in its closed Popover,
    // ADR-256 Phase 9.)
    const inPopover = (record: string): boolean => {
      for (
        let cursor = inputOf(record).parentId;
        cursor && inputOf(cursor);
        cursor = inputOf(cursor).parentId
      )
        if (inputOf(cursor).bindingId === "popover") return true;
      return false;
    };
    // (ADR-276: a Button position's template `{icon}` glyph is there unfilled — hidden, no box.)
    const buttonGlyphs = (origin: string, size: string) =>
      under(recordOf(sized(origin, size)), "icon")
        .filter((record) => !inPopover(record) && !inputOf(record).hidden)
        .map((record) => inputOf(record).visual.iconSize);
    for (const origin of [
      "combobox",
      "select",
      "datepicker",
      "daterangepicker",
    ]) {
      expect(buttonGlyphs(origin, "XS")).toEqual([14]);
      expect(buttonGlyphs(origin, "XL")).toEqual([28]);
    }
    // A NumberField's steppers are Button instances (ADR-253): their glyphs are the Button's scale.
    expect(buttonGlyphs("numberfield", "XS")).toEqual([14, 14]);
    expect(buttonGlyphs("numberfield", "XL")).toEqual([28, 28]);
    // A group's size reaches its members. (A calendar has no size — 2026-10-13.)
    const sizesUnder = (origin: string, size: string, binding: string) =>
      under(recordOf(sized(origin, size)), binding).map(
        (record) => inputOf(record).props.size,
      );
    expect(sizesUnder("avatargroup", "XL", "avatar")).toEqual([
      "XL",
      "XL",
      "XL",
    ]);
    expect(sizesUnder("buttongroup", "XS", "button")).toEqual(["XS", "XS"]);
    // A Card placed on a page: its regions are slots — the one it leaves empty (the footer) is
    // hatched at its own box, the filled ones are not marked.
    const CARD = "project:node:card-placed" as NodeId;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            kind: "node",
            id: CARD,
            definitionId: lib("card"),
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootIds: [CARD],
        newId: workspace.newId,
      }),
    );
    const pageBounds = new Map(
      [...workspace.root.canvasInputs.keys()].flatMap((record) => {
        const rect = workspace.root.getGeometry([record]).get(record);
        return rect ? [[record, rect] as const] : [];
      }),
    );
    const placedCard = recordOf(CARD);
    expect(
      catalogSlotMarks(workspace, pageBounds, pageBounds)
        .filter((mark) => inputOf(placedCard).children.includes(mark.identity))
        .map((mark) => [
          inputOf(mark.identity).slot?.name,
          mark.empty,
          mark.role,
        ]),
    ).toEqual([["Footer", true, "instance"]]);
    workspace.showDefinition(button.id);
    // A Meter's track takes its owner's variant: the track rule paints every one of them
    // (a missing variant painted no track). (The ProgressBar has no variant — 2026-10-12.)
    // (The Meter card has no Variants line — user 2026-10-25: a negative Meter placed on the
    // page, then taken back.)
    workspace.showDefinition(undefined);
    const METER = "project:node:negative-meter" as NodeId;
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            kind: "node",
            id: METER,
            definitionId: lib("meter"),
            children: [],
            props: { variant: { kind: "set", value: "negative" } },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootIds: [METER],
        newId: workspace.newId,
      }),
    );
    const negativeTrack = under(
      workspace.root.recordsOfSource(METER)[0]!,
      "metertrack",
    ).map((record) => inputOf(record).derivedProps?.variant);
    expect(negativeTrack).toEqual(["negative"]);
    workspace.undo();
    workspace.showDefinition(button.id);
    expect(
      Object.keys(COMPONENT_RULES_TABLE.Meter.variants).filter(
        (variant) => !(variant in COMPONENT_RULES_TABLE.MeterTrack.variants),
      ),
    ).toEqual([]);
    const bounds = new Map(
      [...workspace.root.canvasInputs.keys()].flatMap((record) => {
        const rect = workspace.root.getGeometry([record]).get(record);
        return rect ? [[record, rect] as const] : [];
      }),
    );
    // Declared slots (pen.dev's design-system page: a component's master shows its slots
    // hatched, the instance beside it what fills them): a Tabs card's origin keeps its tab list
    // and panels laid out but not drawn — each slot hatched at that size — and the instance
    // beside it is filled (no mark); a Table's origin holds no columns or rows: its slots take a
    // box of their own.
    const slotMarks = catalogSlotMarks(workspace, bounds, bounds);
    const marksUnder = (record: string) =>
      slotMarks.filter((mark) =>
        inputOf(record).children.includes(mark.identity),
      );
    const tabsOrigin = recordOf(originSampleId(lib("tabs")));
    expect(
      marksUnder(tabsOrigin).map((mark) => [mark.empty, mark.role]),
    ).toEqual([
      [true, "origin"],
      [true, "origin"],
    ]);
    expect(
      marksUnder(tabsOrigin).every(
        (mark) => mark.box.width > 0 && mark.box.height > 0,
      ),
    ).toBe(true);
    // A slot that has a box is hatched at that box at every zoom (a zoomed-out Components page
    // must not grow it over the row below); only one of no height gets the visible band, which
    // never exceeds 48 scene px.
    for (const mark of marksUnder(tabsOrigin))
      for (const zoom of [0.1, 0.25, 1, 4])
        expect(catalogSlotBand(mark.box.height, zoom)).toBe(mark.box.height);
    expect([0.25, 1, 4].map((zoom) => catalogSlotBand(0, zoom))).toEqual([
      48, 48, 12,
    ]);
    expect(
      marksUnder(recordOf(originInstanceId(lib("tabs"), "instance"))),
    ).toEqual([]);
    const tableMarks = marksUnder(recordOf(originSampleId(lib("table"))));
    expect(tableMarks.map((mark) => [mark.empty, mark.role])).toEqual([
      [true, "origin"],
      [true, "origin"],
    ]);
    // ADR-277: the Table origin's header · body hold the starter (3 Columns · a Row) — laid out
    // but not drawn, so each slot keeps its contents' size (no 40px box of its own any more).
    expect(tableMarks.every((mark) => mark.box.height > 0)).toBe(true);
    expect(tableMarks.every((mark) => mark.box.width > 0)).toBe(true);
    // A collection whose root holds its items is itself the slot: the origin's root is hatched
    // as empty — what it holds is laid out but not drawn; the instance beside it is not marked.
    const listOrigin = recordOf(originSampleId(lib("listbox")));
    expect(inputOf(listOrigin).children.length).toBeGreaterThan(0);
    expect(
      inputOf(listOrigin).children.map(
        (child) => inputOf(child).visual.opacity,
      ),
    ).toEqual(inputOf(listOrigin).children.map(() => 0));
    expect(
      slotMarks
        .filter((mark) => mark.identity === listOrigin)
        .map((mark) => [
          mark.empty,
          mark.role,
          mark.box.width > 0,
          mark.box.height > 0,
        ]),
    ).toEqual([[true, "origin", true, true]]);
    const listInstance = recordOf(originInstanceId(lib("listbox"), "instance"));
    expect(slotMarks.filter((mark) => mark.identity === listInstance)).toEqual(
      [],
    );
    expect(
      inputOf(listInstance).children.map(
        (child) => inputOf(child).visual.opacity ?? 1,
      ),
    ).toEqual(inputOf(listInstance).children.map(() => 1));
    // The slot is the size its contents take (a ToggleButtonGroup's is its buttons' height, not
    // a fixed box) — one of each (2026-10-21: a root slot's repeated items lay out the first
    // only): the origin is no taller or wider than the filled instance, and a list's is shorter.
    for (const origin of [
      "togglebuttongroup",
      "buttongroup",
      "toolbar",
      "listbox",
    ]) {
      const empty = rectOf(originSampleId(lib(origin)));
      const filled = rectOf(originInstanceId(lib(origin), "instance"));
      expect([
        origin,
        empty.width <= filled.width,
        empty.height <= filled.height,
        empty.height > 0,
      ]).toEqual([origin, true, true, true]);
    }
    expect(rectOf(originSampleId(lib("listbox"))).height).toBeLessThan(
      rectOf(originInstanceId(lib("listbox"), "instance")).height,
    );
    // A Card's regions are its slots (S2 Card — ADR-256 Phase 10: preview, content, footer): the
    // origin hatches all three, the instance beside it only the footer it leaves empty.
    const slotNames = (record: string) =>
      marksUnder(record).map((mark) => inputOf(mark.identity).slot?.name);
    expect(slotNames(recordOf(originSampleId(lib("card"))))).toEqual([
      "Preview",
      "Content",
      "Footer",
    ]);
    expect(
      slotNames(recordOf(originInstanceId(lib("card"), "instance"))),
    ).toEqual(["Footer"]);
    // No Slots row: the origin shows them.
    const entryOf = (id: string) =>
      graphOf(workspace).getEntry(id) as NodeEntry;
    const tabsCard = catalogComponentsPageCards(graphOf(workspace))
      .map(entryOf)
      .find((candidate) => candidate.name === "Tabs")!;
    expect(tabsCard.children.map(entryOf).map((row) => row.name)).not.toContain(
      "Slots",
    );
    workspace.dispose();
  });
  it("Library page (2026-10-21): a trigger Button is a part, not an Item; a root slot lays out one of each; a FieldButton draws its glyph; a ContextualHelp's trigger holds one Icon", async () => {
    const { workspace } = await open();
    workspace.showDefinition(COMPONENTS_VIEW);
    const graph = graphOf(workspace);
    const nodeOf = (id: string) =>
      graph.getEntry(pageNode(workspace, id)) as NodeEntry;
    const cards = catalogComponentsPageCards(graph).map(nodeOf);
    const cardOf = (name: string) => {
      const card = cards.find((candidate) => candidate.name === name);
      if (!card)
        throw new Error(
          `no card "${name}" — cards: ${cards.map((c) => c.name).join(", ")}`,
        );
      return card;
    };
    const rowsOf = (name: string) =>
      cardOf(name)
        .children.slice(1)
        .map(nodeOf)
        .map((row) => row.name);
    // A picker's or an overlay's trigger is a Button held once, outside any slot: a part. Its
    // items (a Menu's, a Select's) are in a popup — no Item line (the Button card has the
    // states). Live 2026-10-21: 7 cards drew the Button's 5 states as their "Item".
    // (ADR-278: a Menu's items are in its `Items` slot, drawn open on the card — an Item line.)
    for (const name of [
      "Select",
      "SearchField",
      "Dialog",
      "Popover",
      "ContextualHelp",
      "Tooltip",
    ])
      expect([name, rowsOf(name)]).toEqual([
        name,
        expect.not.arrayContaining(["Item"]),
      ]);
    // Items held in a slot, or held more than once (a Pagination's buttons), stay items.
    for (const name of [
      "Pagination",
      "Toolbar",
      "Tabs",
      "ListBox",
      "Nav",
      "Menu",
    ])
      expect([name, rowsOf(name)]).toEqual([
        name,
        expect.arrayContaining(["Item"]),
      ]);
    const lib = (name: string) =>
      `lib:definition:origin-component-${name}` as LibraryDefinitionId;
    const recordOf = (id: string) =>
      workspace.root.recordsOfSource(pageNode(workspace, id))[0]!;
    const rectOf = (id: string) =>
      workspace.root.getGeometry([recordOf(id)]).get(recordOf(id))!;
    const inputOf = (record: string) =>
      workspace.root.canvasInputs.get(record)!;
    // A root slot holding repeated items (a ListBox's, a GridList's, a CardView's) lays out one
    // of each: the hatched box is an item's size, not the whole list's (live 2026-10-21: a
    // GridList's and a CardView's box was ~500px tall).
    for (const origin of ["listbox", "gridlist", "cardview"]) {
      const empty = rectOf(originSampleId(lib(origin)));
      const filled = rectOf(originInstanceId(lib(origin), "instance"));
      // (A CardView card holds its cells itself — user 2026-10-25: both are the card's width,
      // and three cards fit on one row of the filled one.)
      expect([origin, empty.height < filled.height || origin === "cardview"]).toEqual([
        origin,
        true,
      ]);
      // (A list's empty state IllustratedMessage is there too, hidden beside its items.)
      expect([
        origin,
        inputOf(recordOf(originSampleId(lib(origin)))).children.filter(
          (child) => !inputOf(child).hidden,
        ).length,
      ]).toEqual([origin, 1]);
    }
    const icons = (record: string): string[] =>
      inputOf(record).children.flatMap((child) => [
        ...(workspace.root.typeOf(inputOf(child)) === "Icon" ? [child] : []),
        ...icons(child),
      ]);
    // A FieldButton on its own (ADR-276: a Button instance, no label) draws a glyph — a
    // ComboBox's or DatePicker's instance sets its own. Live 2026-10-21: an empty card.
    expect(
      icons(recordOf(originSampleId(lib("fieldbutton")))).map(
        (icon) => inputOf(icon).props.iconName,
      ),
    ).toEqual(["chevron-down"]);
    // A ContextualHelp's trigger holds one Icon — the Button origin's icon slot takes the
    // variant's glyph (resolver). Live 2026-10-21: two glyphs (ADR-276 kept the trigger's own
    // Icon child beside the Button's).
    expect(
      icons(recordOf(originSampleId(lib("contextualhelp")))).map(
        (icon) => inputOf(icon).props.iconName,
      ),
    ).toEqual(["circle-question-mark"]);
    // The base parts close the page as a Parts section (user 2026-10-21: they opened it as if
    // components of their own), each titled as a part; the palette's components come first.
    const origins = catalogBuiltinOrigins(graph.library);
    const firstPart = origins.findIndex(
      (origin) => origin.category === "parts",
    );
    expect(firstPart).toBeGreaterThan(0);
    expect(
      origins.slice(firstPart).every((origin) => origin.category === "parts"),
    ).toBe(true);
    const titleOf = (name: string) =>
      (nodeOf(cardOf(name).children[0]!).props.children as { value: string })
        .value;
    expect(titleOf("Label")).toMatch(/\. LABEL · PART$/);
    expect(titleOf("Button")).toMatch(/\. BUTTON$/);
    // Categories (2026-10-21, Framer's "what you are adding" grouping): value displays with
    // ProgressBar, Menu and Section with the layout · navigation group, AvatarGroup with Avatar.
    const palette = getPaletteItems();
    const categoryOf = (name: string) =>
      palette.find((item) => item.type === name)!.category;
    expect(
      ["Meter", "Menu", "Section", "AvatarGroup", "CardView"].map(categoryOf),
    ).toEqual(["content", "layout", "layout", "content", "layout"]);
    // ADR-278 (user decision 2): an overlay origin's card draws its body open beside the
    // trigger — the Origin line's ◆ trigger, then the Modal · Popover · Tooltip to its right,
    // with a size; a picker's Popover (a Select's list) stays closed. The page's own instances
    // and the page canvas keep every overlay closed (`adr278OverlayBodySlot`).
    const overlayOf = (origin: string, type: string) => {
      const sample = recordOf(originSampleId(lib(origin)));
      const under = (id: string): string[] => [
        id,
        ...inputOf(id).children.flatMap(under),
      ];
      const id = under(sample).find(
        (record) => workspace.root.typeOf(inputOf(record)) === type,
      );
      expect(id, `${origin}: no ${type}`).toBeDefined();
      return id!;
    };
    for (const [origin, type] of [
      ["dialog", "Modal"],
      ["popover", "Popover"],
      ["tooltip", "Tooltip"],
      ["contextualhelp", "Popover"],
      ["menu", "Popover"],
    ] as const) {
      const overlay = overlayOf(origin, type);
      expect([origin, inputOf(overlay).hidden ?? false]).toEqual([
        origin,
        false,
      ]);
      const sample = recordOf(originSampleId(lib(origin)));
      const trigger = inputOf(sample).children[0]!;
      const box = workspace.root.getGeometry([overlay, trigger]);
      const body = box.get(overlay)!;
      const button = box.get(trigger)!;
      expect([origin, body.width > 0 && body.height > 0]).toEqual([
        origin,
        true,
      ]);
      expect([origin, body.x >= button.x + button.width]).toEqual([
        origin,
        true,
      ]);
    }
    expect(inputOf(overlayOf("select", "Popover")).hidden).toBe(true);
    workspace.dispose();
  });
});

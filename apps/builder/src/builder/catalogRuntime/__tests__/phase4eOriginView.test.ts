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
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import { resolveCatalogNode } from "../../../../../../packages/shared/src/catalog/resolution/resolver";
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
import {
  catalogComponentsPageCards,
  COMPONENTS_PAGE_WIDTH,
} from "../componentsPage";
import { catalogBuiltinOrigins } from "../layouts";
import {
  CatalogOriginEditError,
  COMPONENTS_VIEW,
  ORIGIN_VIEW_NODE,
  originCardId,
  originInstanceId,
  originSampleId,
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
  // IconButton: its origin root takes `label` (a Button's text is a template child).
  const button = catalogBuiltinOrigins(library).find(
    (origin) => origin.name === "IconButton",
  )!;
  // An IconButton placed on the page (an instance of the origin).
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
      expect.arrayContaining(["Button", "IconButton", "TextField"]),
    );
  });

  it("opening an origin shows the Components page (never part of the document) with its sample selected", async () => {
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
      workspace.itemsOfNode(originCardId(button.id), 1)[0]!.identity,
    ]);
    expect(
      workspace.session.getSnapshot().selection.map((item) => item.target),
    ).toEqual([{ kind: "node", id: sampleId }]);
    const roots = [...workspace.root.domInputs.values()].filter(
      (record) => record.parentId === "catalog:root",
    );
    expect(roots.map((record) => record.sourceId)).toEqual([ORIGIN_VIEW_NODE]);
    // Layers: the page lists a group per card (theme, then components in palette order); a
    // component's group holds its origin and its instances side by side —
    // the column, line and cell frames are not rows.
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
    expect(root!.hasChildren).toBe(true);
    const cardRow = (id: string) =>
      workspace.itemsOfNode(id as NodeId, 1)[0]!.identity;
    const buttonCard = cardRow(originCardId(button.id));
    const fieldCard = cardRow(
      originCardId(
        "lib:definition:origin-component-textfield" as typeof button.id,
      ),
    );
    store.setExpanded(new Set([root!.id, buttonCard, fieldCard]));
    const groups = store.getSnapshot()[0]!.children!;
    expect(groups.map((row) => row.name)).toEqual([
      "Colors",
      "Typography",
      "Icons",
      "Spacing",
      ...catalogBuiltinOrigins(library).map((origin) => origin.name),
    ]);
    expect(groups.every((row) => row.role === undefined)).toBe(true);
    // A theme group lists its values.
    store.setExpanded(
      new Set([root!.id, buttonCard, fieldCard, groups[3]!.id]),
    );
    const groupOf = (id: string) =>
      store.getSnapshot()[0]!.children!.find((row) => row.id === id)!;
    expect(groupOf(groups[3]!.id).children!.map((row) => row.name)).toEqual([
      "md",
      "2xs",
      "xs",
      "sm",
      "lg",
      "xl",
      "2xl",
    ]);
    // IconButton: the origin, then 6 variants × (rest + 4 states).
    const [originRow, ...instances] = groupOf(buttonCard).children!;
    expect(originRow!.role).toBe("origin");
    expect(originRow!.name).toBe("IconButton");
    expect(instances.every((row) => row.role === "instance")).toBe(true);
    expect(instances.map((row) => row.name).slice(0, 2)).toEqual([
      "IconButton / Accent / Default",
      "IconButton / Accent / Disabled",
    ]);
    expect(instances.length).toBe(30);
    // The origin's own row holds only its template (not the instances again).
    expect(originRow!.hasChildren).toBe(true);
    // (No row draws the origin again for its parts: a card's first row is its origin, the rest
    // its instances.)
    expect(groupOf(fieldCard).children![0]!.name).toBe("TextField");
    expect(
      groupOf(fieldCard)
        .children!.map((row) => row.name)
        .filter((name) => name.endsWith("/ Parts")),
    ).toEqual([]);
    expect(catalogComponentRole(graphOf(workspace), sampleId)).toBe("origin");
    const hover = originInstanceId(button.id, "primary/Hover");
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
    const caption = [...records.values()].find((record) =>
      record.sourceId.endsWith(`${button.id}/cell/primary/Hover/caption`),
    )!;
    expect(resolveCatalogClickRecord(records, caption.id, undefined)).toBe(
      recordOf(originCardId(button.id)),
    );
    for (const id of [sampleId, hover])
      expect(resolveCatalogClickRecord(records, recordOf(id), undefined)).toBe(
        recordOf(id),
      );
    // Not in the document, the instance index, or exports.
    const exported = graphOf(workspace).exportDocument().entries;
    expect(exported[ORIGIN_VIEW_NODE]).toBe(undefined);
    expect(exported[sampleId]).toBe(undefined);
    expect([...graphOf(workspace).instancesOf(button.id)]).toEqual([PLACED]);
    workspace.showDefinition(undefined);
    expect(graphOf(workspace).getEntry(ORIGIN_VIEW_NODE)).toBe(undefined);
    expect(graphOf(workspace).viewEntryIds()).toEqual([]);
    workspace.dispose();
  });

  it("the page: a card per built-in origin over balanced columns — variants × states, captions", async () => {
    const { workspace, library } = await open();
    workspace.showDefinition(COMPONENTS_VIEW);
    const graph = graphOf(workspace);
    const nodeOf = (id: string) => graph.getEntry(id) as NodeEntry;
    // Every palette origin has one card, whichever column it is on.
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
    expect(
      cards
        .find((candidate) => candidate.name === "Colors")!
        .children.slice(1)
        .map((id) => nodeOf(id).name),
    ).toEqual(["Origin", "Accent", "Neutral", "Negative", "Border", "Surface"]);
    expect(themeNode("typography/text-xl/sample").visual).toMatchObject({
      fontSize: { kind: "set", value: 20 },
    });
    expect(themeNode("icons/search/sample").props).toEqual({
      iconName: { kind: "set", value: "search" },
    });
    // A theme card reads as a component card: its base value as the origin, the rest as instances.
    const themeCells = (row: NodeEntry) =>
      nodeOf(row.children[1]!).children.map(nodeOf);
    const spacingRows = cards
      .find((candidate) => candidate.name === "Spacing")!
      .children.slice(1)
      .map(nodeOf);
    expect(spacingRows.map((row) => row.name)).toEqual(["Origin", "Sizes"]);
    expect(themeCells(spacingRows[0]!).map((cell) => cell.name)).toEqual([
      "◆ md",
    ]);
    expect(themeCells(spacingRows[1]!)[0]!.name).toBe("◇ 2xs");
    const colorRows = cards
      .find((candidate) => candidate.name === "Colors")!
      .children.slice(1)
      .map(nodeOf);
    expect(themeCells(colorRows[0]!).map((cell) => cell.name)).toEqual(
      expect.arrayContaining(["◆ accent", "◆ neutral", "◆ base"]),
    );
    expect(themeCells(colorRows[1]!).map((cell) => cell.name)).toEqual(
      expect.arrayContaining(["◇ hover", "◇ on-accent"]),
    );
    expect(themeNode("spacing/md/sample").sizing).toMatchObject({
      width: { kind: "set", value: 16 },
    });
    const card = cards.find((candidate) => candidate.name === "Button")!;
    const [title, ...rows] = card.children.map(nodeOf);
    expect(title!.name).toMatch(/^\d\d\. BUTTON$/);
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
    const cellsOf = (row: NodeEntry) =>
      nodeOf(row.children[1]!).children.map(nodeOf);
    const sampleOf = (cell: NodeEntry) => nodeOf(cell.children[0]!);
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
    const field = cards.find((candidate) => candidate.name === "TextField")!;
    expect(field.children.map(nodeOf).map((row) => row.name)).not.toContain(
      "Parts",
    );
    // A collection shows its item origin's states (not its own variants — they only tint its
    // hover): the item drawn on its own, its label filled in and its placeholders off.
    const grid = cards.find((candidate) => candidate.name === "GridList")!;
    const gridRows = grid.children.slice(1).map(nodeOf);
    expect(gridRows.map((row) => row.name)).toEqual(["Origin", "Item"]);
    // A field with a control Group (ADR-256 Phase 6b — a ComboBox's list items sit in its ListBox
    // part) is not a collection: no Item line.
    const combo = cards.find((candidate) => candidate.name === "ComboBox")!;
    expect(combo.children.slice(1).map(nodeOf).map((row) => row.name)).not.toContain(
      "Item",
    );
    // The Origin row: the origin (its slot empty) and an instance of it (the slot filled).
    expect(cellsOf(gridRows[0]!).map((cell) => cell.name)).toEqual([
      "◆ GridList",
      "◇ GridList",
    ]);
    const itemCells = cellsOf(gridRows[1]!);
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
    const chartRows = cards
      .find((candidate) => candidate.name === "Chart")!
      .children.slice(1)
      .map(nodeOf);
    expect(chartRows.map((row) => row.name)).toEqual([
      "Origin",
      "Variants",
      "Types",
    ]);
    const chartTypes = cellsOf(chartRows[2]!);
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
    // The page keeps its own width whatever the viewport, and its columns are balanced by the
    // cards' drawn heights: no column is taller than the shortest by more than its last card
    // (and the gap under it — each next card goes on the column lightest so far, gap included).
    const rectOf = (id: string) => {
      const [record] = workspace.root.recordsOfSource(id);
      return workspace.root.getGeometry([record!]).get(record!)!;
    };
    expect(rectOf(ORIGIN_VIEW_NODE).width).toBe(COMPONENTS_PAGE_WIDTH);
    // The chart types are drawn two to a line (each half the card's inner width).
    const chartRects = chartTypes.map((cell) => rectOf(sampleOf(cell).id));
    expect(chartRects.map((rect) => rect.width)).toEqual(
      chartTypes.map(() => 248),
    );
    expect(chartRects.every((rect) => rect.height > 0)).toBe(true);
    // A Menu draws its trigger button: its items are in the popover (not on the Canvas), so its
    // box is its trigger's — the Button's metrics at the same size (padding, min width).
    const menuRect = rectOf(
      originSampleId(
        "lib:definition:origin-component-menu" as LibraryDefinitionId,
      ),
    );
    const buttonRect = rectOf(
      originSampleId(
        "lib:definition:origin-component-button" as LibraryDefinitionId,
      ),
    );
    expect([menuRect.width, menuRect.height]).toEqual([
      buttonRect.width,
      buttonRect.height,
    ]);
    const columns = nodeOf(ORIGIN_VIEW_NODE).children.map((id) => ({
      height: rectOf(id).height,
      last: rectOf(nodeOf(id).children.at(-1)!).height,
    }));
    const shortest = Math.min(...columns.map((column) => column.height));
    for (const column of columns)
      expect(column.height - column.last).toBeLessThanOrEqual(shortest + 24);
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
    // An instance beside the origin and the page's own frames take no edits.
    for (const id of [
      originInstanceId(button.id, "primary/Hover"),
      ORIGIN_VIEW_NODE,
    ])
      expect(() =>
        workspace.execute(
          setFields({
            targets: [{ kind: "node", id }],
            visual: { paddingTop: { kind: "set", value: 4 } },
          }),
        ),
      ).toThrow(CatalogOriginEditError);
    expect(workspace.history.getSnapshot().labels.length).toBe(steps);
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
    const recordOf = (id: string) => workspace.root.recordsOfSource(id)[0]!;
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
      ...["sm", "md", "lg"].map((size) => ["progresscircle", size] as const),
      ...[
        "select",
        "combobox",
        "datepicker",
        "daterangepicker",
        "numberfield",
      ].flatMap((origin) => [[origin, "xs"] as const, [origin, "xl"] as const]),
      ["avatargroup", "xl"] as const,
      ["buttongroup", "xs"] as const,
      ["calendar", "sm"] as const,
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
      ["sm", 24],
      ["md", 32],
      ["lg", 64],
    ] as const) {
      const rect = rectOf(sized("progresscircle", key));
      expect([rect.width, rect.height]).toEqual([diameter, diameter]);
    }
    // A field's button is a FieldButton instance (ComboBox · DatePicker · DateRangePicker), a
    // Select's trigger a Button instance (ADR-253): the glyph is the Button's scale.
    const buttonGlyphs = (origin: string, size: string) =>
      under(recordOf(sized(origin, size)), "icon").map(
        (record) => inputOf(record).visual.iconSize,
      );
    for (const origin of [
      "combobox",
      "select",
      "datepicker",
      "daterangepicker",
    ]) {
      expect(buttonGlyphs(origin, "xs")).toEqual([14]);
      expect(buttonGlyphs(origin, "xl")).toEqual([28]);
    }
    // A NumberField's steppers are Button instances (ADR-253): their glyphs are the Button's scale.
    expect(buttonGlyphs("numberfield", "xs")).toEqual([14, 14]);
    expect(buttonGlyphs("numberfield", "xl")).toEqual([28, 28]);
    // A group's size reaches its members; a calendar's its header and grid.
    const sizesUnder = (origin: string, size: string, binding: string) =>
      under(recordOf(sized(origin, size)), binding).map(
        (record) => inputOf(record).props.size,
      );
    expect(sizesUnder("avatargroup", "xl", "avatar")).toEqual([
      "xl",
      "xl",
      "xl",
    ]);
    expect(sizesUnder("buttongroup", "xs", "button")).toEqual(["xs", "xs"]);
    expect(sizesUnder("calendar", "sm", "calendargrid")).toEqual(["sm"]);
    expect(sizesUnder("calendar", "sm", "calendarheader")).toEqual(["sm"]);
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
    // A ProgressBar's track takes its owner's variant: the track rule paints every one of them
    // (a missing variant painted no track).
    const neutralTrack = under(
      recordOf(originInstanceId(lib("progressbar"), "neutral")),
      "progressbartrack",
    ).map((record) => inputOf(record).derivedProps?.variant);
    expect(neutralTrack).toEqual(["neutral"]);
    expect(
      Object.keys(COMPONENT_RULES_TABLE.ProgressBar.variants).filter(
        (variant) =>
          !(variant in COMPONENT_RULES_TABLE.ProgressBarTrack.variants),
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
    expect(tableMarks.every((mark) => mark.box.height >= 40)).toBe(true);
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
    // a fixed box): the origin measures what the filled instance does.
    for (const origin of [
      "togglebuttongroup",
      "buttongroup",
      "toolbar",
      "listbox",
    ]) {
      const empty = rectOf(originSampleId(lib(origin)));
      const filled = rectOf(originInstanceId(lib(origin), "instance"));
      expect([origin, empty.width, empty.height]).toEqual([
        origin,
        filled.width,
        filled.height,
      ]);
    }
    // A Card's regions are its slots (pen.dev's Card master: header, content, actions): the
    // origin hatches all four, the instance beside it only the footer it leaves empty.
    const slotNames = (record: string) =>
      marksUnder(record).map((mark) => inputOf(mark.identity).slot?.name);
    expect(slotNames(recordOf(originSampleId(lib("card"))))).toEqual([
      "Preview",
      "Header",
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
});

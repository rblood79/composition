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
  originPartsId,
  originSampleId,
  originSlotsId,
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
    // component's group holds its origin, the origin's parts and its instances side by side —
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
    const cardRow = (id: string) => workspace.itemsOfNode(id as NodeId, 1)[0]!.identity;
    const buttonCard = cardRow(originCardId(button.id));
    const fieldCard = cardRow(
      originCardId("lib:definition:origin-component-textfield" as typeof button.id),
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
    store.setExpanded(new Set([root!.id, buttonCard, fieldCard, groups[3]!.id]));
    const groupOf = (id: string) =>
      store.getSnapshot()[0]!.children!.find((row) => row.id === id)!;
    expect(groupOf(groups[3]!.id).children!.map((row) => row.name)).toEqual([
      "md", "2xs", "xs", "sm", "lg", "xl", "2xl",
    ]);
    // IconButton: the origin, the origin drawn for its parts, then 6 variants × (rest + 4
    // states) + 5 sizes.
    const [originRow, partsRow, ...instances] = groupOf(buttonCard).children!;
    expect(originRow!.role).toBe("origin");
    expect(originRow!.name).toBe("IconButton");
    expect(partsRow!.name).toBe("IconButton / Parts");
    expect(partsRow!.role).toBe("instance");
    expect(instances.every((row) => row.role === "instance")).toBe(true);
    expect(instances.map((row) => row.name).slice(0, 2)).toEqual([
      "IconButton / Accent / Default",
      "IconButton / Accent / Disabled",
    ]);
    expect(instances.length).toBe(35);
    // The origin's own row holds only its template (not the instances again).
    expect(originRow!.hasChildren).toBe(true);
    expect(
      groupOf(fieldCard)
        .children!.slice(0, 2)
        .map((row) => row.name),
    ).toEqual(["TextField", "TextField / Parts"]);
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
    const recordOf = (id: string) => workspace.itemsOfNode(id as NodeId, 1)[0]!.identity;
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

  it("the page: a card per built-in origin over balanced columns — variants × states, sizes, captions", async () => {
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
    expect(themeCells(spacingRows[0]!).map((cell) => cell.name)).toEqual(["◆ md"]);
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
    // The origin, then its instances: a line per variant and the sizes.
    expect(rows.map((row) => row.name)).toEqual([
      "Origin",
      "Accent",
      "Primary",
      "Secondary",
      "Negative",
      "Premium",
      "Genai",
      "Sizes",
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
    // A composed origin shows its parts in place: the origin once more (an instance of it),
    // captioned with one name per kind of template child (◇ = another origin's instance).
    const field = cards.find((candidate) => candidate.name === "TextField")!;
    const parts = field.children.map(nodeOf).find((row) => row.name === "Parts")!;
    expect(cellsOf(parts).map((cell) => cell.name)).toEqual([
      "Label · Input · FieldError",
    ]);
    const fieldParts = sampleOf(cellsOf(parts)[0]!);
    expect(fieldParts.id).toBe(
      originPartsId("lib:definition:origin-component-textfield" as LibraryDefinitionId),
    );
    expect(fieldParts.definitionId).toBe("lib:definition:origin-component-textfield");
    const toolbar = cards.find((candidate) => candidate.name === "Toolbar")!;
    expect(
      cellsOf(
        toolbar.children.map(nodeOf).find((row) => row.name === "Parts")!,
      ).map((cell) => cell.name),
    ).toEqual(["◇ Button ×3 · Separator"]);
    // A collection shows its item origin's states (not its own variants — they only tint its
    // hover): the item drawn on its own, its label filled in and its placeholders off.
    const grid = cards.find((candidate) => candidate.name === "GridList")!;
    const gridRows = grid.children.slice(1).map(nodeOf);
    expect(gridRows.map((row) => row.name)).toEqual([
      "Origin",
      "Parts",
      "Slots",
      "Item states",
    ]);
    const itemCells = cellsOf(gridRows[3]!);
    expect(itemCells.map((cell) => sampleOf(cell).definitionId)).toEqual(
      ["", "--unselected", "--disabled", "--hover", "--pressed", "--focus-visible"].map(
        (state) => `lib:definition:origin-component-gridlist-item-default${state}`,
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
    expect(
      cellsOf(rows.at(-1)!).map((cell) => sampleOf(cell).props.size),
    ).toEqual(
      ["xs", "sm", "md", "lg", "xl"].map((value) => ({ kind: "set", value })),
    );
    // The page keeps its own width whatever the viewport, and its columns are balanced by the
    // cards' drawn heights: no column is taller than the shortest by more than its last card.
    const rectOf = (id: string) => {
      const [record] = workspace.root.recordsOfSource(id);
      return workspace.root.getGeometry([record!]).get(record!)!;
    };
    expect(rectOf(ORIGIN_VIEW_NODE).width).toBe(COMPONENTS_PAGE_WIDTH);
    // A Menu draws its trigger button: its items are in the popover (not on the Canvas), so its
    // box is its trigger's — the Button's metrics at the same size (padding, min width).
    const menuRect = rectOf(
      originSampleId("lib:definition:origin-component-menu" as LibraryDefinitionId),
    );
    const buttonRect = rectOf(
      originSampleId("lib:definition:origin-component-button" as LibraryDefinitionId),
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
      expect(column.height - column.last).toBeLessThanOrEqual(shortest);
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
    expect(
      (graphOf(workspace).getEntry(SAMPLE) as NodeEntry).props,
    ).toEqual({ label: { kind: "set", value: "Go" } });
    expect(placedLabel(workspace)).toBe("Go");
    // The panels read it as the sample's own value (resettable).
    expect(
      workspace.readModel.ownFields({ kind: "node", id: SAMPLE })
        .props,
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
    expect(
      catalogComponentState(graph, SAMPLE, COMPONENTS_VIEW),
    ).toMatchObject({
      originOf: {
        definitionId: button.id,
        project: false,
        instanceIds: [PLACED],
      },
    });
    expect(catalogComponentState(graph, PLACED, COMPONENTS_VIEW)).toMatchObject({
      instanceOf: {
        definitionId: button.id,
        project: false,
        instanceIds: [PLACED],
      },
    });
    workspace.dispose();
  });
  it("draws each origin as the DOM sizes it: circle height, owner-sized glyphs and members, track variants, parts in place", async () => {
    const { workspace, button } = await open();
    workspace.showDefinition(button.id);
    const lib = (name: string) =>
      `lib:definition:origin-component-${name}` as LibraryDefinitionId;
    const recordOf = (id: string) => workspace.root.recordsOfSource(id)[0]!;
    const rectOf = (id: string) =>
      workspace.root.getGeometry([recordOf(id)]).get(recordOf(id))!;
    const inputOf = (record: string) => workspace.root.canvasInputs.get(record)!;
    const under = (record: string, binding: string): string[] =>
      inputOf(record).children.flatMap((child) => [
        ...(inputOf(child).bindingId === binding ? [child] : []),
        ...under(child, binding),
      ]);
    // A ProgressCircle is its diameter square (the `progress` archetype drops a bar's height).
    for (const [key, diameter] of [["sm", 24], ["md", 32], ["lg", 64]] as const) {
      const rect = rectOf(originInstanceId(lib("progresscircle"), `size/${key}`));
      expect([rect.width, rect.height]).toEqual([diameter, diameter]);
    }
    // A trigger glyph follows its owner's size (the DOM sizes the svg from the owner's `size`).
    const glyphs = (origin: string, size: string) =>
      under(recordOf(originInstanceId(lib(origin), `size/${size}`)), "selecticon").map(
        (record) => inputOf(record).visual.iconSize,
      );
    for (const origin of ["select", "combobox", "datepicker", "daterangepicker"]) {
      expect(glyphs(origin, "xs")).toEqual([14]);
      expect(glyphs(origin, "xl")).toEqual([28]);
    }
    // A NumberField's stepper glyphs are its own scale (`--nf-btn-icon-size`).
    expect(glyphs("numberfield", "xs")).toEqual([10, 10]);
    expect(glyphs("numberfield", "xl")).toEqual([22, 22]);
    // A group's size reaches its members; a calendar's its header and grid.
    const sizesUnder = (origin: string, size: string, binding: string) =>
      under(recordOf(originInstanceId(lib(origin), `size/${size}`)), binding).map(
        (record) => inputOf(record).props.size,
      );
    expect(sizesUnder("avatargroup", "xl", "avatar")).toEqual(["xl", "xl", "xl"]);
    expect(sizesUnder("buttongroup", "xs", "button")).toEqual(["xs", "xs"]);
    expect(sizesUnder("calendar", "sm", "calendargrid")).toEqual(["sm"]);
    expect(sizesUnder("calendar", "sm", "calendarheader")).toEqual(["sm"]);
    // A ProgressBar's track takes its owner's variant: the track rule paints every one of them
    // (a missing variant painted no track).
    const neutralTrack = under(
      recordOf(originInstanceId(lib("progressbar"), "neutral")),
      "progressbartrack",
    ).map((record) => inputOf(record).derivedProps?.variant);
    expect(neutralTrack).toEqual(["neutral"]);
    expect(
      Object.keys(COMPONENT_RULES_TABLE.ProgressBar.variants).filter(
        (variant) => !(variant in COMPONENT_RULES_TABLE.ProgressBarTrack.variants),
      ),
    ).toEqual([]);
    // The parts instance: the origin once more; the chrome outlines each drawn part.
    const parts = recordOf(originPartsId(lib("textfield")));
    const bounds = new Map(
      [...workspace.root.canvasInputs.keys()].flatMap((record) => {
        const rect = workspace.root.getGeometry([record]).get(record);
        return rect ? [[record, rect] as const] : [];
      }),
    );
    const regions = catalogSlotMarks(workspace, bounds, bounds).filter(
      (mark) => mark.region,
    );
    const fieldRegions = regions.filter((mark) =>
      inputOf(parts).children.includes(mark.identity),
    );
    expect(fieldRegions.length).toBeGreaterThanOrEqual(1);
    expect(fieldRegions.every((mark) => mark.role === "instance" && !mark.empty)).toBe(
      true,
    );
    expect(
      regions.every((mark) => mark.box.width > 0 && mark.box.height > 0),
    ).toBe(true);
    // Declared slots (pen.dev's design-system page: a container's master shows its slots
    // hatched, the filled instance beside it): a Tabs card draws its origin filled (no mark)
    // and a Slots instance with its tab list and panels emptied — each hatched at a box of its
    // own; a Table's origin holds no columns or rows, so its own slots are hatched.
    const slotMarks = catalogSlotMarks(workspace, bounds, bounds).filter(
      (mark) => !mark.region,
    );
    const marksUnder = (record: string) =>
      slotMarks.filter((mark) => inputOf(record).children.includes(mark.identity));
    const tabsSlots = recordOf(originSlotsId(lib("tabs")));
    expect(marksUnder(tabsSlots).map((mark) => [mark.empty, mark.role])).toEqual([
      [true, "instance"],
      [true, "instance"],
    ]);
    expect(
      marksUnder(tabsSlots).every((mark) => mark.box.width > 0 && mark.box.height > 0),
    ).toBe(true);
    // A slot that has a box is hatched at that box at every zoom (a zoomed-out Components page
    // must not grow it over the row below); only one of no height gets the visible band, which
    // never exceeds 48 scene px.
    for (const mark of marksUnder(tabsSlots))
      for (const zoom of [0.1, 0.25, 1, 4])
        expect(catalogSlotBand(mark.box.height, zoom)).toBe(mark.box.height);
    expect([0.25, 1, 4].map((zoom) => catalogSlotBand(0, zoom))).toEqual([48, 48, 12]);
    expect(marksUnder(recordOf(originSampleId(lib("tabs"))))).toEqual([]);
    expect(
      marksUnder(recordOf(originSampleId(lib("table")))).map((mark) => [
        mark.empty,
        mark.role,
      ]),
    ).toEqual([
      [true, "origin"],
      [true, "origin"],
    ]);
    // A collection whose root holds its items is itself the slot: its Slots instance is the
    // root hatched as empty — what it holds is laid out but not drawn; the filled origin is not
    // marked.
    const listSlots = recordOf(originSlotsId(lib("listbox")));
    expect(inputOf(listSlots).children.length).toBeGreaterThan(0);
    expect(
      inputOf(listSlots).children.map((child) => inputOf(child).visual.opacity),
    ).toEqual(inputOf(listSlots).children.map(() => 0));
    expect(
      slotMarks
        .filter((mark) => mark.identity === listSlots)
        .map((mark) => [mark.empty, mark.role, mark.box.width > 0, mark.box.height > 0]),
    ).toEqual([[true, "instance", true, true]]);
    expect(
      slotMarks.filter(
        (mark) => mark.identity === recordOf(originSampleId(lib("listbox"))),
      ),
    ).toEqual([]);
    // The slot is the size its contents take (a ToggleButtonGroup's is its buttons' height, not
    // a fixed box): the Slots instance measures what the filled origin does.
    for (const origin of ["togglebuttongroup", "buttongroup", "toolbar", "listbox"]) {
      const filled = rectOf(originSampleId(lib(origin)));
      const slots = rectOf(originSlotsId(lib(origin)));
      expect([origin, slots.width, slots.height]).toEqual([
        origin,
        filled.width,
        filled.height,
      ]);
    }
    const entryOf = (id: string) => graphOf(workspace).getEntry(id) as NodeEntry;
    const tabsCard = catalogComponentsPageCards(graphOf(workspace))
      .map(entryOf)
      .find((candidate) => candidate.name === "Tabs")!;
    const slotsRow = tabsCard.children.map(entryOf).find((row) => row.name === "Slots")!;
    expect(
      entryOf(slotsRow.children[1]!).children.map((cell) => entryOf(cell).name),
    ).toEqual(["Tabs · Panels"]);
    workspace.dispose();
  });
});

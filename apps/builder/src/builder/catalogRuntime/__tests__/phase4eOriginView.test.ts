import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { resolveToken } from "@composition/rendering";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { resolveCatalogNode } from "../../../../../../packages/shared/src/catalog/resolution/resolver";
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
    workspace.showDefinition(button.id);
    expect(workspace.session.getSnapshot().definitionView).toBe(
      COMPONENTS_VIEW,
    );
    expect(
      workspace.session.getSnapshot().selection.map((item) => item.target),
    ).toEqual([{ kind: "node", id: sampleId }]);
    const roots = [...workspace.root.domInputs.values()].filter(
      (record) => record.parentId === "catalog:root",
    );
    expect(roots.map((record) => record.sourceId)).toEqual([ORIGIN_VIEW_NODE]);
    // Layers: the page lists its origins (palette order), an origin its instances — the card,
    // line and cell frames are not rows.
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
    const [sampleItem] = workspace.itemsOfNode(sampleId, 1);
    store.setExpanded(new Set([root!.id, sampleItem!.identity]));
    const pageRows = store.getSnapshot()[0]!.children!;
    expect(pageRows.slice(0, 4).map((row) => row.name)).toEqual([
      "Colors",
      "Typography",
      "Icons",
      "Spacing",
    ]);
    const originRows = pageRows.slice(4);
    expect(originRows.map((row) => row.name)).toEqual(
      catalogBuiltinOrigins(library).map((origin) => origin.name),
    );
    expect(originRows.every((row) => row.role === "origin")).toBe(true);
    const buttonRow = originRows.find((row) => row.id === sampleItem!.identity)!;
    // IconButton: its parts (template positions), then 6 variants × (rest + 4 states) + 5 sizes.
    const [icon, label, ...instances] = buttonRow.children!;
    expect([icon!.typeName, label!.typeName]).toEqual(["Icon", "Text"]);
    expect([icon!.role, label!.role]).toEqual([undefined, undefined]);
    expect(instances.every((row) => row.role === "instance")).toBe(true);
    expect(instances.map((row) => row.name).slice(0, 2)).toEqual([
      "IconButton / Accent / Default",
      "IconButton / Accent / Disabled",
    ]);
    expect(instances.length).toBe(35);
    const [fieldItem] = workspace.itemsOfNode(
      originSampleId("lib:definition:origin-component-textfield" as typeof button.id),
      1,
    );
    store.setExpanded(new Set([root!.id, fieldItem!.identity]));
    const fieldRow = store
      .getSnapshot()[0]!
      .children!.find((row) => row.id === fieldItem!.identity)!;
    expect(fieldRow.children!.slice(0, 3).map((row) => row.typeName)).toEqual([
      "Label",
      "Input",
      "FieldError",
    ]);
    expect(catalogComponentRole(graphOf(workspace), sampleId)).toBe("origin");
    const hover = originInstanceId(button.id, "primary/Hover");
    expect(catalogComponentRole(graphOf(workspace), hover)).toBe("instance");
    // Every drawn node has a position (selection, panels): the Button origin and its states.
    for (const id of [sampleId, hover]) {
      const [item] = workspace.itemsOfNode(id, 1);
      expect(workspace.positionOfRecord(item!.identity)).toBeDefined();
    }
    // A Canvas click picks the sample or instance under it; the page's own frames pick the page.
    const records = workspace.root.domInputs;
    const recordOf = (id: string) => workspace.itemsOfNode(id as NodeId, 1)[0]!.identity;
    const caption = [...records.values()].find((record) =>
      record.sourceId.endsWith("/cell/primary/Hover/caption"),
    )!;
    expect(resolveCatalogClickRecord(records, caption.id, undefined)).toBe(
      recordOf(ORIGIN_VIEW_NODE),
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
    expect(themeNode("colors/accent/swatch").visual).toMatchObject({
      backgroundColor: {
        kind: "set",
        value: resolveToken("{color.accent}", "light"),
      },
    });
    expect(themeNode("typography/text-xl/sample").visual).toMatchObject({
      fontSize: { kind: "set", value: 20 },
    });
    expect(themeNode("icons/search/icon").props).toEqual({
      iconName: { kind: "set", value: "search" },
    });
    expect(themeNode("spacing/md/box").sizing).toMatchObject({
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
    // A composed origin is taken apart: one cell per kind of template child.
    const field = cards.find((candidate) => candidate.name === "TextField")!;
    const parts = field.children.map(nodeOf).find((row) => row.name === "Parts")!;
    expect(cellsOf(parts).map((cell) => cell.name)).toEqual([
      "Label",
      "Input",
      "FieldError",
    ]);
    const toolbar = cards.find((candidate) => candidate.name === "Toolbar")!;
    expect(
      cellsOf(
        toolbar.children.map(nodeOf).find((row) => row.name === "Parts")!,
      ).map((cell) => cell.name),
    ).toEqual(["◇ Button ×3", "Separator"]);
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
});

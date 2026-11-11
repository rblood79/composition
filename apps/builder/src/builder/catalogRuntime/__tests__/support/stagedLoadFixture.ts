import "fake-indexeddb/auto";
import { CatalogGraph } from "../../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CatalogDocument,
  CatalogLibrary,
  CollectionEntry,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  createLayout,
  createPage,
  detachInstances,
  insertNodes,
} from "../../../../../../../packages/shared/src/catalog/commands";
import { CatalogCompositionRoot } from "../../compositionRoot";
import { CatalogRuntime } from "../../controller";
import { catalogCollectionTables } from "../../catalogDataRead";
import { catalogBoundRows } from "../../dataBinding";
import { catalogPageCommands, catalogPageLayouts } from "../../pageSettings";
import { catalogPaletteDefinitionId } from "../../paletteInsert";
import { newCatalogProjectDocument } from "../../project";
import { CatalogStorage } from "../../storage";
import { CatalogWorkspace } from "../../workspace";
import type { LayoutEngineAPI } from "../../../workspace/canvas/wasm-bindings/layoutBridge";
import { nodeLayoutEngine } from "./nodeLayoutEngine";

/**
 * ADR-307 — the staged-load test document: pages of flex · grid · palette instances · a bound list ·
 * fixed · sticky · overlays · a content-height page · a page whose body is a layout's instance.
 * Authored once through a workspace; each `buildStagedRoot` reads its own copy.
 */
export const STAGED_PROJECT = "project:project:staged" as EntryId<"project">;
const COLLECTION = "data:collection:rows";
const id = (name: string) => `project:node:${name}` as NodeId;
const set = <T>(value: T) => ({ kind: "set" as const, value });
type Style = Partial<Pick<NodeEntry, "visual" | "sizing" | "layout" | "props">>;

let library: CatalogLibrary;
let document: CatalogDocument;
/** The fixture's pages, in document order (after `authorStagedFixture`). */
export let stagedPageIds: string[] = [];

/** A fixture subtree: a frame with children, a Text, or a palette component. */
type Spec =
  | { frame: Spec[]; style?: Style; name?: string }
  | { text: string; style?: Style; name?: string }
  | {
      palette: string;
      style?: Style;
      binding?: NodeEntry["binding"];
      name?: string;
    };
let sequence = 0;
export type StagedSpec = Spec;
/** Node entries of fixture subtrees (`name` = a fixed id — the same entries for two roots). */
export const stagedEntries = (specs: readonly Spec[]) => entriesOf(specs);
export const stagedNodeId = (name: string) => id(name);
function entriesOf(specs: readonly Spec[]): {
  entries: NodeEntry[];
  rootIds: NodeId[];
} {
  const entries: NodeEntry[] = [];
  const visit = (spec: Spec): NodeId => {
    const nodeId = id(
      "name" in spec && spec.name ? spec.name : `n${sequence++}`,
    );
    const base = {
      kind: "node" as const,
      id: nodeId,
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
      ...spec.style,
    };
    if ("frame" in spec)
      entries.push({
        ...base,
        definitionId: "lib:definition:type-frame",
        children: spec.frame.map(visit),
      });
    else if ("text" in spec)
      entries.push({
        ...base,
        definitionId: catalogPaletteDefinitionId(library, "Text"),
        children: [],
        props: { ...base.props, children: set(spec.text) },
      });
    else
      entries.push({
        ...base,
        definitionId: catalogPaletteDefinitionId(library, spec.palette),
        children: [],
        ...(spec.binding ? { binding: spec.binding } : {}),
      });
    return nodeId;
  };
  const rootIds = specs.map(visit);
  return { entries, rootIds };
}
const column = (frame: Spec[], style: Style = {}, name?: string): Spec => ({
  frame,
  name,
  style: {
    ...style,
    layout: {
      display: set("flex"),
      flexDirection: set("column"),
      ...style.layout,
    },
  },
});
const row = (frame: Spec[], style: Style = {}): Spec => ({
  frame,
  style: {
    ...style,
    layout: {
      display: set("flex"),
      flexDirection: set("row"),
      ...style.layout,
    },
  },
});
const LONG =
  "A staged load fills the page in units and the text wraps the same way as the batch build";

const PAGES: Record<string, () => Spec[]> = {
  flex: () => [
    column(
      [
        { text: "Flex page" },
        row(
          Array.from({ length: 6 }, (_, index) =>
            column([{ text: `Card ${index}` }, { text: LONG }], {
              sizing: { width: set(180) },
              visual: { padding: set(12), gap: set(8) },
            }),
          ),
          { layout: { flexWrap: set("wrap") }, visual: { gap: set(16) } },
        ),
        column([column([column([{ text: LONG }, { palette: "Button" }])])], {
          sizing: { width: set(240) },
        }),
        { text: "Footer" },
      ],
      { visual: { gap: set(24), padding: set(32) } },
    ),
  ],
  grid: () => [
    {
      frame: [
        ...["Card", "Card", "Button", "TextField", "Select", "Tabs"].map(
          (palette): Spec => ({ palette }),
        ),
        { text: LONG },
        { palette: "Table" },
        { palette: "Calendar" },
      ],
      style: {
        layout: {
          display: set("grid"),
          gridTemplateColumns: set("1fr 1fr 1fr"),
        },
        visual: { gap: set(16), padding: set(24) },
      },
    },
  ],
  bound: () => [
    column([
      { text: "Bound" },
      {
        palette: "ListBox",
        binding: {
          collectionId: COLLECTION as NodeEntry["binding"] extends infer B
            ? B extends { collectionId: infer C }
              ? C
              : never
            : never,
          fieldMap: { label: "data:field:label" },
        } as NodeEntry["binding"],
      },
      { palette: "TagGroup" },
      { palette: "Disclosure" },
    ]),
    { text: "Second root child" },
    column([{ palette: "Checkbox" }, { palette: "RadioGroup" }]),
  ],
  positioned: () => [
    column(
      [
        {
          text: "Pinned",
          style: {
            layout: {
              position: set("fixed"),
              insetTop: set("8px"),
              insetLeft: set("8px"),
            },
          },
        },
        {
          frame: [
            {
              text: "Sticky head",
              style: {
                layout: { position: set("sticky"), insetTop: set("0px") },
              },
            },
            ...Array.from({ length: 8 }, (_, index): Spec => ({
              text: `Line ${index} ${LONG}`,
            })),
          ],
          style: {
            sizing: { height: set(160) },
            visual: { overflow: set("auto") },
          },
        },
        { palette: "DialogTrigger" },
        { palette: "MenuTrigger" },
        { palette: "DatePicker" },
      ],
      { visual: { gap: set(12) } },
    ),
  ],
  wide: () => [
    row(
      Array.from({ length: 12 }, (_, index) =>
        column(
          Array.from({ length: 4 }, (_, line): Spec => ({
            text: `Cell ${index}.${line}`,
          })),
        ),
      ),
    ),
  ],
};

export async function authorStagedFixture(): Promise<void> {
  if (document) return;
  library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: STAGED_PROJECT, name: "Staged" }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr307-author-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  const graph = workspace.runtime.graph;
  const fill = (bodyId: NodeId, specs: Spec[]) => {
    const { entries, rootIds } = entriesOf(specs);
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: bodyId },
        entries,
        rootIds,
        newId: workspace.newId,
      }),
    );
  };
  const body = (name: string, style: Style = {}): NodeEntry => ({
    kind: "node",
    id: id(`${name}-body`),
    definitionId: "lib:definition:type-body",
    name: "Body",
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
    ...style,
  });
  const addPage = (name: string, style: Style = {}) => {
    workspace.execute(
      createPage({
        page: {
          kind: "page",
          id: `project:page:${name}` as EntryId<"page">,
          route: `/${name}`,
          name,
          children: [id(`${name}-body`)],
        },
        entries: [body(name, style)],
      }),
    );
    return id(`${name}-body`);
  };
  fill(id("home-body"), [column([{ text: "Home" }, { palette: "Button" }])]);
  for (const [name, specs] of Object.entries(PAGES))
    fill(addPage(name), specs());
  // A detached two-month Calendar: its month block is a repeat template (one record per month).
  fill(addPage("months"), [
    column([
      { text: "Months" },
      {
        palette: "Calendar",
        name: "months-calendar",
        style: { props: { visibleDuration: set({ months: 2 }) } },
      },
      { text: "After" },
    ]),
  ]);
  workspace.execute(
    detachInstances({ ids: [id("months-calendar")], newId: workspace.newId }),
  );
  // A page whose frame is as tall as its content: never a shell.
  fill(addPage("tall", { visual: { height: set("fit-content") } }), [
    column([{ text: "Tall" }, { text: LONG }]),
  ]);
  // A page whose body is a layout's instance: the page's body sits in the layout's slot.
  fill(addPage("shelled"), PAGES.flex());
  workspace.execute(
    createLayout({
      name: "Shell",
      rootId: id("shell"),
      entries: entriesOf([
        column(
          [
            { text: "Shell header" },
            {
              frame: [],
              name: "shell-main",
              style: {},
            },
            { text: "Shell footer" },
          ],
          {},
          "shell",
        ),
      ]).entries.map((entry) =>
        entry.id === id("shell-main")
          ? { ...entry, slot: { name: "content", required: false } }
          : entry,
      ),
      newId: workspace.newId,
    }),
  );
  workspace.execute(
    catalogPageCommands.layout(
      "project:page:shelled" as EntryId<"page">,
      catalogPageLayouts(graph)[0].id,
      workspace.newId,
    ),
  );
  const exported = graph.exportDocument();
  const collection: CollectionEntry = {
    kind: "collection",
    id: COLLECTION as CollectionEntry["id"],
    name: "Rows",
    useMockData: true,
    schema: [
      { id: "id", key: "id", type: "string" },
      { id: "label", key: "label", type: "string" },
    ],
    mockData: Array.from({ length: 5 }, (_, index) => ({
      id: `r${index}`,
      label: `Row ${index}`,
    })),
  };
  const project = exported.entries[STAGED_PROJECT];
  if (project.kind !== "project") throw new Error("fixture");
  document = {
    ...exported,
    entries: {
      ...exported.entries,
      [COLLECTION]: collection,
      [STAGED_PROJECT]: {
        ...project,
        collectionIds: [COLLECTION as CollectionEntry["id"]],
      },
    },
  };
  stagedPageIds = [...project.pageIds];
}

const graphs = new WeakMap<CatalogCompositionRoot, CatalogGraph>();
/** The document graph of a root built here (node ids for a test's edits). */
export const stagedGraph = (root: CatalogCompositionRoot): CatalogGraph =>
  graphs.get(root)!;
/** A workspace over its own copy of the fixture (the scheduler · request wiring). */
export async function buildStagedWorkspace(
  staged: { unitLimit?: number } | undefined,
  fillSchedule?: (task: () => void) => () => void,
) {
  const graph = new CatalogGraph(structuredClone(document), library);
  return new CatalogWorkspace(
    graph,
    new CatalogStorage(indexedDB, `adr307-ws-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
      root: {
        rows: (binding, kind) =>
          catalogBoundRows(binding, catalogCollectionTables(graph), kind),
        ...(staged ? { stagedLoad: staged } : {}),
      },
      ...(fillSchedule ? { fillSchedule } : {}),
    },
  );
}
export async function buildStagedRoot(
  staged?: { firstPage?: string; unitLimit?: number },
  /** A wrapper around the real engine (error injection). */
  wrapEngine: (engine: LayoutEngineAPI) => LayoutEngineAPI = (engine) => engine,
) {
  const graph = new CatalogGraph(structuredClone(document), library);
  const runtime = new CatalogRuntime(
    graph,
    new CatalogStorage(indexedDB, `adr307-eq-${Math.random()}`),
  );
  const root = new CatalogCompositionRoot(
    runtime,
    wrapEngine(await nodeLayoutEngine()),
    { width: 1920, height: 1080 },
    undefined,
    undefined,
    undefined,
    "en-US",
    {
      pageFrames: true,
      rows: (binding, kind) =>
        catalogBoundRows(binding, catalogCollectionTables(graph), kind),
      ...(staged ? { stagedLoad: staged } : {}),
    },
  );
  graphs.set(root, graph);
  return root;
}
/** Everything a consumer reads of a root, in a comparable shape. */
export function stagedSnapshot(root: CatalogCompositionRoot) {
  const ids = [...root.domInputs.keys()].sort();
  const geometry = root.getGeometry(ids);
  const round = (value: number) => Math.round(value * 1000) / 1000;
  return {
    records: ids.map((key) => root.domInputs.get(key)),
    geometry: ids.map((key) => {
      const rect = geometry.get(key);
      return [
        key,
        rect && [rect.x, rect.y, rect.width, rect.height].map(round),
      ];
    }),
    parts: [...root.composedPartInputs]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, parts]) => [key, parts.map((part) => part.id)]),
    slotChrome: [...root.slotChromeInputs.keys()].sort(),
    tagRows: [...root.tagShowAllInputs.keys()].sort(),
    sticky: JSON.stringify(root.getStickyConstraints()),
    pageRoots: root.pageRootRecords(),
    frames: [...root.pageFrameRects()].map(([key, rect]) => [
      key,
      [rect.x, rect.y, rect.width, rect.height].map(round),
    ]),
  };
}

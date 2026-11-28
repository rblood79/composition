import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  createComponent,
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  childPositions,
  nodePosition,
  type CatalogPosition,
} from "../../../../../../packages/shared/src/catalog/resolution/positions";
import type { CatalogConsumerNode } from "../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import {
  catalogCascaderItems,
  catalogCascaderList,
} from "../../../../../../packages/shared/src/catalog/runtime/cascader";
import { catalogContextualHelpCommand } from "../contextualHelpCommand";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-326 Phase 1 (G1 — breakdown §4.1 · R10): a placed Cascader's open content is nodes in
 * Select's place — `Popover > SearchField + Breadcrumbs (drill) + 「Back」 (drill) + CascaderList >
 * CascaderItem…`, each item holding its name Text and chevron Icon (사용자 결정 2). The two drill parts
 * stand while the mode is `drill` — through a mode write, Undo, a structure edit that copies the
 * instance's positions (the contextual help — `materialize.ts`), and an outer instance's value.
 * Expected structures are written out by hand.
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;

async function place() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr326-g1" as EntryId<"project">,
        name: "ADR-326 G1",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr326-g1-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: PLACED,
          definitionId: catalogPaletteDefinitionId(library, "Cascader"),
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
  const root = workspace.root;
  const get = (id: string) => root.domInputs.get(id);
  const typeOf = (node: CatalogConsumerNode) => root.typeOf(node);
  const field = (source: NodeId = PLACED) =>
    [...root.domInputs.values()].find(
      (record) => record.sourceId === source && typeOf(record) === "Cascader",
    )!;
  const childTypes = (record: CatalogConsumerNode | undefined) =>
    (record?.children ?? []).map((id) => typeOf(get(id)!));
  const popover = (source?: NodeId) =>
    field(source)
      .children.map(get)
      .find((record) => record && typeOf(record) === "Popover");
  /** The Popover's parts (Canvas and DOM records alike). */
  const parts = (source?: NodeId) => ({
    dom: childTypes(popover(source)),
    canvas: childTypes(
      root.canvasInputs.get(popover(source)?.id ?? "") ?? undefined,
    ),
  });
  const setMode = (mode: string, id: NodeId = PLACED) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id }],
        props: { mode: { kind: "set", value: mode } },
      } as never),
    );
  return {
    workspace,
    root,
    get,
    typeOf,
    field,
    childTypes,
    popover,
    parts,
    setMode,
  };
}

const COLUMNS_PARTS = ["SearchField", "CascaderList"];
const DRILL_PARTS = [
  "SearchField",
  "Breadcrumbs",
  "ActionButton",
  "CascaderList",
];

/** The Layers rows of a Cascader's Popover (its positions' types). */
function layersOfPopover(workspace: CatalogWorkspace, id: NodeId): string[] {
  const graph = workspace.runtime.graph;
  const typeOf = (position: CatalogPosition) =>
    graph.getDefinition(position.definitionId)?.name ?? "";
  const field = nodePosition(graph, id);
  const popover = childPositions(graph, field).find(
    (position) => typeOf(position) === "Popover",
  )!;
  return childPositions(graph, popover).map(typeOf);
}

describe("ADR-326 G1 — the open content is nodes (breakdown §4.1)", () => {
  it("Popover > SearchField + CascaderList > items in Select's place; each item holds its name Text and chevron Icon", async () => {
    const { field, childTypes, get, typeOf, parts } = await place();
    expect(childTypes(field())).toEqual([
      "FieldLabel",
      "Button",
      // (The repeated-key notice's place — ADR-322 Phase 4.)
      "Description",
      "FieldError",
      "Popover",
    ]);
    expect(parts().dom).toEqual(COLUMNS_PARTS);
    const items = catalogCascaderItems(field(), get, typeOf);
    expect(items.map((item) => item.props.label)).toEqual([
      "Electronics",
      "Clothing",
      "Books",
    ]);
    expect(catalogCascaderList(field(), get, typeOf)?.id).toBe(
      get(items[0]!.parentId!)!.id,
    );
    // (사용자 결정 2 — the name Text binds the item's `label`; the next level follows.)
    expect(childTypes(items[0])).toEqual([
      "Text",
      "Icon",
      "CascaderItem",
      "CascaderItem",
    ]);
    const [text, icon] = items[0]!.children.map((id) => get(id)!);
    expect(text!.props.children).toBe("Electronics");
    expect(icon!.props.iconName).toBe("chevron-right");
  });

  it("drill parts (R10): a mode write stands them, Undo and another mode take them away — records and Layers", async () => {
    const { workspace, parts, setMode } = await place();
    expect(layersOfPopover(workspace, PLACED)).toEqual(COLUMNS_PARTS);
    setMode("drill");
    expect(parts()).toEqual({ dom: DRILL_PARTS, canvas: DRILL_PARTS });
    expect(layersOfPopover(workspace, PLACED)).toEqual(DRILL_PARTS);
    workspace.undo();
    expect(parts()).toEqual({ dom: COLUMNS_PARTS, canvas: COLUMNS_PARTS });
    workspace.redo();
    expect(parts().dom).toEqual(DRILL_PARTS);
    setMode("tree");
    expect(parts()).toEqual({ dom: COLUMNS_PARTS, canvas: COLUMNS_PARTS });
    expect(layersOfPopover(workspace, PLACED)).toEqual(COLUMNS_PARTS);
  });

  it("a structure edit that copies the instance's positions (contextual help) keeps them by the mode", async () => {
    const { workspace, parts, setMode, field } = await place();
    workspace.execute(
      catalogContextualHelpCommand({
        field: nodePosition(workspace.runtime.graph, PLACED),
        kind: "info",
        newId: workspace.newId,
      }),
    );
    // (The copy is an owned node now — the position's `presentWith` came with it.)
    const placed = workspace.runtime.graph.getEntry(PLACED) as NodeEntry;
    expect(placed.descendantOverrides.some((o) => o.kind === "fillSlot")).toBe(
      true,
    );
    expect(field().children.length).toBeGreaterThan(0);
    expect(parts()).toEqual({ dom: COLUMNS_PARTS, canvas: COLUMNS_PARTS });
    expect(layersOfPopover(workspace, PLACED)).toEqual(COLUMNS_PARTS);
    setMode("drill");
    expect(parts()).toEqual({ dom: DRILL_PARTS, canvas: DRILL_PARTS });
    expect(layersOfPopover(workspace, PLACED)).toEqual(DRILL_PARTS);
    workspace.undo();
    expect(parts()).toEqual({ dom: COLUMNS_PARTS, canvas: COLUMNS_PARTS });
  });

  it("an outer instance's value: a component around the Cascader, its instance writes the mode", async () => {
    const { workspace, parts } = await place();
    workspace.execute(
      createComponent({ id: PLACED, name: "Picker", newId: workspace.newId }),
    );
    const graph = workspace.runtime.graph;
    const body = graph.getEntry(BODY) as NodeEntry;
    const instance = body.children.find((id) => id !== PLACED)!;
    expect(parts(instance).dom).toEqual(COLUMNS_PARTS);
    workspace.execute(
      setFields({
        targets: [
          {
            kind: "descendant",
            ownerId: instance,
            address: { instances: [instance], templatePath: [PLACED] },
          },
        ],
        props: { mode: { kind: "set", value: "drill" } },
      } as never),
    );
    expect(parts(instance)).toEqual({ dom: DRILL_PARTS, canvas: DRILL_PARTS });
    workspace.undo();
    expect(parts(instance).dom).toEqual(COLUMNS_PARTS);
  });
});

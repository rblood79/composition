import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getPaletteItems } from "../../panels/components/paletteItems";
import {
  catalogPaletteDefinitionId,
  catalogPaletteInsertCommand,
} from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4 Components palette and History: a palette item is one insert of its library
 * definition — into the selection, or the nearest ancestor that can hold it, or the page body —
 * and the new node is selected; every palette item has a definition the body accepts. History
 * lists the single stack's labels; jumping to an entry undoes/redoes to it; clear drops entries.
 */
const PROJECT = "project:project:palette" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Palette" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-palette-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  const host = {
    graph: workspace.runtime.graph,
    get records() {
      return workspace.root.domInputs;
    },
    selection: () => workspace.session.getSnapshot().selection,
    itemOfRecord: (identity: string) => workspace.itemOfRecord(identity),
    pageContent: () => ({ kind: "node" as const, id: BODY }),
    newId: workspace.newId,
  };
  const add = (type: string, props?: Record<string, unknown>) => {
    const command = catalogPaletteInsertCommand(host, type, props);
    if (!command) throw new Error(`no place for ${type}`);
    return workspace.execute(command).plan.selectAfter![0];
  };
  const children = (id: NodeId) => {
    const entry = workspace.runtime.graph.getEntry(id);
    return entry?.kind === "node" ? entry.children : [];
  };
  const selected = () =>
    workspace.session.getSnapshot().selection.map((item) => item.target);
  return { workspace, host, add, children, selected };
}

describe("ADR-248 Phase 4e-4 Components palette", () => {
  it("inserts into the page body, into a selected container, and past a selected leaf", async () => {
    const { workspace, add, children, selected } = await open();
    const frame = add("frame");
    expect(children(BODY)).toEqual([frame]);
    expect(selected()).toEqual([{ kind: "node", id: frame }]);
    // The selected frame holds the next item: an instance of its reusable origin, owning only
    // the initial props that differ from the origin's defaults.
    const icon = add("IconButton", { label: "Save", variant: "primary" });
    expect(children(frame)).toEqual([icon]);
    expect(workspace.runtime.graph.getEntry(icon)).toMatchObject({
      definitionId: "lib:definition:origin-component-iconbutton",
      props: { label: { kind: "set", value: "Save" } },
    });
    expect(
      Object.keys(
        (workspace.runtime.graph.getEntry(icon) as { props: object }).props,
      ),
    ).toEqual(["label"]);
    workspace.session.select(workspace.itemsOfNode(frame, 1));
    const button = add("Button");
    expect(children(frame)).toEqual([icon, button]);
    // A selected Button cannot hold a Button: the frame (its nearest accepting ancestor) does.
    const second = add("Button");
    expect(children(frame)).toEqual([icon, button, second]);
    workspace.session.clearSelection();
    add("Heading");
    expect(children(BODY)).toHaveLength(2);
  });

  it("a new node starts with the type's creation props (the old palette's defaults)", async () => {
    const { workspace, add } = await open();
    const graph = workspace.runtime.graph;
    const own = (id: NodeId) =>
      (graph.getEntry(id) as { props: Record<string, { value?: unknown }> })
        .props;
    // A Text shows text and an Icon a glyph (the definition defaults have neither).
    expect(typeof own(add("Text")).children?.value).toBe("string");
    expect(typeof own(add("Icon")).iconName?.value).toBe("string");
    // Keys the definition does not accept (factory style …) stay out.
    expect(own(add("Text"))).not.toHaveProperty("style");
  });

  it("every palette item has a library definition the page body accepts", async () => {
    const { host, workspace } = await open();
    const refused: string[] = [];
    for (const item of getPaletteItems()) {
      const type = item.componentType ?? item.type;
      if (item.layoutOnly) continue;
      if (
        !workspace.runtime.graph.library.definitions.has(
          catalogPaletteDefinitionId(workspace.runtime.graph.library, type),
        )
      ) {
        refused.push(`${type}: no definition`);
        continue;
      }
      workspace.session.clearSelection();
      const command = catalogPaletteInsertCommand(
        host,
        type,
        item.initialProps,
      );
      if (!command) {
        refused.push(`${type}: refused`);
        continue;
      }
      // The commit's document validation is the gate the palette click meets (a dry-run alone
      // let Chart's old `style: { width }` initial prop through).
      try {
        workspace.execute(command);
      } catch (error) {
        refused.push(`${item.type}: ${(error as Error).message}`);
      }
    }
    expect(refused).toEqual([]);
  });

  it("a Chart palette item's old style width becomes the node's sizing", async () => {
    const { workspace, add } = await open();
    const item = getPaletteItems().find((entry) => entry.type === "chart-bar")!;
    const id = add("Chart", item.initialProps);
    const entry = workspace.runtime.graph.getEntry(id) as {
      props: Record<string, unknown>;
      sizing: Record<string, unknown>;
    };
    expect(entry.props).not.toHaveProperty("style");
    expect(entry.props.chartType).toEqual({ kind: "set", value: "bar" });
    expect(entry.sizing.width).toEqual({ kind: "set", value: 320 });
  });
});

describe("ADR-248 Phase 4e-4 History", () => {
  it("lists the labels, jumps by undo/redo, and clears", async () => {
    const { workspace, add, children } = await open();
    const history = workspace.history;
    expect(history.getSnapshot()).toMatchObject({ labels: [], applied: 0 });
    let notified = 0;
    history.subscribe(() => notified++);
    add("frame");
    add("Heading");
    add("Button");
    expect(history.getSnapshot()).toMatchObject({
      labels: ["Add element", "Add element", "Add element"],
      applied: 3,
    });
    expect(notified).toBe(3);

    history.goTo(1);
    expect(history.getSnapshot().applied).toBe(1);
    expect(children(BODY)).toHaveLength(1);
    expect(workspace.runtime.historyDepth).toEqual({ undo: 1, redo: 2 });
    history.goTo(3);
    expect(history.getSnapshot().applied).toBe(3);

    history.goTo(2);
    history.clear();
    expect(history.getSnapshot()).toMatchObject({ labels: [], applied: 0 });
    expect(workspace.runtime.historyDepth).toEqual({ undo: 0, redo: 0 });
    // The document stays as it was when cleared.
    expect(children(children(BODY)[0])).toHaveLength(1);
  });
});

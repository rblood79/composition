import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { COMPONENT_RULES_TABLE } from "../../../../../../packages/shared/src/catalog/generated/componentRulesTable";
import {
  catalogButtonChildCommands,
  catalogButtonChildren,
} from "../buttonChildren";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4 Button children: an icon on a plain Button adds an Icon child and moves the
 * label into a Text child (RSP "With Icon and Label"); another icon edits the Icon only; clearing
 * puts the label back on the Button — each one history step.
 */
const PROJECT = "project:project:button" as EntryId<"project">;
const BODY = "project:node:home-body" as NodeId;
const BUTTON = "project:node:btn" as NodeId;

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Button" }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-button-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  const button: NodeEntry = {
    kind: "node",
    id: BUTTON,
    definitionId: "lib:definition:type-Button",
    children: [],
    props: {
      children: { kind: "set", value: "Save" },
      size: { kind: "set", value: "lg" },
    },
    visual: {},
    sizing: {},
    descendantOverrides: [],
  };
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [button],
      rootIds: [BUTTON],
      newId: workspace.newId,
    }),
  );
  return { workspace, graph: workspace.runtime.graph };
}

describe("ADR-248 Phase 4e-4 Button children", () => {
  it("icon on → Icon + Text children (label moved, size carried); another icon; icon off → label back", async () => {
    const { workspace, graph } = await open();
    expect(catalogButtonChildren(graph, BUTTON)).toEqual({});
    expect(catalogButtonChildren(graph, BODY)).toBe(undefined);

    const revision = graph.revision;
    workspace.execute(
      catalogButtonChildCommands.setIcon(BUTTON, "star", workspace.newId),
    );
    expect(graph.revision).toBe(revision + 1);
    const on = catalogButtonChildren(graph, BUTTON)!;
    expect(on).toMatchObject({ iconName: "star", text: "Save" });
    const button = graph.getEntry(BUTTON) as NodeEntry;
    expect(button.children).toEqual([on.iconId, on.textId]);
    expect(button.props.children).toBe(undefined);
    expect((graph.getEntry(on.iconId!) as NodeEntry).props.size).toEqual({
      kind: "set",
      value: "lg",
    });

    // The children draw at the Button's scale (the old read-time Button → Icon/Text propagation):
    // the icon at the size's iconSize, the label at the Button's font size.
    const visualOf = (source: string) =>
      workspace.root.domInputs.get(workspace.root.recordsOfSource(source)[0])
        ?.visual;
    const lg = COMPONENT_RULES_TABLE.Button.sizes.lg;
    expect(visualOf(on.iconId!)).toMatchObject({ iconSize: lg.iconSize });
    expect(visualOf(on.textId!)?.fontSize).toEqual(visualOf(BUTTON)?.fontSize);
    expect(visualOf(on.textId!)?.lineHeight).toEqual(
      visualOf(BUTTON)?.lineHeight,
    );

    workspace.execute(
      catalogButtonChildCommands.setIcon(BUTTON, "heart", workspace.newId),
    );
    expect(catalogButtonChildren(graph, BUTTON)).toMatchObject({
      iconId: on.iconId,
      iconName: "heart",
    });
    workspace.execute(catalogButtonChildCommands.setText(on.textId!, "Keep"));

    workspace.execute(catalogButtonChildCommands.clearIcon(BUTTON));
    const off = graph.getEntry(BUTTON) as NodeEntry;
    expect(off.children).toEqual([]);
    expect(off.props.children).toEqual({ kind: "set", value: "Keep" });
    expect(graph.getEntry(on.iconId!)).toBe(undefined);

    workspace.undo();
    expect(catalogButtonChildren(graph, BUTTON)).toMatchObject({
      iconName: "heart",
      text: "Keep",
    });
    workspace.undo();
    workspace.undo();
    workspace.undo();
    expect(graph.getEntry(BUTTON)).toMatchObject({
      children: [],
      props: { children: { kind: "set", value: "Save" } },
    });
  });

  it("an existing Text child stays (after the new Icon) and keeps its text", async () => {
    const { workspace, graph } = await open();
    const text: NodeEntry = {
      kind: "node",
      id: "project:node:label" as NodeId,
      definitionId: "lib:definition:text",
      children: [],
      props: { children: { kind: "set", value: "Hi" } },
      visual: {},
      sizing: {},
      descendantOverrides: [],
    };
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BUTTON },
        entries: [text],
        rootIds: [text.id],
        newId: workspace.newId,
      }),
    );
    workspace.execute(
      catalogButtonChildCommands.setIcon(BUTTON, "star", workspace.newId),
    );
    const state = catalogButtonChildren(graph, BUTTON)!;
    expect(state).toMatchObject({ textId: text.id, text: "Hi" });
    expect((graph.getEntry(BUTTON) as NodeEntry).children).toEqual([
      state.iconId,
      text.id,
    ]);
  });
});

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
import { PRESET_ORDER } from "../../panels/properties/editors/LayoutPresetSelector/presetDefinitions";
import {
  catalogAppliedPreset,
  catalogLayoutPresetCommand,
  catalogLayoutSlots,
} from "../layoutPreset";
import { catalogNewLayoutCommand } from "../layouts";
import { catalogPageCommands, catalogPageLayoutSlots } from "../pageSettings";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-6-37: Layout Preset over a catalog layout — one step that sets the body's
 * container layout (clearing the keys a preset owns, at every breakpoint layer) and puts one
 * declared frame per preset slot under it; replace removes the existing slots, merge adds the new
 * names only.
 */
async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:preset" as EntryId<"project">,
        name: "Preset",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-preset-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1440, height: 900 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(catalogNewLayoutCommand("Layout", workspace.newId));
  const graph = workspace.runtime.graph;
  const project = graph.getEntry(graph.projectId);
  if (project?.kind !== "project") throw new Error("project");
  const definition = graph.getEntry(project.definitionIds[0]!);
  if (definition?.kind !== "definition") throw new Error("definition");
  const rootId = definition.templateRootId as NodeId;
  const node = (id: NodeId) => graph.getEntry(id) as NodeEntry;
  const apply = (presetKey: string, mode: "replace" | "merge" = "replace") => {
    const command = catalogLayoutPresetCommand(graph, {
      rootId,
      presetKey,
      mode,
      newId: workspace.newId,
    });
    if (command) workspace.execute(command);
    return command;
  };
  const slots = () => catalogLayoutSlots(graph, rootId);
  return { workspace, graph, rootId, node, apply, slots };
}
const set = (value: unknown) => ({ kind: "set", value });

describe("ADR-248 Phase 4e-6-37 Layout Preset", () => {
  it("replace: the body takes the container layout and one declared frame per slot", async () => {
    const { workspace, rootId, node, apply, slots } = await open();
    // The new layout's Content slot holds an element: replace removes it with the slot.
    const [content] = slots();
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: content!.nodeId },
        entries: [
          {
            kind: "node",
            id: "project:node:inside" as NodeId,
            definitionId: "lib:definition:heading",
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootIds: ["project:node:inside" as NodeId],
        newId: workspace.newId,
      }),
    );
    expect(slots()).toMatchObject([{ slotName: "content", childCount: 1 }]);
    const steps = workspace.history.getSnapshot().applied;

    // The body stays selected: the step selects no new slot.
    const plan = catalogLayoutPresetCommand(workspace.runtime.graph, {
      rootId,
      presetKey: "holy-grail",
      mode: "replace",
      newId: workspace.newId,
    })!(workspace.runtime.graph);
    expect(plan.selectAfter).toBeUndefined();
    apply("holy-grail");
    expect(workspace.history.getSnapshot()).toMatchObject({
      applied: steps + 1,
      labels: expect.arrayContaining(["Apply layout preset"]),
    });
    expect(slots().map((slot) => slot.slotName)).toEqual([
      "header",
      "sidebar",
      "content",
      "aside",
      "footer",
    ]);
    expect(workspace.runtime.graph.getEntry("project:node:inside")).toBe(
      undefined,
    );
    const body = node(rootId);
    expect(body.layout).toMatchObject({
      display: set("grid"),
      gridTemplateColumns: set("200px 1fr 200px"),
    });
    // Mobile stacks the slots (the preset's container override).
    expect(body.responsive?.mobile?.layout).toMatchObject({
      display: set("flex"),
      flexDirection: set("column"),
    });
    const sidebar = node(slots()[1]!.nodeId);
    expect(sidebar).toMatchObject({
      name: "Sidebar",
      slot: { name: "sidebar" },
      layout: { gridColumnStart: set("1"), gridRowStart: set("2") },
    });
    expect(sidebar.layout).not.toHaveProperty("gridArea");
    expect(catalogAppliedPreset(slots())).toBe("holy-grail");
  });

  it("switching presets clears the keys the previous one owned; merge adds new slot names only", async () => {
    const { rootId, node, apply, slots } = await open();
    apply("holy-grail");
    apply("vertical-2");
    const body = node(rootId);
    expect(body.layout?.display).toEqual(set("flex"));
    expect(body.layout?.flexDirection).toEqual(set("column"));
    expect(body.layout).not.toHaveProperty("gridTemplateColumns");
    expect(body.responsive?.mobile?.layout ?? {}).not.toHaveProperty("display");
    expect(slots().map((slot) => slot.slotName)).toEqual(["header", "content"]);
    // The flexible content slot is `flex: 1` as longhands.
    expect(node(slots()[1]!.nodeId).layout).toMatchObject({
      flexGrow: set("1"),
    });

    apply("holy-grail", "merge");
    expect(slots().map((slot) => slot.slotName)).toEqual([
      "header",
      "content",
      "sidebar",
      "aside",
      "footer",
    ]);
    // Nothing new to add: no step.
    expect(apply("vertical-2", "merge")).toBeUndefined();
  });

  it("every preset applies", async () => {
    const { apply, slots } = await open();
    for (const key of PRESET_ORDER) {
      expect(apply(key)).toBeDefined();
      expect(catalogAppliedPreset(slots())).toBeTruthy();
    }
  });

  it("a page using a layout with several slots chooses the slot its content fills", async () => {
    const { workspace, graph, apply } = await open();
    apply("holy-grail");
    const project = graph.getEntry(graph.projectId);
    if (project?.kind !== "project") throw new Error("project");
    const [pageId] = project.pageIds;
    const page = () => graph.getEntry(pageId!);
    // The page body (one root) becomes the layout's instance.
    const body = (page() as unknown as { children: NodeId[] }).children[0]!;
    workspace.execute(
      catalogPageCommands.layout(
        pageId!,
        project.definitionIds[0] as never,
        workspace.newId,
      ),
    );
    const choice = () => catalogPageLayoutSlots(graph, pageId!)!;
    const nameOf = (path: string | undefined) =>
      choice().slots.find((slot) => slot.path.join() === path)?.name;
    expect(choice().slots.map((slot) => slot.name)).toEqual([
      "header",
      "sidebar",
      "content",
      "aside",
      "footer",
    ]);
    // The content slot by default (its role), not the first slot.
    expect(nameOf(choice().current)).toBe("content");
    const header = choice().slots.find((slot) => slot.name === "header")!;
    workspace.execute(
      catalogPageCommands.layout(
        pageId!,
        project.definitionIds[0] as never,
        workspace.newId,
        header.path,
      ),
    );
    expect(nameOf(choice().current)).toBe("header");
    // The page body itself is the instance; the chosen slot holds its content (none yet).
    expect((page() as unknown as { children: NodeId[] }).children).toEqual([
      body,
    ]);
    const instance = graph.getEntry(body) as NodeEntry;
    expect(instance.descendantOverrides).toMatchObject([
      { kind: "fillSlot", childIds: [] },
    ]);
  });
});

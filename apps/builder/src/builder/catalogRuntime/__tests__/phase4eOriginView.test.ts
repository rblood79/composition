import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
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
import { CatalogLayerTreeStore } from "../layerTree";
import { catalogComponentState } from "../componentActions";
import { catalogBuiltinOrigins } from "../layouts";
import { CatalogOriginEditError, ORIGIN_VIEW_NODE } from "../originView";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 4e (user 2026-10-01): the Navigator Components tab lists the built-in component
 * origins (the types the Components palette registers) after the project's components; opening
 * one draws a derived sample of it (never in the document). Root edits there are the project's
 * defaults for the origin (every instance shows them, undo takes them back); its children and
 * other fields are not editable (user decision: root only).
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

  it("opening an origin draws a derived sample that is never part of the document", async () => {
    const { workspace, button } = await open();
    workspace.showDefinition(button.id);
    expect(workspace.session.getSnapshot().definitionView).toBe(button.id);
    const roots = [...workspace.root.domInputs.values()].filter(
      (record) => record.parentId === "catalog:root",
    );
    expect(roots.map((record) => record.sourceId)).toEqual([ORIGIN_VIEW_NODE]);
    // Layers: the sample is the origin row; it has a position (selection, panels).
    const store = new CatalogLayerTreeStore(
      {
        readModel: workspace.readModel,
        graph: graphOf(workspace),
        subscribeSteps: (listener) =>
          workspace.runtime.subscribeSteps(listener),
      },
      button.id,
    );
    const [root] = store.getSnapshot();
    expect(root!.role).toBe("origin");
    expect(workspace.positionOfRecord(roots[0]!.id)).toBeDefined();
    // Not in the document, the instance index, or exports.
    expect(graphOf(workspace).exportDocument().entries[ORIGIN_VIEW_NODE]).toBe(
      undefined,
    );
    expect([...graphOf(workspace).instancesOf(button.id)]).toEqual([PLACED]);
    workspace.showDefinition(undefined);
    expect(graphOf(workspace).getEntry(ORIGIN_VIEW_NODE)).toBe(undefined);
    workspace.dispose();
  });

  it("a root edit is the origin's project default: every instance shows it, undo takes it back", async () => {
    const { workspace, button } = await open();
    const before = placedLabel(workspace);
    workspace.showDefinition(button.id);
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: ORIGIN_VIEW_NODE }],
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
      (graphOf(workspace).getEntry(ORIGIN_VIEW_NODE) as NodeEntry).props,
    ).toEqual({ label: { kind: "set", value: "Go" } });
    expect(placedLabel(workspace)).toBe("Go");
    // The panels read it as the sample's own value (resettable).
    expect(
      workspace.readModel.ownFields({ kind: "node", id: ORIGIN_VIEW_NODE })
        .props,
    ).toEqual({ label: { kind: "set", value: "Go" } });
    const sample = [...workspace.root.domInputs.values()].find(
      (record) => record.sourceId === ORIGIN_VIEW_NODE,
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
      { kind: "node", id: ORIGIN_VIEW_NODE },
      (fields) => seen.push(fields.props.label),
    );
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: ORIGIN_VIEW_NODE }],
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
    workspace.showDefinition(button.id);
    const steps = workspace.history.getSnapshot().labels.length;
    expect(() =>
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: ORIGIN_VIEW_NODE }],
          breakpoint: "mobile",
          visual: { paddingTop: { kind: "set", value: 4 } },
        }),
      ),
    ).toThrow(CatalogOriginEditError);
    expect(() =>
      workspace.execute(
        setFields({
          targets: [{ kind: "node", id: ORIGIN_VIEW_NODE }],
          sizing: { width: { kind: "set", value: 300 } },
        }),
      ),
    ).toThrow(CatalogOriginEditError);
    expect(workspace.history.getSnapshot().labels.length).toBe(steps);
    // A write that skips the origin view's translation never stages the sample.
    let code: string | undefined;
    try {
      workspace.root.execute(
        setFields({
          targets: [{ kind: "node", id: ORIGIN_VIEW_NODE }],
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
    workspace.showDefinition(button.id);
    const graph = graphOf(workspace);
    expect(
      catalogComponentState(graph, ORIGIN_VIEW_NODE, button.id),
    ).toMatchObject({
      originOf: {
        definitionId: button.id,
        project: false,
        instanceIds: [PLACED],
      },
    });
    expect(catalogComponentState(graph, PLACED, button.id)).toMatchObject({
      instanceOf: {
        definitionId: button.id,
        project: false,
        instanceIds: [PLACED],
      },
    });
    workspace.dispose();
  });
});

import "fake-indexeddb/auto";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import { createCatalogStylesHost } from "../../panels/styles/catalog/catalogStylesHost";
import { useFillActions } from "../../panels/styles/hooks/useFillActions";
import { StylesHostContext } from "../../panels/styles/stylesHostContext";
import { FillType, type FillItem } from "../../../types/builder/fill.types";
import { newCatalogProjectDocument } from "../project";
import { CatalogWorkspaceProvider } from "../react";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4d-3 Fill: the Fill section's paint layers over the catalog document — read
 * as the panel's items (a background color as one virtual layer), written as one whole-field
 * `fills` step (fill-derived background CSS goes), reset to the definition's paint.
 */
const BODY = "project:node:home-body" as NodeId;
const BOX = "project:node:box" as NodeId;

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:fill" as EntryId<"project">,
        name: "Fill",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-fill-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const box: NodeEntry = {
    kind: "node",
    id: BOX,
    definitionId: "lib:definition:type-frame",
    children: [],
    props: {},
    visual: { backgroundColor: { kind: "set", value: "#FF0000" } },
    sizing: {},
    descendantOverrides: [],
  };
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [box],
      rootIds: [BOX],
      newId: workspace.newId,
    }),
  );
  const record = workspace.root.recordsOfSource(BOX)[0];
  workspace.selectRecords([record]);
  const graph = workspace.runtime.graph;
  return {
    workspace,
    graph,
    record,
    node: () => graph.getEntry(BOX) as NodeEntry,
    host: createCatalogStylesHost(workspace),
  };
}

describe("ADR-248 Phase 4e-4d-3 Fill", () => {
  it("reads a background color as a virtual layer; a write is one fills step that drops the background CSS", async () => {
    const { workspace, graph, node, host, record } = await open();
    const initial = host.readFills();
    expect(initial).toHaveLength(1);
    expect(initial[0]).toMatchObject({ type: "color", color: "#FF0000FF" });

    const revision = graph.revision;
    const gradient: FillItem = {
      id: "g1",
      type: FillType.LinearGradient,
      enabled: true,
      opacity: 1,
      blendMode: "normal",
      stops: [
        { color: "#000000FF", position: 0 },
        { color: "#FFFFFFFF", position: 1 },
      ],
      rotation: 90,
    };
    host.updateFills([{ ...initial[0], id: "c1" }, gradient]);
    expect(graph.revision).toBe(revision + 1);
    expect(node().fills?.map((fill) => fill.kind)).toEqual([
      "color",
      "linear-gradient",
    ]);
    expect(node().visual.backgroundColor).toBe(undefined);
    expect(host.readFills().map((fill) => fill.type)).toEqual([
      "color",
      "linear-gradient",
    ]);
    // The drawn record carries the authored layers.
    expect(workspace.root.domInputs.get(record)?.fills).toHaveLength(2);

    host.resetFills();
    expect(node().fills).toBe(undefined);
    const after = graph.revision;
    host.resetFills();
    expect(graph.revision).toBe(after);
    workspace.undo();
    expect(node().fills).toHaveLength(2);
  });

  it("the Fill actions write through the host and the section context shows the layers", async () => {
    const { workspace, node, host, record } = await open();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CatalogWorkspaceProvider workspace={workspace}>
        <StylesHostContext.Provider value={host}>
          {children}
        </StylesHostContext.Provider>
      </CatalogWorkspaceProvider>
    );
    const { result, rerender } = renderHook(
      () => ({
        actions: useFillActions(),
        context: host.useElementStyleContext(record),
      }),
      { wrapper },
    );
    result.current.actions.addFill(FillType.LinearGradient);
    rerender();
    expect(node().fills?.map((fill) => fill.kind)).toEqual([
      "color",
      "linear-gradient",
    ]);
    const colorId = node().fills![0].id;
    result.current.actions.toggleFill(colorId);
    rerender();
    expect(node().fills![0].enabled).toBe(false);
    expect(
      (result.current.context.fills as FillItem[]).map((fill) => fill.type),
    ).toEqual(["color", "linear-gradient"]);
    result.current.actions.removeFill(colorId);
    expect(node().fills?.map((fill) => fill.kind)).toEqual(["linear-gradient"]);
  });
});

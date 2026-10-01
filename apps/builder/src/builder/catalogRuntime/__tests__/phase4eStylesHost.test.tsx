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
import { useToastStore } from "../../stores/toast";
import { newCatalogProjectDocument } from "../project";
import { CatalogWorkspaceProvider } from "../react";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4d Styles host: the shared Styles sections' reads and writes over the catalog
 * workspace — an edit is one `setFields` step on the selection at the session breakpoint, a value
 * the typed field cannot hold is refused, and the section reads the breakpoint layer over the base.
 */
const BODY = "project:node:home-body" as NodeId;
const BOX = "project:node:box" as NodeId;

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:styles" as EntryId<"project">,
        name: "Styles",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-styles-${Math.random()}`),
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
    visual: {},
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
  return {
    workspace,
    graph: workspace.runtime.graph,
    record,
    host: createCatalogStylesHost(workspace),
  };
}

describe("ADR-248 Phase 4e-4d Styles host", () => {
  it("writes one step per edit, at the session breakpoint, and refuses what the field cannot hold", async () => {
    const { workspace, graph, host } = await open();
    const node = () => graph.getEntry(BOX) as NodeEntry;
    const revision = graph.revision;
    host.updateStyle("paddingTop", "12px");
    expect(graph.revision).toBe(revision + 1);
    expect(node().visual.paddingTop).toEqual({ kind: "set", value: 12 });
    host.updateStyles({ display: "flex", flexDirection: "column", gap: "8px" });
    expect(graph.revision).toBe(revision + 2);
    expect(node().layout).toMatchObject({
      display: { kind: "set", value: "flex" },
      flexDirection: { kind: "set", value: "column" },
    });
    expect(host.readSelectedTarget().style).toMatchObject({
      paddingTop: "12px",
      display: "flex",
      flexDirection: "column",
      gap: "8px",
    });

    // tablet: the edit goes to that layer; the base keeps its value.
    workspace.setBreakpoint("tablet");
    host.updateStyle("paddingTop", "4px");
    expect(node().visual.paddingTop).toEqual({ kind: "set", value: 12 });
    expect(node().responsive?.tablet?.visual?.paddingTop).toEqual({
      kind: "set",
      value: 4,
    });
    expect(host.readSelectedTarget().style.paddingTop).toBe("4px");
    workspace.setBreakpoint("desktop");
    expect(host.readSelectedTarget().style.paddingTop).toBe("12px");

    const before = graph.revision;
    useToastStore.setState({ toasts: [] } as never);
    host.updateStyle("fontSize", "large");
    expect(graph.revision).toBe(before);
    expect(
      (useToastStore.getState() as { toasts: { message: string }[] }).toasts
        .length,
    ).toBeGreaterThan(0);
    // An empty value removes.
    host.updateStyle("paddingTop", "");
    expect(node().visual.paddingTop).toBe(undefined);
  });

  it("a section reads the selected record's authored fields as CSS and follows edits", async () => {
    const { workspace, host, record } = await open();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CatalogWorkspaceProvider workspace={workspace}>
        {children}
      </CatalogWorkspaceProvider>
    );
    const { result, rerender } = renderHook(
      () => ({
        id: host.useSelectedId(),
        context: host.useElementStyleContext(record),
      }),
      { wrapper },
    );
    expect(result.current.id).toBe(record);
    expect(result.current.context.type).toBe("frame");
    host.updateStyle("borderRadius", "6px");
    rerender();
    expect(result.current.context.style).toMatchObject({
      borderRadius: "6px",
    });
  });

  it("a drag previews on the Canvas layout without a step; the release, a refusal or another selection ends it", async () => {
    const { workspace, graph, host, record } = await open();
    const width = (id = record) =>
      Math.round(workspace.root.getGeometry([id]).get(id)!.width);
    host.updateStyle("width", "100px");
    const revision = graph.revision;
    let heard = 0;
    workspace.root.subscribePreviews(() => (heard += 1));

    host.previewStyle("width", "150px");
    host.previewStyle("paddingTop", "10px");
    expect(width()).toBe(150);
    expect(workspace.root.domInputs.get(record)?.visual.paddingTop).toBe(10);
    host.previewStyle("rowGap", "6px");
    expect(workspace.root.domInputs.get(record)?.layout.rowGap).toBe("6px");
    expect(heard).toBe(3);
    // Neither the document nor the history moved.
    expect(graph.revision).toBe(revision);
    expect((graph.getEntry(BOX) as NodeEntry).sizing.width).toEqual({
      kind: "set",
      value: 100,
    });
    // The release commits the value as one step.
    host.updateStyle("width", "150px");
    expect(graph.revision).toBe(revision + 1);
    expect(width()).toBe(150);
    // The other previewed key (no commit) shows the record's own value again.
    expect(workspace.root.domInputs.get(record)?.visual.paddingTop).toBe(
      undefined,
    );

    // A refused commit puts the record's own value back.
    host.previewStyle("width", "220px");
    expect(width()).toBe(220);
    host.updateStyle("minWidth", "-4px");
    expect(width()).toBe(150);

    // A preview on another selection ends the first record's.
    host.previewStyle("width", "260px");
    workspace.selectRecords([workspace.root.recordsOfSource(BODY)[0]]);
    host.previewStyle("paddingTop", "4px");
    expect(width()).toBe(150);
    expect(graph.revision).toBe(revision + 1);
  });

  it("a token reference written as CSS (var(--…)) reads back as the same text", async () => {
    // The product's node style writers (Styles · AI · style paste · size commands) all go through
    // `catalogStyleWritesOf`: a token is CSS text in the typed field, never an object the view skips.
    const { host } = await open();
    host.updateStyles({
      color: "var(--accent)",
      borderColor: "var(--border)",
      boxShadow: "0 1px 2px var(--shadow-color)",
    });
    expect(host.readSelectedTarget().style).toMatchObject({
      color: "var(--accent)",
      borderColor: "var(--border)",
      boxShadow: "0 1px 2px var(--shadow-color)",
    });
  });
});

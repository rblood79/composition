import "fake-indexeddb/auto";
import { renderHook } from "@testing-library/react";
import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  duplicateNodes,
  insertNodes,
  setFields,
  type CatalogCommand,
} from "../../../../../../packages/shared/src/catalog/commands";
import {
  createDefaultColorFill,
  type FillItem,
} from "../../../types/builder/fill.types";
import { createCatalogStylesHost } from "../../panels/styles/catalog/catalogStylesHost";
import { useOptimizedStyleActions } from "../../panels/styles/hooks/useOptimizedStyleActions";
import {
  StylesHostContext,
  type StylesHost,
} from "../../panels/styles/stylesHost";
import { useToastStore } from "../../stores/toast";
import { catalogComponentCommands } from "../componentActions";
import { catalogPaletteDefinitionId } from "../paletteInsert";
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

  it("a Fill drag previews the paint layers without a step; the release commits, a cancel restores", async () => {
    const { workspace, graph, host, record } = await open();
    host.updateStyle("backgroundColor", "#ff0000");
    const revision = graph.revision;
    const shown = () => workspace.root.domInputs.get(record)!;
    const layer = (color: string): FillItem => ({
      ...createDefaultColorFill(color),
      id: "fill-a",
    });

    host.previewFills!([layer("#00FF00FF")]);
    expect(shown().fills).toMatchObject([
      { kind: "color", color: "#00FF00FF" },
    ]);
    // The fill-derived background the commit removes is not shown under the layers.
    expect(shown().visual).not.toHaveProperty("backgroundColor");
    host.previewFills!([layer("#0000FFFF")]);
    expect(shown().fills).toMatchObject([{ color: "#0000FFFF" }]);
    expect(graph.revision).toBe(revision);
    expect((graph.getEntry(BOX) as NodeEntry).fills).toBeUndefined();

    // A cancel puts the record's own paint back.
    host.cancelPreview!();
    expect(shown().fills).toBeUndefined();
    expect(shown().visual.backgroundColor).toBe("#ff0000");

    // The release commits the layers as one step.
    host.previewFills!([layer("#0000FFFF")]);
    host.updateFills([layer("#0000FFFF")]);
    expect(graph.revision).toBe(revision + 1);
    expect(shown().fills).toMatchObject([{ color: "#0000FFFF" }]);
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

  it("an instance shows its component's values under its own (the old origin baseline)", async () => {
    const { workspace, graph, host } = await open();
    host.updateStyles({ paddingTop: "12px", width: "200px" });
    workspace.execute(
      catalogComponentCommands.create(BOX, "Tile", workspace.newId),
    );
    // ADR-260: the box stays as the origin; its copy is an instance.
    const instance = workspace.execute(
      duplicateNodes({ ids: [BOX], newId: workspace.newId }),
    ).plan.selectAfter![0]!;
    expect(instance).not.toBe(BOX);
    expect((graph.getEntry(instance) as NodeEntry).definitionId).toMatch(
      /^project:definition:/,
    );
    const record = workspace.root.recordsOfSource(instance)[0]!;
    workspace.selectRecords([record]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CatalogWorkspaceProvider workspace={workspace}>
        {children}
      </CatalogWorkspaceProvider>
    );
    const context = renderHook(() => host.useElementStyleContext(record), {
      wrapper,
    });
    expect(context.result.current.style).toMatchObject({
      paddingTop: "12px",
      width: "200px",
    });
    // Its own value wins.
    host.updateStyle("paddingTop", "20px");
    context.rerender();
    expect(context.result.current.style).toMatchObject({
      paddingTop: "20px",
      width: "200px",
    });
  });


  it("a gesture that ended without a commit leaves nothing for the next one to carry over", async () => {
    const { workspace, host, record } = await open();
    const shown = () => workspace.root.domInputs.get(record)!;
    host.updateStyle("width", "100px");
    // A drag that let go without committing (a picker released on the value it started from).
    host.previewStyle("paddingTop", "10px");
    expect(shown().visual.paddingTop).toBe(10);
    // Another edit replaces the record: its preview is gone.
    workspace.undo();
    expect(shown().visual.paddingTop).toBe(undefined);
    // The next drag shows its own key only — not the old gesture's padding.
    host.previewStyle("opacity", "0.5");
    expect(shown().visual.opacity).toBe(0.5);
    expect(shown().visual.paddingTop).toBe(undefined);
  });

  it("a section's preview still waiting for its frame does not come back after a commit or a cancel; a section that goes mid-drag ends its preview", async () => {
    const { workspace, host, record } = await open();
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
      frames.push(callback),
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      frames[id - 1] = () => {};
    });
    const flush = () => frames.splice(0).forEach((callback) => callback(0));
    const width = () =>
      Math.round(workspace.root.getGeometry([record]).get(record)!.width);
    const wrapper = ({ children }: { children: ReactNode }) =>
      createElement(StylesHostContext.Provider, {
        value: host as StylesHost,
        children,
      });
    try {
      host.updateStyle("width", "100px");
      const section = renderHook(() => useOptimizedStyleActions(), { wrapper });
      // The last move and the release land in one frame: the commit runs first.
      section.result.current.updateStylePreview("width", "150px");
      host.updateStyle("width", "120px");
      flush();
      expect(width()).toBe(120);

      // A cancelled drag (Escape) with its last move still waiting.
      section.result.current.updateStylePreview("width", "180px");
      host.cancelPreview!();
      flush();
      expect(width()).toBe(120);

      // The section goes (another selection, another tab) while its drag is on the Canvas.
      section.result.current.updateStylePreview("width", "200px");
      flush();
      expect(width()).toBe(200);
      section.unmount();
      expect(width()).toBe(120);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("a commit that lands the previewed value replaces the record, so ending the drag after the commit keeps it", async () => {
    const { workspace, host, record } = await open();
    const width = () =>
      Math.round(workspace.root.getGeometry([record]).get(record)!.width);
    host.updateStyle("width", "100px");
    host.previewStyle("width", "150px");
    expect(width()).toBe(150);
    // The same width with a sibling in one step: the parent's region is drawn again and the box's
    // new record equals the previewed one.
    const sibling: NodeEntry = {
      kind: "node",
      id: "project:node:sibling" as NodeId,
      definitionId: "lib:definition:type-frame",
      children: [],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
    };
    const both: CatalogCommand = (reader) => {
      const widen = setFields({
        targets: [{ kind: "node", id: BOX }],
        sizing: { width: { kind: "set", value: 150 } },
      })(reader);
      const insert = insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [sibling],
        rootIds: [sibling.id],
        newId: workspace.newId,
      })(reader);
      return { ...insert, ops: [...widen.ops, ...insert.ops] };
    };
    workspace.execute(both);
    expect(workspace.root.previewing(record)).toBe(false);
    // The Styles order: the release commits, then the drag ends.
    host.cancelPreview!();
    expect(width()).toBe(150);
  });
});

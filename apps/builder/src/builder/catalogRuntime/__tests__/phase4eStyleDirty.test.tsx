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
import { newCatalogProjectDocument } from "../project";
import { CatalogWorkspaceProvider } from "../react";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4d-3 Modified · reset · Responsive: a CSS key is modified when the node
 * authors a field it maps to on the active breakpoint's layer (placement for Left/Top); reset drops
 * those writes (the definition's value shows again); a breakpoint override copies the value shown
 * into that layer and visibility is per breakpoint. Mobile reads the tablet layer too.
 */
const BODY = "project:node:home-body" as NodeId;
const BOX = "project:node:box" as NodeId;

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:dirty" as EntryId<"project">,
        name: "Dirty",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-dirty-${Math.random()}`),
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
    visual: { paddingTop: { kind: "set", value: 12 } },
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
  const host = createCatalogStylesHost(workspace);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <CatalogWorkspaceProvider workspace={workspace}>
      {children}
    </CatalogWorkspaceProvider>
  );
  return {
    workspace,
    graph,
    record,
    node: () => graph.getEntry(BOX) as NodeEntry,
    host,
    wrapper,
  };
}

const KEYS = [
  "padding",
  "paddingTop",
  "paddingRight",
  "gap",
  "left",
  "top",
  "position",
] as const;

describe("ADR-248 Phase 4e-4d-3 Modified · reset · Responsive", () => {
  it("modified = the active layer's own writes; reset drops them (nothing authored = no step)", async () => {
    const { workspace, graph, node, host, wrapper, record } = await open();
    const { result, rerender } = renderHook(
      () => host.useDirtyStyleProps(KEYS),
      { wrapper },
    );
    // One authored side: the listed longhand reports it, the `padding` shorthand does not again.
    expect(result.current).toEqual(["paddingTop"]);
    const { result: shorthand } = renderHook(
      () => host.useDirtyStyleProps(["padding", "gap"]),
      { wrapper },
    );
    expect(shorthand.current).toEqual(["padding"]);

    workspace.setBreakpoint("tablet");
    rerender();
    expect(result.current).toEqual([]);
    host.updateStyle("paddingTop", "4px");
    rerender();
    expect(result.current).toEqual(["paddingTop"]);
    host.resetStyles(["paddingTop"]);
    expect(node().responsive).toBe(undefined);
    expect(node().visual.paddingTop).toEqual({ kind: "set", value: 12 });

    workspace.setBreakpoint("desktop");
    host.applyAbsolute(record, true);
    rerender();
    expect(result.current).toEqual(["paddingTop", "left", "top", "position"]);
    const revision = graph.revision;
    host.resetStyles([...KEYS]);
    expect(graph.revision).toBe(revision + 1);
    expect(node().visual.paddingTop).toBe(undefined);
    expect(node().placement).toBe(undefined);
    rerender();
    expect(result.current).toEqual([]);
    host.resetStyles([...KEYS]);
    expect(graph.revision).toBe(revision + 1);
  });

  it("mobile shows the tablet layer's value over the base", async () => {
    const { workspace, host } = await open();
    workspace.setBreakpoint("tablet");
    host.updateStyle("paddingTop", "4px");
    workspace.setBreakpoint("mobile");
    expect(host.readSelectedTarget().style.paddingTop).toBe("4px");
    host.updateStyle("paddingTop", "2px");
    expect(host.readSelectedTarget().style.paddingTop).toBe("2px");
    workspace.setBreakpoint("tablet");
    expect(host.readSelectedTarget().style.paddingTop).toBe("4px");
  });

  it("an override copies the shown value into the layer; off drops it; visibility is per breakpoint", async () => {
    const { workspace, node, host, wrapper } = await open();
    const { result, rerender } = renderHook(
      () => host.useResponsiveOverrides(),
      { wrapper },
    );
    expect(result.current).toMatchObject({
      isBase: true,
      activeOverriddenProps: [],
      totalOverrideCount: 0,
    });
    // Desktop is the base: no override to turn on.
    host.setResponsiveOverride("padding", true);
    expect(node().responsive).toBe(undefined);

    workspace.setBreakpoint("tablet");
    host.setResponsiveOverride("padding", true, { paddingLeft: "8px" });
    expect(node().responsive?.tablet?.visual).toEqual({
      paddingTop: { kind: "set", value: 12 },
      paddingRight: { kind: "set", value: 0 },
      paddingBottom: { kind: "set", value: 0 },
      paddingLeft: { kind: "set", value: 8 },
    });
    rerender();
    expect(result.current.activeOverriddenProps).toEqual([
      "paddingBottom",
      "paddingLeft",
      "paddingRight",
      "paddingTop",
    ]);
    expect(result.current.activeOverrideValues.paddingTop).toBe("12px");

    host.setResponsiveVisibility("tablet", false);
    expect(node().visibility).toEqual({ tablet: false });
    // Hidden at the breakpoint shown: the record is not drawn, so the selection drops it.
    expect(workspace.session.getSnapshot().selection).toEqual([]);
    workspace.setBreakpoint("desktop");
    workspace.selectRecords([workspace.root.recordsOfSource(BOX)[0]]);
    rerender();
    expect(result.current.visibility).toEqual({ tablet: false });
    expect(result.current.totalOverrideCount).toBe(5);
    // Shown again from another breakpoint (the tablet record does not exist while hidden).
    host.setResponsiveVisibility("tablet", true);
    workspace.setBreakpoint("tablet");
    workspace.selectRecords([workspace.root.recordsOfSource(BOX)[0]]);

    host.setResponsiveOverride("padding", false);
    expect(node().responsive).toBe(undefined);
    expect(node().visibility).toBe(undefined);
  });
});

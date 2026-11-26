import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import type {
  EntryId,
  LibraryDefinitionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { resizablePanelBinding } from "../../../../../../packages/shared/src/catalog/bindings/Resizable.binding";
import { createCatalogStylesHost } from "../../panels/styles/catalog/catalogStylesHost";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-318 후속 (사용자 2026-11-26 「resizablePanel 의 minsize, maxsize, defaultsize 는 layout 탭의
 * size 와 동기화」): a Panel's size on its Group's axis has one store — its share props. The Layout
 * tab's Width · Min W · Max W (a vertical Group's Height ones) read and write `defaultSize` ·
 * `minSize` · `maxSize`, no box style; Fill and the other axis are refused; the Property tab no
 * longer shows a second set of fields.
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;

async function place() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr318-size" as EntryId<"project">,
        name: "ADR-318 size fields",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr318-size-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
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
          definitionId:
            "lib:definition:origin-component-resizablepanelgroup" as LibraryDefinitionId,
          children: [],
          props: {},
          visual: { width: { kind: "set", value: 601 } } as never,
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [PLACED],
      newId: workspace.newId,
    }),
  );
  const graph = workspace.runtime.graph;
  const placed = graph.getEntry(PLACED);
  const fill =
    placed?.kind === "node"
      ? placed.descendantOverrides.find((o) => o.kind === "fillSlot")
      : undefined;
  const [p1] = fill?.kind === "fillSlot" ? fill.childIds : [];
  const record = () => workspace.root.recordsOfSource(p1 as NodeId)[0]!;
  const entry = () => {
    const e = graph.getEntry(p1 as NodeId);
    return e?.kind === "node" ? e : undefined;
  };
  workspace.selectRecords([record()]);
  const host = createCatalogStylesHost(workspace);
  const box = () => {
    const canvas = [...workspace.root.canvasInputs.values()].find(
      (r) => r.sourceId === p1,
    )!;
    return workspace.root.getGeometry([canvas.id]).get(canvas.id)!;
  };
  return { workspace, host, entry, record, box };
}

describe("ADR-318 후속 — a Resizable Panel's Layout size fields are its share props", () => {
  it("Width · Min W · Max W write defaultSize · minSize · maxSize (no box style) and read them back", async () => {
    const t = await place();
    // An absent defaultSize shows the equal part it draws.
    expect(t.host.readSelectedTarget().effective?.width).toBe("50%");
    t.host.updateStyle("width", "30%");
    expect(t.entry()?.props.defaultSize).toEqual({ kind: "set", value: 30 });
    t.host.updateStyle("minWidth", "120px");
    t.host.updateStyle("maxWidth", "80%");
    expect(t.entry()?.props.minSize).toEqual({ kind: "set", value: "120px" });
    expect(t.entry()?.props.maxSize).toEqual({ kind: "set", value: "80%" });
    const visual = t.entry()?.visual as Record<string, unknown>;
    expect(visual.width).toBeUndefined();
    expect(visual.minWidth).toBeUndefined();
    expect(visual.maxWidth).toBeUndefined();
    expect(t.host.readSelectedTarget().style).toMatchObject({
      width: "30%",
      minWidth: "120px",
      maxWidth: "80%",
    });
    // The Canvas lays it at 30 % of the Panels' space (601 − the 1 px Handle).
    expect(t.box().width).toBeCloseTo(180, 0);
    // Reset: the share goes back to the equal part.
    t.host.updateStyle("width", "");
    expect(t.entry()?.props.defaultSize).toBeUndefined();
    expect(t.box().width).toBeCloseTo(300, 0);
  });

  it("the size mode menu: a % writes defaultSize; Fill, px and the other axis write nothing", async () => {
    const t = await place();
    t.host.applySizing(t.host.readSelectedId(), {
      axis: "width",
      mode: "css",
      value: "40%",
    });
    expect(t.entry()?.props.defaultSize).toEqual({ kind: "set", value: 40 });
    t.host.applySizing(t.host.readSelectedId(), {
      axis: "width",
      mode: "fill",
    });
    t.host.updateStyle("width", "200px");
    t.host.applySizing(t.host.readSelectedId(), {
      axis: "height",
      mode: "css",
      value: "100px",
    });
    expect(t.entry()?.props.defaultSize).toEqual({ kind: "set", value: 40 });
    expect(t.entry()?.sizing).toEqual({});
  });

  it("a vertical Group: Height · Min H · Max H are the share props", async () => {
    const t = await place();
    t.workspace.execute(
      setFields({
        targets: [{ kind: "node", id: PLACED }],
        props: { orientation: { kind: "set", value: "vertical" } },
      }),
    );
    expect(t.host.readSelectedTarget().effective?.height).toBe("50%");
    t.host.updateStyle("height", "25%");
    t.host.updateStyle("minHeight", "10%");
    expect(t.entry()?.props.defaultSize).toEqual({ kind: "set", value: 25 });
    expect(t.entry()?.props.minSize).toEqual({ kind: "set", value: "10%" });
    expect(
      (t.entry()?.visual as Record<string, unknown>).height,
    ).toBeUndefined();
  });

  it("the Property tab does not show a second set of size fields", () => {
    const accepts = resizablePanelBinding.props.accepts as Record<
      string,
      { editorHidden?: boolean }
    >;
    expect(accepts.defaultSize?.editorHidden).toBe(true);
    expect(accepts.minSize?.editorHidden).toBe(true);
    expect(accepts.maxSize?.editorHidden).toBe(true);
  });
});

// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
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
import { renderCatalogDom } from "../domBinding";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { getPaletteItems } from "../../panels/components/paletteItems";

/**
 * ADR-318 G1 — the Resizable split view through the real composition root: the palette origin
 * (`Group > Panel · Handle · Panel`), the Canvas boxes the engine lays out from the Panels' derived
 * shares (`styleOf`) and the DOM's inline values (`authoredStyle`) — one formula, both consumers, after
 * an edit and its undo. Expected sizes are written out (the Group 600 wide, its Handle 1 px).
 */
const BODY = "project:node:home-body" as NodeId;
const PLACED = "project:node:placed" as NodeId;

async function place() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr318-g1" as EntryId<"project">,
        name: "ADR-318 G1",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr318-g1-${Math.random()}`),
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
          visual: { width: { kind: "set", value: 600 } } as never,
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [PLACED],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const group = () =>
    [...root.canvasInputs.values()].find((r) => r.sourceId === PLACED)!;
  const parts = () => group().children.map((id) => root.canvasInputs.get(id)!);
  const boxes = () => {
    const ids = [group().id, ...group().children];
    const geo = root.getGeometry(ids);
    const g = geo.get(ids[0])!;
    return ids.map((id) => {
      const b = geo.get(id)!;
      return [b.x - g.x, b.y - g.y, b.width, b.height].map(
        (v) => Math.round(v * 10) / 10,
      );
    });
  };
  const write = (target: "group" | 0 | 2, props: Record<string, unknown>) =>
    workspace.execute(
      setFields({
        targets: [
          workspace.itemOfRecord(
            target === "group" ? group().id : parts()[target]!.id,
          )!.target,
        ],
        props: Object.fromEntries(
          Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
        ) as never,
      }),
    );
  return { workspace, root, group, parts, boxes, write };
}

let unmount: (() => Promise<void>) | undefined;
afterEach(async () => {
  await unmount?.();
  unmount = undefined;
  document.body.innerHTML = "";
});

async function inlineStyles(t: Awaited<ReturnType<typeof place>>) {
  await unmount?.();
  const host = document.createElement("div");
  document.body.append(host);
  const react = createRoot(host);
  await act(async () => react.render(renderCatalogDom(t.root, t.group().id)));
  unmount = async () => act(async () => react.unmount());
  const of = (id: string) =>
    host.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`) as HTMLElement;
  return [t.group(), ...t.parts()].map((record) => {
    const el = of(record.id);
    return {
      cls: el.className,
      flexGrow: el.style.flexGrow,
      flexBasis: el.style.flexBasis,
      flexDirection: el.style.flexDirection,
      width: el.style.width,
      height: el.style.height,
      minWidth: el.style.minWidth,
      maxHeight: el.style.maxHeight,
    };
  });
}

describe("ADR-318 G1 — Resizable static layout (Canvas engine · DOM inline)", () => {
  it("the palette places the origin: Group > Panel · Handle · Panel", async () => {
    expect(
      getPaletteItems().some((item) => item.type === "ResizablePanelGroup"),
    ).toBe(true);
    const t = await place();
    expect(t.parts().map((r) => t.root.typeOf(r))).toEqual([
      "ResizablePanel",
      "ResizableHandle",
      "ResizablePanel",
    ]);
  });

  it("50 / 50 → defaultSize 30 → min 200px → undo: Canvas boxes and DOM inline follow", async () => {
    const t = await place();
    // 600 − 1 (the Handle) = 599 shared.
    expect(t.boxes().slice(1)).toEqual([
      [0, 0, 299.5, 200],
      [299.5, 0, 1, 200],
      [300.5, 0, 299.5, 200],
    ]);
    let dom = await inlineStyles(t);
    expect(dom.map((d) => [d.flexGrow, d.flexBasis])).toEqual([
      ["", ""],
      ["50", "0px"],
      ["", ""],
      ["50", "0px"],
    ]);
    expect(dom[0]!.flexDirection).toBe("row");
    expect(dom[2]!.width).toBe("1px");

    t.write(0, { defaultSize: 30 });
    expect(t.boxes()[1]![2]).toBeCloseTo(179.7, 1);
    expect(t.boxes()[3]![2]).toBeCloseTo(419.3, 1);
    dom = await inlineStyles(t);
    expect([dom[1]!.flexGrow, dom[3]!.flexGrow]).toEqual(["30", "70"]);

    t.write(0, { defaultSize: 10, minSize: "200px" });
    expect(t.boxes()[1]![2]).toBe(200);
    expect(t.boxes()[3]![2]).toBe(399);
    dom = await inlineStyles(t);
    expect(dom[1]!.minWidth).toBe("200px");

    t.workspace.undo();
    t.workspace.undo();
    expect(t.boxes()[1]![2]).toBe(299.5);
    dom = await inlineStyles(t);
    expect([dom[1]!.flexGrow, dom[1]!.minWidth]).toEqual(["50", ""]);
  });

  it("vertical: the Group's direction and the Handle's thickness turn, min · max on the column axis", async () => {
    const t = await place();
    t.write("group", { orientation: "vertical" });
    t.write(2, { maxSize: "25%" });
    // 200 − 1 = 199; the second Panel's max 25% of 200 = 50.
    expect(t.boxes().slice(1)).toEqual([
      [0, 0, 600, 149],
      [0, 149, 600, 1],
      [0, 150, 600, 50],
    ]);
    const dom = await inlineStyles(t);
    expect(dom[0]!.flexDirection).toBe("column");
    expect([dom[2]!.width, dom[2]!.height]).toEqual(["", "1px"]);
    expect(dom[3]!.maxHeight).toBe("25%");
  });
});

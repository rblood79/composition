// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  setFields,
  insertNodes,
} from "../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeId,
  NodeEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { newCatalogProjectDocument } from "../project";
import { CatalogWorkspace } from "../workspace";
import { CatalogStorage } from "../storage";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";
import { renderCatalogDom } from "../domBinding";
import { bindCatalogCanvas } from "../canvasBinding";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";

async function open() {
  const library = await buildCodeCatalogLibrary();
  const storage = new CatalogStorage(indexedDB, `action-${Math.random()}`);
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:actions",
        name: "Actions",
      }),
      library,
    ),
    storage,
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
      textMeasure: (text, font) => ({
        width: (text.length * font.fontSize) / 2,
        minWidth: (text.length * font.fontSize) / 2,
        height: font.fontSize * font.lineHeight,
      }),
    },
  );
  const id = "project:node:actions" as NodeId;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id,
          definitionId: "lib:definition:origin-component-actionbuttongroup",
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [id],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const of = (type: string) =>
    [...root.domInputs.values()].filter((node) => root.typeOf(node) === type);
  const write = (record: string, props: Record<string, string | boolean>) =>
    workspace.execute(
      setFields({
        targets: [workspace.positionOfRecord(record)!.target],
        props: Object.fromEntries(
          Object.entries(props).map(([key, value]) => [
            key,
            { kind: "set", value },
          ]),
        ),
      }),
    );
  const box = (record: string) => root.getGeometry([record]).get(record)!;
  const group = () => of("ActionButtonGroup")[0]!;
  const paint = () => {
    const binding = bindCatalogCanvas(root, root.pageRootRecords());
    const result = of("ActionButton").map((node) => getSkiaNode(node.id)?.box);
    binding.dispose();
    return result;
  };
  return { workspace, root, of, write, box, group, paint, library, storage };
}

describe("ActionButton family catalog consumers", () => {
  it("propagates group size and spacing on initial load, edits, Undo and reload", async () => {
    const h = await open();
    expect(h.of("ActionButton")).toHaveLength(2);
    expect(h.box(h.of("ActionButton")[0]!.id).height).toBe(32);
    h.write(h.group().id, {
      size: "XL",
      density: "compact",
      orientation: "vertical",
    });
    expect(h.of("ActionButton").map((n) => n.props.size)).toEqual(["XL", "XL"]);
    const [first, second] = h.of("ActionButton").map((n) => h.box(n.id));
    expect(first!.height).toBe(48);
    expect(second!.y - first!.y - first!.height).toBeCloseTo(2);
    expect(h.paint().map((box) => box?.borderRadius)).toEqual([
      [10, 10, 0, 0],
      [0, 0, 10, 10],
    ]);
    const document = h.workspace.runtime.graph.exportDocument();
    expect(new CatalogGraph(document, h.library).exportDocument()).toEqual(
      document,
    );
    h.workspace.undo();
    expect(h.box(h.of("ActionButton")[0]!.id).height).toBe(32);
    h.workspace.dispose();
  });

  it("divides an authored group width equally when justified", async () => {
    const h = await open();
    h.write(h.group().id, { isJustified: true });
    h.workspace.execute(
      setFields({
        targets: [h.workspace.positionOfRecord(h.group().id)!.target],
        sizing: { width: { kind: "set", value: 300 } },
      }),
    );
    const [first, second] = h.of("ActionButton").map((n) => h.box(n.id));
    expect(first!.width).toBe(146);
    expect(second!.width).toBe(146);
    expect(second!.x - first!.x - first!.width).toBe(8);
    h.workspace.dispose();
  });

  it("keeps icon-only controls square and draws the pending indicator on Canvas", async () => {
    const h = await open();
    const first = h.of("ActionButton")[0]!;
    h.write(first.id, { label: "" });
    expect(h.box(first.id).width).toBe(32);
    expect(h.box(first.id).height).toBe(32);
    h.write(first.id, { isPending: true });
    const binding = bindCatalogCanvas(h.root, h.root.pageRootRecords());
    expect(getSkiaNode(first.id)?.children?.some((child) => child.arc)).toBe(
      true,
    );
    binding.dispose();
    h.workspace.dispose();
  });

  it("renders a toolbar and actual buttons, group quiet/color/disabled and child explicit false", async () => {
    const h = await open();
    const before = h.paint();
    h.write(h.group().id, {
      isQuiet: true,
      staticColor: "white",
      isDisabled: true,
    });
    expect(
      h.of("ActionButton").every((n) => n.derivedProps?.isDisabled === true),
    ).toBe(true);
    expect(h.paint()).not.toEqual(before);
    const first = h.of("ActionButton")[0]!;
    h.write(first.id, { isDisabled: false });
    const host = document.createElement("div");
    document.body.append(host);
    const reactRoot = createRoot(host);
    try {
      await act(async () =>
        reactRoot.render(renderCatalogDom(h.root, h.group().id)),
      );
      expect(host.querySelector('[role="toolbar"]')).not.toBeNull();
      const buttons = host.querySelectorAll("button");
      expect(buttons).toHaveLength(2);
      expect(buttons[0]!.disabled).toBe(false);
      expect(buttons[1]!.disabled).toBe(true);
      expect(buttons[0]!.dataset.quiet).toBe("true");
      expect(buttons[0]!.dataset.staticColor).toBe("white");
      expect(buttons[0]!.textContent).toBe("Copy");
    } finally {
      await act(async () => reactRoot.unmount());
      host.remove();
      h.workspace.dispose();
    }
  });
});

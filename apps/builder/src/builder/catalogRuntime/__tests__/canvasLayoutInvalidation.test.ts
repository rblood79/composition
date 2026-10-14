import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { insertNodes } from "../../../../../../packages/shared/src/catalog/commands";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { createCatalogStylesHost } from "../../panels/styles/catalog/catalogStylesHost";
import { CatalogCanvasScene } from "../canvasScene";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BODY = "project:node:home-body" as NodeId;
const cases = [
  {
    name: "borderTopWidth fixed Body",
    target: "body",
    initial: { display: "flex", flexDirection: "column" },
    patch: { borderTopWidth: "12px" },
  },
  {
    name: "borderLeftWidth fixed Body",
    target: "body",
    initial: { display: "flex", flexDirection: "column" },
    patch: { borderLeftWidth: "12px" },
  },
  {
    name: "marginBottom block sibling",
    target: "first",
    initial: { display: "block" },
    patch: { marginBottom: "24px" },
  },
  {
    name: "marginTop block sibling",
    target: "first",
    initial: { display: "block" },
    patch: { marginTop: "24px" },
  },
  {
    name: "marginBottom flex sibling",
    target: "first",
    initial: { display: "flex", flexDirection: "column" },
    patch: { marginBottom: "24px" },
  },
  {
    name: "marginRight flex row sibling",
    target: "first",
    initial: { display: "flex", flexDirection: "row" },
    patch: { marginRight: "24px" },
  },
  {
    name: "grid placement sibling",
    target: "first",
    initial: {
      display: "grid",
      gridTemplateColumns: "100px 100px 100px",
      gridTemplateRows: "100px 100px",
    },
    patch: { gridColumnStart: "2" },
  },
  {
    name: "padding fixed Body control",
    target: "body",
    initial: { display: "flex", flexDirection: "column" },
    patch: { paddingTop: "12px" },
  },
  {
    name: "grid tracks fixed Body control",
    target: "body",
    initial: { display: "grid", gridTemplateColumns: "100px 100px 100px" },
    patch: { gridTemplateColumns: "200px 100px 100px" },
  },
  {
    name: "gap fixed Body control",
    target: "body",
    initial: { display: "flex", flexDirection: "column" },
    patch: { rowGap: "24px" },
  },
  {
    name: "maxWidth child control",
    target: "first",
    initial: { display: "flex", flexDirection: "row" },
    patch: { maxWidth: "20px" },
  },
] as const;

describe("Canvas layout input invalidation", () => {
  it.each(cases)("$name", async (c) => {
    const ws = new CatalogWorkspace(
      new CatalogGraph(
        newCatalogProjectDocument({
          projectId: "project:project:audit",
          name: "audit",
        }),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `audit-${Math.random()}`),
      {
        engine: await nodeLayoutEngine(),
        viewport: { width: 800, height: 600 },
        autosaveSchedule: () => {},
      },
    );
    const host = createCatalogStylesHost(ws);
    const body = ws.root.recordsOfSource(BODY)[0];
    ws.selectRecords([body]);
    host.updateStyles({ ...c.initial });
    const entries: NodeEntry[] = ["a", "b", "c"].map((name) => ({
      kind: "node",
      id: `project:node:${name}` as NodeId,
      definitionId: "lib:definition:type-frame",
      children: [],
      props: {},
      visual: {},
      sizing: {
        width: { kind: "set", value: 40 },
        height: { kind: "set", value: 20 },
      },
      descendantOverrides: [],
    }));
    ws.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries,
        rootIds: entries.map((e) => e.id),
        newId: ws.newId,
      }),
    );
    const scene = new CatalogCanvasScene(ws.root);
    const ids = entries.map((e) => ws.root.recordsOfSource(e.id)[0]);
    const check = () => {
      scene.sync();
      for (const id of ids) {
        const rect = ws.root.getGeometry([id]).get(id)!;
        const node = getSkiaNode(id)!;
        expect({
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height,
        }).toEqual({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        });
      }
    };
    try {
      ws.selectRecords([c.target === "body" ? body : ids[0]]);
      const [property, value] = Object.entries(c.patch)[0];
      host.previewStyle(property, value);
      check();
      host.cancelPreview!();
      check();
      host.updateStyles({ ...c.patch });
      check();
      ws.undo();
      check();
      ws.redo();
      check();
    } finally {
      scene.dispose();
      ws.dispose();
    }
  });
});

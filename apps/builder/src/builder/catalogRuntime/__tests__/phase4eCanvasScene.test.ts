import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { getSkiaNode } from "../../workspace/canvas/skia/useSkiaNode";
import { CatalogCanvasScene } from "../canvasScene";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-2 Canvas scene: a new project's page body is the scene root; a leaf edit
 * patches the bound stream (subtree splice), a structure edit or a new page root binds it again,
 * and undo returns the drawn value.
 */
const PROJECT = "project:project:scene" as EntryId<"project">;
const HOME = "project:page:home" as EntryId<"page">;
const BODY = "project:node:home-body" as NodeId;
const text = (name: string, value: string): NodeEntry => ({
  kind: "node",
  id: `project:node:${name}` as NodeId,
  definitionId: "lib:definition:text",
  children: [],
  props: { children: { kind: "set", value } },
  visual: {},
  sizing: {},
  descendantOverrides: [],
});
const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:s${++next}` as EntryId<K>;
};

async function open() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({ projectId: PROJECT, name: "Scene" }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-scene-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  return { workspace, scene: new CatalogCanvasScene(workspace.root) };
}

describe("ADR-248 Phase 4e-2 Canvas scene", () => {
  it("draws the page body, patches a leaf edit, rebinds structure and page roots, follows undo", async () => {
    const { workspace, scene } = await open();
    expect(scene.pageRootIds).toEqual(workspace.root.recordsOfSource(BODY));
    const bodyRecord = scene.pageRootIds[0];
    expect(getSkiaNode(bodyRecord)).toMatchObject({
      type: "box",
      width: 1920,
      height: 1080,
    });

    // Insert under the body: the body's children change → the scene binds again.
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [text("a", "Hello")],
        rootIds: [text("a", "").id],
        newId: allocator(),
      }),
    );
    expect(scene.sync()).toEqual({ kind: "rebound", reason: "structure" });
    const [record] = workspace.root.recordsOfSource(text("a", "").id);
    expect(getSkiaNode(record)?.text?.content).toBe("Hello");

    // A leaf value edit is a patch of the bound stream, not a rebind.
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: text("a", "").id }],
        props: { children: { kind: "set", value: "Hello world" } },
      }),
    );
    const patched = scene.sync();
    expect(patched.kind).toBe("patched");
    expect(getSkiaNode(record)?.text?.content).toBe("Hello world");
    expect(scene.sync()).toEqual({ kind: "unchanged" });

    // A second root on the page is a new scene root.
    workspace.execute(
      insertNodes({
        parent: { kind: "page", id: HOME },
        entries: [text("b", "Second")],
        rootIds: [text("b", "").id],
        newId: allocator(),
      }),
    );
    expect(scene.sync()).toEqual({ kind: "rebound", reason: "page-roots" });
    expect(scene.pageRootIds).toHaveLength(2);

    workspace.undo();
    expect(scene.sync()).toEqual({ kind: "rebound", reason: "page-roots" });
    workspace.undo();
    expect(scene.sync().kind).toBe("patched");
    expect(getSkiaNode(record)?.text?.content).toBe("Hello");
    scene.dispose();
    expect(getSkiaNode(bodyRecord)).toBeUndefined();
  });
});

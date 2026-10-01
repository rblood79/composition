import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EntryId,
  EntryKind,
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
import { catalogStyleWritesOf } from "../styleFields";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * A Styles or AI style edit writes `backgroundColor` (a valid visual field the DOM paints as the
 * CSS background, like `fill`); the Canvas failed the whole scene on it
 * (`CATALOG_CANVAS_VISUAL_UNSUPPORTED`). It paints it as the box background — the later of
 * `fill` / `backgroundColor` wins, as the DOM's inline style does.
 */
const A = "project:node:a" as NodeId;

async function open() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:bg" as EntryId<"project">,
        name: "Bg",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `adr248-bg-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1920, height: 1080 },
      autosaveSchedule: () => {},
    },
  );
  let next = 0;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: "project:node:home-body" as NodeId },
      entries: [
        {
          kind: "node",
          id: A,
          definitionId: "lib:definition:type-frame" as never,
          children: [],
          props: {},
          visual: {},
          sizing: {
            width: { kind: "set", value: 100 },
            height: { kind: "set", value: 50 },
          },
          descendantOverrides: [],
        },
      ],
      rootIds: [A],
      newId: <K extends EntryKind>(kind: K) =>
        `project:${kind}:bg${++next}` as EntryId<K>,
    }),
  );
  const style = (styles: Record<string, string>) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: A }],
        ...catalogStyleWritesOf(styles),
      } as Parameters<typeof setFields>[0]),
    );
  return { workspace, style };
}

describe("ADR-248 Phase 4e Canvas paints a backgroundColor write", () => {
  it("a frame with a backgroundColor style draws that background (the scene binds)", async () => {
    const { workspace, style } = await open();
    style({ backgroundColor: "#ff0000" });
    const scene = new CatalogCanvasScene(workspace.root);
    const record = workspace.root.recordsOfSource(A)[0];
    expect(scene.stream.boundsMap.has(record)).toBe(true);
    expect([...(getSkiaNode(record)?.box?.fillColor ?? [])]).toEqual([
      1, 0, 0, 1,
    ]);
    // A later edit to the background color patches it (the update path folds it the same way).
    style({ backgroundColor: "#0000ff" });
    scene.sync();
    expect([...(getSkiaNode(record)?.box?.fillColor ?? [])]).toEqual([
      0, 0, 1, 1,
    ]);
    // A fill written after it is the later key: it wins on both consumers.
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: A }],
        visual: { fill: { kind: "set", value: "#00ff00" } },
      }),
    );
    scene.sync();
    expect(Object.keys(workspace.root.domInputs.get(record)!.visual)).toEqual(
      expect.arrayContaining(["backgroundColor", "fill"]),
    );
    expect([...(getSkiaNode(record)?.box?.fillColor ?? [])]).toEqual([
      0, 1, 0, 1,
    ]);
  });
});

import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import { catalogChildKind } from "../../../../../../packages/shared/src/catalog/nesting/nestingRules";
import type {
  EntryId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogPaletteInsertCommand } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

const BODY = "project:node:home-body" as NodeId;

/**
 * S2 `Image` `renderError` (부록 D.2, 사용자 결정 2026-11-23 「오류 대체 내용」): an Image takes nodes —
 * what it shows without a picture. The Canvas hides them while the Image has a source and shows them
 * without one (the DOM also on a failed load — `catalogImageBox.test.tsx`), following a `src` edit.
 */
async function fixture() {
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:image-fallback" as EntryId<"project">,
        name: "image fallback",
      }),
      await buildCodeCatalogLibrary(),
    ),
    new CatalogStorage(indexedDB, `image-fallback-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 900 },
      autosaveSchedule: () => {},
    },
  );
  const root = () => workspace.root;
  const of = (type: string) =>
    [...root().canvasInputs.values()].filter((r) => root().typeOf(r) === type);
  const insert = (type: string, parent: { kind: "node"; id: NodeId }) =>
    workspace.execute(
      catalogPaletteInsertCommand(
        {
          graph: workspace.runtime.graph,
          records: workspace.root.domInputs,
          selection: () => [],
          itemOfRecord: (id) => workspace.itemOfRecord(id),
          pageContent: () => parent,
          newId: workspace.newId,
        },
        type,
        {},
      )!,
    );
  insert("Image", { kind: "node", id: BODY });
  const image = () => of("Image")[0]!;
  insert("Text", { kind: "node", id: image().sourceId as NodeId });
  const writeSrc = (src: string) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: image().sourceId as NodeId }],
        props: { src: { kind: "set", value: src } },
      }),
    );
  const fallbackHidden = () =>
    root().canvasInputs.get(image().children[0]!)?.hidden === true;
  return { image, writeSrc, fallbackHidden };
}

describe("S2 Image error content — the nodes in an Image show only without a picture", () => {
  it("an Image takes children (no longer a DOM leaf)", () => {
    expect(catalogChildKind("Image").kind).toBe("free");
  });

  it("Canvas: shown without a source, hidden with one, shown again when it is cleared", async () => {
    const f = await fixture();
    expect(f.image().children.length).toBe(1);
    f.writeSrc("");
    expect(f.fallbackHidden()).toBe(false);
    f.writeSrc("https://img.example.test/a.png");
    expect(f.fallbackHidden()).toBe(true);
    f.writeSrc("");
    expect(f.fallbackHidden()).toBe(false);
  });
});

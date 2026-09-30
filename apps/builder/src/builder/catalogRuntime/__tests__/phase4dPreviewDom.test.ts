import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  EditTarget,
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
  TemplateId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  insertNodes,
  removeTargets,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { documentOf } from "../../../../../../packages/shared/src/catalog/commands/__tests__/fixture";
import { CatalogPreviewReceiver } from "../../../../../../packages/shared/src/catalog/preview/receiver";
import type { LayoutEngineAPI } from "../../workspace/canvas/wasm-bindings/layoutBridge";
import { CatalogCompositionRoot } from "../compositionRoot";
import { CatalogRuntime } from "../controller";
import { CatalogPreviewChannel } from "../previewChannel";
import { CatalogStorage } from "../storage";

/**
 * ADR-248 Phase 4d Preview DOM path: the Preview runs its own runtime (read-only, no storage) and
 * composition root over the replica graph and takes each delta as a `sync` step, so the DOM
 * binding reads the same records it reads in the Builder. Oracle: after every edit, undo and
 * redo, the replica root's DOM inputs equal the Builder root's.
 */
class CountLayoutEngine implements LayoutEngineAPI {
  private next = 1;
  isAvailable() {
    return true;
  }
  hasBinaryProtocol() {
    return false;
  }
  buildTreeBatch(json: string) {
    return (JSON.parse(json) as unknown[]).map(() => this.next++);
  }
  buildTreeBatchBinary(): number[] {
    throw new Error("not used");
  }
  createNodeRaw() {
    return this.next++;
  }
  updateStyleRaw() {}
  setChildren() {}
  markDirty() {}
  removeNode() {}
  setViewport() {}
  computeLayout() {}
  getLayoutsBatch() {
    return new Map();
  }
  clear() {}
  nodeCount() {
    return this.next - 1;
  }
}
const VIEWPORT = { width: 1440, height: 900 };
const id = (name: string) => `project:node:${name}` as NodeId;
const node = (
  name: string,
  definitionId: string,
  patch: Partial<NodeEntry> = {},
) =>
  ({
    kind: "node",
    id: id(name),
    definitionId,
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
    ...patch,
  }) as NodeEntry;
const text = (name: string, value: string) =>
  node(name, "lib:definition:text", {
    props: { children: { kind: "set", value } },
  });
const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:d${++next}` as EntryId<K>;
};

describe("ADR-248 Phase 4d Preview DOM path", () => {
  it("the replica root's DOM inputs follow the Builder root's through edits, instance overrides, undo and redo", async () => {
    const library = await buildCodeCatalogLibrary();
    const builderRuntime = new CatalogRuntime(
      new CatalogGraph(
        documentOf(
          [
            node("frame", "lib:definition:type-frame", {
              children: [id("a")],
            }),
            text("a", "A"),
            node("list", "lib:definition:origin-component-listbox"),
          ],
          ["frame", "list"],
        ),
        library,
      ),
      new CatalogStorage(indexedDB, `adr248-phase4d-dom-${Math.random()}`),
    );
    const builder = new CatalogCompositionRoot(
      builderRuntime,
      new CountLayoutEngine(),
      VIEWPORT,
    );
    let preview: CatalogCompositionRoot | undefined;
    let rebuilt = 0;
    const channel: CatalogPreviewChannel = new CatalogPreviewChannel(
      builderRuntime,
      { post: (message) => receiver.receive(structuredClone(message)) },
    );
    const receiver = new CatalogPreviewReceiver(
      library,
      (request) => channel.onPreviewMessage(structuredClone(request)),
      (_graph, ops) => preview!.sync(ops),
    );
    receiver.subscribe((update) => {
      if (update.invalidatedIds !== "all") return;
      rebuilt++;
      preview = new CatalogCompositionRoot(
        new CatalogRuntime(update.graph),
        new CountLayoutEngine(),
        VIEWPORT,
      );
    });
    channel.onReady();
    const same = () =>
      expect([...preview!.domInputs]).toEqual([...builder.domInputs]);
    same();
    expect(builder.domInputs.size).toBeGreaterThan(10);
    builder.execute(
      setFields({
        targets: [{ kind: "node", id: id("a") }],
        props: { children: { kind: "set", value: "A1" } },
      }),
    );
    same();
    const label: EditTarget = {
      kind: "descendant",
      ownerId: id("list"),
      address: {
        instances: [
          id("list"),
          "lib:template:component-listbox__item-1" as TemplateId,
        ],
        templatePath: [
          "lib:template:component-listbox-item-default" as TemplateId,
          "lib:template:component-listbox-item-default__label" as TemplateId,
        ],
      },
    };
    builder.execute(
      setFields({
        targets: [label],
        props: { children: { kind: "set", value: "Mail" } },
      }),
    );
    same();
    builder.execute(
      insertNodes({
        parent: { kind: "node", id: id("frame") },
        entries: [text("b", "B")],
        rootIds: [id("b")],
        newId: allocator(),
      }),
    );
    builder.execute(
      removeTargets({ targets: [{ kind: "node", id: id("a") }] }),
    );
    same();
    builder.undo();
    same();
    builder.redo();
    same();
    expect(rebuilt).toBe(1);
    expect(preview!.runtime.historyDepth).toEqual({ undo: 0, redo: 0 });
    expect(preview!.runtime.pendingCount).toBe(0);
    await expect(preview!.runtime.save()).rejects.toThrow(
      "CATALOG_READ_ONLY_REPLICA",
    );
  });
});

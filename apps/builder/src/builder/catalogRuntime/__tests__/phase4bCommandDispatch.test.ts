import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { createG1Fixture } from "../../../../../../packages/shared/src/catalog/document/fixture";
import type {
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
  ThemeEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogCommand } from "../../../../../../packages/shared/src/catalog/commands/compose";
import {
  createTheme,
  insertNodes,
  setFields,
  updatePage,
} from "../../../../../../packages/shared/src/catalog/commands";
import type { LayoutEngineAPI } from "../../workspace/canvas/wasm-bindings/layoutBridge";
import { CatalogCompositionRoot } from "../compositionRoot";
import { CatalogRuntime } from "../controller";
import { CatalogStorage } from "../storage";

/**
 * ADR-248 Phase 4b: the Builder runs a user action as a command through the composition root —
 * one transaction, one entry in the project's single undo stack (pages and themes included), the
 * Canvas/DOM inputs equal to a fresh root, and a plan made on a stale graph planned once more.
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
const PAGE = "project:page:main" as const;
function open() {
  const { document, library } = createG1Fixture();
  const runtime = new CatalogRuntime(
    new CatalogGraph(document, library),
    new CatalogStorage(indexedDB, `adr248-phase4b-dispatch-${Math.random()}`),
  );
  const root = new CatalogCompositionRoot(runtime, new CountLayoutEngine(), {
    width: 1440,
    height: 900,
  });
  const expectEqualsFresh = () => {
    const fresh = new CatalogCompositionRoot(runtime, new CountLayoutEngine(), {
      width: 1440,
      height: 900,
    });
    expect(new Map(root.canvasInputs)).toEqual(new Map(fresh.canvasInputs));
  };
  return { runtime, root, expectEqualsFresh };
}
const entries = (runtime: CatalogRuntime) =>
  JSON.stringify(runtime.graph.exportDocument().entries);
const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:cmd${++next}` as EntryId<K>;
};
const text = (id: string, value: string): NodeEntry => ({
  kind: "node",
  id: `project:node:${id}` as NodeId,
  definitionId: "lib:definition:text",
  children: [],
  props: { children: { kind: "set", value } },
  visual: {},
  sizing: {},
  descendantOverrides: [],
});
const hasInput = (root: CatalogCompositionRoot, sourceId: string) =>
  [...root.canvasInputs.values()].some((input) => input.sourceId === sourceId);

describe("ADR-248 Phase 4b command dispatch", () => {
  it("runs node, page and theme commands on one undo stack; undo restores the graph", () => {
    const { runtime, root, expectEqualsFresh } = open();
    const initial = entries(runtime);
    const newId = allocator();
    const inserted = root.execute(
      insertNodes({
        parent: { kind: "page", id: PAGE },
        entries: [text("hello", "Hello")],
        rootIds: ["project:node:hello"],
        newId,
      }),
    );
    expect(inserted.plan.selectAfter).toEqual(["project:node:hello"]);
    expect(hasInput(root, "project:node:hello")).toBe(true);
    expectEqualsFresh();
    root.execute(updatePage({ id: PAGE, fields: { name: "Home" } }));
    const theme: ThemeEntry = {
      kind: "theme",
      id: "project:theme:t",
      name: "Theme",
      tokenIds: [],
      preset: {
        tint: "blue",
        neutral: "gray",
        radius: "md",
        darkMode: "light",
      },
    };
    root.execute(createTheme({ theme, activate: true }));
    root.execute(
      setFields({
        targets: [{ kind: "node", id: "project:node:hello" }],
        props: { children: { kind: "set", value: "Hi" } },
      }),
    );
    expect(runtime.historyDepth).toEqual({ undo: 4, redo: 0 });
    expectEqualsFresh();
    for (let step = 0; step < 4; step++) root.undo();
    expect(runtime.historyDepth).toEqual({ undo: 0, redo: 4 });
    expect(entries(runtime)).toBe(initial);
    expect(hasInput(root, "project:node:hello")).toBe(false);
    expectEqualsFresh();
    for (let step = 0; step < 4; step++) root.redo();
    expect(runtime.graph.getEntry(theme.id)?.kind).toBe("theme");
    expectEqualsFresh();
  });

  it("plans once more when the graph moved between plan and commit", () => {
    const { runtime, root, expectEqualsFresh } = open();
    let plans = 0;
    const command: CatalogCommand = (reader) => {
      plans++;
      if (plans === 1)
        // Another edit lands after this plan read the graph (e.g. across an await).
        root.execute(updatePage({ id: PAGE, fields: { name: "Moved" } }));
      return insertNodes({
        parent: { kind: "page", id: PAGE },
        entries: [text("late", "Late")],
        rootIds: ["project:node:late"],
        newId: allocator(),
      })(reader);
    };
    const { result } = root.execute(command);
    expect(plans).toBe(2);
    expect(result.revision).toBe(runtime.graph.revision);
    expect(runtime.historyDepth.undo).toBe(2);
    expect(hasInput(root, "project:node:late")).toBe(true);
    expectEqualsFresh();
  });
});

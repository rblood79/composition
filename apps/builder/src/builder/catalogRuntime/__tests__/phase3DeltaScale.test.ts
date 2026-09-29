import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { createG1Fixture } from "../../../../../../packages/shared/src/catalog/document/fixture";
import type {
  CatalogEntry,
  NodeEntry,
} from "../../../../../../packages/shared/src/catalog/document/types";
import type { LayoutEngineAPI } from "../../workspace/canvas/wasm-bindings/layoutBridge";
import { CatalogRuntime } from "../controller";
import { CatalogStorage } from "../storage";
import { CatalogCompositionRoot } from "../compositionRoot";

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

function makeSingleRoot(size: number) {
  const { document, library } = createG1Fixture();
  const page = document.entries["project:page:main"] as Extract<
    CatalogEntry,
    { kind: "page" }
  >;
  const root = document.entries["project:node:cardA"] as NodeEntry;
  const entries: Record<string, CatalogEntry> = { ...document.entries };
  delete entries["project:node:cardB"];
  const children = Array.from(
    { length: size },
    (_, index) => `project:node:leaf${index}` as NodeEntry["id"],
  );
  entries[page.id] = { ...page, children: [root.id] };
  entries[root.id] = { ...root, definitionId: "lib:definition:box", children };
  for (const id of children) {
    entries[id] = {
      kind: "node",
      id,
      definitionId: "lib:definition:text",
      children: [],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
    };
  }
  const graph = new CatalogGraph({ ...document, entries }, library);
  const runtime = new CatalogRuntime(
    graph,
    new CatalogStorage(indexedDB, `adr248-phase3-scale-${size}`),
  );
  const composition = new CatalogCompositionRoot(
    runtime,
    new CountLayoutEngine(),
    {
      width: 1440,
      height: 900,
    },
  );
  return { graph, composition, children };
}

describe("ADR-248 Phase 3 single-root leaf delta cost", () => {
  it.each([60, 600, 5000])(
    "%i nodes visit one changed input and its resolver ancestry",
    (size) => {
      const { graph, composition, children } = makeSingleRoot(size);
      expect(composition.layoutInputs.size).toBe(size + 1);
      const edited = children[Math.floor(size / 2)];
      const unrelated = children[size - 1];
      const unrelatedInput = [...composition.layoutInputs.values()].find(
        (input) => input.sourceId === unrelated,
      )!.id;
      let unrelatedNotifies = 0;
      composition.subscribeCanvas(unrelatedInput, () => unrelatedNotifies++);
      composition.subscribeDom(unrelatedInput, () => unrelatedNotifies++);
      const exportDocument = graph.exportDocument;
      graph.exportDocument = () => {
        throw new Error("full export on leaf");
      };
      const originalStringify = JSON.stringify;
      let fullSerializations = 0;
      let recordSerializations = 0;
      const stringify = vi
        .spyOn(JSON, "stringify")
        .mockImplementation((value) => {
          if (value && typeof value === "object" && "entries" in value)
            fullSerializations++;
          recordSerializations++;
          return originalStringify(value);
        });
      try {
        composition.dispatch("edit one leaf", [
          {
            kind: "patchNodeVisual",
            id: edited,
            key: "fill",
            write: { kind: "set", value: "red" },
          },
        ]);
      } finally {
        stringify.mockRestore();
        graph.exportDocument = exportDocument;
      }
      expect(graph.metrics.transactionEntriesTraversed).toBe(0);
      expect(graph.metrics.transactionEntryTableClones).toBe(0);
      expect(graph.metrics.transactionRecordReplacements).toBe(1);
      expect(fullSerializations).toBe(0);
      expect(recordSerializations).toBeLessThanOrEqual(3);
      expect(composition.metrics).toMatchObject({
        layoutInputVisits: 1,
        resolverVisits: 2,
        affectedInstanceCount: 1,
        traversedWholeInputGraph: false,
      });
      expect(unrelatedNotifies).toBe(0);
    },
  );
});

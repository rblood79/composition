import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { REUSABLE_ORIGIN_DEFINITIONS } from "../../../../../../packages/shared/src/catalog/document/generated/reusableOriginLibrary";
import type {
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { documentOf } from "../../../../../../packages/shared/src/catalog/commands/__tests__/fixture";
import {
  childPositions,
  pagePositions,
  type CatalogPosition,
} from "../../../../../../packages/shared/src/catalog/resolution/positions";
import type { LayoutEngineAPI } from "../../workspace/canvas/wasm-bindings/layoutBridge";
import { CatalogCompositionRoot } from "../compositionRoot";
import { CatalogRuntime } from "../controller";
import { CatalogStorage } from "../storage";

/**
 * ADR-248 Phase 4c: a Layers row and the Canvas/DOM record of the element it stands for share one
 * identity, so the Inspector reads a row's effective values from the composition root
 * (`domInputs.get(identity)`, `subscribeDom(identity)`) — the values Canvas and DOM draw.
 * Checked on an instance of every code library origin: the rows are exactly the records.
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
const PAGE = "project:page:main" as EntryId<"page">;

describe("ADR-248 Phase 4c rows and records", () => {
  it("every Layers row is a composition root record and every record a row (all code library origins)", async () => {
    const origins = REUSABLE_ORIGIN_DEFINITIONS.map(
      (definition, index) =>
        ({
          kind: "node",
          id: `project:node:origin${index}` as NodeId,
          definitionId: definition.id,
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        }) as NodeEntry,
    );
    const runtime = new CatalogRuntime(
      new CatalogGraph(
        documentOf(
          origins,
          origins.map((entry) => entry.id.slice("project:node:".length)),
        ),
        await buildCodeCatalogLibrary(),
      ),
      new CatalogStorage(indexedDB, `adr248-phase4c-rows-${Math.random()}`),
    );
    const root = new CatalogCompositionRoot(runtime, new CountLayoutEngine(), {
      width: 1440,
      height: 900,
    });
    const rows: CatalogPosition[] = [];
    const walk = (position: CatalogPosition) => {
      if (position.disabled) return;
      rows.push(position);
      childPositions(runtime.graph, position).forEach(walk);
    };
    pagePositions(runtime.graph, PAGE).forEach(walk);
    const records = root.domInputs;
    const rowIds = new Set(rows.map((row) => row.identity));
    // Records that are not document elements: page frames and other synthetic roots.
    const elementRecords = [...records.values()].filter(
      (record) =>
        record.sourceId.startsWith("project:node:") ||
        record.sourceId.startsWith("lib:template:"),
    );
    expect(
      rows
        .filter((row) => !records.has(row.identity))
        .map((row) => row.identity),
    ).toEqual([]);
    expect(
      elementRecords
        .filter((record) => !rowIds.has(record.id))
        .map((record) => record.id),
    ).toEqual([]);
    // Row order under each parent is the record's child order.
    for (const row of rows) {
      const record = records.get(row.identity)!;
      const childIds = childPositions(runtime.graph, row)
        .filter((child) => !child.disabled)
        .map((child) => child.identity);
      expect(record.children.filter((id) => rowIds.has(id))).toEqual(childIds);
    }
    expect(rows.length).toBeGreaterThan(origins.length * 2);
  });
});

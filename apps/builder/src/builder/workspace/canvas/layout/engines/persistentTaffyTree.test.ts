import { describe, expect, it } from "vitest";
import type { LayoutEngineAPI } from "../../wasm-bindings/layoutBridge";
import type { LayoutResult } from "../../wasm-bindings/compositionEngine";
import {
  PersistentTaffyTree,
  type PersistentBatchNode,
} from "./persistentTaffyTree";

class FakeLayoutEngine implements LayoutEngineAPI {
  readonly requestedBatches: number[][] = [];
  #nextHandle = 1;

  isAvailable(): boolean {
    return true;
  }

  buildTreeBatch(nodesJson: string): number[] {
    const nodes = JSON.parse(nodesJson) as unknown[];
    return nodes.map(() => this.#nextHandle++);
  }

  buildTreeBatchBinary(): number[] {
    throw new Error("binary protocol is not part of this fake");
  }

  hasBinaryProtocol(): boolean {
    return false;
  }

  createNodeRaw(): number {
    return this.#nextHandle++;
  }

  updateStyleRaw(): void {}

  setChildren(): void {}

  markDirty(): void {}

  removeNode(): void {}

  computeLayout(): void {}

  getLayoutsBatch(handles: number[]): Map<number, LayoutResult> {
    this.requestedBatches.push([...handles]);
    return new Map(
      handles.map((handle) => [
        handle,
        { x: handle, y: 0, width: 100, height: 20 },
      ]),
    );
  }

  clear(): void {}

  nodeCount(): number {
    return 2;
  }
}

describe("PersistentTaffyTree targeted layout result collection", () => {
  it("requests only registered, unique handles and maps results by element id", () => {
    const engine = new FakeLayoutEngine();
    const tree = new PersistentTaffyTree(engine);
    const batch: PersistentBatchNode[] = [
      { elementId: "child", style: {}, children: [] },
      { elementId: "root", style: {}, children: [0] },
    ];

    tree.buildFull(
      "root",
      batch,
      new Map([
        ["child", []],
        ["root", ["child"]],
      ]),
    );

    const result = tree.getLayoutsForIds(["missing", "child", "child"]);

    expect(engine.requestedBatches).toEqual([[1]]);
    expect(result).toEqual(
      new Map([["child", { x: 1, y: 0, width: 100, height: 20 }]]),
    );
  });

  it("returns an empty result without touching the engine when no id is registered", () => {
    const engine = new FakeLayoutEngine();
    const tree = new PersistentTaffyTree(engine);

    expect(tree.getLayoutsForIds(["missing"])).toEqual(new Map());
    expect(engine.requestedBatches).toEqual([]);
  });
});

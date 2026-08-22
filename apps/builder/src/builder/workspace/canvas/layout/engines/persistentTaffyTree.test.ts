import { describe, expect, it } from "vitest";
import type { LayoutEngineAPI } from "../../wasm-bindings/layoutBridge";
import type { LayoutResult } from "../../wasm-bindings/compositionEngine";
import {
  PersistentTaffyTree,
  type PersistentBatchNode,
} from "./persistentTaffyTree";

class FakeLayoutEngine implements LayoutEngineAPI {
  readonly computedRoots: Array<{
    availableHeight: number;
    availableWidth: number;
    root: number;
  }> = [];
  readonly dirtyHandles: number[] = [];
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

  markDirty(handle: number): void {
    this.dirtyHandles.push(handle);
  }

  removeNode(): void {}

  computeLayout(
    root: number,
    availableWidth: number,
    availableHeight: number,
  ): void {
    this.computedRoots.push({ availableHeight, availableWidth, root });
  }

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

  it("marks promoted dirty roots, computes the persistent root, and collects only affected results", () => {
    const engine = new FakeLayoutEngine();
    const tree = new PersistentTaffyTree(engine);
    tree.buildFull(
      "root",
      [
        { elementId: "child", style: {}, children: [] },
        { elementId: "root", style: {}, children: [0] },
      ],
      new Map([
        ["child", []],
        ["root", ["child"]],
      ]),
    );

    const result = tree.computeDirtyLayoutForIds(
      ["root", "missing", "root"],
      ["child"],
      320,
      180,
    );

    expect(engine.dirtyHandles).toEqual([2]);
    expect(engine.computedRoots).toEqual([
      { availableHeight: 180, availableWidth: 320, root: 2 },
    ]);
    expect(engine.requestedBatches).toEqual([[1]]);
    expect(result.has("child")).toBe(true);
    expect(result.has("root")).toBe(false);
  });
});

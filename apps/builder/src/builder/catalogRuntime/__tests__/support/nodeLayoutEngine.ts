import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { LayoutEngineAPI } from "../../../workspace/canvas/wasm-bindings/layoutBridge";

/**
 * The real Rust layout wasm in Node (JSON protocol), for catalog runtime tests that need actual
 * geometry. Same loader as `phase3BindingDelta.test.tsx`.
 */
type RawLayout = {
  buildTreeBatch(input: string): Uint32Array;
  createNodeRaw(input: string): number;
  updateStyleRaw(handle: number, input: string): boolean;
  setChildren(handle: number, children: Uint32Array): boolean;
  markDirty(handle: number): boolean;
  removeNode(handle: number): boolean;
  setViewport(width: number, height: number): void;
  computeLayout(handle: number, width: number, height: number): void;
  getLayout(handle: number): string;
  clear(): void;
  nodeCount(): number;
};

export async function nodeLayoutEngine(): Promise<LayoutEngineAPI> {
  const directory = resolve(
    process.cwd(),
    "src/builder/workspace/canvas/wasm-bindings/engine-pkg",
  );
  const glue = (await import(
    pathToFileURL(join(directory, "engine_bg.js")).href
  )) as {
    __wbg_set_wasm(value: WebAssembly.Exports): void;
    LayoutEngine: new () => RawLayout;
  };
  const instance = await WebAssembly.instantiate(
    readFileSync(join(directory, "engine_bg.wasm")),
    { "./engine_bg.js": glue },
  );
  glue.__wbg_set_wasm(instance.instance.exports);
  const raw = new glue.LayoutEngine();
  return {
    isAvailable: () => true,
    hasBinaryProtocol: () => false,
    buildTreeBatch: (input) => [...raw.buildTreeBatch(input)],
    buildTreeBatchBinary: () => {
      throw new Error("JSON harness only");
    },
    createNodeRaw: (input) => raw.createNodeRaw(input),
    updateStyleRaw: (handle, input) => raw.updateStyleRaw(handle, input),
    setChildren: (handle, children) =>
      raw.setChildren(handle, Uint32Array.from(children)),
    markDirty: (handle) => raw.markDirty(handle),
    removeNode: (handle) => raw.removeNode(handle),
    setViewport: (width, height) => raw.setViewport(width, height),
    computeLayout: (handle, width, height) =>
      raw.computeLayout(handle, width, height),
    getLayoutsBatch: (handles) =>
      new Map(
        handles.map((handle) => [handle, JSON.parse(raw.getLayout(handle))]),
      ),
    clear: () => raw.clear(),
    nodeCount: () => raw.nodeCount(),
  };
}

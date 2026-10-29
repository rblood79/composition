import { describe, expect, it, vi } from "vitest";

const chunkError = new Error("chunk load failed");
vi.mock("../instance", () => ({
  createFormulaEngine: () => Promise.reject(chunkError),
}));

const { loadFormulaEngine, formulaEngineSync } = await import("../engine");

describe("loadFormulaEngine", () => {
  // `withComputedCells` calls it (`void`) on every read before the engine lands — a failed
  // chunk must reject one promise, not one per read (each a new unhandled rejection).
  it("returns one promise for every call, including after the load rejects", async () => {
    const first = loadFormulaEngine();
    expect(loadFormulaEngine()).toBe(first);
    await expect(first).rejects.toBe(chunkError);
    expect(loadFormulaEngine()).toBe(first);
    expect(formulaEngineSync()).toBeUndefined();
  });
});

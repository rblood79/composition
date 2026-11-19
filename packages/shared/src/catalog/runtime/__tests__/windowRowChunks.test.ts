import { describe, expect, it } from "vitest";
import { catalogWindowRowChunks } from "../domBinding.runtime";

/**
 * A windowed Table's row chunks are named by their rows: a sort puts other rows in every chunk, so
 * every chunk is another one (mounted whole — placed once); a window move · rows added at the end
 * keep the chunks whose rows are the same.
 *
 * Before (2026-11-20): a chunk was named by its place. A sort click of 10,000 rows took 486 ms
 * live, 186 ms of it React finding where each inserted row goes (`getHostSibling` walks the
 * siblings past every other inserted row — the rows squared).
 */
describe("catalogWindowRowChunks", () => {
  const keys = Array.from({ length: 200 }, (_, index) => `p${index + 1}`);
  const names = (list: readonly string[]) =>
    catalogWindowRowChunks(list, 0, []).map((chunk) => chunk.key);

  it("covers every row once, in order, with the window's record ids", () => {
    const chunks = catalogWindowRowChunks(keys, 60, ["a", "b", "c", "d", "e"]);
    expect(chunks.map((chunk) => [chunk.from, chunk.to])).toEqual([
      [0, 64],
      [64, 128],
      [128, 192],
      [192, 200],
    ]);
    expect(chunks[0]).toMatchObject({ at: 60, ids: ["a", "b", "c", "d"] });
    expect(chunks[1]).toMatchObject({ at: 64, ids: ["e"] });
    expect(chunks[2]).toMatchObject({ at: 128, ids: [] });
  });

  it("the same rows are the same chunks — another list of the same keys too", () => {
    expect(names(keys)).toEqual(names(keys));
    expect(names([...keys])).toEqual(names(keys));
  });

  it("a sort: every chunk holds other rows — every chunk is another chunk", () => {
    const sorted = [...keys].reverse();
    const before = names(keys);
    names(sorted).forEach((name, place) =>
      expect(name).not.toBe(before[place]),
    );
  });

  it("rows added at the end keep the chunks before them", () => {
    const more = [...keys, "p201", "p202"];
    const before = names(keys);
    const after = names(more);
    expect(after.slice(0, 3)).toEqual(before.slice(0, 3));
    expect(after[3]).not.toBe(before[3]);
  });
});

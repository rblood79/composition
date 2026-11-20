import { describe, expect, it } from "vitest";
import {
  catalogWindowRowChunkKey,
  catalogWindowRowPending,
} from "../domBinding.runtime";

/**
 * ADR-315 Phase 4 (HC4) — a windowed Table's row keys when its columns change. An empty row (a row
 * outside the record window) has no cells, so no cell index RAC could hold stale: its key is its
 * row key alone. A column change (the row shape's spans) remounts the chunks whole — one placement
 * a chunk, not a re-keyed row in place each (live, 10,000 rows sorted, CPU 4x: a column hide was
 * 2,104 ms, 1,435 of them React's `getHostSibling` walking the rows placed one by one).
 */
describe("windowed Table row keys (ADR-315 Phase 4)", () => {
  const three = { cells: 3, spans: "1,1,1" };
  const two = { cells: 2, spans: "1,1" };
  it("an empty row keeps its key through a column change", () => {
    expect(catalogWindowRowPending("r1", three).key).toBe(
      catalogWindowRowPending("r1", two).key,
    );
    expect(catalogWindowRowPending("r1", three).key).not.toBe(
      catalogWindowRowPending("r2", three).key,
    );
  });
  it("a chunk is another chunk when the row shape changes, the same one when it does not", () => {
    expect(catalogWindowRowChunkKey("0:abc", three.spans)).not.toBe(
      catalogWindowRowChunkKey("0:abc", two.spans),
    );
    expect(catalogWindowRowChunkKey("0:abc", three.spans)).toBe(
      catalogWindowRowChunkKey("0:abc", "1,1,1"),
    );
    expect(catalogWindowRowChunkKey("0:abc", three.spans)).not.toBe(
      catalogWindowRowChunkKey("64:abc", three.spans),
    );
  });
});

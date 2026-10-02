import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("ADR-137 selection consumer contract", () => {
  it("marks deferred selected element data as display-only", async () => {
    const inspectorTypes = await readFile(
      resolve(__dirname, "../inspector/types.ts"),
      "utf-8",
    );
    const storeSource = await readFile(resolve(__dirname, "index.ts"), "utf-8");

    expect(inspectorTypes).toContain("ImmediateSelectionSnapshot");
    expect(inspectorTypes).toContain("DeferredSelectedElement");
    expect(storeSource).toContain("readImmediateSelectionSnapshot");
    expect(storeSource).toMatch(
      /useDebouncedSelectedElementData\s*=\s*\(\)\s*:\s*DeferredSelectedElement \| null/,
    );
  });

});

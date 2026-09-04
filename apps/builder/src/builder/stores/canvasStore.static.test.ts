import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("canvasStore legacy selector removal contract", () => {
  it("keeps only viewport/editing state after dead element selectors are removed", async () => {
    const source = await readFile(
      resolve(__dirname, "canvasStore.ts"),
      "utf-8",
    );

    expect(source).toContain("export const useCanvasStore =");
    expect(source).not.toContain("canonicalElementsView");
    expect(source).not.toContain("useCanvasElements");
    expect(source).not.toContain("useCanvasSelectedElement");
    expect(source).not.toContain("useCanvasSelectedElementIds");
    expect(source).not.toContain("useCanvasUpdateElement");
    expect(source).not.toContain("useCanvasSetSelectedElement");
  });
});

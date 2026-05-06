import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("useCentralCanvasPointerHandlers frame body fallback", () => {
  it("uses the interactive elements map for empty-click body selection", async () => {
    const source = await readFile(
      resolve(__dirname, "useCentralCanvasPointerHandlers.ts"),
      "utf-8",
    );

    expect(source).toContain("const hitElementsMap = getHitElementsMap?.()");
    expect(source).toContain("elementsMap: hitElementsMap,");
    expect(source).not.toContain("elementsMap: state.elementsMap,");
  });
});

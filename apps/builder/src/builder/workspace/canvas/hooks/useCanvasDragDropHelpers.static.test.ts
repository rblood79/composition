import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("useCanvasDragDropHelpers canonical projection contract", () => {
  it("does not rebuild CompositionDocument in drag/drop hot paths", async () => {
    const source = await readFile(
      resolve(__dirname, "useCanvasDragDropHelpers.ts"),
      "utf-8",
    );

    expect(source).toContain("getActiveCanonicalDocument");
    expect(source).not.toContain("selectCanonicalDocument");
    expect(source).not.toContain("useLayoutsStore");
  });

  it("does not read store childrenMap in drag/drop helper hot paths", async () => {
    const source = await readFile(
      resolve(__dirname, "useCanvasDragDropHelpers.ts"),
      "utf-8",
    );

    expect(source).toContain("buildChildrenMapFromElements(elements)");
    expect(source).not.toContain("useStore.getState().childrenMap");
    expect(source).not.toContain("useStore.getState().elementsMap");
  });
});

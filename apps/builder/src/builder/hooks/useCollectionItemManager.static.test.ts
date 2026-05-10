import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("useCollectionItemManager canonical children read contract", () => {
  it("derives collection children from canonical elements before store fallback", async () => {
    const source = await readFile(
      resolve(__dirname, "useCollectionItemManager.ts"),
      "utf-8",
    );
    const directChildStoreRead = [
      "state.",
      "children",
      "Map.get(elementId)",
    ].join("");

    expect(source).toContain("useCanonicalElements");
    expect(source).toContain("function useCollectionChildren");
    expect(source).toContain(
      "const sourceElements = canonicalElements ?? storeElements",
    );
    expect(source).not.toContain(directChildStoreRead);
    expect(source).not.toContain(["types", "core", "store.types"].join("/"));
    expect(source).not.toContain(["as", "Element"].join(" "));
  });
});

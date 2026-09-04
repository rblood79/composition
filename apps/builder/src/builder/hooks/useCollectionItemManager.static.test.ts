import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("useCollectionItemManager canonical read contract", () => {
  it("uses the cached projectable lookup index instead of a full document projection", async () => {
    const source = await readFile(
      resolve(__dirname, "useCollectionItemManager.ts"),
      "utf-8",
    );

    expect(source).toContain("useActiveCanonicalDocument");
    expect(source).toContain("getProjectableNodeLookups");
    expect(source).toContain("lookup.parentId !== elementId");
    expect(source).toContain("return useMemo(() => {");
    expect(source).not.toContain("useCanonicalElements");
    expect(source).not.toContain("visitCanonicalDocumentElements");
    expect(source).not.toContain("getCanonicalDocumentElementsView");
    expect(source).not.toContain("legacyElements");
    expect(source).not.toContain("state.elements");
  });

  it("production caller 0인 deprecated hook을 barrel에서 다시 공개하지 않는다", async () => {
    const barrel = await readFile(resolve(__dirname, "index.ts"), "utf-8");
    expect(barrel).not.toMatch(
      /export\s*\{[^}]*useCollectionItemManager[^}]*\}/,
    );
  });
});

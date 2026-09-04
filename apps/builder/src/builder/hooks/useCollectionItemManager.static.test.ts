import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("useCollectionItemManager canonical read contract", () => {
  it("uses active canonical document traversal instead of useCanonicalElements", async () => {
    const source = await readFile(
      resolve(__dirname, "useCollectionItemManager.ts"),
      "utf-8",
    );

    expect(source).toContain("useActiveCanonicalDocument");
    expect(source).toContain("visitCanonicalDocumentElements");
    expect(source).toContain("const canonicalChildren = useMemo(() => {");
    expect(source).not.toContain("useCanonicalElements");
  });

  it("production caller 0인 deprecated hook을 barrel에서 다시 공개하지 않는다", async () => {
    const barrel = await readFile(resolve(__dirname, "index.ts"), "utf-8");
    expect(barrel).not.toMatch(
      /export\s*\{[^}]*useCollectionItemManager[^}]*\}/,
    );
  });
});

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
});

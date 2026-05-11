import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("builder store canonical derived view callers", () => {
  it("uses active canonical document traversal without useCanonicalElements hooks", async () => {
    const source = await readFile(resolve(__dirname, "index.ts"), "utf-8");

    expect(source).toContain("useActiveCanonicalDocument");
    expect(source).toContain("visitCanonicalDocumentElements");
    expect(source).toContain("const canonicalElements = useMemo(() => {");
    expect(source).toContain(
      "const canonicalSelectedElement = useMemo(() => {",
    );
    expect(source).not.toContain("useCanonicalElements");
    expect(source).not.toContain("useCanonicalSelectedElement");
  });
});

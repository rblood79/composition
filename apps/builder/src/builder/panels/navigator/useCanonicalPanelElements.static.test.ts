import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("useCanonicalPanelElements", () => {
  it("uses active canonical document traversal instead of useCanonicalElements", async () => {
    const source = await readFile(
      resolve(__dirname, "useCanonicalPanelElements.ts"),
      "utf-8",
    );

    expect(source).toContain("useActiveCanonicalDocument");
    expect(source).toContain("visitCanonicalDocumentElements");
    expect(source).not.toContain("useCanonicalElements");
  });
});

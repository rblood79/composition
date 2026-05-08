import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("selection slice canonical hierarchy lookup contract", () => {
  it("uses canonical elements or store elements instead of legacy maps for editing context lookup", async () => {
    const source = await readFile(resolve(__dirname, "selection.ts"), "utf-8");

    expect(source).toContain("visitCanonicalDocumentElements");
    expect(source).toContain("getActiveCanonicalSelectionElements");
    expect(source).toContain("function getSelectionElements");
    expect(source).toContain("getSelectionElements(get())");
    expect(source).not.toContain("canonicalElementSnapshot");

    const staleElementMap = ["elements", "Map"].join("");
    const staleChildMap = ["children", "Map"].join("");
    expect(source).not.toContain(staleElementMap);
    expect(source).not.toContain(staleChildMap);
  });
});

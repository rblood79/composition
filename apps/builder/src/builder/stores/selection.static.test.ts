import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("selection slice canonical hierarchy lookup contract", () => {
  it("uses ADR-127 canonical node helpers before store bootstrap elements", async () => {
    const source = await readFile(resolve(__dirname, "selection.ts"), "utf-8");

    expect(source).toContain("getNodeMap");
    expect(source).toContain("getChildren");
    expect(source).toContain("getParent");
    expect(source).not.toContain("visitCanonicalDocumentElements");
    expect(source).not.toContain("getActiveCanonicalSelectionElements");
    expect(source).not.toContain("canonicalElementSnapshot");

    const staleElementMap = ["elements", "Map"].join("");
    const staleChildMap = ["children", "Map"].join("");
    expect(source).not.toContain(staleElementMap);
    expect(source).not.toContain(staleChildMap);
  });
});

import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("historyActions canonical compatibility sync contract", () => {
  it("uses active canonical document traversal before legacy store map for cloud compatibility upsert", async () => {
    const source = await readFile(
      resolve(__dirname, "historyActions.ts"),
      "utf-8",
    );

    expect(source).toContain("visitCanonicalDocumentElements");
    expect(source).toContain("getActiveCanonicalHistoryElements");
    expect(source).toContain("function getHistorySourceElements");
    expect(source).not.toContain("canonicalElementSnapshot");
    expect(source).toContain("getHistoryCompatibilityElementsMap(get)");
    expect(source).toContain(
      "getActiveCanonicalHistoryElements() ?? legacyElements",
    );
    expect(source).toContain("applySerializedHistoryDiff");
    expect(source).toContain("applySerializedHistoryDiffs");
    expect(source).toContain("entry.data.diff");
    expect(source).toContain("entry.data.diffs");
    expect(source).toContain("syncHistoryElementsToCanonical(updatedElements)");
    expect(source).not.toContain(
      "syncHistoryElementsToCanonical(get().elements)",
    );
    const staleMapLookup = ["get()", "elementsMap"].join(".");
    expect(source).not.toContain(`const elementsMap = ${staleMapLookup};`);
    expect(source).not.toContain(staleMapLookup);
  });
});

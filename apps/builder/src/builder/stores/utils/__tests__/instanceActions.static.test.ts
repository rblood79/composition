import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("instanceActions canonical read fallback contract", () => {
  it("derives instance lookup and child lists from active canonical elements before bootstrap store elements", async () => {
    const source = await readFile(
      resolve(__dirname, "../instanceActions.ts"),
      "utf-8",
    );

    expect(source).toContain("getActiveCanonicalDocumentElements");
    expect(source).toContain("function getInstanceActionSourceElements");
    expect(source).toContain("function withInstanceActionSourceState");
    expect(source).toContain(
      "return getActiveCanonicalDocumentElements() ?? legacyElements",
    );
    expect(source).toContain("function findInstanceActionElement");
    expect(source).toContain(
      "const elements = getInstanceActionSourceElements",
    );
    expect(source).toContain("getInstanceActionSourceElements(state).filter");
    expect(source).not.toContain(
      "state.elements.filter((element) => element.parent_id === parentId)",
    );

    const staleStateElementMap = ["state", ["elements", "Map"].join("")].join(
      ".",
    );
    const staleStateChildMap = ["state", ["children", "Map"].join("")].join(
      ".",
    );
    const staleGetterElementMap = ["get()", ["elements", "Map"].join("")].join(
      ".",
    );
    expect(source).not.toContain(staleStateElementMap);
    expect(source).not.toContain(staleStateChildMap);
    expect(source).not.toContain(staleGetterElementMap);
  });
});

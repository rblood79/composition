import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("useDeltaMessenger canonical count contract", () => {
  it("uses canonical elements for delta stats count before bootstrap fallback", async () => {
    const source = await readFile(
      resolve(__dirname, "useDeltaMessenger.ts"),
      "utf-8",
    );

    expect(source).toContain("useCanonicalElements");
    expect(source).toContain("if (canonicalElements) return 0;");
    expect(source).toContain("const { elements: legacyElements } = state;");
    expect(source).toContain("return legacyElements.length;");
    expect(source).toContain(
      "const elementsCount = canonicalElements?.length ?? storeElementsCount",
    );
    expect(source).not.toContain(["state", "elementsMap.size"].join("."));
  });
});

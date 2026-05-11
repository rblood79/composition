import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("useDeltaMessenger canonical count contract", () => {
  it("uses canonical elements for delta stats count before bootstrap fallback", async () => {
    const source = await readFile(
      resolve(__dirname, "useDeltaMessenger.ts"),
      "utf-8",
    );

    expect(source).toContain("useActiveCanonicalDocument");
    expect(source).toContain("visitCanonicalDocumentElements");
    expect(source).toContain("if (canonicalElementsCount !== null) return 0;");
    expect(source).toContain("const { elements: legacyElements } = state;");
    expect(source).toContain("return legacyElements.length;");
    expect(source).toContain(
      "const elementsCount = canonicalElementsCount ?? storeElementsCount",
    );
    expect(source).not.toContain("useCanonicalElements");
    expect(source).not.toContain(["state", "elementsMap.size"].join("."));
  });
});

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("performanceMonitor canonical count contract", () => {
  it("uses canonical elements for monitoring counts before store fallback", async () => {
    const source = await readFile(
      resolve(__dirname, "performanceMonitor.ts"),
      "utf-8",
    );

    expect(source).toContain("visitCanonicalDocumentElements");
    expect(source).toContain("getActiveCanonicalElementCount()");
    expect(source).toContain("getCanonicalFirstElementCount(state)");
    expect(source).not.toContain("canonicalElementSnapshot");
    expect(source).not.toContain(["state", "elementsMap?.size"].join("."));
  });
});

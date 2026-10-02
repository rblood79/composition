import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("ADR-116 G6-3 Slot/Ref/Descendants/Frame parity completion contract", () => {
  it("keeps native mutation, resolver, navigation, and frame binding wiring", async () => {
    // (The component section · page frame binding · layout selector · layouts tab legs retired
    // with the old app — ADR-248 4e; the old resolver leg with `resolvers/canonical`, 4e-9 C.)
    const [mutationsSource, frameMirrorSource] = await Promise.all([
      readFile(resolve(__dirname, "../canonicalMutations.ts"), "utf-8"),
      readFile(resolve(__dirname, "../frameMirror.ts"), "utf-8"),
    ]);

    expect(mutationsSource).toContain("findSlotPathForPageRef");
    expect(mutationsSource).toContain("descendants[slotPath]");
    expect(mutationsSource).toContain("appendChildToDescendants");
    expect(mutationsSource).toContain("removeNodeFromDescendants");
    expect(frameMirrorSource).toContain("getReusableFrameMirrorId");
  });
});

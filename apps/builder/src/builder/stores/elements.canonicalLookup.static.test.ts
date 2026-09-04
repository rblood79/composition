import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("elements canonical action lookup performance boundary", () => {
  it("resolves items action nodes through the cached canonical node map", async () => {
    const source = await readFile(resolve(__dirname, "elements.ts"), "utf8");
    const helper = source.match(
      /function getElementForItemsAction[\s\S]*?\n}\n\n\/\/ Builder type-check gate/,
    )?.[0];

    expect(helper).toBeDefined();
    expect(source).toContain('from "./canonical/canonicalTraversalHelpers"');
    expect(helper).toContain("getFirstProjectableNodeById(elementId)");
    expect(helper).toContain("state.elementsMap.get(elementId)");
    expect(helper).not.toContain("getCanonicalOrStoreElements");
    expect(helper).not.toContain("findElementById");
  });
});

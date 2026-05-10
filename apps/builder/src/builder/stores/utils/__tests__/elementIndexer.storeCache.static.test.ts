import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("elementIndexer store cache contracts", () => {
  it("keeps index helper map inputs generic over readonly maps", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementIndexer.ts"),
      "utf-8",
    );

    expect(source).toContain("rebuildPageIndex<TElement extends Element>");
    expect(source).toContain("elementsMap: ReadonlyMap<string, TElement>");
    expect(source).toContain(
      "export interface ComponentIndex<TElement extends Element = Element>",
    );
    expect(source).toContain("masterComponents: Map<string, TElement>");
    expect(source).not.toContain("Map<string, Element>");
    expect(source).not.toContain("Map<string, Element[]>");
  });
});

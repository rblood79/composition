import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("elementCreation store cache read model", () => {
  it("keeps creation lookup helpers generic over readonly maps", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementCreation.ts"),
      "utf-8",
    );

    expect(source).toContain("getRefMasterType<TElement extends Element>");
    expect(source).toContain("elementsMap: ReadonlyMap<string, TElement>");
    expect(source).toContain(
      "buildCreationElementMap<TElement extends Element>",
    );
    expect(source).not.toContain("elementsMap: Map<string, Element>");
    expect(source).not.toContain("Map<string, Element>");
  });
});

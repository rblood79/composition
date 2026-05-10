import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("elementGrouping structural read model", () => {
  it("accepts readonly generic maps instead of raw store Element maps", async () => {
    const source = await readFile(
      resolve(__dirname, "../elementGrouping.ts"),
      "utf-8",
    );

    expect(source).toContain(
      "createGroupFromSelection<TElement extends Element>",
    );
    expect(source).toContain("elementsMap: ReadonlyMap<string, TElement>");
    expect(source).toContain("ungroupElement<TElement extends Element>");
    expect(source).not.toContain("elementsMap: Map<string, Element>");
  });
});

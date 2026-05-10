import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("historyHelpers store cache read model", () => {
  it("keeps lookup helpers generic over readonly maps", async () => {
    const source = await readFile(
      resolve(__dirname, "../historyHelpers.ts"),
      "utf-8",
    );

    expect(source).toContain("trackBatchUpdate<TElement extends Element>");
    expect(source).toContain("elementsMap: ReadonlyMap<string, TElement>");
    expect(source).toContain("componentIndex: ComponentIndex<TElement>");
    expect(source).toContain("undoGroupCreation<TElement extends Element>");
    expect(source).not.toContain("elementsMap: Map<string, Element>");
  });
});

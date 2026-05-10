import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("elements store cache contract", () => {
  it("keeps elementsMap and childrenMap behind ADR-126 cache snapshot aliases", async () => {
    const source = await readFile(resolve(__dirname, "elements.ts"), "utf-8");

    expect(source).toContain(
      "export type StoreElementCacheSnapshot = Readonly<Element>",
    );
    expect(source).toContain("elementsMap: StoreElementCacheMap;");
    expect(source).toContain("childrenMap: StoreChildrenCacheMap;");
    expect(source).toContain("const elementsMap: StoreElementCacheMap");
    expect(source).toContain("const childrenMap: StoreChildrenCacheMap");
    expect(source).not.toContain("elementsMap: Map<string, Element>;");
    expect(source).not.toContain("childrenMap: Map<string, Element[]>;");
    expect(source).not.toContain(
      "const elementsMap = new Map<string, Element>();",
    );
    expect(source).not.toContain(
      "const childrenMap = new Map<string, Element[]>();",
    );
  });
});

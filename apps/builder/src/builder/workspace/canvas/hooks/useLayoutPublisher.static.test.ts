import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("useLayoutPublisher invalidation contract", () => {
  it("republishes layout when page/frame input structure changes without layoutVersion bump", async () => {
    const source = await readFile(
      resolve(__dirname, "useLayoutPublisher.ts"),
      "utf-8",
    );

    expect(source).toMatch(
      /const layoutInputKey = \[\.\.\.pages, \.\.\.framePages\]/,
    );
    expect(source).toMatch(/createPageElementsSignature\(/);
    expect(source).toMatch(/createPageLayoutSignature\(/);
    expect(source).toMatch(
      /const readinessKey = \[\.\.\.pages, \.\.\.framePages\]/,
    );
    expect(source).toMatch(
      /\}, \[layoutVersion, dimensionKey, layoutInputKey, readinessKey\]\);/,
    );
  });

  it("clears stale page/frame layout maps when the active render mode changes", async () => {
    const source = await readFile(
      resolve(__dirname, "useLayoutPublisher.ts"),
      "utf-8",
    );

    expect(source).toContain("const publishedKeysRef = useRef<Set<string>>");
    expect(source).toContain("const layoutUpdates: Array<");
    expect(source).toMatch(
      /const key =\s*bodyElement\.page_id\s*\?\?\s*getFrameElementMirrorId\(bodyElement\)\s*\?\?\s*bodyElement\.id;/,
    );
    expect(source).toContain("activeKeys.add(key);");
    expect(source).toContain("const sourceElementById = new Map(elementById);");
    expect(source).toContain(
      "sourceElementById.set(bodyElement.id, bodyElement);",
    );
    expect(source).toContain("for (const element of pageElements)");
    expect(source).toContain("sourceElementById.set(element.id, element);");
    expect(source).toContain("elementById: sourceElementById,");
    expect(source).toContain("layoutUpdates.push({ key, map: layoutMap });");
    expect(source).toMatch(/publishFilteredChildrenMap\(null, key\);/);
    expect(source).toMatch(/publishSyntheticElementsMap\(null, key\);/);
    expect(source).toMatch(
      /publishLayoutMapsBatch\(layoutUpdates, staleKeys\);/,
    );
    expect(source).not.toMatch(/publishLayoutMap\(layoutMap, key\);/);
    expect(source).toContain("publishedKeysRef.current = activeKeys;");
  });

  it("does not independently resolve canonical refs while publishing layout", async () => {
    const source = await readFile(
      resolve(__dirname, "useLayoutPublisher.ts"),
      "utf-8",
    );

    expect(source).not.toContain("resolveCanonicalRefTree");
    expect(source).not.toMatch(/const resolvedTree = resolveCanonicalRefTree/);
  });

  it("uses projectionVersion as part of the layout publish invalidation key", async () => {
    const source = await readFile(
      resolve(__dirname, "useLayoutPublisher.ts"),
      "utf-8",
    );

    expect(source).toContain("input.projectionVersion");
  });
});

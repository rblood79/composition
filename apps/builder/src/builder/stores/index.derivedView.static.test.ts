import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("builder store canonical derived view callers", () => {
  it("uses active canonical document traversal without useCanonicalElements hooks", async () => {
    const source = await readFile(resolve(__dirname, "index.ts"), "utf-8");

    // ADR-126/127 가드 — selection leaf는 selected/ref master만 project하고,
    // production caller 0인 full-document selector export는 되살리지 않는다.
    expect(source).toContain("useActiveCanonicalDocument");
    expect(source).not.toContain("getCanonicalDocumentElementsView");
    expect(source).toContain("getNodeMap().get(elementId)");
    expect(source).toContain("getLastProjectableNodeLookupById(elementId)");
    expect(source).toContain("getFirstProjectableNodeLookupByReference");
    expect(source).not.toContain("findElementInCanonicalDocument");
    expect(source).toContain(
      "const canonicalSelectedElement = useMemo(() => {",
    );
    const selectedHelper = source.match(
      /function getActiveCanonicalSelectedElement[\s\S]*?\n}\n\n\/\/ ============================================/,
    )?.[0];
    expect(selectedHelper).toBeDefined();
    expect(selectedHelper).not.toContain("getCanonicalDocumentElementsView");
    expect(source).not.toContain("useCanonicalElements");
    expect(source).not.toContain("useCanonicalSelectedElement");
    expect(source).not.toMatch(/export const useElements\b/);
    expect(source).not.toMatch(/export const useCurrentPageElements\b/);
    expect(source).not.toMatch(/export const useElementById\b/);
    expect(source).not.toMatch(/export const useChildElements\b/);
    expect(source).not.toMatch(/export const useCurrentPageElementCount\b/);
  });
});

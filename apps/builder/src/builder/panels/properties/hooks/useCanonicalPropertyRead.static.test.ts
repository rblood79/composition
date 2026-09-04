import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("useCanonicalPropertyRead", () => {
  it("reads a single property element without materializing the full canonical view", async () => {
    const source = await readFile(
      resolve(__dirname, "useCanonicalPropertyRead.ts"),
      "utf-8",
    );

    const elementHook = source.slice(
      source.indexOf("export function useCanonicalPropertyElement("),
      source.indexOf("export function useCanonicalPropertyElementsMap("),
    );

    expect(elementHook).toContain("getActiveCanonicalElementById(elementId)");
    expect(elementHook).not.toContain("useCanonicalPropertySourceElements()");
    expect(elementHook).not.toContain("getCanonicalDocumentElementsView(");
  });

  it("derives aggregate property lookup maps from canonical/store elements instead of store maps", async () => {
    const source = await readFile(
      resolve(__dirname, "useCanonicalPropertyRead.ts"),
      "utf-8",
    );
    const directElementMapFallback = ["state.", "elements", "Map.get"].join("");
    const directChildrenMapFallback = ["state.", "children", "Map"].join("");

    expect(source).toContain("useActiveCanonicalDocument");
    // perf: 인스턴스별 visitCanonicalDocumentElements 재-materialize 대신
    // 문서 참조당 1회 캐시되는 shared view 경유 (내부적으로 동일 traversal).
    expect(source).toContain("getCanonicalDocumentElementsView");
    expect(source).not.toContain("useCanonicalElements()");
    expect(source).toContain("useCanonicalPropertySourceElements");
    expect(source).toContain(
      "getCanonicalDocumentElementsView(canonicalDocument)",
    );
    expect(source).toContain("const { elements: legacyElements } = state;");
    expect(source).toContain("return legacyElements ?? EMPTY_ELEMENTS;");
    expect(source).toContain("buildElementsMap(sourceElements)");
    expect(source).toContain("buildChildrenMap(sourceElements)");
    expect(source).not.toContain(directElementMapFallback);
    expect(source).not.toContain(directChildrenMapFallback);
  });
});

import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

describe("generic property editors canonical read contract", () => {
  it("uses canonical element maps before legacy store fallback", async () => {
    const source = await readFile(
      resolve(__dirname, "GenericPropertyEditor.tsx"),
      "utf-8",
    );

    expect(source).toContain("useCanonicalPropertyElementsMap");
    expect(source).toContain("const element = elementsMap.get(elementId)");
    expect(source).toContain(
      "const parent = elementsMap.get(element.parent_id)",
    );
    expect(source).not.toContain("useStore.getState().elementsMap");
    expect(source).not.toContain("state.elementsMap.get(elementId)");
  });

  it("uses canonical property children before legacy children fallback", async () => {
    const source = await readFile(
      resolve(__dirname, "ChildItemManager.tsx"),
      "utf-8",
    );

    expect(source).toContain("useCanonicalPropertyChildren(elementId)");
    expect(source).toContain("useCanonicalPropertyElements()");
    expect(source).toContain(
      "generateCustomId(childTag, canonicalPropertyElements)",
    );
    expect(source).not.toContain("state.childrenMap.get(elementId)");
    expect(source).not.toContain(["types", "core", "store.types"].join("/"));
    expect(source).not.toContain(["useStore.getState()", "elements"].join("."));
  });

  it("uses canonical property element for generic items arrays", async () => {
    const source = await readFile(
      resolve(__dirname, "ItemsManager.tsx"),
      "utf-8",
    );

    // ADR-228 (2026-09-21): ref instance 는 origin ⊕ override 의 유효 items 를 보여야 한다 —
    //   canonical 읽기는 유지하되 resolved 변형 hook 을 쓴다.
    expect(source).toContain("useCanonicalPropertyResolvedElement(elementId)");
    expect(source).not.toContain("state.elementsMap.get(elementId)");
  });
});

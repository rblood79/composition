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
    expect(source).not.toContain("state.childrenMap.get(elementId)");
  });

  it("uses canonical property element for generic items arrays", async () => {
    const source = await readFile(
      resolve(__dirname, "ItemsManager.tsx"),
      "utf-8",
    );

    expect(source).toContain("useCanonicalPropertyElement(elementId)");
    expect(source).not.toContain("state.elementsMap.get(elementId)");
  });
});

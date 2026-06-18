import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const EDITORS = [
  "BreadcrumbEditor.tsx",
  "ColumnEditor.tsx",
  "ColumnGroupEditor.tsx",
  "DataTableEditor.tsx",
  "CellEditor.tsx",
  "GridListItemEditor.tsx",
  "LayoutBodyEditor.tsx",
  "ListBoxItemEditor.tsx",
  "PageBodyEditor.tsx",
  "RowEditor.tsx",
  "TableEditor.tsx",
  "TableBodyEditor.tsx",
  "TableHeaderEditor.tsx",
  "TagEditor.tsx",
  "TreeItemEditor.tsx",
] as const;

const SPECIALIZED_EDITORS = [
  "ElementSlotSelector.tsx",
  // ADR-912 후속 cleanup: ListBoxPropertyEditor.tsx 삭제 — dead getEditor 체인이었음.
  "SliderEditor.tsx",
] as const;

describe("canonical-first property editors", () => {
  it("uses canonical property read hooks in simple table/tag editors", async () => {
    const staleElementLookup = ["state", "elementsMap.get(elementId)"].join(
      ".",
    );

    for (const filename of EDITORS) {
      const source = await readFile(resolve(__dirname, filename), "utf-8");
      expect(source).toContain("useCanonicalPropertyElement");
      expect(source).not.toContain(staleElementLookup);
    }
  });

  it("uses canonical children hook for child-aware editors", async () => {
    const staleChildrenLookup = ["state", "childrenMap.get(elementId)"].join(
      ".",
    );

    // ADR-147: ListBoxItemEditor 는 slot 기반 편집으로 전환되어 더 이상 child-aware 가 아니다
    // (레거시 Field 자식 읽기 제거). useCanonicalPropertyElement 사용은 EDITORS 목록에서 검증.
    for (const filename of [
      "RowEditor.tsx",
      "TableEditor.tsx",
      "TableBodyEditor.tsx",
      "TableHeaderEditor.tsx",
      "TagEditor.tsx",
      "TreeItemEditor.tsx",
    ] as const) {
      const source = await readFile(resolve(__dirname, filename), "utf-8");
      expect(source).toContain("useCanonicalPropertyChildren");
      expect(source).not.toContain(staleChildrenLookup);
    }
  });

  it("uses canonical property element source for TreeItem custom id generation", async () => {
    const source = await readFile(
      resolve(__dirname, "TreeItemEditor.tsx"),
      "utf-8",
    );

    expect(source).toContain("useCanonicalPropertyElements");
    expect(source).toContain(
      'generateCustomId("TreeItem", canonicalPropertyElements)',
    );
    expect(source).not.toContain(
      'generateCustomId("TreeItem", useStore.getState().elements)',
    );
  });

  it("keeps generated child editors off store Element payload contracts", async () => {
    const forbiddenStoreTypeImport = ["types", "core", "store.types"].join("/");
    const forbiddenElementCast = ["as", "Element"].join(" ");
    const forbiddenStoreElementsRead = ["useStore.getState()", "elements"].join(
      ".",
    );

    for (const filename of [
      "ListBoxItemEditor.tsx",
      "TagEditor.tsx",
      "TreeItemEditor.tsx",
      // ADR-912 Tabs cutover(6d907be54): tabsItemActions.ts 삭제 — stale readFile 엔트리 정정.
    ] as const) {
      const source = await readFile(resolve(__dirname, filename), "utf-8");
      expect(source).not.toContain(forbiddenStoreTypeImport);
      expect(source).not.toContain(forbiddenElementCast);
      expect(source).not.toContain(forbiddenStoreElementsRead);
    }
  });

  it("keeps table generated editors off store Element payload contracts", async () => {
    const forbiddenStoreTypeImport = ["types", "core", "store.types"].join("/");
    const forbiddenElementCast = ["as", "Element"].join(" ");
    const forbiddenElementArray = [":", " Element", "[]"].join("");
    const forbiddenStoreElementsRead = ["useStore.getState()", "elements"].join(
      ".",
    );

    for (const filename of [
      "TableEditor.tsx",
      "TableHeaderEditor.tsx",
    ] as const) {
      const source = await readFile(resolve(__dirname, filename), "utf-8");
      expect(source).not.toContain(forbiddenStoreTypeImport);
      expect(source).not.toContain(forbiddenElementCast);
      expect(source).not.toContain(forbiddenElementArray);
      expect(source).not.toContain(forbiddenStoreElementsRead);
    }
  });

  it("uses canonical property maps in specialized editors", async () => {
    const forbiddenLookups = [
      ["state", ["elements", "Map"].join(""), "get(elementId)"].join("."),
      ["state", ["elements", "Map"].join("")].join("."),
      ["state", ["children", "Map"].join(""), "get(elementId)"].join("."),
      ["useStore.getState()", ["elements", "Map"].join("")].join("."),
      ["useStore.getState()", ["children", "Map"].join("")].join("."),
    ];

    for (const filename of SPECIALIZED_EDITORS) {
      const source = await readFile(resolve(__dirname, filename), "utf-8");
      expect(source).toContain("useCanonicalProperty");
      for (const lookup of forbiddenLookups) {
        expect(source).not.toContain(lookup);
      }
    }
  });
});

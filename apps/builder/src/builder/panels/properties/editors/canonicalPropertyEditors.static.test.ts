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
  "ListBoxPropertyEditor.tsx",
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

    for (const filename of [
      "ListBoxItemEditor.tsx",
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

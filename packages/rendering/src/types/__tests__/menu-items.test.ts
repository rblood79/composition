/**
 * ADR-099 Phase 5: Menu items discriminated union 타입 회귀 테스트.
 *
 * 검증 대상:
 * - `StoredMenuEntry` union 타입 좁히기 정확성
 * - `isMenuSectionEntry` / `isMenuSeparatorEntry` type guard 동작
 * - per-section selection 필드 (selectionMode / selectedKeys / defaultSelectedKeys)
 * - BC 보존 — 기존 `StoredMenuItem` (discriminator 미지정) 은 여전히 "item" 해석
 */

import { describe, expect, it } from "vitest";
import {
  isMenuSectionEntry,
  isMenuSeparatorEntry,
  type StoredMenuEntry,
  type StoredMenuItem,
  type StoredMenuSection,
  type StoredMenuSeparator,
} from "../menu-items";

describe("ADR-099 Phase 5 — Menu items discriminated union", () => {
  describe("StoredMenuEntry union", () => {
    it("accepts legacy StoredMenuItem without discriminator (BC 0%)", () => {
      const legacyItem: StoredMenuEntry = {
        id: "a",
        label: "Item A",
      };
      expect(legacyItem.id).toBe("a");
      expect(legacyItem.label).toBe("Item A");
    });

    it("accepts StoredMenuItem with explicit type: 'item'", () => {
      const explicitItem: StoredMenuEntry = {
        id: "b",
        label: "Item B",
        type: "item",
      };
      expect(explicitItem.id).toBe("b");
    });

    it("accepts StoredMenuItem with all optional fields", () => {
      const fullItem: StoredMenuEntry = {
        id: "c",
        label: "Item C",
        isDisabled: false,
        icon: "star",
        shortcut: "Cmd+S",
        description: "Save item",
        value: "save",
        textValue: "save item",
        href: "/save",
      };
      expect((fullItem as StoredMenuItem).shortcut).toBe("Cmd+S");
      expect((fullItem as StoredMenuItem).href).toBe("/save");
    });

    it("accepts StoredMenuSection with nested items", () => {
      const section: StoredMenuEntry = {
        id: "sec-1",
        type: "section",
        header: "File",
        items: [
          { id: "new", label: "New" },
          { id: "open", label: "Open" },
        ],
      };
      expect(section.id).toBe("sec-1");
      expect((section as StoredMenuSection).items).toHaveLength(2);
    });

    it("accepts StoredMenuSection with per-section selection fields", () => {
      const section: StoredMenuEntry = {
        id: "sec-2",
        type: "section",
        header: "View",
        items: [
          { id: "list", label: "List" },
          { id: "grid", label: "Grid" },
        ],
        selectionMode: "single",
        selectedKeys: ["list"],
        defaultSelectedKeys: ["list"],
      };
      if (isMenuSectionEntry(section)) {
        expect(section.selectionMode).toBe("single");
        expect(section.selectedKeys).toEqual(["list"]);
        expect(section.defaultSelectedKeys).toEqual(["list"]);
      } else {
        throw new Error("Type guard failed for section entry");
      }
    });

    it("accepts StoredMenuSeparator", () => {
      const separator: StoredMenuEntry = {
        id: "sep-1",
        type: "separator",
      };
      expect(separator.id).toBe("sep-1");
      expect((separator as StoredMenuSeparator).type).toBe("separator");
    });
  });

  describe("isMenuSectionEntry type guard", () => {
    it("returns false for legacy item (no discriminator)", () => {
      const entry: StoredMenuEntry = { id: "a", label: "Item A" };
      expect(isMenuSectionEntry(entry)).toBe(false);
    });

    it("returns false for explicit item entry", () => {
      const entry: StoredMenuEntry = {
        id: "a",
        label: "Item A",
        type: "item",
      };
      expect(isMenuSectionEntry(entry)).toBe(false);
    });

    it("returns false for separator entry", () => {
      const entry: StoredMenuEntry = { id: "sep-1", type: "separator" };
      expect(isMenuSectionEntry(entry)).toBe(false);
    });

    it("returns true for section entry", () => {
      const entry: StoredMenuEntry = {
        id: "sec-1",
        type: "section",
        header: "File",
        items: [{ id: "new", label: "New" }],
      };
      expect(isMenuSectionEntry(entry)).toBe(true);
    });

    it("narrows type correctly (access section fields)", () => {
      const entry: StoredMenuEntry = {
        id: "sec-1",
        type: "section",
        header: "File",
        items: [{ id: "new", label: "New" }],
        selectionMode: "multiple",
      };
      if (isMenuSectionEntry(entry)) {
        expect(entry.header).toBe("File");
        expect(entry.items[0].label).toBe("New");
        expect(entry.selectionMode).toBe("multiple");
      } else {
        throw new Error("Type guard failed for section entry");
      }
    });
  });

  describe("isMenuSeparatorEntry type guard", () => {
    it("returns false for legacy item (no discriminator)", () => {
      const entry: StoredMenuEntry = { id: "a", label: "Item A" };
      expect(isMenuSeparatorEntry(entry)).toBe(false);
    });

    it("returns false for section entry", () => {
      const entry: StoredMenuEntry = {
        id: "sec-1",
        type: "section",
        header: "File",
        items: [],
      };
      expect(isMenuSeparatorEntry(entry)).toBe(false);
    });

    it("returns true for separator entry", () => {
      const entry: StoredMenuEntry = { id: "sep-1", type: "separator" };
      expect(isMenuSeparatorEntry(entry)).toBe(true);
    });

    it("narrows type correctly (access separator fields)", () => {
      const entry: StoredMenuEntry = { id: "sep-2", type: "separator" };
      if (isMenuSeparatorEntry(entry)) {
        expect(entry.type).toBe("separator");
        expect(entry.id).toBe("sep-2");
      } else {
        throw new Error("Type guard failed for separator entry");
      }
    });
  });

  describe("mixed items + sections + separators", () => {
    it("accepts flat array mixing all entry types", () => {
      const entries: StoredMenuEntry[] = [
        { id: "new", label: "New" },
        { id: "open", label: "Open" },
        { id: "sep-1", type: "separator" },
        {
          id: "sec-1",
          type: "section",
          header: "Recent",
          items: [
            { id: "r1", label: "file1.txt" },
            { id: "r2", label: "file2.txt" },
          ],
        },
        { id: "sep-2", type: "separator" },
        { id: "quit", label: "Quit" },
      ];
      expect(entries).toHaveLength(6);
      const sectionCount = entries.filter(isMenuSectionEntry).length;
      const separatorCount = entries.filter(isMenuSeparatorEntry).length;
      expect(sectionCount).toBe(1);
      expect(separatorCount).toBe(2);
    });
  });
});

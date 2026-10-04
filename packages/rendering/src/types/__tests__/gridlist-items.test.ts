/**
 * ADR-099 Phase 5: GridList items discriminated union 타입 회귀 테스트.
 *
 * 검증 대상:
 * - `StoredGridListEntry` union 타입 좁히기 정확성
 * - `isGridListSectionEntry` type guard 동작
 * - BC 보존 — 기존 `StoredGridListItem` (discriminator 미지정) 은 여전히 "item" 해석
 */

import { describe, expect, it } from "vitest";
import {
  isGridListSectionEntry,
  toRuntimeGridListItem,
  type StoredGridListEntry,
  type StoredGridListItem,
  type StoredGridListSection,
} from "../gridlist-items";

describe("ADR-099 Phase 5 — GridList items discriminated union", () => {
  describe("StoredGridListEntry union", () => {
    it("accepts legacy StoredGridListItem without discriminator (BC 0%)", () => {
      const legacyItem: StoredGridListEntry = {
        id: "a",
        label: "Item A",
      };
      expect(legacyItem.id).toBe("a");
      expect(legacyItem.label).toBe("Item A");
    });

    it("accepts StoredGridListItem with explicit type: 'item'", () => {
      const explicitItem: StoredGridListEntry = {
        id: "b",
        label: "Item B",
        type: "item",
      };
      expect(explicitItem.id).toBe("b");
    });

    it("accepts StoredGridListItem with description", () => {
      const itemWithDesc: StoredGridListEntry = {
        id: "c",
        label: "Item C",
        description: "A description",
      };
      expect((itemWithDesc as StoredGridListItem).description).toBe(
        "A description",
      );
    });

    it("accepts StoredGridListSection with nested items", () => {
      const section: StoredGridListEntry = {
        id: "sec-1",
        type: "section",
        header: "Section 1",
        items: [
          { id: "a", label: "Item A" },
          { id: "b", label: "Item B" },
        ],
      };
      expect(section.id).toBe("sec-1");
      expect((section as StoredGridListSection).items).toHaveLength(2);
    });

    it("accepts StoredGridListSection with optional ariaLabel", () => {
      const section: StoredGridListEntry = {
        id: "sec-2",
        type: "section",
        header: "Unlabeled",
        items: [],
        ariaLabel: "Accessible label",
      };
      expect((section as StoredGridListSection).ariaLabel).toBe(
        "Accessible label",
      );
    });
  });

  describe("isGridListSectionEntry type guard", () => {
    it("returns false for legacy item (no discriminator)", () => {
      const entry: StoredGridListEntry = { id: "a", label: "Item A" };
      expect(isGridListSectionEntry(entry)).toBe(false);
    });

    it("returns false for explicit item entry", () => {
      const entry: StoredGridListEntry = {
        id: "a",
        label: "Item A",
        type: "item",
      };
      expect(isGridListSectionEntry(entry)).toBe(false);
    });

    it("returns true for section entry", () => {
      const entry: StoredGridListEntry = {
        id: "sec-1",
        type: "section",
        header: "Section 1",
        items: [{ id: "a", label: "Item A" }],
      };
      expect(isGridListSectionEntry(entry)).toBe(true);
    });

    it("narrows type correctly when true (access section fields)", () => {
      const entry: StoredGridListEntry = {
        id: "sec-1",
        type: "section",
        header: "Section 1",
        items: [{ id: "a", label: "Item A" }],
      };
      if (isGridListSectionEntry(entry)) {
        expect(entry.header).toBe("Section 1");
        expect(entry.items[0].label).toBe("Item A");
      } else {
        throw new Error("Type guard failed for section entry");
      }
    });
  });

  describe("toRuntimeGridListItem (unchanged — items only)", () => {
    it("preserves stored fields + attaches index", () => {
      const stored: StoredGridListItem = {
        id: "a",
        label: "Item A",
        description: "A description",
      };
      const runtime = toRuntimeGridListItem(stored, 2);
      expect(runtime.id).toBe("a");
      expect(runtime.label).toBe("Item A");
      expect(runtime.description).toBe("A description");
      expect(runtime.index).toBe(2);
    });

    it("preserves optional fields", () => {
      const stored: StoredGridListItem = {
        id: "b",
        label: "Item B",
        isDisabled: true,
        textValue: "search-text",
      };
      const runtime = toRuntimeGridListItem(stored, 0);
      expect(runtime.isDisabled).toBe(true);
      expect(runtime.textValue).toBe("search-text");
      expect(runtime.index).toBe(0);
    });
  });

  describe("mixed items + sections (RAC 단일 level)", () => {
    it("accepts flat array mixing items and sections", () => {
      const entries: StoredGridListEntry[] = [
        { id: "top", label: "Top item" },
        {
          id: "sec-1",
          type: "section",
          header: "Section 1",
          items: [
            { id: "a", label: "Item A" },
            { id: "b", label: "Item B" },
          ],
        },
        { id: "bottom", label: "Bottom item" },
      ];
      expect(entries).toHaveLength(3);
      const sectionCount = entries.filter(isGridListSectionEntry).length;
      expect(sectionCount).toBe(1);
    });

    it("filters all items from a section", () => {
      const entries: StoredGridListEntry[] = [
        {
          id: "sec-1",
          type: "section",
          header: "Section 1",
          items: [
            { id: "a", label: "Item A" },
            { id: "b", label: "Item B" },
            { id: "c", label: "Item C" },
          ],
        },
      ];
      const sections = entries.filter(isGridListSectionEntry);
      expect(sections).toHaveLength(1);
      if (isGridListSectionEntry(sections[0])) {
        expect(sections[0].items).toHaveLength(3);
      }
    });
  });
});

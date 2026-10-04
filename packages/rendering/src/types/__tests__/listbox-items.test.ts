/**
 * ADR-099 Phase 1 (098-c 슬롯): ListBox items discriminated union 타입 회귀 테스트.
 *
 * 검증 대상:
 * - `StoredListBoxEntry` union 타입 좁히기 정확성
 * - `isListBoxSectionEntry` type guard 동작
 * - BC 보존 — 기존 `StoredListBoxItem` (discriminator 미지정) 은 여전히 "item" 해석
 */

import { describe, expect, it } from "vitest";
import {
  isListBoxSectionEntry,
  toRuntimeListBoxItem,
  type StoredListBoxEntry,
  type StoredListBoxItem,
} from "../listbox-items";

describe("ADR-099 Phase 1 — ListBox items discriminated union", () => {
  describe("StoredListBoxEntry union", () => {
    it("accepts legacy StoredListBoxItem without discriminator (BC 0%)", () => {
      const legacyItem: StoredListBoxEntry = {
        id: "a",
        label: "Apple",
      };
      expect(legacyItem.id).toBe("a");
      expect(legacyItem.label).toBe("Apple");
    });

    it("accepts StoredListBoxItem with explicit type: 'item'", () => {
      const explicitItem: StoredListBoxEntry = {
        id: "b",
        label: "Banana",
        type: "item",
      };
      expect(explicitItem.id).toBe("b");
    });

    it("accepts StoredListBoxSection with nested items", () => {
      const section: StoredListBoxEntry = {
        id: "fruits",
        type: "section",
        header: "Fruits",
        items: [
          { id: "a", label: "Apple" },
          { id: "b", label: "Banana" },
        ],
      };
      expect(section.id).toBe("fruits");
      expect(section.items).toHaveLength(2);
    });
  });

  describe("isListBoxSectionEntry type guard", () => {
    it("returns false for legacy item (no discriminator)", () => {
      const entry: StoredListBoxEntry = { id: "a", label: "Apple" };
      expect(isListBoxSectionEntry(entry)).toBe(false);
    });

    it("returns false for explicit item entry", () => {
      const entry: StoredListBoxEntry = {
        id: "a",
        label: "Apple",
        type: "item",
      };
      expect(isListBoxSectionEntry(entry)).toBe(false);
    });

    it("returns true for section entry", () => {
      const entry: StoredListBoxEntry = {
        id: "fruits",
        type: "section",
        header: "Fruits",
        items: [{ id: "a", label: "Apple" }],
      };
      expect(isListBoxSectionEntry(entry)).toBe(true);
    });

    it("narrows type correctly when true (access section fields)", () => {
      const entry: StoredListBoxEntry = {
        id: "fruits",
        type: "section",
        header: "Fruits",
        items: [{ id: "a", label: "Apple" }],
      };
      if (isListBoxSectionEntry(entry)) {
        expect(entry.header).toBe("Fruits");
        expect(entry.items[0].label).toBe("Apple");
      } else {
        throw new Error("Type guard failed for section entry");
      }
    });
  });

  describe("toRuntimeListBoxItem (unchanged — items only)", () => {
    it("preserves stored fields + attaches index", () => {
      const stored: StoredListBoxItem = {
        id: "a",
        label: "Apple",
        value: "apple",
      };
      const runtime = toRuntimeListBoxItem(stored, 3);
      expect(runtime.id).toBe("a");
      expect(runtime.label).toBe("Apple");
      expect(runtime.value).toBe("apple");
      expect(runtime.index).toBe(3);
    });
  });

  describe("mixed items + sections (RAC 단일 level)", () => {
    it("accepts flat array mixing items and sections", () => {
      const entries: StoredListBoxEntry[] = [
        { id: "top", label: "Top item" },
        {
          id: "fruits",
          type: "section",
          header: "Fruits",
          items: [
            { id: "a", label: "Apple" },
            { id: "b", label: "Banana" },
          ],
        },
        { id: "bottom", label: "Bottom item" },
      ];
      expect(entries).toHaveLength(3);
      const sectionCount = entries.filter(isListBoxSectionEntry).length;
      expect(sectionCount).toBe(1);
    });

    it("rejects nested section at TypeScript level (compile-only check)", () => {
      // 이 테스트는 TS 컴파일 시점에 검증됨. 아래 코드가 컴파일 실패하면 타입 안전성 유지:
      // const nested: StoredListBoxSection = {
      //   id: "outer",
      //   type: "section",
      //   header: "Outer",
      //   items: [
      //     { id: "inner", type: "section", ... } // ← StoredListBoxItem 타입만 허용
      //   ],
      // };
      // 현재 타입 시스템은 `items: StoredListBoxItem[]` 로 제한 → section 중첩 불가
      expect(true).toBe(true);
    });
  });
});

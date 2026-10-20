import { describe, expect, it } from "vitest";

import { canNest, catalogChildKind } from "../nestingRules";

// ADR-256 Decision 4 — 부품의 children 종류 하나를 중첩 판정 · 넣기 목록 · slot 표시가 같이 읽는다.
describe("catalogChildKind — 부품이 받는 자식의 종류", () => {
  it("RAC collection 은 항목 목록이다 (설치 RAC 가 자유 내용을 버린다 — G0 ②)", () => {
    expect(catalogChildKind("ListBox")).toEqual({
      kind: "items",
      items: ["ListBoxItem", "ListBoxSection", "Section", "Header"],
    });
    expect(catalogChildKind("TabList")).toEqual({
      kind: "items",
      items: ["Tab"],
    });
  });

  it("그 밖의 RAC 부품은 자유 내용이다", () => {
    for (const type of ["Toolbar", "Dialog", "Popover", "Form", "frame"])
      expect(catalogChildKind(type), type).toEqual({ kind: "free" });
  });

  it("Pen leaf · DOM void 는 자식이 없다", () => {
    for (const type of ["Text", "Icon", "Image", "Input", "Separator"])
      expect(catalogChildKind(type), type).toEqual({ kind: "leaf" });
  });

  it("전환된 family 는 RAC 의 종류다 (ADR-256 Phase 11 — 미전환 제한 표 삭제)", () => {
    // Phase 11: Preview 가 자식을 순서대로 다 그리는 Toast · Pagination · ColorPicker 는 자유 내용,
    // ColorSwatchPicker · Table 은 RAC collection 의 항목 목록 (componentTraits).
    for (const type of ["Toast", "Pagination", "ColorPicker"])
      expect(catalogChildKind(type), type).toEqual({ kind: "free" });
    expect(catalogChildKind("ColorSwatchPicker")).toEqual({
      kind: "items",
      items: ["ColorSwatchPickerItem"],
    });
    expect(catalogChildKind("Table")).toEqual({
      kind: "items",
      items: ["TableHeader", "TableBody"],
    });
    // 전환된 family (ADR-256 Phase 2b · 6c · 6d · 6e) 는 RAC 의 종류 — field 는 자유 내용.
    expect(catalogChildKind("TextField")).toEqual({ kind: "free" });
    for (const picker of [
      "Select",
      "ComboBox",
      "DatePicker",
      "DateRangePicker",
    ])
      expect(catalogChildKind(picker), picker).toEqual({ kind: "free" });
    // 전환된 family (ADR-256 Phase 5h) — TreeItem 은 RAC 의 항목 (TreeItemContent · TreeItem),
    // 행 내용 TreeItemContent 는 자유 내용.
    expect(catalogChildKind("TreeItem")).toEqual({
      kind: "items",
      items: ["TreeItem", "TreeItemContent"],
    });
    expect(catalogChildKind("TreeItemContent")).toEqual({ kind: "free" });
  });
});

describe("중첩 판정 — children 종류를 읽는다", () => {
  it("RAC collection 의 section 도 항목만 받는다 (래퍼는 RAC 가 버린다)", () => {
    expect(
      canNest("ListBoxSection", "ListBoxItem", ["ListBoxSection", "ListBox"]),
    ).toBe(true);
    expect(
      canNest("ListBoxSection", "frame", ["ListBoxSection", "ListBox"]),
    ).toBe(false);
    expect(canNest("MenuSection", "frame", ["MenuSection", "Menu"])).toBe(
      false,
    );
  });

  it("자유 내용 부품은 기본 원본도 받는다 (Toolbar ⊃ Button · Dialog ⊃ Heading)", () => {
    expect(canNest("Toolbar", "Button")).toBe(true);
    expect(canNest("Dialog", "Heading")).toBe(true);
    expect(canNest("Popover", "Checkbox")).toBe(true);
  });

  it("자유 내용 · 항목 목록 판정 (ADR-256 Phase 11 — 제한 표 없이)", () => {
    expect(canNest("Toast", "frame")).toBe(true);
    expect(canNest("Toast", "Icon")).toBe(true);
    expect(canNest("Pagination", "Text")).toBe(true);
    expect(canNest("ColorPicker", "Text")).toBe(true);
    expect(canNest("ColorSwatchPicker", "Text")).toBe(false);
    expect(canNest("Table", "Text")).toBe(false);
    // 전환된 field (Phase 2b · 6c · 6d · 6e) 는 자유 자식을 받는다 (레퍼런스: field 안 아이콘).
    expect(canNest("Select", "frame")).toBe(true);
    expect(canNest("ComboBox", "frame")).toBe(true);
    expect(canNest("DatePicker", "frame")).toBe(true);
    expect(canNest("DateRangePicker", "Icon")).toBe(true);
    expect(canNest("TextField", "frame")).toBe(true);
    expect(canNest("TextField", "Icon")).toBe(true);
    // 전환된 Tabs (ADR-256 Phase 5e-2) 도 — 레퍼런스: Tabs 안 자유 div, TabPanels 안 자유 내용.
    expect(canNest("Tabs", "frame")).toBe(true);
    expect(canNest("Tabs", "Button")).toBe(true);
    expect(canNest("TabPanels", "frame", ["TabPanels", "Tabs"])).toBe(true);
  });
});

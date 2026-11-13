import { describe, expect, it } from "vitest";

import {
  PART_WRAPPER_TYPES,
  canNest,
  catalogChildKind,
  catalogPartsHostTypes,
} from "../nestingRules";

/**
 * 2026-11-09 — 부품 host 표는 원본 template 에서 파생한다 (`derivePartsHosts`). 여기서는 파생 결과의 모양을
 * 고정한다: 어떤 type 이 host 인지 · 아닌지, 한 host 의 부품 목록, 이름 해석이 빠뜨린 자식이 없는지.
 */
describe("catalogPartsHostTypes — 원본 루트 (slot 아님 · 부품 있음) 에서 파생", () => {
  it("field · 바탕 · 그룹 루트는 host, 루트 slot · 항목 · leaf · 기본 type 은 아니다", () => {
    for (const host of [
      "TextField", "NumberField", "Select", "ComboBox", "DatePicker", "Slider",
      "Meter", "ProgressBar", "TagGroup", "CheckboxGroup", "RadioGroup", "Card",
      "InlineAlert", "Tabs", "Toast", "Disclosure", "Checkbox", "Switch", "Radio",
      "Button", "ToggleButton", "MenuTrigger", "DialogTrigger", "Autocomplete",
    ])
      expect(catalogChildKind(host).kind, host).toBe("parts");
    // 루트가 slot 인 원본 · 기본 type · 컬렉션 · 항목 · 글자가 prop 인 합성.
    for (const type of ["Toolbar", "Form", "ToggleButtonGroup", "ButtonGroup", "Nav", "frame", "Group", "Dialog", "Popover", "DisclosurePanel", "Content"])
      expect(catalogChildKind(type).kind, type).toBe("free");
    for (const type of ["ListBox", "Menu", "TabList", "Table", "TreeItem"])
      expect(catalogChildKind(type).kind, type).toBe("items");
    for (const type of ["ListBoxItem", "MenuItem", "GridListItem", "Tag", "Tab", "Breadcrumb", "SegmentedControlItem", "SelectBox"])
      expect(catalogChildKind(type).kind, type).toBe("free");
    for (const type of ["Badge", "StatusLight", "Link", "Avatar", "Image"])
      expect(catalogChildKind(type).kind, type).toBe("leaf");
  });

  it("TextField 의 부품 = 원본 루트 자식 + 필수 부품 + 감싸개", () => {
    // (The Input sits in the field's S2 `FieldGroup` box — the Group is the root's part, the Input the
    //  required part after the root's children, 2026-11-14.)
    expect(catalogPartsHostTypes().TextField).toEqual([
      "Label", "Group", "Description", "FieldError", "Input",
      ...PART_WRAPPER_TYPES.filter((type) => type !== "Group"),
    ]);
    // 필수 부품의 대안 (MenuTrigger 의 Button · ActionButton) 과 그룹 항목 (RadioGroup 의 Radio) 도 선다.
    expect(canNest("MenuTrigger", "Button")).toBe(true);
    expect(canNest("MenuTrigger", "ActionButton")).toBe(true);
    expect(canNest("RadioGroup", "Radio")).toBe(true);
    expect(canNest("CheckboxGroup", "Checkbox")).toBe(true);
  });

  it("이름 해석이 빠뜨린 자식이 없다 (모든 부품은 PascalCase type 또는 frame)", () => {
    for (const [host, parts] of Object.entries(catalogPartsHostTypes())) {
      // (Column 의 유일한 부품 Group 은 감싸개이기도 하다.)
      expect(parts.length, host).toBeGreaterThanOrEqual(PART_WRAPPER_TYPES.length);
      for (const part of parts)
        expect(part, `${host} > ${part}`).toMatch(/^(frame|[A-Z][A-Za-z]*)$/);
    }
  });

  it("사용자 보고 2026-11-09: Badge 안 Button · TagGroup 안 TextField · Card 루트 Button 은 거부, slot 자리는 연다", () => {
    expect(canNest("Badge", "Button")).toBe(false);
    expect(canNest("TagGroup", "TextField")).toBe(false);
    expect(canNest("Card", "Button")).toBe(false);
    expect(canNest("Content", "Button", ["Content", "Card"])).toBe(true);
    expect(canNest("TagList", "Tag", ["TagList", "TagGroup"])).toBe(true);
    expect(canNest("Toast", "Icon")).toBe(false);
    expect(canNest("Tabs", "TabList")).toBe(true);
  });
});

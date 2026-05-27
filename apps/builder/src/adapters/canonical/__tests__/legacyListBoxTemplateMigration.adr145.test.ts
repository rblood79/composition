/**
 * ADR-145 Phase 0 — isLegacyListBoxWithoutTemplate guard.
 *
 * Gate G0:
 *  - legacy "ListBox" + 자식 0 → migration 대상 (true)
 *  - legacy "ListBox" + ListBoxItem 자식 1개 이상 → 이미 template 있음 (false)
 *  - "ListBox" 외 type → 변환 대상 아님 (false)
 */
import { describe, expect, it } from "vitest";
import { isLegacyListBoxWithoutTemplate } from "../legacyListBoxTemplateMigration";

describe("ADR-145 isLegacyListBoxWithoutTemplate", () => {
  it("flags legacy ListBox with no children for migration", () => {
    expect(isLegacyListBoxWithoutTemplate("ListBox", [])).toBe(true);
  });

  it("flags legacy ListBox with non-ListBoxItem children for migration", () => {
    expect(
      isLegacyListBoxWithoutTemplate("ListBox", [
        { type: "Text" },
        { type: "Section" },
      ]),
    ).toBe(true);
  });

  it("does not flag ListBox that already has a ListBoxItem template child", () => {
    expect(
      isLegacyListBoxWithoutTemplate("ListBox", [{ type: "ListBoxItem" }]),
    ).toBe(false);
  });

  it("does not flag ListBox with ListBoxItem mixed among other children", () => {
    expect(
      isLegacyListBoxWithoutTemplate("ListBox", [
        { type: "Text" },
        { type: "ListBoxItem" },
      ]),
    ).toBe(false);
  });

  it("does not flag non-ListBox elements", () => {
    expect(isLegacyListBoxWithoutTemplate("GridList", [])).toBe(false);
    expect(isLegacyListBoxWithoutTemplate("Menu", [])).toBe(false);
    expect(isLegacyListBoxWithoutTemplate("Select", [])).toBe(false);
    expect(isLegacyListBoxWithoutTemplate("frame", [])).toBe(false);
    expect(isLegacyListBoxWithoutTemplate("Button", [])).toBe(false);
  });

  it("treats empty type string as non-ListBox", () => {
    expect(isLegacyListBoxWithoutTemplate("", [])).toBe(false);
  });
});

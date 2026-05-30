import { describe, expect, it } from "vitest";

import { isCatalogCutover } from "../cutover";

/**
 * ADR-142 — cutover 게이트는 componentCatalog 의 cutover==="catalog" entry 에서 파생.
 * family ①(primitives/actions) + family ②(fields) flip 완료 → catalog 경로(불변식 D atomic).
 * 나머지 family(아직 cutover:"legacy")는 게이트 닫힘 → legacy 경로(회귀 0).
 */
describe("isCatalogCutover (catalog cutover gate) — family ①·② flip 후", () => {
  it("family ① 8 primitive 는 catalog cutover (gate 열림)", () => {
    for (const type of [
      "Button",
      "ToggleButton",
      "ToggleButtonGroup",
      "Toolbar",
      "Link",
      "Separator",
      "Icon",
      "Badge",
    ]) {
      expect(isCatalogCutover(type)).toBe(true);
    }
  });

  it("family ② 7 field 는 catalog cutover (gate 열림)", () => {
    for (const type of [
      "TextField",
      "NumberField",
      "SearchField",
      "DateField",
      "TimeField",
      "ColorField",
      "Form",
    ]) {
      expect(isCatalogCutover(type)).toBe(true);
    }
  });

  it("아직 cutover 안 된 family 는 legacy 경로 (gate 닫힘)", () => {
    // family ③ selection (아직 legacy)
    expect(isCatalogCutover("Checkbox")).toBe(false);
    expect(isCatalogCutover("Switch")).toBe(false);
    // family ④ collections / ⑧ composition-native
    expect(isCatalogCutover("ListBox")).toBe(false);
    expect(isCatalogCutover("frame")).toBe(false);
  });
});

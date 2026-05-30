import { describe, expect, it } from "vitest";

import { isCatalogCutover, isCatalogSkiaCutover } from "../cutover";

/**
 * ADR-142 — cutover 게이트는 componentCatalog 의 cutover==="catalog" entry 에서 파생.
 * family ①~④ flip 완료 → catalog 경로. 나머지(⑤~⑧)는 게이트 닫힘 → legacy 경로(회귀 0).
 *
 * **채널 분리 (family ④ DOM-only cutover)**:
 * - isCatalogCutover — DOM(Preview)/Inspector. cutover==="catalog" 전부(collection 포함).
 * - isCatalogSkiaCutover — Skia. cutover==="catalog" && !skiaLegacy. collection 제외.
 */
describe("isCatalogCutover (DOM/Inspector gate) — family ①~④ flip 후", () => {
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

  it("family ③ 6 selection 은 catalog cutover (gate 열림)", () => {
    for (const type of [
      "Checkbox",
      "CheckboxGroup",
      "Radio",
      "RadioGroup",
      "Switch",
      "Slider",
    ]) {
      expect(isCatalogCutover(type)).toBe(true);
    }
  });

  it("family ④ 7 collection 은 DOM catalog cutover (gate 열림)", () => {
    for (const type of [
      "ListBox",
      "Menu",
      "Select",
      "ComboBox",
      "Tabs",
      "TagGroup",
      "GridList",
    ]) {
      expect(isCatalogCutover(type)).toBe(true);
    }
  });

  it("아직 cutover 안 된 family 는 legacy 경로 (gate 닫힘)", () => {
    // family ⑤ Tree·Table (아직 legacy)
    expect(isCatalogCutover("Tree")).toBe(false);
    expect(isCatalogCutover("Table")).toBe(false);
    // family ⑧ composition-native
    expect(isCatalogCutover("frame")).toBe(false);
  });
});

describe("isCatalogSkiaCutover (Skia generic gate) — family ④ DOM-only 채널 분리", () => {
  it("family ①~③(skiaLegacy 아님)은 Skia cutover (Skia generic 발효)", () => {
    for (const type of ["Button", "TextField", "Checkbox", "Switch"]) {
      expect(isCatalogSkiaCutover(type)).toBe(true);
    }
  });

  it("family ④ collection(skiaLegacy:true)은 Skia cutover 제외 (legacy render.shapes 유지)", () => {
    for (const type of [
      "ListBox",
      "Menu",
      "Select",
      "ComboBox",
      "Tabs",
      "TagGroup",
      "GridList",
    ]) {
      // DOM 은 catalog(isCatalogCutover=true), Skia 만 legacy(isCatalogSkiaCutover=false)
      expect(isCatalogCutover(type)).toBe(true);
      expect(isCatalogSkiaCutover(type)).toBe(false);
    }
  });
});

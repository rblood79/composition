import { describe, expect, it } from "vitest";

import { isCatalogCutover } from "../cutover";
import { componentCatalog } from "../componentCatalog";

/**
 * ADR-142 — cutover 게이트는 componentCatalog 의 cutover==="catalog" entry 에서 파생.
 *
 * **ADR-912 단계 5 step 1 (2026-06-04) — 채널 통합 (dead gate)**: 단계 5 (1b) 에서 skiaLegacy
 * 0건 도달 → Skia generic 렌더가 전 catalog entry 발효. DOM/Skia 채널이 더 이상 갈리지 않음.
 * **P1-B (2026-06-17)**: 호출처 정리 완료로 deprecated `isCatalogSkiaCutover` export 삭제 —
 * 단일 게이트(`isCatalogCutover`)만 남는다. 본 테스트는 그 invariant
 * (모든 non-native entry catalog cutover + skiaLegacy 0건)를 잠근다.
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

  it("family ⑤ Tree·Table 은 DOM catalog cutover (gate 열림)", () => {
    for (const type of ["Tree", "Table"]) {
      expect(isCatalogCutover(type)).toBe(true);
    }
  });

  it("family ⑥ 5 overlay 는 DOM catalog cutover (gate 열림)", () => {
    for (const type of ["Dialog", "Modal", "Popover", "Tooltip", "DropZone"]) {
      expect(isCatalogCutover(type)).toBe(true);
    }
  });

  it("family ⑦ date 4 는 DOM catalog cutover (gate 열림)", () => {
    for (const type of [
      "Calendar",
      "RangeCalendar",
      "DatePicker",
      "DateRangePicker",
    ]) {
      expect(isCatalogCutover(type)).toBe(true);
    }
  });

  it("color container(ColorPicker/ColorSwatchPicker)는 catalog cutover", () => {
    // ADR-912 Color container slice (2026-06-17): leaf 5종에 이어 container 2종도 shell-only
    // catalog cutover. 자식 ColorArea/ColorSlider/ColorField/ColorSwatch 가 visible UI 를 소유한다.
    expect(isCatalogCutover("ColorPicker")).toBe(true);
    expect(isCatalogCutover("ColorSwatchPicker")).toBe(true);
  });

  it("composition-native(frame/Slot)는 cutover 게이트 제외 (native — metadata-only)", () => {
    // family ⑧ native 는 cutover 개념 없음(canonical-native 렌더 유지) → 게이트 false.
    // 상세 검증은 nativeEntries.test.ts.
    expect(isCatalogCutover("frame")).toBe(false);
    expect(isCatalogCutover("Slot")).toBe(false);
  });
});

describe("ADR-912 단계 5 step 1 — dead gate invariant (channel 통합 잠금)", () => {
  const nonNativeEntries = componentCatalog.filter((e) => e.kind !== "native");

  it("invariant 1 — 모든 non-native catalog entry 의 cutover === 'catalog' (legacy/cutting-over 0건)", () => {
    // 단계 5 본체(구 정본 제거)의 전제: 전환 중 상태가 없어야 spec.render.shapes fallback 을
    // 안전하게 제거할 수 있다. cutting-over/legacy entry 가 1건이라도 있으면 fallback 필요.
    const nonCatalog = nonNativeEntries.filter(
      (e) => "cutover" in e && e.cutover !== "catalog",
    );
    expect(nonCatalog.map((e) => e.type)).toEqual([]);
  });

  it("invariant 2 — entry 에 skiaLegacy 속성 0건 (필드 dead 제거)", () => {
    // skiaLegacy 필드는 단계 5 step 1 에서 type union 에서 제거됨. runtime entry 에도 0건이어야
    // 단일 게이트(isCatalogCutover) collapse 가 성립한다.
    const withSkiaLegacy = componentCatalog.filter(
      (e) => (e as Record<string, unknown>).skiaLegacy !== undefined,
    );
    expect(withSkiaLegacy.map((e) => e.type)).toEqual([]);
  });

  it("invariant 4 — Skia generic 발효 = 전 cutover catalog entry (date 4 + Tooltip 은 skiaPrimitive escape)", () => {
    // 단계 4 + 5(1b) 발효 결과: 과거 skiaLegacy:true 였던 collection 7 + Table + date 4 + Tooltip 이
    // 전부 Skia generic 게이트 통과. (date/Tooltip 은 binding.skiaPrimitive escape 로 시각 재현)
    for (const type of [
      "ListBox",
      "Menu",
      "Select",
      "ComboBox",
      "Tabs",
      "TagGroup",
      "GridList",
      "Tree",
      "Table",
      "Tooltip",
      "Calendar",
      "RangeCalendar",
      "DatePicker",
      "DateRangePicker",
    ]) {
      expect(isCatalogCutover(type)).toBe(true);
    }
  });
});

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

  it("color(TailSwatch/ColorPicker 등)는 cutover 제외 (사용자 지시 — 별도 처리)", () => {
    expect(isCatalogCutover("TailSwatch")).toBe(false);
    expect(isCatalogCutover("ColorPicker")).toBe(false);
    expect(isCatalogCutover("ColorWheel")).toBe(false);
  });

  it("composition-native(frame/Slot)는 cutover 게이트 제외 (native — metadata-only)", () => {
    // family ⑧ native 는 cutover 개념 없음(canonical-native 렌더 유지) → 게이트 false.
    // 상세 검증은 nativeEntries.test.ts.
    expect(isCatalogCutover("frame")).toBe(false);
    expect(isCatalogCutover("Slot")).toBe(false);
    expect(isCatalogCutover("MaskedFrame")).toBe(false);
  });
});

describe("isCatalogSkiaCutover (Skia generic gate) — family ④ DOM-only 채널 분리", () => {
  it("family ①~③(skiaLegacy 아님)은 Skia cutover (Skia generic 발효)", () => {
    for (const type of ["Button", "TextField", "Checkbox", "Switch"]) {
      expect(isCatalogSkiaCutover(type)).toBe(true);
    }
  });

  it("Tree 는 Skia generic 발효 (G2(a) 2026-06-01 — TreeItem child element 자동 순회)", () => {
    // Tree render.shapes 는 shell-only(자식 TreeItem 이 독립 Skia 노드로 행 렌더) →
    // buildCatalogShapes 가 동일 shell 을 그려 items 소실 없음. DOM·Skia 게이트 모두 열림.
    expect(isCatalogCutover("Tree")).toBe(true);
    expect(isCatalogSkiaCutover("Tree")).toBe(true);
  });

  it("Popover/Dialog/Modal 는 Skia generic 발효 (Inc3 2026-06-01 — buildCatalogShapes box+text + skiaPrimitive 합성)", () => {
    // Popover: bg/border buildCatalogShapes(fill {color.layer-2}) + shadow/V-arrow skiaPrimitive.
    // Dialog: bg buildCatalogShapes(fill {color.layer-1}) + backdrop/shadow skiaPrimitive(prepend).
    // Modal: buildCatalogShapes transparent shell(무해) — render.shapes=[] 와 시각 동일, primitive 없음.
    expect(isCatalogCutover("Popover")).toBe(true);
    expect(isCatalogSkiaCutover("Popover")).toBe(true);
    expect(isCatalogCutover("Dialog")).toBe(true);
    expect(isCatalogSkiaCutover("Dialog")).toBe(true);
    expect(isCatalogCutover("Modal")).toBe(true);
    expect(isCatalogSkiaCutover("Modal")).toBe(true);
    expect(isCatalogCutover("DropZone")).toBe(true);
    expect(isCatalogSkiaCutover("DropZone")).toBe(true);
  });

  it("ListBox 는 Skia generic 발효 (ADR-912 선행 2026-06-03 — shell buildCatalogShapes + data row projection)", () => {
    // ListBox render.shapes 는 container shell(bg+border)만 반환(ADR-146) → buildCatalogShapes 가
    // 동일 정본 table variant fill + border 로 같은 shell 을 그림. data row 는 row projection
    // (canvasSceneNode.appendListBoxRowProjection)이 독립 Skia 노드로 그리는 별도 경로(직교).
    expect(isCatalogCutover("ListBox")).toBe(true);
    expect(isCatalogSkiaCutover("ListBox")).toBe(true);
  });

  it("collection items/2D 결합형 + 미발효 overlay/date(skiaLegacy:true)은 Skia cutover 제외", () => {
    for (const type of [
      // family ④ collections — props.items 직접 순회(items→element 전환 선행 필요)
      //   ※ ListBox 는 row projection 으로 Skia 발효(위 테스트), 나머지 6 은 미발효 유지
      "Menu",
      "Select",
      "ComboBox",
      "Tabs",
      "TagGroup",
      "GridList",
      // family ⑤ Table — props.rows/columns 2D grid 직접 렌더
      "Table",
      // family ⑥ overlays 미발효 — DropZone variant+dashed / Tooltip text source 대기
      "Tooltip",
      // family ⑦ date — 날짜 grid 데이터-시각 결합형
      "Calendar",
      "RangeCalendar",
      "DatePicker",
      "DateRangePicker",
    ]) {
      // DOM 은 catalog(isCatalogCutover=true), Skia 만 legacy(isCatalogSkiaCutover=false)
      expect(isCatalogCutover(type)).toBe(true);
      expect(isCatalogSkiaCutover(type)).toBe(false);
    }
  });
});

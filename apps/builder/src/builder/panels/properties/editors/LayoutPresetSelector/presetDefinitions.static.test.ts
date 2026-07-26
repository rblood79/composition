/**
 * 프리셋 슬롯 배치 계약 가드.
 *
 * **왜 필요한가**: 프리셋의 `containerStyle` 만으로는 슬롯이 놓일 자리가 정해지지 않는다.
 * 빈 Slot 은 콘텐츠 크기가 0 이라 주축 크기를 안 주면 레이아웃 엔진이 0 을 산출하고,
 * 캔버스에 아무것도 그려지지 않는다. 실제로 이 상태가 오래 유지됐다 — `fullscreen` 의
 * content 슬롯이 `width 0` 이라 프리셋을 눌러도 프레임이 빈 채였다. grid 프리셋은
 * `gridTemplateAreas` 를 컨테이너에만 두고 슬롯에 배치를 안 줘서 auto-placement 로 겹쳤다.
 *
 * 타입상 `defaultStyle` 은 optional 이라 빠뜨려도 컴파일이 통과한다. 그래서 "모든 슬롯이
 * 자기 자리를 선언했는가" 를 여기서 단언한다.
 */

import { describe, expect, it } from "vitest";

import { LAYOUT_PRESETS, PRESET_ORDER } from "./presetDefinitions";

/** flex 컨테이너에서 주축 크기를 확정하는 키. 하나라도 있으면 0 으로 붕괴하지 않는다. */
const FLEX_MAIN_AXIS_KEYS = [
  "flex",
  "flexGrow",
  "flexBasis",
  "width",
  "height",
  "minWidth",
  "minHeight",
] as const;

/** grid 자식이 명시 배치되려면 이름과 숫자 line 이 함께 있어야 한다. */
const GRID_PLACEMENT_KEYS = [
  "gridArea",
  "gridColumnStart",
  "gridColumnEnd",
  "gridRowStart",
  "gridRowEnd",
] as const;

function slotStyle(presetKey: string, slotName: string) {
  const slot = LAYOUT_PRESETS[presetKey].slots.find((s) => s.name === slotName);
  return (slot?.defaultStyle ?? {}) as Record<string, unknown>;
}

const GRID_PRESETS = PRESET_ORDER.filter(
  (key) => LAYOUT_PRESETS[key].containerStyle?.display === "grid",
);
const FLEX_PRESETS = PRESET_ORDER.filter(
  (key) => LAYOUT_PRESETS[key].containerStyle?.display === "flex",
);

describe("preset slot layout contract", () => {
  it("covers every preset in PRESET_ORDER", () => {
    expect(GRID_PRESETS.length + FLEX_PRESETS.length).toBe(PRESET_ORDER.length);
    expect(PRESET_ORDER.every((key) => LAYOUT_PRESETS[key])).toBe(true);
  });

  it.each(FLEX_PRESETS)("%s: every slot fixes its main-axis size", (key) => {
    for (const slot of LAYOUT_PRESETS[key].slots) {
      const style = slotStyle(key, slot.name);
      const declared = FLEX_MAIN_AXIS_KEYS.filter(
        (k) => style[k] !== undefined,
      );
      expect(
        declared,
        `${key}/${slot.name} 이 주축 크기를 선언하지 않아 빈 슬롯이 0 이 된다`,
      ).not.toHaveLength(0);
    }
  });

  it.each(GRID_PRESETS)("%s: every slot declares explicit placement", (key) => {
    for (const slot of LAYOUT_PRESETS[key].slots) {
      const style = slotStyle(key, slot.name);
      for (const placementKey of GRID_PLACEMENT_KEYS) {
        expect(
          style[placementKey],
          `${key}/${slot.name} 에 ${placementKey} 누락 — 이름만으로는 엔진이 배치를 해석하지 못해 auto-placement 로 겹친다`,
        ).toBeDefined();
      }
    }
  });

  it.each(GRID_PRESETS)("%s: placement lines stay inside the tracks", (key) => {
    const container = LAYOUT_PRESETS[key].containerStyle ?? {};
    const columnCount = String(container.gridTemplateColumns ?? "")
      .split(/\s+/)
      .filter(Boolean).length;
    const rowCount = String(container.gridTemplateRows ?? "")
      .split(/\s+/)
      .filter(Boolean).length;

    for (const slot of LAYOUT_PRESETS[key].slots) {
      const style = slotStyle(key, slot.name);
      // line 은 1-based, end 는 exclusive → 마지막 유효 line = track 수 + 1
      expect(Number(style.gridColumnEnd)).toBeLessThanOrEqual(columnCount + 1);
      expect(Number(style.gridRowEnd)).toBeLessThanOrEqual(rowCount + 1);
      expect(Number(style.gridColumnStart)).toBeGreaterThanOrEqual(1);
      expect(Number(style.gridRowStart)).toBeGreaterThanOrEqual(1);
    }
  });

  it.each(GRID_PRESETS)("%s: gridArea matches a declared area name", (key) => {
    const areas = String(
      LAYOUT_PRESETS[key].containerStyle?.gridTemplateAreas ?? "",
    );
    const declared = new Set(areas.match(/[a-zA-Z][\w-]*/g) ?? []);
    for (const slot of LAYOUT_PRESETS[key].slots) {
      expect(
        declared.has(String(slotStyle(key, slot.name).gridArea)),
        `${key}/${slot.name} 의 gridArea 가 gridTemplateAreas 에 없다`,
      ).toBe(true);
    }
  });

  it("keeps exactly one flexible slot per flex preset", () => {
    // content 계열만 남는 공간을 먹어야 한다 — 둘 이상이면 의도한 비율이 깨진다.
    for (const key of FLEX_PRESETS) {
      const growing = LAYOUT_PRESETS[key].slots.filter((slot) => {
        const style = slotStyle(key, slot.name);
        return style.flex !== undefined || style.flexGrow !== undefined;
      });
      expect(growing, `${key} 의 확장 슬롯 수`).toHaveLength(1);
    }
  });
});

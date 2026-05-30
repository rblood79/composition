import { describe, expect, it } from "vitest";

import { getPrimitiveBinding } from "../bindings";
import { getCatalogCutoverTypes, getCatalogEntry } from "../componentCatalog";
import { toRacProps } from "../outputs/toRacProps";

/**
 * ADR-142 family ③(selection) — Checkbox/Radio/Switch/Slider + Group binding 계약 검증.
 *
 * Checkbox/Radio/Switch 는 indicator(box/circle/track+thumb)가 box+text 로 표현 불가한
 * 비-DOM-trivial primitive → `skiaPrimitive` draw module(specs/renderers/skiaPrimitives.ts).
 * Slider 는 track/thumb 을 자식 SliderTrack/Thumb sub-part 가 그려 skiaPrimitive 불필요.
 * Group 은 자식 옵션 컨테이너.
 */

const SELECTION_TYPES = [
  "Checkbox",
  "CheckboxGroup",
  "Radio",
  "RadioGroup",
  "Switch",
  "Slider",
] as const;

describe("family ③ selection — catalog 등록 + cutover gate", () => {
  it("6 selection 이 모두 catalog primitive entry (family=selection, cutover=catalog)", () => {
    for (const type of SELECTION_TYPES) {
      const entry = getCatalogEntry(type);
      expect(entry, `${type} catalog entry`).toBeDefined();
      expect(entry?.kind).toBe("primitive");
      expect(entry?.family).toBe("selection");
      expect(entry?.cutover).toBe("catalog");
    }
  });

  it("6 selection 이 catalog cutover gate 에 포함", () => {
    const gate = getCatalogCutoverTypes();
    for (const type of SELECTION_TYPES) {
      expect(gate.has(type), `${type} in gate`).toBe(true);
    }
  });

  it("indicator primitive(Checkbox/Radio/Switch)는 skiaPrimitive 지정", () => {
    expect(getPrimitiveBinding("Checkbox")?.skiaPrimitive).toBe("checkbox");
    expect(getPrimitiveBinding("Radio")?.skiaPrimitive).toBe("radio");
    expect(getPrimitiveBinding("Switch")?.skiaPrimitive).toBe("switch_toggle");
  });

  it("Slider/Group 은 skiaPrimitive 없음 (자식 sub-part / 빈 box shell 흡수)", () => {
    expect(getPrimitiveBinding("Slider")?.skiaPrimitive).toBeUndefined();
    expect(getPrimitiveBinding("CheckboxGroup")?.skiaPrimitive).toBeUndefined();
    expect(getPrimitiveBinding("RadioGroup")?.skiaPrimitive).toBeUndefined();
  });
});

describe("family ③ selection — toRacProps 변환 계약", () => {
  it("Checkbox: children/isSelected 통과 + variant/size data-* 라우팅", () => {
    const result = toRacProps(
      {
        id: "cb1",
        type: "Checkbox",
        props: { children: "Agree", isSelected: true, variant: "emphasized" },
      },
      getPrimitiveBinding("Checkbox")!,
    );
    expect(result.children).toBe("Agree");
    expect(result.isSelected).toBe(true);
    expect(result["data-variant"]).toBe("emphasized");
    expect(result["data-size"]).toBe("md");
  });

  it("Slider: minValue/maxValue/step + orientation 통과", () => {
    const result = toRacProps(
      {
        id: "s1",
        type: "Slider",
        props: {
          minValue: 0,
          maxValue: 100,
          step: 10,
          orientation: "vertical",
        },
      },
      getPrimitiveBinding("Slider")!,
    );
    expect(result.minValue).toBe(0);
    expect(result.maxValue).toBe(100);
    expect(result.step).toBe(10);
    expect(result.orientation).toBe("vertical");
    expect(result["data-size"]).toBe("md");
  });

  it("Switch: isSelected boolean 통과 + size default emit", () => {
    const result = toRacProps(
      { id: "sw1", type: "Switch", props: { isSelected: true } },
      getPrimitiveBinding("Switch")!,
    );
    expect(result.isSelected).toBe(true);
    expect(result["data-size"]).toBe("md");
  });
});

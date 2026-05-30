import { describe, expect, it } from "vitest";

import {
  colorFieldBinding,
  dateFieldBinding,
  formBinding,
  numberFieldBinding,
  searchFieldBinding,
  textFieldBinding,
  timeFieldBinding,
} from "../bindings";
import { getPrimitiveBinding } from "../bindings";
import { getCatalogEntry, getCatalogCutoverTypes } from "../componentCatalog";
import { toRacProps } from "../outputs/toRacProps";

/**
 * ADR-142 family ②(fields) — 7 field binding 의 catalog 계약 검증.
 *
 * field 는 RAC-controller-backed leaf primitive(inventory §2-1). RAC `<TextField>` 등이
 * Label/Input slot 을 합성하는 것은 RAC primitive 의 D1 동작 — 사용자 조합(reusable) 아님.
 * 본 테스트는 (1) 7 binding 이 catalog 에 cutover:"catalog" 로 등록됐고 (2) toRacProps 가
 * size/labelPosition/variant 를 data-* 로 라우팅하며 string/boolean prop 을 통과시키는지 확인.
 */

const FIELD_TYPES = [
  "TextField",
  "NumberField",
  "SearchField",
  "DateField",
  "TimeField",
  "ColorField",
  "Form",
] as const;

describe("family ② fields — catalog 등록 + cutover gate", () => {
  it("7 field 가 모두 componentCatalog 에 primitive entry 로 등록됨", () => {
    for (const type of FIELD_TYPES) {
      const entry = getCatalogEntry(type);
      expect(entry, `${type} catalog entry`).toBeDefined();
      expect(entry?.kind).toBe("primitive");
      expect(entry?.family).toBe("fields");
      expect(entry?.cutover).toBe("catalog");
    }
  });

  it("7 field 가 catalog cutover gate 에 포함됨 (4경로 발효)", () => {
    const gate = getCatalogCutoverTypes();
    for (const type of FIELD_TYPES) {
      expect(gate.has(type), `${type} in cutover gate`).toBe(true);
    }
  });

  it("7 field binding 이 getPrimitiveBinding 으로 조회됨", () => {
    for (const type of FIELD_TYPES) {
      expect(getPrimitiveBinding(type), `${type} binding`).toBeDefined();
    }
  });

  it("field 는 box+text 보편 frame 흡수 — skiaPrimitive 없음", () => {
    // field 컨테이너는 자식 Input 이 배경 담당, 부모는 빈 box shell(_hasChildren).
    // 비-DOM-trivial primitive 가 아니므로 skiaPrimitive 미지정.
    for (const type of FIELD_TYPES) {
      expect(getPrimitiveBinding(type)?.skiaPrimitive).toBeUndefined();
    }
  });
});

describe("family ② fields — toRacProps 변환 계약", () => {
  it("TextField: label/description/placeholder/type 통과 + size/labelPosition data-* 라우팅", () => {
    const result = toRacProps(
      {
        id: "tf1",
        type: "TextField",
        props: {
          label: "Email",
          description: "Enter email",
          placeholder: "you@example.com",
          type: "email",
          size: "lg",
          labelPosition: "side",
          isRequired: true,
        },
      },
      textFieldBinding,
    );
    expect(result).toEqual({
      label: "Email",
      description: "Enter email",
      placeholder: "you@example.com",
      type: "email",
      "data-size": "lg",
      labelPosition: "side", // enum(visual 아님) → RAC props 로 통과
      isRequired: true,
    });
  });

  it("size 미지정 시 default 'md' → data-size emit (theme 매칭)", () => {
    const result = toRacProps(
      { id: "tf2", type: "TextField", props: { label: "Name" } },
      textFieldBinding,
    );
    expect(result["data-size"]).toBe("md");
  });

  it("NumberField: minValue/maxValue/step number prop 통과", () => {
    const result = toRacProps(
      {
        id: "nf1",
        type: "NumberField",
        props: { minValue: 0, maxValue: 100, step: 5 },
      },
      numberFieldBinding,
    );
    expect(result.minValue).toBe(0);
    expect(result.maxValue).toBe(100);
    expect(result.step).toBe(5);
    expect(result["data-size"]).toBe("md");
  });

  it("Form: variant → data-variant 라우팅 + validationBehavior 통과", () => {
    const result = toRacProps(
      {
        id: "f1",
        type: "Form",
        props: { variant: "outlined", validationBehavior: "aria" },
      },
      formBinding,
    );
    expect(result["data-variant"]).toBe("outlined");
    expect(result.validationBehavior).toBe("aria");
    expect(result["data-size"]).toBe("md");
  });

  it("DateField/TimeField/SearchField/ColorField: size default emit", () => {
    for (const [type, binding] of [
      ["DateField", dateFieldBinding],
      ["TimeField", timeFieldBinding],
      ["SearchField", searchFieldBinding],
      ["ColorField", colorFieldBinding],
    ] as const) {
      const result = toRacProps({ id: `${type}-1`, type }, binding);
      expect(result["data-size"], `${type} data-size`).toBe("md");
    }
  });

  it("accepts 미선언 prop(onChange 등)은 drop", () => {
    const result = toRacProps(
      {
        id: "tf3",
        type: "TextField",
        props: { label: "X", onChange: "noop", customProp: 42 },
      },
      textFieldBinding,
    );
    expect(result.onChange).toBeUndefined();
    expect(result.customProp).toBeUndefined();
    expect(result.label).toBe("X");
  });
});

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
      expect((entry as { cutover?: string } | undefined)?.cutover).toBe(
        "catalog",
      );
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
      // labelPosition 은 RAC/DOM prop 이 아니라 label-layout hint → data-* 라우팅.
      //   raw prop 으로 통과하면 RAC primitive 가 `<div>`/`<form>` DOM 에 흘려 React
      //   "does not recognize the labelPosition prop" 경고 + theme `[data-label-position]`
      //   selector 미매칭. (2026-07-22 fix)
      "data-label-position": "side",
      // labelAlign (2026-08-21 채택) — 노드가 생략해도 계약 default("start")가 emit 된다
      //   (labelPosition/size 와 동일 규칙). start 는 CSS 규칙이 없어 시각적으로 inert.
      "data-label-align": "start",
      isRequired: true,
    });
    // raw prop 누출 없음 확인
    expect(result.labelPosition).toBeUndefined();
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

  it("Form: labelPosition/labelAlign/necessityIndicator → data-* (raw prop 누출 없음)", () => {
    const result = toRacProps(
      {
        id: "f2",
        type: "Form",
        props: {
          labelPosition: "side",
          labelAlign: "center",
          necessityIndicator: "label",
        },
      },
      formBinding,
    );
    // label-layout hint 3종은 RAC/DOM prop 이 아님 → data-* 라우팅(theme·Form.css 가 소비).
    //   raw prop 으로 흘리면 RAC `<Form>` 이 `<form>` DOM 에 그대로 전달 → React 경고.
    expect(result["data-label-position"]).toBe("side");
    expect(result["data-label-align"]).toBe("center");
    expect(result["data-necessity-indicator"]).toBe("label");
    expect(result.labelPosition).toBeUndefined();
    expect(result.labelAlign).toBeUndefined();
    expect(result.necessityIndicator).toBeUndefined();
  });

  it("Form: labelPosition/labelAlign default('top'/'start') 도 data-* 로 emit (raw 누출 없음)", () => {
    // 기본값이 있는 두 prop 은 항상 emit → 항상 leak 하던 회귀 지점.
    const result = toRacProps({ id: "f3", type: "Form" }, formBinding);
    expect(result["data-label-position"]).toBe("top");
    expect(result["data-label-align"]).toBe("start");
    expect(result.labelPosition).toBeUndefined();
    expect(result.labelAlign).toBeUndefined();
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

describe("TimeField 형제 대칭 — minValue/maxValue + granularity (§1-3, 2026-08-21)", () => {
  it("minValue/maxValue accepts 선언 (DateField 동형 — string kind, state 섹션)", () => {
    for (const key of ["minValue", "maxValue"] as const) {
      const tf = timeFieldBinding.props.accepts[key];
      const df = dateFieldBinding.props.accepts[key];
      expect(tf, `TimeField accepts.${key}`).toBeDefined();
      expect(tf?.kind).toBe("string");
      expect(tf?.section).toBe(df?.section);
    }
  });

  it("granularity 옵션에 근거 없는 'day' 부재 (hour/minute/second 만)", () => {
    const g = timeFieldBinding.props.accepts.granularity as {
      options?: Array<{ value: string }>;
    };
    expect(g.options?.map((o) => o.value)).toEqual([
      "hour",
      "minute",
      "second",
    ]);
  });

  it("toRacProps 가 minValue/maxValue 문자열을 통과시킨다", () => {
    const out = toRacProps(
      {
        id: "tf1",
        type: "TimeField",
        props: { minValue: "09:00", maxValue: "18:00" },
      },
      timeFieldBinding,
    );
    expect(out.minValue).toBe("09:00");
    expect(out.maxValue).toBe("18:00");
  });
});

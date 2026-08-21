import { describe, expect, it } from "vitest";

import { toRacProps } from "../outputs/toRacProps";
import type { PrimitiveBinding } from "../types";

const buttonBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "Button",
  },
  rac: {
    primitive: "Button",
    parts: [],
    slots: [],
    states: ["isDisabled", "isPressed"],
    renderProps: [],
    dataAttributes: ["data-variant", "data-size"],
  },
  props: {
    accepts: {
      children: { kind: "string", section: "content" },
      isDisabled: { kind: "boolean", section: "state" },
      variant: { kind: "variant", section: "appearance", default: "primary" },
      size: { kind: "size", section: "appearance", default: "md" },
    },
    toRacProps: "default",
  },
};

describe("toRacProps", () => {
  it("projects accepted props and routes variant/size to data-* attributes", () => {
    const result = toRacProps(
      {
        id: "b1",
        type: "Button",
        props: {
          children: "OK",
          isDisabled: true,
          variant: "secondary",
          size: "lg",
        },
      },
      buttonBinding,
    );
    expect(result).toEqual({
      children: "OK",
      isDisabled: true,
      "data-variant": "secondary",
      "data-size": "lg",
    });
  });

  it("drops props not declared in binding.accepts and fills variant/size defaults", () => {
    const result = toRacProps(
      {
        id: "b2",
        type: "Button",
        // onClick/foo 는 accepts 에 없음 → drop. variant/size 미지정 → default 적용.
        props: { children: "OK", onClick: "noop", foo: 1 },
      },
      buttonBinding,
    );
    expect(result).toEqual({
      children: "OK",
      "data-variant": "primary",
      "data-size": "md",
    });
  });

  it("applies declared defaults when a node has no props at all", () => {
    const result = toRacProps({ id: "b3", type: "Button" }, buttonBinding);
    expect(result).toEqual({ "data-variant": "primary", "data-size": "md" });
  });
});

/**
 * boolean 시각 prop 의 `data-*` 라우팅 (2026-08-21).
 *
 * `isQuiet` 은 kind 가 `boolean` 이라 종전엔 else 분기로 빠져 raw React prop 으로 통과했다 —
 * RAC primitive 는 모르는 prop 이고 `data-quiet` 도 안 붙어 theme CSS 가 미적용이었다
 * (`labelPosition`/`staticColor` 와 같은 결함 축). 실질 피해는 TextArea — field 패밀리에서
 * 유일하게 전용 컴포넌트가 없어 이 projector 를 타는 quiet 보유 컴포넌트였다.
 */
const quietBinding: PrimitiveBinding = {
  source: {
    kind: "rac",
    package: "react-aria-components",
    importPath: "react-aria-components",
    component: "TextField",
  },
  rac: {
    primitive: "TextField",
    parts: [],
    slots: [],
    states: [],
    renderProps: [],
    dataAttributes: [],
  },
  props: {
    accepts: {
      isQuiet: { kind: "boolean", section: "appearance" },
      isRequired: { kind: "boolean", section: "state" },
    },
    toRacProps: "default",
  },
};

describe("toRacProps — boolean 시각 prop", () => {
  it("isQuiet=true → data-quiet 만 emit (raw prop 누출 차단)", () => {
    const result = toRacProps(
      { id: "ta1", type: "TextArea", props: { isQuiet: true } },
      quietBinding,
    );
    expect(result).toEqual({ "data-quiet": "true" });
  });

  it("isQuiet=false 는 아무것도 emit 하지 않는다 — 존재 셀렉터가 꺼진 상태에 걸리면 안 된다", () => {
    const result = toRacProps(
      { id: "ta2", type: "TextArea", props: { isQuiet: false } },
      quietBinding,
    );
    expect(result).toEqual({});
  });

  it("data-quiet 로 매핑한다 — 기계 변환(data-is-quiet)이 아니다", () => {
    const result = toRacProps(
      { id: "ta3", type: "TextArea", props: { isQuiet: true } },
      quietBinding,
    );
    // theme CSS 와 전용 컴포넌트 13종의 house 규약이 `data-quiet` 이다.
    expect(Object.keys(result)).toEqual(["data-quiet"]);
  });

  it("다른 boolean(RAC 실제 prop)은 그대로 통과한다 — 규칙화가 아닌 명시 매핑", () => {
    const result = toRacProps(
      { id: "ta4", type: "TextArea", props: { isRequired: true } },
      quietBinding,
    );
    expect(result).toEqual({ isRequired: true });
  });
});

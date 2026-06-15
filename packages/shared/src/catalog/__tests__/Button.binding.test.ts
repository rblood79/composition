import { describe, expect, it } from "vitest";

import { buttonBinding, getPrimitiveBinding } from "../bindings";
import { toRacProps } from "../outputs/toRacProps";

describe("Button binding → toRacProps", () => {
  it("routes variant/size to data-* and passes RAC props through", () => {
    const result = toRacProps(
      {
        id: "btn1",
        type: "Button",
        props: {
          children: "Save",
          type: "submit",
          isDisabled: true,
          variant: "secondary",
          size: "lg",
        },
      },
      buttonBinding,
    );
    expect(result).toEqual({
      children: "Save",
      type: "submit",
      isDisabled: true,
      "data-variant": "secondary",
      "data-size": "lg",
      // fillStyle default "fill" → 항상 emit (base style, [data-fill-style="outline"] 미매칭)
      "data-fill-style": "fill",
    });
  });

  it("fills variant/size defaults and drops non-accepted props (icon→reusable)", () => {
    const result = toRacProps(
      {
        id: "btn2",
        type: "Button",
        // iconName(아이콘 합성은 reusable) → accepts 에 없음 → drop. fillStyle 은 accepts 됨(아래 별도 검증).
        props: { children: "OK", iconName: "check" },
      },
      buttonBinding,
    );
    // type 은 default "button" → emit. iconName 은 accepts 에 없음 → drop. fillStyle default "fill" → data-fill-style.
    expect(result).toEqual({
      children: "OK",
      type: "button",
      "data-variant": "primary",
      "data-size": "md",
      "data-fill-style": "fill",
    });
  });

  it("routes fillStyle (visual-enum) to data-fill-style — camelCase→kebab", () => {
    const result = toRacProps(
      {
        id: "btn3",
        type: "Button",
        props: { children: "Outlined", fillStyle: "outline" },
      },
      buttonBinding,
    );
    // fillStyle 은 visual-enum → data-{kebab(key)} = data-fill-style (NOT data-fillStyle)
    expect(result["data-fill-style"]).toBe("outline");
    expect(result).not.toHaveProperty("fillStyle");
    expect(result).not.toHaveProperty("data-fillStyle");
  });
});

describe("getPrimitiveBinding", () => {
  it("returns the Button binding for type 'Button'", () => {
    expect(getPrimitiveBinding("Button")).toBe(buttonBinding);
  });

  it("returns undefined for a non-cataloged type", () => {
    // ADR-912 R6 (2026-06-15): 기존 "ListBoxItem" 은 R3 collection sub-part cutover(2026-06-14)로
    //   catalog 등록됨 → stale. 실제 미등록 type(Group — D1 ARIA, binding 부재)으로 교체.
    expect(getPrimitiveBinding("Group")).toBeUndefined();
  });
});

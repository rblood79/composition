import { describe, expect, it } from "vitest";

import { buttonBinding } from "../bindings/Button.binding";
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
    });
  });

  it("fills variant/size defaults and drops non-accepted props (icon→reusable, fillStyle deferred)", () => {
    const result = toRacProps(
      {
        id: "btn2",
        type: "Button",
        // iconName(아이콘 합성은 reusable), fillStyle(visual-enum 라우팅 정립 전) → accepts 에 없음 → drop
        props: { children: "OK", iconName: "check", fillStyle: "outline" },
      },
      buttonBinding,
    );
    // type 은 default "button" → emit. iconName/fillStyle 은 accepts 에 없음 → drop.
    expect(result).toEqual({
      children: "OK",
      type: "button",
      "data-variant": "primary",
      "data-size": "md",
    });
  });
});

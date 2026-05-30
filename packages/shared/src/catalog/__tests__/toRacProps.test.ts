import { describe, expect, it } from "vitest";

import { toRacProps } from "../outputs/toRacProps";
import type { PrimitiveBinding } from "../types";

const buttonBinding: PrimitiveBinding = {
  source: {
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

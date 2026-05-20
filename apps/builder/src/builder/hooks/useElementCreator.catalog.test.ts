import { describe, expect, it } from "vitest";

import { resolveDefaultPropsForCreation } from "./useElementCreator";

describe("ADR-142 element creator catalog bridge", () => {
  it("uses catalog primitive default props before legacy getDefaultProps", () => {
    expect(resolveDefaultPropsForCreation("Button")).toMatchObject({
      children: "Button",
      variant: "primary",
      fillStyle: "fill",
      size: "md",
      type: "button",
    });
  });
});

import { describe, expect, it } from "vitest";

import { getPrimitiveBinding, separatorBinding } from "../bindings";
import { toRacProps } from "../outputs/toRacProps";

describe("Separator binding → toRacProps", () => {
  it("routes variant/size to data-* and passes orientation as RAC prop", () => {
    const result = toRacProps(
      {
        id: "sep1",
        type: "Separator",
        props: { orientation: "vertical", variant: "accent", size: "lg" },
      },
      separatorBinding,
    );
    expect(result).toEqual({
      // orientation 은 RAC props (RAC 가 aria-orientation 자동 매핑, D1)
      orientation: "vertical",
      "data-variant": "accent",
      "data-size": "lg",
    });
  });

  it("fills orientation/variant/size defaults when props omitted", () => {
    const result = toRacProps(
      { id: "sep2", type: "Separator", props: {} },
      separatorBinding,
    );
    expect(result).toEqual({
      orientation: "horizontal",
      "data-variant": "default",
      "data-size": "md",
    });
  });

  it("drops non-accepted props", () => {
    const result = toRacProps(
      {
        id: "sep3",
        type: "Separator",
        props: { variant: "solid", onClick: () => {}, className: "x" },
      },
      separatorBinding,
    );
    expect(result).not.toHaveProperty("onClick");
    expect(result).not.toHaveProperty("className");
    expect(result["data-variant"]).toBe("solid");
  });
});

describe("getPrimitiveBinding — Separator", () => {
  it("returns the Separator binding for type 'Separator'", () => {
    expect(getPrimitiveBinding("Separator")).toBe(separatorBinding);
  });

  it("Separator is a rac source primitive (RAC Separator)", () => {
    expect(separatorBinding.source.kind).toBe("rac");
    if (separatorBinding.source.kind === "rac") {
      expect(separatorBinding.source.component).toBe("Separator");
    }
  });
});

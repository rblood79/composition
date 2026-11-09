import { describe, expect, it } from "vitest";

import { getPrimitiveBinding, separatorBinding } from "../bindings";
import { RAC_SLOT_PROP } from "../bindings/accessibilityProps";
import { toRacProps } from "../outputs/toRacProps";

describe("Separator binding → toRacProps", () => {
  // (S2 Divider · RAC · v3 have no variant — the axis is gone, 2026-10-12.)
  it("routes size to data-* and passes orientation as RAC prop", () => {
    const result = toRacProps(
      {
        id: "sep1",
        type: "Separator",
        props: { orientation: "vertical", variant: "accent", size: "L" },
      },
      separatorBinding,
    );
    expect(result).toEqual({
      // orientation 은 RAC props (RAC 가 aria-orientation 자동 매핑, D1)
      orientation: "vertical",
      "data-size": "L",
      "data-static-color": "auto",
    });
  });

  it("fills orientation/size defaults when props omitted", () => {
    const result = toRacProps(
      { id: "sep2", type: "Separator", props: {} },
      separatorBinding,
    );
    expect(result).toEqual({
      orientation: "horizontal",
      "data-size": "M",
      "data-static-color": "auto",
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
    expect(result).not.toHaveProperty("data-variant");
  });
});

describe("getPrimitiveBinding — Separator", () => {
  it("returns the Separator binding for type 'Separator'", () => {
    // (792815efc: a type with a RAC slot contract gets RAC's `slot` prop on a copy of its binding.)
    expect(getPrimitiveBinding("Separator")).toEqual({
      ...separatorBinding,
      props: {
        ...separatorBinding.props,
        accepts: { ...separatorBinding.props.accepts, slot: RAC_SLOT_PROP },
      },
    });
  });

  it("Separator is a rac source primitive (RAC Separator)", () => {
    expect(separatorBinding.source.kind).toBe("rac");
    if (separatorBinding.source.kind === "rac") {
      expect(separatorBinding.source.component).toBe("Separator");
    }
  });
});

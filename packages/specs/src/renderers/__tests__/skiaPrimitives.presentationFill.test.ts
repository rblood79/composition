import { describe, expect, it } from "vitest";
import { canMaterializeSkiaPresentationFill } from "./catalogPaintFixture";

describe("Skia presentation fill capability", () => {
  it("allows generic and composited primitives that retain the base box", () => {
    const genericContext = { hasGenericBackground: true };
    expect(
      canMaterializeSkiaPresentationFill(undefined, {}, genericContext),
    ).toBe(true);
    expect(
      canMaterializeSkiaPresentationFill("tooltip_arrow", {}, genericContext),
    ).toBe(true);
    expect(
      canMaterializeSkiaPresentationFill(
        "dot",
        { isDot: false },
        genericContext,
      ),
    ).toBe(true);
  });

  it("rejects an absent primitive when native renderer has no background contract", () => {
    expect(canMaterializeSkiaPresentationFill(undefined, {})).toBe(false);
    expect(
      canMaterializeSkiaPresentationFill(
        undefined,
        {},
        {
          hasChildren: true,
          hasGenericBackground: false,
        },
      ),
    ).toBe(false);
  });

  it("allows replace primitives only when they expose a typed background slot", () => {
    expect(canMaterializeSkiaPresentationFill("status_light", {})).toBe(true);
    expect(canMaterializeSkiaPresentationFill("checkbox", {})).toBe(true);
    expect(canMaterializeSkiaPresentationFill("value_fill_arc", {})).toBe(true);
    expect(canMaterializeSkiaPresentationFill("radio", {})).toBe(false);
    expect(canMaterializeSkiaPresentationFill("switch_toggle", {})).toBe(false);
  });

  it("uses structural context for child-delegated replace primitives", () => {
    expect(
      canMaterializeSkiaPresentationFill(
        "datefield_trigger",
        {},
        {
          hasChildren: true,
        },
      ),
    ).toBe(false);
    expect(
      canMaterializeSkiaPresentationFill(
        "value_fill_arc",
        {},
        {
          hasChildren: true,
        },
      ),
    ).toBe(false);
    expect(
      canMaterializeSkiaPresentationFill(
        "datefield_segments",
        {},
        {
          ancestorTypes: ["SelectTrigger", "DatePicker"],
        },
      ),
    ).toBe(false);
    expect(
      canMaterializeSkiaPresentationFill(
        "datefield_segments",
        {},
        {
          ancestorTypes: ["DateField"],
        },
      ),
    ).toBe(true);
  });

  it("rejects a mixed binding when any replace primitive cannot materialize", () => {
    expect(
      canMaterializeSkiaPresentationFill(["tooltip_arrow", "radio"], {}),
    ).toBe(false);
  });
});

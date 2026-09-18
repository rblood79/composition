import { describe, expect, it } from "vitest";
import type { Element } from "../../../types/core/store.types";
import {
  buildAbsoluteActivationEdit,
  collectInvalidFillAxes,
} from "./absoluteSizingEdit";

const row = () => ({ display: "flex", flexDirection: "row" });
const make = (extra: Partial<Element> = {}): Element =>
  ({
    id: "a",
    type: "Button",
    props: { style: {} },
    ...extra,
  }) as Element;

describe("ADR-224 Flow→Absolute — 무효 Fill 만 used px 로 Fixed", () => {
  it("fixes a base Fill marker to the desktop used px and releases the marker", () => {
    const element = make({ sizing: { width: { factor: 2 } } });
    const fixes = collectInvalidFillAxes({
      source: element,
      effective: element,
      parentContext: row,
      used: { desktop: { width: 591.3333, height: 240 } },
    });
    expect(fixes).toEqual([
      {
        tier: "desktop",
        axis: "width",
        px: 591.33,
        cleanup: expect.any(Array),
      },
    ]);
    const result = buildAbsoluteActivationEdit(
      element,
      { position: "absolute", left: "10px", top: "20px" },
      "desktop",
      fixes!,
    );
    expect(result.sizing).toEqual({ width: null });
    expect(result.props?.style).toMatchObject({
      position: "absolute",
      left: "10px",
      top: "20px",
      width: "591.33px",
    });
    expect(result.responsive).toBeUndefined();
  });

  it("leaves Fixed/Fit axes alone (no fill → nothing to fix, no geometry needed)", () => {
    const element = make({ props: { style: { width: "200px" } } });
    expect(
      collectInvalidFillAxes({
        source: element,
        effective: element,
        parentContext: row,
        used: {},
      }),
    ).toEqual([]);
  });

  it("treats legacy CSS grow as Fill and removes the grow props on fix", () => {
    const element = make({
      props: { style: { flexGrow: "1", flexBasis: "0%", height: "40px" } },
    });
    const fixes = collectInvalidFillAxes({
      source: element,
      effective: element,
      parentContext: row,
      used: { desktop: { width: 300, height: 40 } },
    });
    expect(fixes?.map((f) => [f.tier, f.axis, f.px])).toEqual([
      ["desktop", "width", 300],
    ]);
    const result = buildAbsoluteActivationEdit(
      element,
      { position: "absolute" },
      "desktop",
      fixes!,
    );
    expect(result.props?.style).toEqual({
      height: "40px",
      position: "absolute",
      width: "300px",
    });
  });

  it("does not commit when an owning tier has no geometry (partial commit 0)", () => {
    const element = make({
      sizing: { width: { factor: 1 } },
      responsive: { sizing: { mobile: { width: { factor: 3 } } } },
    });
    expect(
      collectInvalidFillAxes({
        source: element,
        effective: element,
        parentContext: row,
        used: { desktop: { width: 500, height: 100 } },
      }),
    ).toBeNull();
  });

  it("writes an owning tier's fix into responsive and inherits base px elsewhere", () => {
    const element = make({
      sizing: { width: { factor: 1 } },
      responsive: { sizing: { mobile: { width: { factor: 3 } } } },
    });
    const fixes = collectInvalidFillAxes({
      source: element,
      effective: element,
      parentContext: row,
      used: {
        desktop: { width: 500, height: 100 },
        mobile: { width: 320, height: 100 },
      },
    });
    expect(fixes?.map((f) => [f.tier, f.axis, f.px])).toEqual([
      ["desktop", "width", 500],
      ["mobile", "width", 320],
    ]);
    const result = buildAbsoluteActivationEdit(
      element,
      { position: "absolute" },
      "desktop",
      fixes!,
    );
    expect(result.sizing).toEqual({ width: null });
    expect(result.responsive?.sizing).toEqual({ mobile: { width: null } });
    expect(result.responsive?.styles?.width).toEqual({ mobile: "320px" });
    expect(result.props?.style).toMatchObject({ width: "500px" });
  });

  it("skips tiers that are already absolute", () => {
    const element = make({
      sizing: { width: { factor: 1 } },
      props: { style: { position: "absolute" } },
    });
    expect(
      collectInvalidFillAxes({
        source: element,
        effective: element,
        parentContext: row,
        used: {},
      }),
    ).toEqual([]);
  });
});

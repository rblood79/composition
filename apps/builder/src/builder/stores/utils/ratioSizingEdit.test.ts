import { describe, expect, it } from "vitest";
import type { Element } from "../../../types/core/store.types";
import { buildRatioSizingEdit } from "./ratioSizingEdit";
const make = (extra: Partial<Element> = {}): Element =>
  ({
    id: "a",
    type: "Button",
    props: { style: { width: "200px", height: "100px" } },
    ...extra,
  }) as Element;

describe("ADR-224 Ratio compound edit", () => {
  it("locks height in every tier without losing the width factors", () => {
    const element = make({
      sizing: { width: { factor: 2 }, height: { factor: 3 } },
      responsive: {
        sizing: { mobile: { width: { factor: 4 }, height: { factor: 5 } } },
      },
    });
    const result = buildRatioSizingEdit(element, element, "16 / 9", {});
    expect(result?.sizing).toEqual({ width: { factor: 2 }, height: null });
    expect(result?.responsive?.sizing?.mobile).toEqual({
      width: { factor: 4 },
      height: null,
    });
    // tablet 은 height 에 자기 상태가 없다 — base 의 auto/null 을 상속하므로 쓰지 않는다.
    expect(result?.responsive?.sizing?.tablet).toBeUndefined();
    expect(result?.responsive?.styles?.height).toEqual({ mobile: "auto" });
    expect(result?.props?.style).toMatchObject({
      width: "200px",
      height: "auto",
      aspectRatio: "16 / 9",
    });
  });
  it("does not commit a partial unlock when a tier with its own state lacks geometry", () => {
    const element = make({
      props: { style: { width: "200px", height: "auto", aspectRatio: "2" } },
      responsive: { styles: { width: { tablet: "300px" } } },
    });
    expect(
      buildRatioSizingEdit(element, element, "", {
        desktop: { width: 200, height: 100 },
      }),
    ).toBeNull();
  });
  it("unlocks without tier geometry when no tier owns either axis (base px is inherited)", () => {
    const element = make({
      props: { style: { width: "200px", height: "auto", aspectRatio: "2" } },
    });
    const result = buildRatioSizingEdit(element, element, "", {
      desktop: { width: 200, height: 100 },
    });
    expect(result?.props?.style).toEqual({ width: "200px", height: "100px" });
    expect(result?.responsive?.styles?.height).toBeUndefined();
  });
  it("unlocks each owning tier to before-used px, not the former Fill", () => {
    const element = make({
      props: { style: { width: "auto", height: "auto", aspectRatio: "2" } },
      sizing: { width: { factor: 2 }, height: null },
      responsive: {
        sizing: { tablet: { width: { factor: 1 } } },
        styles: { height: { mobile: "auto" } },
      },
    });
    const result = buildRatioSizingEdit(element, element, "", {
      desktop: { width: 600, height: 300 },
      tablet: { width: 400, height: 200 },
      mobile: { width: 200, height: 100 },
    });
    expect(result?.props?.style).toMatchObject({ height: "300px" });
    expect(result?.props?.style).not.toHaveProperty("aspectRatio");
    expect(result?.responsive?.styles?.height).toEqual({
      tablet: "200px",
      mobile: "100px",
    });
  });
  it("preserves a legacy height-driven ratio on read and fixes width on unlock", () => {
    const element = make({
      props: { style: { width: "auto", height: "100px", aspectRatio: "2" } },
    });
    const box = { width: 200, height: 100 };
    const result = buildRatioSizingEdit(element, element, "", {
      desktop: box,
      tablet: box,
      mobile: box,
    });
    expect(result?.props?.style).toEqual({ width: "200px", height: "100px" });
  });
});

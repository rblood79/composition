import { describe, expect, it } from "vitest";
import type { Element } from "../../../types/core/store.types";
import {
  buildCanvasResizeEdit,
  resolveFillReleasePatch,
  resolveResizeRatioLock,
} from "./canvasResizeEdit";

const row = { display: "flex", flexDirection: "row" };
const column = { display: "flex", flexDirection: "column" };
const make = (extra: Partial<Element> = {}): Element =>
  ({
    id: "a",
    type: "Button",
    props: { style: {} },
    ...extra,
  }) as Element;

describe("ADR-224 캔버스 resize — marker 축만 Fill 해제 + CSS px", () => {
  it("releases the resized axis marker and keeps the other axis Fill", () => {
    const element = make({
      sizing: { width: { factor: 2 }, height: { factor: 1 } },
    });
    const result = buildCanvasResizeEdit(
      element,
      element,
      { width: 491.333 },
      row,
      "desktop",
    );
    expect(result?.sizing).toEqual({ width: null, height: { factor: 1 } });
    expect(result?.props?.style).toEqual({ width: "491.33px" });
    expect(result?.responsive).toBeUndefined();
  });

  it("writes both axes for a corner drag as one merged update", () => {
    const element = make({
      sizing: { width: { factor: 2 } },
      props: { style: { height: "40px" } },
    });
    const result = buildCanvasResizeEdit(
      element,
      element,
      { width: 300, height: 120 },
      row,
      "desktop",
    );
    // Size 메뉴 Fixed 와 같은 경로 — 요청 축은 marker null (없던 축도 명시 null)
    expect(result?.sizing).toEqual({ width: null, height: null });
    expect(result?.props?.style).toEqual({ width: "300px", height: "120px" });
  });

  it("removes legacy CSS grow on the resized main axis", () => {
    const element = make({
      props: { style: { flexGrow: "1", flexBasis: "0%", height: "40px" } },
    });
    const result = buildCanvasResizeEdit(
      element,
      element,
      { width: 250 },
      row,
      "desktop",
    );
    expect(result?.props?.style).toEqual({ height: "40px", width: "250px" });
  });

  it("routes a non-desktop resize to the tier override with a tier marker null", () => {
    const element = make({
      sizing: { width: { factor: 1 } },
      responsive: { styles: { width: { mobile: "200px" } } },
    });
    const result = buildCanvasResizeEdit(
      element,
      element,
      { width: 320 },
      row,
      "mobile",
    );
    expect(result?.sizing).toEqual({ width: { factor: 1 } });
    expect(result?.responsive?.sizing).toEqual({ mobile: { width: null } });
    expect(result?.responsive?.styles?.width).toEqual({ mobile: "320px" });
  });

  it("writes absolute left/top through the same tier routing", () => {
    const element = make({
      props: {
        style: {
          position: "absolute",
          left: "0px",
          top: "0px",
          width: "591.33px",
        },
      },
    });
    const result = buildCanvasResizeEdit(
      element,
      element,
      { width: 541, left: 50.333 },
      { display: "flex", flexDirection: "row" },
      "desktop",
    );
    expect(result?.props?.style).toEqual({
      position: "absolute",
      left: "50.33px",
      top: "0px",
      width: "541px",
    });
    const tiered = make({
      props: { style: { position: "absolute", left: "0px", top: "0px" } },
      responsive: {
        styles: { left: { mobile: "5px" } } as never,
      },
    });
    const mobile = buildCanvasResizeEdit(
      tiered,
      tiered,
      { left: -12 },
      row,
      "mobile",
    );
    expect(
      (mobile?.responsive?.styles as Record<string, unknown> | undefined)?.left,
    ).toEqual({ mobile: "-12px" });
    expect(mobile?.props).toBeUndefined();
  });

  it("rejects a negative or non-finite px", () => {
    const element = make();
    expect(
      buildCanvasResizeEdit(element, element, { width: -1 }, row, "desktop"),
    ).toBeNull();
    expect(
      buildCanvasResizeEdit(element, element, { height: NaN }, row, "desktop"),
    ).toBeNull();
  });
});

describe("resolveFillReleasePatch — 미리보기가 엔진에서 지울 키", () => {
  it("clears main-axis grow and the projected min for a marker fraction Fill", () => {
    expect(
      resolveFillReleasePatch({}, { width: { factor: 2 } }, "width", row),
    ).toEqual({ flexGrow: "", flexShrink: "", flexBasis: "", minWidth: "" });
  });

  it("keeps an authored min and clears alignSelf on the cross axis", () => {
    expect(
      resolveFillReleasePatch(
        { minHeight: "20px" },
        { height: { factor: 1 } },
        "height",
        row,
      ),
    ).toEqual({ alignSelf: "" });
    expect(
      resolveFillReleasePatch(
        { minWidth: "20px" },
        { width: { factor: 1 } },
        "width",
        row,
      ),
    ).toEqual({ flexGrow: "", flexShrink: "", flexBasis: "" });
  });

  it("clears legacy grow without a projected min, and nothing for Fixed", () => {
    expect(
      resolveFillReleasePatch(
        { flexGrow: "1", flexBasis: "0%" },
        undefined,
        "width",
        row,
      ),
    ).toEqual({ flexGrow: "", flexShrink: "", flexBasis: "" });
    expect(
      resolveFillReleasePatch({ width: "200px" }, undefined, "width", column),
    ).toEqual({});
  });
});

describe("resolveResizeRatioLock — driver 축", () => {
  it("names width the driver when height is the dependent auto axis", () => {
    expect(
      resolveResizeRatioLock(
        { aspectRatio: "16 / 9", width: "320px", height: "auto" },
        undefined,
      ),
    ).toEqual({ driver: "width", ratio: 16 / 9 });
    expect(
      resolveResizeRatioLock(
        { aspectRatio: "2 / 1", height: "auto" },
        { width: { factor: 2 } },
      ),
    ).toEqual({ driver: "width", ratio: 2 });
  });

  it("names height the driver for a legacy height-based lock", () => {
    expect(
      resolveResizeRatioLock(
        { aspectRatio: "1 / 1", height: "100px" },
        undefined,
      ),
    ).toEqual({ driver: "height", ratio: 1 });
  });

  it("returns null without a ratio, with both axes explicit, or with an unparsable ratio", () => {
    expect(resolveResizeRatioLock({ width: "100px" }, undefined)).toBeNull();
    expect(
      resolveResizeRatioLock(
        { aspectRatio: "2 / 1", width: "100px", height: "50px" },
        undefined,
      ),
    ).toBeNull();
    expect(
      resolveResizeRatioLock(
        { aspectRatio: "wide", width: "100px" },
        undefined,
      ),
    ).toBeNull();
  });
});

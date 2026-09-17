import { describe, expect, it } from "vitest";
import { resolveGapAxisProperty } from "./gapAxis";

describe("resolveGapAxisProperty (ADR-222 §4.1 Gap 축)", () => {
  it("row flex → columnGap · column flex → rowGap (reverse 포함)", () => {
    expect(resolveGapAxisProperty("flex", "row", "nowrap")).toBe("columnGap");
    expect(
      resolveGapAxisProperty("inline-flex", "row-reverse", undefined),
    ).toBe("columnGap");
    expect(resolveGapAxisProperty("flex", "column", "nowrap")).toBe("rowGap");
    expect(resolveGapAxisProperty("flex", "column-reverse", "")).toBe("rowGap");
    expect(resolveGapAxisProperty("flex", undefined, undefined)).toBe(
      "columnGap",
    );
  });

  it("wrap · grid · block 은 종전 shorthand 계약 (null)", () => {
    expect(resolveGapAxisProperty("flex", "row", "wrap")).toBeNull();
    expect(resolveGapAxisProperty("grid", "row", "nowrap")).toBeNull();
    expect(resolveGapAxisProperty("block", undefined, undefined)).toBeNull();
  });
});

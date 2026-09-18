import { describe, expect, it } from "vitest";
import { hasSizeConstraintConflict } from "./transformUtils";

describe("hasSizeConstraintConflict", () => {
  it("blocks a same-unit min greater than max in either edit direction", () => {
    expect(hasSizeConstraintConflict("minWidth", "201px", "200px")).toBe(true);
    expect(hasSizeConstraintConflict("maxHeight", "49%", "50%")).toBe(true);
  });

  it("allows equal or correctly ordered constraints", () => {
    expect(hasSizeConstraintConflict("minWidth", "200px", "200px")).toBe(false);
    expect(hasSizeConstraintConflict("maxHeight", "51vh", "50vh")).toBe(false);
  });

  it("does not compare different units, expressions, keywords, or resets", () => {
    expect(hasSizeConstraintConflict("minWidth", "80%", "200px")).toBe(false);
    expect(
      hasSizeConstraintConflict("minWidth", "calc(100% - 8px)", "200px"),
    ).toBe(false);
    expect(hasSizeConstraintConflict("maxWidth", "none", "200px")).toBe(false);
    expect(hasSizeConstraintConflict("maxWidth", "", "200px")).toBe(false);
  });

  it("treats unitless zero as comparable to any supported length unit", () => {
    expect(hasSizeConstraintConflict("maxWidth", "0", "1px")).toBe(true);
    expect(hasSizeConstraintConflict("minHeight", "1vh", "0")).toBe(true);
  });
});

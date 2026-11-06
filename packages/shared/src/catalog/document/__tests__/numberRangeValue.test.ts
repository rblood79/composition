import { describe, expect, it } from "vitest";
import { catalogNumberRangeFits } from "../numberRangeValue";
import { catalogPropValueFits } from "../valueType";

describe("numberRange document value", () => {
  it("preserves finite ordered endpoints, including negative and equal values", () => {
    for (const value of [
      { start: -10.5, end: 0 },
      { start: 4, end: 4 },
      { start: 20, end: 80 },
    ]) {
      expect(catalogNumberRangeFits(value)).toBe(true);
      expect(catalogPropValueFits(value, "numberRange")).toBe(true);
      expect(catalogPropValueFits(value, "number")).toBe(false);
    }
  });

  it("rejects malformed data instead of coercing or discarding endpoints", () => {
    for (const value of [
      null,
      [1, 2],
      { start: 1 },
      { start: "1", end: 2 },
      { start: 3, end: 2 },
      { start: NaN, end: 2 },
      { start: 0, end: Infinity },
      { start: 0, end: 2, extra: true },
      new Date(),
    ]) {
      expect(catalogNumberRangeFits(value)).toBe(false);
      expect(catalogPropValueFits(value, "numberRange")).toBe(false);
    }
  });
});

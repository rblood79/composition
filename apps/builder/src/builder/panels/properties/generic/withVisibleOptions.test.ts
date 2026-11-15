/**
 * ADR-306 Phase 3 — 항목마다 조건이 있는 enum (Chart `shape` — chartType 마다 값 집합이 다르다) 은
 * 조건에 맞는 항목만 패널에 낸다. 조건 없는 필드는 같은 객체 (memo 유지).
 */
import { describe, expect, it } from "vitest";
import { getCatalogEntry, type ResolvedField } from "@composition/shared";
import { withVisibleOptions } from "./GenericFieldRenderer";

const shapeField = (): ResolvedField => {
  const entry = getCatalogEntry("Chart");
  if (entry?.kind !== "primitive") throw new Error("Chart binding 없음");
  const contract = entry.binding.props.accepts.shape!;
  return {
    key: "shape",
    kind: "enum",
    label: "Shape",
    section: "appearance",
    origin: "semantic",
    isOverridden: false,
    baseValue: undefined,
    currentValue: undefined,
    options: contract.options,
  };
};

describe("withVisibleOptions — Chart shape 의 종류별 값", () => {
  it.each([
    ["gauge", ["arc", "semi", "ring", "ticks"]],
    ["segmented", ["tall", "thin"]],
    ["sparkline", ["area", "line", "bar"]],
  ])("%s", (chartType, values) => {
    expect(
      withVisibleOptions(shapeField(), { chartType }).options?.map(
        (o) => o.value,
      ),
    ).toEqual(values);
  });
  it("조건 없는 필드는 그대로", () => {
    const field: ResolvedField = {
      ...shapeField(),
      options: [{ value: "a", label: "A" }],
    };
    expect(withVisibleOptions(field, { chartType: "gauge" })).toBe(field);
  });
});

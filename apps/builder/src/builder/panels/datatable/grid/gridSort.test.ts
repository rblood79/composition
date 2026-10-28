import { describe, expect, it } from "vitest";
import type { DataField } from "../../../../types/builder/data.types";
import { sortGridItems } from "./gridSort";

const items = (values: unknown[], key = "v") =>
  values.map((value, index) => ({ index, row: { [key]: value } }));
const field = (type: DataField["type"]): DataField =>
  ({ key: "v", type }) as DataField;
const order = (sorted: { index: number }[]) => sorted.map((i) => i.index);

describe("sortGridItems", () => {
  it("number 열은 값으로 · 빈 칸은 두 방향 모두 끝", () => {
    const rows = items([10, null, 2, "", 33]);
    expect(order(sortGridItems(rows, field("number"), "ascending"))).toEqual([
      2, 0, 4, 1, 3,
    ]);
    expect(order(sortGridItems(rows, field("number"), "descending"))).toEqual([
      4, 0, 2, 1, 3,
    ]);
  });

  it("글자 열은 숫자 인식 · 대소문자 무시 · 같은 값은 문서 순서 유지", () => {
    const rows = items(["row 10", "Row 2", "row 2", "apple"]);
    expect(order(sortGridItems(rows, field("string"), "ascending"))).toEqual([
      3, 1, 2, 0,
    ]);
  });

  it("boolean 은 false → true · 원본 배열은 그대로", () => {
    const rows = items([true, false, undefined, true]);
    expect(order(sortGridItems(rows, field("boolean"), "ascending"))).toEqual([
      1, 0, 3, 2,
    ]);
    expect(order(rows)).toEqual([0, 1, 2, 3]);
  });
});

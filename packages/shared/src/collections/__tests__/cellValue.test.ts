/**
 * ADR-159 P5: Table 셀 값 표시 분류 (classifyTableCellDisplay) 계약.
 *
 * - scalar 는 readRowCells stringify 와 bit-동일 (BC)
 * - array → tags (cap + overflow), object → 휴리스틱 label 텍스트
 * - Skia projection / DOM Table 셀이 이 단일 소스를 공유 (G2 대칭)
 */

import { describe, expect, it } from "vitest";

import { classifyTableCellDisplay, TABLE_CELL_TAG_CAP } from "../cellValue";

describe("classifyTableCellDisplay — scalar BC", () => {
  it("string/number/boolean 은 readRowCells stringify 와 동일", () => {
    expect(classifyTableCellDisplay("abc")).toEqual({
      kind: "text",
      text: "abc",
    });
    expect(classifyTableCellDisplay(7)).toEqual({ kind: "text", text: "7" });
    expect(classifyTableCellDisplay(true)).toEqual({
      kind: "text",
      text: "true",
    });
  });

  it("null/undefined → 빈 텍스트", () => {
    expect(classifyTableCellDisplay(null)).toEqual({ kind: "text", text: "" });
    expect(classifyTableCellDisplay(undefined)).toEqual({
      kind: "text",
      text: "",
    });
  });
});

describe("classifyTableCellDisplay — array → tags placeholder", () => {
  it("scalar 배열 → 칩 라벨", () => {
    expect(classifyTableCellDisplay(["a", "b"])).toEqual({
      kind: "tags",
      items: ["a", "b"],
      overflow: 0,
    });
  });

  it("cap 초과 → items 는 cap 개 + overflow 수", () => {
    const value = ["a", "b", "c", "d", "e"];
    const display = classifyTableCellDisplay(value);
    expect(display).toEqual({
      kind: "tags",
      items: ["a", "b", "c"],
      overflow: value.length - TABLE_CELL_TAG_CAP,
    });
  });

  it("record 원소는 label 휴리스틱 (label/name/title …)", () => {
    expect(
      classifyTableCellDisplay([{ label: "L1" }, { name: "N2" }, { id: "x" }]),
    ).toEqual({
      kind: "tags",
      // { id:"x" } 는 휴리스틱 키 없음 → itemKey("") fallback → 빈 라벨
      items: ["L1", "N2", ""],
      overflow: 0,
    });
  });

  it("빈 배열 → 칩 없이 빈 텍스트 (빈 셀과 시각 동일)", () => {
    expect(classifyTableCellDisplay([])).toEqual({ kind: "text", text: "" });
  });
});

describe("classifyTableCellDisplay — object → 휴리스틱 label 텍스트", () => {
  it("label 휴리스틱 첫 일치 필드", () => {
    expect(classifyTableCellDisplay({ name: "Kim", city: "Seoul" })).toEqual({
      kind: "text",
      text: "Kim",
    });
  });

  it("휴리스틱 키 없는 object → 빈 텍스트 (구 [object Object]/JSON 노출 제거)", () => {
    expect(classifyTableCellDisplay({ lat: 37.5, lng: 127 })).toEqual({
      kind: "text",
      // readStringField 는 number 도 수용(label 계열 키가 아니라 미일치) → itemKey "" fallback
      text: "",
    });
  });
});

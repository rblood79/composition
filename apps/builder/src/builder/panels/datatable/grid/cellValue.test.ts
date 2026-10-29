/**
 * ADR-212 Phase 2 — 셀 값 강제 (타입별) · 표시 문자열 · 편집기 종류 판정.
 * 파싱 실패는 값을 0 으로 바꾸지 않고 `ok: false` + null (UX-3).
 */
import { describe, expect, it } from "vitest";
import {
  coerceCellValue,
  formatCellValue,
  resolveCellEditorKind,
} from "./cellValue";

describe("coerceCellValue", () => {
  it("string 계열은 그대로, 빈 문자열은 null", () => {
    expect(coerceCellValue("string", "hello")).toEqual({
      ok: true,
      value: "hello",
    });
    expect(coerceCellValue("string", "")).toEqual({ ok: true, value: null });
    expect(coerceCellValue("string", " x ")).toEqual({ ok: true, value: "x" });
  });
  it("number 는 유한수만 — 실패는 null + ok:false (0 으로 바꾸지 않음)", () => {
    expect(coerceCellValue("number", "42")).toEqual({ ok: true, value: 42 });
    expect(coerceCellValue("number", " -3.5 ")).toEqual({
      ok: true,
      value: -3.5,
    });
    expect(coerceCellValue("number", "")).toEqual({ ok: true, value: null });
    expect(coerceCellValue("number", "abc")).toEqual({
      ok: false,
      value: null,
    });
    expect(coerceCellValue("number", "Infinity")).toEqual({
      ok: false,
      value: null,
    });
  });
  it("boolean 은 true/false/1/0/yes/no", () => {
    expect(coerceCellValue("boolean", "true")).toEqual({
      ok: true,
      value: true,
    });
    expect(coerceCellValue("boolean", "No")).toEqual({
      ok: true,
      value: false,
    });
    expect(coerceCellValue("boolean", "1")).toEqual({ ok: true, value: true });
    expect(coerceCellValue("boolean", "maybe")).toEqual({
      ok: false,
      value: null,
    });
  });
  it("date 는 ISO 글자 그대로 (모양이 정밀도), 느슨한 글자는 날짜로 정규화", () => {
    expect(coerceCellValue("date", "2026-09-12")).toEqual({
      ok: true,
      value: "2026-09-12",
    });
    expect(coerceCellValue("date", "Sep 12 2026")).toEqual({
      ok: true,
      value: "2026-09-12",
    });
    expect(coerceCellValue("date", "not a date")).toEqual({
      ok: false,
      value: null,
    });
    // (One date type, 2026-10-29 — an ISO text of any shape stays as written: a day and time,
    //   a zoned instant, a time.)
    expect(coerceCellValue("date", "2026-09-12T10:00:00.000Z")).toEqual({
      ok: true,
      value: "2026-09-12T10:00:00.000Z",
    });
    expect(coerceCellValue("date", "2026-09-12T10:00")).toEqual({
      ok: true,
      value: "2026-09-12T10:00",
    });
    expect(coerceCellValue("date", "10:30")).toEqual({
      ok: true,
      value: "10:30",
    });
  });
  it("array · object 는 JSON 하나 — 객체 · 배열 어느 쪽이든, 스칼라 · 깨진 JSON 은 실패 (2026-10-29)", () => {
    expect(coerceCellValue("array", "[1,2]")).toEqual({
      ok: true,
      value: [1, 2],
    });
    expect(coerceCellValue("array", '{"a":1}')).toEqual({
      ok: true,
      value: { a: 1 },
    });
    expect(coerceCellValue("object", "3")).toEqual({ ok: false, value: null });
    expect(coerceCellValue("object", '{"a":1}')).toEqual({
      ok: true,
      value: { a: 1 },
    });
    expect(coerceCellValue("object", "{bad")).toEqual({
      ok: false,
      value: null,
    });
    expect(coerceCellValue("object", "")).toEqual({ ok: true, value: null });
  });
});

describe("formatCellValue", () => {
  it("null/undefined 는 빈 문자열, 객체는 JSON, 나머지는 String", () => {
    expect(formatCellValue(null)).toBe("");
    expect(formatCellValue(undefined)).toBe("");
    expect(formatCellValue(3)).toBe("3");
    expect(formatCellValue(true)).toBe("true");
    expect(formatCellValue({ a: 1 })).toBe('{"a":1}');
    expect(formatCellValue([1, "x"])).toBe('[1,"x"]');
  });
});

describe("resolveCellEditorKind", () => {
  it("array · object 는 popover, date 는 셀 안 선택기 (inline)", () => {
    for (const type of ["array", "object"] as const) {
      expect(resolveCellEditorKind(type, "")).toBe("popover");
    }
    expect(resolveCellEditorKind("date", "2026-10-29")).toBe("inline");
  });
  it("긴 문자열 · 줄바꿈은 popover, 짧은 값은 inline", () => {
    expect(resolveCellEditorKind("string", "short")).toBe("inline");
    expect(resolveCellEditorKind("string", "a".repeat(81))).toBe("popover");
    expect(resolveCellEditorKind("string", "line\nbreak")).toBe("popover");
    expect(resolveCellEditorKind("number", 12)).toBe("inline");
  });
});

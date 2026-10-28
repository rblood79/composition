/**
 * ADR-289 Decision 2 (리뷰 H1) — `resolveFieldDefault`: typed defaults are kept, text defaults are
 * coerced, other structure values go through JSON, failures read as "no default".
 */
import { describe, expect, it } from "vitest";
import type { DataField } from "../../../../types/builder/data.types";
import { cloneCellValue, resolveFieldDefault } from "./fieldDefault";

const field = (type: DataField["type"], defaultValue: unknown): DataField => ({
  key: "f",
  type,
  defaultValue,
});

describe("resolveFieldDefault", () => {
  it("keeps a value already of the column's type — object · array · empty array", () => {
    expect(resolveFieldDefault(field("object", { enabled: true }))).toEqual({
      ok: true,
      value: { enabled: true },
    });
    expect(resolveFieldDefault(field("array", [1, 2]))).toEqual({
      ok: true,
      value: [1, 2],
    });
    expect(resolveFieldDefault(field("array", []))).toEqual({
      ok: true,
      value: [],
    });
    expect(resolveFieldDefault(field("boolean", false))).toEqual({
      ok: true,
      value: false,
    });
    expect(resolveFieldDefault(field("number", 7))).toEqual({
      ok: true,
      value: 7,
    });
  });

  it("coerces a text default — legacy documents", () => {
    expect(resolveFieldDefault(field("boolean", "true"))).toEqual({
      ok: true,
      value: true,
    });
    expect(resolveFieldDefault(field("number", "3"))).toEqual({
      ok: true,
      value: 3,
    });
    expect(resolveFieldDefault(field("object", '{"a":1}'))).toEqual({
      ok: true,
      value: { a: 1 },
    });
    expect(resolveFieldDefault(field("date", "2026-01-02"))).toEqual({
      ok: true,
      value: "2026-01-02",
    });
  });

  it("serialises other values before coercing — a number into a string column", () => {
    expect(resolveFieldDefault(field("string", 3))).toEqual({
      ok: true,
      value: "3",
    });
  });

  it("a mismatch reads as no default (ok: false) — not [object Object] · not 1,2", () => {
    expect(resolveFieldDefault(field("number", "abc"))).toEqual({
      ok: false,
      value: null,
    });
    expect(resolveFieldDefault(field("boolean", { enabled: true }))).toEqual({
      ok: false,
      value: null,
    });
    expect(resolveFieldDefault(field("number", [1, 2]))).toEqual({
      ok: false,
      value: null,
    });
  });

  it("null · undefined · an empty text = no default (ok: true, null)", () => {
    expect(resolveFieldDefault(field("string", null))).toEqual({
      ok: true,
      value: null,
    });
    expect(resolveFieldDefault({ key: "f", type: "string" })).toEqual({
      ok: true,
      value: null,
    });
    expect(resolveFieldDefault(field("array", ""))).toEqual({
      ok: true,
      value: null,
    });
  });

  it("cloneCellValue copies a structure value and returns a primitive as is", () => {
    const src = { a: [1] };
    const copy = cloneCellValue(src);
    expect(copy).toEqual(src);
    expect(copy).not.toBe(src);
    expect(copy.a).not.toBe(src.a);
    expect(cloneCellValue("x")).toBe("x");
    expect(cloneCellValue(null)).toBe(null);
  });
});

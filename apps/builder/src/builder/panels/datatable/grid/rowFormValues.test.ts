/**
 * ADR-289 Decision 1 (리뷰 M3) — Insert: empty = default · Update: untouched = keep, emptied = null
 * (even with a default) · required is judged on the stored value.
 */
import { describe, expect, it } from "vitest";
import type { DataField } from "../../../../types/builder/data.types";
import {
  finalRowValue,
  initialDraftText,
  isMissingRequired,
} from "./rowFormValues";

const name: DataField = { key: "name", type: "string", required: true };
const active: DataField = {
  key: "active",
  type: "boolean",
  defaultValue: true,
};
const tags: DataField = { key: "tags", type: "array", defaultValue: [] };
const age: DataField = { key: "age", type: "number" };

describe("finalRowValue — insert", () => {
  it("an empty field takes the default (a copy), null without one", () => {
    expect(
      finalRowValue("insert", active, { text: "", touched: false }),
    ).toEqual({ kind: "value", value: true });
    const final = finalRowValue("insert", tags, { text: "", touched: true });
    expect(final).toEqual({ kind: "value", value: [] });
    expect((final as { value: unknown }).value).not.toBe(tags.defaultValue);
    expect(finalRowValue("insert", name, { text: "", touched: true })).toEqual({
      kind: "value",
      value: null,
    });
  });

  it("text is coerced to the field's type · a mismatch is invalid", () => {
    expect(finalRowValue("insert", age, { text: "42", touched: true })).toEqual(
      { kind: "value", value: 42 },
    );
    expect(finalRowValue("insert", age, { text: "x", touched: true })).toEqual({
      kind: "invalid",
    });
    expect(
      finalRowValue("insert", active, { text: "false", touched: true }),
    ).toEqual({ kind: "value", value: false });
  });
});

describe("finalRowValue — update", () => {
  it("untouched = keep (nothing written) · emptied = null even with a default", () => {
    expect(
      finalRowValue("update", active, { text: "true", touched: false }),
    ).toEqual({ kind: "keep" });
    expect(
      finalRowValue("update", active, { text: "", touched: true }),
    ).toEqual({ kind: "value", value: null });
    expect(finalRowValue("update", tags, { text: "", touched: true })).toEqual({
      kind: "value",
      value: null,
    });
  });

  it("initialDraftText — insert is empty, update is the current value as text", () => {
    expect(initialDraftText("insert", "Ann")).toBe("");
    expect(initialDraftText("update", "Ann")).toBe("Ann");
    expect(initialDraftText("update", ["a"])).toBe('["a"]');
    expect(initialDraftText("update", null)).toBe("");
  });
});

describe("isMissingRequired", () => {
  it("insert: judged after the default · update: the kept current value counts", () => {
    expect(
      isMissingRequired(
        name,
        finalRowValue("insert", name, { text: "", touched: false }),
        undefined,
      ),
    ).toBe(true);
    const requiredWithDefault: DataField = { ...active, required: true };
    expect(
      isMissingRequired(
        requiredWithDefault,
        finalRowValue("insert", requiredWithDefault, {
          text: "",
          touched: false,
        }),
        undefined,
      ),
    ).toBe(false);
    expect(isMissingRequired(name, { kind: "keep" }, "Ann")).toBe(false);
    expect(isMissingRequired(name, { kind: "keep" }, null)).toBe(true);
    expect(isMissingRequired(name, { kind: "value", value: null }, "Ann")).toBe(
      true,
    );
    // not required · invalid are not "missing"
    expect(isMissingRequired(age, { kind: "value", value: null }, 1)).toBe(
      false,
    );
    expect(isMissingRequired(name, { kind: "invalid" }, null)).toBe(false);
  });
});

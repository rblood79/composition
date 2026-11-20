import { describe, expect, it } from "vitest";
import {
  catalogColumnFilterCondition,
  catalogColumnFilterDraft,
} from "../tableColumnFilterDraft";

/** ADR-315 Phase 4 증분 4c — the filter dialog's value as typed → the condition it writes. */
describe("tableColumnFilterDraft", () => {
  it("starts on the kind's usual comparison, or the Column's filter now", () => {
    expect(
      catalogColumnFilterDraft({ kind: "text", ops: ["equals", "contains"] })
        .op,
    ).toBe("contains");
    expect(
      catalogColumnFilterDraft({ kind: "number", ops: ["gte", "equals"] }).op,
    ).toBe("equals");
    // (the usual one not taken — the first the Column offers)
    expect(catalogColumnFilterDraft({ kind: "text", ops: ["equals"] }).op).toBe(
      "equals",
    );
    expect(
      catalogColumnFilterDraft({
        kind: "number",
        ops: ["equals", "between"],
        condition: { op: "between", value: [2, 9] },
      }),
    ).toMatchObject({ op: "between", text: "2", to: "9" });
    expect(
      catalogColumnFilterDraft({
        kind: "text",
        ops: ["oneOf"],
        condition: { op: "oneOf", value: ["a", "b"] },
      }).picked,
    ).toEqual(["a", "b"]);
    // (a filter of a comparison no longer offered — an empty one)
    expect(
      catalogColumnFilterDraft({
        kind: "text",
        ops: ["contains"],
        condition: { op: "endsWith", value: "x" },
      }),
    ).toMatchObject({ op: "contains", text: "" });
  });

  it("writes the value as the field kind holds it; an empty value as empty (the write drops it)", () => {
    const draft = (patch: object) => ({
      op: "equals" as const,
      text: "",
      to: "",
      picked: [],
      unit: "day" as const,
      ...patch,
    });
    expect(
      catalogColumnFilterCondition("number", draft({ text: " 12 " })),
    ).toEqual({ op: "equals", value: 12 });
    expect(
      catalogColumnFilterCondition("number", draft({ text: "x" })),
    ).toEqual({ op: "equals", value: "" });
    expect(
      catalogColumnFilterCondition("boolean", draft({ text: "false" })),
    ).toEqual({ op: "equals", value: false });
    expect(
      catalogColumnFilterCondition("text", draft({ text: " a b " })),
    ).toEqual({ op: "equals", value: " a b " });
    expect(
      catalogColumnFilterCondition(
        "date",
        draft({ op: "between", text: "2026-01-01", to: "" }),
      ),
    ).toEqual({ op: "between", value: ["2026-01-01", ""] });
    expect(
      catalogColumnFilterCondition(
        "date",
        draft({ op: "withinLast", text: "3", unit: "week" }),
      ),
    ).toEqual({ op: "withinLast", value: 3, unit: "week" });
    expect(
      catalogColumnFilterCondition(
        "text",
        draft({ op: "oneOf", picked: ["a", null] }),
      ),
    ).toEqual({ op: "oneOf", value: ["a", null] });
    expect(
      catalogColumnFilterCondition("text", draft({ op: "exists", text: "zz" })),
    ).toEqual({ op: "exists" });
  });
});

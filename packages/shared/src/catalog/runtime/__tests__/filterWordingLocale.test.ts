import { describe, expect, it } from "vitest";
import type { ViewConditionGroup } from "../../document/types";
import { catalogFilterChips } from "../filterWording";

/**
 * The filter bar's chips in the site's language (i18n 감사 2026-11-28): a group's count says one ·
 * many, numbers and a date field's values are written as the locale writes them, and the Korean
 * comparisons read right before the value (no particle — 「다음으로 시작」).
 */
const tree = (items: ViewConditionGroup["items"]): ViewConditionGroup => ({
  id: "root",
  op: "and",
  items,
});
const KIND = { "f-n": "number", "f-d": "date", "f-t": "text" } as const;
const chips = (items: ViewConditionGroup["items"], locale: string) =>
  catalogFilterChips(
    tree(items),
    (condition) => String(condition.fields[0]?.[0]).slice("data:field:".length),
    locale,
    (condition) =>
      KIND[
        String(condition.fields[0]?.[0]).slice(
          "data:field:".length,
        ) as keyof typeof KIND
      ],
  ).map((chip) => chip.label);
const at = (field: string, op: string, value: unknown) =>
  ({
    id: `${field}-${op}`,
    fields: [[`data:field:${field}`]],
    op,
    value,
  }) as never;

describe("filter chips in the site's language", () => {
  it("a group of one condition is 「1 condition」, of two 「2 conditions」", () => {
    const group = (n: number) =>
      ({
        id: `g${n}`,
        op: "or",
        items: Array.from({ length: n }, (_, i) =>
          at("f-t", "contains", `x${i}`),
        ),
      }) as never;
    expect(chips([group(1), group(2)], "en")).toEqual([
      "Group (1 condition)",
      "Group (2 conditions)",
    ]);
    expect(chips([group(1)], "ko")).toEqual(["묶음 (조건 1)"]);
  });

  it("numbers in the locale's digits; a date field's day as the locale writes it (no time zone shift)", () => {
    expect(
      chips(
        [
          at("f-n", "gte", 1234567.5),
          at("f-d", "after", "2026-11-05"),
          at("f-n", "between", [1000, 2000]),
        ],
        "en-US",
      ),
    ).toEqual([
      "f-n At least 1,234,567.5",
      "f-d After Nov 5, 2026",
      "f-n Between 1,000 – 2,000",
    ]);
    expect(chips([at("f-d", "after", "2026-11-05")], "ko")).toEqual([
      "f-d 이후 2026. 11. 5.",
    ]);
    // (A text field's ISO-looking text stays as typed.)
    expect(chips([at("f-t", "equals", "2026-11-05")], "en")).toEqual([
      "f-t Equals 2026-11-05",
    ]);
  });

  it("Korean comparisons read before the value — no particle glued to the field", () => {
    expect(
      chips(
        [
          at("f-t", "startsWith", "Kim"),
          at("f-t", "endsWith", "son"),
          at("f-t", "oneOf", ["a", "b"]),
        ],
        "ko",
      ),
    ).toEqual([
      "f-t 다음으로 시작 Kim",
      "f-t 다음으로 끝남 son",
      "f-t 다음 중 하나 a, b",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import type {
  ViewCondition,
  ViewConditionGroup,
  ViewQuery,
} from "../../../catalog/document/types";
import type { ViewRunField } from "../evaluate";
import { serializeViewQueries, viewQueryLimits } from "../serialize";

/**
 * ADR-284 Phase 2 — a view as a request (json-server suffix · body JSON). Expected parameters are
 * written by hand. Walkthrough tasks: ① gender (radio) ② name contains (search) ④ joined range ⑤
 * 「closed 제외」 (checkbox) ⑥ search AND (female OR age < 25).
 */
const SCHEMA: ViewRunField[] = [
  { id: "f-name", key: "name", type: "string" },
  { id: "f-gender", key: "gender", type: "string" },
  { id: "f-age", key: "age", type: "number" },
  { id: "f-status", key: "status", type: "string" },
  { id: "f-joined", key: "joined", type: "date" },
];
const c = (
  id: string,
  op: ViewCondition["op"],
  field: string,
  patch: Partial<ViewCondition> = {},
): ViewCondition => ({ id, fields: [[`data:field:${field}`]], op, ...patch });
const where = (
  items: ViewConditionGroup["items"],
  op: "and" | "or" = "and",
): ViewConditionGroup => ({ id: "where", op, items });

const TASKS = {
  one: c("gender", "equals", "f-gender", { value: "!var.g", skip: "all" }),
  two: c("search", "contains", "f-name", { value: "!var.q" }),
  four: c("joined", "between", "f-joined", { value: ["!var.from", "!var.to"] }),
  five: c("open", "notEquals", "f-status", {
    value: "closed",
    enabled: "!var.hide",
  }),
  sixOr: {
    id: "either",
    op: "or" as const,
    items: [
      c("female", "equals", "f-gender", { value: "female" }),
      c("young", "lt", "f-age", { value: 25 }),
    ],
  },
};

function serialize(
  query: ViewQuery,
  values: Record<string, unknown>,
  kind: "suffix" | "body" = "suffix",
  method = "GET",
) {
  return serializeViewQueries(
    { kind },
    {
      queries: [query],
      schema: SCHEMA,
      resolve: (value) =>
        typeof value === "string" && value.startsWith("!")
          ? value in values
            ? { value: values[value] }
            : undefined
          : { value },
    },
    method,
  );
}

describe("ADR-284 — view → suffix parameters (json-server)", () => {
  it("① ② ④ ⑤: one parameter per applied condition; skipped ones send nothing", () => {
    const query = {
      where: where([TASKS.one, TASKS.two, TASKS.four, TASKS.five]),
    };
    expect(
      serialize(query, {
        "!var.g": "female",
        "!var.q": "pa",
        "!var.from": "2026-10-01",
        "!var.to": { year: 2026, month: 10, day: 31 },
        "!var.hide": true,
      }),
    ).toEqual({
      params: [
        ["gender", "female"],
        ["name_like", "pa"],
        ["joined_gte", "2026-10-01"],
        ["joined_lte", "2026-10-31"],
        ["status_ne", "closed"],
      ],
      warnings: [],
    });
    // (「전체」 · empty search · open range · the checkbox off — nothing to send.)
    expect(
      serialize(query, {
        "!var.g": "all",
        "!var.q": "",
        "!var.from": "",
        "!var.to": "",
        "!var.hide": false,
      }).params,
    ).toEqual([]);
  });

  it("⑥: an `or` of applied conditions cannot be flat parameters — left out and reported", () => {
    const query = { where: where([TASKS.two, TASKS.sixOr]) };
    expect(serialize(query, { "!var.q": "k" })).toEqual({
      params: [["name_like", "k"]],
      warnings: [{ code: "OR_GROUP", conditionId: "either" }],
    });
    // (One applied item of the `or` is a plain condition.)
    const one = {
      where: where([
        {
          ...TASKS.sixOr,
          items: [
            TASKS.sixOr.items[0]!,
            c("q2", "contains", "f-name", { value: "" }),
          ],
        },
      ]),
    };
    expect(serialize(one, {}).params).toEqual([["gender", "female"]]);
  });

  it("lists repeat; several fields · comparisons without a suffix are reported; the sort", () => {
    expect(
      serialize(
        {
          where: where([c("g", "oneOf", "f-gender", { value: "!var.s" })]),
          sort: [{ field: ["data:field:f-age"], direction: "descending" }],
        },
        { "!var.s": new Set(["male", "female"]) },
      ).params,
    ).toEqual([
      ["gender", "male"],
      ["gender", "female"],
      ["_sort", "age"],
      ["_order", "desc"],
    ]);
    const multi: ViewCondition = {
      id: "both",
      fields: [["data:field:f-name"], ["data:field:f-status"]],
      op: "contains",
      value: "x",
    };
    expect(
      serialize(
        {
          where: where([multi, c("s", "startsWith", "f-name", { value: "a" })]),
        },
        {},
      ).warnings,
    ).toEqual([
      { code: "MULTI_FIELD", conditionId: "both" },
      { code: "COMPARISON", conditionId: "s", comparison: "startsWith" },
    ]);
    expect(
      serialize(
        { where: where([c("g", "equals", "f-gone", { value: "x" })]) },
        {},
      ).warnings,
    ).toEqual([{ code: "BROKEN", conditionId: "g" }]);
  });
});

describe("ADR-284 — view → body JSON", () => {
  it("⑥ as a tree; skipped conditions leave the tree; GET is reported", () => {
    const query = {
      where: where([TASKS.two, TASKS.sixOr]),
      sort: [
        {
          field: ["data:field:f-name" as const],
          direction: "ascending" as const,
        },
      ],
    };
    expect(serialize(query, { "!var.q": "" }, "body", "POST")).toEqual({
      params: [],
      body: {
        where: {
          op: "and",
          items: [
            {
              op: "or",
              items: [
                { fields: ["gender"], op: "equals", value: "female" },
                { fields: ["age"], op: "lt", value: 25 },
              ],
            },
          ],
        },
        sort: { field: "name", direction: "ascending" },
        total: true,
      },
      warnings: [],
    });
    expect(serialize(query, { "!var.q": "" }, "body", "GET").warnings).toEqual([
      { code: "GET_BODY" },
    ]);
  });
});

describe("ADR-284 — what a format cannot carry, whatever the variables hold", () => {
  it("the suffix format: an `or` · several fields · an unnamed comparison · a range without both bounds", () => {
    const multi: ViewCondition = {
      id: "both",
      fields: [["data:field:f-name"], ["data:field:f-status"]],
      op: "contains",
      value: "x",
    };
    const query: ViewQuery = {
      where: where([
        TASKS.one,
        TASKS.two,
        TASKS.four,
        TASKS.sixOr,
        multi,
        c("s", "startsWith", "f-name", { value: "a" }),
        c("g", "equals", "f-gone", { value: "x" }),
      ]),
    };
    expect(
      viewQueryLimits({ kind: "suffix" }, { queries: [query], schema: SCHEMA }),
    ).toEqual([
      { code: "OR_GROUP", conditionId: "either" },
      { code: "MULTI_FIELD", conditionId: "both" },
      { code: "COMPARISON", conditionId: "s", comparison: "startsWith" },
      { code: "BROKEN", conditionId: "g" },
    ]);
    // (An author's table: `startsWith` named, `lte` not — the range cannot go.)
    expect(
      viewQueryLimits(
        { kind: "suffix", suffixes: { gte: "_gte", startsWith: "_start" } },
        {
          queries: [
            { where: where([TASKS.four, c("s", "startsWith", "f-name")]) },
          ],
          schema: SCHEMA,
        },
      ),
    ).toEqual([
      { code: "COMPARISON", conditionId: "joined", comparison: "between" },
    ]);
  });

  it("the body format carries the tree; GET is reported; `none` reports nothing", () => {
    const query = { where: where([TASKS.two, TASKS.sixOr]) };
    expect(
      viewQueryLimits(
        { kind: "body" },
        { queries: [query], schema: SCHEMA },
        "POST",
      ),
    ).toEqual([]);
    expect(
      viewQueryLimits({ kind: "body" }, { queries: [query], schema: SCHEMA }),
    ).toEqual([{ code: "GET_BODY" }]);
    expect(
      viewQueryLimits({ kind: "none" }, { queries: [query], schema: SCHEMA }),
    ).toEqual([]);
  });
});

/**
 * ADR-320 Decision 4 (G1 — 리뷰 round 4 h6 · h7 · round 5 h9) — what a request cannot carry is
 * not sent and the view runs here over every row (`load: "all"`): two conditions giving one
 * parameter key (a server reads a repeated key as `or`), a key the endpoint's own URL already
 * has, a `body` format on a method that sends no body.
 */
describe("ADR-320 — a key given twice · a body that is not sent", () => {
  const literal = (value: unknown) => ({ value });
  const suffix = (
    items: ViewConditionGroup["items"],
    taken?: readonly string[],
  ) =>
    serializeViewQueries(
      { kind: "suffix" },
      { queries: [{ where: where(items) }], schema: SCHEMA, resolve: literal },
      "GET",
      undefined,
      undefined,
      taken,
    );
  const open = c("open", "equals", "f-status", { value: "open" });
  const closed = c("closed", "equals", "f-status", { value: "closed" });

  it("two equalities of one field are not one repeated key — the later one is not sent, every row loads", () => {
    expect(suffix([open, closed])).toEqual({
      params: [["status", "open"]],
      warnings: [{ code: "DUPLICATE_KEY", conditionId: "closed" }],
      load: "all",
    });
  });

  it("one condition's list is one key repeated — sent", () => {
    expect(
      suffix([c("either", "oneOf", "f-status", { value: ["open", "closed"] })]),
    ).toEqual({
      params: [
        ["status", "open"],
        ["status", "closed"],
      ],
      warnings: [],
    });
  });

  it("the comparisons sharing a suffix collide too (`gt` · `after` = `_gt`), and a range's ends", () => {
    expect(
      suffix([
        c("a", "gt", "f-age", { value: 3 }),
        c("b", "after", "f-age", { value: 5 }),
      ]).warnings,
    ).toEqual([{ code: "DUPLICATE_KEY", conditionId: "b" }]);
    expect(
      suffix([
        c("range", "between", "f-age", { value: [1, 9] }),
        c("least", "gte", "f-age", { value: 5 }),
      ]),
    ).toEqual({
      params: [
        ["age_gte", "1"],
        ["age_lte", "9"],
      ],
      warnings: [{ code: "DUPLICATE_KEY", conditionId: "least" }],
      load: "all",
    });
    // (different suffixes of one field are different keys)
    expect(
      suffix([
        c("least", "gte", "f-age", { value: 5 }),
        c("most", "lte", "f-age", { value: 9 }),
      ]).warnings,
    ).toEqual([]);
  });

  it("a key the endpoint's own URL already has is not sent again", () => {
    // (the endpoint's default `status=open`: `status = closed` would read 「open 또는 closed」)
    expect(suffix([closed], ["status"])).toEqual({
      params: [],
      warnings: [{ code: "DUPLICATE_KEY", conditionId: "closed" }],
      load: "all",
    });
    expect(suffix([closed], ["page"])).toEqual({
      params: [["status", "closed"]],
      warnings: [],
    });
  });

  it("a skipped condition takes no key", () => {
    expect(suffix([{ ...open, enabled: false }, closed])).toEqual({
      params: [["status", "closed"]],
      warnings: [],
    });
  });

  it("a `body` format on GET · HEAD sends nothing of the view: every row loads and it runs here", () => {
    const body = (method: string, items: ViewConditionGroup["items"]) =>
      serializeViewQueries(
        { kind: "body" },
        {
          queries: [{ where: where(items) }],
          schema: SCHEMA,
          resolve: literal,
        },
        method,
      );
    for (const method of ["GET", "HEAD", "get"])
      expect(body(method, [open])).toEqual({
        params: [],
        warnings: [{ code: "GET_BODY" }],
        load: "all",
      });
    // (POST: the body carries it)
    expect(body("POST", [open])).toEqual({
      params: [],
      body: {
        where: {
          op: "and",
          items: [{ fields: ["status"], op: "equals", value: "open" }],
        },
        total: true,
      },
      warnings: [],
    });
    // (nothing to carry: the request is the endpoint's own — no load of every row)
    expect(body("GET", []).load).toBeUndefined();
  });

  it("the static limits say the same (every condition taken as applied)", () => {
    const limits = (
      items: ViewConditionGroup["items"],
      taken?: readonly string[],
    ) =>
      viewQueryLimits(
        { kind: "suffix" },
        { queries: [{ where: where(items) }], schema: SCHEMA },
        "GET",
        taken,
      );
    expect(limits([open, closed])).toEqual([
      { code: "DUPLICATE_KEY", conditionId: "closed" },
    ]);
    expect(limits([closed], ["status"])).toEqual([
      { code: "DUPLICATE_KEY", conditionId: "closed" },
    ]);
    expect(
      limits([c("either", "oneOf", "f-status", { value: ["open", "closed"] })]),
    ).toEqual([]);
  });
});

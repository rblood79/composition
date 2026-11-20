import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import {
  CATALOG_FILTER_ALL,
  catalogFilterCommand,
  type CatalogFilterControlKind,
} from "../../../builder/catalogRuntime/viewAuthoring";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-315 Phase 3 (G3 · Decision 4) — a filter control's items are the field's candidate values,
 * read from the data as it is: every value (no 20-item sample), each among the rows the list's
 * other conditions keep — the control's own choice aside (TanStack faceting). And a Table Column's
 * candidates with the Table's state (`session.tableFacet`). Expected values are hard-coded.
 *
 * Fixture — 26 rows: u1 … u26, dept `D01` … `D25` (u26 is `d01` — the case folded with u1's),
 * gender: an odd row is `male`, an even one `female`.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

const pad = (n: number) => String(n).padStart(2, "0");
const ROWS = Array.from({ length: 26 }, (_, index) => ({
  id: `u${index + 1}`,
  name: `User ${pad(index + 1)}`,
  dept: index === 25 ? "d01" : `D${pad(index + 1)}`,
  gender: (index + 1) % 2 === 1 ? "male" : "female",
}));
const DEPT = { id: "f-dept", key: "dept", type: "string" };
const GENDER = { id: "f-gender", key: "gender", type: "string" };
const USERS = {
  id: "users",
  name: "Users",
  schema: [
    { id: "f-id", key: "id", type: "string" },
    { id: "f-name", key: "name", type: "string" },
    DEPT,
    GENDER,
  ],
  mockData: ROWS,
  runtimeData: [],
  useMockData: true,
};
const DEPTS = Array.from({ length: 25 }, (_, index) => `D${pad(index + 1)}`);

/** The same rows under the starter Table's Column keys: `type` = the dept, `status` = the gender. */
const TABLE_USERS = {
  ...USERS,
  schema: [
    { id: "f-id", key: "id", type: "string" },
    { id: "f-name", key: "name", type: "string" },
    { id: "f-type", key: "type", type: "string" },
    { id: "f-status", key: "status", type: "string" },
  ],
  mockData: ROWS.map(({ id, name, dept, gender }) => ({
    id,
    name,
    type: dept,
    status: gender,
  })),
};

async function boundList(type: string, collection: object = USERS) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview([type]);
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [collection],
      variables: [],
      apiEndpoints: [],
    } as never);
  });
  const list = h.ids[0] as NodeId;
  h.workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: list }],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "users",
        name: "Users",
      })!,
    ),
  );
  h.flush();
  await settle();
  const shown = () =>
    [
      ...(h.element(list)?.querySelectorAll('[role="row"], [role="option"]') ??
        []),
    ].flatMap((item) => /User \d+/.exec(item.textContent ?? "")?.[0] ?? []);
  const add = (
    kind: CatalogFilterControlKind,
    field: { id: string; key: string; type?: string },
    values: string[],
  ) => {
    const { command, created } = catalogFilterCommand(
      h.workspace.runtime.graph,
      {
        listId: list,
        field,
        kind,
        control: { insert: true },
        values,
        allLabel: "전체",
        liveItems: { viewName: "Users view" },
      },
      h.workspace.newId,
    );
    expect(h.workspace.execute(command)).toBeTruthy();
    h.flush();
    return created;
  };
  const inputs = (controlId: NodeId, type: "radio" | "checkbox") =>
    [
      ...h.element(controlId)!.querySelectorAll(`input[type="${type}"]`),
    ] as HTMLInputElement[];
  return { ...h, list, shown, add, inputs };
}

describe("a filter control's items from the data (ADR-315 Phase 3)", () => {
  it("a radio: 「전체」 then every value of the field — its own choice does not take them away", async () => {
    const h = await boundList("GridList");
    // (The author's sample at the time: two values — the control reads the data, not them.)
    const dept = h.add("RadioGroup", DEPT, ["D01", "D02"]);
    await settle();
    const values = () =>
      h.inputs(dept.controlId, "radio").map((radio) => radio.value);
    // 「전체」 + the 25 departments in order (`d01` is `D01`'s candidate — one item).
    expect(values()).toEqual([CATALOG_FILTER_ALL, ...DEPTS]);
    expect(h.inputs(dept.controlId, "radio")[0]!.checked).toBe(true);

    // D03: u3 alone — and the radio still offers every department.
    act(() => {
      fireEvent.click(h.inputs(dept.controlId, "radio")[3]!);
    });
    await settle();
    expect(h.shown()).toEqual(["User 03"]);
    expect(values()).toEqual([CATALOG_FILTER_ALL, ...DEPTS]);
    // D01: u1 and u26 (`d01` — the same candidate, the comparison folds the case).
    act(() => {
      fireEvent.click(h.inputs(dept.controlId, "radio")[1]!);
    });
    await settle();
    expect(h.shown()).toEqual(["User 01", "User 26"]);
    h.view.unmount();
  }, 120_000);

  it("another control's choice narrows the candidates: the departments among the chosen gender", async () => {
    const h = await boundList("GridList");
    const dept = h.add("RadioGroup", DEPT, ["D01"]);
    const gender = h.add("CheckboxGroup", GENDER, ["male", "female"]);
    await settle();
    const genders = () =>
      h.inputs(gender.controlId, "checkbox").map((box) => box.value);
    const depts = () =>
      h.inputs(dept.controlId, "radio").map((radio) => radio.value);
    expect(genders()).toEqual(["female", "male"]);
    expect(depts()).toEqual([CATALOG_FILTER_ALL, ...DEPTS]);

    // female: the even rows — u2 … u26. Their departments: D02 · D04 … D24, and u26's `d01`.
    act(() => {
      fireEvent.click(h.inputs(gender.controlId, "checkbox")[0]!);
    });
    await settle();
    expect(h.shown().length).toBe(13);
    expect(depts()).toEqual([
      CATALOG_FILTER_ALL,
      "d01",
      ...DEPTS.filter((_, index) => (index + 1) % 2 === 0),
    ]);
    // (The gender control keeps both of its own values.)
    expect(genders()).toEqual(["female", "male"]);

    // D02 chosen too: u2 — and gender's candidates are D02's: female alone.
    act(() => {
      fireEvent.click(h.inputs(dept.controlId, "radio")[2]!);
    });
    await settle();
    expect(h.shown()).toEqual(["User 02"]);
    expect(genders()).toEqual(["female"]);
    h.view.unmount();
  }, 120_000);
});

describe("a Table Column's candidate values with the Table's state", () => {
  it("counts each value among the rows the other slices keep — the Column's own filter aside", async () => {
    // (The starter Table's Columns are Name · Type · Status: `type` = the dept, `status` = the
    //  gender.)
    const h = await boundList("Table", TABLE_USERS);
    const table = [...h.session.root!.domInputs.values()].find(
      (record) => record.ruleId === "Table",
    )!;
    const facet = (column: string) => h.session.tableFacet(table.id, column)!;
    // gender: 13 male · 13 female — in the rows' own order (u1 is male).
    expect(facet("status").values).toEqual([
      { value: "male", count: 13 },
      { value: "female", count: 13 },
    ]);
    expect(facet("status").partial).toBe(false);
    // dept: 25 candidates — `D01` holds u1 and u26.
    expect(facet("type").values.length).toBe(25);
    expect(facet("type").values[0]).toEqual({ value: "D01", count: 2 });

    // The Table filtered to female and searched for 「User 2」 — the names holding it are
    // u20 … u26 (`User 02` does not): u20 f · u21 m · u22 f · u23 m · u24 f · u25 m · u26 f.
    act(() => {
      h.session.setTableState(table.id, {
        search: "User 2",
        columnFilters: [
          { column: "status", condition: { op: "equals", value: "female" } },
        ],
      });
    });
    await settle();
    // status' own filter aside, the search kept: female 4 · male 3 (u20 is the first seen).
    expect(facet("status").values).toEqual([
      { value: "female", count: 4 },
      { value: "male", count: 3 },
    ]);
    // type's candidates: the female rows of the search — D20 · D22 · D24 · d01 (u26).
    expect(facet("type").values).toEqual([
      { value: "D20", count: 1 },
      { value: "D22", count: 1 },
      { value: "D24", count: 1 },
      { value: "d01", count: 1 },
    ]);
    // (Not a Column of the Table.)
    expect(h.session.tableFacet(table.id, "gone")).toBeUndefined();
    h.view.unmount();
  }, 120_000);
});

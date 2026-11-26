import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  NodeId,
  ViewCondition,
  ViewConditionGroup,
  ViewQuery,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-325 G3 — views of other conditions on one collection (Decision 6): each asks for its own
 * rows unless the collection's whole rows are known to be here (its total, or a declared page with
 * no next one) — an answer cut at a server's default size is never the whole. A view's 「더 보기」
 * pages its own request. An inserted row shows at the end of a server's list only when the view's
 * conditions keep it (사용자 결정 3); a row's edit shows in every list holding it. Expected rows are
 * written by hand; requests are counted at a `fetch` stub (json-server suffixes: `gender=`,
 * `age_lt=`, `id=`; `page` · `size` page them).
 */
afterEach(() => {
  vi.restoreAllMocks();
});
const settle = () =>
  act(async () => {
    for (let i = 0; i < 30; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

const condition = (
  id: string,
  op: ViewCondition["op"],
  field: string,
  value: ViewCondition["value"],
): ViewCondition => ({ id, fields: [[`data:field:${field}`]], op, value });
const where = (items: ViewConditionGroup["items"]): ViewQuery => ({
  where: { id: "where", op: "and", items },
});
const FEMALE = where([condition("g", "equals", "f-gender", "female")]);
const YOUNG = where([condition("a", "lt", "f-age", 25)]);
const ID_250 = where([condition("i", "equals", "f-id", "u250")]);

type Row = { id: string; name: string; gender: string; age: number };
const six: Row[] = [
  ["Kim", "male", 31],
  ["Park", "female", 24],
  ["Lee", "male", 22],
  ["Choi", "female", 35],
  ["Jung", "male", 28],
  ["Kang", "female", 19],
].map(([name, gender, age], index) => ({
  id: `u${index + 1}`,
  name: name as string,
  gender: gender as string,
  age: age as number,
}));
const many: Row[] = Array.from({ length: 250 }, (_, index) => ({
  id: `u${index + 1}`,
  name: `N${index + 1}`,
  gender: index % 2 ? "female" : "male",
  age: 20 + (index % 30),
}));

/**
 * `size` rows a page (`page=`); `total` · `next` only when asked to (a server that gives neither —
 * cut at its default size — is the hard case).
 */
function serve(
  rows: Row[],
  options: {
    size: number;
    total?: boolean;
    next?: boolean;
    /** The requests the server refuses (500). */
    fail?: (url: string) => boolean;
  },
) {
  const urls: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input));
    urls.push(`${url.pathname}${url.search}`);
    if (options.fail?.(`${url.pathname}${url.search}`))
      return new Response("refused", { status: 500 });
    let list = rows;
    for (const [key, value] of url.searchParams) {
      if (key === "gender") list = list.filter((row) => row.gender === value);
      if (key === "age_lt")
        list = list.filter((row) => row.age < Number(value));
      if (key === "id") list = list.filter((row) => row.id === value);
    }
    const page = Number(url.searchParams.get("page") ?? 1);
    const more = page * options.size < list.length;
    return new Response(
      JSON.stringify({
        items: list.slice((page - 1) * options.size, page * options.size),
        ...(options.next ? { next: more ? String(page + 1) : null } : {}),
        ...(options.total ? { total: list.length } : {}),
      }),
      { headers: { "content-type": "application/json" } },
    );
  });
  return urls;
}

async function open(
  rows: Row[],
  views: [ViewQuery | undefined, ViewQuery],
  server: Parameters<typeof serve>[1],
  endpoint: Record<string, unknown>,
) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const urls = serve(rows, server);
  const h = await openAdr280Preview(["ListBox", "GridList"]);
  const [a, b] = h.ids as [NodeId, NodeId];
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [
        {
          id: "users",
          name: "Users",
          schema: [
            { id: "f-id", key: "id", type: "string" },
            { id: "f-name", key: "name", type: "string" },
            { id: "f-gender", key: "gender", type: "string" },
            { id: "f-age", key: "age", type: "number" },
          ],
          mockData: [],
          runtimeData: [],
          useMockData: false,
        },
      ],
      variables: [],
      apiEndpoints: [
        {
          id: "list",
          name: "listUsers",
          baseUrl: "https://api.example.test",
          method: "GET",
          path: "/users",
          targetCollection: "Users",
          querySerialization: { kind: "suffix" },
          ...endpoint,
        },
      ],
    } as never);
  });
  for (const [id, view] of [
    [a, views[0]],
    [b, views[1]],
  ] as const)
    h.workspace.execute(
      catalogBindingCommand([{ kind: "node", id }], {
        ...catalogBindingRef({
          source: "dataTable",
          collectionId: "users",
          name: "Users",
        })!,
        ...(view ? { view } : {}),
      }),
    );
  h.flush();
  await settle();
  const names = (id: NodeId) =>
    [
      ...(h.element(id)?.querySelectorAll('[role="option"], [role="row"]') ??
        []),
    ].map(
      (item) =>
        /N\d+|Kim|Park|Lee|Choi|Jung|Kang|Dami|Edited/.exec(
          item.textContent ?? "",
        )?.[0],
    );
  return { ...h, a, b, urls, names };
}

const PAGED = {
  queryParams: [{ key: "page", value: "{{ cursor }}" }],
  responseMapping: {
    dataPath: "items",
    cursorPath: "next",
    totalPath: "total",
  },
};

describe("ADR-325 G3 — views of other conditions", () => {
  it("the whole rows known to be here (total = rows): no request a view — each runs on them", async () => {
    const h = await open(
      six,
      [FEMALE, YOUNG],
      { size: 50, total: true, next: true },
      PAGED,
    );
    expect(h.urls).toEqual(["/users"]);
    expect(h.names(h.a)).toEqual(["Park", "Choi", "Kang"]);
    expect(h.names(h.b)).toEqual(["Park", "Lee", "Kang"]);
    h.view.unmount();
  });

  it("one numbered page of 250 (20 rows, with · without a total): not the whole — each view asks", async () => {
    for (const total of [true, false]) {
      const h = await open(
        many,
        [ID_250, YOUNG],
        { size: 20, total, next: true },
        {
          ...PAGED,
          responseMapping: {
            dataPath: "items",
            cursorPath: "next",
            ...(total ? { totalPath: "total" } : {}),
          },
        },
      );
      expect(h.urls).toEqual(["/users", "/users?id=u250", "/users?age_lt=25"]);
      expect(h.names(h.a)).toEqual(["N250"]);
      h.view.unmount();
      vi.restoreAllMocks();
    }
  });

  it("an answer with no total and no page declared (20 of 250): not the whole — the view finds a row the first answer did not have", async () => {
    const h = await open(
      many,
      [ID_250, YOUNG],
      { size: 20 },
      {
        // (A template the session fills — its own load is the session's.)
        queryParams: [{ key: "q", value: "{{ filterText }}" }],
        responseMapping: { dataPath: "items" },
      },
    );
    expect(h.urls).toEqual(["/users", "/users?id=u250", "/users?age_lt=25"]);
    expect(h.names(h.a)).toEqual(["N250"]);
    h.view.unmount();
  });

  it("a view's 「더 보기」 asks for that view's next page — the other view keeps its rows", async () => {
    const h = await open(
      six,
      [FEMALE, YOUNG],
      { size: 2, total: true, next: true },
      PAGED,
    );
    expect(h.urls).toEqual([
      "/users",
      "/users?gender=female",
      "/users?age_lt=25",
    ]);
    expect(h.names(h.a)).toEqual(["Park", "Choi"]);
    await act(() => h.session.showMore("data:collection:users", h.a, false));
    await settle();
    expect(h.urls.at(-1)).toBe("/users?page=2&gender=female");
    expect(h.names(h.a)).toEqual(["Park", "Choi", "Kang"]);
    expect(h.names(h.b)).toEqual(["Park", "Lee"]);
    h.view.unmount();
  });

  it("an edit shows in every list holding the row; an insert shows at the end of the lists whose conditions keep it (사용자 결정 3)", async () => {
    const h = await open(
      six,
      [FEMALE, YOUNG],
      { size: 50, total: true, next: true },
      {
        ...PAGED,
        responseMapping: { dataPath: "items" },
      },
    );
    // (No total · no page declared — not the whole: each view asked.)
    expect(h.urls).toEqual([
      "/users",
      "/users?gender=female",
      "/users?age_lt=25",
    ]);
    act(() => {
      h.session.update("users", "u2", { name: "Edited" });
    });
    await settle();
    expect(h.names(h.a)).toEqual(["Edited", "Choi", "Kang"]);
    expect(h.names(h.b)).toEqual(["Edited", "Lee", "Kang"]);
    act(() => {
      h.session.insert("users", "start", {
        id: "u9",
        name: "Dami",
        gender: "female",
        age: 40,
      });
    });
    await settle();
    // (Female, 40: kept by the first view — at the end, not at the start the edit named; not young.)
    expect(h.names(h.a)).toEqual(["Edited", "Choi", "Kang", "Dami"]);
    expect(h.names(h.b)).toEqual(["Edited", "Lee", "Kang"]);
    // (An edit taking a row out of a view's conditions: it stays where the server put it.)
    act(() => {
      h.session.update("users", "u6", { gender: "male" });
    });
    await settle();
    expect(h.names(h.a)).toEqual(["Edited", "Choi", "Kang", "Dami"]);
    h.view.unmount();
  });

  it("a binding with no view and one with a view: the plain one reads the collection's own rows, the view asks for its own", async () => {
    const h = await open(
      many,
      [undefined, FEMALE],
      { size: 20, total: true, next: true },
      PAGED,
    );
    expect(h.urls).toEqual(["/users", "/users?gender=female"]);
    expect(h.names(h.a).slice(0, 3)).toEqual(["N1", "N2", "N3"]);
    expect(h.names(h.b).slice(0, 3)).toEqual(["N2", "N4", "N6"]);
    h.view.unmount();
  });

  it("a reload (a rule's · an interval's) asks again for every view list — the server's new value shows in each", async () => {
    const rows = six.map((row) => ({ ...row }));
    const h = await open(
      rows,
      [FEMALE, YOUNG],
      { size: 2, total: true, next: true },
      PAGED,
    );
    expect(h.names(h.a)).toEqual(["Park", "Choi"]);
    rows[1]!.name = "Edited";
    const before = h.urls.length;
    await act(() => h.session.reload("users"));
    await settle();
    expect(h.urls.slice(before)).toEqual([
      "/users",
      "/users?gender=female",
      "/users?age_lt=25",
    ]);
    expect(h.names(h.a)).toEqual(["Edited", "Choi"]);
    expect(h.names(h.b)).toEqual(["Edited", "Lee"]);
    h.view.unmount();
  });

  it("a view whose request fails shows its error (no endless load) — the other view keeps its rows", async () => {
    const h = await open(
      six,
      [FEMALE, YOUNG],
      {
        size: 2,
        total: true,
        next: true,
        fail: (url) => url.includes("gender="),
      },
      PAGED,
    );
    expect(h.urls).toEqual([
      "/users",
      "/users?gender=female",
      "/users?age_lt=25",
    ]);
    // (No rows: the empty state shows — not a load that never ends.)
    expect(h.names(h.a).filter(Boolean)).toEqual([]);
    expect(
      h.element(h.a)?.querySelector(".react-aria-IllustratedMessage"),
    ).not.toBeNull();
    expect(h.element(h.a)?.querySelector('[role="progressbar"]')).toBeNull();
    expect(h.names(h.b)).toEqual(["Park", "Lee"]);
    h.view.unmount();
  });
});

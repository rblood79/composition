import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { setFilterBarTargets } from "../../../../../../packages/shared/src/catalog/commands/filterBar";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-320 G6 · R10 — one filter bar over two lists of one collection whose author conditions differ,
 * on a server that pages (3 rows a page, json-server suffixes `name=` · `status=` · `page=`): a
 * ListBox (no author condition) and a GridList (author `status = open`). The scope's `name = Kang`
 * goes into **each list's own request** with that list's author condition (ADR-325 — a request a
 * view), so the Kang rows — on the third page of the whole data — show in both: the ListBox both
 * Kangs, the GridList the open one only. One request standing in for both would show the GridList
 * the closed Kang (or the ListBox none). Expected rows written by hand.
 */
afterEach(() => vi.restoreAllMocks());
const settle = () =>
  act(async () => {
    for (let i = 0; i < 30; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

const ROWS = [
  ["Kim", "open"],
  ["Park", "closed"],
  ["Lee", "open"],
  ["Choi", "closed"],
  ["Jung", "open"],
  ["Han", "closed"],
  ["Kang", "open"],
  ["Kang", "closed"],
].map(([name, status], index) => ({ id: `u${index + 1}`, name, status }));

describe("ADR-320 G6 · R10 — two lists, two author conditions, one bar", () => {
  it("each list's request carries its own conditions with the scope's — both show the row on a later page", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    const urls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input));
      urls.push(`${url.pathname}${url.search}`);
      let list = ROWS;
      for (const [key, value] of url.searchParams)
        if (key === "name" || key === "status")
          list = list.filter((row) => row[key] === value);
      const page = Number(url.searchParams.get("page") ?? 1);
      return new Response(
        JSON.stringify({
          items: list.slice((page - 1) * 3, page * 3),
          next: page * 3 < list.length ? String(page + 1) : null,
        }),
        { headers: { "content-type": "application/json" } },
      );
    });
    const h = await openAdr280Preview(["FilterBar", "ListBox", "GridList"]);
    const [bar, box, grid] = h.ids as [NodeId, NodeId, NodeId];
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
              { id: "f-status", key: "status", type: "string" },
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
            queryParams: [{ key: "page", value: "{{ cursor }}" }],
            responseMapping: { dataPath: "items", cursorPath: "next" },
          },
        ],
      } as never);
    });
    const ref = catalogBindingRef({
      source: "dataTable",
      collectionId: "users",
      name: "Users",
    })!;
    act(() => {
      h.workspace.execute(
        catalogBindingCommand([{ kind: "node", id: box }], ref),
      );
      h.workspace.execute(
        catalogBindingCommand([{ kind: "node", id: grid }], {
          ...ref,
          view: {
            where: {
              id: "author",
              op: "and",
              items: [
                {
                  id: "open",
                  fields: [["data:field:f-status"]],
                  op: "equals",
                  value: "open",
                },
              ],
            },
          },
        } as never),
      );
      h.workspace.execute(setFilterBarTargets(bar, [box, grid]));
    });
    h.flush();
    await settle();
    const statusOf = (id: NodeId) =>
      [
        ...(h.element(id)?.querySelectorAll('[role="option"], [role="row"]') ??
          []),
      ].map(
        (item) =>
          /Kim|Park|Lee|Choi|Jung|Han|Kang/.exec(item.textContent ?? "")?.[0],
      );
    // (Before the bar's condition: each list its own first page.)
    expect(statusOf(box)).toEqual(["Kim", "Park", "Lee"]);
    expect(statusOf(grid)).toEqual(["Kim", "Lee", "Jung"]);
    const before = urls.length;
    act(
      () =>
        void h.session.tables.scopes.assign(bar, {
          id: "filter-scope",
          op: "and",
          items: [
            {
              id: "c-name",
              fields: [["data:field:f-name"]],
              op: "equals",
              value: "Kang",
            },
          ],
        }),
    );
    await settle();
    await settle();
    const asked = urls.slice(before);
    // (Two requests — one a list — each with its own conditions.)
    expect(asked).toContain("/users?name=Kang");
    expect(asked).toHaveLength(2);
    expect(
      asked.some((url) => /status=open/.test(url) && /name=Kang/.test(url)),
    ).toBe(true);
    expect(
      asked.some((url) => /status=open/.test(url) && !/name=Kang/.test(url)),
    ).toBe(false);
    expect(statusOf(box)).toEqual(["Kang", "Kang"]);
    expect(statusOf(grid)).toEqual(["Kang"]);
    h.view.unmount();
  });
});

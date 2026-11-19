import { act, fireEvent } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import {
  setPagination,
  setRowDisplay,
} from "../../../../../../packages/shared/src/catalog/commands/rowDisplay";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-310 G7 — 표시 방식 「페이지」: a list shows `size` rows a page and a Pagination that pages it
 * (사용자 결정 6) draws a number per page — its number button repeated, the shown page selected;
 * a number shows that page, ← · → the page before · after. A remote collection's paged list asks
 * its own page (`page` · `pageSize`), its own query unit (Decision 12): another paged list keeps its
 * page, a 「더 보기」 list keeps its loaded rows.
 */
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 30; i += 1) await new Promise((r) => setTimeout(r, 0));
  });
const SCHEMA = [
  { id: "f-id", key: "id", type: "string" },
  { id: "f-label", key: "label", type: "string" },
];
const ROWS = Array.from({ length: 250 }, (_, index) => ({
  id: `r${index + 1}`,
  label: `Row ${index + 1}`,
}));

async function open(types: string[], remote = false) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(types);
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [
        {
          id: "people",
          name: "People",
          schema: SCHEMA,
          mockData: remote ? [] : ROWS,
          runtimeData: [],
          useMockData: !remote,
        },
      ],
      variables: [],
      apiEndpoints: remote
        ? [
            {
              id: "listPeople",
              name: "listPeople",
              baseUrl: "https://api.example.test",
              method: "GET",
              path: "/people",
              queryParams: [
                { key: "page", value: "{{ page }}" },
                { key: "size", value: "{{ pageSize }}" },
              ],
              targetCollection: "People",
              responseMapping: { dataPath: "items", totalPath: "total" },
            },
          ]
        : [],
    } as never);
  });
  const bind = (id: NodeId) =>
    h.workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id }],
        catalogBindingRef({
          source: "dataTable",
          collectionId: "people",
          name: "People",
        })!,
      ),
    );
  const labels = (id: NodeId) =>
    [...(h.element(id)?.querySelectorAll('[role="option"]') ?? [])].map(
      (option) => /Row \d+/.exec(option.textContent ?? "")?.[0],
    );
  const numbers = (id: NodeId) =>
    [...(h.element(id)?.querySelectorAll("button") ?? [])]
      .map((button) => button.textContent?.trim() ?? "")
      .filter((text) => /^\d+$/.test(text));
  const press = async (pagination: NodeId, text: string) => {
    const button = [
      ...(h.element(pagination)?.querySelectorAll("button") ?? []),
    ].find((item) => item.textContent?.trim() === text)!;
    expect(button).toBeDefined();
    await act(async () => {
      fireEvent.click(button);
    });
    await settle();
  };
  return { ...h, bind, labels, numbers, press };
}

it("G7: 250 rows · size 20 — 13 numbers, page 3 shows rows 41 ~ 60, ← · → step, Undo gives 「더 보기」 back", async () => {
  const h = await open(["ListBox", "Pagination"]);
  const [list, pagination] = h.ids as [NodeId, NodeId];
  h.bind(list);
  h.workspace.execute(setRowDisplay(list, { mode: "pages", size: 20 }));
  h.workspace.execute(setPagination(pagination, list));
  h.flush();
  await settle();
  expect(h.labels(list)).toHaveLength(20);
  expect(h.labels(list)[0]).toBe("Row 1");
  expect(h.numbers(pagination)).toEqual(
    Array.from({ length: 13 }, (_, index) => String(index + 1)),
  );
  await h.press(pagination, "3");
  const selected = () =>
    [...(h.element(pagination)?.querySelectorAll("button") ?? [])]
      .filter(
        (button) =>
          button.getAttribute("aria-checked") === "true" ||
          button.hasAttribute("data-selected"),
      )
      .map((button) => button.textContent?.trim());
  expect(selected()).toEqual(["3"]);
  expect(h.labels(list)).toHaveLength(20);
  expect(h.labels(list)[0]).toBe("Row 41");
  expect(h.labels(list).at(-1)).toBe("Row 60");
  await h.press(pagination, "→");
  expect(h.labels(list)[0]).toBe("Row 61");
  expect(selected()).toEqual(["4"]);
  await h.press(pagination, "←");
  await h.press(pagination, "←");
  expect(h.labels(list)[0]).toBe("Row 21");
  // Another query (a sort) starts over at page 1 — the numbers follow.
  await h.press(pagination, "3");
  act(() => {
    h.workspace.execute(
      catalogBindingCommand([{ kind: "node", id: list }], {
        ...catalogBindingRef({
          source: "dataTable",
          collectionId: "people",
          name: "People",
        })!,
        view: {
          where: { id: "where", op: "and", items: [] },
          sort: { field: ["data:field:f-label"], direction: "descending" },
        },
      } as never),
    );
  });
  h.flush();
  await settle();
  expect(selected()).toEqual(["1"]);
  expect(h.labels(list)[0]).toBe("Row 250");
  await h.press(pagination, "3");
  expect(selected()).toEqual(["3"]);
  // The last page: 241 ~ 250 (the sort goes again — Undo).
  h.workspace.undo();
  h.flush();
  await settle();
  await h.press(pagination, "13");
  expect(h.labels(list)).toEqual(
    Array.from({ length: 10 }, (_, index) => `Row ${241 + index}`),
  );
  // Undo: the display mode goes back (the default 「더 보기」 window of 100).
  h.workspace.undo();
  h.workspace.undo();
  h.flush();
  await settle();
  expect(h.labels(list)).toHaveLength(100);
});

/** A remote People of 250 rows: `page` · `size` (else the first 20), or a cursor (`next`). */
function serve(cursorOnly = false) {
  const urls: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input));
    urls.push(`${url.pathname}${url.search}`);
    const page = Number(
      (cursorOnly
        ? url.searchParams.get("cursor")
        : url.searchParams.get("page")) || 1,
    );
    const size = Number(url.searchParams.get("size") || 20);
    const items = ROWS.slice((page - 1) * size, page * size);
    return new Response(
      JSON.stringify(
        cursorOnly
          ? {
              items,
              total: ROWS.length,
              next: page * size < ROWS.length ? String(page + 1) : null,
            }
          : { items, total: ROWS.length },
      ),
      { headers: { "content-type": "application/json" } },
    );
  });
  return urls;
}

it("G7: a remote collection — each paged list its own page (`page=3`), a 「더 보기」 list keeps its rows, a reload starts over", async () => {
  const urls = serve();
  const h = await open(["ListBox", "ListBox", "ListBox", "Pagination"], true);
  const [a, b, c, pagination] = h.ids as [NodeId, NodeId, NodeId, NodeId];
  for (const id of [a, b, c]) h.bind(id);
  h.workspace.execute(setRowDisplay(a, { mode: "pages", size: 20 }));
  h.workspace.execute(setRowDisplay(b, { mode: "pages", size: 20 }));
  h.workspace.execute(setPagination(pagination, b));
  h.flush();
  await settle();
  await settle();
  expect(h.numbers(pagination)).toHaveLength(13);
  expect(h.labels(b)[0]).toBe("Row 1");
  const more = h.labels(c);
  await h.press(pagination, "3");
  expect(urls).toContain("/people?page=3&size=20");
  expect(h.labels(b)[0]).toBe("Row 41");
  expect(h.labels(b)).toHaveLength(20);
  // A is another query unit (page 1); C's loaded rows are the collection's, not B's page.
  expect(h.labels(a)[0]).toBe("Row 1");
  expect(h.labels(c)).toEqual(more);
  // A reload (a sort · a search) starts the paged lists over.
  await act(async () => {
    await h.session.reload("people");
  });
  await settle();
  expect(h.labels(b)[0]).toBe("Row 1");
  // (Its numbers show page 1 again — no press made this change.)
  const selected = [
    ...(h.element(pagination)?.querySelectorAll("button") ?? []),
  ]
    .filter(
      (button) =>
        button.getAttribute("aria-checked") === "true" ||
        button.hasAttribute("data-selected"),
    )
    .map((button) => button.textContent?.trim());
  expect(selected).toEqual(["1"]);
  // A row's edit is the collection's: every list showing that key shows it (the units share it).
  await act(async () => {
    h.session.update("people", "r2", { id: "r2", label: "Row 2b" });
  });
  await settle();
  const text = (id: NodeId) =>
    [...(h.element(id)?.querySelectorAll('[role="option"]') ?? [])].map(
      (option) => option.textContent ?? "",
    );
  for (const id of [a, b, c])
    expect(text(id).some((t) => t.includes("Row 2b"))).toBe(true);
});

it("G7: an endpoint that reads no page — no numbers, → · ← step by its cursor", async () => {
  const urls = serve(true);
  const h = await open(["ListBox", "Pagination"], true);
  const [list, pagination] = h.ids as [NodeId, NodeId];
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [
        {
          id: "people",
          name: "People",
          schema: SCHEMA,
          mockData: [],
          runtimeData: [],
          useMockData: false,
        },
      ],
      variables: [],
      apiEndpoints: [
        {
          id: "listPeople",
          name: "listPeople",
          baseUrl: "https://api.example.test",
          method: "GET",
          path: "/people",
          queryParams: [{ key: "cursor", value: "{{ cursor }}" }],
          targetCollection: "People",
          responseMapping: {
            dataPath: "items",
            cursorPath: "next",
            totalPath: "total",
          },
        },
      ],
    } as never);
  });
  h.bind(list);
  h.workspace.execute(setRowDisplay(list, { mode: "pages", size: 20 }));
  h.workspace.execute(setPagination(pagination, list));
  h.flush();
  await settle();
  await settle();
  expect(h.numbers(pagination)).toEqual([]);
  expect(h.labels(list)[0]).toBe("Row 1");
  await h.press(pagination, "→");
  expect(urls).toContain("/people?cursor=2");
  expect(h.labels(list)[0]).toBe("Row 21");
  await h.press(pagination, "←");
  expect(h.labels(list)[0]).toBe("Row 1");
});

// 2026-11-19 사용자 보고 「page 를 선택시 Rows per page 동작이 되지않는다」 (Table).
it("G7: a Table's page holds `size` rows — its height does not cut the page", async () => {
  const h = await open(["Table", "Pagination"]);
  const [table, pagination] = h.ids as [NodeId, NodeId];
  h.bind(table);
  const rows = () =>
    [...(h.element(table)?.querySelectorAll('tbody [role="row"]') ?? [])].map(
      (row) => row.getAttribute("data-key") ?? row.textContent ?? "",
    );
  for (const size of [20, 5, 30]) {
    h.workspace.execute(setRowDisplay(table, { mode: "pages", size }));
    h.workspace.execute(setPagination(pagination, table));
    h.flush();
    await settle();
    // (Its 400 height holds 14 rows — the page is not cut to them; the Table scrolls.)
    expect(rows(), `size ${size}`).toHaveLength(size);
    expect(rows()[0]).toBe("r1");
    expect(h.numbers(pagination)).toHaveLength(Math.ceil(250 / size));
  }
  await h.press(pagination, "2");
  expect(rows()[0]).toBe("r31");
  expect(rows()).toHaveLength(30);
}, 30_000);

import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  NodeId,
  ViewQuery,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  answerBody,
  answerSuffix,
} from "../../../../scripts/mock-query-server.mjs";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-320 Decision 4 (G1 — 리뷰 round 4 h7 · round 5 h9 · h10) — a view the request cannot carry
 * runs here, and only over rows known to be whole: where the next page cannot be reached it shows
 * no row (never the rows of the pages that did come).
 *
 * Fixture: two rows, a page of one — the only `open` row is on the second page.
 *   k1 Kim · closed      k2 Lee · open
 */
afterEach(() => vi.restoreAllMocks());

const SCHEMA = [
  { id: "f-id", key: "id", type: "string" },
  { id: "f-name", key: "name", type: "string" },
  { id: "f-status", key: "status", type: "string" },
];
const ROWS = [
  { id: "k1", name: "Kim", status: "closed" },
  { id: "k2", name: "Lee", status: "open" },
];
const status = (value: string): ViewQuery => ({
  where: {
    id: "where",
    op: "and",
    items: [
      {
        id: "own",
        fields: [["data:field:f-status"]],
        op: "equals",
        value,
      },
    ],
  },
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 12; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

/**
 * Pages of one. The cursor is read where `cursorFrom` says — the request body's `page.cursor`
 * (a `body` format's own place), the URL's `cursor`, or nowhere (`stuck`: the first page and the
 * same next cursor every time). The rows are filtered by the body's `where` · the URL's
 * parameters as the repository's mock query server does.
 */
function stubServer(cursorFrom: "body" | "url" | "stuck") {
  const requests: {
    url: URL;
    method: string;
    body?: Record<string, unknown>;
  }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const body = init?.body
      ? (JSON.parse(String(init.body)) as Record<string, unknown>)
      : undefined;
    requests.push({
      url,
      method: String(init?.method ?? "GET").toUpperCase(),
      ...(body ? { body } : {}),
    });
    const { page: paged, ...rest } = body ?? {};
    const params = new URLSearchParams(url.search);
    params.delete("cursor");
    const rows = (
      body ? answerBody(ROWS, rest).items : answerSuffix(ROWS, params).items
    ) as typeof ROWS;
    const cursor =
      cursorFrom === "body"
        ? (paged as { cursor?: string } | undefined)?.cursor
        : cursorFrom === "url"
          ? (url.searchParams.get("cursor") ?? undefined)
          : undefined;
    const at = cursor ? Number(cursor) : 0;
    const more = cursorFrom === "stuck" ? true : at + 1 < rows.length;
    return new Response(
      JSON.stringify({
        items: rows.slice(at, at + 1),
        next: more ? String(at + 1) : null,
        total: cursorFrom === "stuck" ? undefined : rows.length,
      }),
      { headers: { "content-type": "application/json" } },
    );
  });
  return { requests };
}

async function preview(endpoint: Record<string, unknown>, view: ViewQuery) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["ListBox"]);
  const [list] = h.ids as [NodeId];
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [
        {
          id: "items",
          name: "Items",
          schema: SCHEMA.map((field) => ({ ...field })),
          mockData: [],
          runtimeData: [],
          useMockData: false,
        },
      ],
      variables: [],
      apiEndpoints: [
        {
          id: "list",
          name: "listItems",
          baseUrl: "https://api.example.test",
          method: "GET",
          path: "/items",
          targetCollection: "Items",
          responseMapping: {
            dataPath: "items",
            cursorPath: "next",
            totalPath: "total",
          },
          ...endpoint,
        },
      ],
    } as never);
  });
  act(() => {
    h.workspace.execute(
      catalogBindingCommand([{ kind: "node", id: list }], {
        ...catalogBindingRef({
          source: "dataTable",
          collectionId: "items",
          name: "Items",
        })!,
        view,
      }),
    );
  });
  h.flush();
  await settle();
  await settle();
  await settle();
  const loaded = () =>
    (h.session.collectionItems("items") as { id: string }[]).map(
      (row) => row.id,
    );
  /** The rows the list shows (its view's result), by the names its options draw. */
  const shown = () =>
    [...(h.element(list)?.querySelectorAll('[role="option"]') ?? [])]
      .map((item) => item.textContent ?? "")
      .filter((text) => !/No results/.test(text));
  return { ...h, list, loaded, shown };
}

describe("ADR-320 — a `body` format on GET: the view runs here over rows known to be whole", () => {
  it("no way to send the cursor: no row and the failure recorded — never the first page's `closed`", async () => {
    const server = stubServer("body");
    const h = await preview(
      { querySerialization: { kind: "body" } },
      status("open"),
    );
    expect(h.session.viewFailures.get("items")).toBe("cursorUnsendable");
    expect(h.loaded()).toEqual([]);
    expect(h.shown()).toEqual([]);
    expect(h.session.loadingStateOf("items")).toBe("error");
    // (no body went, and the page that cannot be reached was not asked for again and again)
    expect(server.requests.every((request) => !request.body)).toBe(true);
    expect(server.requests.length).toBeLessThanOrEqual(2);
    h.view.unmount();
  });

  it("the cursor in the address (`?cursor={{ cursor }}`): every page loads and the view keeps `open`", async () => {
    const server = stubServer("url");
    const h = await preview(
      {
        path: "/items?cursor={{ cursor }}",
        querySerialization: { kind: "body" },
      },
      status("open"),
    );
    expect(h.session.viewFailures.size).toBe(0);
    expect(h.loaded()).toEqual(["k1", "k2"]);
    expect(h.session.viewResult(h.list)).toMatchObject({ matched: 1 });
    expect(h.shown()).toHaveLength(1);
    expect(server.requests.every((request) => !request.body)).toBe(true);
    h.view.unmount();
  });

  it("on POST the body carries the condition and the server's answer is the result", async () => {
    const server = stubServer("body");
    const h = await preview(
      { method: "POST", querySerialization: { kind: "body" } },
      status("open"),
    );
    expect(server.requests.at(-1)!.body!.where).toEqual({
      op: "and",
      items: [{ fields: ["status"], op: "equals", value: "open" }],
    });
    expect(h.session.viewFailures.size).toBe(0);
    expect(h.loaded()).toEqual(["k2"]);
    expect(h.session.viewResult(h.list)).toMatchObject({
      served: true,
      matched: 1,
    });
    h.view.unmount();
  });
});

describe("ADR-320 — a flat format: a key the request already has", () => {
  it("the endpoint's default `status=open` and the view's `status = closed`: not sent, every row loaded, none kept", async () => {
    const server = stubServer("url");
    const h = await preview(
      {
        path: "/items?cursor={{ cursor }}",
        queryParams: [{ key: "status", value: "open" }],
        querySerialization: { kind: "suffix" },
      },
      status("closed"),
    );
    // (the request's `status` is the endpoint's one — `status=open&status=closed` gives two rows)
    expect(
      server.requests.map((request) =>
        request.url.searchParams.getAll("status").join(),
      ),
    ).toEqual(server.requests.map(() => "open"));
    expect(h.session.viewFailures.size).toBe(0);
    // (the server's `status=open` rows are all here: Lee — and `status = closed` keeps none of them)
    expect(h.loaded()).toEqual(["k2"]);
    expect(h.session.viewResult(h.list)).toMatchObject({ matched: 0 });
    expect(h.shown()).toEqual([]);
    h.view.unmount();
  });

  it("a load of every row that does not advance (the same cursor again): no row, the failure recorded", async () => {
    const server = stubServer("stuck");
    const h = await preview(
      {
        path: "/items?cursor={{ cursor }}",
        queryParams: [{ key: "status", value: "closed" }],
        querySerialization: { kind: "suffix" },
      },
      // (the same key as the endpoint's: the view runs here and needs every row)
      status("closed"),
    );
    expect(h.session.viewFailures.get("items")).toBe("noProgress");
    expect(h.loaded()).toEqual([]);
    expect(h.shown()).toEqual([]);
    // (it stopped — not a request a page forever)
    expect(server.requests.length).toBeLessThanOrEqual(4);
    h.view.unmount();
  });
});

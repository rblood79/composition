import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { setFilterBarTargets } from "../../../../../../packages/shared/src/catalog/commands/filterBar";
import CatalogColumnFilterDialog from "../../../../../../packages/shared/src/catalog/runtime/tableColumnFilter.components";
import type { CatalogTableFacet } from "../../../../../../packages/shared/src/catalog/runtime/tableColumnMenu";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-320 Phase 6 (G6 — 사용자 결정 9) — the server's candidate values: a `body` endpoint that
 * says it answers them (`querySerialization.facets`) is asked `{ where, facet: { field, search,
 * cursor } }` for a condition's values — the scope's tree with that one condition left out — and
 * its `{ items, nextCursor }` are the editor's candidates (search after 250 ms, the next page by
 * the list's end). An endpoint that does not say so is never asked.
 */
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 12; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

type Sent = { url: string; body: Record<string, unknown> | undefined };

async function remoteBar(facets: boolean) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const sent: Sent[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    sent.push({ url: String(input), body });
    // (A candidate-values request: three values · a next page.)
    if (body?.facet)
      return new Response(
        JSON.stringify({
          items: body.facet.cursor
            ? [{ value: "paused", count: 4 }]
            : [
                { value: "open", count: 7 },
                { value: "closed", count: 3 },
              ],
          ...(body.facet.cursor ? {} : { nextCursor: "p2" }),
        }),
        { headers: { "content-type": "application/json" } },
      );
    // (A page of rows: one row and a next cursor — the loaded rows are not all of the data.)
    return new Response(
      JSON.stringify({
        items: [{ id: "k1", name: "Kim", status: "open" }],
        next: "1",
        total: 14,
      }),
      { headers: { "content-type": "application/json" } },
    );
  });
  const h = await openAdr280Preview(["FilterBar", "ListBox"]);
  const [bar, list] = h.ids as [NodeId, NodeId];
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [
        {
          id: "items",
          name: "Items",
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
          name: "listItems",
          method: "POST",
          baseUrl: "https://api.example.test",
          path: "/items",
          targetCollection: "Items",
          bodyType: "json",
          responseMapping: {
            dataPath: "items",
            cursorPath: "next",
            totalPath: "total",
          },
          querySerialization: {
            kind: "body",
            pageSize: 1,
            ...(facets ? { facets: true } : {}),
          },
        },
      ],
    } as never);
  });
  act(() => {
    h.workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id: list }],
        catalogBindingRef({
          source: "dataTable",
          collectionId: "items",
          name: "Items",
        })!,
      ),
    );
    h.workspace.execute(setFilterBarTargets(bar, [list]));
  });
  h.flush();
  await settle();
  await settle();
  const access = () =>
    h.session.tables.filterBarAccess(
      h.element(bar)!.getAttribute("data-catalog-id")!,
    )!;
  return { ...h, access, sent };
}

const TREE = {
  id: "filter-scope",
  op: "and" as const,
  items: [
    {
      id: "c-status",
      fields: [["data:field:f-status"]],
      op: "oneOf",
      value: ["open"],
    },
    {
      id: "c-name",
      fields: [["data:field:f-name"]],
      op: "contains",
      value: "K",
    },
  ],
};

describe("ADR-320 G6 — the server's candidate values (사용자 결정 9)", () => {
  it("a `facets` endpoint is asked `{ where (the edited condition left out), facet }`; its values come back", async () => {
    const h = await remoteBar(true);
    act(() => void h.access().write(TREE as never));
    await settle();
    const facet = h.access().facet("c-status", ["data:field:f-status"]);
    expect(facet?.partial).toBe(true);
    expect(facet?.server).toBeTypeOf("function");
    const before = h.sent.length;
    const page = await facet!.server!(
      { search: "o" },
      new AbortController().signal,
    );
    expect(page).toEqual({
      values: [
        { value: "open", count: 7 },
        { value: "closed", count: 3 },
      ],
      cursor: "p2",
    });
    const request = h.sent.slice(before);
    expect(request).toHaveLength(1);
    // (Only the name condition: the status one is the one being edited. No page · sort · total.)
    expect(request[0]!.body).toEqual({
      where: {
        op: "and",
        items: [{ fields: ["name"], op: "contains", value: "K" }],
      },
      facet: { field: "status", search: "o" },
    });
    await facet!.server!({ cursor: "p2" }, new AbortController().signal);
    expect(h.sent.at(-1)!.body).toMatchObject({
      facet: { field: "status", cursor: "p2" },
    });
  });

  it("an endpoint that does not say `facets` is never asked — the loaded rows' values stand", async () => {
    const h = await remoteBar(false);
    act(() => void h.access().write(TREE as never));
    await settle();
    const facet = h.access().facet("c-status", ["data:field:f-status"]);
    expect(facet?.partial).toBe(true);
    expect(facet?.server).toBeUndefined();
    expect(h.sent.some((item) => item.body?.facet)).toBe(false);
  });
});

describe("ADR-320 G6 — the value editor reads the server's values", () => {
  function open(server: CatalogTableFacet["server"]) {
    const facet: CatalogTableFacet = {
      values: [{ value: "loaded-only", count: 1 }],
      partial: true,
      loaded: 1,
      server,
    };
    return render(
      <CatalogColumnFilterDialog
        access={{
          read: () =>
            ({
              kind: "string",
              ops: ["oneOf", "equals"],
              condition: { op: "oneOf", value: [] },
              facet,
            }) as never,
          write: () => {},
        }}
        onClose={() => {}}
      />,
    );
  }
  const options = () =>
    [...document.querySelectorAll('[role="option"]')].map(
      (item) => item.querySelector('[slot="label"]')?.textContent,
    );

  it("the first page at once, a typed search after 250 ms (the one before it aborted), the next page appended", async () => {
    const calls: { search?: string; cursor?: string; signal: AbortSignal }[] =
      [];
    const server: CatalogTableFacet["server"] = async (request, signal) => {
      calls.push({ ...request, signal });
      if (request.cursor) return { values: [{ value: "c", count: 1 }] };
      return request.search
        ? { values: [{ value: `${request.search}!`, count: 2 }] }
        : {
            values: [
              { value: "a", count: 5 },
              { value: "b", count: 3 },
            ],
            cursor: "next",
          };
    };
    const view = open(server);
    await waitFor(() => expect(options()).toEqual(["a", "b"]));
    // (The loaded rows' value is not a candidate — the server's are.)
    expect(view.container.textContent).not.toContain("loaded-only");
    expect(document.body.textContent).not.toContain("Values of the 1 loaded");
    expect(calls).toHaveLength(1);
    expect(calls[0]!.search).toBeUndefined();
    const search = [...document.querySelectorAll("input")].find(
      (input) => input.type === "search",
    )!;
    vi.useFakeTimers();
    act(() => void fireEvent.change(search, { target: { value: "x" } }));
    act(() => void fireEvent.change(search, { target: { value: "xy" } }));
    act(() => void vi.advanceTimersByTime(249));
    expect(calls).toHaveLength(1);
    act(() => void vi.advanceTimersByTime(1));
    vi.useRealTimers();
    await waitFor(() => expect(options()).toEqual(["xy!"]));
    expect(calls.map((call) => call.search)).toEqual([undefined, "xy"]);
    view.unmount();
  });

  it("the list's end asks for the next page and appends it", async () => {
    const observed: ((entries: IntersectionObserverEntry[]) => void)[] = [];
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(report: (entries: IntersectionObserverEntry[]) => void) {
          observed.push(report);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      },
    );
    let more = 0;
    const server: CatalogTableFacet["server"] = async (request) => {
      if (request.cursor) {
        more += 1;
        return { values: [{ value: "c", count: 1 }] };
      }
      return {
        values: [
          { value: "a", count: 5 },
          { value: "b", count: 3 },
        ],
        cursor: "next",
      };
    };
    const view = open(server);
    await waitFor(() => expect(options()).toEqual(["a", "b"]));
    // (jsdom has no layout: RAC's sentinel asks when its IntersectionObserver reports it in view.)
    await waitFor(() => expect(observed.length).toBeGreaterThan(0));
    act(() => {
      for (const report of observed)
        report([{ isIntersecting: true } as IntersectionObserverEntry]);
    });
    await waitFor(() => expect(options()).toEqual(["a", "b", "c"]));
    expect(more).toBe(1);
    view.unmount();
  });

  it("a failed read says so", async () => {
    const view = open(async () => {
      throw new Error("down");
    });
    await waitFor(() =>
      expect(document.body.textContent).toContain("Couldn't load the values"),
    );
    view.unmount();
  });
});

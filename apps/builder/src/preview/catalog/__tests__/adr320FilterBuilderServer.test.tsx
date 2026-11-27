import { act, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { setFilterBarTargets } from "../../../../../../packages/shared/src/catalog/commands/filterBar";
import { catalogFilterGroupsTaken } from "../../../../../../packages/shared/src/catalog/runtime/filterTreeEdit";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-320 G4 — 「a scope the server cannot take groups for shows no group feature」 (§5.3): a bar
 * over a paged remote list. A `suffix` endpoint carries no 「or」 — the builder offers no 「Add group」
 * (the scope's own judgment — `catalogFilterGroupsTaken` over `access.takes`); a `body` endpoint on POST carries it — it does.
 */
afterEach(() => vi.restoreAllMocks());

const settle = () =>
  act(async () => {
    for (let i = 0; i < 12; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

async function remoteBar(endpoint: Record<string, unknown>) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  // (Pages of one row and a next cursor — a paged list.)
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          items: [{ id: "k1", name: "Kim", status: "open" }],
          next: "1",
          total: 2,
        }),
        { headers: { "content-type": "application/json" } },
      ),
  );
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
            { id: "f-day", key: "day", type: "date" },
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
          baseUrl: "https://api.example.test",
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
  const groups = () =>
    catalogFilterGroupsTaken(
      access().fields(),
      access().tree(),
      access().takes,
    );
  return { ...h, bar, access, groups };
}

const builderButtons = async (h: Awaited<ReturnType<typeof remoteBar>>) => {
  await waitFor(
    () =>
      expect(
        h.element(h.bar)!.querySelector("button[aria-haspopup]"),
      ).toBeTruthy(),
    { timeout: 5000 },
  );
  const edit = [...h.element(h.bar)!.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === "Edit conditions",
  )!;
  act(() => {
    fireEvent.click(edit);
  });
  await settle();
  await waitFor(
    () => expect(document.querySelector('[role="dialog"]')).toBeTruthy(),
    { timeout: 5000 },
  );
  await waitFor(
    () =>
      expect(
        [...document.querySelectorAll('[role="dialog"] button')].some(
          (button) => button.textContent?.trim() === "Add condition",
        ),
      ).toBe(true),
    { timeout: 5000 },
  );
  return [...document.querySelectorAll('[role="dialog"] button')].map(
    (button) => button.textContent?.trim(),
  );
};

describe("ADR-320 G4 — group features follow what the server takes", () => {
  it("a paged `suffix` scope takes no group: no 「Add group」", async () => {
    const h = await remoteBar({
      method: "GET",
      querySerialization: { kind: "suffix" },
    });
    expect(h.access().fields().length).toBeGreaterThan(0);
    expect(h.groups()).toBe(false);
    expect(await builderButtons(h)).not.toContain("Add group");
  });

  it("a paged `body` scope on POST takes groups: 「Add group」", async () => {
    const h = await remoteBar({
      method: "POST",
      querySerialization: { kind: "body" },
    });
    expect(h.groups()).toBe(true);
    expect(await builderButtons(h)).toContain("Add group");
  });
});

describe("ADR-320 Phase 5 — a relative date is its days in the request (사용자 결정 7)", () => {
  afterEach(() => vi.useRealTimers());

  it("a `body` request carries 「this week」 as its first and last day, never the token", async () => {
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 10, 27, 12) });
    const h = await remoteBar({
      method: "POST",
      querySerialization: { kind: "body" },
    });
    const fetch = vi.mocked(globalThis.fetch);
    fetch.mockClear();
    act(() => {
      h.session.tables.scopes.assign(h.bar, {
        id: "filter-scope",
        op: "and",
        items: [
          {
            id: "c-day",
            fields: [["data:field:f-day"]],
            op: "equals",
            value: "@thisWeek",
          },
        ],
      });
    });
    await settle();
    await settle();
    // (The scope keeps the token — the chips · the address · the memory stay 「this week」.)
    expect(h.access().tree()?.items[0]).toMatchObject({ value: "@thisWeek" });
    const bodies = fetch.mock.calls.map(([, init]) => String(init?.body ?? ""));
    const sent = bodies.find((body) => body.includes("2026-11"));
    expect(sent).toBeDefined();
    // (No locale set — the week starts on Monday: 2026-11-23 … 2026-11-29.)
    expect(sent).toContain("2026-11-23");
    expect(sent).toContain("2026-11-29");
    expect(bodies.some((body) => body.includes("@thisWeek"))).toBe(false);
  });
});

it("suffix · 기존 등식 칩을 다시 열고 그대로 적용해도 키와 값이 유지된다", async () => {
  const h = await remoteBar({
    method: "GET",
    querySerialization: { kind: "suffix" },
  });
  const condition = {
    id: "status-rule",
    fields: [["data:field:f-status" as const]],
    op: "equals" as const,
    value: "open",
  };
  act(() =>
    h.access().write({ id: "filter-scope", op: "and", items: [condition] }),
  );
  await settle();
  const button = [...h.element(h.bar)!.querySelectorAll("button")].find(
    (button) => button.textContent?.trim() === "open",
  );
  expect(button).toBeDefined();
  fireEvent.click(button!);
  const dialog = await waitFor(() => {
    const dialog = document.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog?.querySelector("input")?.value).toBe("open");
    return dialog!;
  });
  fireEvent.click(
    [...dialog.querySelectorAll("button")].find(
      (button) => button.textContent === "Apply",
    )!,
  );
  await settle();
  expect(h.access().tree()?.items).toEqual([condition]);
  const field = h
    .access()
    .fields()
    .find((field) => field.path[0] === "data:field:f-status");
  expect(field?.ops).not.toContain("equals");
});

it("body · 상대 기간의 날짜 후보 요청은 편집 중인 기간 전체를 제외한다", async () => {
  const h = await remoteBar({
    method: "POST",
    querySerialization: { kind: "body", facets: true },
  });
  act(() =>
    h.access().write({
      id: "filter-scope",
      op: "and",
      items: [
        {
          id: "name",
          fields: [["data:field:f-name"]],
          op: "contains",
          value: "K",
        },
        {
          id: "day",
          fields: [["data:field:f-day"]],
          op: "notEquals",
          value: "@thisWeek",
        },
      ],
    }),
  );
  await settle();
  expect(h.access().tree()?.items).toHaveLength(2);
  const server = h.access().facet("day", ["data:field:f-day"])?.server;
  expect(server).toBeDefined();
  const items = [
    { value: "2026-11-19", count: 1 },
    { value: "2026-11-25", count: 1 },
  ];
  const fetchMock = vi.mocked(fetch);
  const loadRows = fetchMock.getMockImplementation()!;
  let request: unknown;
  fetchMock.mockImplementation(async (input, init) => {
    const body = init?.body && JSON.parse(String(init.body));
    if (!body?.facet) return loadRows(input, init);
    request = body;
    return Response.json({ items });
  });
  const page = await server!({}, new AbortController().signal);
  expect(request).toEqual({
    where: {
      op: "and",
      items: [{ fields: ["name"], op: "contains", value: "K" }],
    },
    facet: { field: "day" },
  });
  expect(page.values).toEqual(items);
});

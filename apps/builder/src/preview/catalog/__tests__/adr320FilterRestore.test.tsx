import { act, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  NodeId,
  ViewConditionGroup,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { setFilterBarTargets } from "../../../../../../packages/shared/src/catalog/commands/filterBar";
import {
  catalogFilterAddressKey,
  catalogFilterTreeAddress,
  catalogFilterTreeFromAddress,
  catalogPathQuery,
} from "../../../../../../packages/shared/src/catalog/runtime/filterAddress";
import { CATALOG_FILTER_SCOPE_STORAGE_PREFIX } from "../../../../../../packages/shared/src/catalog/runtime/filterScopeSession";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-320 Phase 5 (G5) — a scope's tree from outside the session: the address (사용자 결정 5), the
 * browser's memory (결정 4 — 「Remember filters」), a named set (결정 6) and the authored start. Each
 * is the tree as found, judged by the scope's one assignment: a root item with a field the rows do
 * not have is left out whole and counted (§5.8 — round 3 반례). Read order: address → memory → start.
 * Expected rows are written by hand from the fixture.
 *
 * Fixture — u1 … u6: type A A B B C C, status male female male female male female.
 */
afterEach(() => vi.restoreAllMocks());

const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

const ROWS = ["A", "A", "B", "B", "C", "C"].map((type, index) => ({
  id: `u${index + 1}`,
  name: `User ${index + 1}`,
  type,
  status: index % 2 === 0 ? "male" : "female",
}));
const USERS = {
  id: "users",
  name: "Users",
  schema: [
    { id: "f-id", key: "id", type: "string" },
    { id: "f-name", key: "name", type: "string" },
    { id: "f-type", key: "type", type: "string" },
    { id: "f-status", key: "status", type: "string" },
  ],
  mockData: ROWS,
  runtimeData: [],
  useMockData: true,
};
const tree = (
  ...items: ViewConditionGroup["items"][number][]
): ViewConditionGroup => ({ id: "filter-scope", op: "and", items });
const TYPE_AB: ViewConditionGroup["items"][number] = {
  id: "c1",
  fields: [["data:field:f-type" as never]],
  op: "oneOf",
  value: ["A", "B"],
};
/** Round 3 반례 — `(지워진 지역 = 서울 또는 상태 = male)`: `f-region` is no field of Users. */
const GONE_OR_MALE: ViewConditionGroup["items"][number] = {
  id: "g1",
  op: "or",
  items: [
    {
      id: "c-region",
      fields: [["data:field:f-region" as never]],
      op: "equals",
      value: "서울",
    },
    {
      id: "c-status",
      fields: [["data:field:f-status" as never]],
      op: "equals",
      value: "male",
    },
  ],
};
const BAR = "project:node:filterbar-0";
const ALL = ["User 1", "User 2", "User 3", "User 4", "User 5", "User 6"];

function memory(initial: Record<string, string> = {}) {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

async function scope(
  options: {
    storage?: ReturnType<typeof memory>;
    address?: boolean;
    /** The address the app opens at (before the bar is connected — a link followed). */
    path?: string;
    props?: Record<string, unknown>;
    /** The list the bar filters (default a ListBox). */
    list?: "ListBox" | "Table";
  } = {},
) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(["FilterBar", options.list ?? "ListBox"], {
    ...(options.storage ? { tableStateStorage: options.storage } : {}),
    ...(options.address ? { addressFilters: true } : {}),
  });
  const [bar, list] = h.ids as [NodeId, NodeId];
  expect(bar).toBe(BAR);
  if (options.path) act(() => void h.session.navigateTo(options.path!));
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [USERS],
      variables: [],
      apiEndpoints: [],
    } as never);
  });
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
  // (The authored values first, then the connection — the scope starts once, from them.)
  if (options.props) h.declare(bar, options.props as never);
  h.workspace.execute(setFilterBarTargets(bar, [list]));
  h.flush();
  await settle();
  await waitFor(
    () =>
      expect(
        h.element(bar)?.querySelector("button[aria-haspopup]"),
      ).toBeTruthy(),
    { timeout: 5000 },
  );
  const scopes = h.session.tables.scopes;
  return {
    ...h,
    bar,
    scopes,
    options: () =>
      [
        ...(h
          .element(list)
          ?.querySelectorAll(
            options.list === "Table" ? '[role="row"]' : '[role="option"]',
          ) ?? []),
      ].flatMap((item) => /User \d/.exec(item.textContent ?? "")?.[0] ?? []),
    refusedText: () =>
      h.element(bar)?.querySelector(".filter-bar-refused")?.textContent ?? "",
    write: async (value: unknown) => {
      act(() => void scopes.assign(bar, value));
      await settle();
    },
  };
}

const addressed = (value: ViewConditionGroup) =>
  `/?${catalogFilterAddressKey(BAR)}=${catalogFilterTreeAddress(value)}`;

describe("ADR-320 Phase 5 — the address form", () => {
  it("a tree goes into the address and comes back as the same shape", () => {
    const value = tree(TYPE_AB, GONE_OR_MALE);
    const text = catalogFilterTreeAddress(value);
    expect(text).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(catalogFilterTreeFromAddress(text)).toEqual(value);
    expect(catalogFilterTreeAddress(null)).toBe("");
    expect(catalogFilterTreeFromAddress("")).toBeNull();
    expect(catalogFilterTreeFromAddress("%%%")).toBeUndefined();
    expect(catalogFilterAddressKey(BAR)).toBe("f.filterbar-0");
  });
});

describe("ADR-320 Phase 5 (G5) — a tree from outside the session", () => {
  it("the address: the tree it names filters the lists, a change writes it, the start takes it out", async () => {
    const h = await scope({
      address: true,
      path: addressed(tree(TYPE_AB)),
    });
    expect(h.options()).toEqual(["User 1", "User 2", "User 3", "User 4"]);
    const status = {
      id: "c2",
      fields: [["data:field:f-status" as never]],
      op: "equals" as const,
      value: "female",
    };
    await h.write(tree(TYPE_AB, status));
    expect(h.options()).toEqual(["User 2", "User 4"]);
    expect(
      catalogFilterTreeFromAddress(
        catalogPathQuery(h.session.path!, catalogFilterAddressKey(BAR))!,
      ),
    ).toEqual(tree(TYPE_AB, status));
    // (The start — no condition here — is nothing in the address.)
    await h.write(null);
    expect(h.session.path).toBe("/");
  });

  it("a link followed again (the browser's back) assigns the tree it names", async () => {
    const h = await scope({ address: true });
    expect(h.options()).toEqual(ALL);
    act(() => void h.session.navigateTo(addressed(tree(TYPE_AB))));
    await settle();
    expect(h.options()).toEqual(["User 1", "User 2", "User 3", "User 4"]);
  });

  it("the Builder's Preview has no address: a write leaves the path as it is", async () => {
    const h = await scope();
    await h.write(tree(TYPE_AB));
    expect(h.session.path).toBe("/");
  });

  it("memory: 「Remember filters」 keeps the tree in the browser and a new session starts from it", async () => {
    const storage = memory();
    const first = await scope({
      storage,
      props: { rememberFilters: true },
    });
    await first.write(tree(TYPE_AB));
    const key = `${CATALOG_FILTER_SCOPE_STORAGE_PREFIX}project:project:adr280`;
    expect(JSON.parse(storage.items.get(key)!)).toEqual({
      [BAR]: tree(TYPE_AB),
    });
    first.view.unmount();
    const second = await scope({
      storage,
      props: { rememberFilters: true },
    });
    expect(second.options()).toEqual(["User 1", "User 2", "User 3", "User 4"]);
    // (Back at the start: nothing is kept.)
    await second.write(null);
    expect(storage.items.has(key)).toBe(false);
  });

  it("memory: without the switch nothing is kept, and a kept tree is not read", async () => {
    const key = `${CATALOG_FILTER_SCOPE_STORAGE_PREFIX}project:project:adr280`;
    const storage = memory({ [key]: JSON.stringify({ [BAR]: tree(TYPE_AB) }) });
    const h = await scope({ storage });
    expect(h.options()).toEqual(ALL);
    await h.write(tree({ ...TYPE_AB, value: ["C"] }));
    expect(JSON.parse(storage.items.get(key)!)).toEqual({
      [BAR]: tree(TYPE_AB),
    });
  });

  it("a kept tree goes into the address — also after the app's own path on open (live 2026-11-27)", async () => {
    const key = `${CATALOG_FILTER_SCOPE_STORAGE_PREFIX}project:project:adr280`;
    const storage = memory({ [key]: JSON.stringify({ [BAR]: tree(TYPE_AB) }) });
    const h = await scope({
      storage,
      address: true,
      props: { rememberFilters: true },
    });
    expect(h.options()).toEqual(["User 1", "User 2", "User 3", "User 4"]);
    // (Publish routes its own hash on open — the path without the query.)
    act(() => void h.session.navigateTo("/"));
    await settle();
    expect(
      catalogFilterTreeFromAddress(
        catalogPathQuery(h.session.path!, catalogFilterAddressKey(BAR)) ?? "-",
      ),
    ).toEqual(tree(TYPE_AB));
  });

  it("the address comes before the memory", async () => {
    const key = `${CATALOG_FILTER_SCOPE_STORAGE_PREFIX}project:project:adr280`;
    const storage = memory({
      [key]: JSON.stringify({ [BAR]: tree({ ...TYPE_AB, value: ["C"] }) }),
    });
    const h = await scope({
      storage,
      address: true,
      path: addressed(tree(TYPE_AB)),
      props: { rememberFilters: true },
    });
    expect(h.options()).toEqual(["User 1", "User 2", "User 3", "User 4"]);
  });

  it("a named set: 「Saved filters」 lists the author's sets and one picked is the scope's tree", async () => {
    const h = await scope({
      props: {
        presets: [
          { id: "p1", name: "Types A · B", query: tree(TYPE_AB) },
          { id: "p2", name: "Gone or male", query: tree(GONE_OR_MALE) },
        ],
      },
    });
    const button = [...h.element(h.bar)!.querySelectorAll("button")].find(
      (item) => item.textContent?.trim() === "Saved filters",
    )!;
    expect(button).toBeTruthy();
    act(() => void fireEvent.click(button));
    await settle();
    const item = await waitFor(() => {
      const found = [...document.querySelectorAll('[role="menuitem"]')].find(
        (entry) => entry.textContent === "Types A · B",
      );
      expect(found).toBeTruthy();
      return found!;
    });
    act(() => void fireEvent.click(item));
    await settle();
    expect(h.options()).toEqual(["User 1", "User 2", "User 3", "User 4"]);
  });

  it("no named set: no 「Saved filters」", async () => {
    const h = await scope();
    expect(
      [...h.element(h.bar)!.querySelectorAll("button")].some(
        (item) => item.textContent?.trim() === "Saved filters",
      ),
    ).toBe(false);
  });

  // (G5 — the round 3 반례 by every way in: the group is left out whole, never its one condition.)
  const goneTree = tree(GONE_OR_MALE);
  const ways: [string, () => ReturnType<typeof scope>][] = [
    ["the address", () => scope({ address: true, path: addressed(goneTree) })],
    [
      "the memory",
      () =>
        scope({
          storage: memory({
            [`${CATALOG_FILTER_SCOPE_STORAGE_PREFIX}project:project:adr280`]:
              JSON.stringify({ [BAR]: goneTree }),
          }),
          props: { rememberFilters: true },
        }),
    ],
    [
      "a named set",
      async () => {
        const h = await scope({
          props: { presets: [{ id: "p", name: "Gone", query: goneTree }] },
        });
        await h.write(goneTree);
        return h;
      },
    ],
    ["the start", () => scope({ props: { defaultQuery: goneTree } })],
  ];
  for (const [way, open] of ways)
    it(`a deleted field's group by ${way}: left out whole, both statuses, 「1」 not applied`, async () => {
      const h = await open();
      // (Only the region's condition taken out would leave 「status = male」 — User 1 · 3 · 5.)
      expect(h.options()).toEqual(ALL);
      expect(h.scopes.refusedOf(h.bar)).toBe(1);
      expect(h.scopes.tree(h.bar)).toBeUndefined();
      expect(h.refusedText()).toContain("1");
    });
});

describe("ADR-320 Phase 5 — a relative date over local rows (사용자 결정 7)", () => {
  afterEach(() => vi.useRealTimers());

  it("「this week」 keeps the rows of the viewer's week and its chip says so", async () => {
    // (Friday 2026-11-27; no locale set — the week starts on Monday: 11-23 … 11-29.)
    vi.useFakeTimers({ toFake: ["Date"], now: new Date(2026, 10, 27, 12) });
    const days = [
      "2026-11-22",
      "2026-11-23",
      "2026-11-26",
      "2026-11-29",
      "2026-11-30",
      "2026-10-27",
    ];
    ROWS.forEach((row, index) => Object.assign(row, { day: days[index] }));
    USERS.schema.push({ id: "f-day", key: "day", type: "date" });
    try {
      const h = await scope({
        props: {
          defaultQuery: tree({
            id: "c-day",
            fields: [["data:field:f-day" as never]],
            op: "equals",
            value: "@thisWeek",
          }),
        },
      });
      expect(h.options()).toEqual(["User 2", "User 3", "User 4"]);
      // (A Table reads its rows through its state too — the root's own reading: the same days.
      //  Live 2026-11-27: a Table gave no row while the ListBox was right.)
      const table = await scope({
        list: "Table",
        props: {
          defaultQuery: tree({
            id: "c-day",
            fields: [["data:field:f-day" as never]],
            op: "equals",
            value: "@thisWeek",
          }),
        },
      });
      expect(table.options()).toEqual(["User 2", "User 3", "User 4"]);
      const chip = h.element(h.bar)?.querySelector('[role="group"]');
      expect(chip?.getAttribute("aria-label")).toContain("This week");
    } finally {
      USERS.schema.pop();
      ROWS.forEach((row) => delete (row as { day?: string }).day);
    }
  });
});

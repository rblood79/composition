import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DataCollectionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogTableColumnKey } from "../../../../../../packages/shared/src/catalog/runtime/tableSort";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * `useAsyncList({ load({signal, cursor, filterText, sortDescriptor}) })` — the load's arguments
 * are the query endpoint's templates (`{{ cursor }}` · `{{ filterText }}` ·
 * `{{ sortDescriptor.column }}` · `{{ sortDescriptor.direction }}` — empty ones are left out of the
 * query), the next cursor is read from the response (`responseMapping.cursorPath` — a URL cursor is
 * fetched as is). `loadMore` appends the next page, `setFilterText` loads again with the text, a
 * bound Table's sort loads again sorted by the server (the client keeps its order). Measurement:
 * jsdom + a `fetch` stub that pages, filters and sorts.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const USERS = "data:collection:users" as DataCollectionId;
const ROWS = [
  { id: "u1", name: "Kim" },
  { id: "u2", name: "Park" },
  { id: "u3", name: "Lee" },
];

const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

/** Pages of 2 (`?page=`), `?q=` filters by name, `?sort=name&dir=` — rows in the asked order. */
function stubServer(urlCursor = false) {
  const urls: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input));
    urls.push(`${url.pathname}${url.search}`);
    const q = url.searchParams.get("q");
    let rows = q ? ROWS.filter((row) => row.name.includes(q)) : [...ROWS];
    if (url.searchParams.get("sort") === "name") {
      rows.sort((a, b) => a.name.localeCompare(b.name));
      if (url.searchParams.get("dir") === "descending") rows.reverse();
    }
    const page = Number(url.searchParams.get("page") ?? 1);
    const items = rows.slice((page - 1) * 2, page * 2);
    const more = page * 2 < rows.length;
    const next = more
      ? urlCursor
        ? `https://api.example.test/users?page=${page + 1}`
        : String(page + 1)
      : null;
    return new Response(JSON.stringify({ items, next }), {
      headers: { "content-type": "application/json" },
    });
  });
  return urls;
}

async function asyncPreview(
  endpoint: { path: string; queryParams?: { key: string; value: string }[] },
  types: readonly string[] = ["ListBox", "Button"],
) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview(types);
  const [collection, button] = h.ids as [NodeId, NodeId];
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
          targetCollection: "Users",
          responseMapping: { dataPath: "items", cursorPath: "next" },
          ...endpoint,
        },
      ],
    });
  });
  h.workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: collection }],
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
      ...(h
        .element(collection)
        ?.querySelectorAll('[role="option"], [role="row"]') ?? []),
    ]
      .map((item) => item.textContent ?? "")
      .filter((text) => /Kim|Park|Lee/.test(text))
      .map((text) => /Kim|Park|Lee/.exec(text)![0]);
  const press = async () => {
    act(() => {
      fireEvent.click(h.element(button)!);
    });
    await settle();
  };
  return { ...h, collection, button, shown, press };
}

describe("useAsyncList — load arguments", () => {
  it("cursor: the first load leaves an empty cursor out; loadMore appends the next page until none is left; reload starts over", async () => {
    const urls = stubServer();
    const h = await asyncPreview({
      path: "/users",
      queryParams: [{ key: "page", value: "{{ cursor }}" }],
    });
    expect(urls).toEqual(["/users"]);
    expect(h.shown()).toEqual(["Kim", "Park"]);
    h.rule(h.button, "onPress", { opcode: "loadMore", collectionId: USERS });
    await h.press();
    expect(urls).toEqual(["/users", "/users?page=2"]);
    expect(h.shown()).toEqual(["Kim", "Park", "Lee"]);
    // (No cursor left: nothing to load.)
    await h.press();
    expect(urls).toHaveLength(2);
    await act(() => h.session.reload("users"));
    expect(urls.at(-1)).toBe("/users");
    expect(h.shown()).toEqual(["Kim", "Park"]);
    h.view.unmount();
  });

  it("a URL cursor is fetched as is (the reference's `fetch(cursor || url)`)", async () => {
    const urls = stubServer(true);
    const h = await asyncPreview({ path: "/users" });
    expect(urls).toEqual(["/users"]);
    h.rule(h.button, "onPress", { opcode: "loadMore", collectionId: USERS });
    await h.press();
    expect(urls).toEqual(["/users", "/users?page=2"]);
    expect(h.shown()).toEqual(["Kim", "Park", "Lee"]);
    h.view.unmount();
  });

  it("filterText: setFilterText loads again with the text (S2 `filtering`), the cursor starts over", async () => {
    const urls = stubServer();
    const h = await asyncPreview({
      path: "/users",
      queryParams: [
        { key: "q", value: "{{ filterText }}" },
        { key: "page", value: "{{ cursor }}" },
      ],
    });
    h.rule(h.button, "onPress", {
      opcode: "setFilterText",
      collectionId: USERS,
      value: "Pa",
    });
    await h.press();
    expect(urls).toEqual(["/users", "/users?q=Pa"]);
    expect(h.shown()).toEqual(["Park"]);
    h.view.unmount();
  });

  it("sortDescriptor: a bound Table's sort loads again sorted by the server, and the client keeps that order", async () => {
    const urls = stubServer();
    const h = await asyncPreview(
      {
        path: "/users",
        queryParams: [
          { key: "sort", value: "{{ sortDescriptor.column }}" },
          { key: "dir", value: "{{ sortDescriptor.direction }}" },
        ],
      },
      ["Table", "Button"],
    );
    expect(urls).toEqual(["/users"]);
    const root = h.session.root!;
    const table = [...root.domInputs.values()].find(
      (record) => record.ruleId === "Table",
    )!;
    const header = table.children
      .map((id) => root.domInputs.get(id))
      .find((record) => record?.ruleId === "TableHeader")!;
    const name = header.children
      .map((id) => root.domInputs.get(id)!)
      .find((record) => record.ruleId === "Column")!;
    act(() => {
      h.session.sortTable(table.id, {
        column: catalogTableColumnKey(name),
        direction: "descending",
      });
    });
    await settle();
    expect(urls).toEqual(["/users", "/users?sort=name&dir=descending"]);
    expect(h.shown()).toEqual(["Park", "Lee"]);
    h.view.unmount();
  });
});

describe("onLoadMore — the end of a bound collection loads the next page (LoadMoreItem)", () => {
  /** jsdom has no IntersectionObserver: the sentinel is seen as soon as it is observed. */
  function seeEverySentinel() {
    const seen = vi.fn();
    vi.stubGlobal(
      "IntersectionObserver",
      class {
        constructor(
          private readonly callback: (
            entries: { isIntersecting: boolean; target: Element }[],
          ) => void,
        ) {}
        observe(target: Element) {
          seen(target);
          queueMicrotask(() =>
            this.callback([{ isIntersecting: true, target }]),
          );
        }
        unobserve() {}
        disconnect() {}
        takeRecords() {
          return [];
        }
      },
    );
    return seen;
  }

  for (const type of ["ListBox", "GridList", "Table"])
    it(`${type}: reaching its end loads the next page until no cursor is left`, async () => {
      const seen = seeEverySentinel();
      const urls = stubServer();
      const h = await asyncPreview(
        {
          path: "/users",
          queryParams: [{ key: "page", value: "{{ cursor }}" }],
        },
        [type, "Button"],
      );
      await settle();
      expect(seen).toHaveBeenCalled();
      expect(urls).toEqual(["/users", "/users?page=2"]);
      expect(h.shown()).toEqual(["Kim", "Park", "Lee"]);
      h.view.unmount();
      vi.unstubAllGlobals();
    });
});

describe("filterText — a ComboBox's input is the server filter (`inputValue={list.filterText}`)", () => {
  it("typing loads again with the text when the endpoint reads {{ filterText }}; the last text wins", async () => {
    const urls = stubServer();
    const h = await asyncPreview(
      {
        path: "/users",
        queryParams: [{ key: "q", value: "{{ filterText }}" }],
      },
      ["ComboBox", "Button"],
    );
    expect(urls).toEqual(["/users"]);
    const input = h.element(h.collection)!.querySelector("input")!;
    act(() => {
      fireEvent.change(input, { target: { value: "P" } });
    });
    act(() => {
      fireEvent.change(input, { target: { value: "Pa" } });
    });
    await settle();
    expect(urls).toEqual(["/users", "/users?q=P", "/users?q=Pa"]);
    expect(
      (h.session.collectionItems("users") as { name: string }[]).map(
        (item) => item.name,
      ),
    ).toEqual(["Park"]);
    h.view.unmount();
  });

  it("an endpoint that does not read {{ filterText }}: typing loads nothing (the list filters itself)", async () => {
    const urls = stubServer();
    const h = await asyncPreview(
      { path: "/users", queryParams: [{ key: "page", value: "{{ cursor }}" }] },
      ["ComboBox", "Button"],
    );
    const input = h.element(h.collection)!.querySelector("input")!;
    act(() => {
      fireEvent.change(input, { target: { value: "Pa" } });
    });
    await settle();
    expect(urls).toEqual(["/users"]);
    h.view.unmount();
  });
});

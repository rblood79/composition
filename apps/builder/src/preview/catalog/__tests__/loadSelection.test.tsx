import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  DataCollectionId,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * `useAsyncList`'s load may return `selectedKeys` beside its items (the reference's `load` result):
 * a load's keys become the list's selection (none returned keeps it), a `loadMore`'s join it. The
 * response holds them at `responseMapping.selectedKeysPath`; the components showing the collection
 * select them (`selectedKeys={list.selectedKeys}` — a picker's `selectedKey` is the first).
 * Measurement: jsdom + a `fetch` stub that pages.
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

/** Pages of 2 (`?page=`); each page says which of its rows are selected (`selected`). */
function stubServer(selected: Record<number, string[] | undefined>) {
  const urls: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input));
    urls.push(`${url.pathname}${url.search}`);
    const page = Number(url.searchParams.get("page") ?? 1);
    const items = ROWS.slice((page - 1) * 2, page * 2);
    const next = page * 2 < ROWS.length ? String(page + 1) : null;
    return new Response(
      JSON.stringify({
        items,
        next,
        ...(selected[page] ? { selected: selected[page] } : {}),
      }),
      { headers: { "content-type": "application/json" } },
    );
  });
  return urls;
}

async function selectionPreview(type: "ListBox" | "Select") {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview([type, "Button"]);
  const [collection, button] = h.ids as [NodeId, NodeId];
  if (type === "ListBox") h.declare(collection, { selectionMode: "multiple" });
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
          path: "/users",
          method: "GET",
          targetCollection: "Users",
          queryParams: [{ key: "page", value: "{{ cursor }}" }],
          responseMapping: {
            dataPath: "items",
            cursorPath: "next",
            selectedKeysPath: "selected",
          },
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
  const selected = () =>
    [
      ...(h
        .element(collection)
        ?.querySelectorAll('[role="option"][aria-selected="true"]') ?? []),
    ].map((option) => /Kim|Park|Lee/.exec(option.textContent ?? "")?.[0]);
  const press = async () => {
    act(() => {
      fireEvent.click(h.element(button)!);
    });
    await settle();
  };
  return { ...h, collection, button, selected, press };
}

describe("useAsyncList load selectedKeys", () => {
  it("a ListBox selects the keys its load returned; loadMore's keys join them", async () => {
    stubServer({ 1: ["u2"], 2: ["u3"] });
    const h = await selectionPreview("ListBox");
    expect(h.selected()).toEqual(["Park"]);
    h.rule(h.button, "onPress", { opcode: "loadMore", collectionId: USERS });
    await h.press();
    expect(h.selected()).toEqual(["Park", "Lee"]);
    h.view.unmount();
  });

  it("a load that returns no keys keeps the selection; one that does replaces it", async () => {
    const urls = stubServer({ 1: undefined });
    const h = await selectionPreview("ListBox");
    expect(h.selected()).toEqual([]);
    h.rule(h.button, "onPress", {
      opcode: "capability",
      targetId: h.collection,
      capabilityId: "selectItem",
      value: "u1",
    } as never);
    await h.press();
    expect(h.selected()).toEqual(["Kim"]);
    await act(() => h.session.reload("users"));
    await settle();
    expect(urls).toHaveLength(2);
    expect(h.selected()).toEqual(["Kim"]);
    vi.restoreAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    stubServer({ 1: ["u2"] });
    await act(() => h.session.reload("users"));
    await settle();
    expect(h.selected()).toEqual(["Park"]);
    h.view.unmount();
  });

  it("a Select's selectedKey is the first key its load returned", async () => {
    stubServer({ 1: ["u2"] });
    const h = await selectionPreview("Select");
    expect(
      h.element(h.collection)?.querySelector(".react-aria-SelectValue")
        ?.textContent,
    ).toContain("Park");
    h.view.unmount();
  });
});

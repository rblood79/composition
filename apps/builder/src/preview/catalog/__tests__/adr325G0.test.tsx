import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-325 — the behaviours the three-layer store changes. G0 reproduced them at `21eb42576` (an
 * edit's mark gone after the next page; a list keyed by another value field found no item); the
 * assertions now state the new behaviour (Phase 1 · 2). Measurement: jsdom + a `fetch` stub that
 * pages by a cursor.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const ROWS = [
  { id: "u1", name: "Kim" },
  { id: "u2", name: "Park" },
  { id: "u3", name: "Lee" },
];

const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

/** Pages of 2 by `?page=` — the next page's number in `next`. */
function stubServer() {
  const urls: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input));
    urls.push(`${url.pathname}${url.search}`);
    const page = Number(url.searchParams.get("page") ?? 1);
    const items = ROWS.slice((page - 1) * 2, page * 2);
    const next = page * 2 < ROWS.length ? String(page + 1) : null;
    return new Response(JSON.stringify({ items, next }), {
      headers: { "content-type": "application/json" },
    });
  });
  return urls;
}

async function storePreview(options: {
  keyField?: string;
  fieldMap?: Record<string, string>;
}) {
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
          id: "users",
          name: "Users",
          schema: [
            { id: "f-id", key: "id", type: "string" },
            { id: "f-name", key: "name", type: "string" },
          ],
          mockData: [],
          runtimeData: [],
          useMockData: false,
          ...(options.keyField ? { keyField: options.keyField } : {}),
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
          queryParams: [{ key: "page", value: "{{ cursor }}" }],
          targetCollection: "Users",
          responseMapping: { dataPath: "items", cursorPath: "next" },
        },
      ],
    });
  });
  h.workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: list }],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "users",
        name: "Users",
        ...(options.fieldMap ? { fieldMap: options.fieldMap } : {}),
      })!,
    ),
  );
  h.flush();
  await settle();
  const optionKeys = () =>
    [...(h.element(list)?.querySelectorAll('[role="option"]') ?? [])].map(
      (option) => option.getAttribute("data-key"),
    );
  return { ...h, list, optionKeys };
}

describe("ADR-325 — what the store changes (G0 reproductions)", () => {
  it("an edit, then the next page: the value and its 「not saved」 mark both stay", async () => {
    const urls = stubServer();
    const h = await storePreview({});
    expect(urls).toEqual(["/users"]);
    act(() => {
      h.session.update("users", "u1", { name: "Kimmy" });
    });
    expect(Object.fromEntries(h.session.editMarks("users") ?? [])).toEqual({
      u1: { status: "dirty", fields: ["name"] },
    });
    await act(() => h.session.loadMore("users"));
    expect(urls).toEqual(["/users", "/users?page=2"]);
    expect(
      (h.session.collectionItems("users") as { name: string }[]).map(
        (row) => row.name,
      ),
    ).toEqual(["Kimmy", "Park", "Lee"]);
    // (G0: the load dropped the edit record and the mark went with it — the change stays now.)
    expect(Object.fromEntries(h.session.editMarks("users") ?? [])).toEqual({
      u1: { status: "dirty", fields: ["name"] },
    });
    expect(h.session.unsavedCount("users")).toBe(1);
    h.view.unmount();
  });

  it("a list keyed by a value field other than the collection's key field: the session finds the item by the list's key (R2)", async () => {
    stubServer();
    const h = await storePreview({
      keyField: "f-id",
      fieldMap: { value: "f-name" },
    });
    // (The bound list keys its items by the binding's value field — `getItemKey`.)
    expect(h.optionKeys()).toEqual(["Kim", "Park"]);
    // (G0: the session keyed it by the collection's key field only — 「항목 없음: Kim」.)
    expect(h.session.itemsByKeys("users", ["Kim"])).toEqual([ROWS[0]]);
    expect(h.session.itemsByKeys("users", ["u1"])).toEqual([ROWS[0]]);
    let result: { ok: boolean; reason?: string } | undefined;
    act(() => {
      result = h.session.update("users", "Kim", { name: "Kimmy" });
    });
    expect(result).toMatchObject({ ok: true });
    expect(h.session.itemsByKeys("users", ["u1"])).toEqual([
      { id: "u1", name: "Kimmy" },
    ]);
    h.view.unmount();
  });
});

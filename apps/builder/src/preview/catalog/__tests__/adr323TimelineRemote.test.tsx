import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-323 Phase 2 수리 검증 — a bound Timeline over a remote collection (`/users`):
 *  - every page reaches it (an `ol` has no RAC load-more sentinel, so the session loads the pages
 *    as it does for a view that runs here — `loadsWhole` → `loadAll`, up to the local cap);
 *  - a row with a `parentId` it already got stays (a Cascader's level-by-level read is Cascader's
 *    own — a Timeline drawing every row is not a hierarchy).
 */
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

async function boundTimeline(
  endpoint: Record<string, unknown>,
  answer: (url: URL) => unknown,
) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const urls: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input));
    urls.push(`${url.pathname}${url.search}`);
    return new Response(JSON.stringify(answer(url)), {
      headers: { "content-type": "application/json" },
    });
  });
  const h = await openAdr280Preview(["Timeline"]);
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
            { id: "f-parent", key: "parentId", type: "string" },
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
          ...endpoint,
        },
      ],
    });
  });
  const id = h.ids[0] as NodeId;
  h.workspace.execute(
    catalogBindingCommand([{ kind: "node", id }], {
      ...catalogBindingRef({
        source: "dataTable",
        collectionId: "users",
        name: "Users",
      })!,
      fieldMap: { title: "data:field:f-name" },
    } as never),
  );
  h.flush();
  await settle();
  const titles = () =>
    [...(h.element(id)?.querySelectorAll("li") ?? [])].map(
      (item) => /Alpha|Beta|Gamma/.exec(item.textContent ?? "")?.[0],
    );
  return { ...h, urls, titles };
}

describe("ADR-323 — a bound Timeline over a remote collection", () => {
  it("reads the next page by its cursor — every row is drawn", async () => {
    const h = await boundTimeline(
      {
        queryParams: [{ key: "page", value: "{{ cursor }}" }],
        responseMapping: { dataPath: "items", cursorPath: "next" },
      },
      (url) =>
        url.searchParams.get("page") === "2"
          ? { items: [{ id: "c", name: "Gamma" }], next: null }
          : {
              items: [
                { id: "a", name: "Alpha" },
                { id: "b", name: "Beta" },
              ],
              next: "2",
            },
    );
    expect(h.urls).toEqual(["/users", "/users?page=2"]);
    expect(h.titles()).toEqual(["Alpha", "Beta", "Gamma"]);
    h.view.unmount();
  });

  it("keeps a loaded row with a parentId — a Cascader's level read is not a Timeline's", async () => {
    const h = await boundTimeline(
      {
        queryParams: [{ key: "parent", value: "{{ parentKey }}" }],
        responseMapping: { dataPath: "items", keysUnique: true },
      },
      () => ({
        items: [
          { id: "a", name: "Alpha" },
          { id: "b", name: "Beta", parentId: "a" },
        ],
      }),
    );
    expect(h.titles()).toEqual(["Alpha", "Beta"]);
    h.view.unmount();
  });
});

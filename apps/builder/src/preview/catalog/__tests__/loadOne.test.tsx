import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CatalogLibrary,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { createPage } from "../../../../../../packages/shared/src/catalog/commands";
import { buildEndpointRequest } from "../../../../../../packages/shared/src/collections/executeCollectionEndpoint";
import { catalogPaletteDefinitionId } from "../../../builder/catalogRuntime/paletteInsert";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * One item from the server (`useAsyncList({ load })` whose `load` fetches `/users/${id}` — a
 * router loader): a query endpoint's path · query read `{{ params.id }}` (and variables), and the
 * session loads the collection it fills whenever the shown path gives another URL — once per URL.
 * The detail container is keyed to the same id. Measurement: jsdom + a `fetch` stub (`GET
 * /users/:id`).
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const DETAIL = "project:page:detail" as EntryId<"page">;
const id = (name: string) => `project:node:${name}` as NodeId;
const USERS: Record<string, { id: string; name: string }> = {
  u1: { id: "u1", name: "Kim" },
  u2: { id: "u2", name: "Park" },
};

const settle = () =>
  act(async () => {
    for (let i = 0; i < 8; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

function stubServer() {
  const urls: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input));
    urls.push(`${url.pathname}${url.search}`);
    const user = USERS[url.pathname.split("/").pop() ?? ""];
    return user
      ? new Response(JSON.stringify(user), {
          headers: { "content-type": "application/json" },
        })
      : new Response("{}", { status: 404, statusText: "Not Found" });
  });
  return urls;
}

const endpoint = {
  id: "get",
  name: "getUser",
  baseUrl: "https://api.example.test",
  path: "/users/{{ params.id }}",
  method: "GET",
  targetCollection: "UserDetail",
};

async function detailPreview(path = endpoint.path) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const library: CatalogLibrary = await buildCodeCatalogLibrary();
  const h = await openAdr280Preview(["Button"]);
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: [
        {
          id: "detail",
          name: "UserDetail",
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
      apiEndpoints: [{ ...endpoint, path }],
    });
  });
  h.workspace.execute(
    createPage({
      page: {
        kind: "page",
        id: DETAIL,
        route: "/detail/:id",
        name: "Detail",
        children: [id("detail-body")],
      },
      entries: [
        {
          kind: "node",
          id: id("detail-body"),
          definitionId: "lib:definition:type-body" as NodeEntry["definitionId"],
          children: [id("detail-frame")],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
        {
          kind: "node",
          id: id("detail-frame"),
          definitionId: catalogPaletteDefinitionId(library, "frame"),
          children: [id("detail-name")],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
          binding: {
            collectionId: "data:collection:detail",
            fieldMap: {},
            key: "{{ params.id }}",
          } as NodeEntry["binding"],
        },
        {
          kind: "node",
          id: id("detail-name"),
          definitionId: "lib:definition:text" as NodeEntry["definitionId"],
          children: [],
          props: { children: { kind: "set", value: "{name}" } },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
    }),
  );
  h.flush();
  const text = () => h.element(id("detail-name"))?.textContent ?? "";
  return { ...h, text };
}

describe("one item — an endpoint path reads {{ params.id }}", () => {
  it("entering the detail loads that one item; another id loads again; the same URL does not", async () => {
    const urls = stubServer();
    const h = await detailPreview();
    await settle();
    // (Home has no `:id` — nothing to load.)
    expect(urls).toEqual([]);
    act(() => {
      h.session.navigateTo("/detail/u2");
    });
    await settle();
    expect(urls).toEqual(["/users/u2"]);
    expect(h.text()).toBe("Park");
    act(() => {
      h.session.navigateTo("/detail/u1");
    });
    await settle();
    expect(urls).toEqual(["/users/u2", "/users/u1"]);
    expect(h.text()).toBe("Kim");
    act(() => {
      h.session.navigate("project:page:home" as EntryId<"page">);
    });
    act(() => {
      h.session.navigateTo("/detail/u1");
    });
    await settle();
    expect(urls).toEqual(["/users/u2", "/users/u1"]);
    expect(h.text()).toBe("Kim");
    h.view.unmount();
  });

  it("a query param reads the template too; a reload runs the resolved URL", async () => {
    const urls = stubServer();
    const h = await detailPreview(
      "/users/{{ params.id }}?expand={{ params.id }}",
    );
    act(() => {
      h.session.navigateTo("/detail/u2");
    });
    await settle();
    expect(urls).toEqual(["/users/u2?expand=u2"]);
    await act(() => h.session.reload("detail"));
    expect(urls).toEqual(["/users/u2?expand=u2", "/users/u2?expand=u2"]);
    h.view.unmount();
  });

  it("an id the server does not have: an empty item, reported", async () => {
    stubServer();
    const h = await detailPreview();
    act(() => {
      h.session.navigateTo("/detail/u9");
    });
    await settle();
    expect(h.text()).toBe("");
    expect(
      (console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls
        .map((call) => String(call[0]))
        .filter((message) => message.startsWith("[CatalogPreview]")),
    ).toHaveLength(1);
    h.view.unmount();
  });

  it("outside the Preview (no route) an unresolved template is refused, not sent", () => {
    expect(() =>
      buildEndpointRequest(endpoint, new AbortController().signal),
    ).toThrow(/params\.id/);
  });
});

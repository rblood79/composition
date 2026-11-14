import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { setFields } from "../../../../../../packages/shared/src/catalog/commands";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-310 G1 — Decision 10 「더 보기」: a bound list past one display window (100 rows) reaches its
 * last row in the Preview DOM. Before, the session projected `[0, 100)` every time: a 250-row mock
 * list had no end at all, and the 101st row a page brought stayed in the session only (F14).
 */
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 20; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

/** jsdom has no IntersectionObserver: every sentinel is seen as soon as it is observed. */
function seeEverySentinel() {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(
        private readonly callback: (
          entries: { isIntersecting: boolean; target: Element }[],
        ) => void,
      ) {}
      observe(target: Element) {
        queueMicrotask(() => this.callback([{ isIntersecting: true, target }]));
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    },
  );
}

const person = (index: number) => ({
  id: `p${index}`,
  name: `Person${index}`,
});

async function boundList(
  type: string,
  collection: Record<string, unknown>,
  apiEndpoints: unknown[] = [],
) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const h = await openAdr280Preview([type]);
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
          ...collection,
        },
      ],
      variables: [],
      apiEndpoints,
    });
  });
  const id = h.ids[0] as NodeId;
  h.workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id }],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "users",
        name: "Users",
      })!,
    ),
  );
  h.flush();
  await settle();
  const names = () =>
    [
      ...(h
        .element(id)
        ?.querySelectorAll(
          '[role="option"], [role="row"], [role="menuitem"]',
        ) ?? []),
    ]
      .map((item) => /Person\d+/.exec(item.textContent ?? "")?.[0])
      .filter(Boolean);
  return { ...h, id, names };
}

describe("ADR-310 G1 — 「더 보기」 reaches the last row", () => {
  it.each(["ListBox", "GridList"])(
    "%s: a 250-row mock list shows its last row once its end is seen",
    async (type) => {
      seeEverySentinel();
      const h = await boundList(type, {
        mockData: Array.from({ length: 250 }, (_, index) => person(index + 1)),
        useMockData: true,
      });
      await settle();
      const names = h.names();
      expect(names).toHaveLength(250);
      expect(names.at(-1)).toBe("Person250");
      h.view.unmount();
    },
  );

  // (A bound Table's rows are synthesized — a fixed-height Table shows the rows its height holds,
  // the Preview too; ADR-310 Phase 4 replaces that path with the Row template.)
  it.each(["CardView"])(
    "%s: a 250-row mock list shows its last row once its end is seen",
    async (type) => {
      seeEverySentinel();
      const h = await boundList(type, {
        mockData: Array.from({ length: 250 }, (_, index) => person(index + 1)),
        useMockData: true,
      });
      await settle();
      const text = h.element(h.id)?.textContent ?? "";
      expect(text).toContain("Person250");
      h.view.unmount();
    },
  );

  it("a ListBox with a set height (not sampled) reaches its last row too", async () => {
    seeEverySentinel();
    const h = await boundList("ListBox", {
      mockData: Array.from({ length: 250 }, (_, index) => person(index + 1)),
      useMockData: true,
    });
    h.workspace.execute(
      setFields({
        targets: [{ kind: "node", id: h.id }],
        sizing: { height: { kind: "set", value: 300 } },
        label: "Height",
      }),
    );
    h.flush();
    await settle();
    const names = h.names();
    expect(names).toHaveLength(250);
    expect(names.at(-1)).toBe("Person250");
    h.view.unmount();
  });

  it("without the end seen, a 250-row list shows one window (100)", async () => {
    const h = await boundList("ListBox", {
      mockData: Array.from({ length: 250 }, (_, index) => person(index + 1)),
      useMockData: true,
    });
    expect(h.names()).toHaveLength(100);
    h.view.unmount();
  });

  it("a remote list whose second page brings the 101st row shows it", async () => {
    seeEverySentinel();
    const urls: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const url = new URL(String(input));
      urls.push(`${url.pathname}${url.search}`);
      const page = Number(url.searchParams.get("page") ?? 1);
      const items =
        page === 1
          ? Array.from({ length: 100 }, (_, index) => person(index + 1))
          : [person(101)];
      return new Response(
        JSON.stringify({ items, next: page === 1 ? "2" : null }),
        { headers: { "content-type": "application/json" } },
      );
    });
    const h = await boundList(
      "ListBox",
      { mockData: [], runtimeData: [], useMockData: false },
      [
        {
          id: "list",
          name: "listUsers",
          baseUrl: "https://api.example.test",
          method: "GET",
          path: "/users",
          queryParams: [{ key: "page", value: "{{ cursor }}" }],
          targetCollection: "Users",
          responseMapping: { dataPath: "items", cursorPath: "next" },
        },
      ],
    );
    await settle();
    expect(urls).toEqual(["/users", "/users?page=2"]);
    const names = h.names();
    expect(names).toHaveLength(101);
    expect(names.at(-1)).toBe("Person101");
    h.view.unmount();
  });
});

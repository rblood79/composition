import { act } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { definitionTypeName } from "../../../../../../packages/shared/src/catalog/commands/context";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * ADR-310 G5 — Decision 11 (구간별 source): two remote sources in one list (each item repeated over
 * its own data, ①), each two pages — each run ends in its own load-more item, which asks its own
 * source; both sources' last rows reach the Preview DOM. Before, the list's one sentinel read the
 * owner's binding only (F15).
 */
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 30; i += 1) await new Promise((r) => setTimeout(r, 0));
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

const SCHEMA = [
  { id: "f-id", key: "id", type: "string" },
  { id: "f-label", key: "label", type: "string" },
];

it("ADR-310 G5: two remote sources (2 pages each) in one list — each run's sentinel loads its own source; both last rows are in the DOM", async () => {
  seeEverySentinel();
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const urls: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = new URL(String(input));
    urls.push(`${url.pathname}${url.search}`);
    const page = Number(url.searchParams.get("page") ?? 1);
    const prefix = url.pathname === "/people" ? "Person" : "Team";
    const items = (page === 1 ? [1, 2, 3] : [4]).map((n) => ({
      id: `${prefix}-${n}`,
      label: `${prefix}${n}`,
    }));
    return new Response(
      JSON.stringify({ items, next: page === 1 ? "2" : null }),
      { headers: { "content-type": "application/json" } },
    );
  });
  const h = await openAdr280Preview(["ListBox"]);
  const endpoint = (id: string, path: string, target: string) => ({
    id,
    name: id,
    baseUrl: "https://api.example.test",
    method: "GET",
    path,
    queryParams: [{ key: "page", value: "{{ cursor }}" }],
    targetCollection: target,
    responseMapping: { dataPath: "items", cursorPath: "next" },
  });
  act(() => {
    h.session.receive({
      type: "CATALOG_DATA",
      version: 1,
      collections: ["people", "teams"].map((id) => ({
        id,
        name: id === "people" ? "People" : "Teams",
        schema: SCHEMA,
        mockData: [],
        runtimeData: [],
        useMockData: false,
      })),
      variables: [],
      apiEndpoints: [
        endpoint("listPeople", "/people", "People"),
        endpoint("listTeams", "/teams", "Teams"),
      ],
    });
  });
  const list = h.ids[0] as NodeId;
  const graph = h.workspace.runtime.graph;
  const fill = (
    (graph.getEntry(list) as NodeEntry).descendantOverrides.find(
      (override) => override.kind === "fillSlot",
    ) as { childIds: readonly NodeId[] }
  ).childIds.filter(
    (id) =>
      definitionTypeName(
        graph,
        (graph.getEntry(id) as NodeEntry).definitionId,
      ) === "ListBoxItem",
  );
  const [, people, teams] = fill as [NodeId, NodeId, NodeId];
  for (const [id, collectionId, name] of [
    [people, "people", "People"],
    [teams, "teams", "Teams"],
  ] as const)
    h.workspace.execute(
      catalogBindingCommand(
        [{ kind: "node", id }],
        catalogBindingRef({ source: "dataTable", collectionId, name })!,
      ),
    );
  h.flush();
  await settle();
  await settle();
  // Each source was asked for its second page by its own run's sentinel.
  expect(urls.filter((url) => url.startsWith("/people"))).toEqual([
    "/people",
    "/people?page=2",
  ]);
  expect(urls.filter((url) => url.startsWith("/teams"))).toEqual([
    "/teams",
    "/teams?page=2",
  ]);
  const text = [
    ...(h.element(list)?.querySelectorAll('[role="option"]') ?? []),
  ].map((option) => option.textContent ?? "");
  const at = (label: string) => text.findIndex((t) => t.includes(label));
  // Both last rows, each run in its place: people's rows, then teams'.
  expect(at("Person4")).toBeGreaterThan(-1);
  expect(at("Team4")).toBeGreaterThan(-1);
  expect(at("Person1")).toBeLessThan(at("Person4"));
  expect(at("Person4")).toBeLessThan(at("Team1"));
  expect(at("Team1")).toBeLessThan(at("Team4"));
  h.view.unmount();
});

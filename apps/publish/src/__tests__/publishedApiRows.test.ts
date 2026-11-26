// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { CatalogGraph } from "../../../../packages/shared/src/catalog/document/graph";
import type {
  CatalogDocument,
  CatalogEntry,
  CatalogLibrary,
} from "../../../../packages/shared/src/catalog/document/types";
import { CatalogPreviewSession } from "../../../../packages/shared/src/catalog/runtime/catalogPreviewSession";
import { NullLayoutEngine } from "../../../../packages/shared/src/catalog/runtime/nullLayoutEngine";
import { catalogThemeState } from "../../../../packages/shared/src/catalog/runtime/theme";
import { createPublishedSession } from "../catalogSession";
import { publicationFixture } from "./publicationFixture";

/**
 * A published app has no Builder to send API rows: its session loads every collection an endpoint
 * fills, by the collection's execution policy (none = on open), and never shows the design sample
 * rows (`mockData`) for one. The Builder's Preview session keeps its rule (the Builder loads).
 * Measurement: a `fetch` stub the session really calls — requests are counted at the stub, rows are
 * read as the bound components read them (`collectionItems`). Expected rows are written by hand.
 *
 * Why (2026-11-26 live): Publish showed `MOCK-*` rows and sent 0 requests for an endpoint with no
 * template · cursor · view — also with the policy 「Auto」.
 */
const SCHEMA = [
  { id: "f-id", key: "id", type: "string" },
  { id: "f-name", key: "name", type: "string" },
];
const collection = (name: string, extra: Record<string, unknown> = {}) => ({
  kind: "collection",
  id: `data:collection:${name}`,
  name,
  schema: SCHEMA,
  mockData: [{ id: `mock-${name}`, name: `MOCK-${name}` }],
  useMockData: false,
  ...extra,
});
const endpoint = (name: string) => ({
  kind: "endpoint",
  id: `data:endpoint:${name}`,
  name: `list-${name}`,
  method: "GET",
  baseUrl: "https://api.example.test",
  path: `/${name}`,
  headers: [],
  queryParams: [],
  bodyType: "none",
  responseMapping: { dataPath: "items" },
  targetCollectionId: `data:collection:${name}`,
  executionMode: "client",
});

async function publication(entries: readonly Record<string, unknown>[]) {
  const { library, graph } = await publicationFixture();
  const base = graph.exportDocument();
  const project = base.entries[base.projectId] as Record<string, unknown>;
  const document = {
    ...base,
    entries: {
      ...base.entries,
      [base.projectId]: {
        ...project,
        collectionIds: entries
          .filter((entry) => entry.kind === "collection")
          .map((entry) => entry.id),
        endpointIds: entries
          .filter((entry) => entry.kind === "endpoint")
          .map((entry) => entry.id),
      },
      ...Object.fromEntries(entries.map((entry) => [entry.id, entry])),
    } as unknown as Record<string, CatalogEntry>,
  } as CatalogDocument;
  // (The graph validates the entries.)
  return {
    library,
    document: new CatalogGraph(document, library).exportDocument(),
  };
}

const published = (document: CatalogDocument, library: CatalogLibrary) =>
  createPublishedSession(
    {
      document,
      extras: {},
      resolver: {
        resolveSync: () => null,
        ensure: async () => {},
        subscribe: () => () => {},
      },
      dispose: () => {},
    },
    library,
  );

/** The stub answers `/name` with three rows `API-name-1..3`. */
function server() {
  const requests: string[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    requests.push(path);
    const name = path.slice(1);
    return new Response(
      JSON.stringify({
        items: [1, 2, 3].map((n) => ({
          id: `${name}-${n}`,
          name: `API-${name}-${n}`,
        })),
      }),
      { headers: { "content-type": "application/json" } },
    );
  });
  return requests;
}
const settle = async () => {
  for (let i = 0; i < 12; i += 1)
    await new Promise((resolve) => setTimeout(resolve, 0));
};
const names = (session: CatalogPreviewSession, id: string) =>
  (session.collectionItems(id) as { name: string }[]).map((row) => row.name);

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("published app — API collections", () => {
  it("loads a plain endpoint's collection on open and shows its rows", async () => {
    const requests = server();
    const { document, library } = await publication([
      collection("plain"),
      endpoint("plain"),
      collection("auto", { executionPolicy: { mode: "auto" } }),
      endpoint("auto"),
    ]);
    const session = published(document, library);
    // (Before the answer: no sample rows — the list is empty, loading.)
    expect(names(session, "plain")).toEqual([]);
    expect(names(session, "auto")).toEqual([]);
    await settle();
    expect(requests.sort()).toEqual(["/auto", "/plain"]);
    expect(names(session, "plain")).toEqual([
      "API-plain-1",
      "API-plain-2",
      "API-plain-3",
    ]);
    expect(names(session, "auto")).toEqual([
      "API-auto-1",
      "API-auto-2",
      "API-auto-3",
    ]);
    session.dispose();
  });

  it("a 「manual」 collection waits for a reload — empty, never its sample rows", async () => {
    const requests = server();
    const { document, library } = await publication([
      collection("manual", { executionPolicy: { mode: "manual" } }),
      endpoint("manual"),
    ]);
    const session = published(document, library);
    await settle();
    expect(requests).toEqual([]);
    expect(names(session, "manual")).toEqual([]);
    await session.reload("manual");
    expect(requests).toEqual(["/manual"]);
    expect(names(session, "manual")).toEqual([
      "API-manual-1",
      "API-manual-2",
      "API-manual-3",
    ]);
    session.dispose();
  });

  it("keeps the rows of a collection that uses its own data, and of one no endpoint fills", async () => {
    const requests = server();
    const { document, library } = await publication([
      collection("static", { useMockData: true }),
      endpoint("static"),
      collection("unlinked"),
    ]);
    const session = published(document, library);
    await settle();
    expect(requests).toEqual([]);
    expect(names(session, "static")).toEqual(["MOCK-static"]);
    expect(names(session, "unlinked")).toEqual(["MOCK-unlinked"]);
    session.dispose();
  });

  it("an 「interval」 collection loads on open and again each period — not over an edit not saved", async () => {
    // (The intake modules load before the clock is faked — a dynamic import is not a timer.)
    const requests = server();
    const { document, library } = await publication([
      collection("warm"),
      endpoint("warm"),
    ]);
    const warm = published(document, library);
    await settle();
    warm.dispose();
    requests.length = 0;

    vi.useFakeTimers();
    const next = await publication([
      collection("live", {
        executionPolicy: { mode: "interval", intervalSec: 5 },
      }),
      endpoint("live"),
    ]);
    const session = published(next.document, next.library);
    await vi.advanceTimersByTimeAsync(0);
    expect(requests).toEqual(["/live"]);
    await vi.advanceTimersByTimeAsync(4999);
    expect(requests).toEqual(["/live"]);
    await vi.advanceTimersByTimeAsync(1);
    expect(requests).toEqual(["/live", "/live"]);

    // (An edit the user has not saved: the period's load would drop it — the tick is skipped.)
    const edit = session.update("live", "live-1", { name: "EDITED" });
    expect(edit.ok).toBe(true);
    await vi.advanceTimersByTimeAsync(5000);
    expect(requests).toEqual(["/live", "/live"]);
    expect(names(session, "live")[0]).toBe("EDITED");
    session.markEditsSaved([edit.seq!]);
    await vi.advanceTimersByTimeAsync(5000);
    expect(requests).toEqual(["/live", "/live", "/live"]);

    // (A session let go stops asking.)
    session.dispose();
    await vi.advanceTimersByTimeAsync(20000);
    expect(requests).toEqual(["/live", "/live", "/live"]);
  });
});

describe("Builder Preview session — the Builder loads", () => {
  it("does not load a plain endpoint's collection and shows what the Builder has (sample rows)", async () => {
    const requests = server();
    const { document, library } = await publication([
      collection("plain"),
      endpoint("plain"),
    ]);
    const session = new CatalogPreviewSession(library, {
      requestSnapshot: () => {},
      engine: () => new NullLayoutEngine(),
      viewport: { width: 1024, height: 768 },
      theme: catalogThemeState,
    });
    session.receive({
      type: "CATALOG_SNAPSHOT",
      version: 1,
      projectId: document.projectId,
      revision: document.revision,
      document,
    });
    await settle();
    expect(requests).toEqual([]);
    expect(names(session, "plain")).toEqual(["MOCK-plain"]);
  });
});

import { describe, expect, it } from "vitest";
import type {
  ApiEndpoint,
  ApiRunRecord,
  DataTable,
} from "../../../../types/builder/data.types";
import { catalogBadgeAt, createCatalogBadges } from "./catalogBadges";

const table = (id: string, rows: number): DataTable => ({
  id,
  name: id.toUpperCase(),
  project_id: "p",
  schema: [],
  mockData: Array.from({ length: rows }, () => ({})),
  useMockData: true,
});

const box = (x: number, y: number, width = 100, height = 50) => ({
  x,
  y,
  width,
  height,
});

function setup(bindings: Record<string, string[]>) {
  let data = {
    collections: new Map([
      ["users", table("users", 2)],
      ["empty", table("empty", 0)],
      ["unused", table("unused", 1)],
    ]),
    apiEndpoints: new Map<string, ApiEndpoint>(),
    apiRuns: new Map<string, ApiRunRecord>(),
  };
  const records: Record<string, string[]> = {
    n1: ["r1", "r1b"],
    n2: ["r2"],
  };
  const badges = createCatalogBadges({
    data: () => data,
    bindingsOf: (ref) => new Set(bindings[ref] ?? []),
    recordsOf: (node) => records[node] ?? [],
  });
  return {
    badges,
    setData: (next: typeof data) => {
      data = next;
    },
    data: () => data,
  };
}

describe("catalog data binding badges", () => {
  const bounds = new Map([
    ["r1", box(0, 0)],
    ["r1b", box(200, 0)],
    ["r2", box(0, 100)],
  ]);

  it("puts the bound collection's badge on every drawn record of a bound node", () => {
    const { badges } = setup({
      "data:collection:users": ["n1"],
      "data:collection:empty": ["n2"],
    });
    const targets = badges.targets(bounds, bounds);
    expect(
      targets.map((t) => [
        t.collectionId,
        t.name,
        t.state,
        t.bounds.x,
        t.bounds.y,
      ]),
    ).toEqual([
      ["users", "USERS", "normal", 0, 0],
      ["users", "USERS", "normal", 200, 0],
      ["empty", "EMPTY", "empty", 0, 100],
    ]);
  });

  it("clips to what the ancestors show and skips a record they hide", () => {
    const { badges } = setup({ "data:collection:users": ["n1"] });
    const visible = new Map([["r1", box(10, 5, 50, 20)]]);
    const targets = badges.targets(bounds, visible);
    expect(targets.map((t) => t.bounds)).toEqual([box(10, 5, 50, 20)]);
  });

  it("follows a data store change (new maps) and shows nothing without a binding", () => {
    const store = setup({ "data:collection:users": ["n1"] });
    expect(store.badges.targets(bounds, bounds)[0].state).toBe("normal");
    store.setData({
      ...store.data(),
      collections: new Map([["users", table("users", 0)]]),
    });
    expect(store.badges.targets(bounds, bounds)[0].state).toBe("empty");
    expect(setup({}).badges.targets(bounds, bounds)).toEqual([]);
  });

  it("hits the badge under a point", () => {
    const hit = new Map([
      [
        "users",
        {
          ...box(0, 0, 40, 16),
          pageId: null,
          collectionId: "users",
          state: "normal",
        },
      ],
    ]);
    expect(catalogBadgeAt(hit, { x: 20, y: 8 })?.collectionId).toBe("users");
    expect(catalogBadgeAt(hit, { x: 41, y: 8 })).toBeUndefined();
  });
});

// @vitest-environment jsdom
import "fake-indexeddb/auto";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  DataBindingRef,
  DefinitionId,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import {
  duplicateNodes,
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import { setDataEntries } from "../../../../../../packages/shared/src/catalog/commands/data";
import {
  duplicatePage,
  setSiteSettings,
} from "../../../../../../packages/shared/src/catalog/commands/project";
import { setFilterBarTargets } from "../../../../../../packages/shared/src/catalog/commands/filterBar";
import { FILTER_BAR_ORIGIN_ID } from "../../../../../../packages/shared/src/catalog/document/filterBarOrigins";
import { catalogBindingRef } from "../dataBinding";
import { renderCatalogDom } from "../domBinding";
import {
  catalogAddFilterBarCommand,
  catalogListFilterBar,
} from "../filterBarAuthoring";
import { catalogFilterBarCandidates } from "../filterBarPanel";
import { catalogFilterBarRefusedItems } from "../filterBarRefused";
import { catalogBindingCommand } from "../dataBindingCommand";
import { catalogBuilderBoundRows } from "../catalogDataRead";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-320 Phase 2 (G2) — a filter bar through the real composition root: the palette bar (one sample
 * chip, three buttons), its connection to a bound Table (`filtersOf` — the chip repeats per root item
 * of the start tree, its texts the field label · comparison · value), the Clear switch, the graph's
 * refusals (a second bar on a list, lists of two collections), duplicates (with and without the
 * list) and undo. Expected texts are written out by hand.
 */
const BODY = "project:node:home-body" as NodeId;
const BAR = "project:node:bar" as NodeId;
const TABLE = "project:node:table" as NodeId;
const OTHER = "project:node:other" as NodeId;
const USERS = "data:collection:users" as DataBindingRef["collectionId"];

const START = {
  id: "filter-scope",
  op: "and",
  items: [
    {
      id: "c1",
      fields: [["data:field:f-name"]],
      op: "contains",
      value: "Bo",
    },
    { id: "c2", fields: [["data:field:f-status"]], op: "gte", value: 2 },
    {
      id: "g1",
      op: "or",
      items: [
        { id: "c3", fields: [["data:field:f-type"]], op: "equals", value: "A" },
        {
          id: "c4",
          fields: [["data:field:f-type"]],
          op: "equals",
          value: "B",
          enabled: false,
        },
      ],
    },
  ],
};

async function open() {
  const library = await buildCodeCatalogLibrary();
  const graph = new CatalogGraph(
    newCatalogProjectDocument({
      projectId: "project:project:adr320" as EntryId<"project">,
      name: "ADR-320",
    }),
    library,
  );
  const workspace = new CatalogWorkspace(
    graph,
    new CatalogStorage(indexedDB, `adr320-bar-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
      root: {
        rowSample: true,
        rows: (binding, kind, ownerId, _instancePath, slices) =>
          catalogBuilderBoundRows(graph, binding, kind, ownerId, slices),
      },
    },
  );
  workspace.execute(
    setDataEntries({
      puts: [
        {
          kind: "collection",
          id: USERS,
          name: "Users",
          schema: [
            { id: "f-id", key: "id", type: "string" },
            { id: "f-name", key: "name", type: "string", label: "Name" },
            { id: "f-type", key: "type", type: "string" },
            { id: "f-status", key: "status", type: "number" },
          ],
          mockData: [{ id: "p1", name: "Bora", type: "B", status: 2 }],
          useMockData: true,
        } as never,
        {
          kind: "collection",
          id: "data:collection:teams",
          name: "Teams",
          schema: [{ id: "f-id", key: "id", type: "string" }],
          mockData: [{ id: "t1" }],
          useMockData: true,
        } as never,
      ],
    }),
  );
  const node = (id: NodeId, type: string) =>
    ({
      kind: "node",
      id,
      definitionId: catalogPaletteDefinitionId(library, type),
      children: [],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
    }) as NodeEntry;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        node(BAR, "FilterBar"),
        node(TABLE, "Table"),
        node(OTHER, "ListBox"),
      ],
      rootIds: [BAR, TABLE, OTHER],
      newId: workspace.newId,
    }),
  );
  workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: TABLE }],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "users",
        name: "Users",
      })!,
    ),
  );
  workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: OTHER }],
      catalogBindingRef({
        source: "dataTable",
        collectionId: "teams",
        name: "Teams",
      })!,
    ),
  );
  const typeOf = (definitionId: string) =>
    workspace.runtime.graph.getDefinition(definitionId as DefinitionId)?.name ??
    "";
  const records = () => [...workspace.root.canvasInputs.values()];
  const recordOf = (id: string) => workspace.root.canvasInputs.get(id)!;
  /** A record's texts, depth first (a Text's `children`). */
  const texts = (id: string): string[] => {
    const record = recordOf(id);
    const own =
      typeOf(record.definitionId) === "Text" &&
      typeof record.props.children === "string" &&
      record.props.children !== ""
        ? [record.props.children]
        : [];
    return [...own, ...record.children.flatMap(texts)];
  };
  const bar = () => records().find((record) => record.sourceId === BAR)!;
  const chips = () =>
    records()
      .filter((record) => typeOf(record.definitionId) === "FilterChip")
      .filter((record) => {
        for (
          let at: string | undefined = record.parentId;
          at;
          at = recordOf(at).parentId
        )
          if (at === bar().id) return true;
        return false;
      });
  /** The bar's chips (texts each) and the texts after them (its buttons). */
  const shown = () => {
    const ofChips = new Set(chips().flatMap((chip) => texts(chip.id)));
    return {
      chips: chips().map((chip) => texts(chip.id)),
      labels: chips().map((chip) => chip.props.label),
      buttons: texts(bar().id).filter((text) => !ofChips.has(text)),
    };
  };
  const write = (props: Record<string, unknown>) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: BAR }],
        props: Object.fromEntries(
          Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
        ) as never,
      }),
    );
  const entry = (id: NodeId) =>
    workspace.runtime.graph.getEntry(id) as NodeEntry | undefined;
  return { workspace, records, chips, shown, write, entry, typeOf };
}

/** A refused step's validation code (the cause of a consumer abort included). */
const codeOf = (run: () => unknown): string | undefined => {
  try {
    run();
  } catch (error) {
    return (error as { code?: string }).code;
  }
  return undefined;
};

describe("ADR-320 G2 — the filter bar", () => {
  it("the palette bar: one sample chip and Add filter · Edit conditions · Clear (not connected)", async () => {
    const t = await open();
    expect(t.entry(BAR)?.filtersOf).toBeUndefined();
    expect(t.shown()).toEqual({
      chips: [["Field", "Contains", "Value"]],
      labels: ["Field Contains Value"],
      buttons: ["Add filter", "Edit conditions", "Clear"],
    });
  });

  it("connected with a start tree: a chip per root item (field label · comparison · value, a group counted) — undo is the sample again", async () => {
    const t = await open();
    t.write({ defaultQuery: START });
    t.workspace.execute(setFilterBarTargets(BAR, [TABLE]));
    expect(t.entry(BAR)?.filtersOf).toEqual([TABLE]);
    expect(t.shown().chips).toEqual([
      ["Name", "Contains", "Bo"],
      ["status", "At least", "2"],
      ["Group (2 conditions)"],
    ]);
    expect(t.shown().labels).toEqual([
      "Name Contains Bo",
      "status At least 2",
      "Group (2 conditions)",
    ]);
    t.workspace.undo();
    expect(t.entry(BAR)?.filtersOf).toBeUndefined();
    expect(t.shown().chips).toEqual([["Field", "Contains", "Value"]]);
  });

  it("the site's language words the chips (Korean)", async () => {
    const t = await open();
    t.workspace.execute(setSiteSettings({ patch: { lang: "ko" } }));
    t.write({ defaultQuery: START });
    t.workspace.execute(setFilterBarTargets(BAR, [TABLE]));
    expect(t.shown().chips).toEqual([
      ["Name", "포함", "Bo"],
      ["status", "이상", "2"],
      ["묶음 (조건 2)"],
    ]);
  });

  it("Clear off takes the Clear button away", async () => {
    const t = await open();
    t.write({ showClear: false });
    expect(t.shown().buttons).toEqual(["Add filter", "Edit conditions"]);
    t.write({ showClear: true });
    expect(t.shown().buttons).toEqual([
      "Add filter",
      "Edit conditions",
      "Clear",
    ]);
  });

  it("a list is in one bar's scope; a bar's lists read one collection; a bar never names itself", async () => {
    const t = await open();
    t.workspace.execute(setFilterBarTargets(BAR, [TABLE]));
    t.workspace.execute(
      duplicateNodes({ ids: [BAR], newId: t.workspace.newId }),
    );
    const copy = t
      .records()
      .find(
        (record) =>
          t.typeOf(record.definitionId) === "FilterBar" &&
          record.sourceId !== BAR,
      )!.sourceId as NodeId;
    // (The copy alone is not connected — the list stays the original's.)
    expect(t.entry(copy)?.filtersOf).toBeUndefined();
    expect(
      codeOf(() => t.workspace.execute(setFilterBarTargets(copy, [TABLE]))),
    ).toBe("FILTER_TARGET_TAKEN");
    expect(() =>
      t.workspace.execute(setFilterBarTargets(copy, [OTHER])),
    ).not.toThrow();
    t.workspace.execute(setFilterBarTargets(copy, []));
    expect(
      codeOf(() =>
        t.workspace.execute(setFilterBarTargets(BAR, [TABLE, OTHER])),
      ),
    ).toBe("FILTER_TARGET_COLLECTION");
    expect(
      codeOf(() => t.workspace.execute(setFilterBarTargets(BAR, [BAR]))),
    ).toBe("FILTER_TARGET_SELF");
    expect(t.entry(BAR)?.filtersOf).toEqual([TABLE]);
  });

  it("a bar duplicated with its list filters the list's copy; disconnecting and its undo", async () => {
    const t = await open();
    t.workspace.execute(setFilterBarTargets(BAR, [TABLE]));
    t.workspace.execute(
      duplicateNodes({ ids: [BAR, TABLE], newId: t.workspace.newId }),
    );
    const bars = t
      .records()
      .filter((record) => t.typeOf(record.definitionId) === "FilterBar")
      .map((record) => record.sourceId as NodeId);
    const copy = bars.find((id) => id !== BAR)!;
    const target = t.entry(copy)?.filtersOf;
    expect(target).toHaveLength(1);
    expect(target![0]).not.toBe(TABLE);
    expect(t.entry(target![0]!)?.binding?.collectionId).toBe(USERS);
    expect(t.entry(BAR)?.filtersOf).toEqual([TABLE]);
    t.workspace.execute(setFilterBarTargets(BAR, []));
    expect(t.entry(BAR)?.filtersOf).toBeUndefined();
    t.workspace.undo();
    expect(t.entry(BAR)?.filtersOf).toEqual([TABLE]);
  });

  it("「Add filter bar」 is one step: a bar right before the list, connected — undo takes it away", async () => {
    const t = await open();
    const graph = t.workspace.runtime.graph;
    const body = () =>
      (graph.getEntry(BODY) as NodeEntry).children.map((id) =>
        t.typeOf((graph.getEntry(id) as NodeEntry).definitionId),
      );
    expect(body()).toEqual(["FilterBar", "Table", "ListBox"]);
    const { command, created } = catalogAddFilterBarCommand(
      { listId: OTHER },
      t.workspace.newId,
    );
    t.workspace.execute(command);
    expect(body()).toEqual(["FilterBar", "Table", "FilterBar", "ListBox"]);
    expect(t.entry(created.barId)?.filtersOf).toEqual([OTHER]);
    expect(catalogListFilterBar(graph, OTHER)?.id).toBe(created.barId);
    t.workspace.undo();
    expect(body()).toEqual(["FilterBar", "Table", "ListBox"]);
    expect(catalogListFilterBar(graph, OTHER)).toBeUndefined();
  });

  it("the panel offers the page's lists of the bar's collection (none another bar filters) and marks what the supply cannot take", async () => {
    const t = await open();
    const graph = t.workspace.runtime.graph;
    const offered = () =>
      catalogFilterBarCandidates(graph, BAR).map((list) => [
        list.id,
        list.connected,
      ]);
    expect(offered()).toEqual([
      [TABLE, false],
      [OTHER, false],
    ]);
    t.workspace.execute(setFilterBarTargets(BAR, [TABLE]));
    // (Connected to Users: only the Users lists.)
    expect(offered()).toEqual([[TABLE, true]]);
    const { command } = catalogAddFilterBarCommand(
      { listId: OTHER },
      t.workspace.newId,
    );
    t.workspace.execute(command);
    t.workspace.execute(setFilterBarTargets(BAR, []));
    // (The ListBox is the new bar's — not offered.)
    expect(offered()).toEqual([[TABLE, false]]);
    t.workspace.execute(setFilterBarTargets(BAR, [TABLE]));
    const tree = {
      id: "filter-scope",
      op: "and" as const,
      items: [
        ...START.items,
        {
          id: "gone",
          fields: [["data:field:f-removed"]],
          op: "equals",
          value: 1,
        },
      ],
    };
    // (Mock rows take a condition on any field they have — the removed field is refused.)
    expect([
      ...catalogFilterBarRefusedItems(graph, t.entry(BAR)!, tree as never),
    ]).toEqual(["gone"]);
  });

  it("the DOM: a RAC Toolbar named 「Filters」, a RAC Group per chip named 「field comparison value」 — no role · aria literal of ours", async () => {
    const t = await open();
    t.write({ defaultQuery: START });
    t.workspace.execute(setFilterBarTargets(BAR, [TABLE]));
    const host = document.createElement("div");
    document.body.append(host);
    const react = createRoot(host);
    const barRecord = t.records().find((record) => record.sourceId === BAR)!;
    await act(async () =>
      react.render(renderCatalogDom(t.workspace.root, barRecord.id)),
    );
    const toolbar = host.querySelector('[role="toolbar"]');
    expect(toolbar?.getAttribute("aria-label")).toBe("Filters");
    expect(
      [...host.querySelectorAll('[role="group"]')].map((group) =>
        group.getAttribute("aria-label"),
      ),
    ).toEqual([
      "Name Contains Bo",
      "status At least 2",
      "Group (2 conditions)",
    ]);
    expect(
      [...host.querySelectorAll("button")].map((button) =>
        (button.textContent ?? "").trim(),
      ),
    ).toEqual([
      "Contains",
      "Bo",
      "",
      "",
      "At least",
      "2",
      "",
      "",
      "",
      "",
      "Add filter",
      "Edit conditions",
      "Clear",
    ]);
    await act(async () => react.unmount());
    host.remove();
  });

  it("a connected bar's chips follow its start tree written after connecting, and its collection's field names (incremental)", async () => {
    const t = await open();
    t.workspace.execute(setFilterBarTargets(BAR, [TABLE]));
    expect(t.shown().chips).toEqual([]);
    t.write({ defaultQuery: START });
    expect(t.shown().chips.map((chip) => chip[0])).toEqual([
      "Name",
      "status",
      "Group (2 conditions)",
    ]);
    const users = t.workspace.runtime.graph.getEntry(USERS) as unknown as {
      schema: { id: string; label?: string }[];
    };
    t.workspace.execute(
      setDataEntries({
        puts: [
          {
            ...users,
            schema: users.schema.map((field) =>
              field.id === "f-status" ? { ...field, label: "State" } : field,
            ),
          } as never,
        ],
      }),
    );
    expect(t.shown().chips[1]).toEqual(["State", "At least", "2"]);
    t.workspace.undo();
    expect(t.shown().chips[1]).toEqual(["status", "At least", "2"]);
  });

  it("a duplicated page's bar filters the page copy's list (the original stays the original's)", async () => {
    const t = await open();
    t.workspace.execute(setFilterBarTargets(BAR, [TABLE]));
    const graph = t.workspace.runtime.graph;
    const project = graph.getEntry(graph.projectId) as unknown as {
      pageIds: string[];
    };
    const pageId = project.pageIds[0]!;
    t.workspace.execute(
      duplicatePage({
        id: pageId as never,
        route: "/copy",
        name: "Copy",
        newId: t.workspace.newId,
      }),
    );
    const bars = [...graph.instancesOf(FILTER_BAR_ORIGIN_ID)]
      .map((id) => graph.getEntry(id) as NodeEntry)
      .filter((node) => node.filtersOf);
    expect(bars).toHaveLength(2);
    const copy = bars.find((node) => node.id !== BAR)!;
    expect(copy.filtersOf).toHaveLength(1);
    expect(copy.filtersOf![0]).not.toBe(TABLE);
    expect(t.entry(BAR)?.filtersOf).toEqual([TABLE]);
  });
});

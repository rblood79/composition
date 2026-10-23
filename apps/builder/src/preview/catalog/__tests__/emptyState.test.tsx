import { act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { REUSABLE_ORIGIN_TEMPLATES } from "../../../../../../packages/shared/src/catalog/document/generated/reusableOriginLibrary";
import { CATALOG_EMPTY_STATE_COLLECTIONS } from "../../../../../../packages/shared/src/catalog/nesting/nestingRules";
import type { NodeId } from "../../../../../../packages/shared/src/catalog/document/types";
import {
  moveNodes,
  removeTargets,
} from "../../../../../../packages/shared/src/catalog/commands";
import { catalogBindingRef } from "../../../builder/catalogRuntime/dataBinding";
import { catalogBindingCommand } from "../../../builder/catalogRuntime/dataBindingCommand";
import {
  catalogSlotInsertOptions,
  catalogSlotTarget,
} from "../../../builder/catalogRuntime/slots";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * RAC `renderEmptyState` (2026-10-23 사용자 결정): a collection's IllustratedMessage child is its
 * empty state — drawn while the collection has no items (a bound one's data is empty), not while
 * it has rows.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const settle = () =>
  act(async () => {
    for (let i = 0; i < 10; i += 1) await new Promise((r) => setTimeout(r, 0));
  });

async function emptyStatePreview(type: string, rows: { id: string }[]) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const h = await openAdr280Preview([type]);
  const [collection] = h.ids as [NodeId];
  // (The collection origins hold their empty state — no "+" needed, 2026-10-23.)
  const graph = h.workspace.runtime.graph;
  const target = catalogSlotTarget(graph, { kind: "node", id: collection });
  if (target)
    expect(
      catalogSlotInsertOptions(graph, target).some(
        (choice) => choice.label === "IllustratedMessage",
      ),
      `${type} still offers it back`,
    ).toBe(true);
  const receive = (data: { id: string }[]) =>
    act(() => {
      h.session.receive({
        type: "CATALOG_DATA",
        version: 1,
        collections: [
          {
            id: "users",
            name: "Users",
            schema: [{ id: "f-id", key: "id", type: "string" }],
            mockData: data,
            runtimeData: [],
            useMockData: true,
          },
        ],
        variables: [],
        apiEndpoints: [],
      });
    });
  receive(rows);
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
  const message = () =>
    h.element(collection)?.querySelector(".react-aria-IllustratedMessage") ??
    null;
  return { ...h, collection, message, receive };
}

describe("collection empty state (renderEmptyState)", () => {
  it("every collection origin holds an IllustratedMessage (its empty state, by default)", () => {
    const templates = new Map(
      REUSABLE_ORIGIN_TEMPLATES.map((template) => [template.id, template]),
    );
    const typeOf = (definitionId: string) =>
      definitionId.replace(/^lib:definition:type-/, "");
    const origins = REUSABLE_ORIGIN_TEMPLATES.filter(
      (template) =>
        /^lib:template:component-[a-z]+(__menu|__2)?$/.test(template.id) &&
        CATALOG_EMPTY_STATE_COLLECTIONS.has(typeOf(template.definitionId)),
    );
    expect(origins.map((origin) => typeOf(origin.definitionId)).sort()).toEqual(
      ["GridList", "ListBox", "Menu", "TagList", "Tree"],
    );
    for (const origin of origins)
      expect(
        origin.children.map((id) => templates.get(id as never)?.definitionId),
        origin.id,
      ).toContain("lib:definition:origin-component-illustratedmessage");
  });

  it.each(["ListBox", "GridList", "Tree", "TagGroup"])(
    "a bound %s draws its IllustratedMessage while its data is empty",
    async (type) => {
      const h = await emptyStatePreview(type, []);
      expect(h.message()).not.toBeNull();
      h.receive([{ id: "a" }, { id: "b" }]);
      h.flush();
      await settle();
      expect(h.message()).toBeNull();
      h.view.unmount();
    },
  );

  it("while a bound list's first load runs, the empty list shows S2's spinner", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    // (The load never answers.)
    vi.spyOn(globalThis, "fetch").mockImplementation(
      () => new Promise<Response>(() => {}),
    );
    const h = await openAdr280Preview(["ListBox"]);
    const [collection] = h.ids as [NodeId];
    act(() => {
      h.session.receive({
        type: "CATALOG_DATA",
        version: 1,
        collections: [
          {
            id: "users",
            name: "Users",
            schema: [{ id: "f-id", key: "id", type: "string" }],
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
            // (A paging endpoint is the session's to load.)
            responseMapping: { dataPath: "items", cursorPath: "next" },
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
    const list = h.element(collection);
    expect(list?.getAttribute("data-empty")).toBe("true");
    expect(
      list?.querySelector('[role="progressbar"][aria-label="Loading…"]'),
    ).not.toBeNull();
    h.view.unmount();
  });

  it("the EmptyState goes only with its collection: no delete, no move out", async () => {
    const h = await emptyStatePreview("ListBox", []);
    const graph = h.workspace.runtime.graph;
    const list = graph.getEntry(h.collection) as { children?: string[] };
    const record = [...h.workspace.root.domInputs.values()].find(
      (r) => r.sourceId === h.collection,
    )!;
    const message = record.children
      .map((id) => h.workspace.root.domInputs.get(id)!)
      .find((child) => child.bindingId === "illustratedmessage")!;
    const id = message.sourceId as NodeId;
    expect(list).toBeTruthy();
    expect(() =>
      h.workspace.execute(
        removeTargets({
          targets: [{ kind: "node", id }],
          newId: h.workspace.newId,
        }),
      ),
    ).toThrow(/ListBox>EmptyState/);
    expect(() =>
      h.workspace.execute(
        moveNodes({
          ids: [id],
          parent: { kind: "node", id: "project:node:home-body" as NodeId },
          newId: h.workspace.newId,
        }),
      ),
    ).toThrow(/ListBox>EmptyState/);
    // With its collection (both selected, or the collection alone) it goes.
    h.workspace.execute(
      removeTargets({
        targets: [
          { kind: "node", id },
          { kind: "node", id: h.collection },
        ],
        newId: h.workspace.newId,
      }),
    );
    expect(graph.getEntry(id)).toBeUndefined();
    h.view.unmount();
  });

  it("the Canvas hides it while the list has items and draws it once they are gone", async () => {
    const h = await emptyStatePreview("ListBox", []);
    const root = h.workspace.root;
    const kids = () => {
      const list = [...root.domInputs.values()].find(
        (record) => record.sourceId === h.collection,
      )!;
      return list.children.map((id) => root.domInputs.get(id)!);
    };
    // (The Canvas has no loaded data here: the list shows its items.)
    const items = kids().filter((kid) => kid.bindingId === "listboxitem");
    expect(items.length).toBeGreaterThan(0);
    const message = () =>
      kids().find((kid) => kid.bindingId === "illustratedmessage")!;
    expect(message().hidden).toBe(true);
    h.workspace.execute(
      removeTargets({
        targets: items.map((item) => ({
          kind: "node" as const,
          id: item.sourceId as NodeId,
        })),
        newId: h.workspace.newId,
      }),
    );
    expect(message().hidden).toBeFalsy();
    // (Its picture is S2's empty-state one — FolderOpen, not the generic image glyph.)
    const glyph = message()
      .children.map((id) => root.domInputs.get(id)!)
      .find((child) => child.bindingId === "illustration")!;
    expect(glyph.props.iconName).toBe("folder-open");
    h.view.unmount();
  });
});

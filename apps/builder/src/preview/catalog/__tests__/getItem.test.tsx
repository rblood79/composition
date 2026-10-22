import { act, fireEvent } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type {
  CatalogLibrary,
  EntryId,
  NodeEntry,
  NodeId,
} from "../../../../../../packages/shared/src/catalog/document/types";
import { CatalogGraph } from "../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import { createPage } from "../../../../../../packages/shared/src/catalog/commands";
import { catalogPaletteDefinitionId } from "../../../builder/catalogRuntime/paletteInsert";
import { openAdr280Preview } from "./support/adr280Harness";

/**
 * `useListData.getItem(key)` — a keyed binding (`binding.key`) is one item: a container's
 * descendants read its fields (`{name}`), an edit Form's fields start from them
 * (`value="{email}"`), a collection shows it alone. The key is a literal or a `{{ }}`
 * template — the route's `{{ params.id }}`, a variable — read again when it changes.
 */
afterEach(() => {
  vi.restoreAllMocks();
});

const DETAIL = "project:page:detail" as EntryId<"page">;
const id = (name: string) => `project:node:${name}` as NodeId;

const USERS = [
  { id: "u1", name: "Kim", email: "kim@example.test" },
  { id: "u2", name: "Park", email: "park@example.test" },
];

const node = (
  nodeId: NodeId,
  definitionId: string,
  props: Record<string, unknown> = {},
  children: NodeId[] = [],
  extra: Partial<NodeEntry> = {},
): NodeEntry => ({
  kind: "node",
  id: nodeId,
  definitionId: definitionId as NodeEntry["definitionId"],
  children,
  props: Object.fromEntries(
    Object.entries(props).map(([key, value]) => [key, { kind: "set", value }]),
  ) as NodeEntry["props"],
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...extra,
});

async function detailPreview(key: string) {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  const library: CatalogLibrary = await buildCodeCatalogLibrary();
  const h = await openAdr280Preview(["Button"]);
  const [button] = h.ids as [NodeId];
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
            { id: "f-email", key: "email", type: "email" },
          ],
          mockData: USERS,
          useMockData: true,
        },
      ],
      variables: [
        {
          id: "selected",
          name: "selected",
          type: "string",
          defaultValue: "u1",
        },
      ],
      apiEndpoints: [],
    });
  });
  const binding = {
    collectionId: "data:collection:users",
    fieldMap: {},
    key,
  } as NodeEntry["binding"];
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
        node(id("detail-body"), "lib:definition:type-body", {}, [
          id("detail-frame"),
          id("detail-list"),
        ]),
        node(
          id("detail-frame"),
          catalogPaletteDefinitionId(library, "frame"),
          {},
          [id("detail-name"), id("detail-form")],
          { binding },
        ),
        node(id("detail-name"), "lib:definition:text", { children: "{name}" }),
        node(id("detail-form"), "lib:definition:type-Form", {}, [
          id("detail-email"),
        ]),
        node(
          id("detail-email"),
          catalogPaletteDefinitionId(library, "TextField"),
          { label: "Email", name: "email", value: "{email}" },
        ),
        node(
          id("detail-list"),
          catalogPaletteDefinitionId(library, "ListBox"),
          {},
          [],
          { binding },
        ),
      ],
    }),
  );
  h.flush();
  const text = () => h.element(id("detail-name"))?.textContent ?? "";
  const email = () =>
    h.element(id("detail-email"))?.querySelector("input")?.value ?? "";
  const options = () =>
    [
      ...(h.element(id("detail-list"))?.querySelectorAll('[role="option"]') ??
        []),
    ].map((option) => option.textContent ?? "");
  return { ...h, button, text, email, options };
}

describe("getItem(key) — a keyed binding", () => {
  it("the route's {{ params.id }}: the container's descendants read that item, an edit field starts from it, a collection shows it alone", async () => {
    const h = await detailPreview("{{ params.id }}");
    act(() => {
      h.session.navigateTo("/detail/u2");
    });
    expect(h.text()).toBe("Park");
    expect(h.email()).toBe("park@example.test");
    expect(h.options()).toEqual([expect.stringContaining("Park")]);
    act(() => {
      h.session.navigateTo("/detail/u1");
    });
    expect(h.text()).toBe("Kim");
    expect(h.options()).toEqual([expect.stringContaining("Kim")]);
    // (An id no item has: an empty item — no other item's fields.)
    act(() => {
      h.session.navigateTo("/detail/none");
    });
    expect(h.text()).toBe("");
    h.view.unmount();
  });

  it("a variable key ({{ selected }}) follows its writes; a literal key is that item", async () => {
    const h = await detailPreview("{{ selected }}");
    h.rule(h.button, "onPress", {
      opcode: "setState",
      variableId: "data:variable:selected",
      op: "set",
      value: "u2",
    });
    act(() => {
      h.session.navigateTo("/detail/x");
    });
    expect(h.text()).toBe("Kim");
    act(() => {
      h.session.navigate("project:page:home" as EntryId<"page">);
    });
    act(() => {
      fireEvent.click(h.element(h.button)!);
    });
    act(() => {
      h.session.navigateTo("/detail/x");
    });
    expect(h.text()).toBe("Park");
    h.view.unmount();
    const literal = await detailPreview("u2");
    act(() => {
      literal.session.navigateTo("/detail/x");
    });
    expect(literal.text()).toBe("Park");
    literal.view.unmount();
  });

  it("the document keeps the key; another binding key is refused", async () => {
    const h = await detailPreview("{{ params.id }}");
    const library = await buildCodeCatalogLibrary();
    const exported = h.workspace.runtime.graph.exportDocument();
    const reopened = new CatalogGraph(structuredClone(exported), library);
    expect(
      (reopened.getEntry(id("detail-frame")) as NodeEntry).binding,
    ).toEqual({
      collectionId: "data:collection:users",
      fieldMap: {},
      key: "{{ params.id }}",
    });
    const broken = structuredClone(exported);
    (
      broken.entries[id("detail-frame")] as unknown as {
        binding: Record<string, unknown>;
      }
    ).binding.other = 1;
    expect(() => new CatalogGraph(broken, library)).toThrow();
    h.view.unmount();
  });
});

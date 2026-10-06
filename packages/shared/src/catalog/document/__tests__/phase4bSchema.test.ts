import { describe, expect, it } from "vitest";
import { resolveCatalogNode } from "../../resolution/resolver";
import { applyCatalogTransaction } from "../../transactions/transaction";
import { catalogTypeDefinition } from "../codeCatalogLibrary";
import { CatalogGraph } from "../graph";
import { buildCatalogLibrary } from "../library";
import type { CatalogDocument, NodeEntry } from "../types";
import { CatalogValidationError, validateCatalogEntry } from "../validation";

/**
 * ADR-248 Phase 4b-1 schema: a path patch writes the node authoring fields (layout, fills,
 * enabled), a container template position takes instance-owned children (`fillSlot` — the old
 * list-host children replacement), a node carries its DOM id in `metadata.htmlId`, and a prop
 * may hold a structured value (a string list or a list of flat item records).
 */
const library = () =>
  buildCatalogLibrary({
    contractVersion: 5,
    revision: "phase4b-schema",
    bindingIds: ["listbox", "item", "text"],
    actionOpCodes: [],
    definitions: [
      {
        id: "lib:definition:type-ListBox",
        name: "ListBox",
        mode: "primitive",
        bindingId: "listbox",
        accepts: { items: "items", selectedKeys: "string[]", label: "string" },
        defaults: { items: [] },
        visual: {},
        stateRules: {},
      },
      {
        id: "lib:definition:type-Item",
        name: "Item",
        mode: "primitive",
        bindingId: "item",
        accepts: { children: "string" },
        defaults: {},
        visual: {},
        stateRules: {},
      },
      {
        id: "lib:definition:picker",
        name: "Picker",
        mode: "composite",
        templateRootId: "lib:template:root",
        accepts: {},
        defaults: {},
        visual: {},
        stateRules: {},
      },
    ],
    templates: [
      {
        id: "lib:template:root",
        definitionId: "lib:definition:type-ListBox",
        children: ["lib:template:item"],
        props: {},
        visual: {},
      },
      {
        id: "lib:template:item",
        definitionId: "lib:definition:type-Item",
        children: [],
        props: { children: "one" },
        visual: {},
      },
    ],
    tokens: [],
  });
const node = (id: string, patch: Partial<NodeEntry> = {}): NodeEntry => ({
  kind: "node",
  id: `project:node:${id}`,
  definitionId: "lib:definition:picker",
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...patch,
});
function graph(nodes: NodeEntry[], roots: string[]) {
  const document: CatalogDocument = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 5,
    revision: 0,
    projectId: "project:project:p",
    rootId: "project:project:p",
    entries: {
      "project:project:p": {
        kind: "project",
        id: "project:project:p",
        name: "p",
        pageIds: ["project:page:main"],
        definitionIds: [],
        overrideIds: [],
        themeIds: [],
        tokenIds: [],
        stateVariableIds: [],
        interactionIds: [],
        assetIds: [],
      },
      "project:page:main": {
        kind: "page",
        id: "project:page:main",
        route: "/",
        name: "main",
        children: roots.map((id) => `project:node:${id}` as NodeEntry["id"]),
      },
      ...Object.fromEntries(nodes.map((item) => [item.id, item])),
    },
  };
  return new CatalogGraph(document, library());
}
const code = (run: () => unknown): string => {
  try {
    run();
  } catch (error) {
    if (error instanceof CatalogValidationError) return error.code;
    throw error;
  }
  return "ACCEPTED";
};
const set = <T>(value: T) => ({ kind: "set" as const, value });
const tx = (
  g: CatalogGraph,
  ops: Parameters<typeof applyCatalogTransaction>[1]["ops"],
) =>
  applyCatalogTransaction(g, {
    projectId: g.projectId,
    expectedRevision: g.revision,
    history: { kind: "record", label: "edit" },
    ops,
  });
const rootAddress = {
  instances: ["project:node:pick" as const],
  templatePath: ["lib:template:root" as const],
};
const itemAddress = {
  instances: ["project:node:pick" as const],
  templatePath: ["lib:template:root" as const, "lib:template:item" as const],
};

describe("ADR-248 Phase 4b-1 schema", () => {
  it("resolves a path patch's layout and fills, and keeps an enabled-only patch", () => {
    const g = graph([node("pick")], ["pick"]);
    tx(g, [
      {
        kind: "upsertDescendant",
        id: "project:node:pick",
        override: {
          kind: "patch",
          address: rootAddress,
          layout: { rowGap: set("12px") },
          fills: [
            {
              kind: "color",
              id: "f",
              enabled: true,
              opacity: 1,
              blendMode: "normal",
              color: "#112233ff",
            },
          ],
        },
      },
    ]);
    const [host] = resolveCatalogNode(g, "project:node:pick").children;
    expect(host.layout.rowGap).toBe("12px");
    expect(host.authoredLayout).toEqual({ rowGap: "12px" });
    expect(host.fills?.[0]).toMatchObject({
      kind: "color",
      color: "#112233ff",
    });
    // An enabled-only patch is a real override (it used to be dropped as empty).
    tx(g, [
      {
        kind: "upsertDescendant",
        id: "project:node:pick",
        override: { kind: "patch", address: itemAddress, enabled: false },
      },
    ]);
    expect(
      resolveCatalogNode(g, "project:node:pick").children[0].children,
    ).toEqual([]);
  });

  it("fills a container template position with instance-owned children; a leaf position is refused", () => {
    const extra = node("extra", { definitionId: "lib:definition:type-Item" });
    const filled = (address: typeof rootAddress | typeof itemAddress) =>
      graph(
        [
          node("pick", {
            descendantOverrides: [
              { kind: "fillSlot", address, childIds: ["project:node:extra"] },
            ],
          }),
          extra,
        ],
        ["pick"],
      );
    const [host] = resolveCatalogNode(
      filled(rootAddress),
      "project:node:pick",
    ).children;
    expect(host.children.map((child) => child.sourceId)).toEqual([
      "project:node:extra",
    ]);
    expect(code(() => filled(itemAddress))).toBe("TARGET_NOT_SLOT");
  });

  it("stores the DOM id in metadata.htmlId with an exact inverse", () => {
    expect(
      code(() =>
        validateCatalogEntry(node("a", { metadata: { htmlId: "a b" } })),
      ),
    ).toBe("INVALID_HTML_ID");
    const g = graph([node("pick")], ["pick"]);
    const before = g.getEntry("project:node:pick");
    const result = tx(g, [
      {
        kind: "setNodeField",
        id: "project:node:pick",
        field: "metadata",
        value: { htmlId: "hero" },
      },
    ]);
    expect(resolveCatalogNode(g, "project:node:pick").htmlId).toBe("hero");
    tx(g, [...result.inverse]);
    expect(g.getEntry("project:node:pick")).toEqual(before);
  });

  it("carries structured props — item lists and string lists — typed per accepted slot", () => {
    const g = graph(
      [node("list", { definitionId: "lib:definition:type-ListBox" })],
      ["list"],
    );
    const prop = (key: string, value: unknown) =>
      code(() =>
        tx(g, [
          {
            kind: "patchNodeProp",
            id: "project:node:list",
            key,
            write: set(value as never),
          },
        ]),
      );
    expect(resolveCatalogNode(g, "project:node:list").props.items).toEqual([]);
    const before = g.getEntry("project:node:list");
    const items = [
      { id: "a", label: "Alpha", isDisabled: false },
      { id: "b", label: "Beta", isDisabled: true },
    ];
    const result = tx(g, [
      {
        kind: "patchNodeProp",
        id: "project:node:list",
        key: "items",
        write: set(items),
      },
      {
        kind: "patchNodeProp",
        id: "project:node:list",
        key: "selectedKeys",
        write: set(["b"]),
      },
    ]);
    const resolved = resolveCatalogNode(g, "project:node:list");
    expect(resolved.props.items).toEqual(items);
    expect(resolved.props.selectedKeys).toEqual(["b"]);
    tx(g, [...result.inverse]);
    expect(g.getEntry("project:node:list")).toEqual(before);
    // Each slot takes only its own shape.
    expect(prop("selectedKeys", [{ id: "a" }])).toBe("PROP_TYPE_MISMATCH");
    expect(prop("selectedKeys", [1])).toBe("OBJECT_REQUIRED");
    expect(prop("items", ["a"])).toBe("PROP_TYPE_MISMATCH");
    expect(prop("label", ["a"])).toBe("PROP_TYPE_MISMATCH");
    // Item rows hold flat scalars; visual values stay scalar.
    expect(
      code(() =>
        validateCatalogEntry(
          node("x", { props: { items: set([{ id: { deep: 1 } }]) } as never }),
        ),
      ),
    ).not.toBe("ACCEPTED");
    expect(
      code(() =>
        validateCatalogEntry(
          node("x", { visual: { fill: set(["#fff"]) } as never }),
        ),
      ),
    ).toBe("SCALAR_REQUIRED");
  });

  it("types the registered structured prop kinds (items-manager · string-array)", () => {
    expect(catalogTypeDefinition("ListBox").accepts.items).toBe("items");
    const chart = catalogTypeDefinition("Chart").accepts;
    expect(chart.valueFields).toBe("string[]");
    expect(chart.seriesConfig).toBe("items");
    expect(chart.dataBinding).toBeUndefined();
  });

  it("applies an instance's overrides when resolving from an ancestor of the instance", () => {
    const g = graph(
      [
        node("host", {
          definitionId: "lib:definition:type-ListBox",
          children: ["project:node:pick"],
        }),
        node("pick", {
          descendantOverrides: [
            {
              kind: "patch",
              address: rootAddress,
              layout: { rowGap: set("12px") },
            },
          ],
        }),
      ],
      ["host"],
    );
    const direct = resolveCatalogNode(g, "project:node:pick").children[0];
    const nested = resolveCatalogNode(g, "project:node:host").children[0]
      .children[0];
    expect(direct.layout.rowGap).toBe("12px");
    expect(nested.instancePath).toEqual([
      "project:node:host",
      "project:node:pick",
    ]);
    expect(nested.layout.rowGap).toBe("12px");
  });
});

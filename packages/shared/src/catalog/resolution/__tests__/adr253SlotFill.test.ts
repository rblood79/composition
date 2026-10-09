import { beforeAll, describe, expect, it } from "vitest";
import { insertCollectionItem } from "../../commands/collections";
import { detachInstances } from "../../commands/components";
import { removeTargets } from "../../commands/structure";
import {
  allocator,
  documentOf,
  node,
  PAGE,
  run,
} from "../../commands/__tests__/fixture";
import { buildCodeCatalogLibrary } from "../../document/codeCatalogLibrary";
import { CatalogGraph } from "../../document/graph";
import { buildCatalogLibrary } from "../../document/library";
import type {
  CatalogLibrary,
  LibraryDefinition,
  LibraryTemplateNode,
  NodeEntry,
  NodeId,
  NodeParent,
  TemplateId,
} from "../../document/types";
import {
  childPositions,
  pagePositions,
  type CatalogPosition,
} from "../positions";
import { resolveCatalogNode, type ResolvedCatalogNode } from "../resolver";

/**
 * ADR-253 Phase 4 (G4) — the library's slot fill: a template node that instantiates a composite
 * lists children that stand at a slot position of that composite's template (`slotFills`). A
 * Select's ListBox is an instance of the ListBox origin whose root slot the Select's items fill:
 * inside the ListBox root there are the Select's items only — none after the root, none of the
 * ListBox origin's own. It reads like an instance's `fillSlot` there, which replaces it.
 */
const id = (name: string) => `project:node:${name}` as NodeId;
const T = (name: string) => `lib:template:component-${name}` as TemplateId;
const ORIGIN = (name: string) =>
  `lib:definition:origin-component-${name}` as NodeEntry["definitionId"];

const find = (
  from: ResolvedCatalogNode,
  sourceId: string,
): ResolvedCatalogNode | undefined =>
  from.sourceId === sourceId
    ? from
    : from.children
        .map((child) => find(child, sourceId))
        .find((found) => !!found);
const all = (
  from: ResolvedCatalogNode,
  test: (node: ResolvedCatalogNode) => boolean,
): ResolvedCatalogNode[] => [
  ...(test(from) ? [from] : []),
  ...from.children.flatMap((child) => all(child, test)),
];
/** The texts shown below a node (an item root's own `{label}` row placeholder is not one). */
const texts = (from: ResolvedCatalogNode) =>
  all(from, (item) => typeof item.props.children === "string")
    .map((item) => item.props.children as string)
    .filter((text) => !text.includes("{"));
/** The validation code a build fails with. */
const codeOf = (build: () => unknown): string | undefined => {
  try {
    build();
  } catch (error) {
    return (error as { code?: string }).code ?? "thrown";
  }
  return undefined;
};
/** The positions below a position, as source ids (the Layers rows). */
const rowsOf = (
  graph: CatalogGraph,
  position: CatalogPosition,
): { source: string; rows: unknown[] }[] =>
  childPositions(graph, position).map((child) => ({
    source: child.sourceId,
    rows: rowsOf(graph, child),
  }));
/** The consumer tree below a resolved node: composite roots collapse into their instance. */
const consumerRows = (
  graph: CatalogGraph,
  parent: ResolvedCatalogNode,
): { source: string; rows: unknown[] }[] => {
  const definition = parent.definitionId.startsWith("lib:")
    ? graph.library.definitions.get(parent.definitionId as never)
    : (graph.getEntry(parent.definitionId) as
        { mode: string; templateRootId?: string } | undefined);
  const rootId =
    definition?.mode === "composite" ? definition.templateRootId : undefined;
  return parent.children.flatMap((child, index) =>
    rootId && index === 0 && child.sourceId === rootId
      ? consumerRows(graph, child)
      : [{ source: child.sourceId, rows: consumerRows(graph, child) }],
  );
};

describe("ADR-253 Phase 4 — a Select · ComboBox holds its items in its ListBox (library slot fill)", () => {
  let library: CatalogLibrary;
  beforeAll(async () => {
    library = await buildCodeCatalogLibrary();
  });
  const open = (type: string) =>
    new CatalogGraph(
      documentOf([node("field", ORIGIN(type))], ["field"]),
      library,
    );
  const FIELD = id("field");

  for (const type of ["select", "combobox"]) {
    const LIST = T(`${type}__listbox`);
    const ITEMS = [1, 2, 3, 4].map((n) => T(`${type}__item-${n}`));
    // ADR-256 Phase 6c · 6d: a picker's ListBox is in its Popover (`Popover > ListBox`).
    const VIA = [T(`${type}__popover`)];
    const listRow = (graph: CatalogGraph) =>
      childPositions(
        graph,
        VIA.reduce(
          (row, via) =>
            childPositions(graph, row).find((r) => r.sourceId === via)!,
          pagePositions(graph, PAGE)[0]!,
        ),
      ).find((row) => row.sourceId === LIST)!;

    it(`${type}: the ListBox root holds the field's items — none outside it, none of the ListBox's own`, () => {
      const graph = open(type);
      const resolved = resolveCatalogNode(graph, FIELD);
      const list = find(resolved, LIST)!;
      // The position holds the root it collapses into, alone (no item after the root) …
      expect(list.children.map((child) => child.sourceId)).toEqual([
        T("listbox"),
      ]);
      // … and that root holds the field's four items in place of its own three.
      const root = list.children[0]!;
      expect(root.children.map((child) => child.sourceId)).toEqual(ITEMS);
      expect(
        all(resolved, (item) => item.sourceId.startsWith(T("listbox__item-"))),
      ).toEqual([]);
      // No item is a direct child of the field's root any more.
      expect(
        resolved.children[0]!.children.map((child) => child.sourceId),
      ).toEqual(expect.not.arrayContaining(ITEMS));
      // The items are the field's own template positions (their edits address them there).
      expect(root.children.map((child) => child.instancePath)).toEqual(
        ITEMS.map(() => [FIELD]),
      );
      expect(texts(root)).toEqual(["Aardvark", "Cat", "Dog", "Kangaroo"]);
      // The Layers rows are the consumer tree: the ListBox row lists the four items.
      const row = listRow(graph);
      expect(childPositions(graph, row).map((item) => item.sourceId)).toEqual(
        ITEMS,
      );
      expect(childPositions(graph, row)[1]!.target).toEqual({
        kind: "descendant",
        ownerId: FIELD,
        address: {
          instances: [FIELD],
          templatePath: [T(type), ...VIA, LIST, ITEMS[1]],
        },
      });
      expect(rowsOf(graph, pagePositions(graph, PAGE)[0]!)).toEqual(
        consumerRows(graph, resolved),
      );
    });

    it(`${type}: an item added to the ListBox is the instance's fill of the ListBox root (it replaces the library's)`, () => {
      const graph = open(type);
      const before = texts(find(resolveCatalogNode(graph, FIELD), LIST)!);
      run(
        graph,
        insertCollectionItem({
          host: listRow(graph).target as NodeParent,
          entries: [node("added", ORIGIN("listbox-item-default"))],
          rootId: id("added"),
          key: "k5",
          newId: allocator(),
        }),
      );
      const owner = graph.getEntry(FIELD) as NodeEntry;
      const fills = owner.descendantOverrides.filter(
        (item) => item.kind === "fillSlot",
      );
      expect(fills.map((item) => item.address)).toEqual([
        { instances: [FIELD, LIST], templatePath: [T("listbox")] },
      ]);
      const childIds = fills[0]!.kind === "fillSlot" ? fills[0]!.childIds : [];
      expect(childIds.length).toBe(5);
      expect(childIds[4]).toBe(id("added"));
      const resolved = resolveCatalogNode(graph, FIELD);
      const list = find(resolved, LIST)!;
      expect(list.children.map((child) => child.sourceId)).toEqual([
        T("listbox"),
      ]);
      expect(list.children[0]!.children.map((child) => child.sourceId)).toEqual(
        childIds,
      );
      // The copies show what the template items showed.
      expect(texts(list).slice(0, before.length)).toEqual(before);
      expect(rowsOf(graph, pagePositions(graph, PAGE)[0]!)).toEqual(
        consumerRows(graph, resolved),
      );
      // A second item goes to the same list.
      run(
        graph,
        insertCollectionItem({
          host: listRow(graph).target as NodeParent,
          entries: [node("added2", ORIGIN("listbox-item-default"))],
          rootId: id("added2"),
          key: "k6",
          newId: allocator(),
        }),
      );
      expect(
        find(resolveCatalogNode(graph, FIELD), LIST)!.children[0]!.children
          .length,
      ).toBe(6);
    });

    it(`${type}: a bound field repeats its row template inside the ListBox`, () => {
      const graph = new CatalogGraph(
        documentOf(
          [
            node("field", ORIGIN(type), {
              binding: { collectionId: "data:collection:rows", fieldMap: {} },
            } as Partial<NodeEntry>),
          ],
          ["field"],
        ),
        library,
      );
      const resolved = resolveCatalogNode(
        graph,
        FIELD,
        undefined,
        undefined,
        "desktop",
        undefined,
        () => [
          { key: "r1", values: { label: "Row one" } },
          { key: "r2", values: { label: "Row two" } },
          { key: "r3", values: { label: "Row three" } },
        ],
      );
      const list = find(resolved, LIST)!;
      expect(list.children.map((child) => child.sourceId)).toEqual([
        T("listbox"),
      ]);
      // The first item position is the row template; the sample items give way to the rows.
      expect(list.children[0]!.children.map((child) => child.sourceId)).toEqual(
        [ITEMS[0], ITEMS[0], ITEMS[0]],
      );
      // (Each row fills the template's `{label}`: the item's own text and its label part.)
      expect([...new Set(texts(list).filter(Boolean))]).toEqual([
        "Row one",
        "Row two",
        "Row three",
      ]);
    });

    it(`${type}: a removed item is switched off in the list, and a detached field keeps its list`, () => {
      const graph = open(type);
      run(
        graph,
        removeTargets({
          targets: [childPositions(graph, listRow(graph))[1]!.target],
        }),
      );
      const kept = [ITEMS[0], ITEMS[2], ITEMS[3]];
      const resolved = resolveCatalogNode(graph, FIELD);
      expect(
        find(resolved, LIST)!.children[0]!.children.map(
          (child) => child.sourceId,
        ),
      ).toEqual(kept);
      expect(rowsOf(graph, pagePositions(graph, PAGE)[0]!)).toEqual(
        consumerRows(graph, resolved),
      );
      // Detach: the ListBox position becomes an owned instance of the ListBox origin whose root
      // slot the copied items fill (the library fill as the instance's `fillSlot`).
      const shown = texts(find(resolved, LIST)!);
      run(graph, detachInstances({ ids: [FIELD], newId: allocator() }));
      const detached = resolveCatalogNode(graph, FIELD);
      const lists = all(
        detached,
        (item) => item.definitionId === ORIGIN("listbox"),
      );
      expect(lists.length).toBe(1);
      expect(lists[0]!.children.map((child) => child.sourceId)).toEqual([
        T("listbox"),
      ]);
      expect(lists[0]!.children[0]!.children.length).toBe(3);
      expect(texts(lists[0]!)).toEqual(shown);
      expect(
        all(detached, (item) => item.sourceId.startsWith(T("listbox__item-"))),
      ).toEqual([]);
      const owned = graph.getEntry(lists[0]!.sourceId) as NodeEntry;
      expect(
        owned.descendantOverrides
          .filter((item) => item.kind === "fillSlot")
          .map((item) => item.address),
      ).toEqual([{ instances: [owned.id], templatePath: [T("listbox")] }]);
    });
  }
});

describe("ADR-253 Phase 4 — library validation of a slot fill", () => {
  const definition = (
    name: string,
    rest: Partial<LibraryDefinition>,
  ): LibraryDefinition =>
    ({
      id: `lib:definition:${name}`,
      name,
      accepts: {},
      defaults: {},
      visual: {},
      stateRules: {},
      ...rest,
    }) as LibraryDefinition;
  const template = (
    name: string,
    definitionName: string,
    rest: Partial<LibraryTemplateNode> = {},
  ): LibraryTemplateNode =>
    ({
      id: `lib:template:${name}`,
      definitionId: `lib:definition:${definitionName}`,
      children: [],
      props: {},
      visual: {},
      ...rest,
    }) as LibraryTemplateNode;
  const build = (
    list: Partial<LibraryTemplateNode>,
    extra: LibraryTemplateNode[] = [],
  ) =>
    buildCatalogLibrary({
      contractVersion: 34,
      revision: "adr253-slot-fill",
      bindingIds: ["box", "text"],
      actionOpCodes: [],
      definitions: [
        definition("box", { mode: "native", bindingId: "box" }),
        definition("text", {
          mode: "primitive",
          bindingId: "text",
          accepts: { children: "string" },
        }),
        definition("list", {
          mode: "composite",
          templateRootId: "lib:template:list",
        }),
        definition("picker", {
          mode: "composite",
          templateRootId: "lib:template:picker",
        }),
      ],
      templates: [
        template("list", "box", {
          slot: { name: "Items", required: false },
          children: ["lib:template:list__own"],
        }),
        template("list__own", "text", { props: { children: "own" } }),
        template("picker", "box", {
          children: ["lib:template:picker__list", "lib:template:picker__note"],
        }),
        template("picker__list", "list", {
          children: ["lib:template:picker__a", "lib:template:picker__b"],
          ...list,
        }),
        template("picker__a", "text", { props: { children: "a" } }),
        template("picker__b", "text", { props: { children: "b" } }),
        template("picker__note", "text", { props: { children: "note" } }),
        ...extra,
      ],
      tokens: [],
    });
  const FILL = {
    templatePath: ["lib:template:list"],
    childIds: ["lib:template:picker__a", "lib:template:picker__b"],
  } as const;

  it("projects the fill inside the composite's slot position (a minimal library)", () => {
    const library = build({ slotFills: [FILL] });
    const graph = new CatalogGraph(
      documentOf(
        [node("p", "lib:definition:picker" as NodeEntry["definitionId"])],
        ["p"],
      ),
      library,
    );
    const resolved = resolveCatalogNode(graph, id("p"));
    const list = find(resolved, "lib:template:picker__list")!;
    expect(list.children.map((child) => child.sourceId)).toEqual([
      "lib:template:list",
    ]);
    expect(texts(list)).toEqual(["a", "b"]);
    // Without the fill the children follow the root, whose own child stays (what `children`
    // alone means — the reason for the representation).
    const plain = resolveCatalogNode(
      new CatalogGraph(
        documentOf(
          [node("p", "lib:definition:picker" as NodeEntry["definitionId"])],
          ["p"],
        ),
        build({}),
      ),
      id("p"),
    );
    expect(texts(find(plain, "lib:template:picker__list")!)).toEqual([
      "own",
      "a",
      "b",
    ]);
  });

  it.each([
    [
      "a path that does not start at the composite's root",
      { slotFills: [{ ...FILL, templatePath: ["lib:template:picker"] }] },
    ],
    [
      "a position without a slot",
      {
        slotFills: [
          {
            ...FILL,
            templatePath: ["lib:template:list", "lib:template:list__own"],
          },
        ],
      },
    ],
    [
      "a path that is not in the composite's template",
      {
        slotFills: [
          {
            ...FILL,
            templatePath: ["lib:template:list", "lib:template:picker__note"],
          },
        ],
      },
    ],
    [
      "a child that is not the node's own",
      {
        slotFills: [{ ...FILL, childIds: ["lib:template:picker__note"] }],
      },
    ],
  ])("rejects %s", (_name, list) => {
    expect(codeOf(() => build(list as Partial<LibraryTemplateNode>))).toBe(
      "INVALID_SLOT_FILL",
    );
  });

  it("rejects a fill on a node that is not a composite instance, and a malformed fill", () => {
    expect(
      codeOf(() =>
        build({}, [
          template("stray", "box", {
            slotFills: [{ templatePath: ["lib:template:list"], childIds: [] }],
          }),
        ]),
      ),
    ).toBe("INVALID_SLOT_FILL");
    expect(
      codeOf(() => build({ slotFills: [{ templatePath: [], childIds: [] }] })),
    ).toBe("EMPTY_TEMPLATE_PATH");
    expect(codeOf(() => build({ slotFills: [FILL, FILL] }))).toBe(
      "DUPLICATE_DESCENDANT_ADDRESS",
    );
    // (A child listed twice, an unknown key.)
    expect(
      codeOf(() =>
        build({
          slotFills: [
            {
              ...FILL,
              childIds: ["lib:template:picker__a", "lib:template:picker__a"],
            },
          ],
        }),
      ),
    ).toBeDefined();
    expect(
      codeOf(() => build({ slotFills: [{ ...FILL, extra: true } as never] })),
    ).toBeDefined();
    expect(codeOf(() => build({ slotFills: [FILL] }))).toBeUndefined();
  });
});

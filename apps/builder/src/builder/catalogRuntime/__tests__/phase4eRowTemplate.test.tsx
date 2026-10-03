import "fake-indexeddb/auto";
import { act, render, renderHook, screen } from "@testing-library/react";
import type { ReactNode } from "react";
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
  insertNodes,
  setFields,
} from "../../../../../../packages/shared/src/catalog/commands";
import {
  childPositions,
  pagePositions,
} from "../../../../../../packages/shared/src/catalog/resolution/positions";
import { I18nProvider } from "../../../i18n";
import { useDataStore } from "../../stores/data";
import {
  CatalogCardFieldsSection,
  CatalogItemOriginNotice,
} from "../../panels/properties/catalog/CatalogRowTemplateSections";
import { CATALOG_FIELD_VALUE_SOURCE } from "../../panels/properties/catalog/catalogFieldValueSource";
import { catalogBoundRows } from "../dataBinding";
import { catalogVariableCommands } from "../stateVariables";
import { catalogPaletteDefinitionId } from "../paletteInsert";
import { newCatalogProjectDocument } from "../project";
import { CatalogWorkspaceProvider } from "../react";
import {
  catalogCardFieldCommand,
  catalogCardFields,
  catalogRowTemplateId,
  catalogRowTemplateOwner,
} from "../rowTemplate";
import { CatalogStorage } from "../storage";
import { CatalogWorkspace } from "../workspace";
import { nodeLayoutEngine } from "./support/nodeLayoutEngine";

/**
 * ADR-248 Phase 4e-4e row template: a bound collection's first item position is the row template
 * — the item origin notice shows on it (and inside it); a bound GridList's card fields list its
 * content props with the rows' values (not the sample literals) and write the GridList's patch
 * there (every row follows); only the content props read the row.
 */
const HOME = "project:page:home" as EntryId<"page">;
const BODY = "project:node:home-body" as NodeId;
const GRID = "project:node:grid" as NodeId;
const BINDING: DataBindingRef = {
  collectionId: "data:collection:c1" as DataBindingRef["collectionId"],
  fieldMap: {},
};
const COLLECTIONS = [
  {
    id: "c1",
    name: "Files",
    schema: [
      { id: "f1", key: "id" },
      { id: "f2", key: "name" },
      { id: "f3", key: "size" },
    ],
    mockData: [
      { id: "a", name: "Report", size: "2 MB" },
      { id: "b", name: "Photo", size: "5 MB" },
    ],
    useMockData: true,
  },
];

async function open(bound = true) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:cards" as EntryId<"project">,
        name: "Cards",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr248-phase4e-cards-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 800 },
      autosaveSchedule: () => {},
      root: { rows: (binding) => catalogBoundRows(binding, COLLECTIONS) },
    },
  );
  const node: NodeEntry = {
    kind: "node",
    id: GRID,
    definitionId: catalogPaletteDefinitionId(library, "GridList"),
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
    ...(bound ? { binding: BINDING } : {}),
  };
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [node],
      rootIds: [GRID],
      newId: workspace.newId,
    }),
  );
  const graph = workspace.runtime.graph;
  const [body] = pagePositions(graph, HOME);
  const [grid] = childPositions(graph, body!);
  const items = childPositions(graph, grid!);
  return { workspace, graph, grid: grid!, items };
}

/** The texts each row record shows (by item record), in order. */
function rowTexts(workspace: CatalogWorkspace) {
  const records = workspace.root.domInputs;
  const typeOf = (definitionId: string) =>
    workspace.runtime.graph.getDefinition(definitionId as DefinitionId)?.name;
  const out: string[][] = [];
  const visit = (id: string) => {
    const record = records.get(id);
    if (!record) return;
    if (typeOf(record.definitionId) === "GridListItem") {
      const texts: string[] = [];
      const collect = (childId: string) => {
        const child = records.get(childId);
        if (!child) return;
        if (typeof child.props.children === "string")
          texts.push(child.props.children);
        child.children.forEach(collect);
      };
      record.children.forEach(collect);
      out.push(texts);
      return;
    }
    record.children.forEach(visit);
  };
  visit(workspace.root.recordsOfSource(GRID)[0]!);
  return out;
}

describe("ADR-248 Phase 4e-4e row template", () => {
  it("the first item position is the row template: it and its descendants are inside, the other items and an unbound list are not", async () => {
    const { graph, items } = await open();
    const rowTemplate = catalogRowTemplateId(graph, GRID)!;
    expect(rowTemplate).toBe(items[0]!.sourceId);
    expect(catalogRowTemplateOwner(graph, items[0]!.target)).toBe(GRID);
    const [label] = childPositions(graph, items[0]!);
    expect(catalogRowTemplateOwner(graph, label!.target)).toBe(GRID);
    expect(catalogRowTemplateOwner(graph, items[1]!.target)).toBeUndefined();
    const unbound = await open(false);
    expect(
      catalogRowTemplateOwner(unbound.graph, unbound.items[0]!.target),
    ).toBeUndefined();
  });

  it("card fields: the row template's content props with the rows' values; a write is one step and every row follows; empty resets", async () => {
    const { workspace, graph, grid } = await open();
    expect(rowTexts(workspace)).toEqual([
      ["Report", ""],
      ["Photo", ""],
    ]);
    const cards = catalogCardFields(graph, grid)!;
    expect(
      cards.fields.map((field) => [field.label, field.key, field.value]),
    ).toEqual([
      ["Text", "children", "{label}"],
      ["Text", "children", "{description}"],
    ]);
    const depth = workspace.runtime.historyDepth.undo;
    workspace.execute(catalogCardFieldCommand(cards.fields[1]!, "{size}"));
    expect(workspace.runtime.historyDepth.undo).toBe(depth + 1);
    expect(rowTexts(workspace)).toEqual([
      ["Report", "2 MB"],
      ["Photo", "5 MB"],
    ]);
    expect(catalogCardFields(graph, grid)!.fields[1]!.value).toBe("{size}");
    workspace.execute(
      catalogCardFieldCommand(catalogCardFields(graph, grid)!.fields[1]!, ""),
    );
    expect(catalogCardFields(graph, grid)!.fields[1]!.value).toBe(
      "{description}",
    );
    expect(rowTexts(workspace)).toEqual([
      ["Report", ""],
      ["Photo", ""],
    ]);
  });

  it("only content props read the row: another prop's {field} text stays", async () => {
    const { workspace, graph, items } = await open();
    const [label] = childPositions(graph, items[0]!);
    workspace.execute(
      setFields({
        targets: [label!.target],
        props: { slot: { kind: "set", value: "{name}" } },
      }),
    );
    const slots = [...workspace.root.domInputs.values()]
      .map((record) => record.props.slot)
      .filter((slot) => typeof slot === "string" && slot.includes("name"));
    expect(slots).toEqual(["{name}", "{name}"]);
  });

  it("panels: the notice on the row template, the card fields on the bound GridList", async () => {
    const { workspace, grid, items } = await open();
    useDataStore.setState({
      collections: new Map(COLLECTIONS.map((table) => [table.id, table])),
    } as never);
    const view = render(
      <I18nProvider initialLocale="en-US">
        <CatalogWorkspaceProvider workspace={workspace}>
          <CatalogItemOriginNotice target={items[0]!.target} />
          <CatalogItemOriginNotice target={items[1]!.target} />
          <CatalogCardFieldsSection identity={grid.identity} />
        </CatalogWorkspaceProvider>
      </I18nProvider>,
    );
    expect(screen.getAllByText("Item origin")).toHaveLength(1);
    expect(
      view.container.querySelectorAll("[data-item-origin-notice]"),
    ).toHaveLength(1);
    expect(screen.getByText("Card fields")).toBeTruthy();
    expect(screen.getAllByText(/Text · children/)).toHaveLength(2);
  });

  it("a bound ListBox has no card fields (GridList only)", async () => {
    const library = await buildCodeCatalogLibrary();
    const { workspace, graph } = await open();
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: BODY },
        entries: [
          {
            kind: "node",
            id: "project:node:list" as NodeId,
            definitionId: catalogPaletteDefinitionId(library, "ListBox"),
            children: [],
            props: {},
            visual: {},
            sizing: {},
            descendantOverrides: [],
            binding: BINDING,
          },
        ],
        rootIds: ["project:node:list" as NodeId],
        newId: workspace.newId,
      }),
    );
    const [body] = pagePositions(graph, HOME);
    const list = childPositions(graph, body!).find(
      (position) =>
        position.target.kind === "node" &&
        position.target.id === "project:node:list",
    )!;
    expect(
      catalogRowTemplateId(graph, "project:node:list" as NodeId),
    ).toBeTruthy();
    expect(catalogCardFields(graph, list)).toBeUndefined();
  });

  it("Properties field source: {field} columns inside the row template; {{ names the element sees", async () => {
    const { workspace, graph, items } = await open();
    useDataStore.setState({
      collections: new Map(COLLECTIONS.map((table) => [table.id, table])),
      variables: new Map(),
    } as never);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <CatalogWorkspaceProvider workspace={workspace}>
        {children}
      </CatalogWorkspaceProvider>
    );
    const [label] = childPositions(graph, items[0]!);
    const fields = (identity: string) =>
      renderHook(() => CATALOG_FIELD_VALUE_SOURCE.useOwnerFields!(identity), {
        wrapper,
      }).result.current;
    expect(fields(label!.identity)?.map((field) => field.key)).toEqual([
      "id",
      "name",
      "size",
    ]);
    // Another row, the list itself: no owner.
    expect(fields(items[1]!.identity)).toBeNull();
    expect(fields(workspace.root.recordsOfSource(GRID)[0]!)).toBeNull();

    const names = renderHook(
      () => CATALOG_FIELD_VALUE_SOURCE.useVariableNames!(label!.identity),
      { wrapper },
    );
    expect(names.result.current).toEqual([]);
    act(() => {
      workspace.execute(
        catalogVariableCommands.add(GRID, "selected", workspace.newId),
      );
      workspace.execute(
        catalogVariableCommands.add(HOME, "query", workspace.newId),
      );
    });
    expect(names.result.current).toEqual(["selected", "query"]);
  });
});

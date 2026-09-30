import { beforeAll, describe, expect, it } from "vitest";
import { applyCatalogTransaction } from "../../transactions/transaction";
import { insertCollectionItem } from "../../commands/collections";
import { removeTargets } from "../../commands/structure";
import {
  allocator,
  documentOf,
  node,
  PAGE,
  run,
  text,
} from "../../commands/__tests__/fixture";
import {
  buildCodeCatalogLibrary,
  catalogTypeDefinitionId,
} from "../../document/codeCatalogLibrary";
import { REUSABLE_ORIGIN_DEFINITIONS } from "../../document/generated/reusableOriginLibrary";
import { CatalogGraph } from "../../document/graph";
import type {
  CatalogLibrary,
  DefinitionId,
  NodeEntry,
  NodeId,
  TemplateId,
} from "../../document/types";
import {
  childPositions,
  pagePositions,
  type CatalogPosition,
} from "../positions";
import { resolveCatalogNode, type ResolvedCatalogNode } from "../resolver";

/**
 * ADR-248 Phase 4c — position enumeration against the resolver: walking `pagePositions` /
 * `childPositions` gives the resolved tree's element identities in the same order, with each
 * composite root collapsed into its instance (the consumer tree), for every code library origin
 * and for fills, replacements, switched-off positions and nested instance overrides.
 */
let library: CatalogLibrary;
beforeAll(async () => {
  library = await buildCodeCatalogLibrary();
});

interface Row {
  identity: string;
  children: Row[];
}
const identity = (node: ResolvedCatalogNode) =>
  `${node.instancePath.join("/")}::${node.sourceId}`;
const rootOf = (graph: CatalogGraph, definitionId: DefinitionId) => {
  const definition = definitionId.startsWith("lib:")
    ? graph.library.definitions.get(definitionId as never)
    : (graph.getEntry(definitionId) as {
        mode: string;
        templateRootId?: string;
      });
  return definition?.mode === "composite"
    ? definition.templateRootId
    : undefined;
};
/** The consumer tree of a resolved node: composite roots collapse into their instance. */
function resolvedRows(graph: CatalogGraph, parent: ResolvedCatalogNode): Row[] {
  const rootPath =
    parent.sourceId.startsWith("lib:") || !graph.getEntry(parent.sourceId)
      ? [...parent.instancePath, parent.sourceId]
      : parent.instancePath;
  const rootId = rootOf(graph, parent.definitionId);
  return parent.children.flatMap((child) =>
    rootId &&
    child.sourceId === rootId &&
    child.instancePath.join("/") === rootPath.join("/")
      ? resolvedRows(graph, child)
      : [{ identity: identity(child), children: resolvedRows(graph, child) }],
  );
}
function positionRows(
  graph: CatalogGraph,
  positions: readonly CatalogPosition[],
): Row[] {
  return positions
    .filter((position) => !position.disabled)
    .map((position) => ({
      identity: position.identity,
      children: positionRows(graph, childPositions(graph, position)),
    }));
}
const pageRows = (graph: CatalogGraph): Row[] =>
  positionRows(graph, pagePositions(graph, PAGE));
const resolvedPage = (graph: CatalogGraph, roots: readonly NodeId[]): Row[] =>
  roots.map((id) => {
    const resolved = resolveCatalogNode(graph, id);
    return {
      identity: identity(resolved),
      children: resolvedRows(graph, resolved),
    };
  });

const id = (name: string) => `project:node:${name}` as NodeId;
const T = (name: string) => `lib:template:component-${name}` as TemplateId;
const ORIGIN = (name: string) =>
  `lib:definition:origin-component-${name}` as NodeEntry["definitionId"];

describe("ADR-248 Phase 4c position enumeration", () => {
  it("matches the resolved tree for an instance of every code library origin", () => {
    const origins = REUSABLE_ORIGIN_DEFINITIONS.map((definition, index) =>
      node(`origin${index}`, definition.id as NodeEntry["definitionId"]),
    );
    const graph = new CatalogGraph(
      documentOf(
        origins,
        origins.map((entry) => entry.id.slice("project:node:".length)),
      ),
      library,
    );
    const rows = pageRows(graph);
    expect(rows).toEqual(
      resolvedPage(
        graph,
        origins.map((entry) => entry.id),
      ),
    );
    // Instances show their template content (not empty rows).
    const count = (list: Row[]): number =>
      list.reduce((sum, row) => sum + 1 + count(row.children), 0);
    expect(count(rows)).toBeGreaterThan(origins.length * 2);
  });

  it("matches the resolved tree with fills, replacements, switched-off positions and nested overrides", () => {
    const tabs = id("tabs");
    const list = id("list");
    const icon = id("icon");
    const graph = new CatalogGraph(
      documentOf(
        [
          node("tabs", ORIGIN("tabs")),
          node("list", ORIGIN("listbox")),
          node("icon", ORIGIN("iconbutton")),
          node("off", catalogTypeDefinitionId("Text") as never, {
            enabled: false,
          }),
        ],
        ["tabs", "list", "icon", "off"],
      ),
      library,
    );
    const newId = allocator();
    // A Tab added to the instance's TabList: the list position becomes an owned fill.
    run(
      graph,
      insertCollectionItem({
        host: {
          kind: "descendant",
          ownerId: tabs,
          address: {
            instances: [tabs],
            templatePath: [T("tabs"), T("tabs__1")],
          },
        },
        entries: [node("tab3", ORIGIN("tab-item-default"))],
        rootId: id("tab3"),
        key: "k3",
        panel: node("panel3", catalogTypeDefinitionId("TabPanel") as never),
        newId,
      }),
    );
    // A nested instance position switched off (ListBox item 1's description role).
    run(
      graph,
      removeTargets({
        targets: [
          {
            kind: "descendant",
            ownerId: list,
            address: {
              instances: [list, T("listbox__item-1")],
              templatePath: [
                T("listbox-item-default"),
                T("listbox-item-default__description"),
              ],
            },
          },
        ],
      }),
    );
    // The IconButton label replaced by an owned text.
    applyCatalogTransaction(graph, {
      projectId: graph.projectId,
      expectedRevision: graph.revision,
      history: { kind: "record", label: "replace" },
      ops: [
        { kind: "put", entry: text("replacement", "Replaced") },
        {
          kind: "upsertDescendant",
          id: icon,
          override: {
            kind: "replace",
            address: {
              instances: [icon],
              templatePath: [T("iconbutton"), T("iconbutton__label")],
            },
            replacementId: id("replacement"),
          },
        },
      ],
    });
    expect(pageRows(graph)).toEqual(resolvedPage(graph, [tabs, list, icon]));
    // The switched-off owned node stays listed (so it can be switched on), flagged.
    expect(
      pagePositions(graph, PAGE).find(
        (position) => position.sourceId === id("off"),
      ),
    ).toMatchObject({ disabled: true });
  });

  it("gives each template position an edit target the commands accept", () => {
    const list = id("list");
    const graph = new CatalogGraph(
      documentOf([node("list", ORIGIN("listbox"))], ["list"]),
      library,
    );
    const [listRow] = pagePositions(graph, PAGE);
    const [item1] = childPositions(graph, listRow);
    const description = childPositions(graph, item1).at(-1)!;
    expect(description.target).toEqual({
      kind: "descendant",
      ownerId: list,
      address: {
        instances: [list, T("listbox__item-1")],
        templatePath: [
          T("listbox-item-default"),
          T("listbox-item-default__description"),
        ],
      },
    });
    run(graph, removeTargets({ targets: [description.target] }));
    expect(
      childPositions(graph, item1).map((row) => row.sourceId),
    ).not.toContain(T("listbox-item-default__description"));
  });
});

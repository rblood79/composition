import { expect } from "vitest";
import { CatalogGraph } from "../../document/graph";
import { buildCatalogLibrary } from "../../document/library";
import type {
  CatalogDocument,
  CatalogEntry,
  EntryId,
  EntryKind,
  NodeEntry,
  NodeId,
  PageEntry,
  ProjectEntry,
} from "../../document/types";
import { CatalogValidationError } from "../../document/validation";
import {
  resolveCatalogNode,
  type ResolvedCatalogNode,
} from "../../resolution/resolver";
import { applyCatalogTransaction } from "../../transactions/transaction";
import type { CatalogCommand } from "../compose";

/**
 * Shared fixture of the ADR-248 Phase 4b command tests: a library with a structural container
 * (Section, and Body — the page body), a collection (ListBox → ListBoxItem), a text leaf, and composites (Badge; Panel with
 * a nested Badge; Picker with a `{label}` title, a ListBox of two items and a nested Badge).
 */
export const library = () =>
  buildCatalogLibrary({
    contractVersion: 9,
    revision: "phase4b-structure",
    bindingIds: ["section", "text", "listbox", "item"],
    actionOpCodes: ["setState", "capability", "navigate"],
    triggerIds: ["press"],
    capabilityIds: ["selectItem"],
    definitions: [
      {
        id: "lib:definition:section",
        name: "Section",
        mode: "native",
        bindingId: "section",
        accepts: {},
        defaults: {},
        visual: {},
        stateRules: {},
      },
      {
        // The page body (a layout applied to a body page makes the body its instance).
        id: "lib:definition:type-body",
        name: "Body",
        mode: "native",
        bindingId: "section",
        accepts: {},
        defaults: {},
        visual: {},
        stateRules: {},
      },
      {
        id: "lib:definition:text",
        name: "Text",
        mode: "primitive",
        bindingId: "text",
        accepts: { children: "string" },
        defaults: { children: "" },
        visual: {},
        stateRules: {},
      },
      {
        id: "lib:definition:listbox",
        name: "ListBox",
        mode: "primitive",
        bindingId: "listbox",
        accepts: { items: "items" },
        defaults: { items: [{ id: "d1", label: "Default" }] },
        visual: {},
        stateRules: {},
      },
      {
        id: "lib:definition:item",
        name: "ListBoxItem",
        mode: "primitive",
        bindingId: "item",
        accepts: { children: "string" },
        defaults: {},
        visual: {},
        stateRules: {},
      },
      {
        id: "lib:definition:badge",
        name: "Badge",
        mode: "composite",
        templateRootId: "lib:template:badgeRoot",
        accepts: {},
        defaults: {},
        visual: {},
        stateRules: {},
      },
      {
        id: "lib:definition:panel",
        name: "Panel",
        mode: "composite",
        templateRootId: "lib:template:panelRoot",
        accepts: {},
        defaults: {},
        visual: {},
        stateRules: {},
      },
      {
        id: "lib:definition:picker",
        name: "Picker",
        mode: "composite",
        templateRootId: "lib:template:pickRoot",
        accepts: { label: "string" },
        defaults: { label: "Pick" },
        visual: {},
        stateRules: {},
      },
    ],
    templates: [
      {
        id: "lib:template:badgeRoot",
        definitionId: "lib:definition:section",
        children: ["lib:template:badgeText"],
        props: {},
        visual: {},
      },
      {
        id: "lib:template:badgeText",
        definitionId: "lib:definition:text",
        children: [],
        props: { children: "badge" },
        visual: {},
      },
      {
        id: "lib:template:panelRoot",
        definitionId: "lib:definition:section",
        children: ["lib:template:panelBadge"],
        props: {},
        visual: {},
      },
      {
        id: "lib:template:panelBadge",
        definitionId: "lib:definition:badge",
        children: [],
        props: {},
        visual: {},
      },
      {
        id: "lib:template:pickRoot",
        definitionId: "lib:definition:section",
        children: [
          "lib:template:title",
          "lib:template:list",
          "lib:template:badge",
        ],
        props: {},
        visual: {},
      },
      {
        id: "lib:template:title",
        definitionId: "lib:definition:text",
        children: [],
        props: { children: "{label}" },
        visual: {},
      },
      {
        id: "lib:template:list",
        definitionId: "lib:definition:listbox",
        children: ["lib:template:item1", "lib:template:item2"],
        props: {},
        visual: {},
      },
      {
        id: "lib:template:item1",
        definitionId: "lib:definition:item",
        children: [],
        props: { children: "One" },
        visual: {},
      },
      {
        id: "lib:template:item2",
        definitionId: "lib:definition:item",
        children: [],
        props: { children: "Two" },
        visual: {},
      },
      {
        id: "lib:template:badge",
        definitionId: "lib:definition:badge",
        children: [],
        props: {},
        visual: {},
      },
    ],
    tokens: [],
  });

export const PAGE = "project:page:main" as const;
export const PROJECT = "project:project:p" as const;
export const node = (
  id: string,
  definitionId: NodeEntry["definitionId"],
  patch: Partial<NodeEntry> = {},
): NodeEntry => ({
  kind: "node",
  id: `project:node:${id}` as NodeId,
  definitionId,
  children: [],
  props: {},
  visual: {},
  sizing: {},
  descendantOverrides: [],
  ...patch,
});
export function graphOf(
  nodes: NodeEntry[],
  roots: string[],
  extra: CatalogEntry[] = [],
) {
  return new CatalogGraph(documentOf(nodes, roots, extra), library());
}
/** The fixture document: one page with `roots`, the nodes, and project records in `extra`. */
export function documentOf(
  nodes: NodeEntry[],
  roots: string[],
  extra: CatalogEntry[] = [],
): CatalogDocument {
  const project: ProjectEntry = {
    kind: "project",
    id: PROJECT,
    name: "p",
    pageIds: [PAGE],
    definitionIds: extra
      .filter((entry) => entry.kind === "definition")
      .map((entry) => entry.id as EntryId<"definition">),
    overrideIds: [],
    themeIds: [],
    tokenIds: [],
    stateVariableIds: extra
      .filter((entry) => entry.kind === "stateVariable")
      .map((entry) => entry.id as EntryId<"stateVariable">),
    interactionIds: extra
      .filter((entry) => entry.kind === "interaction")
      .map((entry) => entry.id as EntryId<"interaction">),
    assetIds: [],
  };
  const document: CatalogDocument = {
    format: "composition-catalog",
    schemaVersion: 1,
    libraryContractVersion: 9,
    revision: 0,
    projectId: PROJECT,
    rootId: PROJECT,
    entries: Object.fromEntries(
      [
        project,
        {
          kind: "page",
          id: PAGE,
          route: "/",
          name: "main",
          children: roots.map((id) => `project:node:${id}` as NodeId),
        } as PageEntry,
        ...nodes,
        ...extra,
      ].map((entry) => [entry.id, entry]),
    ),
  };
  return document;
}
export const allocator = () => {
  let next = 0;
  return <K extends EntryKind>(kind: K) =>
    `project:${kind}:n${++next}` as EntryId<K>;
};
export function run(graph: CatalogGraph, command: CatalogCommand) {
  const plan = command(graph);
  const before = graph.history.length;
  const result = applyCatalogTransaction(graph, {
    projectId: graph.projectId,
    expectedRevision: graph.revision,
    history: { kind: "record", label: plan.label },
    ops: plan.ops,
  });
  expect(graph.history.length).toBe(before + 1);
  return { plan, result };
}
export const undo = (graph: CatalogGraph, inverse: readonly unknown[]) =>
  applyCatalogTransaction(graph, {
    projectId: graph.projectId,
    expectedRevision: graph.revision,
    history: { kind: "record", label: "undo" },
    ops: inverse as never,
  });
export const snapshot = (graph: CatalogGraph) =>
  JSON.stringify(
    Object.entries(graph.exportDocument().entries).sort(([a], [b]) =>
      a.localeCompare(b),
    ),
  );
export const code = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    if (error instanceof CatalogValidationError) return error.code;
    throw error;
  }
  return "ACCEPTED";
};
/** What a consumer sees: definitions, props and visual, by position (IDs dropped). */
export const view = (node: ResolvedCatalogNode): unknown => ({
  definitionId: node.definitionId,
  props: node.props,
  visual: node.visual,
  children: node.children.map(view),
});
export const pageView = (graph: CatalogGraph) =>
  (graph.getEntry(PAGE) as PageEntry).children.map((id) =>
    view(resolveCatalogNode(graph, id)),
  );
export const children = (graph: CatalogGraph, id: string) => {
  const entry = graph.getEntry(id);
  return entry?.kind === "page" || entry?.kind === "node" ? entry.children : [];
};
export const text = (id: string, value: string) =>
  node(id, "lib:definition:text", {
    props: { children: { kind: "set", value } },
  });

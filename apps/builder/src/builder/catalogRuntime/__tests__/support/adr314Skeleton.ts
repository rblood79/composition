/**
 * ADR-314 — a project with a Skeleton on the home page (the palette origin with types placed inside,
 * or a bare Skeleton owning a Text), shared by the Phase 2 · 3 tests.
 */
import { renderToStaticMarkup } from "react-dom/server";
import {
  insertNodes,
  setFields,
} from "../../../../../../../packages/shared/src/catalog/commands";
import { CatalogGraph } from "../../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import type { CatalogConsumerNode } from "../../../../../../../packages/shared/src/catalog/runtime/compositionRoot";
import { renderCatalogDom } from "../../domBinding";
import {
  catalogPaletteDefinitionId,
  catalogPaletteInsertPlan,
} from "../../paletteInsert";
import { newCatalogProjectDocument } from "../../project";
import { CatalogStorage } from "../../storage";
import { CatalogWorkspace } from "../../workspace";
import { nodeLayoutEngine } from "./nodeLayoutEngine";

export const SKELETON = "project:node:skeleton" as NodeId;
export const BODY = "project:node:home-body" as NodeId;

export async function openSkeleton(inside: readonly string[]) {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr314-context" as const,
        name: "ADR-314 context",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr314-context-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: SKELETON,
          definitionId: catalogPaletteDefinitionId(library, "Skeleton"),
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [SKELETON],
      newId: workspace.newId,
    }),
  );
  const root = workspace.root;
  const skeletonRecord = () =>
    [...root.domInputs.values()].find((item) => item.sourceId === SKELETON)!;
  // The palette puts each type inside the selected Skeleton (its origin root is a slot).
  for (const type of inside) {
    workspace.selectRecords([skeletonRecord().id]);
    const plan = catalogPaletteInsertPlan(
      {
        graph: workspace.runtime.graph,
        records: workspace.root.domInputs,
        selection: () => workspace.session.getSnapshot().selection,
        itemOfRecord: (identity) => workspace.itemOfRecord(identity),
        pageContent: () => ({ kind: "node", id: BODY }),
        newId: workspace.newId,
      },
      type,
    );
    if (!plan.command || plan.relocated) throw new Error(`${type} not inside`);
    workspace.execute(plan.command);
  }
  const below = (record: CatalogConsumerNode): CatalogConsumerNode[] =>
    record.children.flatMap((id) => {
      const child = root.domInputs.get(id)!;
      return [child, ...below(child)];
    });
  const ofType = (type: string, under = skeletonRecord()) =>
    below(under).filter((record) => root.typeOf(record) === type);
  const html = () =>
    renderToStaticMarkup(renderCatalogDom(root, skeletonRecord().id));
  const setLoading = (value: boolean) =>
    workspace.execute(
      setFields({
        targets: [{ kind: "node", id: SKELETON }],
        props: { isLoading: { kind: "set", value } },
      }),
    );
  return { workspace, root, skeletonRecord, ofType, html, setLoading };
}

/** A Skeleton of the bare type (not the origin) owning a Text — no instance to re-resolve. */
export async function openOwnedSkeleton() {
  const library = await buildCodeCatalogLibrary();
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr314-owned" as const,
        name: "ADR-314 owned",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr314-owned-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1000, height: 800 },
      autosaveSchedule: () => {},
    },
  );
  const text = "project:node:owned-text" as NodeId;
  workspace.execute(
    insertNodes({
      parent: { kind: "node", id: BODY },
      entries: [
        {
          kind: "node",
          id: SKELETON,
          definitionId: "lib:definition:type-Skeleton",
          children: [text],
          props: { isLoading: { kind: "set", value: true } },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
        {
          kind: "node",
          id: text,
          definitionId: catalogPaletteDefinitionId(library, "Text"),
          children: [],
          props: { children: { kind: "set", value: "Owned" } },
          visual: {},
          sizing: {},
          descendantOverrides: [],
        } as NodeEntry,
      ],
      rootIds: [SKELETON],
      newId: workspace.newId,
    }),
  );
  const textRecord = () =>
    [...workspace.root.domInputs.values()].find(
      (item) => item.sourceId === text,
    )!;
  return { workspace, textRecord };
}

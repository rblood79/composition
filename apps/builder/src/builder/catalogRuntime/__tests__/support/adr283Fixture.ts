import "fake-indexeddb/auto";
import { CatalogGraph } from "../../../../../../../packages/shared/src/catalog/document/graph";
import { buildCodeCatalogLibrary } from "../../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  CatalogLibrary,
  EntryId,
  InteractionEntry,
  NodeEntry,
  NodeId,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import {
  createComponent,
  insertNodes,
} from "../../../../../../../packages/shared/src/catalog/commands";
import type { CatalogBoundRow } from "../../../../../../../packages/shared/src/catalog/resolution/resolver";
import { newCatalogProjectDocument } from "../../project";
import { CatalogStorage } from "../../storage";
import { CatalogWorkspace } from "../../workspace";
import { nodeLayoutEngine } from "./nodeLayoutEngine";
import { catalogPaletteDefinitionId } from "../../paletteInsert";
import { catalogBindingRef } from "../../dataBinding";
import { catalogBindingCommand } from "../../dataBindingCommand";
import {
  catalogInteractionsCommand,
  catalogNewInteraction,
} from "../../interactions";

/**
 * ADR-283 breakdown §1d fixture: a page with a Local component 「OrderCard」 (Button Save · Button
 * Edit) placed twice, a GridList bound to 3 rows whose row template holds Button Delete and a
 * Text, and a page Button Toggle.
 */
export const BODY = "project:node:home-body" as NodeId;
export const LIST = "project:node:list" as NodeId;
export const DELETE = "project:node:delete" as NodeId;
export const ROW_TEXT = "project:node:row-text" as NodeId;
export const CARD = "project:node:card" as NodeId;
export const SAVE = "project:node:save" as NodeId;
export const EDIT = "project:node:edit" as NodeId;
export const TOGGLE = "project:node:toggle" as NodeId;
export const SECOND = "project:node:second-card" as NodeId;

let library: CatalogLibrary | undefined;

export async function openAdr283Fixture(
  options: {
    /** Runs before OrderCard is made a component (rules on its page nodes then). */
    beforeComponent?: (
      rule: (
        ownerId: NodeId,
        trigger: string,
        action: InteractionEntry["actions"][number],
      ) => string,
      library: CatalogLibrary,
    ) => void;
  } = {},
) {
  library ??= await buildCodeCatalogLibrary();
  const rows: CatalogBoundRow[] = ["aaaa", "bbbb", "cccc"].map((key) => ({
    key,
    values: { id: key, label: key, name: key },
  }));
  const workspace = new CatalogWorkspace(
    new CatalogGraph(
      newCatalogProjectDocument({
        projectId: "project:project:adr283" as EntryId<"project">,
        name: "ADR-283",
      }),
      library,
    ),
    new CatalogStorage(indexedDB, `adr283-${Math.random()}`),
    {
      engine: await nodeLayoutEngine(),
      viewport: { width: 1200, height: 900 },
      autosaveSchedule: () => {},
      root: { rows: () => rows },
    },
  );
  const graph = workspace.runtime.graph;
  const node = (id: string, type: string, extra: Partial<NodeEntry> = {}) =>
    ({
      kind: "node",
      id,
      definitionId: catalogPaletteDefinitionId(library!, type),
      children: [],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
      ...extra,
    }) as unknown as NodeEntry;
  const insert = (parent: NodeId, entries: NodeEntry[]) =>
    workspace.execute(
      insertNodes({
        parent: { kind: "node", id: parent },
        entries,
        rootIds: entries.map((entry) => entry.id),
        newId: workspace.newId,
      }),
    );
  insert(BODY, [node(LIST, "GridList"), node(TOGGLE, "Button")]);
  workspace.execute(
    catalogBindingCommand(
      [{ kind: "node", id: LIST }],
      catalogBindingRef({ source: "dataTable", collectionId: "users", name: "Users" })!,
      workspace.newId,
    ),
  );
  const fill = (graph.getEntry(LIST) as NodeEntry).descendantOverrides.find(
    (override) => override.kind === "fillSlot",
  ) as { childIds: readonly NodeId[] };
  const item = fill.childIds[0]!;
  insert(item, [node(DELETE, "Button"), node(ROW_TEXT, "Text")]);
  // OrderCard: a frame with Save · Edit made a component; a second instance of it.
  insert(BODY, [node(CARD, "frame", { name: "OrderCard" })]);
  insert(CARD, [
    node(SAVE, "Button", { name: "Save" }),
    node(EDIT, "Button", { name: "Edit" }),
  ]);
  /** One rule on `ownerId` (the Interactions panel's command). */
  const rule = (
    ownerId: NodeId,
    trigger: string,
    action: InteractionEntry["actions"][number],
  ) => {
    const owner = { ownerId };
    const entry = catalogNewInteraction(owner, trigger, action, workspace.newId);
    workspace.execute(
      catalogInteractionsCommand(
        owner,
        [
          ...[...graph.referrersOf(ownerId)]
            .map((id) => graph.getEntry(id))
            .filter(
              (item): item is InteractionEntry =>
                item?.kind === "interaction" && item.ownerId === ownerId && !item.address,
            ),
          entry,
        ],
        "Rules",
      ),
    );
    return entry.id;
  };
  options.beforeComponent?.(rule, library!);
  workspace.execute(
    createComponent({ id: CARD, name: "OrderCard", newId: workspace.newId }),
  );
  const project = graph.getEntry(graph.projectId);
  const definitionId =
    project?.kind === "project" ? project.definitionIds.at(-1)! : "";
  insert(BODY, [
    {
      kind: "node",
      id: SECOND,
      definitionId,
      children: [],
      props: {},
      visual: {},
      sizing: {},
      descendantOverrides: [],
    } as unknown as NodeEntry,
  ]);
  const body = graph.getEntry(BODY) as NodeEntry;
  const first = body.children.find(
    (id) =>
      id !== SECOND &&
      (graph.getEntry(id) as NodeEntry).definitionId === definitionId,
  )!;
  const records = () => [...workspace.root.domInputs.values()];
  /** The records drawing `sourceId` (each row / instance). */
  const recordsOf = (sourceId: string) =>
    workspace.root.recordsOfSource(sourceId).map((id) => workspace.root.domInputs.get(id)!);
  /** The record of `sourceId` whose ancestor chain holds the record `ancestorId`. */
  const recordUnder = (sourceId: string, ancestorId: string) =>
    recordsOf(sourceId).find((record) => {
      for (let at: string | undefined = record.id; at; at = workspace.root.domInputs.get(at)?.parentId)
        if (at === ancestorId) return true;
      return false;
    });
  return {
    workspace,
    graph,
    library: library!,
    definitionId: definitionId as EntryId<"definition">,
    item,
    first: first as NodeId,
    second: SECOND,
    rule,
    records,
    recordsOf,
    recordUnder,
  };
}

import type { DataChange, DataOp } from "@composition/shared";
import {
  insertTableColumns,
  tableHeaderColumns,
  tableHeaderPosition,
} from "../../../../../../../packages/shared/src/catalog/commands";
import {
  composeCommands,
  type CatalogCommand,
} from "../../../../../../../packages/shared/src/catalog/commands/compose";
import { catalogTypeDefinitionId } from "../../../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type {
  NodeEntry,
  NodeId,
  NodeParent,
} from "../../../../../../../packages/shared/src/catalog/document/types";
import type {
  DataField,
  DataTable,
} from "../../../../types/builder/data.types";
import {
  catalogBindingCommand,
  catalogCollectionId,
} from "../../../catalogRuntime/dataBinding";
import { dataChangeEffect } from "../../../catalogRuntime/dataHistory";
import { catalogTargetTypeName } from "../../../catalogRuntime/interactions";
import { catalogRouteIdOf } from "../../../catalogRuntime/project";
import type { CatalogWorkspace } from "../../../catalogRuntime/workspace";
import type { QuickConnectTarget } from "../types/editorTypes";
import { resolveColumnMode, type TableColumnPlan } from "../utils/quickConnect";
import type { QuickConnectHost } from "./quickConnectHost";

const COLUMN_ORIGIN =
  "lib:definition:origin-component-table-column" as NodeEntry["definitionId"];

interface DataStoreAccess {
  apply(
    change: DataChange,
    options: { record: false; projectId?: string },
  ): Promise<{ applied: DataOp[]; inverse: DataOp[] }>;
  collection(id: string): DataTable | undefined;
}

/**
 * ADR-248 Phase 4e-4e: quick connect over the catalog document — the target is an owned node
 * (the record the Properties panel shows); create + connect is **one history entry**: the new
 * collection (data store, H1) is its outside effect, the Table columns (`insertTableColumns` on
 * the table's header position) and the typed binding its document part. A failed document part
 * removes the collection again (nothing is reported as done).
 */
export function createCatalogQuickConnectHost(
  workspace: CatalogWorkspace,
  store: DataStoreAccess,
  label: (name: string) => string,
): QuickConnectHost {
  const graph = () => workspace.runtime.graph;
  const nodeOf = (id: string) => {
    const entry = graph().getEntry(id);
    return entry?.kind === "node" ? entry : undefined;
  };
  const pageOf = (id: string): string | null => {
    for (let at: string | undefined = id; at; at = graph().ownerOf(at))
      if (graph().getEntry(at)?.kind === "page") return at;
    return null;
  };
  const bindingSnapshot = (id: string) => ({
    props: nodeOf(id)?.binding,
  });
  const header = (target: QuickConnectTarget): NodeParent | undefined =>
    target.elementType === "Table"
      ? tableHeaderPosition(graph(), target.elementId as NodeId)
      : undefined;
  const plan = (target: QuickConnectTarget): TableColumnPlan | null => {
    const position = header(target);
    if (!position) return null;
    return {
      tableId: target.elementId,
      tableHeaderId:
        position.kind === "descendant"
          ? position.address.templatePath.at(-1)!
          : position.id,
      pageId: target.pageId,
      existing: tableHeaderColumns(graph(), position).map((column) => ({
        id: column.key,
        ...column,
      })),
      ...(position.kind === "descendant" ? { instance: true } : {}),
    };
  };

  const host: QuickConnectHost = {
    capture(identity) {
      const target = workspace.itemOfRecord(identity)?.target;
      if (target?.kind !== "node") return null;
      const node = nodeOf(target.id);
      if (!node) return null;
      const type = catalogTargetTypeName(graph(), target);
      return {
        elementId: node.id,
        pageId: pageOf(node.id),
        elementType: type,
        elementLabel: node.name || type,
        binding: bindingSnapshot(node.id),
      };
    },
    precheck(target, projectId) {
      if (!nodeOf(target.elementId)) return { ok: false, reason: "missing" };
      if (
        pageOf(target.elementId) !== target.pageId ||
        catalogRouteIdOf(workspace.projectId) !== projectId
      )
        return { ok: false, reason: "context" };
      if (
        JSON.stringify(bindingSnapshot(target.elementId)) !==
        JSON.stringify(target.binding)
      )
        return { ok: false, reason: "binding-changed" };
      return { ok: true };
    },
    planColumns: plan,
    async execute({ input, target, projectId, replaceColumns = false }) {
      const schema = (input.schema ?? []) as DataField[];
      const collectionId = crypto.randomUUID();
      const created = await store.apply(
        {
          ops: [
            {
              op: "create_collection",
              id: collectionId,
              projectId: input.project_id,
              name: input.name,
              schema,
              rows: input.mockData ?? [],
              source: (input.useMockData ?? true) ? "manual" : "api",
            },
          ],
          origin: "user",
        },
        { record: false, projectId },
      );
      const undoCreate = () =>
        store.apply(
          { ops: created.inverse, origin: "user" },
          { record: false, projectId },
        );
      try {
        // The target may have changed while the collection was saved.
        const recheck = host.precheck(target, projectId);
        if (!recheck.ok) throw new Error(`QUICK_CONNECT_${recheck.reason}`);
        const position = header(target);
        const mode = resolveColumnMode(plan(target), replaceColumns);
        const commands: CatalogCommand[] = [];
        if (position && (mode === "create" || mode === "replace"))
          commands.push(
            insertTableColumns({
              header: position,
              columns: schema.map((field) => ({
                key: field.key,
                label: field.label ?? field.key,
              })),
              replace: mode === "replace",
              buildColumn: () => {
                const id = workspace.newId("node") as NodeId;
                return {
                  entries: [column(id, COLUMN_ORIGIN)],
                  rootId: id,
                };
              },
              buildCell: () => {
                const id = workspace.newId("node") as NodeId;
                return {
                  entries: [
                    column(
                      id,
                      catalogTypeDefinitionId(
                        "Cell",
                      ) as NodeEntry["definitionId"],
                    ),
                  ],
                  rootId: id,
                };
              },
              newId: workspace.newId,
            }),
          );
        commands.push(
          catalogBindingCommand(
            [{ kind: "node", id: target.elementId as NodeId }],
            {
              collectionId: catalogCollectionId(collectionId),
              fieldMap: {},
            },
          ),
        );
        const name = label(input.name);
        workspace.recordExternal(
          name,
          dataChangeEffect(
            {
              change: { ops: created.applied, origin: "user", label: name },
              inverse: created.inverse,
            },
            (change, options) => store.apply(change, { ...options, projectId }),
          ),
          // The connected node stays selected (the new columns are not selected).
          (reader) => {
            const { selectAfter: _selectAfter, ...plan } =
              commands.length > 1
                ? composeCommands(graph(), name, commands)
                : commands[0]!(reader);
            return plan;
          },
        );
      } catch (error) {
        await undoCreate();
        throw error;
      }
      const table = store.collection(collectionId);
      if (!table) throw new Error("QUICK_CONNECT_COLLECTION_MISSING");
      return table;
    },
    readBack(elementId, collectionId) {
      return (
        nodeOf(elementId)?.binding?.collectionId ===
        catalogCollectionId(collectionId)
      );
    },
  };
  return host;
}

function column(
  id: NodeId,
  definitionId: NodeEntry["definitionId"],
): NodeEntry {
  return {
    kind: "node",
    id,
    definitionId,
    children: [],
    props: {},
    visual: {},
    sizing: {},
    descendantOverrides: [],
  };
}

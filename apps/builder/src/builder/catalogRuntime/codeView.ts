/**
 * ADR-284 Phase 6 — the code view in the builder: the page's document generated as React Aria code
 * (`packages/shared/src/codeView/generate.ts`) and an edit of it applied back through the 1:1
 * positions only (`inverse.ts`) — each edit one existing command (rename · default · condition ·
 * sort · When), the whole application one step (one Undo). A change outside the positions applies
 * nothing; the panel names its lines.
 */
import {
  stageOver,
  type CatalogCommand,
  type CatalogCommandPlan,
} from "../../../../../packages/shared/src/catalog/commands/compose";
import { updateRecord } from "../../../../../packages/shared/src/catalog/commands/project";
import { updateView } from "../../../../../packages/shared/src/catalog/commands/views";
import type { CatalogReader } from "../../../../../packages/shared/src/catalog/transactions/transaction";
import type {
  EntryId,
  InteractionEntry,
  StateVariableEntry,
  ViewCondition,
  ViewConditionGroup,
  ViewQuery,
} from "../../../../../packages/shared/src/catalog/document/types";
import { generateCodeView } from "../../../../../packages/shared/src/codeView/generate";
import {
  codeViewInverse,
  type CodeViewEdit,
  type CodeViewInverse,
} from "../../../../../packages/shared/src/codeView/inverse";
import type {
  CodeViewCollection,
  CodeViewEndpoint,
  CodeViewReader,
  CodeViewResult,
  CodeViewViewOwner,
} from "../../../../../packages/shared/src/codeView/types";
import { resolveTriggers } from "../../../../../packages/shared/src/interactions/capabilityRegistry";
import type { ApiEndpoint, DataTable } from "../../types/builder/data.types";
import { catalogBindingCommand } from "./dataBindingCommand";

/** The data store's tables and endpoints as the generator reads them. */
export function catalogCodeViewData(
  tables: readonly DataTable[],
  endpoints: readonly ApiEndpoint[],
): { collections: CodeViewCollection[]; endpoints: CodeViewEndpoint[] } {
  const url = (endpoint: ApiEndpoint) =>
    `${endpoint.baseUrl ?? ""}${endpoint.path ?? ""}`;
  return {
    collections: tables.map((table) => {
      const endpoint = table.useMockData
        ? undefined
        : endpoints.find((item) => item.targetCollectionId === table.id);
      return {
        id: table.id,
        name: table.name,
        schema: table.schema.map((field) => ({
          ...(field.id ? { id: field.id } : {}),
          key: field.key,
          ...(field.type ? { type: field.type } : {}),
          ...(field.reference ? { reference: field.reference } : {}),
        })),
        ...(endpoint
          ? { endpoint: { url: url(endpoint), method: endpoint.method } }
          : {}),
      };
    }),
    endpoints: endpoints.map((endpoint) => ({
      id: endpoint.id,
      url: url(endpoint),
      method: endpoint.method,
    })),
  };
}

/** The page's code; undefined when the page is gone. */
export function catalogCodeView(
  reader: CodeViewReader,
  pageId: EntryId<"page">,
  data: ReturnType<typeof catalogCodeViewData>,
): CodeViewResult | undefined {
  if (reader.getEntry(pageId)?.kind !== "page") return undefined;
  return generateCodeView({ reader, pageId, ...data });
}

/** The edits an edited copy of the code makes (the registry names the Whens a handler takes). */
export function catalogCodeViewInverse(
  result: CodeViewResult,
  edited: string,
): CodeViewInverse {
  return codeViewInverse(result, edited, resolveTriggers);
}

/** A view's query by its owner (a shared view, or a node's built-in one). */
function queryOf(
  reader: CatalogReader,
  owner: CodeViewViewOwner,
): ViewQuery | undefined {
  if ("viewId" in owner) {
    const view = reader.getEntry(owner.viewId);
    return view?.kind === "view" ? view : undefined;
  }
  const node = reader.getEntry(owner.nodeId);
  return node?.kind === "node" ? node.binding?.view : undefined;
}

function writeQuery(
  reader: CatalogReader,
  owner: CodeViewViewOwner,
  change: (query: ViewQuery) => ViewQuery,
): CatalogCommand {
  if ("viewId" in owner) {
    const view = reader.getEntry(owner.viewId);
    if (view?.kind !== "view") throw new Error(`NO_VIEW: ${owner.viewId}`);
    const next = change(view);
    return updateView({ entry: { ...view, ...next } });
  }
  const node = reader.getEntry(owner.nodeId);
  const binding = node?.kind === "node" ? node.binding : undefined;
  if (!binding?.view) throw new Error(`NO_VIEW: ${owner.nodeId}`);
  return catalogBindingCommand([{ kind: "node", id: owner.nodeId as never }], {
    ...binding,
    view: change(binding.view),
  });
}

/** One edit as the command its document field has. */
function editCommand(
  reader: CatalogReader,
  edit: CodeViewEdit,
): CatalogCommand {
  switch (edit.kind) {
    case "renameVariable":
    case "variableDefault": {
      const entry = reader.getEntry(edit.variableId) as
        StateVariableEntry | undefined;
      if (entry?.kind !== "stateVariable")
        throw new Error(`NO_VARIABLE: ${edit.variableId}`);
      return updateRecord({
        entry:
          edit.kind === "renameVariable"
            ? { ...entry, name: edit.name }
            : { ...entry, defaultValue: edit.value },
        label: "Edit variable",
      });
    }
    case "condition": {
      const replace = (group: ViewConditionGroup): ViewConditionGroup => ({
        ...group,
        items: group.items.map((item) =>
          "items" in item
            ? replace(item)
            : item.id === edit.conditionId
              ? (() => {
                  const next: ViewCondition = {
                    ...item,
                    fields: edit.fields,
                    op: edit.op,
                  };
                  if (edit.value === undefined)
                    delete (next as { value?: unknown }).value;
                  else next.value = edit.value;
                  return next;
                })()
              : item,
        ),
      });
      return writeQuery(reader, edit.owner, (query) => ({
        ...query,
        where: replace(query.where),
      }));
    }
    case "sortField":
      return writeQuery(reader, edit.owner, (query) => ({
        ...query,
        sort: {
          field: edit.field,
          direction:
            query.sort && "direction" in query.sort
              ? query.sort.direction
              : "ascending",
        },
      }));
    case "trigger":
      return (stage) => {
        const ops: CatalogCommandPlan["ops"][number][] = [];
        for (const id of edit.interactionIds) {
          const rule = stage.getEntry(id) as InteractionEntry | undefined;
          if (rule?.kind !== "interaction") throw new Error(`NO_RULE: ${id}`);
          ops.push(
            ...updateRecord({ entry: { ...rule, trigger: edit.trigger } })(
              stage,
            ).ops,
          );
        }
        return { label: "Edit rule", ops };
      };
  }
}

/** Every edit as one step (one Undo). */
export function catalogCodeViewCommand(
  edits: readonly CodeViewEdit[],
): CatalogCommand {
  return (reader) => {
    const stage = stageOver(reader);
    const ops: CatalogCommandPlan["ops"][number][] = [];
    for (const edit of edits) {
      const plan = editCommand(stage, edit)(stage);
      stage.apply(plan.ops);
      ops.push(...plan.ops);
    }
    return { label: "Edit code", ops };
  };
}

/** Whether a query's sort is the variable (no literal field to edit). */
export const catalogCodeViewQueryOf = queryOf;

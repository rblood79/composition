/**
 * ADR-286 — the data definitions (collections · API endpoints · project variables) are catalog
 * document entries. The data store (`useDataStore`) is their projection in the shapes its 30-odd
 * readers already take (`DataTable` · `ApiEndpoint` · `Variable`, the same Map keys), and its
 * writes go through one document command (`setDataEntries`): one history step, one save, the
 * project file's document. API results (`runtimeData`) are not the document — they stay the
 * store's (ADR-218 cache), merged into the projected tables.
 */
import type {
  CatalogDataField,
  CollectionEntry,
  DataCollectionId,
  DataEndpointId,
  DataEntry,
  EndpointEntry,
  NodeId,
  ProjectVariableEntry,
  ProjectVariableId,
} from "../../../../../packages/shared/src/catalog/document/types";
import {
  composeOver,
  type CatalogCommand,
} from "../../../../../packages/shared/src/catalog/commands/compose";
import { setDataEntries } from "../../../../../packages/shared/src/catalog/commands/data";
import { renameVariable } from "../../../../../packages/shared/src/catalog/commands/variables";
import type {
  ApiEndpoint,
  DataTable,
  Variable,
} from "../../types/builder/data.types";
import { useDataStore } from "../stores/data";
import {
  setDataDefinitionSink,
  type DataChangeHistoryPayload,
} from "../stores/utils/dataChange";
import { catalogBindingRef } from "./dataBinding";
import { catalogBindingCommand } from "./dataBindingCommand";
import { catalogDocumentVariableNames } from "./dataVariables";
import type { CatalogWorkspace } from "./workspace";

import {
  catalogCollectionTables,
  catalogDataProjectId,
  COLLECTION,
  ENDPOINT,
  entriesOf,
  rawId,
  VARIABLE,
  type Reader,
} from "./catalogDataRead";

export {
  catalogCollectionTables,
  catalogDataProjectId,
  catalogProjectVariableDefs,
  fromCollectionEntry,
} from "./catalogDataRead";

/** A value as the project file carries it (no `undefined` key). */
const json = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
// ── document entry ⇄ store shape ────────────────────────────────────────────

export function toCollectionEntry(table: DataTable): CollectionEntry {
  return json({
    kind: "collection" as const,
    id: `${COLLECTION}${table.id}` as DataCollectionId,
    name: table.name,
    ...(table.description !== undefined
      ? { description: table.description }
      : {}),
    schema: table.schema as unknown as CatalogDataField[],
    mockData: table.mockData,
    useMockData: table.useMockData,
    ...(table.executionPolicy
      ? { executionPolicy: table.executionPolicy }
      : {}),
  });
}

export function toEndpointEntry(endpoint: ApiEndpoint): EndpointEntry {
  const {
    id,
    project_id: _project,
    created_at: _created,
    updated_at: _updated,
    targetCollection: _name,
    targetCollectionId,
    ...definition
  } = endpoint;
  return json({
    ...definition,
    kind: "endpoint" as const,
    id: `${ENDPOINT}${id}` as DataEndpointId,
    headers: definition.headers ?? [],
    queryParams: definition.queryParams ?? [],
    bodyType: definition.bodyType ?? "none",
    responseMapping: definition.responseMapping ?? { dataPath: "" },
    executionMode: definition.executionMode ?? "client",
    ...(targetCollectionId
      ? {
          targetCollectionId:
            `${COLLECTION}${rawId(targetCollectionId, COLLECTION)}` as DataCollectionId,
        }
      : {}),
  }) as unknown as EndpointEntry;
}

export function toProjectVariableEntry(
  variable: Variable,
): ProjectVariableEntry {
  return json<ProjectVariableEntry>({
    kind: "projectVariable" as const,
    id: `${VARIABLE}${variable.id}` as ProjectVariableId,
    name: variable.name,
    valueType: variable.type,
    ...(variable.defaultValue !== undefined
      ? { defaultValue: variable.defaultValue }
      : {}),
    persist: variable.persist ?? false,
    ...(variable.validation
      ? { validation: variable.validation as Record<string, unknown> }
      : {}),
  });
}

const endpointCache = new WeakMap<
  EndpointEntry,
  { projectId: string; target: string | undefined; endpoint: ApiEndpoint }
>();
export function fromEndpointEntry(
  entry: EndpointEntry,
  projectId: string,
  targetName?: string,
): ApiEndpoint {
  const cached = endpointCache.get(entry);
  if (cached && cached.projectId === projectId && cached.target === targetName)
    return cached.endpoint;
  const { kind: _kind, id, targetCollectionId, ...definition } = entry;
  const endpoint = {
    ...(definition as unknown as Omit<ApiEndpoint, "id" | "project_id">),
    id: rawId(id, ENDPOINT),
    project_id: projectId,
    ...(targetCollectionId
      ? {
          targetCollectionId: rawId(targetCollectionId, COLLECTION),
          ...(targetName ? { targetCollection: targetName } : {}),
        }
      : {}),
  } as ApiEndpoint;
  endpointCache.set(entry, { projectId, target: targetName, endpoint });
  return endpoint;
}

const variableCache = new WeakMap<
  ProjectVariableEntry,
  { projectId: string; variable: Variable }
>();
export function fromProjectVariableEntry(
  entry: ProjectVariableEntry,
  projectId: string,
): Variable {
  const cached = variableCache.get(entry);
  if (cached && cached.projectId === projectId) return cached.variable;
  const variable: Variable = {
    id: rawId(entry.id, VARIABLE),
    name: entry.name,
    project_id: projectId,
    type: entry.valueType,
    ...(entry.defaultValue !== undefined
      ? { defaultValue: entry.defaultValue }
      : {}),
    persist: entry.persist,
    scope: "global",
    owner: { kind: "project" },
    ...(entry.validation
      ? { validation: entry.validation as Variable["validation"] }
      : {}),
  };
  variableCache.set(entry, { projectId, variable });
  return variable;
}

// ── readers over the document ───────────────────────────────────────────────

export function catalogApiEndpoints(reader: Reader): ApiEndpoint[] {
  const projectId = catalogDataProjectId(reader);
  return entriesOf(reader, "endpoint").map((entry) => {
    const target = entry.targetCollectionId
      ? (reader.getEntry(entry.targetCollectionId) as
          CollectionEntry | undefined)
      : undefined;
    return fromEndpointEntry(entry, projectId, target?.name);
  });
}

export function catalogProjectVariables(reader: Reader): Variable[] {
  const projectId = catalogDataProjectId(reader);
  return entriesOf(reader, "projectVariable").map((entry) =>
    fromProjectVariableEntry(entry, projectId),
  );
}

// ── the store as a projection ───────────────────────────────────────────────

/** Brings the store's three maps to the document (unchanged entries keep their objects). */
export function projectCatalogData(reader: Reader): void {
  const state = useDataStore.getState();
  const collections = new Map<string, DataTable>();
  for (const table of catalogCollectionTables(reader, state.runtimeRows))
    collections.set(table.id, table);
  const apiEndpoints = new Map<string, ApiEndpoint>();
  for (const endpoint of catalogApiEndpoints(reader))
    apiEndpoints.set(endpoint.name, endpoint);
  const variables = new Map<string, Variable>();
  for (const variable of catalogProjectVariables(reader))
    variables.set(variable.name, variable);
  const same = <V>(a: ReadonlyMap<string, V>, b: ReadonlyMap<string, V>) =>
    a.size === b.size && [...a].every(([key, value]) => b.get(key) === value);
  const patch: Record<string, unknown> = {};
  if (!same(collections, state.collections)) patch.collections = collections;
  if (!same(apiEndpoints, state.apiEndpoints))
    patch.apiEndpoints = apiEndpoints;
  if (!same(variables, state.variables)) patch.variables = variables;
  const projectId = catalogDataProjectId(reader);
  if (state.currentProjectId !== projectId) patch.currentProjectId = projectId;
  if (!state.isInitialized) patch.isInitialized = true;
  if (Object.keys(patch).length) useDataStore.setState(patch);
}

/** Whether a step's changed · removed ids touch the data entries or the project's lists. */
function touchesData(ids: Iterable<string>, projectId: string): boolean {
  for (const id of ids)
    if (id.startsWith("data:") || id === projectId) return true;
  return false;
}

/**
 * Binds the data store to the open workspace: the store projects the document (now and after
 * every step — edits, undo, redo), and its writes become document commands. Returns the unbind.
 */
export function bindCatalogDataStore(
  workspace: CatalogWorkspace,
  label: (payload: DataChangeHistoryPayload) => string = (payload) =>
    payload.change.label ?? "Edit data",
): () => void {
  const graph = () => workspace.runtime.graph;
  const nodeOf = (elementId: string) => {
    const target = workspace.positionOfRecord(elementId)?.target;
    if (target && target.kind !== "node") return undefined;
    const entry = graph().getEntry(target?.id ?? elementId);
    return entry?.kind === "node" ? entry : undefined;
  };
  projectCatalogData(graph());
  const unsubscribe = workspace.runtime.subscribeSteps(({ result }) => {
    if (
      touchesData(
        [...result.changedIds, ...result.removedIds],
        graph().projectId,
      )
    )
      projectCatalogData(graph());
  });
  setDataDefinitionSink({
    hasElement: (elementId) => nodeOf(elementId) !== undefined,
    readBinding: (elementId) => {
      const node = nodeOf(elementId);
      return node ? { props: node.binding } : null;
    },
    documentVariableNames: () => catalogDocumentVariableNames(graph()),
    commit(write) {
      // API rows a reduce carried (a renamed field moves them too) stay the store's.
      const runtime = new Map(useDataStore.getState().runtimeRows);
      let runtimeChanged = false;
      for (const table of write.collections ?? [])
        if (table.runtimeData && runtime.get(table.id) !== table.runtimeData) {
          runtime.set(table.id, table.runtimeData);
          runtimeChanged = true;
        }
      for (const id of write.collectionsDeleted ?? [])
        runtimeChanged = runtime.delete(id) || runtimeChanged;
      const commands: CatalogCommand[] = [];
      // ADR-288 — a project variable whose name changes renames through `renameVariable` first
      // (its `{{ old }}` readers follow; a taken or capturing name refuses the whole step).
      for (const variable of write.variables ?? []) {
        const id = `${VARIABLE}${variable.id}` as ProjectVariableId;
        const current = graph().getEntry(id);
        if (
          current?.kind === "projectVariable" &&
          current.name !== variable.name
        )
          commands.push(
            renameVariable({ variableId: id, name: variable.name }),
          );
      }
      const puts: DataEntry[] = [
        ...(write.collections ?? []).map(toCollectionEntry),
        ...(write.endpoints ?? []).map(toEndpointEntry),
        ...(write.variables ?? []).map(toProjectVariableEntry),
      ];
      const removeIds = [
        ...(write.collectionsDeleted ?? []).map(
          (id) => `${COLLECTION}${id}` as DataCollectionId,
        ),
        ...(write.endpointsDeleted ?? []).map(
          (id) => `${ENDPOINT}${id}` as DataEndpointId,
        ),
        ...(write.variablesDeleted ?? []).map(
          (id) => `${VARIABLE}${id}` as ProjectVariableId,
        ),
      ];
      if (puts.length || removeIds.length)
        commands.push(setDataEntries({ puts, removeIds }));
      for (const { elementId, binding } of write.bindings ?? []) {
        const node = nodeOf(elementId);
        if (!node) throw new Error(`ELEMENT_NOT_FOUND: ${elementId}`);
        const ref = catalogBindingRef(binding ?? undefined);
        if (ref === null) throw new Error(`UNSUPPORTED_BINDING: ${elementId}`);
        commands.push(
          catalogBindingCommand([{ kind: "node", id: node.id as NodeId }], ref),
        );
      }
      commands.push(...((write.document ?? []) as CatalogCommand[]));
      if (runtimeChanged) useDataStore.setState({ runtimeRows: runtime });
      if (!commands.length) return;
      const name = label(write.payload);
      workspace.execute((reader) => {
        // (The edited · connected node stays selected.)
        const { selectAfter: _selectAfter, ...plan } =
          commands.length > 1
            ? composeOver(reader, name, commands)
            : commands[0]!(reader);
        return { ...plan, label: name };
      });
    },
  });
  return () => {
    unsubscribe();
    setDataDefinitionSink(null);
  };
}

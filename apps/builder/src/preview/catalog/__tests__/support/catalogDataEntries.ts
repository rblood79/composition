import { setDataEntries } from "../../../../../../../packages/shared/src/catalog/commands/data";
import type {
  CatalogDataField,
  DataCollectionId,
  DataEndpointId,
  DataEntry,
  EndpointEntry,
  ProjectVariableId,
} from "../../../../../../../packages/shared/src/catalog/document/types";

/**
 * ADR-286 test support: a `CATALOG_DATA` message as the tests wrote it before (the definitions
 * on the channel) split into what the Builder sends now — the definitions as document entries
 * (`setDataEntries`) and the API rows message (`{ id, runtimeData }` only).
 */
type Item = Record<string, unknown>;
export function catalogDataMessageEntries(message: {
  collections?: readonly Item[];
  apiEndpoints?: readonly Item[];
  variables?: readonly Item[];
}): { entries: DataEntry[]; rows: Item } {
  const collections = message.collections ?? [];
  const byName = new Map(
    collections.map((item) => [String(item.name), String(item.id)]),
  );
  const entries: DataEntry[] = [];
  for (const item of collections)
    entries.push({
      kind: "collection",
      id: `data:collection:${String(item.id)}` as DataCollectionId,
      name: String(item.name ?? item.id),
      schema: (item.schema ?? []) as CatalogDataField[],
      mockData: JSON.parse(JSON.stringify(item.mockData ?? [])),
      useMockData: item.useMockData !== false,
    });
  for (const item of message.apiEndpoints ?? []) {
    const {
      id,
      targetCollectionId,
      targetCollection,
      headers,
      ...definition
    } = item as Item & {
      headers?: unknown;
      targetCollectionId?: string;
      targetCollection?: string;
    };
    const target =
      targetCollectionId ??
      (targetCollection ? byName.get(targetCollection) : undefined);
    entries.push(
      JSON.parse(
        JSON.stringify({
          method: "GET",
          queryParams: [],
          bodyType: "none",
          responseMapping: { dataPath: "" },
          executionMode: "client",
          ...definition,
          headers: Array.isArray(headers)
            ? headers
            : Object.entries((headers ?? {}) as Record<string, string>).map(
                ([key, value]) => ({ key, value, enabled: true }),
              ),
          kind: "endpoint",
          id: `data:endpoint:${String(id)}` as DataEndpointId,
          ...(target
            ? { targetCollectionId: `data:collection:${target}` }
            : {}),
        }),
      ) as EndpointEntry,
    );
  }
  for (const item of message.variables ?? [])
    entries.push({
      kind: "projectVariable",
      id: `data:variable:${String(item.id)}` as ProjectVariableId,
      name: String(item.name),
      valueType: (item.type ?? "string") as "string",
      ...(item.defaultValue !== undefined
        ? { defaultValue: item.defaultValue }
        : {}),
      persist: item.persist === true,
    });
  return {
    entries,
    rows: {
      type: "CATALOG_DATA",
      version: 1,
      collections: collections
        .filter((item) => Array.isArray(item.runtimeData))
        .map((item) => ({ id: item.id, runtimeData: item.runtimeData })),
    },
  };
}

/**
 * Deliver a test's `CATALOG_DATA` as the Builder does now: its definitions as one document step on
 * `workspace` (the channel's delta — `flush` runs a scheduled one), then the API rows message.
 */
export function sendCatalogData(
  workspace: {
    runtime: { graph: { projectId: string; getEntry(id: string): unknown } };
    execute(command: never): unknown;
  },
  session: { receive(value: unknown): unknown },
  message: Parameters<typeof catalogDataMessageEntries>[0],
  flush: () => void = () => {},
  /** Remove the kinds the message lists as empty too (default: an empty list leaves that kind). */
  replace = false,
): unknown {
  const { entries, rows } = catalogDataMessageEntries(message);
  const graph = workspace.runtime.graph;
  const project = graph.getEntry(graph.projectId) as {
    collectionIds?: string[];
    endpointIds?: string[];
    projectVariableIds?: string[];
  };
  const keep = new Set<string>(entries.map((entry) => entry.id));
  const listed = (list: readonly unknown[] | undefined) =>
    list !== undefined && (replace || list.length > 0);
  const removeIds = [
    ...(listed(message.collections) ? (project.collectionIds ?? []) : []),
    ...(listed(message.apiEndpoints) ? (project.endpointIds ?? []) : []),
    ...(listed(message.variables) ? (project.projectVariableIds ?? []) : []),
  ].filter((id) => !keep.has(id)) as DataEntry["id"][];
  if (entries.length || removeIds.length) {
    workspace.execute(
      setDataEntries({ puts: entries, removeIds, label: "Edit data" }) as never,
    );
    flush();
  }
  return session.receive(rows);
}

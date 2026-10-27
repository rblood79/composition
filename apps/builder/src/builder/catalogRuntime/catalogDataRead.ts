/**
 * ADR-286 — the data definitions as the Builder's first screen reads them: the Canvas's bound rows
 * (`catalogCollectionTables`) and `{{ }}` env (`catalogProjectVariableDefs`) straight from the
 * document. The store projection and its write path (`catalogDataStore.ts`) load after the first
 * paint — nothing here writes.
 */
import type { VariableDef } from "@composition/shared";
import type {
  CatalogReader,
  CollectionEntry,
  DataEntry,
  ProjectEntry,
  ProjectVariableEntry,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { DataField, DataTable } from "../../types/builder/data.types";
import { useDataStore } from "../stores/data";

export const COLLECTION = "data:collection:";
export const ENDPOINT = "data:endpoint:";
export const VARIABLE = "data:variable:";
type Row = Record<string, unknown>;
export type Reader = Pick<CatalogReader, "projectId" | "getEntry">;

export const rawId = (id: string, prefix: string) =>
  id.startsWith(prefix) ? id.slice(prefix.length) : id;
/** The store's project id: the route id of the catalog project. */
export const catalogDataProjectId = (reader: Pick<Reader, "projectId">) =>
  rawId(reader.projectId, "project:project:");

/** Entry → table, one object per (entry, API rows) so unchanged collections keep identity. */
const tableCache = new WeakMap<
  CollectionEntry,
  { projectId: string; runtime: Row[] | undefined; table: DataTable }
>();
export function fromCollectionEntry(
  entry: CollectionEntry,
  projectId: string,
  runtime?: Row[],
): DataTable {
  const cached = tableCache.get(entry);
  if (cached && cached.projectId === projectId && cached.runtime === runtime)
    return cached.table;
  const table: DataTable = {
    id: rawId(entry.id, COLLECTION),
    name: entry.name,
    project_id: projectId,
    ...(entry.description !== undefined
      ? { description: entry.description }
      : {}),
    schema: entry.schema as unknown as DataField[],
    mockData: entry.mockData as Row[],
    ...(runtime ? { runtimeData: runtime } : {}),
    useMockData: entry.useMockData,
    ...(entry.executionPolicy
      ? { executionPolicy: { ...entry.executionPolicy } }
      : {}),
  };
  tableCache.set(entry, { projectId, runtime, table });
  return table;
}

export function entriesOf<K extends DataEntry["kind"]>(
  reader: Reader,
  kind: K,
): Extract<DataEntry, { kind: K }>[] {
  const project = reader.getEntry(reader.projectId) as ProjectEntry | undefined;
  const ids =
    kind === "collection"
      ? project?.collectionIds
      : kind === "endpoint"
        ? project?.endpointIds
        : project?.projectVariableIds;
  const out: Extract<DataEntry, { kind: K }>[] = [];
  for (const id of ids ?? []) {
    const entry = reader.getEntry(id) as DataEntry | undefined;
    if (entry?.kind === kind)
      out.push(entry as Extract<DataEntry, { kind: K }>);
  }
  return out;
}

/** The document's collections as the store's tables (API rows from `runtime`). */
export function catalogCollectionTables(
  reader: Reader,
  runtime: ReadonlyMap<string, Row[]> = useDataStore.getState().runtimeRows,
): DataTable[] {
  const projectId = catalogDataProjectId(reader);
  return entriesOf(reader, "collection").map((entry) =>
    fromCollectionEntry(
      entry,
      projectId,
      runtime.get(rawId(entry.id, COLLECTION)),
    ),
  );
}

/** The project variables as `VariableDef` (the `{{ }}` env — Canvas defaults, ADR-214). */
const defsCache = new WeakMap<
  object,
  { entries: ProjectVariableEntry[]; defs: VariableDef[] }
>();
export function catalogProjectVariableDefs(reader: Reader): VariableDef[] {
  const project = reader.getEntry(reader.projectId) as object | undefined;
  const entries = entriesOf(reader, "projectVariable");
  const cached = project ? defsCache.get(project) : undefined;
  // (Same entries → the same array: the scene's memo stays.)
  if (
    cached &&
    cached.entries.length === entries.length &&
    cached.entries.every((entry, index) => entry === entries[index])
  )
    return cached.defs;
  const defs = entries.map((entry) => ({
    id: rawId(entry.id, VARIABLE),
    name: entry.name,
    type: entry.valueType,
    ...(entry.defaultValue !== undefined
      ? { defaultValue: entry.defaultValue }
      : {}),
    ...(entry.persist ? { persist: true } : {}),
  })) as VariableDef[];
  if (project) defsCache.set(project, { entries, defs });
  return defs;
}

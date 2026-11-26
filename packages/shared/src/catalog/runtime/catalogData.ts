/**
 * ADR-286 — what Preview · publish read of the data definitions: the document's entries
 * (collections · API endpoints · project variables) in the runtime shapes their sessions take, with
 * the API rows (`runtimeData` — never the document) the Builder sends merged in. One function for
 * every consumer — the Builder's code view and its data store read the same entries.
 */
import { toRuntimeApiEndpoint } from "../../collections/collectionSnapshot";
import { catalogApiFilledCollectionIds } from "../document/apiSampleRows";
import type { CollectionDataSource } from "../../collections/resolveCollectionItems";
import type { VariableDef } from "../../state/variable.types";
import type { ApiEndpointDefinition } from "../../types/collection.types";
import type {
  CollectionEntry,
  DataEntry,
  EndpointEntry,
  ProjectEntry,
  ProjectVariableEntry,
} from "../document/types";

type Row = Record<string, unknown>;
interface Reader {
  readonly projectId: string;
  getEntry(id: string): unknown;
}
export interface CatalogRuntimeData {
  readonly collections: readonly CollectionDataSource[];
  readonly apiEndpoints: readonly ApiEndpointDefinition[];
  readonly variables: readonly VariableDef[];
}

export interface CatalogRuntimeDataOptions {
  /**
   * A published app: no Builder sends API rows, the session loads them itself. A collection an
   * endpoint fills then has no rows until that load answers — its `mockData` are the author's design
   * sample rows (the Canvas · the Builder's Preview), never an app's data. A collection that uses
   * its own data (`useMockData`) and one no endpoint fills keep their rows.
   * **Why (2026-11-26 live)**: Publish showed `MOCK-*` rows for an API collection it had not loaded.
   */
  readonly standalone?: boolean;
}
const NO_ROWS: Row[] = [];
const COLLECTION = "data:collection:";
const raw = (id: string, prefix: string) =>
  id.startsWith(prefix) ? id.slice(prefix.length) : id;

function entriesOf<K extends DataEntry["kind"]>(
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

const collectionCache = new WeakMap<
  CollectionEntry,
  { rows: Row[] | undefined; samples: boolean; source: CollectionDataSource }
>();
function collectionOf(
  entry: CollectionEntry,
  rows: Row[] | undefined,
  /** False = the design sample rows are not this session's to show (`CatalogRuntimeDataOptions`). */
  samples: boolean,
): CollectionDataSource {
  const cached = collectionCache.get(entry);
  if (cached && cached.rows === rows && cached.samples === samples)
    return cached.source;
  const source: CollectionDataSource = {
    id: raw(entry.id, COLLECTION),
    name: entry.name,
    schema: entry.schema as CollectionDataSource["schema"],
    mockData: samples ? (entry.mockData as Row[]) : NO_ROWS,
    ...(rows ? { runtimeData: rows } : {}),
    useMockData: entry.useMockData,
    ...(entry.keyField !== undefined ? { keyField: entry.keyField } : {}),
  };
  collectionCache.set(entry, { rows, samples, source });
  return source;
}

const endpointCache = new WeakMap<
  EndpointEntry,
  { target: string | undefined; endpoint: ApiEndpointDefinition }
>();
/** The runtime projection (no server secret mapping) + the collection it fills (id · name). */
function endpointOf(
  entry: EndpointEntry,
  target: CollectionEntry | undefined,
): ApiEndpointDefinition {
  const cached = endpointCache.get(entry);
  if (cached && cached.target === target?.name) return cached.endpoint;
  const { kind: _kind, id, targetCollectionId: _target, ...definition } = entry;
  const endpoint = {
    ...toRuntimeApiEndpoint({
      ...(definition as unknown as Omit<ApiEndpointDefinition, "id">),
      id: raw(id, "data:endpoint:"),
    }),
    ...(target
      ? {
          targetCollectionId: raw(target.id, COLLECTION),
          targetCollection: target.name,
        }
      : {}),
  } as ApiEndpointDefinition;
  endpointCache.set(entry, { target: target?.name, endpoint });
  return endpoint;
}

function variableOf(entry: ProjectVariableEntry): VariableDef {
  return {
    id: raw(entry.id, "data:variable:"),
    name: entry.name,
    type: entry.valueType,
    ...(entry.defaultValue !== undefined
      ? { defaultValue: entry.defaultValue }
      : {}),
    ...(entry.persist ? { persist: true } : {}),
  };
}

const resultCache = new WeakMap<
  object,
  {
    entries: readonly unknown[];
    rows: ReadonlyMap<string, Row[]> | undefined;
    standalone: boolean;
    data: CatalogRuntimeData;
  }
>();
/**
 * The document's data definitions as the Preview · publish sessions read them. The same document
 * entries and rows map give the same object (a session's memo · services stay).
 */
export function catalogRuntimeData(
  reader: Reader,
  runtimeRows?: ReadonlyMap<string, Row[]>,
  options: CatalogRuntimeDataOptions = {},
): CatalogRuntimeData {
  const standalone = options.standalone === true;
  const project = reader.getEntry(reader.projectId) as object | undefined;
  const collections = entriesOf(reader, "collection");
  const endpoints = entriesOf(reader, "endpoint");
  const variables = entriesOf(reader, "projectVariable");
  const entries = [...collections, ...endpoints, ...variables];
  const cached = project ? resultCache.get(project) : undefined;
  if (
    cached &&
    cached.rows === runtimeRows &&
    cached.standalone === standalone &&
    cached.entries.length === entries.length &&
    cached.entries.every((entry, index) => entry === entries[index])
  )
    return cached.data;
  const apiFilled = standalone
    ? catalogApiFilledCollectionIds(collections, endpoints)
    : undefined;
  const data: CatalogRuntimeData = {
    collections: collections.map((entry) =>
      collectionOf(
        entry,
        runtimeRows?.get(raw(entry.id, COLLECTION)),
        !apiFilled?.has(entry.id),
      ),
    ),
    apiEndpoints: endpoints.map((entry) =>
      endpointOf(
        entry,
        entry.targetCollectionId
          ? (reader.getEntry(entry.targetCollectionId) as
              CollectionEntry | undefined)
          : undefined,
      ),
    ),
    variables: variables.map(variableOf),
  };
  if (project)
    resultCache.set(project, { entries, rows: runtimeRows, standalone, data });
  return data;
}

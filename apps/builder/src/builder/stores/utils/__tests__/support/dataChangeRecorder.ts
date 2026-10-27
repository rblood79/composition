import type {
  ApiEndpoint,
  DataTable,
  Variable,
} from "../../../../../types/builder/data.types";
import {
  setDataDefinitionSink,
  type DataBindingSnapshot,
  type DataDefinitionWrite,
} from "../../dataChange";

/**
 * ADR-286: the data change tests' wiring. The app writes a data change as one catalog document
 * command (`bindCatalogDataStore`); here a stand-in sink applies each write to the test's store
 * (the store a test attaches with `attachTestDataStore`) and hands it to `addEntry` as one data
 * entry (payload + affected ids) — the history assertions of the old recorder keep their shape.
 */
type StoreState = {
  collections: Map<string, DataTable>;
  variables: Map<string, Variable>;
  apiEndpoints: Map<string, ApiEndpoint>;
};
let attached: {
  get: () => StoreState;
  set: (patch: Partial<StoreState>) => void;
} | null = null;
let documentNames = new Set<string>();
/** Element bindings the sink checks `bind_element` against (`elementId` → binding). */
export const testElementBindings = new Map<string, unknown>();
export const testDataCommits: DataDefinitionWrite[] = [];

/** The store the sink writes (a test's `makeStore`). */
export function attachTestDataStore(
  set: (patch: Partial<StoreState>) => void,
  get: () => StoreState,
): void {
  attached = { set, get };
}
/** The document's page · element variable names (ADR-214 HC5); none unless a test sets them. */
export function setTestDocumentVariableNames(names: Iterable<string>): void {
  documentNames = new Set(names);
}

function byIdOut<T extends { id: string; name: string }>(
  map: Map<string, T>,
  id: string,
): void {
  for (const [key, value] of map) if (value.id === id) map.delete(key);
}

export function applyTestDataWrite(write: DataDefinitionWrite): void {
  if (!attached) return;
  const state = attached.get();
  const collections = new Map(state.collections);
  for (const id of write.collectionsDeleted ?? []) collections.delete(id);
  for (const table of write.collections ?? []) collections.set(table.id, table);
  const variables = new Map(state.variables);
  for (const id of write.variablesDeleted ?? []) byIdOut(variables, id);
  for (const variable of write.variables ?? []) {
    byIdOut(variables, variable.id);
    variables.set(variable.name, variable);
  }
  const apiEndpoints = new Map(state.apiEndpoints);
  for (const id of write.endpointsDeleted ?? []) byIdOut(apiEndpoints, id);
  for (const endpoint of write.endpoints ?? []) {
    byIdOut(apiEndpoints, endpoint.id);
    apiEndpoints.set(endpoint.name, endpoint);
  }
  attached.set({ collections, variables, apiEndpoints });
  for (const { elementId, binding } of write.bindings ?? [])
    testElementBindings.set(elementId, binding ?? undefined);
}

export function installTestDataChangeRecorder(
  addEntry: (entry: {
    type: "data";
    elementId: string;
    elementIds: string[];
    data: { dataChangeEvent: unknown };
  }) => void,
): void {
  documentNames = new Set();
  setDataDefinitionSink({
    hasElement: (elementId) => testElementBindings.has(elementId),
    readBinding: (elementId): DataBindingSnapshot | null =>
      testElementBindings.has(elementId)
        ? { props: testElementBindings.get(elementId) }
        : null,
    documentVariableNames: () => documentNames,
    commit(write) {
      testDataCommits.push(write);
      applyTestDataWrite(write);
      const affected = [
        ...(write.collections ?? []).map((table) => table.id),
        ...(write.collectionsDeleted ?? []),
        ...(write.variables ?? []).map((variable) => variable.id),
        ...(write.variablesDeleted ?? []),
        ...(write.endpoints ?? []).map((endpoint) => endpoint.id),
        ...(write.endpointsDeleted ?? []),
        ...(write.bindings ?? []).map((binding) => binding.elementId),
      ];
      addEntry({
        type: "data",
        elementId: affected[0] ?? "",
        elementIds: affected,
        data: { dataChangeEvent: write.payload },
      });
    },
  });
}

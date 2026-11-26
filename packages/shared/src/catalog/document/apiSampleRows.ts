import type {
  CatalogDocument,
  CatalogEntry,
  CollectionEntry,
  EndpointEntry,
} from "./types";

/**
 * The collections an endpoint fills (`targetCollectionId`) and that do not use their own data
 * (`useMockData`). Their `mockData` are the author's design sample rows — what the Canvas and the
 * Builder's Preview draw before the API answers — never a published app's data.
 */
export function catalogApiFilledCollectionIds(
  collections: readonly Pick<CollectionEntry, "id" | "useMockData">[],
  endpoints: readonly Pick<EndpointEntry, "targetCollectionId">[],
): ReadonlySet<string> {
  const targets = new Set<string>();
  for (const endpoint of endpoints)
    if (endpoint.targetCollectionId) targets.add(endpoint.targetCollectionId);
  const filled = new Set<string>();
  for (const collection of collections)
    if (!collection.useMockData && targets.has(collection.id))
      filled.add(collection.id);
  return filled;
}

/**
 * A document for a published app (the Publish tab's file): the collections an endpoint fills carry
 * no sample rows — the app loads them from the API, and the rows the author pasted to design with
 * (up to 1,000 a collection, maybe real customer data) do not ship. A project file the author
 * exports keeps them (it is read back into the Builder).
 * **Why (2026-11-26 live)**: Publish drew an API collection's sample rows as if they were its data.
 */
export function withoutApiSampleRows(
  document: CatalogDocument,
): CatalogDocument {
  const entries = Object.values(document.entries);
  const filled = catalogApiFilledCollectionIds(
    entries.filter(
      (entry): entry is CollectionEntry => entry.kind === "collection",
    ),
    entries.filter(
      (entry): entry is EndpointEntry => entry.kind === "endpoint",
    ),
  );
  let changed = false;
  const next: Record<string, CatalogEntry> = {};
  for (const [id, entry] of Object.entries(document.entries)) {
    if (
      entry.kind === "collection" &&
      filled.has(id) &&
      entry.mockData.length
    ) {
      next[id] = { ...entry, mockData: [] };
      changed = true;
    } else next[id] = entry;
  }
  return changed ? { ...document, entries: next } : document;
}

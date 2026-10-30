import type { CatalogGraph } from "../document/graph";
import type { DefinitionId } from "../document/types";
import type { CatalogConsumerNode } from "./compositionRoot";

/**
 * ADR-294 Decision 2 — the component instances a drawn record sits in (its logical instance
 * boundaries), innermost first. A record collapses an instance into its template root (and that
 * root into its own when it is an instance again — `collapseLayers`), so the boundaries are read
 * from the record's parent chain and, on each record, from its collapsed layers (inner layer first)
 * — the same layers the composition root collapsed (one judgment, never a second one).
 *
 * `occurrence` names one drawn instance: the record that draws it and the layer — a record id holds
 * the instance path and the data row key, so the same nested instance J under I1 and under I2
 * (one document id) and the instance in row 3 and row 4 are different occurrences.
 */
export interface CatalogComponentBoundary {
  /** The instance node (a document id — read its definition and props from the graph). */
  readonly instanceId: string;
  readonly definitionId: DefinitionId;
  readonly occurrence: string;
  /** The record that draws the instance. */
  readonly recordId: string;
}

export function componentBoundariesOf(
  graph: Pick<CatalogGraph, "getEntry" | "getDefinition">,
  records: { get(id: string): CatalogConsumerNode | undefined },
  recordId: string,
): CatalogComponentBoundary[] {
  const boundaries: CatalogComponentBoundary[] = [];
  const seen = new Set<string>();
  for (
    let record = records.get(recordId);
    record && !seen.has(record.id);
    record = record.parentId ? records.get(record.parentId) : undefined
  ) {
    seen.add(record.id);
    const layers = [record.sourceId, ...(record.collapsedSourceIds ?? [])];
    for (let index = layers.length - 1; index >= 0; index -= 1) {
      const id = layers[index]!;
      if (!id.startsWith("project:node:")) continue;
      const entry = graph.getEntry(id as never);
      if (entry?.kind !== "node" || !entry.definitionId.startsWith("project:"))
        continue;
      const definition = graph.getDefinition(
        entry.definitionId as DefinitionId,
      );
      if (definition?.mode !== "composite") continue;
      boundaries.push({
        instanceId: id,
        definitionId: entry.definitionId as DefinitionId,
        occurrence: `${record.id}|${id}`,
        recordId: record.id,
      });
    }
  }
  return boundaries;
}

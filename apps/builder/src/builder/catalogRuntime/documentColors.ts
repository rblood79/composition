import type {
  CatalogReader,
  NodeEntry,
} from "../../../../../packages/shared/src/catalog/document/types";
import type { FillItem } from "../../types/builder/fill.types";
import { catalogFillItems } from "./authoredStyle";
import { catalogAuthoredValues } from "./styleFields";

/** One authored color source: a node's colors as the old `props.style` and its fill layers. */
export interface CatalogColorSource {
  style: Record<string, unknown>;
  fills: FillItem[] | undefined;
}

/**
 * ADR-248 Phase 4e: the color picker's Document palette over the catalog document — every node of
 * every page and definition template, with the colors the author wrote (`visual` color ·
 * background · border, responsive layers included) and its fill layers. Definition defaults are
 * not the document's colors (the old palette read authored `props.style` and fills too).
 */
export function catalogDocumentColorSources(
  graph: CatalogReader,
): CatalogColorSource[] {
  const project = graph.getEntry(graph.projectId);
  if (project?.kind !== "project") return [];
  const sources: CatalogColorSource[] = [];
  const seen = new Set<string>();
  const visit = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const node = graph.getEntry(id);
    if (node?.kind !== "node") return;
    const layers: (NodeEntry["visual"] | undefined)[] = [
      node.visual,
      ...Object.values(node.responsive ?? {}).map((layer) => layer?.visual),
    ];
    for (const visual of layers) {
      if (!visual) continue;
      sources.push({
        style: catalogAuthoredValues(visual),
        fills: undefined,
      });
    }
    if (node.fills)
      sources.push({
        style: {},
        fills: catalogFillItems(node.fills) as FillItem[] | undefined,
      });
    for (const child of node.children) visit(child);
  };
  for (const pageId of project.pageIds) {
    const page = graph.getEntry(pageId);
    if (page?.kind === "page") page.children.forEach(visit);
  }
  for (const definitionId of project.definitionIds) {
    const definition = graph.getEntry(definitionId);
    if (definition?.kind === "definition" && definition.templateRootId)
      visit(definition.templateRootId);
  }
  return sources;
}

import type {
  LibraryDefinitionId,
  NodeId,
} from "../../../../../packages/shared/src/catalog/document/types";

/**
 * The library origin view's sample node and the origin test (`originView` holds the view and its
 * edit rules). A leaf: the composition root reads it in the Preview too (G5 bundle gate).
 */
export const ORIGIN_VIEW_NODE = "project:node:catalog-origin-view" as NodeId;

export const isLibraryOrigin = (
  id: string | undefined,
): id is LibraryDefinitionId => !!id && id.startsWith("lib:definition:origin-");

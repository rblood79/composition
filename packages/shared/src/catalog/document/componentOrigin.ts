import type { CatalogReader, EntryId } from "./types";

/**
 * Whether `reader` knows `id` as a project component's template root (its origin). A read — the
 * Canvas / Preview composition root asks it (`compositionRoot.ts`), so it lives outside the
 * authoring commands (`previewBuilderAuthoringImport.static.test.ts`).
 */
export function componentOriginOf(
  reader: CatalogReader,
  id: string,
): EntryId<"definition"> | undefined {
  const definitionId = reader.definitionOfTemplateRoot(id);
  const definition = definitionId ? reader.getEntry(definitionId) : undefined;
  return definition?.kind === "definition" && definition.usage !== "layout"
    ? definition.id
    : undefined;
}

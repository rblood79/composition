import { buildCodeCatalogLibrary } from "../../../../../packages/shared/src/catalog/document/codeCatalogLibrary";
import type { CatalogLibrary } from "../../../../../packages/shared/src/catalog/document/types";

/**
 * ADR-248 Phase 4e: the library the Builder opens projects against — the code catalog (read-only,
 * built once per session).
 */
let library: Promise<CatalogLibrary> | undefined;
export function loadCatalogProductLibrary(): Promise<CatalogLibrary> {
  library ??= buildCodeCatalogLibrary();
  return library;
}

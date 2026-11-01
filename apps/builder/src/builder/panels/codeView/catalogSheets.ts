/**
 * ADR-296 Phase 4 (Decision 3) — the component types' catalog sheets (the CSS `generate-css.ts`
 * writes from `COMPONENT_RULES_TABLE`), read only in the code view as
 * `node_modules/@composition/catalog/<Type>.css`. Each sheet's text is its own lazy chunk, loaded
 * when the file opens (the tree lists names only — R5).
 */
const SHEETS = import.meta.glob(
  "../../../../../../packages/shared/src/components/styles/generated/*.css",
  { query: "?raw", import: "default" },
) as Record<string, () => Promise<string>>;

const byType = new Map(
  Object.entries(SHEETS).map(([path, load]) => [
    /([^/]+)\.css$/.exec(path)![1]!,
    load,
  ]),
);

/** The types that have a sheet. */
export const CATALOG_SHEET_TYPES: ReadonlySet<string> = new Set(byType.keys());

/** A type's sheet text (undefined = none). */
export function loadCatalogSheet(type: string): Promise<string> | undefined {
  return byType.get(type)?.();
}

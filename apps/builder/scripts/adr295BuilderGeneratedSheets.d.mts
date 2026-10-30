export declare const THEME_CSS: string;
export declare const BUILDER_CATALOG_VARS_CSS: string;
export declare const BUILDER_COMPONENTS_CSS: string;
export declare function resolveBuilderGeneratedSheets(rootFiles: string[]): {
  sheets: string[];
  rootVarCount: number;
  unresolvedExternal: string[];
  entries: Record<string, string>;
};
export declare function normalizeDimension(
  prop: string,
  value: string,
  fontPx?: number,
): string;
export declare function normalizedEntries(
  entries: Record<string, string>,
): Record<string, string>;

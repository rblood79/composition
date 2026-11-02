import type { CollectionProjectionRow } from "./resolveCollectionItems";

export const DEFAULT_COLLECTION_FILTER_FIELDS: readonly string[] = [
  "label",
  "name",
  "title",
];

/** 정규화된 행의 원본 값으로 검색한다. 0과 false도 검색 가능한 값이다. */
export function filterCollectionRows<T>(
  rows: CollectionProjectionRow[],
  filter: ((item: T) => boolean) | undefined,
  filterText: string | undefined,
  fields: readonly (keyof T)[],
): CollectionProjectionRow[] {
  const search = filterText?.toLowerCase().trim();
  if (!filter && !search) return rows;
  return rows.filter((row) => {
    if (filter && !filter(row.item as T)) return false;
    if (!search) return true;
    const item = row.item;
    if (!item || typeof item !== "object")
      return row.label.toLowerCase().includes(search);
    return fields.some((field) => {
      const value = (item as T)[field];
      return value != null && String(value).toLowerCase().includes(search);
    });
  });
}

/**
 * 2026-11-19 사용자 결정 — a Pagination that pages a list shows `range` page numbers at once
 * (Pagination `pageRange`, default 5): the shown page in the middle, shifted to stay within 1 ~
 * `count` (the first pages · the last pages show a full window).
 */
export const PAGINATION_PAGE_RANGE_DEFAULT = 5;
/** A Pagination's 「Rows per page」 choices (2026-11-19 — shadcn's 10 · 25 · 50 · 100 with 20, the
 *  rows a page 「Pages」 starts with). */
export const PAGINATION_PAGE_SIZES: readonly number[] = [10, 20, 50, 100];

export function catalogPageWindow(
  page: number,
  count: number,
  range: unknown,
): number[] {
  const size =
    typeof range === "number" && Number.isFinite(range) && range >= 1
      ? Math.floor(range)
      : PAGINATION_PAGE_RANGE_DEFAULT;
  const length = Math.min(size, Math.max(0, count));
  const start = Math.max(
    1,
    Math.min(page - Math.floor((size - 1) / 2), count - length + 1),
  );
  return Array.from({ length }, (_, index) => start + index);
}

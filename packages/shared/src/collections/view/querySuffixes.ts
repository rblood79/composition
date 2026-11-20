/**
 * The default suffix table of a flat query format (json-server) — on its own so a reader that only
 * asks 「does the format carry this comparison」 (`catalogTableSliceServable` — the Builder's panel
 * reads it on the first screen) does not load the serializer and the row intake behind it.
 *
 * `equals` is the bare field, a list repeats it. Absent comparisons are not expressible as a flat
 * parameter — the panel shows them as 「서버로 보낼 수 없음」 until the author names a suffix.
 */
import type { ViewComparison } from "../../catalog/document/types";

export const DEFAULT_QUERY_SUFFIXES: Readonly<
  Partial<Record<ViewComparison, string>>
> = {
  equals: "",
  notEquals: "_ne",
  contains: "_like",
  oneOf: "",
  gte: "_gte",
  gt: "_gt",
  lte: "_lte",
  lt: "_lt",
  after: "_gt",
  before: "_lt",
};

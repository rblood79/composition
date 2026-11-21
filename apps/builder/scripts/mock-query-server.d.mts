/** Types of `mock-query-server.mjs` (ADR-291 G5 — the independent oracle the tests import). */
export interface MockBodyRequest {
  where?: unknown;
  sort?:
    | { field: string; direction: string }
    | { field: string; direction: string }[];
  group?: { by: string[]; aggregates: { fn: string; field?: string; as: string }[] };
  page?: { cursor?: string; limit?: number };
  total?: true;
  /** ADR-315 5g — rows by key (exact). */
  keys?: { field: string; only?: unknown[]; except?: unknown[] };
  /** ADR-315 5g — a group's rows (this server's grouping). */
  groupOf?: { by: string[]; values: unknown[] };
}
export function answerBody(
  rows: readonly Record<string, unknown>[],
  body?: MockBodyRequest,
): { items: Record<string, unknown>[]; total?: number; cursor?: string };
export function answerSuffix(
  rows: readonly Record<string, unknown>[],
  params: URLSearchParams | Iterable<[string, string]>,
  /** ADR-315 5g — the key parameters' names and the key field. */
  keyParams?: { field: string; only: string; except: string },
): { items: Record<string, unknown>[]; headers: Record<string, string> };

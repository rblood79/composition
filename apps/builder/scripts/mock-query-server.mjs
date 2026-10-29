// ADR-291 G5 — a mock query server for the two request formats a view can go as, written on its
// own (plain filter · sort · group over raw rows — not the evaluator) so the local run has an
// independent oracle:
//   body   — POST, JSON `{ where, sort, group, page, total }` (ADR-291 Decision 6).
//   suffix — GET, json-server parameters (`field`, `field_ne`, `field_like`, `field_gte` …,
//            `_sort` · `_order`, `_page` · `_limit`; the whole count as `X-Total-Count`).
// Library: `answerBody(rows, body)` · `answerSuffix(rows, params)`. CLI:
//   node apps/builder/scripts/mock-query-server.mjs <rows.json> [port=5199]
//   POST http://127.0.0.1:5199/query  · GET http://127.0.0.1:5199/rows?city=Seoul&_page=1&_limit=50
import { createServer } from "node:http";
import { readFileSync } from "node:fs";

const collator = new Intl.Collator("en", { usage: "search", sensitivity: "base" });
const same = (a, b) => collator.compare(String(a), String(b)) === 0;
const has = (haystack, needle) =>
  String(haystack).toLocaleLowerCase().normalize("NFD").replace(/\p{M}/gu, "")
    .includes(String(needle).toLocaleLowerCase().normalize("NFD").replace(/\p{M}/gu, ""));
const empty = (v) => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0);
const day = (v) => (typeof v === "string" ? v.slice(0, 10) : v);
const num = (v) => (typeof v === "number" ? v : Number(v));
const compare = (a, b) => {
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "number" || typeof b === "number") return num(a) - num(b);
  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
};

/** One condition of the body tree against a row. */
function holds(condition, row) {
  const values = condition.fields.map((key) => row[key]);
  const v = condition.value;
  const list = v instanceof Set ? [...v] : Array.isArray(v) ? v : [v];
  return values.some((cell) => {
    switch (condition.op) {
      case "equals": return same(cell, v);
      case "notEquals": return !same(cell, v);
      case "contains": return Array.isArray(cell) ? cell.some((x) => same(x, v)) : has(cell ?? "", v);
      case "notContains": return Array.isArray(cell) ? !cell.some((x) => same(x, v)) : !has(cell ?? "", v);
      case "startsWith": return String(cell ?? "").toLowerCase().startsWith(String(v).toLowerCase());
      case "endsWith": return String(cell ?? "").toLowerCase().endsWith(String(v).toLowerCase());
      case "notStartsWith": return !String(cell ?? "").toLowerCase().startsWith(String(v).toLowerCase());
      case "notEndsWith": return !String(cell ?? "").toLowerCase().endsWith(String(v).toLowerCase());
      case "oneOf": return list.some((x) => same(cell, x));
      case "containsAny": return Array.isArray(cell) && list.some((x) => cell.some((y) => same(x, y)));
      case "containsAll": return Array.isArray(cell) && list.every((x) => cell.some((y) => same(x, y)));
      case "gte": return compare(cell, v) >= 0;
      case "gt": return compare(cell, v) > 0;
      case "lte": return compare(cell, v) <= 0;
      case "lt": return compare(cell, v) < 0;
      case "between": return compare(cell, list[0]) >= 0 && compare(cell, list[1]) <= 0;
      case "before": return day(cell) < day(v);
      case "after": return day(cell) > day(v);
      case "exists": return !empty(cell);
      case "notExists": return empty(cell);
      default: throw new Error(`mock server: unknown comparison ${condition.op}`);
    }
  });
}
function holdsGroup(group, row) {
  if (!group) return true;
  if (!("items" in group)) return holds(group, row);
  const results = group.items.map((item) => holdsGroup(item, row));
  return group.op === "or" ? results.some(Boolean) : results.every(Boolean);
}
function sorted(rows, sort) {
  if (!sort) return rows;
  const sign = sort.direction === "descending" ? -1 : 1;
  return [...rows].sort((a, b) => sign * compare(a[sort.field], b[sort.field]));
}
function aggregate(fn, rows, field) {
  if (fn === "count") return rows.length;
  const cells = rows.map((row) => row[field]).filter((cell) => !empty(cell));
  if (fn === "min") return cells.length ? cells.reduce((m, c) => (compare(c, m) < 0 ? c : m)) : null;
  if (fn === "max") return cells.length ? cells.reduce((m, c) => (compare(c, m) > 0 ? c : m)) : null;
  const numbers = cells.map(num).filter(Number.isFinite);
  const sum = numbers.reduce((t, c) => t + c, 0);
  if (fn === "sum") return sum;
  if (fn === "mean") return numbers.length ? sum / numbers.length : null;
  throw new Error(`mock server: unknown aggregate ${fn}`);
}
function grouped(rows, group) {
  const buckets = new Map();
  for (const row of rows) {
    const key = JSON.stringify(group.by.map((field) => row[field] ?? null));
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(row);
  }
  return [...buckets.entries()].map(([key, members]) => {
    const out = Object.fromEntries(group.by.map((field, index) => [field, JSON.parse(key)[index]]));
    for (const a of group.aggregates) out[a.as] = aggregate(a.fn, members, a.field);
    return out;
  });
}

/** The body format: `{ items, total, cursor? }` (the cursor is the next offset). */
export function answerBody(rows, body = {}) {
  let out = rows.filter((row) => holdsGroup(body.where, row));
  out = sorted(out, body.sort);
  if (body.group) out = grouped(out, body.group);
  const total = out.length;
  const offset = body.page?.cursor !== undefined ? Number(body.page.cursor) : 0;
  const limit = body.page?.limit;
  const items = limit === undefined ? out.slice(offset) : out.slice(offset, offset + limit);
  const next = limit !== undefined && offset + limit < total ? String(offset + limit) : undefined;
  return { items, ...(body.total ? { total } : {}), ...(next !== undefined ? { cursor: next } : {}) };
}

/** json-server parameters: `{ items, headers }` with `X-Total-Count`. */
export function answerSuffix(rows, params) {
  const list = params instanceof URLSearchParams ? [...params.entries()] : [...params];
  const byKey = new Map();
  for (const [key, value] of list) byKey.set(key, [...(byKey.get(key) ?? []), value]);
  let out = rows.filter((row) =>
    [...byKey.entries()].every(([key, values]) => {
      if (key.startsWith("_")) return true;
      const match = /^(.*?)(_ne|_like|_gte|_gt|_lte|_lt)?$/.exec(key);
      const field = match[1];
      const cell = row[field];
      switch (match[2]) {
        case "_ne": return values.every((v) => !same(cell, v));
        case "_like": return values.some((v) => has(cell ?? "", v));
        case "_gte": return values.every((v) => compare(cell, v) >= 0);
        case "_gt": return values.every((v) => compare(cell, v) > 0);
        case "_lte": return values.every((v) => compare(cell, v) <= 0);
        case "_lt": return values.every((v) => compare(cell, v) < 0);
        default: return values.some((v) => same(cell, v));
      }
    }),
  );
  const sortField = byKey.get("_sort")?.[0];
  if (sortField)
    out = sorted(out, { field: sortField, direction: byKey.get("_order")?.[0] === "desc" ? "descending" : "ascending" });
  const total = out.length;
  const page = byKey.get("_page")?.[0];
  const limit = byKey.get("_limit")?.[0];
  if (limit !== undefined) {
    const size = Number(limit);
    const start = (Math.max(1, Number(page ?? 1)) - 1) * size;
    out = out.slice(start, start + size);
  }
  return { items: out, headers: { "X-Total-Count": String(total) } };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const [, , file, port = "5199"] = process.argv;
  if (!file) {
    console.error("usage: node mock-query-server.mjs <rows.json> [port]");
    process.exit(1);
  }
  const rows = JSON.parse(readFileSync(file, "utf8"));
  createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    const send = (status, payload, headers = {}) => {
      response.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*", "access-control-expose-headers": "X-Total-Count", ...headers });
      response.end(JSON.stringify(payload));
    };
    if (request.method === "POST" && url.pathname === "/query") {
      let text = "";
      request.on("data", (chunk) => (text += chunk));
      request.on("end", () => send(200, answerBody(rows, text ? JSON.parse(text) : {})));
      return;
    }
    if (request.method === "GET" && url.pathname === "/rows") {
      const { items, headers } = answerSuffix(rows, url.searchParams);
      send(200, items, headers);
      return;
    }
    send(404, { error: "not found" });
  }).listen(Number(port), "127.0.0.1", () => console.log(`mock query server: ${rows.length} rows on http://127.0.0.1:${port}`));
}

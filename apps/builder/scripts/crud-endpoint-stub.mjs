// A local in-memory Users REST stub for the CRUD sample (`docs/how-to/samples/collection-crud.composition.json`).
// GET /users → rows (`?q=` filters by name · email, `?sort=<field>&dir=descending`; with `?limit=` a
//   page `{items, next}` — `?page=` from 1, `next` the next page or null: useAsyncList's cursor;
//   `?selected=u2,u3` adds that page's `selected` keys: useAsyncList load selectedKeys) ·
// GET /users/:id → one row (404 when none) · POST /users (create) · PUT /users (update by body.id) · DELETE /users (delete by body.id).
// Every request is printed (method · path · body · rows after). Restarting resets the rows.
// Usage: node apps/builder/scripts/crud-endpoint-stub.mjs [port=5198]
// STUB_DELAY_MS=1500 answers every request that much later (to see a Preview's loading state).
import { createServer } from "node:http";

const PORT = Number(process.argv[2] ?? 5198);
const DELAY_MS = Number(process.env.STUB_DELAY_MS ?? 0);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};
const FIELDS = ["name", "email", "role"];
let next = 4;
let rows = [
  { id: "u1", name: "김민준", email: "minjun@example.com", role: "admin" },
  { id: "u2", name: "이서연", email: "seoyeon@example.com", role: "editor" },
  { id: "u3", name: "박지호", email: "jiho@example.com", role: "viewer" },
];

const send = (res, status, value) => {
  res.writeHead(status, { ...CORS, "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
};
const pick = (body) =>
  Object.fromEntries(
    FIELDS.filter((key) => typeof body[key] === "string" && body[key].trim())
      .map((key) => [key, body[key].trim()]),
  );

createServer((req, res) => {
  let text = "";
  req.on("data", (chunk) => (text += chunk));
  req.on("end", () => setTimeout(() => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS);
      res.end();
      return;
    }
    const requestUrl = new URL(req.url ?? "/", "http://localhost");
    const path = requestUrl.pathname;
    const one = /^\/users\/([^/]+)$/.exec(path);
    if (one && req.method === "GET") {
      const row = rows.find((item) => item.id === decodeURIComponent(one[1]));
      console.log(JSON.stringify({ method: "GET", path, status: row ? 200 : 404 }));
      return row ? send(res, 200, row) : send(res, 404, { error: `${one[1]} 없음` });
    }
    if (path !== "/users") return send(res, 404, { error: "not found" });
    if (req.method === "GET") {
      const query = requestUrl.searchParams;
      const q = (query.get("q") ?? "").trim().toLowerCase();
      let found = q
        ? rows.filter((row) => `${row.name} ${row.email}`.toLowerCase().includes(q))
        : [...rows];
      const sort = query.get("sort");
      if (sort && FIELDS.concat("id").includes(sort)) {
        found.sort((a, b) => String(a[sort]).localeCompare(String(b[sort])));
        if (query.get("dir") === "descending") found.reverse();
      }
      const limit = Number(query.get("limit"));
      console.log(JSON.stringify({ method: "GET", path: `${path}${requestUrl.search}`, rows: found.length }));
      if (!limit) return send(res, 200, found);
      const page = Math.max(1, Number(query.get("page") ?? 1));
      const items = found.slice((page - 1) * limit, page * limit);
      // (`?selected=u2,u3` — the page's keys to select: useAsyncList load `selectedKeys`.)
      const selected = query.get("selected");
      return send(res, 200, {
        items,
        next: page * limit < found.length ? page + 1 : null,
        ...(selected ? { selected: selected.split(",").filter((key) => items.some((item) => item.id === key)) } : {}),
      });
    }
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      return send(res, 400, { error: "body 가 JSON 이 아닙니다" });
    }
    const id = typeof body.id === "string" ? body.id.trim() : "";
    let status = 200;
    let result;
    if (req.method === "POST") {
      result = { id: `u${next++}`, name: "", email: "", role: "viewer", ...pick(body) };
      rows = [...rows, result];
      status = 201;
    } else if (req.method === "PUT" || req.method === "PATCH") {
      const current = rows.find((row) => row.id === id);
      if (!current) status = 404;
      else {
        result = { ...current, ...pick(body) };
        rows = rows.map((row) => (row.id === id ? result : row));
      }
    } else if (req.method === "DELETE") {
      if (!rows.some((row) => row.id === id)) status = 404;
      else rows = rows.filter((row) => row.id !== id);
    } else status = 405;
    console.log(JSON.stringify({ method: req.method, path, body, status, rows: rows.length }));
    if (status >= 400) return send(res, status, { error: `${req.method} ${id || "(id 없음)"} → ${status}` });
    if (result) return send(res, status, result);
    res.writeHead(204, CORS);
    res.end();
  }, req.method === "OPTIONS" ? 0 : DELAY_MS));
}).listen(PORT, () => console.log(`users CRUD stub on http://localhost:${PORT}/users`));

// A local in-memory Users REST stub for the CRUD sample (`docs/how-to/samples/collection-crud.composition.json`).
// GET /users → rows · POST /users (create) · PUT /users (update by body.id) · DELETE /users (delete by body.id).
// Every request is printed (method · path · body · rows after). Restarting resets the rows.
// Usage: node apps/builder/scripts/crud-endpoint-stub.mjs [port=5198]
import { createServer } from "node:http";

const PORT = Number(process.argv[2] ?? 5198);
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
  req.on("end", () => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS);
      res.end();
      return;
    }
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (path !== "/users") return send(res, 404, { error: "not found" });
    if (req.method === "GET") return send(res, 200, rows);
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
  });
}).listen(PORT, () => console.log(`users CRUD stub on http://localhost:${PORT}/users`));

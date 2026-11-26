// ADR-324 — the live stand-in server for 「모아서 저장」 (G5): the same in-memory resource the unit
// gates use (`packages/shared/src/collections/save/saveEndpointStub.ts`, loaded with Node's type
// stripping) behind HTTP + CORS. Control routes (not part of the resource):
//   GET  /__stub/state            → { rows, log, writes }
//   POST /__stub/reset   {options} → a new server (options: saveEndpointStub's — base · versionField ·
//                                    createAnswer · atomic · acceptGzip · idempotencyHeader · rows …)
//   POST /__stub/fault   {fault}   → the next matching request takes it (`lose` drops the socket after
//                                    applying, `drop` before; `status` · `errors` · `staleWrite`)
// Usage: node apps/builder/scripts/save-endpoint-stub.mjs [port=5199]
import { createServer } from "node:http";
import { createSaveEndpointStub } from "../../../packages/shared/src/collections/save/saveEndpointStub.ts";

const PORT = Number(process.argv[2] ?? 5199);
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  "Access-Control-Expose-Headers": "Location, ETag",
};
const SAMPLE = {
  base: "/orders",
  versionField: "version",
  rows: [
    { id: "o1", name: "볼펜", quantity: 3, note: "", active: true, version: "v1" },
    { id: "o2", name: "노트", quantity: 10, note: "확인", active: false, version: "v1" },
    { id: "o3", name: "지우개", quantity: 0, note: null, active: true, version: "v1" },
  ],
};
let stub = createSaveEndpointStub(SAMPLE);

const readAll = (req) =>
  new Promise((resolve) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
  });
const sendJson = (res, status, value) => {
  res.writeHead(status, { ...CORS, "Content-Type": "application/json" });
  res.end(JSON.stringify(value));
};

createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    res.end();
    return;
  }
  const body = await readAll(req);
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  if (url.pathname === "/__stub/state")
    return sendJson(res, 200, { rows: [...stub.rows.values()], log: stub.log, writes: Object.fromEntries(stub.writes) });
  if (url.pathname === "/__stub/reset") {
    const given = body.length ? JSON.parse(body.toString("utf8")) : {};
    stub = createSaveEndpointStub({ ...SAMPLE, ...given });
    return sendJson(res, 200, { ok: true, options: stub.options });
  }
  if (url.pathname === "/__stub/fault") {
    const fault = JSON.parse(body.toString("utf8"));
    if (typeof fault.path === "string" && fault.path.startsWith("/") && fault.path.endsWith("/") && fault.path.length > 2)
      fault.path = new RegExp(fault.path.slice(1, -1));
    stub.inject(fault);
    return sendJson(res, 200, { ok: true });
  }
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) if (typeof value === "string") headers.set(name, value);
  const request = new Request(url, {
    method: req.method,
    headers,
    body: req.method === "GET" || req.method === "HEAD" || !body.length ? undefined : body,
  });
  try {
    const response = await stub.fetch(request);
    const out = { ...CORS };
    response.headers.forEach((value, name) => (out[name] = value));
    res.writeHead(response.status, out);
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    // (A lost answer: the write was applied — the socket closes with no response.)
    res.socket?.destroy();
  }
  const last = stub.log.at(-1);
  if (last) console.log(JSON.stringify({ method: last.method, path: last.path + last.query, status: last.status, body: last.body }));
}).listen(PORT, () => console.log(`save stub on http://localhost:${PORT}/orders (control: /__stub/state · reset · fault)`));

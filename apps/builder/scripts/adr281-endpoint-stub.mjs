// ADR-281 — a local endpoint stub for the Form submit samples (`docs/how-to/samples/`).
// Prints every request (method · path · content type · body); `/fail…` answers 500, the rest 204.
// Usage: node apps/builder/scripts/adr281-endpoint-stub.mjs [port=5199] [log file]
import { createServer } from "node:http";
import { appendFileSync } from "node:fs";

const PORT = Number(process.argv[2] ?? 5199);
const LOG = process.argv[3];
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
};

createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    if (req.method === "OPTIONS") {
      res.writeHead(204, CORS);
      res.end();
      return;
    }
    const line = JSON.stringify({
      method: req.method,
      url: req.url,
      type: req.headers["content-type"],
      body,
    });
    console.log(line);
    if (LOG) appendFileSync(LOG, `${line}\n`);
    if (req.url?.startsWith("/fail")) {
      res.writeHead(500, CORS);
      res.end("fail");
      return;
    }
    res.writeHead(204, CORS);
    res.end();
  });
}).listen(PORT, () => console.log(`endpoint stub on http://localhost:${PORT}`));

#!/usr/bin/env node
/**
 * ADR-244 Phase 0 — GitHub Pages 헤더 모사 서버 (breakdown §2.1).
 *
 * production dist 를 `/composition/` 아래로 Pages 처럼 제공한다:
 *   - 모든 응답 `Cache-Control: max-age=<초>` (기본 600) · 약한 ETag · `If-None-Match` → 304 · gzip
 *   - 없는 경로는 `404.html` 을 **404 상태로** (SPA 깊은 링크 — `spa-deep-link-live.mjs` 와 같은 규칙)
 *   - 서버측 대역폭 · RTT 제한 (모든 연결이 한 대역폭을 나눠 쓴다 — WebKit 에도 같은 조건)
 *   - 요청 기록 (경로 · 상태 · 전송 바이트 · 조건부 여부 · 시각) — 이중 받기 · 재검증 판정의 외부 oracle
 *
 * 모사하지 않는 것: HTTP/2 다중화 · CDN edge · TCP/TLS handshake 왕복 (RTT 는 응답 첫 바이트 지연으로만).
 *
 *   node apps/builder/scripts/adr244-pages-server.mjs --dist apps/builder/dist [--port 4244]
 *        [--max-age 600] [--rate-mbps 10] [--rtt 100]
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

const BASE = "/composition/";
const CHUNK = 16 * 1024;

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".wasm": "application/wasm",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".ico": "image/x-icon",
};
// Pages (Fastly) 가 압축하는 종류 — woff2 · png 는 이미 압축돼 있어 그대로 준다.
const GZIP = new Set([
  ".html",
  ".js",
  ".css",
  ".wasm",
  ".json",
  ".svg",
  ".ttf",
]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param {{ dist: string, port?: number, maxAge?: number, rateMbps?: number, rttMs?: number }} options
 */
export async function startPagesServer(options) {
  let dist = resolve(options.dist);
  let maxAge = options.maxAge ?? 600;
  let rateBps = (options.rateMbps ?? 0) * 125_000; // 0 = 무제한
  let rttMs = options.rttMs ?? 0;
  let noStoreAll = false;
  const log = [];
  /** @type {Map<string, { body: Buffer, gzip: Buffer | null, etag: string }>} */
  const cache = new Map();
  // 모든 연결이 나눠 쓰는 대역폭: 다음 chunk 를 보낼 수 있는 시각.
  let nextFree = 0;

  const load = (file) => {
    let entry = cache.get(file);
    if (entry) return entry;
    const body = readFileSync(file);
    const stat = statSync(file);
    entry = {
      body,
      gzip: GZIP.has(extname(file)) ? gzipSync(body, { level: 6 }) : null,
      etag: `W/"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`,
    };
    cache.set(file, entry);
    return entry;
  };

  const send = async (res, payload) => {
    if (rttMs > 0) await sleep(rttMs);
    let sent = 0;
    for (let i = 0; i < payload.length; i += CHUNK) {
      if (res.destroyed) return { sent, aborted: true };
      const chunk = payload.subarray(i, i + CHUNK);
      if (rateBps > 0) {
        const now = performance.now();
        const at = Math.max(now, nextFree);
        nextFree = at + (chunk.length / rateBps) * 1000;
        if (at > now) await sleep(at - now);
      }
      if (!res.write(chunk)) await new Promise((r) => res.once("drain", r));
      sent += chunk.length;
    }
    return { sent, aborted: false };
  };

  const server = createServer(async (req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const startedAt = Date.now();
    const conditional = Boolean(req.headers["if-none-match"]);
    const record = (status, bytes, aborted = false) =>
      log.push({ t: startedAt, path, status, bytes, conditional, aborted });

    if (!path.startsWith(BASE)) {
      res.writeHead(404).end();
      record(404, 0);
      return;
    }
    let file = normalize(join(dist, path.slice(BASE.length)));
    if (existsSync(file) && statSync(file).isDirectory())
      file = join(file, "index.html");
    let status = 200;
    if (!file.startsWith(dist) || !existsSync(file)) {
      file = join(dist, "404.html");
      status = 404;
      if (!existsSync(file)) {
        res.writeHead(404, { "content-type": "text/html" }).end("<h1>404</h1>");
        record(404, 0);
        return;
      }
    }
    const entry = load(file);
    const noStore = noStoreAll || path.endsWith("/version.json");
    const headers = {
      "content-type": TYPES[extname(file)] ?? "application/octet-stream",
      "cache-control": noStore ? "no-store" : `max-age=${maxAge}`,
      etag: entry.etag,
      vary: "Accept-Encoding",
    };
    if (status === 200 && req.headers["if-none-match"] === entry.etag) {
      if (rttMs > 0) await sleep(rttMs);
      res.writeHead(304, headers).end();
      record(304, 0);
      return;
    }
    const gzip =
      entry.gzip &&
      /\bgzip\b/.test(String(req.headers["accept-encoding"] ?? ""));
    const payload = gzip ? entry.gzip : entry.body;
    if (gzip) headers["content-encoding"] = "gzip";
    headers["content-length"] = payload.length;
    res.writeHead(status, headers);
    const { sent, aborted } = await send(res, payload);
    res.end();
    record(status, sent, aborted);
  });
  await new Promise((r) => server.listen(options.port ?? 0, "127.0.0.1", r));
  const origin = `http://127.0.0.1:${server.address().port}`;

  return {
    origin,
    base: `${origin}${BASE}`,
    log,
    /** 지금까지의 기록 수 — 이후 구간만 잘라 읽을 때의 시작 위치. */
    mark: () => log.length,
    since: (index) => log.slice(index),
    setProfile: (profile) => {
      rateBps = (profile.rateMbps ?? 0) * 125_000;
      rttMs = profile.rttMs ?? 0;
      nextFree = 0;
    },
    setMaxAge: (seconds) => {
      maxAge = seconds;
    },
    /** 준비 단계 (프로젝트 만들기) 의 응답이 HTTP 캐시에 남지 않게 한다 — 첫 방문 조건의 전제. */
    setNoStore: (on) => {
      noStoreAll = on;
    },
    /** 재배포 모사 (G1): 제공 dist 를 바꾼다. */
    setDist: (next) => {
      dist = resolve(next);
      cache.clear();
    },
    close: () => new Promise((r) => server.close(r)),
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const argv = process.argv.slice(2);
  const arg = (name, fallback) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : fallback;
  };
  const server = await startPagesServer({
    dist: arg("--dist", "apps/builder/dist"),
    port: Number(arg("--port", 4244)),
    maxAge: Number(arg("--max-age", 600)),
    rateMbps: Number(arg("--rate-mbps", 0)),
    rttMs: Number(arg("--rtt", 0)),
  });
  process.stdout.write(`${server.base}\n`);
}

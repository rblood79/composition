// ADR-248 G5 (§6.2 bundle): the JS a production build actually loads to boot, old vs new.
//
// `adr209-bundle-closure.mjs` measures the static initial closure (the ADR-201 budget's
// definition). §6.2 also asks for loader/boot cost: a chunk the entry imports dynamically but
// unconditionally at start is boot cost, not lazy. This script serves each dist (a static server,
// `/composition/` base), opens it in a fresh headless Chrome profile with the saved auth session,
// and sums gzip (level 9, per file — the closure tool's definition) of every JS file fetched:
//   builder — dashboard → new project → canvas + idle
//   preview — `preview.html` alone (no Builder messages: the boot set only)
// Usage: ADR248_AUTH_SESSION=<session> node scripts/adr248-g5-boot-bundle.mjs <out.json> \
//          <label>=<distDir>:<port> ...
import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, extname } from "node:path";
import { pathToFileURL } from "node:url";
import { loadStorageState } from "./perf-baseline.mjs";

const SETTLE_MS = 3000;

const TYPES = { ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".html": "text/html", ".wasm": "application/wasm", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".ico": "image/x-icon" };
/** A static server for a production dist under `/composition/` (SPA fallback = index.html). */
export function serveDist(distDir, port) {
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/composition\/?/, "");
    let file = join(distDir, path);
    if (!path || !existsSync(file) || statSync(file).isDirectory()) file = join(distDir, path.endsWith(".html") && existsSync(file) ? path : "index.html");
    res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream", "cross-origin-opener-policy": "same-origin", "cross-origin-embedder-policy": "credentialless" });
    res.end(readFileSync(file));
  });
  return new Promise((r) => server.listen(port, () => r({ close: () => server.close(), url: `http://localhost:${port}/composition` })));
}

function sizes(distDir, urls) {
  const files = [...new Set(urls.map((u) => new URL(u).pathname.replace(/^\/composition\//, "")))].filter((f) => f.endsWith(".js")).sort();
  let raw = 0, gzip = 0;
  const missing = [];
  for (const f of files) {
    const path = join(distDir, f);
    if (!existsSync(path)) { missing.push(f); continue; }
    const b = readFileSync(path);
    raw += b.length;
    gzip += gzipSync(b, { level: 9 }).length;
  }
  return { files: files.length, raw, gzip, missing, list: files };
}

async function loadedScripts(page) {
  return page.evaluate(() => performance.getEntriesByType("resource").map((e) => e.name).filter((n) => /\.js(\?|$)/.test(n)));
}

async function main() {
  const [out, ...targets] = process.argv.slice(2);
  const result = { measuredAt: new Date().toISOString(), gzip: "node:zlib gzipSync level 9 per file (adr209 closure definition)", targets: {} };
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  for (const target of targets) {
    const [label, spec] = target.split("=");
    const [distDir, port] = spec.split(":");
    const server = await serveDist(distDir, Number(port));
    const { url } = server;
    const errors = [];
    try {
      const origin = new URL(url).origin;
      const context = await browser.newContext({ storageState: loadStorageState(process.env.ADR248_AUTH_SESSION, origin), viewport: { width: 1440, height: 900 } });
      await context.addInitScript(() => performance.setResourceTimingBufferSize(100000));
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
      await page.goto(`${url}/dashboard`, { waitUntil: "networkidle" });
      const dashboard = await loadedScripts(page);
      await page.locator("button.dashboard-create-button").first().click();
      await page.locator("#new-project-name").fill(`g5-boot-${Date.now()}`);
      await page.locator("#new-project-name").press("Enter");
      await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 });
      await page.waitForSelector('[data-testid="skia-canvas-unified"]', { timeout: 60000 });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(SETTLE_MS);
      const builder = await loadedScripts(page);
      // The Builder's boot on a direct load of the project URL (no dashboard chunks first).
      const direct = await context.newPage();
      await direct.goto(page.url(), { waitUntil: "networkidle" });
      await direct.waitForSelector('[data-testid="skia-canvas-unified"]', { timeout: 60000 });
      await direct.waitForTimeout(SETTLE_MS);
      const builderDirect = await loadedScripts(direct);
      const preview = await context.newPage();
      await preview.goto(`${url}/preview.html`, { waitUntil: "networkidle" });
      await preview.waitForTimeout(SETTLE_MS);
      const previewScripts = await loadedScripts(preview);
      result.targets[label] = {
        distDir,
        dashboard: sizes(distDir, dashboard),
        builderViaDashboard: sizes(distDir, builder),
        builderDirect: sizes(distDir, builderDirect),
        preview: sizes(distDir, previewScripts),
        errors,
      };
      await context.close();
    } finally {
      server.close();
    }
    const t = result.targets[label];
    process.stdout.write(`${label}: builderDirect ${t.builderDirect.gzip} B (${t.builderDirect.files}) · preview ${t.preview.gzip} B (${t.preview.files}) · errors ${t.errors.length}\n`);
  }
  await browser.close();
  writeFileSync(out, JSON.stringify(result, null, 1));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) await main();

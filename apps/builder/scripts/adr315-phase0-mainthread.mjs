#!/usr/bin/env node
// ADR-315 Phase 0 — 보기 평가기 · 머리글 정렬의 화면 스레드 계산 시간 (10,000 · 100,000 행).
//   node apps/builder/scripts/adr315-phase0-mainthread.mjs <out-dir> [--rows 10000,100000]
// `adr315MainThreadBench.mjs` 를 production 으로 묶어 headed Chrome 의 main thread 에서 돌린다 —
// CPU 1x · 4x (CDP `Emulation.setCPUThrottlingRate`), 판정값은 브라우저의 `performance.now()`.
// 이 수치는 계산만이다 (입력 → 화면 반영의 렌더 · 배치는 들어 있지 않다 — G3 에서 따로 잰다).
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/adr315-phase0-mainthread";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const at = process.argv.indexOf("--rows");
const ROWS = (at > 0 ? process.argv[at + 1] : "10000,100000")
  .split(",")
  .map(Number);

const { build } = await import("vite");
await build({
  configFile: false,
  logLevel: "warn",
  root: `${REPO}/apps/builder`,
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    lib: {
      entry: `${REPO}/apps/builder/scripts/adr315MainThreadBench.mjs`,
      formats: ["es"],
      fileName: () => "bench.js",
    },
    outDir: `${OUT}/site`,
    emptyOutDir: true,
    minify: true,
  },
});
writeFileSync(
  `${OUT}/site/index.html`,
  `<!doctype html><meta charset="utf-8"><title>adr315 bench</title><body>
<script type="module">import { bench } from "./bench.js"; window.__bench = bench;</script>`,
);
const server = createServer((req, res) => {
  const path = new URL(req.url, "http://x").pathname;
  const file = join(`${OUT}/site`, path === "/" ? "index.html" : path);
  if (!existsSync(file)) {
    res.writeHead(204);
    res.end();
    return;
  }
  res.writeHead(200, {
    "content-type": file.endsWith(".js") ? "text/javascript" : "text/html",
  });
  res.end(readFileSync(file));
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.waitForFunction(() => typeof window.__bench === "function");
const cdp = await context.newCDPSession(page);

const stat = (ms) => {
  const sorted = [...ms].sort((a, b) => a - b);
  const q = (p) =>
    sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  return { p50: q(0.5), p95: q(0.95), max: sorted.at(-1) };
};
const results = {
  chrome: browser.version(),
  visibility: await page.evaluate(() => document.visibilityState),
  runs: {},
};
for (const rows of ROWS) {
  for (const rate of [1, 4]) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    const raw = await page.evaluate((n) => window.__bench(n, 7), rows);
    const table = {};
    for (const [name, { ms, size }] of Object.entries(raw))
      table[name] = { ...stat(ms), size };
    results.runs[`${rows}@${rate}x`] = table;
    process.stdout.write(`\n${rows.toLocaleString()} 행 · CPU ${rate}x\n`);
    for (const [name, row] of Object.entries(table))
      process.stdout.write(
        `  ${row.p50.toFixed(1).padStart(8)} ms p50 · ${row.p95.toFixed(1).padStart(8)} ms p95 · 결과 ${String(row.size).padStart(6)}  ${name}\n`,
      );
  }
}
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
await browser.close();
server.close();
process.stdout.write(`\n→ ${OUT}/results.json\n`);

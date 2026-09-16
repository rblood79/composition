#!/usr/bin/env node
/**
 * ADR-201 live 하니스 — 실제 Chromium (Playwright) + mock TUS 서버 (Node http).
 *
 *   node scripts/live.mjs g0            # Phase 0 first-nail: 100MB · onprogress · 강제 단절 → HEAD 재개
 *   node scripts/live.mjs heap          # Phase 1 G1: 4GB × parallel 3 업로드 중 JS 힙 Δ (CDP Runtime.getHeapUsage) 3회
 *   node scripts/live.mjs resume        # Phase 1 G1: 재개 3경로 (단절 · reload · 새 컨텍스트) 재전송 바이트
 *   node scripts/live.mjs all
 *
 * 대용량 파일은 sparse (`mkfile -n` / `truncate -s`) 로 디스크에 만들어 `<input type=file>` 에
 * setInputFiles 로 넣는다 — 실제 `File` 객체를 쓰고 힙을 오염시키지 않는다 (HC2 측정 무결성).
 * 결과 JSON 은 `scripts/results/<mode>-<timestamp>.json` 에 남긴다.
 */
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { build } from "tsup";
import { createMockTusServer } from "../test/mockTusServer.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, "..");
const SCRATCH =
  process.env.ADR201_SCRATCH ?? join(process.env.TMPDIR ?? "/tmp", "adr201-live");
const RESULTS = join(HERE, "results");
const MB = 1024 ** 2;
const GB = 1024 ** 3;

const mode = process.argv[2] ?? "g0";
const headless = !process.argv.includes("--headed");

mkdirSync(SCRATCH, { recursive: true });
mkdirSync(RESULTS, { recursive: true });

/** sparse 파일 생성 — macOS `mkfile -n`, 그 외 `truncate -s` */
function sparseFile(name, bytes) {
  const path = join(SCRATCH, name);
  if (existsSync(path) && statSync(path).size === bytes) return path;
  const r =
    process.platform === "darwin"
      ? spawnSync("mkfile", ["-n", `${bytes}`, path])
      : spawnSync("truncate", ["-s", `${bytes}`, path]);
  if (r.status !== 0) throw new Error(`sparse file failed: ${r.stderr}`);
  return path;
}

/** 하니스 정적 서버 — harness/*.html + tsup 번들 산출물 */
async function startHarnessServer(bundles) {
  const outDir = join(SCRATCH, "harness-dist");
  mkdirSync(outDir, { recursive: true });
  if (Object.keys(bundles).length > 0) await build({
    entry: bundles,
    outDir,
    format: ["esm"],
    target: "es2020",
    clean: true,
    silent: true,
    dts: false,
    sourcemap: false,
    splitting: false,
    config: false,
  });
  const types = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript" };
  const server = createServer((req, res) => {
    const name = (req.url ?? "/").split("?")[0].replace(/^\//, "");
    const candidates = [join(HERE, "harness", name), join(outDir, name), join(PKG, "dist", name)];
    const hit = candidates.find((p) => existsSync(p) && statSync(p).isFile());
    if (!hit) {
      res.statusCode = 404;
      return res.end("not found");
    }
    res.setHeader("Content-Type", types[extname(hit)] ?? "application/octet-stream");
    res.end(readFileSync(hit));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const port = server.address().port;
  return { url: `http://127.0.0.1:${port}`, close: () => server.close() };
}

function save(name, data) {
  const file = join(RESULTS, `${name}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`\n→ ${file}`);
}

const fmt = (n) => `${(n / MB).toFixed(2)} MB`;

// ---------------------------------------------------------------------------
// G0 — first-nail
// ---------------------------------------------------------------------------
async function runG0() {
  const chunkSize = 8 * MB;
  const size = 100 * MB;
  const abortAt = 50 * MB + 123_456; // 청크 경계가 아닌 지점에서 소켓 destroy (Chromium 은 재사용 소켓 reset 을 1회 자동 재시도 → 409 → HEAD)
  const downAt = 75 * MB + 65_536; // 서버 자체를 400ms 내린다 → XHR onerror (E_NETWORK) → backoff → HEAD
  const file = sparseFile("g0-100mb.bin", size);
  const mock = await createMockTusServer({ commitMode: "stream" });
  mock.setOptions({ abortAfterBytes: abortAt, downAfterBytes: downAt, downMs: 400 });
  const harness = await startHarnessServer({ driver: join(PKG, "src/core/drivers/xhr.ts") });
  const browser = await chromium.launch({ headless });
  const page = await browser.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") console.log("[page]", m.text());
  });
  await page.goto(`${harness.url}/g0.html`);
  await page.setInputFiles("#file", file);
  const t0 = Date.now();
  const result = await page.evaluate(
    ({ endpoint, chunkSize }) => window.__g0({ endpoint, chunkSize }),
    { endpoint: mock.endpoint, chunkSize },
  );
  const elapsedMs = Date.now() - t0;
  const version = browser.version();
  await browser.close();
  harness.close();
  const serverRetransmit = mock.stats.bytesReceived - size;
  const upload = Array.from(mock.uploads.values())[0];
  await mock.close();

  const summary = {
    gate: "G0",
    date: new Date().toISOString(),
    chromium: version,
    fileSize: size,
    chunkSize,
    abortAfterBytes: abortAt,
    downAfterBytes: downAt,
    progressEvents: result.progressEvents,
    progressMonotonic: result.progressMonotonic,
    disconnects: result.resumes,
    failureCodes: result.failures.map((f) => f.code ?? "http-status"),
    serverAborted: mock.stats.aborted,
    headResumeOffset: result.headResumeOffset,
    serverBytesReceived: mock.stats.bytesReceived,
    retransmitted: {
      clientBytes: result.retransmittedClientBytes,
      serverReceivedMinusSize: serverRetransmit,
      perDisconnectWithinChunkSize: serverRetransmit <= (result.resumes?.length ?? 1) * chunkSize,
    },
    finalServerOffset: result.finalServerOffset,
    serverPatches: upload?.patches,
    done: result.done,
    elapsedMs,
    pass:
      result.progressEvents > 0 &&
      result.progressMonotonic &&
      (result.resumes?.length ?? 0) >= 2 &&
      result.failures.some((f) => f.code === "E_NETWORK") &&
      result.done &&
      serverRetransmit <= 2 * chunkSize,
  };
  console.log(JSON.stringify(summary, null, 2));
  console.log(
    `\nG0 ${summary.pass ? "PASS" : "FAIL"} — progress ${summary.progressEvents} events · 단절 ${
      result.resumes?.length ?? 0
    }회 (${(result.resumes ?? []).map((r) => `${fmt(r.failedAt)} → HEAD ${fmt(r.serverOffset)}`).join(" / ")}) · 서버 수신 총 ${fmt(
      mock.stats.bytesReceived,
    )} → 재전송 ${fmt(serverRetransmit)} (단절 2회 합, 회당 ≤ ${fmt(chunkSize)})`,
  );
  save("g0", summary);
  if (!summary.pass) process.exitCode = 1;
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 공통 — IIFE 하니스 페이지 (JSP 와 같은 global 사용 경로)
// ---------------------------------------------------------------------------
async function ensureIife() {
  const iife = join(PKG, "dist/composition-upload.iife.js");
  if (!existsSync(iife)) spawnSync("pnpm", ["build"], { cwd: PKG, stdio: "ignore" });
  if (!existsSync(iife)) throw new Error("dist/composition-upload.iife.js 없음 — pnpm build");
}

async function openHarness(context, harnessUrl) {
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error" && !/ERR_CONNECTION|409|net::/.test(m.text())) console.log("[page]", m.text());
  });
  await page.goto(`${harnessUrl}/g1.html`);
  return page;
}

// ---------------------------------------------------------------------------
// G1 heap — 4GB × 3 (parallel 3) 업로드 중 JS 힙 Δ, CDP Runtime.getHeapUsage, 3회 (처녀 힙 = 새 컨텍스트)
// ---------------------------------------------------------------------------
async function runHeap() {
  await ensureIife();
  const chunkSize = 8 * MB;
  const sizes = [4 * GB, 4 * GB, 4 * GB];
  const files = sizes.map((b, i) => sparseFile(`heap-${i}-${b / GB}g.bin`, b));
  const mock = await createMockTusServer({ commitMode: "stream" });
  const harness = await startHarnessServer({});
  const browser = await chromium.launch({ headless });
  const runs = [];
  for (let run = 1; run <= 3; run++) {
    mock.reset();
    const context = await browser.newContext();
    const page = await openHarness(context, harness.url);
    const cdp = await context.newCDPSession(page);
    await cdp.send("HeapProfiler.enable");
    await cdp.send("HeapProfiler.collectGarbage");
    const heap = async () => (await cdp.send("Runtime.getHeapUsage")).usedSize;
    const baseline = await heap();
    const visibility = await page.evaluate(() => document.visibilityState);
    await page.evaluate(
      ({ endpoint, chunkSize }) =>
        window.__setup({ endpoint, chunkSize, parallelUploads: 3, retryDelays: [0, 500, 1000] }),
      { endpoint: mock.endpoint, chunkSize },
    );
    await page.setInputFiles("#file", files);
    const samples = [];
    const t0 = Date.now();
    const sampler = setInterval(async () => {
      try {
        samples.push({ t: Date.now() - t0, used: await heap() });
      } catch {
        /* 페이지 종료 */
      }
    }, 250);
    await page.evaluate(() => window.__wait("(items) => items.every((i) => i.status === 'done')", 600000));
    clearInterval(sampler);
    const elapsedMs = Date.now() - t0;
    const peakDuring = Math.max(baseline, ...samples.map((s) => s.used));
    const endBeforeGc = await heap();
    await cdp.send("HeapProfiler.collectGarbage");
    const endAfterGc = await heap();
    const perfMemory = await page.evaluate(() => window.__mem());
    const items = await page.evaluate(() => window.__items());
    const events = await page.evaluate(() => window.__events);
    const serverOffsets = Array.from(mock.uploads.values()).map((u) => u.offset);
    await context.close();
    const total = sizes.reduce((a, b) => a + b, 0);
    runs.push({
      run,
      visibilityState: visibility,
      baselineBytes: baseline,
      peakDuringBytes: peakDuring,
      peakDeltaBytes: peakDuring - baseline,
      endBeforeGcDeltaBytes: endBeforeGc - baseline,
      endAfterGcDeltaBytes: endAfterGc - baseline,
      samples: samples.length,
      elapsedMs,
      throughputMBps: Math.round(total / MB / (elapsedMs / 1000)),
      performanceMemoryUsed: perfMemory?.used ?? null,
      subscribeEvents: events,
      allDone: items.every((i) => i.status === "done") && serverOffsets.every((o, i) => o === sizes[i]),
      serverBytesReceived: mock.stats.bytesReceived,
      retransmittedBytes: mock.stats.bytesReceived - total,
    });
    console.log(
      `run ${run}: baseline ${fmt(baseline)} · peak Δ ${fmt(peakDuring - baseline)} · end(GC) Δ ${fmt(
        endAfterGc - baseline,
      )} · ${elapsedMs} ms · done=${runs[run - 1].allDone}`,
    );
  }
  const version = browser.version();
  await browser.close();
  harness.close();
  await mock.close();
  const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const summary = {
    gate: "G1-heap",
    date: new Date().toISOString(),
    chromium: version,
    headless,
    files: sizes,
    chunkSize,
    parallelUploads: 3,
    dryRun: false,
    limitBytes: 64 * MB,
    peakDeltaMedianBytes: median(runs.map((r) => r.peakDeltaBytes)),
    endAfterGcDeltaMedianBytes: median(runs.map((r) => r.endAfterGcDeltaBytes)),
    runs,
    pass: median(runs.map((r) => r.peakDeltaBytes)) <= 64 * MB && runs.every((r) => r.allDone),
  };
  console.log(
    `\nG1 heap ${summary.pass ? "PASS" : "FAIL"} — 3회 중앙값 peak Δ ${fmt(
      summary.peakDeltaMedianBytes,
    )} (상한 64 MB) · GC 후 Δ ${fmt(summary.endAfterGcDeltaMedianBytes)} · Chromium ${version} headless=${headless}`,
  );
  save("heap", summary);
  if (!summary.pass) process.exitCode = 1;
}

// ---------------------------------------------------------------------------
// G1 resume — 3경로 (네트워크 단절 · 새로고침 · 탭 종료) 재전송 ≤ chunkSize
// ---------------------------------------------------------------------------
async function runResume() {
  await ensureIife();
  const chunkSize = 8 * MB;
  const size = 256 * MB;
  const file = sparseFile("resume-256mb.bin", size);
  const harness = await startHarnessServer({});
  const browser = await chromium.launch({ headless });
  const results = {};
  const setup = (page, mock) =>
    page.evaluate(
      ({ endpoint, chunkSize }) =>
        window.__setup({ endpoint, chunkSize, retryDelays: [0, 300, 600, 1000, 2000] }),
      { endpoint: mock.endpoint, chunkSize },
    );
  const waitOffset = (page, bytes) =>
    page.evaluate((b) => window.__wait(`(items) => items[0] && items[0].offset >= ${b}`, 60000), bytes);
  const waitDone = (page) =>
    page.evaluate(() => window.__wait("(items) => items[0] && items[0].status === 'done'", 120000));
  const report = (name, mock, extra = {}) => {
    const upload = Array.from(mock.uploads.values());
    const retransmitted = mock.stats.bytesReceived - size;
    results[name] = {
      creations: mock.stats.creations,
      heads: mock.stats.heads,
      serverBytesReceived: mock.stats.bytesReceived,
      retransmittedBytes: retransmitted,
      finalOffset: upload[0]?.offset,
      withinChunkSize: retransmitted <= chunkSize && upload.length === 1 && upload[0].offset === size,
      ...extra,
    };
    console.log(
      `${name}: creations ${mock.stats.creations} · HEAD ${mock.stats.heads} · 재전송 ${fmt(
        retransmitted,
      )} (≤ ${fmt(chunkSize)}) · final ${fmt(upload[0]?.offset ?? 0)} → ${results[name].withinChunkSize ? "PASS" : "FAIL"}`,
    );
  };

  // (a) 네트워크 단절 — 100MB 지점에서 서버 600ms 다운 (XHR onerror → backoff → HEAD)
  {
    const mock = await createMockTusServer({ commitMode: "stream" });
    mock.setOptions({ downAfterBytes: 100 * MB + 4096, downMs: 600 });
    const context = await browser.newContext();
    const page = await openHarness(context, harness.url);
    await setup(page, mock);
    await page.setInputFiles("#file", file);
    await waitDone(page);
    const items = await page.evaluate(() => window.__items());
    report("network", mock, { serverDowns: mock.stats.aborted, attemptSeen: items[0].attempt });
    await context.close();
    await mock.close();
  }
  // (b) 새로고침 — 100MB 지점에서 page.reload(); 같은 파일 재선택 → localStorage fingerprint → HEAD
  {
    const mock = await createMockTusServer({ commitMode: "stream" });
    const context = await browser.newContext();
    const page = await openHarness(context, harness.url);
    await setup(page, mock);
    await page.setInputFiles("#file", file);
    await waitOffset(page, 100 * MB);
    const before = Array.from(mock.uploads.values())[0].offset;
    await page.reload();
    const stored = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("cu:")));
    const storedValues = await page.evaluate(() => Object.values(localStorage).join("|"));
    await setup(page, mock);
    await page.setInputFiles("#file", file);
    await waitDone(page);
    report("reload", mock, {
      offsetAtReload: before,
      localStorageKeys: stored.length,
      storageContainsFileName: storedValues.includes("resume-256mb"),
    });
    await context.close();
    await mock.close();
  }
  // (c) 탭 종료 — 같은 브라우저 컨텍스트에서 페이지 close 후 새 페이지 (새 JS 컨텍스트, 같은 origin 저장소)
  {
    const mock = await createMockTusServer({ commitMode: "stream" });
    const context = await browser.newContext();
    const page = await openHarness(context, harness.url);
    await setup(page, mock);
    await page.setInputFiles("#file", file);
    await waitOffset(page, 100 * MB);
    const before = Array.from(mock.uploads.values())[0].offset;
    await page.close();
    const page2 = await openHarness(context, harness.url);
    await setup(page2, mock);
    await page2.setInputFiles("#file", file);
    await waitDone(page2);
    report("tab-close", mock, { offsetAtClose: before });
    await context.close();
    await mock.close();
  }
  const version = browser.version();
  await browser.close();
  harness.close();
  const summary = {
    gate: "G1-resume",
    date: new Date().toISOString(),
    chromium: version,
    headless,
    fileSize: size,
    chunkSize,
    paths: results,
    pass: Object.values(results).every((r) => r.withinChunkSize),
  };
  console.log(`\nG1 resume ${summary.pass ? "PASS" : "FAIL"}`);
  save("resume", summary);
  if (!summary.pass) process.exitCode = 1;
}

const runners = { g0: runG0, heap: runHeap, resume: runResume };

if (mode === "all") {
  for (const r of Object.values(runners)) await r();
} else if (runners[mode]) {
  await runners[mode]();
} else {
  console.error(`unknown mode: ${mode} (${Object.keys(runners).join(" | ")} | all)`);
  process.exit(2);
}

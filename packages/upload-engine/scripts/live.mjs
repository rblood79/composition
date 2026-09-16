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
  await build({
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
    const candidates = [join(HERE, "harness", name), join(outDir, name)];
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
const runners = { g0: runG0 };
if (mode === "all") {
  for (const r of Object.values(runners)) await r();
} else if (runners[mode]) {
  await runners[mode]();
} else {
  console.error(`unknown mode: ${mode} (${Object.keys(runners).join(" | ")} | all)`);
  process.exit(2);
}

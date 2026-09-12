#!/usr/bin/env node
// adr218-m5-measure.mjs — ADR-218 m5 (breakdown §2.1 · §5) 수치 실측.
//   (1) IDB write/read p95 — collection_runtime put/get, fixture 100·1000·5000 행 (cold 1 + warm N)
//   (2) 목록 로드 p95 A/B — 빈 캐시 arm(현행 memory-only 와 같은 로드 경로) vs 3 collection × 5000 행
//       캐시 arm. 실제 execute 가 만든 캐시(지문 유효) 를 reload 로 hydration. 번갈아 측정(드리프트 상쇄).
//   (3) interval 누적 힙 고수위선 — 5000 행 응답을 1초 주기로 60 tick, 5 tick 마다 GC 후 usedSize.
//       warm(10 tick) 이후 기울기·고수위선. 실제 스케줄러 경로(Q4).
// 판정선(측정 전 고정): IDB put/get p95(5000행) ≤ 100 ms · 목록 로드 p95 증가 ≤ +150 ms(초기 로드 3s 의 5%)
//   · interval 힙: warm 이후 60 tick 기울기 합 ≤ 1× payload · 고수위선 − warm ≤ 3× payload.
// 조건: headless Chromium · DPR 2 · foreground(단일 탭) · CPU throttle 없음 · dev 서버 5173.
// 사용: node apps/builder/scripts/adr218-m5-measure.mjs [--ticks 60] [--loads 6]
//   production arm: M5_BASE_URL=http://localhost:4173/composition M5_STORAGE=<4173 origin storageState> (vite preview --base /composition/)
import { createServer } from "node:http";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = process.env.M5_BASE_URL ?? "http://localhost:5173";
const STORAGE_STATE = resolve(
  process.env.M5_STORAGE ?? "apps/builder/scripts/.auth-session.json",
);
const OUT_DIR = process.env.ADR218_OUT ?? "docs/adr/evidence/218-m5";
const argv = process.argv.slice(2);
const opt = (n, d) => {
  const i = argv.indexOf(`--${n}`);
  return i >= 0 ? Number(argv[i + 1]) : d;
};
const TICKS = opt("ticks", 60);
const LOADS = opt("loads", 6);
const WARM_TICKS = 10;
const TIERS = [100, 1000, 5000];
const log = (...a) => console.log("[ADR-218 m5]", ...a);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const p = (arr, q) => {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)];
};
const fmt = (n) => (Number.isFinite(n) ? n.toFixed(1) : "n/a");
const sha = execSync("git rev-parse --short HEAD").toString().trim();
const dirty = execSync("git status --porcelain")
  .toString()
  .trim()
  .split("\n")
  .filter(Boolean).length;

// ─── fixture 행 (5 필드) ───
const FIELDS = [
  { id: "f-id", key: "id", type: "number" },
  { id: "f-name", key: "name", type: "string" },
  { id: "f-email", key: "email", type: "string" },
  { id: "f-score", key: "score", type: "number" },
  { id: "f-city", key: "city", type: "string" },
];
const CITIES = ["Seoul", "Busan", "Incheon", "Daegu", "Daejeon", "Gwangju"];
const makeRows = (n) =>
  Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    name: `user_${i + 1}`,
    email: `user_${i + 1}@example.com`,
    score: (i * 37) % 1000,
    city: CITIES[i % CITIES.length],
  }));
const payloadBytes = (n) => Buffer.byteLength(JSON.stringify(makeRows(n)));

// ─── 로컬 API — /rows?n=N (지연 0) ───
let hits = 0;
const server = createServer((req, res) => {
  hits += 1;
  const url = new URL(req.url, "http://x");
  const n = Number(url.searchParams.get("n") ?? 100);
  // production 빌드(vite preview) 는 dev 프록시가 없어 CORS 헤더가 필요하다
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ data: makeRows(n) }));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const baseUrl = `http://127.0.0.1:${port}`;

// ─── IDB helpers ───
async function idbPut(page, store, row) {
  return page.evaluate(
    async ({ store, row }) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("composition");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      await new Promise((res, rej) => {
        const tx = db.transaction(store, "readwrite");
        tx.objectStore(store).put(row);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { store, row },
  );
}
async function idbGetAll(page, store) {
  return page.evaluate(async (store) => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("composition");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const rows = await new Promise((res, rej) => {
      const g = db.transaction(store, "readonly").objectStore(store).getAll();
      g.onsuccess = () => res(g.result);
      g.onerror = () => rej(g.error);
    });
    db.close();
    return rows;
  }, store);
}
async function idbClear(page, store) {
  return page.evaluate(async (store) => {
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("composition");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    await new Promise((res, rej) => {
      const tx = db.transaction(store, "readwrite");
      tx.objectStore(store).clear();
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    });
    db.close();
  }, store);
}
async function idbPatch(page, store, id, patchFnStr) {
  return page.evaluate(
    async ({ store, id, patchFnStr }) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("composition");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      const patch = new Function("row", patchFnStr);
      await new Promise((res, rej) => {
        const tx = db.transaction(store, "readwrite");
        const os = tx.objectStore(store);
        const g = os.get(id);
        g.onsuccess = () => {
          if (g.result) os.put(patch(g.result));
        };
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      });
      db.close();
    },
    { store, id, patchFnStr },
  );
}

// (1) raw IDB put/get 타이밍 — 페이지 안에서 실제 store 에 실제 형태의 행을 넣고 읽는다.
async function measureIdb(page, projectId, n, warm) {
  return page.evaluate(
    async ({ projectId, n, warm, rows, fieldKeys }) => {
      const open = () =>
        new Promise((res, rej) => {
          const r = indexedDB.open("composition");
          r.onsuccess = () => res(r.result);
          r.onerror = () => rej(r.error);
        });
      const db = await open();
      const id = `m5-idb-${n}`;
      const row = {
        collectionId: id,
        project_id: projectId,
        runtimeData: rows,
        sourceRev: "m5-fixture-rev",
        fieldKeys,
        updated_at: new Date().toISOString(),
      };
      const put = () =>
        new Promise((res, rej) => {
          const t0 = performance.now();
          const tx = db.transaction("collection_runtime", "readwrite");
          tx.objectStore("collection_runtime").put(row);
          tx.oncomplete = () => res(performance.now() - t0);
          tx.onerror = () => rej(tx.error);
        });
      const get = () =>
        new Promise((res, rej) => {
          const t0 = performance.now();
          const g = db
            .transaction("collection_runtime", "readonly")
            .objectStore("collection_runtime")
            .get(id);
          g.onsuccess = () => {
            const len = g.result?.runtimeData?.length;
            res({ ms: performance.now() - t0, len });
          };
          g.onerror = () => rej(g.error);
        });
      const puts = [];
      const gets = [];
      let len = 0;
      for (let i = 0; i < warm + 1; i++) {
        puts.push(await put());
        const r = await get();
        gets.push(r.ms);
        len = r.len;
      }
      // 정리
      await new Promise((res) => {
        const tx = db.transaction("collection_runtime", "readwrite");
        tx.objectStore("collection_runtime").delete(id);
        tx.oncomplete = () => res();
      });
      db.close();
      return { puts, gets, len };
    },
    {
      projectId,
      n,
      warm,
      rows: makeRows(n),
      fieldKeys: Object.fromEntries(FIELDS.map((f) => [f.id, f.key])),
    },
  );
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});
// 페이지 계측: collection_runtime 의 index.getAll(hydration 읽기)·put(execute 영속) 을 in-situ 타이밍.
await context.addInitScript(() => {
  const m = (window.__m5 = { reads: [], puts: [], lastReadEnd: null });
  const ga = IDBIndex.prototype.getAll;
  IDBIndex.prototype.getAll = function (...args) {
    const req = ga.apply(this, args);
    if (this.objectStore?.name === "collection_runtime") {
      const t0 = performance.now();
      req.addEventListener("success", () => {
        const t1 = performance.now();
        m.reads.push({ ms: t1 - t0, rows: req.result?.length ?? 0 });
        m.lastReadEnd = t1;
      });
    }
    return req;
  };
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (...args) {
    const req = put.apply(this, args);
    if (this.name === "collection_runtime") {
      const t0 = performance.now();
      const rows = args[0]?.runtimeData?.length ?? 0;
      this.transaction.addEventListener("complete", () => {
        m.puts.push({ ms: performance.now() - t0, rows });
      });
    }
    return req;
  };
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const cdp = await context.newCDPSession(page);
await cdp.send("HeapProfiler.enable");
const heapUsed = async () => {
  await cdp.send("HeapProfiler.collectGarbage");
  const { usedSize } = await cdp.send("Runtime.getHeapUsage");
  return usedSize;
};

const result = {
  at: new Date().toISOString(),
  sha,
  dirty,
  baseUrl: BASE_URL,
  conditions:
    "headless Chromium · DPR 2 · 단일 탭 foreground · CPU throttle 없음 · 로컬 API 지연 0",
  passLines: {
    idbP95Ms5000: 100,
    loadP95DeltaMs: 150,
    heapSlopeMaxPayloads: 1,
    heapHighWaterMaxPayloads: 3,
  },
  payloadBytes: Object.fromEntries(TIERS.map((n) => [n, payloadBytes(n)])),
  idb: {},
  load: {},
  heap: {},
  verdict: {},
};

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const nameInput = page.locator("#new-project-name");
  await nameInput.waitFor({ state: "visible", timeout: 10_000 });
  await nameInput.fill(`adr218-m5-${Date.now()}`);
  await nameInput.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const projectId = page.url().split("/builder/")[1];
  log("project", projectId, "sha", sha, "dirty", dirty);

  // ── (1) IDB put/get p95 ──
  for (const n of TIERS) {
    const r = await measureIdb(page, projectId, n, 10);
    result.idb[n] = {
      bytes: result.payloadBytes[n],
      rowsRead: r.len,
      putColdMs: r.puts[0],
      putWarmP50: p(r.puts.slice(1), 0.5),
      putWarmP95: p(r.puts.slice(1), 0.95),
      getColdMs: r.gets[0],
      getWarmP50: p(r.gets.slice(1), 0.5),
      getWarmP95: p(r.gets.slice(1), 0.95),
    };
    const x = result.idb[n];
    log(
      `IDB ${n}행 ${(x.bytes / 1024).toFixed(0)}KB — put cold ${fmt(x.putColdMs)} / warm p95 ${fmt(x.putWarmP95)} · get cold ${fmt(x.getColdMs)} / warm p95 ${fmt(x.getWarmP95)} ms`,
    );
  }

  // ── 시드: collection 3 × endpoint 3 (5000 행, interval 2s) → 실제 execute 로 캐시 생성 ──
  const now = new Date().toISOString();
  const cols = [];
  for (let k = 0; k < 3; k++) {
    const cid = randomUUID();
    const eid = randomUUID();
    cols.push({ cid, eid });
    await idbPut(page, "collections", {
      id: cid,
      name: `Users${k}`,
      project_id: projectId,
      schema: FIELDS,
      mockData: [],
      useMockData: false,
      executionPolicy: { mode: "interval", intervalSec: 2 },
      created_at: now,
      updated_at: now,
    });
    await idbPut(page, "api_endpoints", {
      id: eid,
      name: `getUsers${k}`,
      project_id: projectId,
      method: "GET",
      baseUrl,
      path: `/rows?n=5000&k=${k}`,
      headers: [],
      queryParams: [],
      bodyType: "none",
      responseMapping: { dataPath: "data" },
      executionMode: "client",
      timeout: 30000,
      retryCount: 0,
      targetCollectionId: cid,
      created_at: now,
      updated_at: now,
    });
  }
  hits = 0;
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  for (let i = 0; i < 20 && hits < 3; i++) await sleep(500);
  await sleep(1500);
  let runtime = await idbGetAll(page, "collection_runtime");
  const cached = runtime.filter((r) => r.runtimeData?.length === 5000).length;
  const putsInSitu = await page.evaluate(() => window.__m5.puts);
  result.load.cachedCollections = cached;
  result.load.executePutInSitu = {
    n: putsInSitu.length,
    p50: p(
      putsInSitu.map((x) => x.ms),
      0.5,
    ),
    p95: p(
      putsInSitu.map((x) => x.ms),
      0.95,
    ),
  };
  log(
    `캐시 생성: ${cached}/3 (hits ${hits}) · execute 경로 put in-situ p95 ${fmt(result.load.executePutInSitu.p95)} ms`,
  );
  if (cached !== 3) throw new Error(`캐시 3 미생성 (${cached})`);
  // 정책 manual 로 → reload 시 실행 없음 (hydration 만 측정)
  for (const { cid } of cols)
    await idbPatch(
      page,
      "collections",
      cid,
      "delete row.executionPolicy; return row;",
    );
  const cacheRows = await idbGetAll(page, "collection_runtime");

  // ── (2) 목록 로드 A/B — 번갈아 (A=빈 캐시, B=캐시 3×5000) ──
  const loadOnce = async (arm) => {
    hits = 0;
    const t0 = performance.now();
    await page.reload({ waitUntil: "commit" });
    await waitReady(page, { settleMs: 0 });
    const readyMs = performance.now() - t0;
    const readyPage = await page.evaluate(() => performance.now());
    await sleep(1500); // hydration 이 ready 뒤에 끝나는 경우를 잡는다
    const m = await page.evaluate(() => ({
      reads: window.__m5.reads,
      lastReadEnd: window.__m5.lastReadEnd,
    }));
    // hydration 읽기가 ready 이후에 끝났으면 그 초과분을 총비용에 더한다 (페이지 시계 기준)
    const afterReadyMs =
      m.lastReadEnd == null ? 0 : Math.max(0, m.lastReadEnd - readyPage);
    return {
      arm,
      readyMs,
      hydrationReadMs: m.reads.reduce((a, r) => a + r.ms, 0),
      hydrationRows: m.reads.reduce((a, r) => a + r.rows, 0),
      hydrationAfterReadyMs: afterReadyMs,
      totalMs: readyMs + afterReadyMs,
      refetch: hits,
    };
  };
  // warm-up 1회 (버림)
  await loadOnce("warm");
  const loads = [];
  for (let i = 0; i < LOADS; i++) {
    await idbClear(page, "collection_runtime");
    loads.push(await loadOnce("A-empty"));
    for (const r of cacheRows) await idbPut(page, "collection_runtime", r);
    loads.push(await loadOnce("B-cached"));
  }
  const A = loads.filter((l) => l.arm === "A-empty");
  const B = loads.filter((l) => l.arm === "B-cached");
  result.load.runs = loads;
  result.load.A = {
    p50: p(
      A.map((l) => l.totalMs),
      0.5,
    ),
    p95: p(
      A.map((l) => l.totalMs),
      0.95,
    ),
  };
  result.load.B = {
    p50: p(
      B.map((l) => l.totalMs),
      0.5,
    ),
    p95: p(
      B.map((l) => l.totalMs),
      0.95,
    ),
    afterReadyP95: p(
      B.map((l) => l.hydrationAfterReadyMs),
      0.95,
    ),
    hydrationReadP95: p(
      B.map((l) => l.hydrationReadMs),
      0.95,
    ),
    hydrationRows: B[0]?.hydrationRows,
    refetch: B.reduce((a, l) => a + l.refetch, 0),
  };
  result.load.deltaP95 = result.load.B.p95 - result.load.A.p95;
  log(
    `로드 A(빈) p50/p95 ${fmt(result.load.A.p50)}/${fmt(result.load.A.p95)} · B(3×5000) p50/p95 ${fmt(result.load.B.p50)}/${fmt(result.load.B.p95)} · Δp95 ${fmt(result.load.deltaP95)} ms · hydration IDB read p95 ${fmt(result.load.B.hydrationReadP95)} ms (${result.load.B.hydrationRows} 행, 재fetch ${result.load.B.refetch})`,
  );

  // ── (3) interval 누적 힙 — collection 1 (5000 행) · 1초 주기 · TICKS ──
  for (const { cid } of cols.slice(1))
    await idbPatch(
      page,
      "collections",
      cid,
      "row.executionPolicy = undefined; return row;",
    );
  await idbPatch(
    page,
    "collections",
    cols[0].cid,
    'row.executionPolicy = { mode: "interval", intervalSec: 1 }; return row;',
  );
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  hits = 0;
  const samples = [];
  const t0 = Date.now();
  let lastSampledTick = -1;
  while (hits < TICKS && Date.now() - t0 < (TICKS + 20) * 1000) {
    if (hits % 5 === 0 && hits !== lastSampledTick) {
      lastSampledTick = hits;
      samples.push({ tick: hits, used: await heapUsed(), t: Date.now() - t0 });
    }
    await sleep(200);
  }
  samples.push({ tick: hits, used: await heapUsed(), t: Date.now() - t0 });
  const payload = result.payloadBytes[5000];
  const warmSample = samples.find((s) => s.tick >= WARM_TICKS) ?? samples[0];
  const after = samples.filter((s) => s.tick >= WARM_TICKS);
  // 최소자승 기울기 (byte/tick)
  const mx = after.reduce((a, s) => a + s.tick, 0) / after.length;
  const my = after.reduce((a, s) => a + s.used, 0) / after.length;
  const slope =
    after.reduce((a, s) => a + (s.tick - mx) * (s.used - my), 0) /
    Math.max(
      1,
      after.reduce((a, s) => a + (s.tick - mx) ** 2, 0),
    );
  const highWater = Math.max(...samples.map((s) => s.used));
  result.heap = {
    ticks: hits,
    elapsedS: (Date.now() - t0) / 1000,
    payloadBytes: payload,
    samples,
    warmUsed: warmSample.used,
    highWater,
    highWaterMinusWarmPayloads: (highWater - warmSample.used) / payload,
    slopeBytesPerTick: slope,
    slopeTotalPayloads: (slope * (hits - WARM_TICKS)) / payload,
    lastMinusWarmPayloads: (samples.at(-1).used - warmSample.used) / payload,
  };
  log(
    `interval 힙: ${hits} tick / ${result.heap.elapsedS.toFixed(0)}s · warm ${(warmSample.used / 1048576).toFixed(1)}MB · 고수위 ${(highWater / 1048576).toFixed(1)}MB (+${result.heap.highWaterMinusWarmPayloads.toFixed(2)}× payload) · 기울기 ${(slope / 1024).toFixed(1)} KB/tick (누적 ${result.heap.slopeTotalPayloads.toFixed(2)}× payload) · 마지막−warm ${result.heap.lastMinusWarmPayloads.toFixed(2)}×`,
  );
  // 정리: 정책 제거 후 타이머 0 (R6 재확인)
  await idbPatch(
    page,
    "collections",
    cols[0].cid,
    "delete row.executionPolicy; return row;",
  );
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  hits = 0;
  await sleep(3000);
  result.heap.timerAfterRemove = hits;

  result.verdict = {
    idb5000:
      result.idb[5000].putWarmP95 <= 100 && result.idb[5000].getWarmP95 <= 100,
    loadDelta: result.load.deltaP95 <= 150 && result.load.B.refetch === 0,
    heap:
      Math.abs(result.heap.slopeTotalPayloads) <= 1 &&
      result.heap.highWaterMinusWarmPayloads <= 3,
    timerAfterRemove: result.heap.timerAfterRemove === 0,
    pageErrors: errors.length === 0,
  };
} catch (e) {
  result.error = String(e?.stack ?? e).slice(0, 800);
  log("ERROR", result.error);
} finally {
  result.errors = errors;
  writeFileSync(
    resolve(OUT_DIR, process.env.M5_OUT_NAME ?? "218-m5-measure.json"),
    JSON.stringify(result, null, 2),
  );
  await browser.close();
  server.close();
}
const failed = Object.entries(result.verdict).filter(([, v]) => !v);
log(`verdict ${JSON.stringify(result.verdict)}`);
process.exit(failed.length === 0 && !result.error ? 0 : 1);

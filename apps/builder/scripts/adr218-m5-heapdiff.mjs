// adr218-m5-heapdiff.mjs — ADR-218 m5 진단: interval N tick 힙 스냅샷 diff (tick A vs tick B), 생성자별 self_size 증가 상위.
// 사용: node apps/builder/scripts/adr218-m5-heapdiff.mjs [rows=5000] [ticks=60] [interval|manual-loop] [firstSnapshotTick=10]
//   production arm: M5_BASE_URL=http://localhost:4173/composition M5_STORAGE=<4173 storageState>
import { createServer } from "node:http";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { randomUUID } from "node:crypto";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = process.env.M5_BASE_URL ?? "http://localhost:5173";
const STORAGE_STATE = resolve(
  process.env.M5_STORAGE ?? "apps/builder/scripts/.auth-session.json",
);
const N = Number(process.argv[2] ?? 5000);
const TICKS = Number(process.argv[3] ?? 60);
const MODE = process.argv[4] ?? "interval"; // interval | manual-loop (하니스가 store.execute 직접 반복 — 스케줄러 배제 대조군)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FIELDS = [
  { id: "f-id", key: "id", type: "number" },
  { id: "f-name", key: "name", type: "string" },
  { id: "f-email", key: "email", type: "string" },
  { id: "f-score", key: "score", type: "number" },
  { id: "f-city", key: "city", type: "string" },
];
const rows = Array.from({ length: N }, (_, i) => ({
  id: i + 1,
  name: `user_${i + 1}`,
  email: `user_${i + 1}@example.com`,
  score: (i * 37) % 1000,
  city: "Seoul",
}));
let hits = 0;
const server = createServer((req, res) => {
  hits++;
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify({ data: rows }));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const baseUrl = `http://127.0.0.1:${server.address().port}`;

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

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
await cdp.send("HeapProfiler.enable");

async function snapshot() {
  await cdp.send("HeapProfiler.collectGarbage");
  let buf = "";
  const onChunk = (e) => {
    buf += e.chunk;
  };
  cdp.on("HeapProfiler.addHeapSnapshotChunk", onChunk);
  await cdp.send("HeapProfiler.takeHeapSnapshot", {
    reportProgress: false,
    treatGlobalObjectsAsRoots: true,
  });
  cdp.off("HeapProfiler.addHeapSnapshotChunk", onChunk);
  const snap = JSON.parse(buf);
  const f = snap.snapshot.meta.node_fields;
  const nf = f.length;
  const iType = f.indexOf("type"),
    iName = f.indexOf("name"),
    iSize = f.indexOf("self_size");
  const types = snap.snapshot.meta.node_types[0];
  const agg = new Map();
  let total = 0;
  let count = 0;
  const nodes = snap.nodes,
    strings = snap.strings;
  for (let i = 0; i < nodes.length; i += nf) {
    const t = types[nodes[i + iType]];
    const name = strings[nodes[i + iName]];
    const s = nodes[i + iSize];
    const key = `${t}:${t === "string" || t === "concatenated string" || t === "sliced string" ? "(string)" : name.slice(0, 60)}`;
    const cur = agg.get(key) ?? { size: 0, n: 0 };
    cur.size += s;
    cur.n += 1;
    agg.set(key, cur);
    total += s;
    count++;
  }
  return { agg, total, count };
}
const { usedSize: u0 } = await cdp.send("Runtime.getHeapUsage");

await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
await page.locator("button.dashboard-create-button").first().click();
const nameInput = page.locator("#new-project-name");
await nameInput.fill(`adr218-heap-${Date.now()}`);
await nameInput.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
await waitReady(page);
const projectId = page.url().split("/builder/")[1];
const cid = randomUUID(),
  eid = randomUUID(),
  now = new Date().toISOString();
await idbPut(page, "collections", {
  id: cid,
  name: "Users",
  project_id: projectId,
  schema: FIELDS,
  mockData: [],
  useMockData: false,
  ...(MODE === "interval"
    ? { executionPolicy: { mode: "interval", intervalSec: 1 } }
    : {}),
  created_at: now,
  updated_at: now,
});
await idbPut(page, "api_endpoints", {
  id: eid,
  name: "getUsers",
  project_id: projectId,
  method: "GET",
  baseUrl,
  path: "/rows",
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
await page.reload({ waitUntil: "networkidle" });
await waitReady(page);
hits = 0;
const t0 = Date.now();
if (MODE === "manual-loop") {
  // 대조군: 스케줄러 없이 페이지 안에서 store.executeApiEndpoint 를 1초마다 직접 호출 (dev 전역 없음 → UI Send 경로 대신 모듈 import)
  await page.evaluate(async (eid) => {
    const mod = await import("/src/builder/stores/data.ts");
    window.__exec = () => mod.useDataStore.getState().executeApiEndpoint(eid);
  }, eid);
}
const tickTo = async (n) => {
  while (hits < n && Date.now() - t0 < (TICKS + 30) * 1000) {
    if (MODE === "manual-loop") {
      await page.evaluate(() => window.__exec());
    }
    await sleep(MODE === "manual-loop" ? 1000 : 200);
  }
};
await tickTo(Number(process.argv[5] ?? 10));
const A = await snapshot();
const { usedSize: uA } = await cdp.send("Runtime.getHeapUsage");
await tickTo(TICKS);
const B = await snapshot();
const { usedSize: uB } = await cdp.send("Runtime.getHeapUsage");
console.log(
  `mode=${MODE} N=${N} ticks ${hits} · usedSize tick10 ${(uA / 1048576).toFixed(2)}MB → tick${hits} ${(uB / 1048576).toFixed(2)}MB (Δ ${((uB - uA) / 1024).toFixed(0)} KB) · snapshot total ${(A.total / 1048576).toFixed(2)} → ${(B.total / 1048576).toFixed(2)}MB nodes ${A.count} → ${B.count}`,
);
const keys = new Set([...A.agg.keys(), ...B.agg.keys()]);
const diff = [...keys]
  .map((k) => {
    const a = A.agg.get(k) ?? { size: 0, n: 0 };
    const b = B.agg.get(k) ?? { size: 0, n: 0 };
    return { k, dSize: b.size - a.size, dN: b.n - a.n, bN: b.n };
  })
  .sort((x, y) => y.dSize - x.dSize);
console.log("--- 증가 상위 25 (self_size Δ) ---");
for (const d of diff.slice(0, 25))
  console.log(
    `${(d.dSize / 1024).toFixed(1).padStart(8)} KB  Δn ${String(d.dN).padStart(6)}  n ${String(d.bN).padStart(7)}  ${d.k}`,
  );
console.log("--- 감소 상위 5 ---");
for (const d of diff.slice(-5))
  console.log(
    `${(d.dSize / 1024).toFixed(1).padStart(8)} KB  Δn ${String(d.dN).padStart(6)}  ${d.k}`,
  );
await browser.close();
server.close();

#!/usr/bin/env node
/**
 * ADR-190 Phase 3 / G3 — 대량 mutation 에서 sparse 가 역전되는 지점 (R4).
 *
 * sparse patch 는 dirty root 서브트리를 다시 기록한다. 그래서 한 번에 바뀌는
 * 요소가 많아지면 "여러 subtree 를 각각 다시 기록" 하는 비용이 "문서 전체를 한
 * 번 다시 기록" 하는 비용을 넘어설 수 있다. 임계를 상수로 찍기 전에 **실제로
 * 역전이 일어나는지**를 먼저 본다.
 *
 * 같은 문서에서 batch 크기를 키워가며 sparse 경로와 full rebuild 경로를 번갈아
 * 재고, 두 곡선이 교차하는지 확인한다. full rebuild 는 emitter 가 거부하도록
 * 미등재 style 키를 섞어 유도한다 (fail-closed 경로 = 오늘의 동작).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.ADR190_BASE_URL ?? "http://localhost:5173";
const OUT = process.env.ADR190_OUT ?? "/private/tmp/adr190-phase3-g3.json";
const DOC_SIZE = Number(process.env.ADR190_DOC ?? "2000");
const BATCH_SIZES = (process.env.ADR190_BATCHES ?? "1,5,25,100,400,1000")
  .split(",")
  .map(Number);
const REPEATS = Number(process.env.ADR190_REPEATS ?? "5");

const browser = await chromium.launch({
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-gpu"],
});
const context = await browser.newContext({
  storageState: JSON.parse(
    readFileSync(resolve("apps/builder/scripts/.auth-session.json"), "utf8"),
  ),
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});

const settle = (n = 6) =>
  page.evaluate(
    (frames) =>
      new Promise((done) => {
        let remaining = frames;
        const step = () => {
          remaining -= 1;
          if (remaining <= 0) done();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    n,
  );

await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
await page.getByLabel("New project name").fill(`adr190-bulk-${Date.now()}`);
await page.locator('form.new-project-form button[type="submit"]').click();
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 30000 });
await page.goto(`${page.url()}?adr187Metrics=1&adr189Metrics=1`, {
  waitUntil: "networkidle",
});
await page.waitForFunction(
  () =>
    Boolean(
      window.__composition_STORE__ && window.__composition_COMMIT_LANE_DEBUG__,
    ),
  undefined,
  { timeout: 30000 },
);
await page.waitForTimeout(2500);

await page.evaluate(async (docSize) => {
  const store = window.__composition_STORE__;
  const st = store.getState();
  const body = st.elements.find(
    (e) => e.page_id === st.currentPageId && e.type === "body",
  );
  const mk = (i, id) => ({
    id,
    type: "frame",
    parent_id: body.id,
    page_id: st.currentPageId,
    order_num: 100 + i,
    props: {
      style: {
        backgroundColor: "#4A6CF7",
        height: "8px",
        left: `${(i % 60) * 11}px`,
        position: "absolute",
        top: `${Math.floor(i / 60) * 11 + 60}px`,
        width: "8px",
      },
    },
  });
  await st.addComplexElement(
    mk(0, "adr190-bulk-0"),
    Array.from({ length: docSize - 1 }, (_, i) => mk(i + 1, `adr190-bulk-${i + 1}`)),
  );
}, DOC_SIZE);
await page.waitForTimeout(3500);
await page.evaluate(() =>
  window.__composition_STORE__.getState().setSelectedElement(null),
);
await settle(8);

const runBatch = (size, run, mode) =>
  page.evaluate(
    async ({ n, r, m }) => {
      const store = window.__composition_STORE__;
      window.__composition_COMMIT_LANE_DEBUG__.reset();
      window.__composition_STORE_COMMIT_SINK_DEBUG__?.reset();
      window.__composition_PERF__.reset();

      const st = store.getState();
      const updates = Array.from({ length: n }, (_, i) => {
        const target = st.elementsMap.get(`adr190-bulk-${i}`);
        const base = { ...(target?.props?.style ?? {}) };
        // sparse: registry 등재 키만 / full: 미등재 키를 섞어 emitter 거부 유도
        const style =
          m === "full"
            ? { ...base, adr190BulkUnknownKey: `${r}` }
            : { ...base, left: `${((i + r) % 60) * 11 + (r % 2)}px` };
        return { elementId: `adr190-bulk-${i}`, props: { style } };
      });

      await st.batchUpdateElementProps(updates);
      await new Promise((res) => {
        let k = 6;
        const step = () => (--k <= 0 ? res() : requestAnimationFrame(step));
        requestAnimationFrame(step);
      });

      const debug = window.__composition_COMMIT_LANE_DEBUG__.snapshot();
      return {
        batchSize: n,
        mode: m,
        run: r,
        queueCount: debug.queueCount,
        patchSuccessCount: debug.patchSuccessCount,
        patchFallbackCount: debug.patchFallbackCount,
        fullBuildCount: debug.buildMetrics.filter((b) => !b.subtree).length,
        subtreeBuildCount: debug.buildMetrics.filter((b) => b.subtree).length,
        sink: window.__composition_STORE_COMMIT_SINK_DEBUG__?.read() ?? null,
        frameP95: window.__composition_PERF__.snapshot("render.frame")?.p95 ?? 0,
        recordP95:
          window.__composition_PERF__.snapshot("render.skia.record.content")
            ?.p95 ?? 0,
      };
    },
    { n: size, r: run, m: mode },
  );

// 미등재 키가 style 에 남으면 이후 sparse 실행까지 오염된다 (Phase 1 실측).
const cleanup = (size) =>
  page.evaluate(async (n) => {
    const store = window.__composition_STORE__;
    const st = store.getState();
    const updates = [];
    for (let i = 0; i < n; i += 1) {
      const target = st.elementsMap.get(`adr190-bulk-${i}`);
      if (!target) continue;
      const { adr190BulkUnknownKey, ...clean } = target.props?.style ?? {};
      void adr190BulkUnknownKey;
      updates.push({ elementId: `adr190-bulk-${i}`, props: { style: clean } });
    }
    if (updates.length > 0) await st.batchUpdateElementProps(updates);
    await new Promise((res) => {
      let k = 5;
      const step = () => (--k <= 0 ? res() : requestAnimationFrame(step));
      requestAnimationFrame(step);
    });
  }, size);

const rows = [];
for (const size of BATCH_SIZES) {
  for (let r = 0; r < REPEATS; r += 1) {
    rows.push(await runBatch(size, r, "sparse"));
    await settle(4);
  }
  for (let r = 0; r < REPEATS; r += 1) {
    rows.push(await runBatch(size, r, "full"));
    await settle(4);
  }
  await cleanup(size);
  await settle(6);
}

const p95 = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted.length === 0
    ? 0
    : sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
};

const summary = BATCH_SIZES.map((size) => {
  const sparse = rows.filter((x) => x.batchSize === size && x.mode === "sparse");
  const full = rows.filter((x) => x.batchSize === size && x.mode === "full");
  const sparseFrame = p95(sparse.map((x) => x.frameP95));
  const fullFrame = p95(full.map((x) => x.frameP95));
  return {
    batchSize: size,
    sparseFrameP95: Number(sparseFrame.toFixed(2)),
    fullFrameP95: Number(fullFrame.toFixed(2)),
    sparseWins: sparseFrame <= fullFrame,
    speedup: fullFrame > 0 ? Number((fullFrame / sparseFrame).toFixed(2)) : null,
    sparseQueueTotal: sparse.reduce((s, x) => s + x.queueCount, 0),
    sparsePatchSuccess: sparse.reduce((s, x) => s + x.patchSuccessCount, 0),
    sparseFallback: sparse.reduce((s, x) => s + x.patchFallbackCount, 0),
    sparseFullBuild: sparse.reduce((s, x) => s + x.fullBuildCount, 0),
    fullQueueTotal: full.reduce((s, x) => s + x.queueCount, 0),
    fullFullBuild: full.reduce((s, x) => s + x.fullBuildCount, 0),
  };
});

const out = {
  capturedAt: new Date().toISOString(),
  browser: await browser.version(),
  docSize: DOC_SIZE,
  repeats: REPEATS,
  summary,
  rows,
  errors,
};
writeFileSync(OUT, `${JSON.stringify(out, null, 2)}\n`);
console.log(JSON.stringify({ summary, errors: errors.length }, null, 2));
await browser.close();

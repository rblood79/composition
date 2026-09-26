#!/usr/bin/env node
// adr235-p5-live.mjs — ADR-235 Phase 5 live (웹 보호, 실제 builder · Playwright Chrome).
//   P1 첫 저장 뒤 persist() 요청 결과 · 사용량이 헤더 저장소 버튼 라벨에 나온다
//   P2 Storage Buckets 지원 → collection_runtime 캐시가 `composition-cache` bucket (persisted:false) 으로
//   P3 원본 DB 의 옛 collection_runtime 은 비워진다
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createInstrumentedContext, createIsolatedProject } from "./perf-baseline.mjs";

const out = "/private/tmp/adr235-p5-live";
mkdirSync(out, { recursive: true });
const storageState = JSON.parse(readFileSync(resolve("apps/builder/scripts/.auth-session.json"), "utf8"));
const browser = await chromium.launch({ channel: "chrome", headless: !process.argv.includes("--headed") });
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(`${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 300)}\n`);
};
try {
  const { page, context } = await createInstrumentedContext(browser, { storageState, frameCapture: false, initScript: () => performance.setResourceTimingBufferSize(20000) });
  await createIsolatedProject(page, "http://localhost:5173");
  // 저장 한 번 (요소 추가)
  await page.evaluate(async () => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find((e) => e.page_id === st.currentPageId && e.type === "body");
    const now = new Date().toISOString();
    await st.addComplexElement({ id: "p5-frame", customId: "p5-frame", type: "frame", parent_id: body.id, page_id: st.currentPageId, created_at: now, updated_at: now, props: { style: { width: "10px", height: "10px" } } }, []);
    await new Promise((r) => setTimeout(r, 2500));
  });
  const p1 = await page.evaluate(async () => {
    const button = document.querySelector(".storage-status");
    return {
      persisted: await navigator.storage.persisted(),
      label: button?.getAttribute("aria-label") ?? null,
      atRisk: button?.classList.contains("storage-status--at-risk") ?? null,
    };
  });
  record("P1 첫 저장 뒤 persist 요청 · 헤더에 상태 · 사용량", p1.label !== null && /(보호됨|protected|지울 수|may delete)/.test(p1.label) && /(\/|of)/.test(p1.label) && p1.atRisk === !p1.persisted, p1);

  const p2 = await page.evaluate(async () => {
    const url = performance.getEntriesByType("resource").map((e) => e.name).find((n) => n.includes("/lib/db/index.ts"));
    const { getDB } = await import(url ?? "/src/lib/db/index.ts");
    const db = await getDB();
    const race = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
    await race(db.collection_runtime.put({ collectionId: "p5-c", project_id: "p5", runtimeData: [{ a: 1 }], sourceRev: "x", fieldKeys: {} }), 10000);
    const buckets = navigator.storageBuckets ? await navigator.storageBuckets.keys() : null;
    const bucket = navigator.storageBuckets ? await navigator.storageBuckets.open("composition-cache") : null;
    const persistedBucket = bucket ? await bucket.persisted() : null;
    const inBucket = bucket
      ? await new Promise((r) => {
          const q = bucket.indexedDB.open("composition-cache");
          q.onsuccess = () => {
            try {
              const g = q.result.transaction("collection_runtime").objectStore("collection_runtime").get("p5-c");
              g.onsuccess = () => { r(Boolean(g.result)); q.result.close(); };
            } catch (e) {
              r(`error: ${e.name}`);
              q.result.close();
            }
          };
          q.onerror = () => r(false);
        })
      : null;
    const inMain = await new Promise((r) => {
      const q = indexedDB.open("composition");
      q.onsuccess = () => {
        const g = q.result.transaction("collection_runtime").objectStore("collection_runtime").count();
        g.onsuccess = () => { r(g.result); q.result.close(); };
      };
    });
    return { bucketsSupported: Boolean(navigator.storageBuckets), buckets, persistedBucket, inBucket, mainRows: inMain };
  });
  record("P2 캐시가 composition-cache bucket (persisted:false) 으로 · P3 원본 DB 캐시 0", p2.bucketsSupported ? p2.inBucket === true && p2.persistedBucket === false && p2.mainRows === 0 : p2.mainRows === 1, p2);
  await context.close();
} finally {
  await browser.close();
}
writeFileSync(resolve(out, `p5-${Date.now()}.json`), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.pass);
process.stdout.write(`\n${results.length - failed.length}/${results.length} PASS\n`);
process.exit(failed.length ? 1 : 0);

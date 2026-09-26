#!/usr/bin/env node
// adr235-g3-live.mjs — ADR-235 G3 live (자산 GC, 실제 builder 부팅 · Playwright Chrome).
//
//   H1  이미지 업로드 → 요소 삭제 → GC 2회 (유예 0) → history entry root 로 자산 유지
//   H2  undo → 요소와 이미지 복원 (Canvas 그림)
//   H3  history 비움 + 요소 삭제 → GC 2회 → 자산 삭제 (bytes 0 · tombstone)
//   H4  지워진 자산 참조 붙여넣기 · URL 입력 → 공개 거부 (준비 실패)
//
//   node apps/builder/scripts/adr235-g3-live.mjs [--base-url URL] [--headed]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createInstrumentedContext, createIsolatedProject } from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const baseUrl = args.includes("--base-url") ? args[args.indexOf("--base-url") + 1] : process.env.BUILDER_URL ?? "http://localhost:5173";
const out = "/private/tmp/adr235-g3-live";
const headed = args.includes("--headed");
const storageState = JSON.parse(readFileSync(resolve("apps/builder/scripts/.auth-session.json"), "utf8"));

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(`${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 400)}\n`);
};

async function magentaCount(page) {
  const png = await page.screenshot();
  return page.evaluate(async (b64) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bin], { type: "image/png" }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 235 && data[i + 1] < 25 && data[i + 2] > 235) count += 1;
    }
    return count;
  }, png.toString("base64"));
}

async function main() {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: !headed });
  try {
    const { page, context } = await createInstrumentedContext(browser, {
      storageState,
      frameCapture: false,
      initScript: () => performance.setResourceTimingBufferSize(20000),
    });
    await createIsolatedProject(page, baseUrl);
    await page.evaluate(async () => {
      window.__composition_APPLY_VIEWPORT__?.({ scale: 1, x: 80, y: 80 });
      await new Promise((r) => setTimeout(r, 300));
    });

    // 업로드 (writer 경로) + frame 에 적용
    const ref = await page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 100;
      c.height = 50;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#ff00ff";
      ctx.fillRect(0, 0, 100, 50);
      ctx.fillStyle = "#ff00fe"; // 다른 하니스와 다른 바이트
      ctx.fillRect(0, 0, 1, 1);
      const blob = await new Promise((r) => c.toBlob(r, "image/png"));
      const url = performance.getEntriesByType("resource").map((e) => e.name).find((n) => n.includes("/lib/assets/assetWriter.ts"));
      const writer = await import(url ?? "/src/lib/assets/assetWriter.ts");
      const stored = await writer.storeUploadedFile(new File([blob], "g3.png", { type: "image/png" }));
      const store = window.__composition_STORE__;
      const state = store.getState();
      const body = state.elements.find((e) => e.page_id === state.currentPageId && e.type === "body");
      const now = new Date().toISOString();
      await state.addComplexElement(
        { id: "g3-frame", customId: "g3-frame", type: "frame", parent_id: body.id, page_id: state.currentPageId, created_at: now, updated_at: now, props: { style: { position: "absolute", left: "40px", top: "40px", width: "200px", height: "200px" } } },
        [],
      );
      await new Promise((r) => setTimeout(r, 300));
      store.getState().setSelectedElement("g3-frame");
      await new Promise((r) => setTimeout(r, 100));
      store.getState().updateSelectedFills([{ id: "g3-fill", type: "image", enabled: true, opacity: 1, blendMode: "normal", url: stored.ref, mode: "fit" }]);
      store.getState().setSelectedElement(null);
      await new Promise((r) => setTimeout(r, 1500));
      return stored.ref;
    });
    const drawn = await magentaCount(page);

    // H1 — 요소 삭제 → GC 2회 → history root 로 유지
    const h1 = await page.evaluate(async (ref) => {
      await window.__composition_STORE__.getState().removeElement("g3-frame");
      await new Promise((r) => setTimeout(r, 2000)); // 문서 · history entry 영속
      const first = await window.__composition_ASSET_GC__({ graceMs: 0 });
      const second = await window.__composition_ASSET_GC__({ graceMs: 0 });
      const hash = ref.slice("asset:sha256-".length);
      const db = await new Promise((r) => { const q = indexedDB.open("composition"); q.onsuccess = () => r(q.result); });
      const exists = await new Promise((r) => { const q = db.transaction("assets").objectStore("assets").getKey(hash); q.onsuccess = () => r(q.result !== undefined); });
      db.close();
      return { first: { referenced: first.referenced, deleted: first.deleted.length, released: first.released }, second: { referenced: second.referenced, deleted: second.deleted.length }, exists };
    }, ref);
    record("H1 요소 삭제 뒤 GC 2회 — history entry root 로 자산 유지", drawn > 0 && h1.exists && h1.second.deleted === 0, { drawn, ...h1 });

    // H2 — undo 로 복원
    await page.evaluate(async () => {
      await window.__composition_STORE__.getState().undo();
      await new Promise((r) => setTimeout(r, 2000));
    });
    const restored = await magentaCount(page);
    const hasElement = await page.evaluate(() => window.__composition_STORE__.getState().elementsMap.has("g3-frame"));
    record("H2 undo → 요소 · 이미지 복원 (Canvas 그림)", hasElement && restored > 0, { hasElement, restored });

    // H3 — history 비움 + 요소 삭제 → GC 2회 → 삭제
    const h3 = await page.evaluate(async (ref) => {
      const st = window.__composition_STORE__.getState();
      await st.removeElement("g3-frame");
      await new Promise((r) => setTimeout(r, 1500));
      const url = performance.getEntriesByType("resource").map((e) => e.name).find((n) => /\/stores\/history\.ts/.test(n));
      const { historyManager } = await import(url ?? "/src/builder/stores/history.ts");
      historyManager.clearPageHistory(st.currentPageId);
      await new Promise((r) => setTimeout(r, 1500));
      const first = await window.__composition_ASSET_GC__({ graceMs: 0 });
      const second = await window.__composition_ASSET_GC__({ graceMs: 0 });
      const hash = ref.slice("asset:sha256-".length);
      const db = await new Promise((r) => { const q = indexedDB.open("composition"); q.onsuccess = () => r(q.result); });
      const exists = await new Promise((r) => { const q = db.transaction("assets").objectStore("assets").getKey(hash); q.onsuccess = () => r(q.result !== undefined); });
      const meta = await new Promise((r) => { const q = db.transaction("asset_gc").objectStore("asset_gc").get(hash); q.onsuccess = () => r(q.result); });
      db.close();
      return { firstCandidates: first.candidates, deleted: second.deleted.includes(hash), exists, tombstone: Boolean(meta?.deletedAt) };
    }, ref);
    record("H3 history 비움 · 요소 삭제 → GC 2회 → 자산 삭제 · tombstone", h3.deleted && !h3.exists && h3.tombstone, h3);

    // H4 — 지워진 자산 참조 공개 거부
    const h4 = await page.evaluate(async (ref) => {
      const url = performance.getEntriesByType("resource").map((e) => e.name).find((n) => n.includes("/lib/assets/assetStore.ts"));
      const { prepareAssetReferences } = await import(url ?? "/src/lib/assets/assetStore.ts");
      try {
        await prepareAssetReferences([ref]);
        return { rejected: false };
      } catch (error) {
        return { rejected: true, name: error?.name };
      }
    }, ref);
    record("H4 지워진 자산 참조 준비 거부 (붙여넣기 · URL 입력 경로)", h4.rejected && h4.name === "AssetMissingError", h4);
    await context.close();
  } finally {
    await browser.close();
  }
  const file = resolve(out, `g3-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify({ baseUrl, results }, null, 2));
  const failed = results.filter((r) => !r.pass);
  process.stdout.write(`\n${results.length - failed.length}/${results.length} PASS · ${file}\n`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

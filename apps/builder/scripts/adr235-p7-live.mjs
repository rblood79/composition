#!/usr/bin/env node
// adr235-p7-live.mjs — ADR-235 Phase 7 종단 live exercise (실제 builder · Playwright Chrome + WebKit).
//
//   E1 [Chrome] Styles 패널로 이미지 업로드 (페이지 B frame) + Image 요소 · 사용자 폰트 → 새로고침 → 그대로 (자산 저장소)
//   E2 [Chrome] 이미지 frame 삭제 → GC 2회 (유예 0) → 자산 유지 (history) → undo → 다시 그림
//   E3 [Chrome] 내보내기 (v2 zip) → 빈 프로필 새 프로젝트로 가져오기 → 현재 페이지 B · 이미지 · 폰트
//   E4 [Chrome] 가져온 프로젝트에서 Preview 버튼 (publish) → 페이지 B · Image 로드 · 폰트
//   E5 [Chrome 두 탭] 탭 1 이 저장만 한 (미참조 · pin) 자산 → 탭 2 GC 2회에도 유지 → 탭 1 닫힘 → 탭 2 GC 로 정리
//   E6 [WebKit — Safari 엔진] 같은 zip 가져오기 → Canvas 이미지 · 캐시는 원본 DB (Storage Buckets 미지원) → 내보내기 zip 의 자산 해시 동일
//
//   node apps/builder/scripts/adr235-p7-live.mjs [--headed]
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, webkit } from "playwright";
import { createInstrumentedContext, createIsolatedProject, openPanels, waitReady } from "./perf-baseline.mjs";

const require = createRequire(resolve("packages/shared/package.json"));
const JSZip = require("jszip");
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const out = "/private/tmp/adr235-p7-live";
mkdirSync(out, { recursive: true });
const headed = process.argv.includes("--headed");
const storageState = JSON.parse(readFileSync(resolve("apps/builder/scripts/.auth-session.json"), "utf8"));
const FONT_B64 = readFileSync(resolve("apps/builder/public/fonts/InterVariable.woff2")).toString("base64");
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(`${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 320)}\n`);
};
const INIT = () => performance.setResourceTimingBufferSize(20000);

async function magenta(page) {
  const png = await page.screenshot();
  return page.evaluate(async (b64) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bin], { type: "image/png" }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    let count = 0;
    for (let i = 0; i < data.length; i += 4) if (data[i] > 235 && data[i + 1] < 25 && data[i + 2] > 235) count += 1;
    return count;
  }, png.toString("base64"));
}
const zoomOut = (page) =>
  page.evaluate(async () => {
    window.__composition_APPLY_VIEWPORT__?.({ scale: 0.3, x: 60, y: 80 });
    await new Promise((r) => setTimeout(r, 1200));
  });
const mod = (needle) => `performance.getEntriesByType("resource").map((e) => e.name).find((n) => n.includes(${JSON.stringify(needle)}))`;

async function main() {
  const png = resolve(out, "magenta.png");
  // --------------------------- Chrome A ---------------------------
  const chrome = await chromium.launch({ channel: "chrome", headless: !headed });
  let zipPath = process.env.P7_ZIP;
  if (zipPath) await chrome.close();
  else try {
    const a = await createInstrumentedContext(chrome, { storageState, frameCapture: false, initScript: INIT });
    const page = a.page;
    await createIsolatedProject(page, BASE);
    // 마젠타 PNG 파일 + 페이지 B + frame
    const pngB64 = await page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 100;
      c.height = 50;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#ff00ff";
      ctx.fillRect(0, 0, 100, 50);
      const blob = await new Promise((r) => c.toBlob(r, "image/png"));
      let s = "";
      for (const b of new Uint8Array(await blob.arrayBuffer())) s += String.fromCharCode(b);
      return btoa(s);
    });
    writeFileSync(png, Buffer.from(pngB64, "base64"));
    await page.evaluate(async () => {
      const store = window.__composition_STORE__;
      const st = store.getState();
      const now = new Date().toISOString();
      st.appendPageShell(
        { id: "p7-page-b", project_id: st.pages[0].project_id, title: "Page B", slug: "/page-b", parent_id: null, created_at: now, updated_at: now },
        { id: "p7-page-b-body", type: "body", props: { style: {} }, parent_id: null, page_id: "p7-page-b", created_at: now, updated_at: now },
        { x: 1200, y: 0 },
        { activate: true },
      );
      await new Promise((r) => setTimeout(r, 800));
      await store.getState().addComplexElement(
        { id: "p7-frame", customId: "p7-frame", type: "frame", parent_id: "p7-page-b-body", page_id: "p7-page-b", created_at: now, updated_at: now,
          props: { style: { position: "absolute", left: "40px", top: "40px", width: "200px", height: "200px" } }, fills: [] },
        [],
      );
      await new Promise((r) => setTimeout(r, 300));
      store.getState().setSelectedElement("p7-frame");
      store.getState().updateSelectedFills([{ id: "p7-fill", type: "image", enabled: true, opacity: 1, blendMode: "normal", url: "", mode: "fit" }]);
    });
    await openPanels(page, ["styles"]);
    await page.locator('.styles-panel-groups [role="tab"]').nth(1).click();
    await page.waitForTimeout(400);
    await page.locator(".fill-layer-row__trigger").first().click();
    await page.locator('input[type="file"][accept="image/*"]').first().setInputFiles(png);
    await page.waitForTimeout(1500);
    await page.keyboard.press("Escape");
    // Image 요소 (같은 자산 참조) · 사용자 폰트 · 텍스트
    const refs = await page.evaluate(async ({ fontB64, fontsExpr }) => {
      const store = window.__composition_STORE__;
      const canonical = window.__canonical_STORE__.getState();
      const find = (nodes, id) => {
        for (const n of nodes ?? []) {
          if (n.id === id) return n;
          const hit = find(n.children, id);
          if (hit) return hit;
        }
        return null;
      };
      const image = find(canonical.getDocument(canonical.currentProjectId).children, "p7-frame")?.fills?.[0]?.url;
      const fonts = await import(eval(fontsExpr));
      const bytes = Uint8Array.from(atob(fontB64), (c) => c.charCodeAt(0));
      const face = await fonts.createFontFaceFromFile(new File([bytes], "Inter.woff2", { type: "font/woff2" }), "P7Inter");
      fonts.saveRegistryAndNotify(fonts.addFontFace(fonts.loadFontRegistry(), face));
      const now = new Date().toISOString();
      const st = store.getState();
      await st.addComplexElement({ id: "p7-image", customId: "p7-image", type: "Image", parent_id: "p7-page-b-body", page_id: "p7-page-b", created_at: now, updated_at: now,
        props: { src: image, alt: "m", objectFit: "cover", style: { position: "absolute", left: "300px", top: "40px", width: "200px", height: "100px" } } }, []);
      await st.addComplexElement({ id: "p7-text", customId: "p7-text", type: "Text", parent_id: "p7-page-b-body", page_id: "p7-page-b", created_at: now, updated_at: now,
        props: { children: "Asset font", style: { position: "absolute", left: "40px", top: "280px", fontFamily: "P7Inter", fontSize: "32px" } } }, []);
      store.getState().setSelectedElement(null);
      await new Promise((r) => setTimeout(r, 2500));
      return { image, font: face.source.url };
    }, { fontB64: FONT_B64, fontsExpr: mod("/builder/fonts/customFonts.ts") });

    await page.reload({ waitUntil: "networkidle" });
    await waitReady(page);
    await zoomOut(page);
    await page.waitForTimeout(2000);
    const e1 = await page.evaluate(async () => {
      await document.fonts.load('32px "P7Inter"').catch(() => {});
      return { font: document.fonts.check('32px "P7Inter"'), page: window.__composition_STORE__.getState().currentPageId };
    });
    const e1Pixels = await magenta(page);
    record("E1 UI 업로드 · Image · 폰트 → 새로고침 뒤 그대로", refs.image?.startsWith("asset:sha256-") && refs.font?.startsWith("asset:sha256-") && e1.font && e1Pixels > 0, { refs: [refs.image?.slice(0, 22), refs.font?.slice(0, 22)], ...e1, e1Pixels });

    const e2 = await page.evaluate(async () => {
      const st = window.__composition_STORE__.getState();
      await st.removeElement("p7-frame");
      await new Promise((r) => setTimeout(r, 2000));
      await window.__composition_ASSET_GC__({ graceMs: 0 });
      const second = await window.__composition_ASSET_GC__({ graceMs: 0 });
      await window.__composition_STORE__.getState().undo();
      await new Promise((r) => setTimeout(r, 2000));
      return { deleted: second.deleted.length, restored: window.__composition_STORE__.getState().elementsMap.has("p7-frame") };
    });
    const e2Pixels = await magenta(page);
    record("E2 삭제 → GC 2회 → 유지 → undo → 다시 그림", e2.deleted === 0 && e2.restored && e2Pixels >= e1Pixels * 0.9, { ...e2, e2Pixels, e1Pixels });

    await page.evaluate(() => window.__composition_STORE__.getState().activatePage("p7-page-b"));
    await page.waitForTimeout(1500);
    await page.locator(".header-menu-button").click();
    const [dl] = await Promise.all([page.waitForEvent("download"), page.locator('.header-menu-item[data-key="export"]').click()]);
    zipPath = resolve(out, "p7.composition.zip");
    await dl.saveAs(zipPath);
    await a.context.close();

    // --------------------------- Chrome B (빈 프로필) ---------------------------
    const b = await createInstrumentedContext(chrome, { storageState, frameCapture: false, initScript: INIT });
    await createIsolatedProject(b.page, BASE);
    await b.page.locator('input[type="file"][accept^="application/json"]').setInputFiles(zipPath);
    await b.page.waitForTimeout(5000);
    await zoomOut(b.page);
    const e3 = await b.page.evaluate(async () => {
      await document.fonts.load('32px "P7Inter"').catch(() => {});
      return { page: window.__composition_STORE__.getState().currentPageId, font: document.fonts.check('32px "P7Inter"') };
    });
    const e3Pixels = await magenta(b.page);
    record("E3 v2 zip → 빈 프로필 새 프로젝트 가져오기 — 현재 페이지 B · 이미지 · 폰트", e3.page === "p7-page-b" && e3.font && e3Pixels > 0, { ...e3, e3Pixels });

    const [pub] = await Promise.all([b.context.waitForEvent("page"), b.page.getByRole("button", { name: /^(Preview|미리보기)$/ }).first().click()]);
    await pub.waitForSelector('[data-element-id="p7-image"]', { timeout: 30_000 }).catch(() => {});
    await pub.waitForTimeout(2500);
    const e4 = await pub.evaluate(async () => {
      await document.fonts.load('32px "P7Inter"').catch(() => {});
      const img = document.querySelector('[data-element-id="p7-image"]');
      return { natural: img?.naturalWidth ?? 0, src: img?.getAttribute("src")?.slice(0, 5), font: document.fonts.check('32px "P7Inter"'), leaked: document.documentElement.outerHTML.includes("asset:sha256-") };
    });
    record("E4 publish (Preview 버튼) — 페이지 B Image 로드 · 폰트 · 참조 누수 0", e4.natural === 100 && e4.font && !e4.leaked, e4);
    await b.context.close();

    // --------------------------- Chrome 두 탭 — pin ---------------------------
    const c = await createInstrumentedContext(chrome, { storageState, frameCapture: false, initScript: INIT });
    await createIsolatedProject(c.page, BASE);
    const url = c.page.url();
    const tab2 = await c.context.newPage();
    await tab2.goto(url, { waitUntil: "networkidle" });
    await waitReady(tab2);
    const hash = await c.page.evaluate(async (writerExpr) => {
      const w = await import(eval(writerExpr) ?? "/src/lib/assets/assetWriter.ts");
      const stored = await w.storeUploadedFile(new File([new Uint8Array([9, 8, 7, 6, 5])], "orphan.bin", { type: "image/png" }));
      return stored.hash;
    }, mod("/lib/assets/assetWriter.ts"));
    const exists = (p, h) =>
      p.evaluate(async (h) => {
        const db = await new Promise((r) => { const q = indexedDB.open("composition"); q.onsuccess = () => r(q.result); });
        const has = await new Promise((r) => { const q = db.transaction("assets").objectStore("assets").getKey(h); q.onsuccess = () => r(q.result !== undefined); });
        db.close();
        return has;
      }, h);
    await tab2.evaluate(async () => {
      await window.__composition_ASSET_GC__({ graceMs: 0 });
      await window.__composition_ASSET_GC__({ graceMs: 0 });
    });
    const keptWhileLive = await exists(tab2, hash);
    await c.page.close();
    await tab2.waitForTimeout(500);
    await tab2.evaluate(async () => {
      await window.__composition_ASSET_GC__({ graceMs: 0 }); // 끝난 세션 pin 해제 + 후보
      await window.__composition_ASSET_GC__({ graceMs: 0 }); // 삭제
    });
    const goneAfterClose = !(await exists(tab2, hash));
    record("E5 두 탭 — 살아 있는 탭의 pin 은 다른 탭 GC 가 존중 · 탭이 닫히면 정리", keptWhileLive && goneAfterClose, { keptWhileLive, goneAfterClose });
    await c.context.close();
  } finally {
    await chrome.close();
  }

  // --------------------------- Firefox ---------------------------
  // Safari 엔진 (WebKit) — 이 환경의 Playwright Firefox 는 실행 단계에서 멈춘다 (macOS sandbox)
  const ff = await webkit.launch({ headless: !headed });
  try {
    const ctx = await ff.newContext({ storageState, viewport: { width: 1440, height: 900 } });
    await ctx.addInitScript(INIT);
    const page = await ctx.newPage();
    await createIsolatedProject(page, BASE);
    await page.locator('input[type="file"][accept^="application/json"]').setInputFiles(zipPath);
    await page.waitForTimeout(6000);
    await zoomOut(page);
    const e6 = await page.evaluate(async () => ({
      page: window.__composition_STORE__.getState().currentPageId,
      buckets: "storageBuckets" in navigator,
      ua: navigator.userAgent.match(/(Version\/[\d.]+ )?Safari\/[\d.]+/)?.[0],
    }));
    const e6Pixels = await magenta(page);
    await page.locator(".header-menu-button").click();
    const [dl] = await Promise.all([page.waitForEvent("download"), page.locator('.header-menu-item[data-key="export"]').click()]);
    const ffZip = resolve(out, "p7-webkit.composition.zip");
    await dl.saveAs(ffZip);
    const hashes = async (path) => {
      const z = await JSZip.loadAsync(readFileSync(path));
      return JSON.parse(await z.file("manifest.json").async("string")).assets.map((x) => x.hash).sort();
    };
    const [chromeHashes, ffHashes] = [await hashes(zipPath), await hashes(ffZip)];
    record(
      "E6 WebKit (Safari 엔진) — v2 zip 가져오기 · Canvas 이미지 · 내보내기 자산 해시 동일 (Storage Buckets 미지원 경로)",
      e6.page === "p7-page-b" && e6Pixels > 0 && JSON.stringify(chromeHashes) === JSON.stringify(ffHashes) && !e6.buckets,
      { ...e6, e6Pixels, assets: ffHashes.length },
    );
    await ctx.close();
  } finally {
    await ff.close();
  }

  writeFileSync(resolve(out, `p7-${Date.now()}.json`), JSON.stringify(results, null, 2));
  const failed = results.filter((r) => !r.pass);
  process.stdout.write(`\n${results.length - failed.length}/${results.length} PASS\n`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

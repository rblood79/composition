#!/usr/bin/env node
// adr235-g2-live.mjs — ADR-235 G2 live (writer 활성 · 이관, 실제 builder 부팅 · Playwright Chrome).
//
//   W1  Styles 패널 이미지 채우기 업로드 (실제 UI 파일 입력) → 문서엔 asset: 참조 · Canvas 가 그린다
//   W2  4MB 폰트 업로드 경로 (createFontFaceFromFile) → 레지스트리 저장 성공 · 참조만 · 폰트 로드
//   M1  인라인 dataURL 문서 → 새로고침 → 이관: 참조 치환 · 이관 전 백업 존재 · Canvas 시각 동일
//   M2  한 번 더 새로고침 → 문서 무변경 (멱등)
//   M3  레지스트리의 base64 폰트 → 새로고침 → 참조 · 원본 백업 참조 · 폰트 로드
//   M4  인라인 자산이 든 v1 JSON 가져오기 → 자산화 · Canvas 가 그린다
//
//   node apps/builder/scripts/adr235-g2-live.mjs [--base-url URL] [--headed] [--import-file PATH]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  openPanels,
  waitReady,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const baseUrl = argValue("--base-url", "http://localhost:5173");
const out = argValue("--out", "/private/tmp/adr235-g2-live");
const importFile = argValue("--import-file", "/private/tmp/adr235-g1-live/export-v1.json");
const headed = args.includes("--headed");
const storageState = JSON.parse(
  readFileSync(resolve("apps/builder/scripts/.auth-session.json"), "utf8"),
);
const SMALL_FONT_B64 = readFileSync(
  resolve("apps/builder/public/fonts/InterVariable.woff2"),
).toString("base64");

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(`${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 400)}\n`);
};

async function magenta(page) {
  const png = await page.screenshot();
  return page.evaluate(async (b64) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bin], { type: "image/png" }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    let count = 0, x0 = width, y0 = height, x1 = -1, y1 = -1;
    for (let y = 0; y < height; y += 1)
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        if (data[i] > 235 && data[i + 1] < 25 && data[i + 2] > 235) {
          count += 1;
          x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
      }
    return count ? { count, bbox: [x0, y0, x1 - x0 + 1, y1 - y0 + 1] } : { count: 0, bbox: null };
  }, png.toString("base64"));
}

async function fitViewport(page) {
  await page.evaluate(async () => {
    window.__composition_APPLY_VIEWPORT__?.({ scale: 1, x: 80, y: 80 });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  await page.waitForTimeout(500);
}

/** 마젠타 100×50 PNG 파일 (Playwright 파일 입력용) */
async function magentaPng(page) {
  const b64 = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 100;
    c.height = 50;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#ff00ff";
    ctx.fillRect(0, 0, 100, 50);
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  });
  const path = resolve(out, "magenta.png");
  writeFileSync(path, Buffer.from(b64, "base64"));
  return { path, dataUrl: `data:image/png;base64,${b64}` };
}

async function seedFrame(page, id, fills) {
  await page.evaluate(
    async ({ id, fills }) => {
      const store = window.__composition_STORE__;
      const state = store.getState();
      const pageId = state.currentPageId;
      const body = state.elements.find((e) => e.page_id === pageId && e.type === "body");
      const now = new Date().toISOString();
      await state.addComplexElement(
        {
          id,
          customId: id,
          type: "frame",
          parent_id: body.id,
          page_id: pageId,
          created_at: now,
          updated_at: now,
          props: { style: { position: "absolute", left: "40px", top: "40px", width: "200px", height: "200px" } },
        },
        [],
      );
      await new Promise((r) => setTimeout(r, 300));
      store.getState().setSelectedElement(id);
      await new Promise((r) => setTimeout(r, 100));
      if (fills) store.getState().updateSelectedFills(fills);
    },
    { id, fills },
  );
}

const readFill = (page, id) =>
  page.evaluate((id) => {
    const canonical = window.__canonical_STORE__.getState();
    const doc = canonical.getDocument(canonical.currentProjectId);
    const find = (nodes) => {
      for (const n of nodes ?? []) {
        if (n.id === id) return n;
        const hit = find(n.children);
        if (hit) return hit;
      }
      return null;
    };
    const node = find(doc.children);
    return {
      url: node?.fills?.[0]?.url?.slice(0, 40) ?? null,
      legacy: node?.metadata?.legacyProps?.fills?.[0]?.url?.slice(0, 40) ?? null,
      docHasData: JSON.stringify(doc).includes("data:image/"),
    };
  }, id);

async function reload(page, settleMs = 4000) {
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await fitViewport(page);
  await page.waitForTimeout(settleMs); // requestIdleCallback 이관 · 영속
}

async function main() {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: !headed });
  try {
    const ctx = await createInstrumentedContext(browser, {
      storageState,
      frameCapture: false,
      initScript: () => performance.setResourceTimingBufferSize(20000),
    });
    ctx.page.on("console", (m) => {
      if (/assets|imageCache/.test(m.text())) process.stderr.write(`[console] ${m.text()}\n`);
    });
    const page = ctx.page;
    await createIsolatedProject(page, baseUrl);
    await fitViewport(page);
    const png = await magentaPng(page);

    // R1 — image fill 로드 완료가 다른 store 변경 없이 노드를 다시 그리게 하는가
    //   (선택 유지 · 후속 변경 0 — 이미지 로드만이 재빌드 계기)
    const r1Ref = await page.evaluate(async (dataUrl) => {
      const bin = Uint8Array.from(atob(dataUrl.split(",")[1]), (c) => c.charCodeAt(0));
      const blue = new Uint8Array(bin); // 바이트가 달라야 새 자산 (캐시 미스)
      const url = performance.getEntriesByType("resource").map((e) => e.name).find((n) => n.includes("/lib/assets/assetWriter.ts"));
      const writer = await import(url ?? "/src/lib/assets/assetWriter.ts");
      const file = new File([blue, new Uint8Array([0])], "r1.png", { type: "image/png" });
      return (await writer.storeUploadedFile(file)).ref;
    }, png.dataUrl);
    await seedFrame(page, "g2-r1", null);
    await page.waitForTimeout(800);
    await page.evaluate((ref) => {
      window.__composition_STORE__.getState().updateSelectedFills([
        { id: "fill-r1", type: "image", enabled: true, opacity: 1, blendMode: "normal", url: ref, mode: "fit" },
      ]);
    }, r1Ref);
    await page.waitForTimeout(3000);
    const r1Pixels = await magenta(page);
    record("R1 image fill 로드 완료만으로 다시 그림 (후속 store 변경 0)", r1Pixels.count > 0, { r1Pixels });
    await page.evaluate(async () => {
      const st = window.__composition_STORE__.getState();
      st.setSelectedElement(null);
      await st.removeElement("g2-r1");
    });
    await page.waitForTimeout(800);

    // W1 — 실제 UI 업로드
    await seedFrame(page, "g2-upload", [
      { id: "fill-up", type: "image", enabled: true, opacity: 1, blendMode: "normal", url: "", mode: "fit" },
    ]);
    await openPanels(page, ["styles"]);
    await page.screenshot({ path: resolve(out, "w1-panel.png") });
    const railLabels = await page.locator(".panel-toggle-rail button[aria-pressed]").evaluateAll((els) => els.map((e) => `${e.getAttribute("aria-label")}=${e.getAttribute("aria-pressed")}`));
    process.stderr.write(`[rail] ${railLabels.join(", ")}\n`);
    // Styles 패널 두 번째 탭 = 채우기 · 테두리 (appearance)
    await page.locator('.styles-panel-groups [role="tab"]').nth(1).click();
    await page.waitForTimeout(400);
    await page.locator(".fill-layer-row__trigger").first().click({ timeout: 8000 });
    const input = page.locator('input[type="file"][accept="image/*"]').first();
    await input.waitFor({ state: "attached", timeout: 10_000 });
    await input.setInputFiles(png.path);
    await page.waitForTimeout(1500);
    await page.keyboard.press("Escape");
    await page.evaluate(() => window.__composition_STORE__.getState().setSelectedElement(null));
    await page.waitForTimeout(1500);
    const upFill = await readFill(page, "g2-upload");
    const upPixels = await magenta(page);
    record("W1 UI 이미지 업로드 → asset: 참조 · Canvas 그림", upFill.url?.startsWith("asset:sha256-") && !upFill.docHasData && upPixels.count > 0, { upFill, upPixels });

    // W2 — 4MB 폰트 업로드 경로
    const bigFont = await page.evaluate(async (smallB64) => {
      const small = Uint8Array.from(atob(smallB64), (c) => c.charCodeAt(0));
      const bytes = new Uint8Array(4 * 1024 * 1024);
      bytes.set(small); // 유효한 woff2 머리 + 채움 (메타 추출 · 레지스트리 크기 검증용)
      const url = performance.getEntriesByType("resource").map((e) => e.name).find((n) => n.includes("/builder/fonts/customFonts.ts"));
      const fonts = await import(url);
      const file = new File([bytes], "Big4MB.woff2", { type: "font/woff2" });
      let error = null;
      try {
        const face = await fonts.createFontFaceFromFile(file, "ADR235Big");
        fonts.saveRegistryAndNotify(fonts.addFontFace(fonts.loadFontRegistry(), face));
      } catch (e) {
        error = String(e);
      }
      const raw = localStorage.getItem("composition.font-registry") ?? "";
      const registry = JSON.parse(raw || "{}");
      return {
        error,
        registryBytes: raw.length,
        url: registry.faces?.find((f) => f.family === "ADR235Big")?.source?.url?.slice(0, 30) ?? null,
      };
    }, SMALL_FONT_B64);
    record("W2 4MB 폰트 저장 성공 · 레지스트리엔 참조만", !bigFont.error && bigFont.url?.startsWith("asset:sha256-") && bigFont.registryBytes < 10_000, bigFont);

    // M1 — 인라인 dataURL 문서 → 새로고침 → 이관
    await seedFrame(page, "g2-legacy", [
      { id: "fill-legacy", type: "image", enabled: true, opacity: 1, blendMode: "normal", url: png.dataUrl, mode: "fit" },
    ]);
    await page.evaluate(() => window.__composition_STORE__.getState().setSelectedElement(null));
    await page.waitForTimeout(2500);
    const before = await readFill(page, "g2-legacy");
    await page.evaluate(() => window.__composition_STORE__.getState().removeElement("g2-upload"));
    await page.waitForTimeout(2500);
    const beforePixels = await magenta(page);
    await reload(page, 0);
    for (let i = 0; i < 20; i += 1) {
      if (!(await readFill(page, "g2-legacy")).docHasData) break;
      await page.waitForTimeout(500);
    }
    const after = await readFill(page, "g2-legacy");
    const backups = await page.evaluate(async () => {
      const projectId = window.__canonical_STORE__.getState().currentProjectId;
      const db = await new Promise((r) => {
        const req = indexedDB.open("composition");
        req.onsuccess = () => r(req.result);
      });
      const rows = await new Promise((r) => {
        const req = db.transaction("documents_backup").objectStore("documents_backup").index("project_id").getAll(projectId);
        req.onsuccess = () => r(req.result);
      });
      db.close();
      return rows.map((row) => JSON.stringify(row.document).includes("data:image/png"));
    });
    // 이관이 문서에 반영될 때까지 기다린 뒤 (idle + 저장) 1.5 초 안에 이미지가 그려져야 한다 —
    //   재시도 없이 한 번 잰다 (이미지 로드 완료가 노드 재빌드를 부르는지 확인).
    for (let i = 0; i < 20; i += 1) {
      if (!(await readFill(page, "g2-legacy")).docHasData) break;
      await page.waitForTimeout(500);
    }
    await page.waitForTimeout(1500);
    const afterPixels = await magenta(page);
    await page.screenshot({ path: resolve(out, "m1-after.png") });
    const debug = await page.evaluate(async () => {
      const st = window.__composition_STORE__.getState();
      const el = st.elementsMap.get("g2-legacy");
      const arr = st.elements.find((e) => e.id === "g2-legacy");
      const names = performance.getEntriesByType("resource").map((e) => e.name);
      const icUrl = names.find((n) => n.includes("/canvas/skia/imageCache.ts"));
      const ic = icUrl ? await import(icUrl) : null;
      const ref = el?.fills?.[0]?.url;
      const cachedBefore = ic ? Boolean(ic.getSkImage(ref)) : null;
      const t0 = performance.now();
      const loaded = ic ? Boolean(await ic.loadSkImage(ref)) : null;
      const arUrl = names.find((n) => n.includes("utils/assetRefAsync.ts"));
      const ar = arUrl ? await import(arUrl) : null;
      const resolved = ar ? await ar.resolveAssetUrlAsync(ref) : "no-module";
      return {
        cachedBefore, loaded, loadMs: Math.round(performance.now() - t0), resolved: String(resolved).slice(0, 30),
        mapFill: el?.fills?.[0]?.url?.slice(0, 30),
        arrFill: arr?.fills?.[0]?.url?.slice(0, 30),
        mapKeys: el ? Object.keys(el) : null,
        imageCacheLoaded: names.filter((n) => /imageCache|assetUrlResolver|assetMigration|assetDb/.test(n)).map((n) => n.split("/").pop()),
        vis: document.visibilityState,
      };
    });
    process.stderr.write(`[M1 debug] ${JSON.stringify(debug)}\n`);
    record(
      "M1 새로고침 이관 — 참조 치환 · 이관 전 백업 · Canvas 시각 동일 · 요소 mirror 동기",
      debug.mapFill?.startsWith("asset:sha256-") &&
        before.url?.startsWith("data:") && after.url?.startsWith("asset:sha256-") && after.legacy?.startsWith("asset:sha256-") && !after.docHasData && backups.includes(true) && afterPixels.count > 0 && JSON.stringify(afterPixels.bbox) === JSON.stringify(beforePixels.bbox),
      { before, after, backups, beforePixels, afterPixels, debug },
    );

    // M2 — 멱등
    const docA = await page.evaluate(() => JSON.stringify(window.__canonical_STORE__.getState().getDocument(window.__canonical_STORE__.getState().currentProjectId)));
    await reload(page);
    const docB = await page.evaluate(() => JSON.stringify(window.__canonical_STORE__.getState().getDocument(window.__canonical_STORE__.getState().currentProjectId)));
    record("M2 두 번째 새로고침 — 문서 무변경 (멱등)", docA === docB, { bytes: docA.length });

    // M3 — 레지스트리 base64 폰트 이관
    await page.evaluate((b64) => {
      localStorage.setItem(
        "composition.font-registry",
        JSON.stringify({
          version: 2,
          faces: [
            { id: "legacy-font", family: "ADR235Legacy", format: "woff2", display: "block", source: { type: "data-url-temp", url: `data:font/woff2;base64,${b64}` }, createdAt: "2026-09-26T00:00:00.000Z", updatedAt: "2026-09-26T00:00:00.000Z" },
          ],
        }),
      );
      localStorage.removeItem("composition.font-registry.backup-ref");
    }, SMALL_FONT_B64);
    await reload(page);
    const fontMigration = await page.evaluate(async () => {
      await document.fonts.load('16px "ADR235Legacy"').catch(() => {});
      const registry = JSON.parse(localStorage.getItem("composition.font-registry"));
      return {
        url: registry.faces[0].source.url.slice(0, 30),
        type: registry.faces[0].source.type,
        backupRef: localStorage.getItem("composition.font-registry.backup-ref")?.slice(0, 30) ?? null,
        loaded: document.fonts.check('16px "ADR235Legacy"'),
      };
    });
    record("M3 레지스트리 base64 폰트 → 참조 · 원본 백업 · 로드", fontMigration.url.startsWith("asset:sha256-") && fontMigration.type === "project-asset" && fontMigration.backupRef?.startsWith("asset:sha256-") && fontMigration.loaded, fontMigration);
    await ctx.context.close();

    // M4 — 인라인 자산 v1 가져오기 (G1 내보내기 파일)
    if (existsSync(importFile)) {
      const b = await createInstrumentedContext(browser, { storageState, frameCapture: false });
      await createIsolatedProject(b.page, baseUrl);
      await fitViewport(b.page);
      await b.page.locator('input[type="file"][accept^="application/json"]').setInputFiles(importFile);
      await b.page.waitForTimeout(5000);
      const imported = await b.page.evaluate(() => {
        const canonical = window.__canonical_STORE__.getState();
        const json = JSON.stringify(canonical.getDocument(canonical.currentProjectId));
        return { hasData: json.includes("data:image/"), refs: (json.match(/asset:sha256-/g) ?? []).length };
      });
      const importedPixels = await magenta(b.page);
      record("M4 v1 가져오기 자산화 · Canvas 그림", !imported.hasData && imported.refs > 0 && importedPixels.count > 0, { imported, importedPixels });
      await b.context.close();
    } else {
      record("M4 v1 가져오기 자산화", false, { skipped: `no ${importFile}` });
    }
  } finally {
    await browser.close();
  }
  const file = resolve(out, `g2-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify({ baseUrl, results }, null, 2));
  const failed = results.filter((r) => !r.pass);
  process.stdout.write(`\n${results.length - failed.length}/${results.length} PASS · ${file}\n`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

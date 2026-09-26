#!/usr/bin/env node
// adr235-g4-live.mjs — ADR-235 G4 · G5 live (형식 v2, 실제 builder 부팅 · Playwright Chrome).
//
// fixture: 페이지 A · B, 현재 페이지 = B. B 에 Image (asset: 마젠타 100×50) · 사용자 폰트 Text.
//
//   V1  내보내기 (메뉴 "내보내기") = v2 zip — manifest · part · assets/<hash>.<ext> · 현재 페이지 B
//   V2  빈 프로필 가져오기 — 문서 동일 · 현재 페이지 B · 자산 · 폰트 · Canvas 이미지
//   V3  publish ← v2 디렉토리 (`?project=…/manifest.json`, 상대 경로) — 페이지 B · <img> 로드 · 폰트 · Canvas 와 bbox 비율 동일
//   V4  publish ← v2 zip (`?project=…zip`) — 같은 결과 (blob:)
//   V5  publish ← v1 JSON (`?project=…json`) — 페이지 B · 이미지 (dataURL)
//   V6  정적 HTML (`exportProject` + assetFiles) — <img src="assets/…"> 로드 · 폰트 상대 경로
//   V7  manifest 의 currentPageId 가 문서에 없는 zip 가져오기 → 첫 페이지 + 경고
//   V8  manifest.json 손상 zip (manifests/ 없음) → 가져오기 실패 알림 (v1 가져오기 fixture 는 unit)
//
//   node apps/builder/scripts/adr235-g4-live.mjs [--base-url URL] [--headed]
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { createInstrumentedContext, createIsolatedProject, waitReady } from "./perf-baseline.mjs";

const require = createRequire(resolve("packages/shared/package.json"));
const JSZip = require("jszip");

const args = process.argv.slice(2);
const baseUrl = args.includes("--base-url") ? args[args.indexOf("--base-url") + 1] : "http://localhost:5173";
const out = "/private/tmp/adr235-g4-live";
const headed = args.includes("--headed");
const storageState = JSON.parse(readFileSync(resolve("apps/builder/scripts/.auth-session.json"), "utf8"));
const FONT_B64 = readFileSync(resolve("apps/builder/public/fonts/InterVariable.woff2")).toString("base64");

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(`${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 360)}\n`);
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
          count += 1; x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
      }
    return count ? { count, w: x1 - x0 + 1, h: y1 - y0 + 1 } : { count: 0, w: 0, h: 0 };
  }, png.toString("base64"));
}

const appModule = (needle) =>
  `performance.getEntriesByType("resource").map((e) => e.name).find((n) => n.includes(${JSON.stringify(needle)}))`;

/** 페이지 B 를 만들고 활성화한 뒤 Image · 사용자 폰트 Text 를 넣는다 */
async function seedFixture(page) {
  return page.evaluate(
    async ({ fontB64, writerExpr }) => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const store = window.__composition_STORE__;
      let state = store.getState();
      const pageA = state.pages[0];
      const now = new Date().toISOString();
      state.appendPageShell(
        { id: "adr235-page-b", project_id: pageA.project_id, title: "Page B", slug: "/page-b", parent_id: null, created_at: now, updated_at: now },
        { id: "adr235-page-b-body", type: "body", props: { style: {} }, parent_id: null, page_id: "adr235-page-b", created_at: now, updated_at: now },
        { x: 1200, y: 0 },
        { activate: true },
      );
      await wait(800);
      state = store.getState();
      // 이미지 (writer)
      const c = document.createElement("canvas");
      c.width = 100;
      c.height = 50;
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#ff00ff";
      ctx.fillRect(0, 0, 100, 50);
      const png = await new Promise((r) => c.toBlob(r, "image/png"));
      const writer = await import(eval(writerExpr) ?? "/src/lib/assets/assetWriter.ts");
      const image = await writer.storeUploadedFile(new File([png], "magenta.png", { type: "image/png" }));
      // 사용자 폰트 (writer)
      const fontBytes = Uint8Array.from(atob(fontB64), (ch) => ch.charCodeAt(0));
      const font = await writer.storeUploadedFile(new File([fontBytes], "Inter.woff2", { type: "font/woff2" }));
      const fontsUrl = performance.getEntriesByType("resource").map((e) => e.name).find((n) => n.includes("/builder/fonts/customFonts.ts"));
      const fonts = await import(fontsUrl);
      fonts.saveRegistryAndNotify(
        fonts.addFontFace(fonts.loadFontRegistry(), {
          id: "adr235-font", family: "ADR235Inter", format: "woff2", display: "block",
          source: { type: "project-asset", url: font.ref, originalFileName: "Inter.woff2" },
          createdAt: now, updatedAt: now,
        }),
      );
      await state.addComplexElement(
        { id: "adr235-image", customId: "adr235-image", type: "Image", parent_id: "adr235-page-b-body", page_id: "adr235-page-b", created_at: now, updated_at: now,
          props: { src: image.ref, alt: "magenta", objectFit: "cover", style: { position: "absolute", left: "40px", top: "40px", width: "200px", height: "100px" } } },
        [],
      );
      await state.addComplexElement(
        { id: "adr235-text", customId: "adr235-text", type: "Text", parent_id: "adr235-page-b-body", page_id: "adr235-page-b", created_at: now, updated_at: now,
          props: { children: "Asset font", style: { position: "absolute", left: "40px", top: "180px", fontFamily: "ADR235Inter", fontSize: "32px" } } },
        [],
      );
      await wait(2500);
      return { image: image.ref, font: font.ref, currentPageId: store.getState().currentPageId };
    },
    { fontB64: FONT_B64, writerExpr: appModule("/lib/assets/assetWriter.ts") },
  );
}

/** 모든 페이지가 보이게 축소 (페이지 위치는 placement 레이아웃이 정한다) — 비율만 비교한다 */
async function fitTo(page) {
  await page.evaluate(async () => {
    window.__composition_APPLY_VIEWPORT__?.({ scale: 0.3, x: 60, y: 80 });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  await page.waitForTimeout(1200);
}

/** 키 순서와 무관한 문서 문자열 (가져오기 정규화가 키 순서를 바꾼다) */
const docJson = (page) =>
  page.evaluate(() => {
    const canonical = window.__canonical_STORE__.getState();
    const sort = (v) =>
      Array.isArray(v)
        ? v.map(sort)
        : v && typeof v === "object"
          ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sort(v[k])]))
          : v;
    return JSON.stringify(sort(canonical.getDocument(canonical.currentProjectId)));
  });

async function main() {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: !headed });
  const served = new Map(); // path → { body, type }
  const serve = async (context) =>
    context.route("**/__adr235__/**", async (route) => {
      const path = new URL(route.request().url()).pathname.replace(/^.*__adr235__\//, "");
      const hit = served.get(path);
      if (!hit) return route.fulfill({ status: 404, body: "" });
      return route.fulfill({ status: 200, body: hit.body, contentType: hit.type });
    });
  try {
    // ---------------- A: fixture · 내보내기 ----------------
    const a = await createInstrumentedContext(browser, { storageState, frameCapture: false, initScript: () => performance.setResourceTimingBufferSize(20000) });
    await serve(a.context);
    const pageA = a.page;
    await createIsolatedProject(pageA, baseUrl);
    const seeded = await seedFixture(pageA);
    await fitTo(pageA);
    const canvasA = await magenta(pageA);
    await pageA.screenshot({ path: resolve(out, "a-canvas.png") });
    const docA = await docJson(pageA);
    writeFileSync(resolve(out, "docA.json"), docA);

    await pageA.locator(".header-menu-button").click();
    const [dl] = await Promise.all([pageA.waitForEvent("download"), pageA.locator('.header-menu-item[data-key="export"]').click()]);
    const zipPath = resolve(out, "fixture.composition.zip");
    await dl.saveAs(zipPath);
    const zipBytes = readFileSync(zipPath);
    const zip = await JSZip.loadAsync(zipBytes);
    const manifest = JSON.parse(await zip.file("manifest.json").async("string"));
    const names = Object.keys(zip.files);
    record(
      "V1 내보내기 = v2 zip (manifest · part · assets · 현재 페이지 B)",
      manifest.formatVersion === "2.0.0" && manifest.editor.currentPageId === "adr235-page-b" && manifest.assets.length === 2 && names.filter((n) => n.startsWith("assets/") && !zip.files[n].dir).length === 2 && canvasA.count > 0,
      { name: dl.suggestedFilename(), seededPage: seeded.currentPageId, current: manifest.editor.currentPageId, assets: manifest.assets.map((x) => `${x.ext}:${x.bytes}`), parts: Object.keys(manifest.parts), canvasA },
    );

    // v1 JSON 도 받는다 (V5)
    await pageA.locator(".header-menu-button").click();
    const [dlv1] = await Promise.all([pageA.waitForEvent("download"), pageA.locator('.header-menu-item[data-key="export-json"]').click()]);
    const v1Path = resolve(out, "fixture-v1.json");
    await dlv1.saveAs(v1Path);

    // V6 — 정적 HTML (exportProject + assetFiles, zip 경로)
    const [dlStatic] = await Promise.all([
      pageA.waitForEvent("download"),
      pageA.evaluate(async (pfExpr) => {
        delete window.showDirectoryPicker; // zip 경로
        const canonical = window.__canonical_STORE__.getState();
        const document = canonical.getDocument(canonical.currentProjectId);
        const fontsUrl = performance.getEntriesByType("resource").map((e) => e.name).find((n) => n.includes("/builder/fonts/customFonts.ts"));
        const fonts = await import(fontsUrl);
        const fontRegistry = fonts.loadFontRegistry();
        const pf = await import(eval(pfExpr) ?? "/src/lib/assets/assetProjectFile.ts");
        const assetFiles = await pf.collectStaticAssetFiles({ document, fontRegistry });
        const utilsUrl = performance.getEntriesByType("resource").map((e) => e.name).find((n) => n.includes("shared/src/utils/export.utils.ts"));
        const exportUtils = await import(utilsUrl);
        await exportUtils.exportProject({ projectId: "p", projectName: "static", document, currentPageId: "adr235-page-b", fontRegistry, assetFiles });
      }, appModule("/lib/assets/assetProjectFile.ts")),
    ]);
    const staticZip = await JSZip.loadAsync(readFileSync(await dlStatic.path()));
    for (const [name, file] of Object.entries(staticZip.files)) {
      if (file.dir) continue;
      const body = await file.async("nodebuffer");
      const type = name.endsWith(".html") ? "text/html" : name.endsWith(".png") ? "image/png" : name.endsWith(".woff2") ? "font/woff2" : "application/octet-stream";
      served.set(`static/${name}`, { body, type });
    }
    // v2 디렉토리 · zip · v1 을 route 로 제공
    for (const [name, file] of Object.entries(zip.files)) {
      if (!file.dir) served.set(`dir/${name}`, { body: await file.async("nodebuffer"), type: name.endsWith(".json") ? "application/json" : "application/octet-stream" });
    }
    served.set("fixture.zip", { body: zipBytes, type: "application/zip" });
    served.set("fixture-v1.json", { body: readFileSync(v1Path), type: "application/json" });

    const staticPage = await a.context.newPage();
    await staticPage.goto(`${baseUrl}/__adr235__/static/index.html`);
    await staticPage.waitForTimeout(2500);
    const staticInfo = await staticPage.evaluate(async () => {
      await document.fonts.load('32px "ADR235Inter"').catch(() => {});
      const img = document.querySelector("img");
      return { src: img?.getAttribute("src") ?? null, natural: img?.naturalWidth ?? 0, font: document.fonts.check('32px "ADR235Inter"'), fontCss: /assets\/[0-9a-f]{64}\.woff2/.test(document.head.innerHTML) };
    });
    record("V6 정적 HTML — <img src=assets/…> 로드 · 폰트 상대 경로", /^assets\/[0-9a-f]{64}\.png$/.test(staticInfo.src ?? "") && staticInfo.natural === 100 && staticInfo.fontCss && staticInfo.font, staticInfo);
    await staticPage.close();

    // V3 · V4 · V5 — publish
    const publishCheck = async (query) => {
      const p = await a.context.newPage();
      await p.goto(`${baseUrl}/publish/?project=${encodeURIComponent(query)}`);
      await p.waitForSelector('[data-element-id="adr235-image"]', { timeout: 30_000 }).catch(() => {});
      await p.waitForTimeout(2500);
      const info = await p.evaluate(async () => {
        await document.fonts.load('32px "ADR235Inter"').catch(() => {});
        const img = document.querySelector('[data-element-id="adr235-image"]');
        return { found: Boolean(img), src: img?.getAttribute("src")?.slice(0, 60) ?? null, natural: img?.naturalWidth ?? 0, font: document.fonts.check('32px "ADR235Inter"'), leaked: document.documentElement.outerHTML.includes("asset:sha256-") };
      });
      const pixels = await magenta(p);
      await p.close();
      return { ...info, pixels };
    };
    const ratio = (m) => (m.h ? m.w / m.h : 0);
    const dir = await publishCheck("/__adr235__/dir/manifest.json");
    record("V3 publish ← v2 디렉토리 (상대 경로) — 페이지 B · 이미지 · 폰트 · Canvas 비율 동일", dir.found && dir.natural === 100 && dir.src?.includes("/__adr235__/dir/assets/") && dir.font && !dir.leaked && Math.abs(ratio(dir.pixels) - ratio(canvasA)) < 0.15, { ...dir, canvasA });
    const zipped = await publishCheck("/__adr235__/fixture.zip");
    record("V4 publish ← v2 zip — 페이지 B · 이미지 (blob:) · 폰트", zipped.found && zipped.natural === 100 && zipped.src?.startsWith("blob:") && zipped.font && !zipped.leaked, zipped);
    const v1 = await publishCheck("/__adr235__/fixture-v1.json");
    record("V5 publish ← v1 JSON — 페이지 B · 이미지 (dataURL 인라인) · 폰트", v1.found && v1.natural === 100 && v1.src?.startsWith("data:image/png") && v1.font, v1);
    await a.context.close();

    // ---------------- B: 빈 프로필 가져오기 ----------------
    const b = await createInstrumentedContext(browser, { storageState, frameCapture: false });
    await createIsolatedProject(b.page, baseUrl);
    await b.page.locator('input[type="file"][accept^="application/json"]').setInputFiles(zipPath);
    await b.page.waitForTimeout(5000);
    await waitReady(b.page);
    await fitTo(b.page);
    const imported = await b.page.evaluate(async () => {
      await document.fonts.load('32px "ADR235Inter"').catch(() => {});
      const st = window.__composition_STORE__.getState();
      const registry = JSON.parse(localStorage.getItem("composition.font-registry") ?? "{}");
      return { currentPageId: st.currentPageId, font: document.fonts.check('32px "ADR235Inter"'), faces: registry.faces?.map((f) => f.source.url.slice(0, 20)) };
    });
    const docB = await docJson(b.page);
    writeFileSync(resolve(out, "docB.json"), docB);
    await b.page.screenshot({ path: resolve(out, "b-canvas.png") });
    const canvasB = await magenta(b.page);
    record(
      "V2 빈 프로필 v2 zip 가져오기 — 문서 동일 · 현재 페이지 B · 폰트 · Canvas 이미지",
      docB === docA && imported.currentPageId === "adr235-page-b" && imported.font && canvasB.count > 0 && Math.abs(canvasB.w - canvasA.w) <= 1,
      { sameDoc: docB === docA, ...imported, canvasB },
    );

    // V7 — 없는 currentPageId
    manifest.editor.currentPageId = "page-that-does-not-exist";
    const badZip = await JSZip.loadAsync(zipBytes);
    badZip.file("manifest.json", JSON.stringify(manifest));
    const badPath = resolve(out, "bad-current-page.zip");
    writeFileSync(badPath, await badZip.generateAsync({ type: "nodebuffer" }));
    await b.page.locator('input[type="file"][accept^="application/json"]').setInputFiles(badPath);
    await b.page.waitForTimeout(4000);
    const v7 = await b.page.evaluate(() => {
      const st = window.__composition_STORE__.getState();
      const firstRuntime = st.pages.find((p) => p.id !== "page-components")?.id;
      return { currentPageId: st.currentPageId, firstPage: firstRuntime, toast: document.body.innerText.includes("첫 페이지") || document.body.innerText.includes("first page") };
    });
    record("V7 없는 currentPageId — 첫 페이지 + 경고", v7.currentPageId === v7.firstPage && v7.toast, v7);

    // V8 — manifest 손상 (manifests/ 없음) → 실패 알림
    const broken = await JSZip.loadAsync(zipBytes);
    broken.file("manifest.json", "{broken");
    const brokenPath = resolve(out, "broken.zip");
    writeFileSync(brokenPath, await broken.generateAsync({ type: "nodebuffer" }));
    await b.page.locator('input[type="file"][accept^="application/json"]').setInputFiles(brokenPath);
    await b.page.waitForTimeout(3000);
    const v8 = await b.page.evaluate(() => document.body.innerText.includes("불러오지 못했습니다") || document.body.innerText.includes("Could not load"));
    record("V8 손상 zip — 가져오기 실패 알림 (문서 무변경)", v8 && (await docJson(b.page)) !== "", { v8 });
    await b.context.close();
  } finally {
    await browser.close();
  }
  const file = resolve(out, `g4-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify({ baseUrl, results }, null, 2));
  const failed = results.filter((r) => !r.pass);
  process.stdout.write(`\n${results.length - failed.length}/${results.length} PASS · ${file}\n`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

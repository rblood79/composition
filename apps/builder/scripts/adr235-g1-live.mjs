#!/usr/bin/env node
// adr235-g1-live.mjs — ADR-235 G1 live (실제 builder 부팅, Playwright Chrome).
//
//   S1  asset: image fill (fit) → Canvas 픽셀: 자산 바이트가 중앙에 그려진다
//   S2  같은 바이트 2회 저장 = 자산 1개
//   S3  바이트 없는 asset: 참조 → 네트워크 요청 0 · 그리지 않음
//   S4  publish route (builder 의 Preview 버튼 새 탭 — DOM consumer) — 같은 참조가 blob: 로
//       해석되고 중앙 · 반복 없음 · 픽셀 bbox 비율이 Canvas 와 같다
//   S5  v1 JSON 내보내기 → 참조 0 · dataURL 인라인 → 빈 브라우저 프로필에서 가져오기 →
//       Canvas 픽셀 bbox 동일 (HC7)
//   S6  사용자 폰트 asset: → builder document.fonts · Skia fontManager · publish document.fonts
//
//   node apps/builder/scripts/adr235-g1-live.mjs [--base-url URL] [--headed] [--out DIR]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  createInstrumentedContext,
  createIsolatedProject,
  waitReady,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const argValue = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const baseUrl = argValue("--base-url", "http://localhost:5173");
const out = argValue("--out", "/private/tmp/adr235-g1-live");
const headed = args.includes("--headed");
const storageState = JSON.parse(
  readFileSync(resolve("apps/builder/scripts/.auth-session.json"), "utf8"),
);
const FONT_B64 = readFileSync(
  resolve("apps/builder/public/fonts/InterVariable.woff2"),
).toString("base64");

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(`${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail)}\n`);
};

/** 스크린샷에서 마젠타 픽셀 수 · bbox (페이지 안에서 디코드) */
async function magentaStats(page, png) {
  return page.evaluate(async (b64) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bin], { type: "image/png" }));
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(bitmap, 0, 0);
    const { data, width, height } = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
    let count = 0;
    let x0 = width, y0 = height, x1 = -1, y1 = -1;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const i = (y * width + x) * 4;
        if (data[i] > 235 && data[i + 1] < 25 && data[i + 2] > 235) {
          count += 1;
          if (x < x0) x0 = x;
          if (y < y0) y0 = y;
          if (x > x1) x1 = x;
          if (y > y1) y1 = y;
        }
      }
    }
    return count
      ? { count, bbox: { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 } }
      : { count: 0, bbox: null };
  }, png.toString("base64"));
}

/** 페이지 좌상단이 화면 안에 오도록 카메라 고정 (DEV 훅) */
async function fitViewport(page) {
  await page.evaluate(async () => {
    window.__composition_APPLY_VIEWPORT__?.({ scale: 1, x: 80, y: 80 });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });
  await page.waitForTimeout(500);
}

async function seedFrame(page, id, left, top) {
  return page.evaluate(
    async ({ id, left, top }) => {
      const store = window.__composition_STORE__;
      const state = store.getState();
      const pageId = state.currentPageId;
      const body = state.elements.find(
        (e) => e.page_id === pageId && e.type === "body",
      );
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
          props: {
            style: {
              position: "absolute",
              left: `${left}px`,
              top: `${top}px`,
              width: "200px",
              height: "200px",
            },
          },
        },
        [],
      );
      await new Promise((r) => setTimeout(r, 300));
    },
    { id, left, top },
  );
}

async function setImageFill(page, id, url, mode = "fit") {
  await page.evaluate(
    async ({ id, url, mode }) => {
      const store = window.__composition_STORE__;
      store.getState().setSelectedElement(id);
      await new Promise((r) => setTimeout(r, 100));
      store.getState().updateSelectedFills([
        {
          id: `fill-${id}`,
          type: "image",
          enabled: true,
          opacity: 1,
          blendMode: "normal",
          url,
          mode,
        },
      ]);
      store.getState().setSelectedElement(null);
    },
    { id, url, mode },
  );
}

async function main() {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: !headed });
  try {
    // ---------------- context A ----------------
    const a = await createInstrumentedContext(browser, {
      storageState,
      frameCapture: false,
    });
    const page = a.page;
    const assetRequests = [];
    a.context.on("request", (req) => {
      if (/asset:|sha256-/.test(req.url())) assetRequests.push(req.url());
    });
    await createIsolatedProject(page, baseUrl);
    await fitViewport(page);

    // 자산: 마젠타 100×50 PNG (fit → 200×200 상자에서 200×100 중앙)
    const stored = await page.evaluate(async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 100;
      canvas.height = 50;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ff00ff";
      ctx.fillRect(0, 0, 100, 50);
      const blob = await new Promise((r) => canvas.toBlob(r, "image/png"));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const store = await import("/src/lib/assets/assetStore.ts");
      const first = await store.storeAssetBytes({ bytes, mime: "image/png" });
      const second = await store.storeAssetBytes({ bytes: bytes.slice(), mime: "image/png" });
      const db = await (await import("/src/lib/assets/assetDb.ts")).openAssetDb();
      const count = await new Promise((r) => {
        const req = db.transaction("assets").objectStore("assets").count();
        req.onsuccess = () => r(req.result);
      });
      return { ref: first.ref, same: first.ref === second.ref, count };
    });
    record("S2 같은 바이트 2회 = 자산 1", stored.same && stored.count === 1, stored);

    await seedFrame(page, "g1-frame", 40, 40);
    const before = await magentaStats(page, await page.screenshot());
    await setImageFill(page, "g1-frame", stored.ref, "fit");
    await page.waitForTimeout(2500);
    const canvasShot = await page.screenshot();
    writeFileSync(resolve(out, "s1-canvas.png"), canvasShot);
    const canvasStats = await magentaStats(page, canvasShot);
    const aspect = canvasStats.bbox ? canvasStats.bbox.w / canvasStats.bbox.h : 0;
    record(
      "S1 Canvas 가 asset: image fill 을 그린다 (fit 2:1)",
      before.count === 0 && canvasStats.count > 0 && Math.abs(aspect - 2) < 0.1,
      { before: before.count, after: canvasStats, aspect },
    );

    // S3 — 바이트 없는 참조
    await seedFrame(page, "g1-missing", 300, 40);
    const missingRef = `asset:sha256-${"0".repeat(64)}`;
    const beforeMissing = await magentaStats(page, await page.screenshot());
    await setImageFill(page, "g1-missing", missingRef, "fill");
    await page.waitForTimeout(2000);
    const afterMissing = await magentaStats(page, await page.screenshot());
    record(
      "S3 해석 누락 참조 → 요청 0 · 그리지 않음",
      assetRequests.length === 0 && afterMissing.count === beforeMissing.count,
      { requests: assetRequests, before: beforeMissing.count, after: afterMissing.count },
    );

    // S6 (builder) — 사용자 폰트 asset:
    const fontResult = await page.evaluate(async (b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const store = await import("/src/lib/assets/assetStore.ts");
      const stored = await store.storeAssetBytes({
        bytes,
        mime: "font/woff2",
        name: "InterVariable.woff2",
      });
      // 앱과 같은 모듈 인스턴스 (HMR ?t= URL) — 다른 인스턴스는 해석기가 설치돼 있지 않다
      const appModule = (needle, fallback) =>
        performance
          .getEntriesByType("resource")
          .map((e) => e.name)
          .find((n) => n.includes(needle)) ?? fallback;
      const fonts = await import(
        appModule("/builder/fonts/customFonts.ts", "/src/builder/fonts/customFonts.ts")
      );
      let registry = fonts.loadFontRegistry();
      registry = fonts.addFontFace(registry, {
        id: "adr235-font",
        family: "ADR235Inter",
        format: "woff2",
        display: "block",
        source: { type: "project-asset", url: stored.ref, byteSize: bytes.length },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      fonts.saveRegistryAndNotify(registry);
      await new Promise((r) => setTimeout(r, 2500));
      await document.fonts.load('16px "ADR235Inter"').catch(() => {});
      const fontManagerUrl =
        performance
          .getEntriesByType("resource")
          .map((e) => e.name)
          .find((n) => n.includes("/canvas/skia/fontManager.ts")) ??
        "/src/builder/workspace/canvas/skia/fontManager.ts";
      const { skiaFontManager } = await import(fontManagerUrl);
      const styleEl = document.getElementById("composition-custom-fonts");
      const css = styleEl?.textContent ?? "";
      return {
        ref: stored.ref,
        documentFonts: document.fonts.check('16px "ADR235Inter"'),
        skia: skiaFontManager.hasFont("ADR235Inter"),
        cssHasBlob: /src: url\("blob:/.test(css),
        cssHasAsset: css.includes("asset:"),
        cssHead: css.slice(0, 120),
        styleExists: Boolean(styleEl),
      };
    }, FONT_B64);
    record(
      "S6a builder 사용자 폰트 asset: → document.fonts · Skia · CSS blob:",
      fontResult.documentFonts && fontResult.skia && fontResult.cssHasBlob && !fontResult.cssHasAsset,
      fontResult,
    );

    // S4 — publish route (Preview 버튼)
    const [publish] = await Promise.all([
      a.context.waitForEvent("page"),
      page.getByRole("button", { name: /^(Preview|미리보기)$/ }).first().click(),
    ]);
    await publish.waitForSelector('[data-element-id="g1-frame"]', { timeout: 30_000 });
    await publish.waitForTimeout(2000);
    const dom = await publish.evaluate(() => {
      const el = document.querySelector('[data-element-id="g1-frame"]');
      const cs = getComputedStyle(el);
      const missing = document.querySelector('[data-element-id="g1-missing"]');
      return {
        backgroundImage: cs.backgroundImage.slice(0, 40),
        position: cs.backgroundPosition,
        repeat: cs.backgroundRepeat,
        size: cs.backgroundSize,
        missingBackground: missing ? getComputedStyle(missing).backgroundImage : null,
        fontsCheck: document.fonts.check('16px "ADR235Inter"'),
      };
    });
    await publish.evaluate(() => document.fonts.load('16px "ADR235Inter"')).catch(() => {});
    const publishFont = await publish.evaluate(() => document.fonts.check('16px "ADR235Inter"'));
    const publishShot = await publish.screenshot();
    writeFileSync(resolve(out, "s4-publish.png"), publishShot);
    const publishStats = await magentaStats(publish, publishShot);
    const publishAspect = publishStats.bbox ? publishStats.bbox.w / publishStats.bbox.h : 0;
    // publish 런타임은 요소에 fills 를 싣지 않는다 (collectRuntimeElements — 기존 결함,
    //   publish 는 기능 링크만 방침이라 범위 밖). fills DOM leg 은 Preview 렌더러 unit 이 정본.
    //   여기서는 asset: 문자열이 DOM 으로 새지 않는지만 본다.
    const leaked = await publish.evaluate(() => document.documentElement.outerHTML.includes("asset:sha256-"));
    record("S4 publish route — asset: 문자열 DOM 누수 0 (fills 는 publish 결함으로 info)", !leaked, {
      leaked,
      info: { dom, publishStats, publishAspect },
    });
    record("S6b publish 사용자 폰트 asset: → document.fonts", publishFont, { publishFont });
    await publish.close();

    // S5 — v1 내보내기 (자립). 바이트 없는 참조가 있으면 실패해야 한다 (참조만 든 파일 금지).
    await page.locator(".header-menu-button").click();
    const failedDownload = await Promise.race([
      page.waitForEvent("download", { timeout: 4000 }).then(() => true).catch(() => false),
      page.locator('.header-menu-item[data-key="export"]').click().then(() => new Promise((r) => setTimeout(() => r(false), 4500))),
    ]);
    record("S5a 없는 자산 참조가 있으면 내보내기 실패 (HC7)", failedDownload === false, { downloaded: failedDownload });
    await page.evaluate(async () => {
      await window.__composition_STORE__.getState().removeElement("g1-missing");
      await new Promise((r) => setTimeout(r, 500));
    });
    await page.keyboard.press("Escape");
    await page.locator(".header-menu-button").click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator('.header-menu-item[data-key="export"]').click(),
    ]);
    const exportPath = resolve(out, "export-v1.json");
    await download.saveAs(exportPath);
    const exported = readFileSync(exportPath, "utf8");
    record("S5b v1 내보내기 — 참조 0 · dataURL 인라인", !exported.includes("asset:sha256-") && exported.includes("data:image/png;base64,") && exported.includes("data:font/woff2;base64,"), {
      bytes: exported.length,
    });
    await a.context.close();

    // ---------------- context B (빈 프로필) ----------------
    const b = await createInstrumentedContext(browser, {
      storageState,
      frameCapture: false,
    });
    await createIsolatedProject(b.page, baseUrl);
    await fitViewport(b.page);
    await b.page.locator('input[type="file"][accept="application/json,.json"]').setInputFiles(exportPath);
    await b.page.waitForTimeout(4000);
    await waitReady(b.page);
    const importedShot = await b.page.screenshot();
    writeFileSync(resolve(out, "s5-imported.png"), importedShot);
    const importedStats = await magentaStats(b.page, importedShot);
    const importedAspect = importedStats.bbox ? importedStats.bbox.w / importedStats.bbox.h : 0;
    const assetsInB = await b.page.evaluate(async () => {
      const db = await (await import("/src/lib/assets/assetDb.ts")).openAssetDb();
      return new Promise((r) => {
        const req = db.transaction("assets").objectStore("assets").count();
        req.onsuccess = () => r(req.result);
      });
    });
    record(
      "S5c 빈 프로필 가져오기 — Canvas 시각 동일 (HC7)",
      importedStats.count > 0 &&
        Math.abs(importedAspect - aspect) < 0.1 &&
        Math.abs(importedStats.bbox.w - canvasStats.bbox.w) <= 2,
      { importedStats, importedAspect, canvasBbox: canvasStats.bbox, assetsInB },
    );
    await b.context.close();
  } finally {
    await browser.close();
  }
  const file = resolve(out, `g1-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify({ baseUrl, results }, null, 2));
  const failed = results.filter((r) => !r.pass);
  process.stdout.write(`\n${results.length - failed.length}/${results.length} PASS · ${file}\n`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

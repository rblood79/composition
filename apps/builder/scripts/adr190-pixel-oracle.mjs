#!/usr/bin/env node
/**
 * ADR-190 Phase 1 / G1 — patch 경로와 full rebuild 경로의 pixel 동일성 검증.
 *
 * sparse patch 가 성능만 좋고 화면이 다르면 아무 의미가 없다. 같은 문서 상태를
 * (a) generic commit patch 로 도달한 뒤 캡처하고, (b) reload 로 full rebuild 해
 * 다시 캡처해서 backing buffer 를 픽셀 단위로 비교한다.
 *
 * ADR-189 G3 의 oracle 과 같은 방식이며, 차이는 (a) 에 도달하는 경로가
 * presentation 터미널 descriptor 가 아니라 `updateElementProps` 라는 점이다.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.ADR190_BASE_URL ?? "http://localhost:5173";
const OUT = process.env.ADR190_OUT ?? "/private/tmp/adr190-pixel-oracle.json";
const NODE_COUNT = Number(process.env.ADR190_NODES ?? "258");

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

const settle = (frames = 6) =>
  page.evaluate(
    (n) =>
      new Promise((done) => {
        let remaining = n;
        const step = () => {
          remaining -= 1;
          if (remaining <= 0) done();
          else requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
      }),
    frames,
  );

/** Skia backing buffer 를 그대로 읽는다 (overlay 포함 화면 그대로). */
const captureCanvas = () =>
  page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return null;
    return {
      dataUrl: canvas.toDataURL("image/png"),
      width: canvas.width,
      height: canvas.height,
    };
  });

await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
const projectName = `adr190-pixel-${Date.now()}`;
await page.getByLabel("New project name").fill(projectName);
await page.locator('form.new-project-form button[type="submit"]').click();
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 30000 });
const builderUrl = `${page.url()}?adr187Metrics=1&adr189Metrics=1`;
await page.goto(builderUrl, { waitUntil: "networkidle" });
await page.waitForFunction(
  () =>
    Boolean(
      window.__composition_STORE__ && window.__composition_COMMIT_LANE_DEBUG__,
    ),
  undefined,
  { timeout: 30000 },
);
await page.waitForTimeout(2500);

await page.evaluate(async (count) => {
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
        backgroundColor: i === 0 ? "#35B85A" : "#4A6CF7",
        height: i === 0 ? "120px" : "10px",
        left: i === 0 ? "20px" : `${(i % 30) * 12}px`,
        position: "absolute",
        top: i === 0 ? "30px" : `${Math.floor(i / 30) * 12 + 170}px`,
        width: i === 0 ? "120px" : "10px",
      },
    },
  });
  await st.addComplexElement(
    mk(0, "adr190-pixel-target"),
    Array.from({ length: Math.max(0, count - 1) }, (_, i) =>
      mk(i + 1, `adr190-pixel-node-${i + 1}`),
    ),
  );
}, NODE_COUNT);
await page.waitForTimeout(2500);
await settle();

// 선택 오버레이가 캡처에 섞이면 두 경로의 선택 상태 차이가 픽셀 차이로 새어
// 나온다. 비교 전에 선택을 비운다.
await page.evaluate(() => {
  window.__composition_STORE__.getState().setSelectedElement(null);
});
await settle();

// (a) generic commit patch 경로로 상태 변경
await page.evaluate(() => {
  window.__composition_COMMIT_LANE_DEBUG__.reset();
});
const patchResult = await page.evaluate(async () => {
  const store = window.__composition_STORE__;
  const st = store.getState();
  const target = st.elementsMap.get("adr190-pixel-target");
  await st.updateElementProps("adr190-pixel-target", {
    style: { ...(target?.props?.style ?? {}), left: "220px", top: "60px" },
  });
  await new Promise((r) => {
    let n = 6;
    const step = () => (--n <= 0 ? r() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  });
  const debug = window.__composition_COMMIT_LANE_DEBUG__.snapshot();
  return {
    queueCount: debug.queueCount,
    patchSuccessCount: debug.patchSuccessCount,
    patchFallbackCount: debug.patchFallbackCount,
    fullBuildCount: debug.buildMetrics.filter((m) => !m.subtree).length,
    subtreeBuildCount: debug.buildMetrics.filter((m) => m.subtree).length,
  };
});
await settle(8);
const patched = await captureCanvas();

// (b) reload → full rebuild 로 같은 상태 재도달
await page.goto(builderUrl, { waitUntil: "networkidle" });
await page.waitForFunction(
  () => Boolean(window.__composition_STORE__),
  undefined,
  { timeout: 30000 },
);
await page.waitForTimeout(3500);
await page.evaluate(() => {
  window.__composition_STORE__.getState().setSelectedElement(null);
});
await settle(8);
const rebuilt = await captureCanvas();

const diff = await page.evaluate(
  async ({ a, b }) => {
    const load = (url) =>
      new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(img);
        img.onerror = rej;
        img.src = url;
      });
    const [ia, ib] = await Promise.all([load(a.dataUrl), load(b.dataUrl)]);
    if (ia.width !== ib.width || ia.height !== ib.height) {
      return {
        sizeMismatch: true,
        a: { w: ia.width, h: ia.height },
        b: { w: ib.width, h: ib.height },
      };
    }
    const draw = (img) => {
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      c.getContext("2d").drawImage(img, 0, 0);
      return c.getContext("2d").getImageData(0, 0, img.width, img.height).data;
    };
    const da = draw(ia);
    const db = draw(ib);
    let differing = 0;
    let maxDelta = 0;
    let sumDelta = 0;
    for (let i = 0; i < da.length; i += 4) {
      let pixelMax = 0;
      for (let ch = 0; ch < 4; ch += 1) {
        const d = Math.abs(da[i + ch] - db[i + ch]);
        if (d > pixelMax) pixelMax = d;
        sumDelta += d;
      }
      if (pixelMax > 0) differing += 1;
      if (pixelMax > maxDelta) maxDelta = pixelMax;
    }
    return {
      sizeMismatch: false,
      width: ia.width,
      height: ia.height,
      totalPixels: da.length / 4,
      differingPixels: differing,
      maxChannelDelta: maxDelta,
      meanChannelDelta: sumDelta / da.length,
    };
  },
  { a: patched, b: rebuilt },
);

const result = {
  capturedAt: new Date().toISOString(),
  browser: await browser.version(),
  nodeCount: NODE_COUNT,
  projectName,
  patchResult,
  diff,
  errors,
};
writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ patchResult, diff, errors: errors.length }, null, 2));
await browser.close();

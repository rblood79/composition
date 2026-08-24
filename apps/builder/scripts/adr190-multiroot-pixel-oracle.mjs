#!/usr/bin/env node
/**
 * 다중 dirty root splice 의 pixel 동일성 검증.
 *
 * `adr190-pixel-oracle.mjs` 와 같은 방식이되, 한 commit 이 **여러 요소**를 바꾼다
 * (`batchUpdateElementProps`). 같은 rootKey 를 공유하는 dirty root 가 여러 개인
 * 경로가 full rebuild 와 같은 화면을 내는지 본다.
 *
 * 이 경로는 commit 마다 revision 을 하나만 쓰던 시절 둘째 root 부터
 * `stale-revision` 으로 거부돼 도달 자체가 불가능했다.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";

const BASE_URL = process.env.ADR190_BASE_URL ?? "http://localhost:5173";
const OUT =
  process.env.ADR190_OUT ?? "/private/tmp/adr190-multiroot-pixel-oracle.json";
const NODE_COUNT = Number(process.env.ADR190_NODES ?? "258");
const TARGET_COUNT = Number(process.env.ADR190_TARGETS ?? "4");

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
const projectName = `adr190-multiroot-${Date.now()}`;
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

await page.evaluate(
  async ({ count, targets }) => {
    const store = window.__composition_STORE__;
    const st = store.getState();
    const body = st.elements.find(
      (e) => e.page_id === st.currentPageId && e.type === "body",
    );
    const isTarget = (i) => i < targets;
    const mk = (i, id) => ({
      id,
      type: "frame",
      parent_id: body.id,
      page_id: st.currentPageId,
      order_num: 100 + i,
      props: {
        style: {
          backgroundColor: isTarget(i) ? "#35B85A" : "#4A6CF7",
          height: isTarget(i) ? "60px" : "10px",
          left: isTarget(i) ? `${20 + i * 70}px` : `${(i % 30) * 12}px`,
          position: "absolute",
          top: isTarget(i) ? "30px" : `${Math.floor(i / 30) * 12 + 170}px`,
          width: isTarget(i) ? "60px" : "10px",
        },
      },
    });
    await st.addComplexElement(
      mk(0, "adr190-mr-target-0"),
      Array.from({ length: Math.max(0, count - 1) }, (_, i) =>
        mk(
          i + 1,
          i + 1 < targets
            ? `adr190-mr-target-${i + 1}`
            : `adr190-mr-node-${i + 1}`,
        ),
      ),
    );
  },
  { count: NODE_COUNT, targets: TARGET_COUNT },
);
await page.waitForTimeout(2500);
await settle();

await page.evaluate(() => {
  window.__composition_STORE__.getState().setSelectedElement(null);
});
await settle();

// (a) 한 commit 이 여러 요소를 바꾸는 경로
await page.evaluate(() => {
  window.__composition_COMMIT_LANE_DEBUG__.reset();
});
const patchResult = await page.evaluate(async (targets) => {
  const store = window.__composition_STORE__;
  const st = store.getState();
  const updates = Array.from({ length: targets }, (_, i) => {
    const id = `adr190-mr-target-${i}`;
    const base = st.elementsMap.get(id)?.props?.style ?? {};
    return {
      elementId: id,
      props: {
        style: { ...base, left: `${240 + i * 70}px`, top: `${100 + i * 8}px` },
      },
    };
  });
  await st.batchUpdateElementProps(updates);
  await new Promise((r) => {
    let n = 6;
    const step = () => (--n <= 0 ? r() : requestAnimationFrame(step));
    requestAnimationFrame(step);
  });
  const debug = window.__composition_COMMIT_LANE_DEBUG__.snapshot();
  const sink = window.__composition_STORE_COMMIT_SINK_DEBUG__?.read();
  return {
    queueCount: debug.queueCount,
    patchSuccessCount: debug.patchSuccessCount,
    patchFallbackCount: debug.patchFallbackCount,
    fullBuildCount: debug.buildMetrics.filter((m) => !m.subtree).length,
    subtreeBuildCount: debug.buildMetrics.filter((m) => m.subtree).length,
    sink,
  };
}, TARGET_COUNT);
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
  targetCount: TARGET_COUNT,
  projectName,
  patchResult,
  diff,
  errors,
};
writeFileSync(OUT, `${JSON.stringify(result, null, 2)}\n`);
console.log(
  JSON.stringify({ patchResult, diff, errors: errors.length }, null, 2),
);
await browser.close();

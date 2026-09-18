#!/usr/bin/env node
// scroll-end-padding-live.mjs — Skia 스크롤 범위가 끝쪽 padding 을 포함하는지 (Chrome 대조) live.
//   사용자 보고 (2026-09-18): Compare 모드에서 body padding 24 인데 Skia 를 끝까지 스크롤하면
//   오른쪽·아래 여백이 없다. Chrome 은 scrollable overflow 에 끝 padding 을 넣는다
//   (scrollWidth = padL + content + padR).
//   1) 새 프로젝트 → body padding 24 · overflow auto → 자식 frame 2000×2000
//   2) Skia scrollMap(body).maxScroll + body 크기 ↔ Compare Preview `.react-aria-Body`
//      scrollWidth / scrollHeight 가 같다 (Preview pane 은 720 폭이라 maxScroll 자체는 다르다)
//   (wheel 로 끝까지 스크롤하는 픽셀 leg 는 없다 — Playwright wheel 이 body hit 을 못 잡고 viewport 를
//    팬했다. 사용자 문서 실측은 Chrome MCP 로: 390 폭 body · 마지막 Button right 412 → 22 → 46.)
// 사용: node apps/builder/scripts/scroll-end-padding-live.mjs [--headed]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.SCROLL_OUT ?? "/private/tmp/scroll-end-padding-live";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[scroll live]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
};

const RAIL_ORDER = [
  "navigator",
  "components",
  "datatable",
  "datatableEditor",
  "theme",
  "ai",
  "properties",
  "styles",
  "interactions",
  "history",
];
async function setPanel(page, panelId, open) {
  const button = page
    .locator(".panel-toggle-rail button")
    .nth(RAIL_ORDER.indexOf(panelId));
  if (((await button.getAttribute("aria-pressed")) === "true") !== open) {
    await button.click();
    await page.waitForTimeout(900);
  }
}

async function addFromPalette(page, type, parentId = null) {
  await setPanel(page, "components", true);
  await page.evaluate(
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    parentId,
  );
  await page.waitForTimeout(300);
  const before = await page.evaluate(
    (t) =>
      window.__composition_STORE__
        .getState()
        .elements.filter((e) => e.type === t || e.componentName === t)
        .map((e) => e.id),
    type,
  );
  const search = page
    .locator(
      '[data-panel-id="components"] input[type="search"], [data-panel-id="components"] input',
    )
    .first();
  await search.waitFor({ state: "visible", timeout: 20_000 });
  await search.fill(type);
  await page.waitForTimeout(400);
  const items = page.locator(`[data-panel-id="components"] .list-item`);
  const n = await items.count();
  let item = null;
  for (let i = 0; i < n; i++) {
    const label =
      (await items.nth(i).locator(".list-item-name").textContent()) ?? "";
    if (label.replace(/\s+/g, "").toLowerCase() === type.toLowerCase()) {
      item = items.nth(i);
      break;
    }
  }
  if (!item) throw new Error(`팔레트에 ${type} 없음 (${n} items)`);
  await item.click();
  const id = await page
    .waitForFunction(
      ({ t, before }) =>
        window.__composition_STORE__
          .getState()
          .elements.find(
            (e) =>
              (e.type === t || e.componentName === t) && !before.includes(e.id),
          )?.id ?? null,
      { t: type, before },
      { timeout: 15_000 },
    )
    .then((h) => h.jsonValue())
    .catch(() => null);
  await page.waitForTimeout(800);
  if (!id) throw new Error(`${type} 미생성`);
  await setPanel(page, "components", false);
  return id;
}

async function ensureCompareMode(page) {
  const compare = page
    .locator(".header_right .builder-control-group button")
    .first();
  if (
    (await compare.getAttribute("aria-pressed")) !== "true" &&
    (await compare.getAttribute("aria-checked")) !== "true"
  ) {
    await compare.click();
    await page.waitForTimeout(2500);
  }
}

const readSkiaScroll = (page, id) =>
  page.evaluate((elementId) => {
    const s = window.__composition_SCROLL_STATE__?.getState().scrollMap.get(
      elementId,
    );
    return s ? { ...s } : null;
  }, id);

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`scroll-pad-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  log("project", page.url().split("/builder/")[1]);

  // 1) body padding 24 + 넘치는 자식
  const bodyId = await page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    return (
      st.elements.find(
        (e) => e.type === "body" && e.page_id === st.currentPageId,
      )?.id ?? null
    );
  });
  if (!bodyId) throw new Error("body 없음");
  const bodyStyle = await page.evaluate((id) => {
    const st = window.__composition_STORE__.getState();
    return st.elements.find((e) => e.id === id)?.props?.style ?? {};
  }, bodyId);
  await page.evaluate(
    ({ id, style }) =>
      window.__composition_STORE__.getState().updateElementProps(id, {
        style: { ...style, overflow: "auto", padding: "24px" },
      }),
    { id: bodyId, style: bodyStyle },
  );
  await page.waitForTimeout(600);
  const boxId = await addFromPalette(page, "frame", bodyId);
  await page.evaluate(
    (id) =>
      window.__composition_STORE__.getState().updateElementProps(id, {
        style: {
          width: "2000px",
          height: "2000px",
          backgroundColor: "#4f7cff",
        },
      }),
    boxId,
  );
  await page.waitForTimeout(1200);
  await page.evaluate(() =>
    window.__composition_STORE__.getState().setSelectedElement(null),
  );

  // 2) Skia maxScroll ↔ Chrome
  await ensureCompareMode(page);
  await page.waitForTimeout(1500);
  const skia = await readSkiaScroll(page, bodyId);
  const chrome = await page
    .waitForFunction(
      () => {
        for (const f of document.querySelectorAll("iframe")) {
          const el = f.contentDocument?.querySelector(".react-aria-Body");
          if (!el || el.scrollWidth <= el.clientWidth) continue;
          return {
            maxScrollLeft: el.scrollWidth - el.clientWidth,
            maxScrollTop: el.scrollHeight - el.clientHeight,
            scrollWidth: el.scrollWidth,
            scrollHeight: el.scrollHeight,
            clientWidth: el.clientWidth,
            paddingRight: getComputedStyle(el).paddingRight,
          };
        }
        return null;
      },
      null,
      { timeout: 15_000 },
    )
    .then((h) => h.jsonValue())
    .catch(() => null);
  log("skia", JSON.stringify(skia), "chrome", JSON.stringify(chrome));
  const layout = await page.evaluate((id) => {
    const l = window.__composition_LAYOUT_DEBUG__
      .getSharedLayoutMap()
      ?.get(id);
    return l ? { width: l.width, height: l.height } : null;
  }, bodyId);
  // Compare 의 Preview iframe 은 pane 폭 (720) 이라 body 폭이 Skia (1920) 와 다르다 → maxScroll 이
  // 아니라 scrollable overflow 끝 (scrollWidth/Height = maxScroll + client) 을 대조한다.
  record(
    "Skia scrollable overflow 끝 = Chrome scrollWidth / scrollHeight (끝 padding 24 포함)",
    !!skia &&
      !!chrome &&
      !!layout &&
      Math.abs(skia.maxScrollLeft + layout.width - chrome.scrollWidth) <= 1 &&
      Math.abs(skia.maxScrollTop + layout.height - chrome.scrollHeight) <= 1,
    `skia ${skia ? skia.maxScrollLeft + layout?.width : "?"}/${skia ? skia.maxScrollTop + layout?.height : "?"} vs chrome ${chrome?.scrollWidth}/${chrome?.scrollHeight} (padR ${chrome?.paddingRight})`,
  );
  // 끝 padding 24 가 범위에 들어갔는가 — 자식 right 24+2000 − body 폭 + 24
  record(
    "Skia 범위 = 자식 끝 + 끝 padding 24 − body 크기",
    !!skia &&
      !!layout &&
      Math.abs(skia.maxScrollLeft - (24 + 2000 + 24 - layout.width)) <= 1 &&
      Math.abs(skia.maxScrollTop - (24 + 2000 + 24 - layout.height)) <= 1,
    `body ${layout?.width}×${layout?.height} → 기대 ${layout ? 2048 - layout.width : "?"}/${layout ? 2048 - layout.height : "?"}`,
  );

  // 3) 세로: 페이지(1080)보다 긴 자식 + body padding 24 → 끝까지 스크롤한 Skia 픽셀에서
  //    자식 아래 24px 띠가 body 배경(흰색)인지 본다. 스크롤은 store scrollBy (StoreRenderBridge 가
  //    scrollMap 변화를 구독해 재빌드) — Playwright wheel 은 body hit 을 못 잡고 viewport 를 팬했다.
  //    frame 의 backgroundColor 는 Skia 픽셀에 안 실리므로 (메모리 feedback-…skia-frame-blank)
  //    긴 자식은 Button 으로 — 프레임은 1×1 로 줄인다.
  await page.evaluate(
    (id) =>
      window.__composition_STORE__.getState().updateElementProps(id, {
        style: { width: "1px", height: "1px" },
      }),
    boxId,
  );
  await page.waitForTimeout(600);
  const tallId = await addFromPalette(page, "Button", bodyId);
  await page.evaluate(
    (id) =>
      window.__composition_STORE__.getState().updateElementProps(id, {
        style: { width: "600px", height: "1600px", backgroundColor: "#4f7cff" },
      }),
    tallId,
  );
  await page.waitForTimeout(1200);
  await page.evaluate(() =>
    window.__composition_STORE__.getState().setSelectedElement(null),
  );
  const tall = await readSkiaScroll(page, bodyId);
  record(
    "세로: maxScrollTop = 24 + 1600 + 24 − 1080 (Button 1600 이 body 1080 보다 길다)",
    !!tall && Math.abs(tall.maxScrollTop - (1648 - layout.height)) <= 1,
    JSON.stringify(tall) + " kids " + JSON.stringify(await page.evaluate((ids) => ids.map((id) => { const l = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().get(id); return l && { y: l.y, h: l.height }; }), [boxId, tallId])),
  );
  await page.evaluate((id) => {
    const st = window.__composition_STORE__.getState();
    const pp = st.pagePositions?.[st.currentPageId] ?? { x: 0, y: 0 };
    window.__composition_APPLY_VIEWPORT__?.({
      scale: 0.5,
      x: -pp.x * 0.5 + 40,
      y: -pp.y * 0.5 + 80,
    });
    window.__composition_SCROLL_STATE__.getState().scrollBy(id, 0, 1e6);
  }, bodyId);
  await page.waitForTimeout(1500);
  const scrolled = await readSkiaScroll(page, bodyId);
  const vp = await page.evaluate(() => {
    const v = window.__composition_VIEWPORT__?.();
    const r = document.querySelector("canvas").getBoundingClientRect();
    return { zoom: v?.zoom, pan: v?.panOffset, canvas: { x: r.x, y: r.y, w: r.width, h: r.height } };
  });
  log("scrolled", JSON.stringify(scrolled), "viewport", JSON.stringify(vp));
  const shot = resolve(OUT_DIR, "scrolled-end.png");
  await page.screenshot({ path: shot });
  log("screenshot", shot);
  // 픽셀 판정은 스크린샷 육안 (Skia 캔버스는 페이지 안에서 readback 불가 — preserveDrawingBuffer:false).
  //   기대: 0.5 배에서 Button 하단과 body 하단 사이 12px 흰 띠 (= padding 24).
  record("page error 0", errors.length === 0, errors.slice(0, 3).join(" | "));
} catch (e) {
  record("harness", false, String(e?.stack ?? e));
} finally {
  writeFileSync(
    resolve(OUT_DIR, "findings.json"),
    JSON.stringify({ findings, errors }, null, 2),
  );
  await browser.close();
}
const failed = findings.filter((f) => !f.pass).length;
log(`${findings.length - failed}/${findings.length} PASS`);
process.exit(failed ? 1 : 0);

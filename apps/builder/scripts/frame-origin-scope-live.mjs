// 사용자 frame 을 컴포넌트로 만들어도 캔버스에서 사라지지 않는다 — 페이지 안 reusable frame 은 페이지 scope.
// headed Playwright · 실제 빌더 · Compare Mode / Preview iframe 은 열지 않는다.
// 사용: node apps/builder/scripts/frame-origin-scope-live.mjs  →  output/playwright/frame-origin-scope/
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { waitReady } from "./perf-baseline.mjs";

const OUT = "output/playwright/frame-origin-scope";
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
  const before = await page.evaluate(() =>
    window.__composition_STORE__.getState().elements.map((e) => e.id),
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
  for (let i = 0; i < n; i++) {
    const label =
      (await items.nth(i).locator(".list-item-name").textContent()) ?? "";
    if (label.replace(/\s+/g, "").toLowerCase() === type.toLowerCase()) {
      await items.nth(i).click();
      break;
    }
  }
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
  await setPanel(page, "components", false);
  return id;
}

const storeRead = (page, fn, arg) => page.evaluate(fn, arg);

/**
 * 캔버스 스코프로 포커스를 옮긴다 (선택은 store 로 정한다). 클릭하면 좌표가 다른 페이지 프레임에
 * 닿아 현재 페이지가 바뀔 수 있어, 캔버스 컨테이너 (`tabIndex=-1`) 에 직접 포커스를 준다.
 */
async function focusCanvas(page) {
  await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    const container = canvas?.closest('[tabindex="-1"]');
    container?.focus();
  });
  await page.waitForTimeout(300);
}

async function toastTexts(page) {
  return page.locator(".toast .toast-message").allInnerTexts();
}

async function clearToasts(page) {
  const dismiss = page.locator(".toast .toast-dismiss");
  for (let i = (await dismiss.count()) - 1; i >= 0; i--) {
    await dismiss
      .nth(i)
      .click()
      .catch(() => {});
  }
  await page.waitForTimeout(200);
}


const impactDialog = (page) => page.locator(".editing-impact-modal");
async function answerDialog(page, confirm) {
  const dialog = impactDialog(page);
  const visible = await dialog
    .waitFor({ state: "visible", timeout: 4000 })
    .then(() => true)
    .catch(() => false);
  if (visible) {
    await dialog
      .locator(".editing-impact-actions button")
      .nth(confirm ? 1 : 0)
      .click();
    await page.waitForTimeout(800);
  }
  return visible;
}
const selectIds = (page, ids) =>
  page.evaluate((list) => {
    const st = window.__composition_STORE__.getState();
    st.setSelectedElement(list[0]);
    if (list.length > 1) st.setSelectedElements(list);
  }, ids);

async function screenRect(page, id) {
  return page.evaluate((id) => {
    const r = window.__composition_RENDER_DEBUG__?.getSceneBounds(id);
    if (!r) return null;
    const cam = window.__composition_VIEWPORT__();
    const canvas = document
      .querySelector('[data-testid="skia-canvas-unified"]')
      .getBoundingClientRect();
    const z = cam.zoom;
    return {
      x: canvas.left + r.x * z + cam.panOffset.x,
      y: canvas.top + r.y * z + cam.panOffset.y,
      w: r.width * z,
      h: r.height * z,
    };
  }, id);
}

/** 실제 마우스로 from 요소 중앙에서 to 요소의 윗부분 (앞에 끼우기) 으로 끈다. */
async function dragOnto(page, fromId, toId, { alt = false } = {}) {
  const from = await screenRect(page, fromId);
  const to = await screenRect(page, toId);
  if (!from || !to) return { from, to, dragged: false };
  const sx = from.x + from.w / 2;
  const sy = from.y + from.h / 2;
  const tx = to.x + to.w / 2;
  const ty = to.y + Math.max(2, to.h * 0.2);
  await page.mouse.move(sx, sy);
  if (alt) await page.keyboard.down("Alt");
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(sx + ((tx - sx) * i) / 12, sy + ((ty - sy) * i) / 12);
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  if (alt) await page.keyboard.up("Alt");
  await page.waitForTimeout(600);
  return { from, to, dragged: true };
}

const childOrder = (page, parentId) =>
  page.evaluate(
    (pid) =>
      window.__composition_STORE__
        .getState()
        .elements.filter((e) => e.parent_id === pid)
        .sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0))
        .map((e) => e.id),
    parentId,
  );
const canonicalChildOrder = (page, parentId) =>
  page.evaluate((pid) => {
    const st = window.__composition_STORE__.getState();
    return (st.childrenMap?.get(pid) ?? []).map((e) => e.id ?? e);
  }, parentId);

const snapshotChildren = (page) =>
  page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    const out = {};
    for (const [k, v] of st.childrenMap ?? []) out[k] = v.map((e) => (typeof e === "string" ? e : e.id)).join(",");
    return out;
  });
const diffChildren = (a, b) =>
  Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k]).map((k) => ({ parent: k, before: a[k], after: b[k] }));

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  storageState: resolve("apps/builder/scripts/.auth-session.json"),
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const report = { checks: {}, errors };
const probe = (ids) =>
  page.evaluate((ids) => {
    const st = window.__composition_STORE__.getState();
    return ids.map((id) => ({
      id,
      page: st.elementsMap.get(id)?.page_id ?? null,
      reusable: st.elementsMap.get(id)?.reusable ?? false,
      bounds: window.__composition_RENDER_DEBUG__?.getSceneBounds(id) ?? null,
    }));
  }, ids);

try {
  await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
  await page.locator("button.dashboard-create-button").first().click();
  const name = page.locator("#new-project-name");
  await name.fill("frame-origin-scope");
  await name.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90000 });
  await waitReady(page);
  await page.bringToFront();
  const { bodyId, pageId } = await storeRead(page, () => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find((e) => e.type === "body" && e.page_id === st.currentPageId);
    return { bodyId: body?.id ?? null, pageId: st.currentPageId };
  });
  const frameId = await addFromPalette(page, "frame", bodyId);
  const textId = await addFromPalette(page, "Text", frameId);
  await page.waitForTimeout(1200);
  report.checks.before = await probe([frameId, textId]);
  await page.screenshot({ path: `${OUT}/before.png` });

  // 메뉴와 같은 액션 — 컴포넌트로 만들기.
  await storeRead(page, (id) => window.__composition_STORE__.getState().toggleComponentOrigin(id), frameId);
  await page.waitForTimeout(1500);
  report.checks.afterToggle = await probe([frameId, textId]);
  await page.screenshot({ path: `${OUT}/after-toggle.png` });

  // instance 를 같은 페이지에 — 원본과 instance 가 둘 다 보인다.
  const instance = await storeRead(
    page,
    ({ frameId, bodyId, pageId }) =>
      window.__composition_STORE__.getState().createInstance(frameId, bodyId, pageId),
    { frameId, bodyId, pageId },
  );
  await page.waitForTimeout(1500);
  report.checks.afterInstance = await probe([frameId, textId, instance?.id]);
  await page.screenshot({ path: `${OUT}/after-instance.png` });

  // 새로고침 뒤에도 (IndexedDB 재hydration) 같은 scope.
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await page.waitForTimeout(2000);
  report.checks.afterReload = await probe([frameId, textId, instance?.id]);
  const sb = report.checks.afterReload[0].bounds;
  if (sb) {
    await page.evaluate(async (s) => {
      window.__composition_APPLY_VIEWPORT__(s);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }, { scale: 2, x: 300 - sb.x * 2, y: 200 - sb.y * 2 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/after-reload-zoom.png` });
  }
  await page.screenshot({ path: `${OUT}/after-reload.png` });
} finally {
  await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

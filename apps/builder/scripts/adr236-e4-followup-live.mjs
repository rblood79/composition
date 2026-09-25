// ADR-236 E4 후속 live — 캔버스 드래그 · Alt 드래그 복제도 origin 안 구조 변경이면 영향 확인을 묻는다.
// headed Playwright · 실제 빌더 · Compare Mode / Preview iframe 은 열지 않는다.
// 사용: node apps/builder/scripts/adr236-e4-followup-live.mjs  →  output/playwright/adr236/e4-followup/
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { waitReady } from "./perf-baseline.mjs";

const OUT = "output/playwright/adr236/e4-followup";
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

try {
  await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
  await page.locator("button.dashboard-create-button").first().click();
  const name = page.locator("#new-project-name");
  await name.fill("adr236-e4-followup");
  await name.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90000 });
  await waitReady(page);
  await page.bringToFront();

  const { bodyId, pageId } = await storeRead(page, () => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find(
      (e) => e.type === "body" && e.page_id === st.currentPageId,
    );
    return { bodyId: body?.id ?? null, pageId: st.currentPageId };
  });
  // Card instance 를 홈에 두어 Components 페이지 Card origin 에 instance 가 생기게 한다.
  const cardInstanceId = await addFromPalette(page, "Form", bodyId);
  const origin = await storeRead(page, () => {
    const st = window.__composition_STORE__.getState();
    const all = [...st.elementsMap.values()];
    const card = all.find((e) => e.id === "component-form");
    return card ? { id: card.id, pageId: card.page_id } : null;
  });
  await storeRead(
    page,
    ({ id, pageId }) =>
      window.__composition_STORE__.getState().selectElementWithPageTransition(id, pageId),
    origin,
  );
  await page.waitForTimeout(2500);
  const kids = await storeRead(page, (id) => {
    const st = window.__composition_STORE__.getState();
    return st.elements
      .filter((e) => e.parent_id === id)
      .sort((a, b) => (a.order_num ?? 0) - (b.order_num ?? 0))
      .map((e) => ({ id: e.id, type: e.type }));
  }, origin.id);
  const frameId = origin.id;
  const [c0, c1] = kids.slice(0, 2);
  const t1 = c0?.id;
  const t2 = c1?.id;
  // 형제 순서 정본은 canonical children[] (ADR-118) — store childrenMap 이 그 순서를 싣는다.
  const order = async () =>
    (await storeRead(page, (id) => {
      const st = window.__composition_STORE__.getState();
      return (st.childrenMap?.get(id) ?? []).map((e) => (typeof e === "string" ? e : e.id));
    }, frameId));
  report.setup = { cardInstanceId, origin, kids, order: await order() };
  const applyViewport = (s) =>
    page.evaluate(async (s) => {
      window.__composition_APPLY_VIEWPORT__(s);
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    }, s);
  // 컬링 — 먼저 크게 축소해 scene bounds 를 얻고, origin 을 화면 가운데 1배로 둔다.
  let sb = null;
  for (const [scale, x, y] of [[0.1, 900, 150], [0.05, 1100, 200], [0.2, 900, 150]]) {
    await applyViewport({ scale, x, y });
    await page.waitForTimeout(1200);
    sb = await page.evaluate((id) => window.__composition_RENDER_DEBUG__.getSceneBounds(id) ?? null, frameId);
    if (sb) break;
  }
  report.originBounds = sb;
  if (sb) {
    await applyViewport({ scale: 1, x: 500 - sb.x, y: 150 - sb.y });
    await page.waitForTimeout(1500);
  }
  report.probe = await page.evaluate((ids) => ({
    bounds: ids.map((id) => window.__composition_RENDER_DEBUG__?.getSceneBounds(id) ?? null),
    currentPageId: window.__composition_STORE__.getState().currentPageId,
  }), [frameId, t1, t2]);
  await page.screenshot({ path: `${OUT}/setup.png` });
  if (!report.probe.bounds[1] || !report.probe.bounds[2]) throw new Error("probe: " + JSON.stringify(report));

  // D. 대조 — origin 자식 Backspace 삭제 (Phase 3 수리 경로). 대화상자 → 취소.
  report.impactProbe = await page.evaluate((id) => {
    const st = window.__composition_STORE__.getState();
    const all = [...st.elementsMap.values()];
    return {
      instancesOfOrigin: all.filter((e) => e.ref === id || e.masterId === id).map((e) => ({ id: e.id, page: e.page_id })),
    };
  }, frameId);
  await focusCanvas(page);
  await selectIds(page, [t1]);
  await page.keyboard.press("Backspace");
  report.checks.D_deleteDialog = { dialog: await answerDialog(page, false), stillExists: await storeRead(page, (id) => window.__composition_STORE__.getState().elementsMap.has(id), t1) };

  const editInside = async (id) => {
    await storeRead(page, (fid) => window.__composition_STORE__.getState().setEditingContext(fid), frameId);
    await selectIds(page, [id]);
    await page.waitForTimeout(500);
  };

  // L. 대조군 — origin 루트 (Form) 를 Components 페이지 안에서 앞 형제 자리로. instance 내용은 그대로라
  //   묻지 않고 바로 옮긴다.
  const bodyOrder = async () =>
    (await snapshotChildren(page))["page-components-body"]?.split(",") ?? [];
  const beforeBody = await bodyOrder();
  const prevSibling = beforeBody[beforeBody.indexOf(frameId) - 1];
  await storeRead(page, () => window.__composition_STORE__.getState().setEditingContext(null));
  await selectIds(page, [frameId]);
  await page.waitForTimeout(400);
  const lDrag = await dragOnto(page, frameId, prevSibling);
  const lDialog = await answerDialog(page, false);
  const afterBody = await bodyOrder();
  report.checks.L_originRootMoveNoDialog = {
    dragged: lDrag.dragged,
    dialog: lDialog,
    prevSibling,
    indexBefore: beforeBody.indexOf(frameId),
    indexAfter: afterBody.indexOf(frameId),
  };
  // 카메라를 다시 Form 에.
  const sb2 = await page.evaluate((id) => window.__composition_RENDER_DEBUG__.getSceneBounds(id) ?? null, frameId);
  if (sb2) {
    await applyViewport({ scale: 1, x: 500 - sb2.x, y: 150 - sb2.y });
    await page.waitForTimeout(1200);
  }

  // I. Form 안 필드 재배열 (field-2 → field-1 앞) — 대화상자 → 취소 → 순서 그대로.
  await editInside(t2);
  const iSel = await storeRead(page, () => window.__composition_STORE__.getState().selectedElementIds);
  const iDrag = await dragOnto(page, t2, t1);
  const iDialog = await answerDialog(page, false);
  report.checks.I_childDragCancel = { selected: iSel, dragged: iDrag.dragged, dialog: iDialog, order: await order() };

  // J. 같은 드래그 → 확인 → 순서가 바뀐다.
  await editInside(t2);
  const jSel = await storeRead(page, () => window.__composition_STORE__.getState().selectedElementIds);
  const jDrag = await dragOnto(page, t2, t1);
  const jDialog = await answerDialog(page, true);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/J-after.png` });
  report.checks.J_childDragConfirm = { selected: jSel, dragged: jDrag.dragged, dialog: jDialog, order: await order() };

  // K. Alt 드래그 복제 — 같은 origin 은 J 에서 확인돼 묻지 않고 복제 1.
  const beforeKids = await order();
  await editInside(t1);
  const kDrag = await dragOnto(page, t1, t2, { alt: true });
  const kDialog = await answerDialog(page, true);
  await page.waitForTimeout(800);
  const afterKids = await order();
  report.checks.K_altCloneCached = {
    dragged: kDrag.dragged,
    dialog: kDialog,
    childDelta: afterKids.length - beforeKids.length,
    toasts: await toastTexts(page),
  };
} finally {
  await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

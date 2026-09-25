// ADR-236 Phase 3 판독 수리 live — origin 안 구조 변경의 영향 확인은 표면이 먼저 묻는다 (HIGH-2).
// headed Playwright · 실제 빌더 · Compare Mode / Preview iframe 은 열지 않는다.
// 사용: node apps/builder/scripts/adr236-phase3-repair-live.mjs  →  output/playwright/adr236/phase3-repair/
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { waitReady } from "./perf-baseline.mjs";

const OUT = "output/playwright/adr236/phase3-repair";
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
  await name.fill("adr236-phase3-repair");
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
  const frameId = await addFromPalette(page, "frame", bodyId);
  const t1 = await addFromPalette(page, "Text", frameId);
  const t2 = await addFromPalette(page, "Text", frameId);
  const setup = await storeRead(
    page,
    async ({ frameId, bodyId, pageId }) => {
      const st = window.__composition_STORE__.getState();
      await st.toggleComponentOrigin(frameId);
      const instanceId = await window.__composition_STORE__
        .getState()
        .createInstance(frameId, bodyId, pageId);
      return {
        reusable: window.__composition_STORE__.getState().elementsMap.get(frameId)
          ?.reusable,
        instanceId: instanceId ?? null,
      };
    },
    { frameId, bodyId, pageId },
  );
  await page.waitForTimeout(1000);
  const parentOf = (id) =>
    storeRead(
      page,
      (x) => window.__composition_STORE__.getState().elementsMap.get(x)?.parent_id ?? null,
      id,
    );
  const count = () =>
    storeRead(page, () => window.__composition_STORE__.getState().elements.length);
  report.setup = { frameId, t1, t2, ...setup };

  // F. origin 안 Text 삭제 (Backspace) — 대화상자 · 취소하면 남는다.
  await focusCanvas(page);
  await selectIds(page, [t1]);
  await page.keyboard.press("Backspace");
  const fDialog = await answerDialog(page, false);
  report.checks.F_deleteCancel = {
    dialog: fDialog,
    stillExists: await storeRead(
      page,
      (x) => window.__composition_STORE__.getState().elementsMap.has(x),
      t1,
    ),
  };

  // G. origin 안 두 Text 묶기 (⌘G) — 대화상자 · 취소하면 frame 도 이동도 없다.
  const beforeCount = await count();
  await focusCanvas(page);
  await selectIds(page, [t1, t2]);
  await page.keyboard.press("Meta+g");
  const gDialog = await answerDialog(page, false);
  await page.screenshot({ path: `${OUT}/G-after-cancel.png` });
  report.checks.G_groupCancel = {
    dialog: gDialog,
    countDelta: (await count()) - beforeCount,
    t1Parent: await parentOf(t1),
    t2Parent: await parentOf(t2),
  };

  // H. 다시 묶기 → 확인 — frame 이 생기고 두 Text 가 그 안으로 (대화상자 1회, 부분 반영 없음).
  await focusCanvas(page);
  await selectIds(page, [t1, t2]);
  await page.keyboard.press("Meta+g");
  const hDialog = await answerDialog(page, true);
  await page.waitForTimeout(800);
  const t1Parent = await parentOf(t1);
  report.checks.H_groupConfirm = {
    dialog: hDialog,
    countDelta: (await count()) - beforeCount,
    t1Parent,
    t2Parent: await parentOf(t2),
    newGroupParent: await parentOf(t1Parent),
  };
} finally {
  await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

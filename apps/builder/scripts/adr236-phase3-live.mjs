// ADR-236 Phase 3 live — 구조 변경 판정 (canOperate) 표면 · store 가드.
// headed Playwright · 실제 빌더 · Compare Mode / Preview iframe 은 열지 않는다.
// 사용: node apps/builder/scripts/adr236-phase3-live.mjs  →  output/playwright/adr236/phase3/
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { waitReady } from "./perf-baseline.mjs";

const OUT = "output/playwright/adr236/phase3";
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
  await page.goto("http://localhost:5173/dashboard", {
    waitUntil: "networkidle",
  });
  await page.locator("button.dashboard-create-button").first().click();
  const name = page.locator("#new-project-name");
  await name.fill("adr236-phase3");
  await name.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90000 });
  await waitReady(page);
  await page.bringToFront();

  // ── A. 단축키 ⌥⌘K 로 body 를 컴포넌트로 만들 수 없다 (E1) ──
  const bodyId = await storeRead(page, () => {
    const st = window.__composition_STORE__.getState();
    return (
      st.elements.find(
        (e) => e.type === "body" && e.page_id === st.currentPageId,
      )?.id ?? null
    );
  });
  await focusCanvas(page);
  await storeRead(
    page,
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    bodyId,
  );
  await page.waitForTimeout(300);
  await page.keyboard.press("Meta+Alt+k");
  await page.waitForTimeout(800);
  report.checks.A_bodyToggleShortcut = {
    bodyId,
    bodyReusable: await storeRead(
      page,
      (id) =>
        window.__composition_STORE__.getState().elementsMap.get(id)?.reusable ??
        false,
      bodyId,
    ),
    toasts: await toastTexts(page),
  };
  await clearToasts(page);

  // ── B. Components 페이지 system origin — 단축키 삭제는 지우지 않고 이유를 보인다 (E3) ──
  const origin = await storeRead(page, () => {
    const st = window.__composition_STORE__.getState();
    const el = st.elements.find(
      (e) =>
        e.reusable === true &&
        e.metadata?.systemOwned === true &&
        e.type === "Button" &&
        typeof e.ref !== "string",
    );
    return el ? { id: el.id, pageId: el.page_id } : null;
  });
  await focusCanvas(page);
  await storeRead(
    page,
    ({ id, pageId }) =>
      window.__composition_STORE__
        .getState()
        .selectElementWithPageTransition(id, pageId),
    origin,
  );
  await page.waitForTimeout(1500);
  await focusCanvas(page);
  await storeRead(
    page,
    (id) => window.__composition_STORE__.getState().setSelectedElement(id),
    origin.id,
  );
  await page.waitForTimeout(300);
  await page.keyboard.press("Backspace");
  await page.waitForTimeout(800);
  report.checks.B_systemOriginShortcutDelete = {
    origin,
    currentPageId: await storeRead(
      page,
      () => window.__composition_STORE__.getState().currentPageId,
    ),
    stillExists: await storeRead(
      page,
      (id) => window.__composition_STORE__.getState().elementsMap.has(id),
      origin.id,
    ),
    toasts: await toastTexts(page),
  };
  await clearToasts(page);

  // ── C. Layers — system origin 행에 삭제 버튼이 없고, 우클릭 메뉴에 삭제 · 해제가 없다 (E3) ──
  await setPanel(page, "navigator", true);
  const layersCheck = async (id) => {
    const row = page.locator(`[data-key="${id}"]`).first();
    await row.waitFor({ state: "visible", timeout: 15000 });
    const deleteButtons = await row
      .locator('button[aria-label^="Delete "]')
      .count();
    await row.click({ button: "right" });
    await page.waitForTimeout(700);
    const menuItems = await page
      .locator(".context-menu-item")
      .evaluateAll((items) =>
        items.map((item) => item.getAttribute("data-key") ?? item.textContent),
      );
    await page.screenshot({ path: `${OUT}/C-${id}.png` });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    return { id, deleteButtons, menuItems };
  };
  report.checks.C_layersSystemOrigin = [
    await layersCheck("component-listbox-item-default"),
    await layersCheck("component-listbox-item-default--hover"),
  ];

  // 대조군 — 홈 페이지에 팔레트로 추가한 frame (일반 요소) 행에는 삭제 버튼 · 메뉴 삭제 · ungroup 이 있다.
  const homePageId = await storeRead(
    page,
    (id) =>
      window.__composition_STORE__.getState().elementsMap.get(id)?.page_id,
    bodyId,
  );
  await storeRead(
    page,
    ({ id, pageId }) =>
      window.__composition_STORE__
        .getState()
        .selectElementWithPageTransition(id, pageId),
    { id: bodyId, pageId: homePageId },
  );
  await page.waitForTimeout(1500);
  await setPanel(page, "navigator", false);
  const controlId = await addFromPalette(page, "frame", bodyId);
  await setPanel(page, "navigator", true);
  report.checks.C_control = { controlId, ...(await layersCheck(controlId)) };
} finally {
  await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

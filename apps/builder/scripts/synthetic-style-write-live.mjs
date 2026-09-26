// instance 안 synthetic 자식 (`<form>/<path>`) 의 Styles 쓰기 — 바뀐 키만 patch 에 · reset 이 patch 를 지운다.
// headed Playwright · 실제 빌더 · Compare Mode / Preview iframe 은 열지 않는다.
// 사용: node apps/builder/scripts/synthetic-style-write-live.mjs  →  output/playwright/synthetic-style-write/
import { chromium } from "playwright";
import { resolve } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { waitReady } from "./perf-baseline.mjs";

const OUT = "output/playwright/synthetic-style-write";
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
    const label = (await items.nth(i).innerText()) ?? "";
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
          // 팔레트는 Components 페이지 origin 의 instance (`ref`) 를 만든다 (ADR-234 · 237).
          .elements.find(
            (e) => (e.type === t || e.type === "ref") && !before.includes(e.id),
          )?.id ?? null,
      { t: type, before },
      { timeout: 15_000 },
    )
    .then((h) => h.jsonValue())
    .catch(async () => {
      console.error(
        "added types",
        await page.evaluate(
          (before) =>
            window.__composition_STORE__
              .getState()
              .elements.filter((e) => !before.includes(e.id))
              .map((e) => e.type),
          before,
        ),
      );
      return null;
    });
  await page.waitForTimeout(800);
  await setPanel(page, "components", false);
  return id;
}

/** 요소의 props 를 교체한다 (style 은 통째로). 사용자 경로가 아닌 시드 — 옛 토글이 남긴 인라인 재현용. */
async function seed(page, id, props) {
  await page.evaluate(
    ({ id, props }) =>
      window.__composition_STORE__.getState().updateElementProps(id, props),
    { id, props },
  );
  await page.waitForTimeout(900);
}

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  storageState: resolve("apps/builder/scripts/.auth-session.json"),
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const report = { checks: {}, errors };
await mkdir(OUT, { recursive: true });

try {
  await page.goto(`${process.env.BUILDER_URL ?? "http://localhost:5173"}/dashboard`, { waitUntil: "networkidle" });
  await page.locator("button.dashboard-create-button").first().click();
  const name = page.locator("#new-project-name");
  await name.fill("synthetic-style-write");
  await name.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90000 });
  await waitReady(page);
  await page.bringToFront();
  const bodyId = await page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    return st.elements.find((e) => e.type === "body" && e.page_id === st.currentPageId)?.id;
  });

  const formId = await addFromPalette(page, "Form", bodyId);
  const childId = await page.evaluate((formId) => {
    const lm = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    return (
      [...lm.keys()]
        .filter((k) => k.startsWith(`${formId}/`) && /\/component-textfield__1$/.test(k))
        .map((k) => k.slice(0, k.lastIndexOf("/")))
        .sort((a, b) => a.length - b.length)[0] ?? null
    );
  }, formId);
  const r = (report.checks = { formId, childId });
  const readPatch = () =>
    page.evaluate(
      ({ formId, childId }) => {
        const form = window.__composition_STORE__.getState().elementsMap.get(formId);
        return form?.descendants?.[childId.slice(formId.length + 1)] ?? null;
      },
      { formId, childId },
    );
  const readRect = () =>
    page.evaluate((childId) => {
      const box = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().get(childId);
      return box ? { h: Math.round(box.height) } : null;
    }, childId);

  await page.evaluate((id) => window.__composition_STORE__.getState().setSelectedElement(id), childId);
  await setPanel(page, "styles", true);
  await page.waitForTimeout(800);
  r.before = { patch: await readPatch(), rect: await readRect() };

  // 1. Fill 추가 — patch 는 fills 만 (origin style 복사 없음).
  await page.locator(".styles-panel-groups [role='tab']").nth(1).click();
  await page.waitForTimeout(600);
  await page.locator("button[aria-label='Add fill']").first().click();
  await page.waitForTimeout(900);
  r.afterFill = await readPatch();

  // 2. Fill reset — patch 의 fills 가 지워진다 (origin 복귀).
  await page.locator("[data-section-id='fill'] .section-actions button").first().click();
  await page.waitForTimeout(900);
  r.afterFillReset = await readPatch();

  // 3. Spacing — padding 편집은 그 키만, reset 은 그 키를 지운다.
  await page.locator(".styles-panel-groups [role='tab']").nth(0).click();
  await page.waitForTimeout(600);
  await page.evaluate(() =>
    window.__composition_STORE__.getState().updateSelectedStyle("paddingTop", "24px"),
  );
  await page.waitForTimeout(900);
  r.afterPadding = { patch: await readPatch(), rect: await readRect() };
  const resetButton = page.locator("[data-section-id='spacing'] .section-actions button").first();
  r.spacingResetVisible = await resetButton.isVisible();
  await resetButton.click();
  await page.waitForTimeout(900);
  r.afterSpacingReset = { patch: await readPatch(), rect: await readRect() };
  await page.screenshot({ path: `${OUT}/after-reset.png` });
} finally {
  await writeFile(`${OUT}/report.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
}

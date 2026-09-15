import { chromium } from "playwright";
import { resolve } from "node:path";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1400 } })).newPage();
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`ar-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name) => { await page.getByRole("button", { name, exact: true }).first().click(); await page.waitForTimeout(400); };
const P = '[data-panel-id="properties"]';
const aria = () => page.evaluate((P) => Boolean(Array.from(document.querySelectorAll(`${P} legend`)).find((l) => l.textContent.trim() === "Aria Label")), P);
for (const name of ["button", "progress bar", "text", "tabs", "text field", "checkbox"]) {
  await panel("Components");
  await page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: new RegExp(`^${name}$`, "i") }) }).first().click(); await page.waitForTimeout(900);
  await panel("Components").catch(() => {});
  if (!(await page.locator(`${P} .panel-contents`).isVisible().catch(() => false))) await panel("Properties");
  await page.waitForTimeout(400);
  await page.evaluate((P) => { document.querySelectorAll(`${P} .section-caret[aria-expanded="false"]`).forEach((c) => c.click()); }, P); await page.waitForTimeout(300);
  const before = await aria();
  let after = null;
  if (name === "progress bar" || name === "text field") {
    const st = await page.evaluate(() => { const s = window.__composition_STORE__.getState(); return s.selectedElementId; });
    const lbl = await page.evaluate(() => { const s = window.__composition_STORE__.getState(); return s.elements.find((e) => e.id === s.selectedElementId)?.props?.label; });
    await page.evaluate(() => window.__composition_STORE__.getState().updateSelectedProperties({ label: "" })); await page.waitForTimeout(500);
    after = `label was ${JSON.stringify(lbl)} → cleared: ${await aria()}`;
  }
  if (name === "button") {
    // 텍스트 자식 삭제 → 아이콘 전용 → Aria Label 등장
    const ch = await page.evaluate(() => { const s = window.__composition_STORE__.getState(); const el = s.elements.find((e) => e.id === s.selectedElementId); return { children: el?.props?.children, textChild: s.elements.some((e) => e.parent_id === el.id && e.type === "Text") }; });
    await page.evaluate(() => window.__composition_STORE__.getState().updateSelectedProperties({ children: "" })); await page.waitForTimeout(600);
    after = `${JSON.stringify(ch)} → children cleared: ${await aria()}`;
  }
  console.log(name, "aria:", before, after === null ? "" : `→ ${after}`);
}
await browser.close();

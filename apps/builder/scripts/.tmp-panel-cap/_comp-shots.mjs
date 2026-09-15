import { chromium } from "playwright";
import { resolve } from "node:path";
const OUT = process.env.OUT;
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`cs-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name, want) => { const btn = page.getByRole("button", { name, exact: true }).first(); const pressed = await btn.getAttribute("aria-pressed"); if ((pressed === "true") !== want) { await btn.click(); await page.waitForTimeout(400); } };
const P = '[data-panel-id="properties"]';
await panel("Components", true);
const item = page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: /^Button$/i }) }).first();
await item.scrollIntoViewIfNeeded(); await item.click(); await page.waitForTimeout(900);
await panel("Components", false); await panel("Properties", true); await page.waitForTimeout(400);
const shot = async (name) => {
  await page.evaluate((P) => { document.querySelectorAll(`${P} .section-caret[aria-expanded="false"]`).forEach((c) => c.click()); }, P); await page.waitForTimeout(300);
  const sec = page.locator(`${P} .section`).filter({ has: page.locator(".section-title", { hasText: /^Component$/ }) }).first();
  const box = await sec.boundingBox(); console.log(name, JSON.stringify(box));
  await sec.screenshot({ path: `${OUT}/${name}.png` });
  const rows = await sec.evaluate((s) => Array.from(s.querySelectorAll(".section-content > *")).map((r) => `${r.className}:${Math.round(r.getBoundingClientRect().height)}:${r.textContent.trim().slice(0,40)}`)); console.log(rows.join("\n"));
};
await shot("standard");
// origin
const originId = await page.evaluate(() => window.__composition_STORE__.getState().selectedElementId);
await page.evaluate(async (id) => { await window.__composition_STORE__.getState().toggleComponentOrigin(id); }, originId); await page.waitForTimeout(600);
await shot("origin-0");
// instance
const inst = await page.evaluate((id) => { const st = window.__composition_STORE__.getState(); const el = st.elements.find((e) => e.id === id); const body = st.elements.find((e) => e.page_id === st.currentPageId && e.type.toLowerCase() === "body"); const n = st.createInstance(id, body?.id ?? el.parent_id, st.currentPageId); return n?.id; }, originId); await page.waitForTimeout(600);
await page.evaluate((id) => { window.__composition_STORE__.getState().setSelectedElement(id); }, originId); await page.waitForTimeout(500);
await shot("origin-1");
await page.evaluate((id) => { window.__composition_STORE__.getState().setSelectedElement(id); }, inst); await page.waitForTimeout(500);
await shot("instance");
// instance with override
await page.evaluate((id) => { window.__composition_STORE__.getState().updateElementProps(id, { children: "Save changes" }); }, inst); await page.waitForTimeout(600);
await shot("instance-override");
// geometry of the strip
const geo = await page.evaluate((P) => { const sec = Array.from(document.querySelectorAll(`${P} .section`)).find((s) => s.querySelector(".section-title")?.textContent.trim() === "Component"); const strip = sec.querySelector(".component-semantics-strip"); const r = strip.getBoundingClientRect(); const bs = Array.from(strip.querySelectorAll("button")).map((b) => { const q = b.getBoundingClientRect(); return `${b.getAttribute("aria-label") ?? b.textContent.trim()} ${Math.round(q.width)}×${Math.round(q.height)}`; }); const chip = sec.querySelector(".component-semantics-identity"); const cs = getComputedStyle(chip); return { strip: `${Math.round(r.width)}×${Math.round(r.height)} right=${Math.round(r.right)}`, buttons: bs, chip: `${cs.borderStyle} ${cs.borderColor} bg=${cs.backgroundColor}` }; }, P); console.log("geo", JSON.stringify(geo));
// tooltip on hover (Detach instance)
const db = page.locator(`${P} button[aria-label="Detach instance"]`); const bb = await db.boundingBox(); await page.mouse.move(bb.x - 40, bb.y + 14); await page.mouse.move(bb.x + 10, bb.y + 14, { steps: 8 }); await page.waitForTimeout(1600);
const tip = await page.evaluate(() => document.querySelector('[role="tooltip"]')?.textContent?.trim()); console.log("tooltip", tip);
await page.screenshot({ path: `${OUT}/tooltip.png`, clip: { x: 1300, y: 80, width: 300, height: 260 } });
// click Go to component -> selects origin
await page.locator(`${P} button[aria-label="Go to component"]`).click(); await page.waitForTimeout(500);
console.log("after go-to", await page.evaluate((id) => window.__composition_STORE__.getState().selectedElementId === id, originId));
// origin: select instances via badge button
await page.locator(`${P} button[aria-label^="Select instances"]`).click(); await page.waitForTimeout(500);
console.log("after select-instances", await page.evaluate((id) => { const st = window.__composition_STORE__.getState(); return { sel: st.selectedElementIds, isInst: st.selectedElementIds.includes(id) }; }, inst));
// instance: create component (labeled) -> dual
await page.evaluate((id) => { window.__composition_STORE__.getState().setSelectedElement(id); }, inst); await page.waitForTimeout(400);
await page.locator(`${P} .component-semantics-strip button:has-text("Create component")`).click(); await page.waitForTimeout(600);
await shot("dual");
// dual: detach component (labeled)
await page.locator(`${P} .component-semantics-strip button:has-text("Detach component")`).click(); await page.waitForTimeout(600);
await shot("instance-after-detach-component");
// detach instance -> confirm dialog
await page.locator(`${P} button[aria-label="Detach instance"]`).click(); await page.waitForTimeout(600);
const dlg = await page.evaluate(() => document.querySelector('[role="dialog"], [role="alertdialog"]')?.textContent?.trim().slice(0, 80)); console.log("dialog", dlg);
console.log("dialog buttons", await page.evaluate(() => Array.from(document.querySelectorAll('[role="dialog"] button, [role="alertdialog"] button')).map((b) => b.textContent.trim())));
const confirmBtn = page.locator('[role="dialog"] button, [role="alertdialog"] button').filter({ hasText: /^Continue$/ }).last(); if (await confirmBtn.count()) { await confirmBtn.click(); await page.waitForTimeout(800); }
console.log("after detach-instance role", await page.evaluate((id) => { const el = window.__composition_STORE__.getState().elementsMap.get(id); return { type: el?.type, ref: el?.ref, role: el?.componentRole }; }, inst));
await shot("standard-after-detach");
console.log("errors", errors.slice(0, 5));
await browser.close();

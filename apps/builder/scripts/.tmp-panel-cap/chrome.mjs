import { chromium } from "playwright";
import { resolve } from "node:path";
const BASE_URL = "http://localhost:5173";
const OUT = process.env.OUT;
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const ctx = await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.error("[page error]", e.message));
const shot = async (name, loc) => { try { if (loc) await loc.screenshot({ path: `${OUT}/${name}.png` }); else await page.screenshot({ path: `${OUT}/${name}.png` }); console.log("[shot]", name); } catch (e) { console.log("[miss]", name, e.message.split("\n")[0]); } };
const esc = async () => { await page.keyboard.press("Escape"); await page.waitForTimeout(300); };
await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await shot("dashboard");
const btn = page.locator("button.dashboard-create-button").first();
await btn.waitFor({ state: "visible", timeout: 15_000 });
await btn.click();
const input = page.locator("#new-project-name");
await input.waitFor({ state: "visible", timeout: 10_000 });
await shot("dashboard-create-dialog");
await input.fill(`chrome-cap-${Date.now()}`);
await input.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60_000 });
await page.waitForFunction(READY, undefined, { timeout: 90_000 });
await page.waitForTimeout(1500);
await page.evaluate(async () => {
  const st = window.__composition_STORE__.getState();
  const body = st.elements.find(e => e.type === "body" && e.page_id === st.currentPageId) ?? st.elements.find(e => e.type === "body");
  const now = new Date().toISOString(); const id = crypto.randomUUID();
  await st.addElement({ id, type: "Button", parent_id: body.id, page_id: body.page_id, order_num: 99, created_at: now, updated_at: now, props: { children: "Primary action", variant: "primary" } }, { skipHistory: true });
  await new Promise(r => setTimeout(r, 800));
  const st2 = window.__composition_STORE__.getState();
  st2.setSelectedElement(id, st2.elements.find(e => e.id === id)?.props);
});
await page.waitForTimeout(800);
await shot("builder-full");
await shot("header", page.locator("header.header").first());
await shot("action-bar", page.locator(".contextual-action-bar").first());
// header menu
await page.locator(".header-menu-button").first().click(); await page.waitForTimeout(400);
await shot("header-menu", page.locator(".header-menu-popover").first()); await esc();
// zoom popover
const zoom = page.locator(".zoom-trigger-button").first();
if (await zoom.count()) { await zoom.click(); await page.waitForTimeout(400); await shot("zoom-menu", page.locator(".react-aria-Popover").first()); await esc(); }
// tooltip: hover a header button
const hb = page.locator("header .builder-control-group button").first();
await hb.hover(); await page.waitForTimeout(1200); await shot("tooltip-region", page.locator("header").first()); await page.mouse.move(800, 500);
// action bar popovers
const abItems = page.locator(".contextual-action-bar-item");
console.log("[actionbar items]", await abItems.count());
for (let i = 0; i < await abItems.count(); i++) {
  await abItems.nth(i).hover(); await page.waitForTimeout(900);
  await shot(`actionbar-hover-${i}`, page.locator(".contextual-action-bar").first());
  await abItems.nth(i).click(); await page.waitForTimeout(400);
  const pop = page.locator(".react-aria-Popover, [role=dialog]").last();
  if (await pop.count() && await pop.isVisible()) await shot(`actionbar-pop-${i}`, pop);
  await esc();
}
// context menu on the canvas center
const canvas = page.locator('[data-testid="skia-canvas-unified"]').first();
const bb = await canvas.boundingBox();
await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2, { button: "right" }); await page.waitForTimeout(500);
await shot("context-menu", page.locator(".context-menu-popover, .react-aria-Popover").first()); await esc();
// command palette
await page.evaluate(() => window.dispatchEvent(new Event("open-command-palette"))); await page.waitForTimeout(500);
await shot("command-palette", page.locator(".command-palette, [class*=command-palette]").first()); await esc();
// toast
await page.evaluate(async () => { try { const m = await import("/src/builder/stores/toast.ts"); m.useToastStore.getState().showToast("success", "요소를 이동했습니다", { action: { label: "되돌리기", onClick: () => {} }, bypassCooldown: true, duration: 20000 }); m.useToastStore.getState().showToast("error", "저장에 실패했습니다 — 네트워크 없음", { bypassCooldown: true, duration: 20000 }); } catch (e) { console.log(e); } });
await page.waitForTimeout(600);
await shot("toast-region", page.locator("[class*=toast]").first());
// panel toggle rail + status
await shot("panel-rail", page.locator("[class*=panel-toggle], .panel-toggle-group").first());
await shot("status", page.locator("[class*=status-indicator], [class*=WorkspaceStatus], .workspace-status").first());
// pages / layers panel add page dialog
for (const label of ["Pages", "Navigator", "Settings", "Data", "Components", "Theme", "History", "AI"]) {
  const b = page.getByRole("button", { name: label, exact: true }).first();
  if (!(await b.count())) { console.log("[no panel]", label); continue; }
  await b.click(); await page.waitForTimeout(500);
  await shot(`panel-${label.toLowerCase()}`, page.locator(`[data-panel-id]`).last());
  await b.click(); await page.waitForTimeout(200);
}
// Styles fill color popover + property row menu
await page.getByRole("button", { name: "Styles", exact: true }).first().click(); await page.waitForTimeout(500);
const tabs = page.locator(".styles-panel-tab"); await tabs.nth(1).click(); await page.waitForTimeout(400);
const sw = page.locator('[data-panel-id="styles"] .swatch-icon-button, [data-panel-id="styles"] [class*=swatch]').first();
if (await sw.count()) { await sw.click(); await page.waitForTimeout(500); await shot("color-popover", page.locator(".react-aria-Popover, .fill-detail-popover").last()); await esc(); }
await page.mouse.click(bb.x + 40, bb.y + 40, { button: "right" }); await page.waitForTimeout(500);
await shot("context-menu-canvas-empty", page.locator(".context-menu-popover, .react-aria-Popover").first()); await esc();
// dark full
await page.evaluate(() => document.documentElement.setAttribute("data-builder-theme", "dark")); await page.waitForTimeout(500);
await shot("builder-full-dark");
await page.locator(".header-menu-button").first().click(); await page.waitForTimeout(400);
await shot("header-menu-dark", page.locator(".header-menu-popover").first()); await esc();
// class dump
const dump = await page.evaluate(() => {
  const q = (s) => Array.from(document.querySelectorAll(s)).slice(0, 3).map(el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return { cls: el.className.toString().slice(0, 60), w: Math.round(r.width), h: Math.round(r.height), fs: cs.fontSize, pad: cs.padding, gap: cs.gap, br: cs.borderRadius }; });
  return { header: q("header.header"), hbtn: q("header button"), zoom: q(".zoom-trigger-button"), ab: q(".contextual-action-bar"), abi: q(".contextual-action-bar-item"), rail: q("[class*=panel-toggle] button"), toast: q("[class*=toast-item], [class*=toast] > div"), status: q("[class*=status]"), tabs: q(".panel-tab"), searchf: q(".search-field, [class*=SearchField]") };
});
console.log(JSON.stringify(dump, null, 1));
await browser.close();

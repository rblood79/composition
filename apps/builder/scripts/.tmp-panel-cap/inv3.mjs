import { chromium } from "playwright";
import { resolve } from "node:path";
const OUT = process.env.OUT;
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 2 })).newPage();
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`inv3-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const addEl = (type, props) => page.evaluate(async ({ type, props }) => { const st = window.__composition_STORE__.getState(); const body = st.elements.find(e => e.type === "body" && e.page_id === st.currentPageId) ?? st.elements.find(e => e.type === "body"); const now = new Date().toISOString(); const id = crypto.randomUUID(); await st.addElement({ id, type, parent_id: body.id, page_id: body.page_id, order_num: 99, created_at: now, updated_at: now, props }, { skipHistory: true }); await new Promise(r => setTimeout(r, 800)); const st2 = window.__composition_STORE__.getState(); st2.setSelectedElement(id, st2.elements.find(e => e.id === id)?.props); return id; }, { type, props });
const M = (sel, n = 4) => page.evaluate(({ sel, n }) => Array.from(document.querySelectorAll(sel)).filter(el => el.getBoundingClientRect().width > 0).slice(0, n).map(el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return `${el.className.toString().replace(/react-aria-/g,'').slice(0, 44)} | ${Math.round(r.width)}×${Math.round(r.height)} fs${cs.fontSize} pad${cs.padding} gap${cs.gap} r${cs.borderRadius}`; }), { sel, n });
const out = {}; const rec = async (k, sel, n) => { try { out[k] = await M(sel, n); } catch (e) { out[k] = "ERR " + e.message.slice(0, 80); } };
const shot = async (n, loc) => { try { await loc.screenshot({ path: `${OUT}/${n}.png`, timeout: 8000 }); } catch (e) { console.log("[miss]", n, e.message.slice(0, 80)); } };
const step = async (name, fn) => { try { await fn(); } catch (e) { console.log("[fail]", name, e.message.slice(0, 120)); out["fail_" + name] = e.message.slice(0, 120); } };
const rail = (label) => page.getByRole("button", { name: label, exact: true }).first();
const panel = (id) => page.locator(`[data-panel-id="${id}"]`).last();
const fit = async (id) => { await page.evaluate((id) => { const p = document.querySelector(`[data-panel-id="${id}"]`); if (!p) return; p.querySelectorAll("*").forEach(el => { const cs = getComputedStyle(el); if (cs.overflowY === "auto" || cs.overflowY === "scroll") { el.style.overflow = "visible"; el.style.maxHeight = "none"; el.style.height = "auto"; } }); }, id); await page.waitForTimeout(250); };
const pshot = async (n, id) => { await fit(id); await shot(n, panel(id)); };
await addEl("Button", { children: "Primary action" });
await step("data", async () => {
  await rail("Data").click(); await page.waitForTimeout(600);
  await pshot("data-panel-empty", "datatable");
  await page.getByRole("button", { name: /add table/i }).first().click(); await page.waitForTimeout(900);
  await rec("creator_w", '[data-panel-id="datatableEditor"], [data-panel-id="datatableEditor"] .creator-methods, [data-panel-id="datatableEditor"] .creator-method, [data-panel-id="datatableEditor"] .creator-method svg, [data-panel-id="datatableEditor"] .creator-method span, [data-panel-id="datatableEditor"] .preset-card, [data-panel-id="datatableEditor"] .preset-card *', 20);
  await page.evaluate(() => { const p = document.querySelector('[data-panel-id="datatableEditor"]'); const w = p.closest("[style*=width]") || p; w.style.width = "560px"; p.style.width = "560px"; }); await page.waitForTimeout(500);
  await pshot("data-table-creator-560", "datatableEditor");
  for (const k of [2, 3, 4, 5]) { await panel("datatableEditor").locator(".creator-method").nth(k).click(); await page.waitForTimeout(500); await pshot(`data-table-creator-method${k}`, "datatableEditor"); }
  await panel("datatableEditor").locator(".creator-method").nth(1).click(); await page.waitForTimeout(300);
  await panel("datatableEditor").locator("input").first().fill("orders");
  await panel("datatableEditor").locator(".preset-card").nth(0).click(); await page.waitForTimeout(300);
  await panel("datatableEditor").getByRole("button", { name: /^create$/i }).last().click(); await page.waitForTimeout(1500);
  await pshot("data-table-editor-560", "datatableEditor");
  const gear = panel("datatableEditor").locator(".datatable-editor-settings").first(); if (await gear.count()) { await gear.click(); await page.waitForTimeout(600); await rec("editor_settings", ".react-aria-Popover :is(.react-aria-MenuItem, .react-aria-ListBoxItem, button, input, .fieldset-legend, [class*=setting])", 12); await shot("data-editor-settings", page.locator(".react-aria-Popover").last()); await page.keyboard.press("Escape"); await page.waitForTimeout(300); }
  const cm = panel("datatableEditor").locator(".datagrid-column-menu").nth(1); if (await cm.count()) { await cm.hover(); await cm.click({ force: true }); await page.waitForTimeout(600); await rec("column_menu", ".react-aria-Popover :is(.react-aria-MenuItem, .react-aria-ListBoxItem, button)", 10); await shot("data-column-menu", page.locator(".react-aria-Popover").last()); await page.keyboard.press("Escape"); await page.waitForTimeout(300); }
  await panel("datatable").locator(".panel-tab").nth(1).click(); await page.waitForTimeout(400);
  await page.getByRole("button", { name: /add api|add endpoint/i }).first().click(); await page.waitForTimeout(900);
  await pshot("data-api-creator-560", "datatableEditor");
  await panel("datatableEditor").locator("input").first().fill("users"); const urlIn = panel("datatableEditor").locator("input").nth(1); if (await urlIn.count()) await urlIn.fill("https://api.example.com/users");
  const cbtn = panel("datatableEditor").getByRole("button", { name: /^create$/i }).last(); await cbtn.click(); await page.waitForTimeout(1500);
  await rec("api_editor", '[data-panel-id="datatableEditor"] :is(.panel-header, .panel-tab, .panel-tablist, .fieldset-legend, input, .react-aria-Select, .react-aria-Button, .control-button, textarea, [class*=api-], [class*=request], [class*=response])', 30);
  await pshot("data-api-editor", "datatableEditor");
  const tabs = panel("datatableEditor").locator(".panel-tab"); const n = await tabs.count(); out.api_tabs = n; for (let t = 1; t < Math.min(n, 5); t++) { await tabs.nth(t).click(); await page.waitForTimeout(500); await pshot(`data-api-editor-tab${t}`, "datatableEditor"); }
  await panel("datatable").locator(".panel-tab").nth(2).click(); await page.waitForTimeout(400);
  await page.getByRole("button", { name: /add variable/i }).first().click(); await page.waitForTimeout(900);
  await pshot("data-var-creator-560", "datatableEditor");
  await panel("datatableEditor").locator("input").first().fill("count");
  await panel("datatableEditor").getByRole("button", { name: /^create$/i }).last().click(); await page.waitForTimeout(1000);
  await rec("var_editor", '[data-panel-id="datatableEditor"] :is(.panel-header, .fieldset-legend, input, .react-aria-Select, .react-aria-Button, .control-button, textarea, [class*=variable-])', 20);
  await pshot("data-var-editor", "datatableEditor");
  await pshot("data-panel-filled", "datatable");
});
await step("fontmgr", async () => {
  await rail("Styles").click(); await page.waitForTimeout(800);
  if (!(await panel("styles").locator(".styles-panel-tab").count())) { await rail("Styles").click(); await page.waitForTimeout(800); }
  await panel("styles").locator(".styles-panel-tab").nth(2).click(); await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Font Family" }).first().click(); await page.waitForTimeout(500);
  await rec("font_picker_full", ".font-picker-dialog :is(input, button, [role=option], .font-picker-item, [class*=filter], [class*=tab], [class*=font-picker-])", 14);
  await page.locator(".font-picker-manage").first().click(); await page.waitForTimeout(900);
  await rec("font_manager", ".font-manager-dialog :is(.font-manager-dialog-header, .font-manager-dialog-title, .font-manager-dialog-close, .font-manager-dialog-body, [class*=font-manager-], input, button, [role=row], .fieldset-legend)", 24);
  await shot("font-manager", page.locator(".font-manager-dialog").first());
  await page.keyboard.press("Escape"); await page.waitForTimeout(300); await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  await rail("Styles").click(); await page.waitForTimeout(200);
});
console.log(JSON.stringify(out, null, 1));
await browser.close();

import { chromium } from "playwright";
import { resolve } from "node:path";
const OUT = process.env.OUT;
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on("pageerror", e => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`inv-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const addEl = (type, props) => page.evaluate(async ({ type, props }) => { const st = window.__composition_STORE__.getState(); const body = st.elements.find(e => e.type === "body" && e.page_id === st.currentPageId) ?? st.elements.find(e => e.type === "body"); const now = new Date().toISOString(); const id = crypto.randomUUID(); await st.addElement({ id, type, parent_id: body.id, page_id: body.page_id, order_num: 99, created_at: now, updated_at: now, props }, { skipHistory: true }); await new Promise(r => setTimeout(r, 800)); const st2 = window.__composition_STORE__.getState(); st2.setSelectedElement(id, st2.elements.find(e => e.id === id)?.props); return id; }, { type, props });
const M = (sel, n = 4) => page.evaluate(({ sel, n }) => Array.from(document.querySelectorAll(sel)).filter(el => el.getBoundingClientRect().width > 0).slice(0, n).map(el => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return `${el.className.toString().replace(/react-aria-/g,'').slice(0, 44)} | ${Math.round(r.width)}×${Math.round(r.height)} fs${cs.fontSize} pad${cs.padding} gap${cs.gap} r${cs.borderRadius}`; }), { sel, n });
const out = {}; const rec = async (k, sel, n) => { try { out[k] = await M(sel, n); } catch (e) { out[k] = "ERR " + e.message.slice(0, 80); } };
const shot = async (n, loc) => { try { await loc.screenshot({ path: `${OUT}/${n}.png`, timeout: 8000 }); } catch (e) { console.log("[miss]", n, e.message.slice(0, 80)); } };
const step = async (name, fn) => { try { await fn(); } catch (e) { console.log("[fail]", name, e.message.slice(0, 120)); out["fail_" + name] = e.message.slice(0, 120); } };
const rail = (label) => page.getByRole("button", { name: label, exact: true }).first();
const panel = (id) => page.locator(`[data-panel-id="${id}"]`).last();

// 1) Frame preset — Navigator › Frames › + → Properties
await step("frame", async () => {
  await rail("Navigator").click(); await page.waitForTimeout(500);
  await panel("navigator").locator(".panel-tab").nth(1).click(); await page.waitForTimeout(400);
  await page.getByRole("button", { name: /add frame|frame 추가|새 frame/i }).first().click(); await page.waitForTimeout(900);
  await shot("nav-frames", panel("navigator"));
  await rail("Properties").click(); await page.waitForTimeout(700);
  await rec("frame_preset", '[data-panel-id="properties"] .list-subgroup-header, [data-panel-id="properties"] .list-subgroup-title, [data-panel-id="properties"] .list-group, [data-panel-id="properties"] .preset-card, [data-panel-id="properties"] .preset-preview-svg, [data-panel-id="properties"] .list-item-name, [data-panel-id="properties"] .list-item-badge', 10);
  await rec("frame_props_sections", '[data-panel-id="properties"] .panel-section-title, [data-panel-id="properties"] fieldset.properties-aria, [data-panel-id="properties"] .fieldset-legend, [data-panel-id="properties"] .section-header, [data-panel-id="properties"] .property-section', 12);
  await page.evaluate(() => { const p = document.querySelector('[data-panel-id="properties"]'); let el = p; while (el) { el.style.height = "auto"; el.style.maxHeight = "none"; el = el.parentElement; } });
  await page.waitForTimeout(300); await shot("props-frame-preset", panel("properties"));
  await rail("Properties").click(); await page.waitForTimeout(200);
  await panel("navigator").locator(".panel-tab").nth(0).click(); await page.waitForTimeout(400);
  await rail("Navigator").click(); await page.waitForTimeout(200);
});
// 2) Data — creators
await step("data", async () => {
  await rail("Data").click(); await page.waitForTimeout(600);
  await page.getByRole("button", { name: /add table/i }).first().click(); await page.waitForTimeout(900);
  await rec("table_creator", '[data-panel-id="datatableEditor"] .panel-header, [data-panel-id="datatableEditor"] input, [data-panel-id="datatableEditor"] .react-aria-TextField, [data-panel-id="datatableEditor"] label, [data-panel-id="datatableEditor"] .fieldset-legend, [data-panel-id="datatableEditor"] button, [data-panel-id="datatableEditor"] .preset-card, [data-panel-id="datatableEditor"] [class*=preset], [data-panel-id="datatableEditor"] [class*=creator]', 24);
  await shot("data-table-creator", panel("datatableEditor"));
  // create table with preset → editor grid
  const nameInput = panel("datatableEditor").locator("input").first(); await nameInput.fill("orders");
  const preset = panel("datatableEditor").locator("[class*=preset-card], [class*=preset-item], [role=radio], [role=option]").nth(1); if (await preset.count()) await preset.click();
  await page.waitForTimeout(300); await shot("data-table-creator-filled", panel("datatableEditor"));
  const submit = panel("datatableEditor").getByRole("button", { name: /create|만들기|생성|add/i }).last(); await submit.click(); await page.waitForTimeout(1200);
  await rec("table_editor", '[data-panel-id="datatableEditor"] .panel-header, [data-panel-id="datatableEditor"] [role=grid], [data-panel-id="datatableEditor"] [role=columnheader], [data-panel-id="datatableEditor"] [role=gridcell], [data-panel-id="datatableEditor"] [role=row], [data-panel-id="datatableEditor"] .panel-tab, [data-panel-id="datatableEditor"] button, [data-panel-id="datatableEditor"] input', 24);
  await shot("data-table-editor", panel("datatableEditor"));
  await shot("data-panel-list", panel("datatable"));
  const cell = panel("datatableEditor").locator("[role=gridcell]").first(); if (await cell.count()) { await cell.dblclick(); await page.waitForTimeout(400); await shot("data-cell-edit", panel("datatableEditor")); await page.keyboard.press("Escape"); }
  const ch = panel("datatableEditor").locator("[role=columnheader]").first(); if (await ch.count()) { await ch.click(); await page.waitForTimeout(500); await rec("field_panel", '[data-panel-id="datatableField"] *:is(.panel-header, fieldset, .fieldset-legend, input, select, button, .react-aria-Select, .react-aria-Button)', 20); await shot("data-field-panel", panel("datatableField")); }
  // API creator
  await panel("datatable").locator(".panel-tab").nth(1).click(); await page.waitForTimeout(400);
  await page.getByRole("button", { name: /add api|add endpoint/i }).first().click(); await page.waitForTimeout(900);
  await rec("api_creator", '[data-panel-id="datatableEditor"] :is(.panel-header, input, label, .fieldset-legend, button, .react-aria-Select, .react-aria-Button, .panel-tab, textarea, [class*=compact-select])', 30);
  await shot("data-api-creator", panel("datatableEditor"));
  // Variable creator
  await panel("datatable").locator(".panel-tab").nth(2).click(); await page.waitForTimeout(400);
  await page.getByRole("button", { name: /add variable/i }).first().click(); await page.waitForTimeout(900);
  await rec("var_creator", '[data-panel-id="datatableEditor"] :is(.panel-header, input, label, .fieldset-legend, button, .react-aria-Select, .react-aria-Button, textarea)', 20);
  await shot("data-var-creator", panel("datatableEditor"));
  await rail("Data").click(); await page.waitForTimeout(300);
});
// 3) Events (interactions) + Settings + Theme with Button selected
await addEl("Button", { children: "Primary action" });
for (const [label, id] of [["Events", "events"], ["Settings", "settings"], ["Theme", "theme"], ["History", "history"]]) {
  await step(label, async () => {
    await rail(label).click(); await page.waitForTimeout(700);
    await rec("panel_" + id, `[data-panel-id="${id}"] :is(.panel-header, .panel-tab, .panel-tablist, fieldset.properties-aria, .fieldset-legend, .react-aria-Button, button, input, .list-item, .section-header, [class*=rule], [class*=row])`, 24);
    await page.evaluate((id) => { let el = document.querySelector(`[data-panel-id="${id}"]`); while (el) { el.style.height = "auto"; el.style.maxHeight = "none"; el = el.parentElement; } }, id);
    await page.waitForTimeout(200); await shot("panel-" + id, panel(id));
    if (id === "events") { const add = panel(id).getByRole("button", { name: /add|추가/i }).first(); if (await add.count()) { await add.click(); await page.waitForTimeout(600); await rec("events_rule", `[data-panel-id="events"] :is([class*=rule], .react-aria-Select, .react-aria-Button, input, .fieldset-legend)`, 20); await shot("panel-events-rule", panel(id)); } }
    if (id === "history") { const mt = panel(id).locator(".react-aria-Button, button").filter({ hasText: /snapshot|⋯|more/i }).first(); if (await mt.count()) { await mt.click(); await page.waitForTimeout(400); await shot("history-menu", page); await page.keyboard.press("Escape"); } }
    await rail(label).click(); await page.waitForTimeout(200);
  });
}
// 4) Properties for Button — data binding popover · select listbox
await step("props-button", async () => {
  await rail("Properties").click(); await page.waitForTimeout(700);
  await page.evaluate(() => { let el = document.querySelector('[data-panel-id="properties"]'); while (el) { el.style.height = "auto"; el.style.maxHeight = "none"; el = el.parentElement; } });
  await shot("props-button", panel("properties"));
  const sel = panel("properties").locator(".react-aria-Select .react-aria-Button").first(); if (await sel.count()) { await sel.click(); await page.waitForTimeout(400); await rec("select_listbox", ".react-aria-Popover .react-aria-ListBox, .react-aria-Popover .react-aria-ListBoxItem", 4); await shot("props-select-listbox", page.locator(".react-aria-Popover").last()); await page.keyboard.press("Escape"); await page.waitForTimeout(200); }
  const db = panel("properties").locator("[class*=binding] .react-aria-Button, [class*=data-binding] button").first(); if (await db.count()) { await db.click(); await page.waitForTimeout(500); await rec("binding_pop", ".react-aria-Popover :is(.react-aria-ListBox, .react-aria-ListBoxItem, input, button, .fieldset-legend, [class*=binding])", 12); await shot("props-binding-popover", page.locator(".react-aria-Popover").last()); await page.keyboard.press("Escape"); }
  await rail("Properties").click(); await page.waitForTimeout(200);
});
// 5) Page body selected → Page properties (layout selector · parent)
await step("props-page", async () => {
  await page.evaluate(() => { const st = window.__composition_STORE__.getState(); const body = st.elements.find(e => e.type === "body" && e.page_id === st.currentPageId); st.setSelectedElement(body.id, body.props); });
  await page.waitForTimeout(500); await rail("Properties").click(); await page.waitForTimeout(700);
  await page.evaluate(() => { let el = document.querySelector('[data-panel-id="properties"]'); while (el) { el.style.height = "auto"; el.style.maxHeight = "none"; el = el.parentElement; } });
  await rec("page_props", '[data-panel-id="properties"] :is(.fieldset-legend, .react-aria-Button, button, input, [class*=layout], [class*=parent], .list-item)', 20);
  await shot("props-page-body", panel("properties"));
  await rail("Properties").click(); await page.waitForTimeout(200);
});
// 6) Chart element → Properties chart authoring
await step("chart", async () => {
  await addEl("Chart", {}); await page.waitForTimeout(600);
  await rail("Properties").click(); await page.waitForTimeout(800);
  await page.evaluate(() => { let el = document.querySelector('[data-panel-id="properties"]'); while (el) { el.style.height = "auto"; el.style.maxHeight = "none"; el = el.parentElement; } });
  await rec("chart_props", '[data-panel-id="properties"] :is(.fieldset-legend, [class*=chart] .react-aria-Button, [class*=chart] input, [class*=chart] button, [class*=chart-])', 20);
  await shot("props-chart", panel("properties"));
  await rail("Properties").click(); await page.waitForTimeout(200);
});
// 7) Font manager dialog (Styles › Text › Font Family › manage)
await step("fontmgr", async () => {
  await addEl("Button", { children: "Text" });
  await rail("Styles").click(); await page.waitForTimeout(500);
  await panel("styles").locator(".styles-panel-tab").nth(2).click(); await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Font Family" }).first().click(); await page.waitForTimeout(500);
  await rec("font_picker", ".font-picker-dialog :is(input, button, [role=option], [class*=filter], [class*=tab], .react-aria-ListBoxItem)", 12);
  await shot("font-picker", page.locator(".font-picker-dialog").first());
  const mg = page.locator(".font-picker-dialog button").filter({ hasText: /manage|add/i }).first(); const mg2 = page.locator('.font-picker-dialog [aria-label*="anage" i], .font-picker-dialog [aria-label*="Add" i]').first();
  const t = (await mg.count()) ? mg : mg2; if (await t.count()) { await t.click(); await page.waitForTimeout(700); await rec("font_manager", ".react-aria-Modal :is(.react-aria-Dialog, h2, h3, input, button, [role=row], [class*=font-manager], [class*=face])", 16); await shot("font-manager", page.locator(".react-aria-Modal, .react-aria-Dialog").last()); await page.keyboard.press("Escape"); await page.waitForTimeout(300); }
  await page.keyboard.press("Escape"); await page.waitForTimeout(200);
});
// 8) Workspace chrome: ruler · compare mode · workflow toggles · text edit overlay
await step("workspace", async () => {
  await rec("ruler", '[class*=ruler]', 4);
  await rec("ws_toggles", '[class*=workflow-canvas], [class*=compare], .workspace-status-indicator, [class*=WorkspaceCompare]', 6);
  const hdr = page.locator("header"); await shot("header-full", hdr);
});
out.errors = errors.slice(0, 5);
console.log(JSON.stringify(out, null, 1));
await browser.close();

import { chromium } from "playwright";
import { resolve } from "node:path";
const OUT = process.env.OUT;
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 2200 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on("pageerror", e => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`inv2-${Date.now()}`); await i.press("Enter");
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

await step("frame", async () => {
  await rail("Navigator").click(); await page.waitForTimeout(500);
  await panel("navigator").locator(".panel-tab").nth(1).click(); await page.waitForTimeout(400);
  await page.getByRole("button", { name: /add frame|frame 추가/i }).first().click(); await page.waitForTimeout(900);
  await pshot("nav-frames", "navigator");
  await rail("Properties").click(); await page.waitForTimeout(700);
  await pshot("props-frame-preset", "properties");
  const card = panel("properties").locator(".preset-card").nth(1); await card.click(); await page.waitForTimeout(600); await pshot("props-frame-preset-applied", "properties");
  await rec("frame_after", '[data-panel-id="properties"] :is(.list-item-badge, [class*=slot], .fieldset-legend, .control-button)', 12);
  await rail("Properties").click(); await page.waitForTimeout(200);
  await panel("navigator").locator(".panel-tab").nth(0).click(); await page.waitForTimeout(400);
  await rail("Navigator").click(); await page.waitForTimeout(200);
});
await step("data", async () => {
  await rail("DataTable").click().catch(() => rail("Data").click()); await page.waitForTimeout(600);
  await page.getByRole("button", { name: /add table/i }).first().click(); await page.waitForTimeout(900);
  await pshot("data-table-creator", "datatableEditor");
  const method = panel("datatableEditor").locator(".creator-method").nth(1); if (await method.count()) { await method.click(); await page.waitForTimeout(500); await pshot("data-table-creator-method2", "datatableEditor"); await panel("datatableEditor").locator(".creator-method").nth(0).click(); await page.waitForTimeout(300); }
  await panel("datatableEditor").locator("input").first().fill("orders");
  const preset = panel("datatableEditor").locator(".preset-card").nth(1); if (await preset.count()) await preset.click();
  await page.waitForTimeout(300); await pshot("data-table-creator-filled", "datatableEditor");
  await panel("datatableEditor").getByRole("button", { name: /^create$/i }).last().click(); await page.waitForTimeout(1200);
  await pshot("data-table-editor", "datatableEditor"); await pshot("data-panel-list", "datatable");
  const gear = panel("datatableEditor").locator(".datatable-editor-settings").first(); if (await gear.count()) { await gear.click(); await page.waitForTimeout(500); await rec("editor_settings", ".react-aria-Popover :is(.react-aria-MenuItem, .react-aria-ListBoxItem, button, input, .fieldset-legend)", 10); await shot("data-editor-settings", page.locator(".react-aria-Popover").last()); await page.keyboard.press("Escape"); await page.waitForTimeout(200); }
  const cm = panel("datatableEditor").locator(".datagrid-column-menu").first(); if (await cm.count()) { await cm.click({ force: true }); await page.waitForTimeout(500); await rec("column_menu", ".react-aria-Popover :is(.react-aria-MenuItem, .react-aria-ListBoxItem, button)", 10); await shot("data-column-menu", page.locator(".react-aria-Popover").last()); await page.keyboard.press("Escape"); await page.waitForTimeout(200); }
  const ch = panel("datatableEditor").locator(".datagrid-column-type").first(); if (await ch.count()) { await ch.click(); await page.waitForTimeout(700); await rec("field_panel", '[data-panel-id="datatableField"] :is(.panel-header, fieldset, .fieldset-legend, input, .react-aria-Select, .react-aria-Button, .control-button, [class*=field-])', 20); await pshot("data-field-panel", "datatableField"); }
  const cell = panel("datatableEditor").locator("[role=gridcell]").nth(1); if (await cell.count()) { await cell.dblclick(); await page.waitForTimeout(400); await rec("cell_edit", '[data-panel-id="datatableEditor"] [role=gridcell] :is(input, select, .react-aria-Button, [class*=compact])', 6); await pshot("data-cell-edit", "datatableEditor"); await page.keyboard.press("Escape"); }
  const imp = panel("datatableEditor").getByRole("button", { name: /import/i }).first(); if (await imp.count()) { await imp.click(); await page.waitForTimeout(600); await rec("import", '[data-panel-id="datatableEditor"] :is([class*=import], textarea, .control-button)', 10); await pshot("data-import", "datatableEditor"); await page.keyboard.press("Escape"); await page.waitForTimeout(200); }
  await panel("datatable").locator(".panel-tab").nth(1).click(); await page.waitForTimeout(400);
  await page.getByRole("button", { name: /add api|add endpoint/i }).first().click(); await page.waitForTimeout(900);
  await pshot("data-api-creator", "datatableEditor");
  const csel = panel("datatableEditor").locator(".react-aria-Select .react-aria-Button").first(); if (await csel.count()) { await csel.click(); await page.waitForTimeout(400); await shot("data-api-method-list", page.locator(".react-aria-Popover").last()); await page.keyboard.press("Escape"); await page.waitForTimeout(200); }
  await panel("datatableEditor").locator("input").first().fill("users"); const urlIn = panel("datatableEditor").locator("input").nth(1); if (await urlIn.count()) await urlIn.fill("https://api.example.com/users");
  const cbtn = panel("datatableEditor").getByRole("button", { name: /^create$/i }).last(); if (await cbtn.count()) { await cbtn.click(); await page.waitForTimeout(1200); await rec("api_editor", '[data-panel-id="datatableEditor"] :is(.panel-header, .panel-tab, .panel-tablist, .fieldset-legend, input, .react-aria-Select, .react-aria-Button, .control-button, textarea, [class*=api-])', 30); await pshot("data-api-editor", "datatableEditor"); const tabs = panel("datatableEditor").locator(".panel-tab"); const n = await tabs.count(); for (let t = 1; t < Math.min(n, 5); t++) { await tabs.nth(t).click(); await page.waitForTimeout(500); await pshot(`data-api-editor-tab${t}`, "datatableEditor"); } }
  await panel("datatable").locator(".panel-tab").nth(2).click(); await page.waitForTimeout(400);
  await page.getByRole("button", { name: /add variable/i }).first().click(); await page.waitForTimeout(900);
  await pshot("data-var-creator", "datatableEditor");
  await panel("datatableEditor").locator("input").first().fill("count");
  const vbtn = panel("datatableEditor").getByRole("button", { name: /^create$/i }).last(); if (await vbtn.count()) { await vbtn.click(); await page.waitForTimeout(1000); await rec("var_editor", '[data-panel-id="datatableEditor"] :is(.panel-header, .fieldset-legend, input, .react-aria-Select, .react-aria-Button, .control-button, textarea)', 20); await pshot("data-var-editor", "datatableEditor"); }
  await rail("DataTable").click().catch(() => {}); await page.waitForTimeout(300);
});
await addEl("Button", { children: "Primary action" });
await step("interactions", async () => {
  await rail("Interactions").click(); await page.waitForTimeout(700);
  await rec("panel_events", `[data-panel-id="events"] :is(.panel-header, .section-header, .fieldset-legend, .react-aria-Button, .control-button, input, [class*=rule], [class*=empty])`, 20);
  await pshot("panel-interactions", "events");
  const add = panel("events").getByRole("button", { name: /add|추가|new/i }).first(); if (await add.count()) { await add.click(); await page.waitForTimeout(700); await rec("events_rule", `[data-panel-id="events"] :is([class*=rule], .react-aria-Select, .react-aria-Button, input, .fieldset-legend, .control-button)`, 24); await pshot("panel-interactions-rule", "events"); const s = panel("events").locator(".react-aria-Select .react-aria-Button").first(); if (await s.count()) { await s.click(); await page.waitForTimeout(400); await shot("interactions-trigger-list", page.locator(".react-aria-Popover").last()); await page.keyboard.press("Escape"); } }
  await rail("Interactions").click(); await page.waitForTimeout(200);
});
await step("settings", async () => {
  await page.locator(".header-menu-button").first().click(); await page.waitForTimeout(400);
  await page.getByRole("menuitem", { name: /settings/i }).first().click(); await page.waitForTimeout(800);
  await rec("panel_settings", `[data-panel-id="settings"] :is(.panel-header, .section-header, .fieldset-legend, .react-aria-Button, .control-button, input, .react-aria-Switch, [class*=switch], [class*=toggle], .panel-tab)`, 24);
  await pshot("panel-settings", "settings");
  const tabs = panel("settings").locator(".panel-tab"); const n = await tabs.count(); for (let t = 1; t < Math.min(n, 4); t++) { await tabs.nth(t).click(); await page.waitForTimeout(400); await pshot(`panel-settings-tab${t}`, "settings"); }
});
await step("fontmgr", async () => {
  await rail("Styles").click(); await page.waitForTimeout(500);
  await panel("styles").locator(".styles-panel-tab").nth(2).click(); await page.waitForTimeout(400);
  await page.getByRole("button", { name: "Font Family" }).first().click(); await page.waitForTimeout(500);
  await page.locator(".font-picker-manage").first().click(); await page.waitForTimeout(800);
  await rec("font_manager", ".react-aria-ModalOverlay :is(.react-aria-Dialog, h2, h3, input, button, [role=row], [class*=font-manager], [class*=face], [class*=drop], .fieldset-legend)", 16);
  await shot("font-manager", page.locator(".react-aria-ModalOverlay, .react-aria-Modal").last());
  await page.keyboard.press("Escape"); await page.waitForTimeout(300); await page.keyboard.press("Escape");
});
await step("shadow-transform", async () => {
  await panel("styles").locator(".styles-panel-tab").nth(1).click(); await page.waitForTimeout(400);
  await pshot("styles-style-tab-full", "styles");
});
await step("agent-confirm", async () => {
  await rail("AI").click(); await page.waitForTimeout(600); await pshot("panel-ai", "ai"); await rail("AI").click();
});
await step("compare", async () => {
  const cmp = page.locator('header [aria-label*="ompare" i], header [title*="ompare" i]').first(); if (await cmp.count()) { await cmp.click(); await page.waitForTimeout(800); await rec("compare", '[class*=compare], iframe', 6); await page.screenshot({ path: `${OUT}/workspace-compare.png`, clip: { x: 0, y: 0, width: 1600, height: 900 } }); await cmp.click(); }
  const ruler = page.locator('header [aria-label*="uler" i], header [title*="uler" i]').first(); if (await ruler.count()) { await ruler.click(); await page.waitForTimeout(500); await page.screenshot({ path: `${OUT}/workspace-ruler.png`, clip: { x: 0, y: 0, width: 1600, height: 700 } }); await ruler.click(); }
  await rec("header_btns", 'header button', 30);
});
out.errors = errors.slice(0, 5);
console.log(JSON.stringify(out, null, 1));
await browser.close();

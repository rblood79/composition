// panel-ui 대조 3차 — 툴팁 2종 · 줌 메뉴 · 컨텍스트 메뉴 · ConfirmDialog · PropertyRowMenu 13 항목 · Frame Preset · 선택 라벨
import { chromium } from "playwright";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
const OUT = "/private/tmp/claude-501/-Users-admin-work-composition/f6bcc488-f176-4644-8364-3625704b801c/scratchpad/audit";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`audit3-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const report = [];
const log = (k, v) => { report.push(`\n## ${k}\n${typeof v === "string" ? v : JSON.stringify(v, null, 0)}`); console.log("##", k); writeFileSync(`${OUT}/report-3.md`, report.join("\n")); };
const M = (sel, n = 30) => page.evaluate(({ sel, n }) => Array.from(document.querySelectorAll(sel)).filter((el) => el.getBoundingClientRect().width > 0).slice(0, n).map((el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return `${el.tagName.toLowerCase()}.${el.className.toString().replace(/react-aria-/g, "").split(/\s+/).slice(0, 3).join(".")} "${(el.getAttribute("aria-label") || (el.childElementCount === 0 ? el.textContent.trim() : "")).slice(0, 24)}" ${Math.round(r.width)}×${Math.round(r.height)} @${Math.round(r.left)},${Math.round(r.top)} fs${parseFloat(cs.fontSize)} pad${cs.padding} r${cs.borderRadius} gap${cs.gap} maxH${cs.maxHeight} ov${cs.overflowY}`; }), { sel, n });
const shot = async (sel, name) => { try { await page.locator(sel).first().screenshot({ path: `${OUT}/${name}.png` }); } catch (e) { console.log("shot fail", name, e.message.slice(0, 80)); } };
const rail = async (name) => { await page.getByRole("button", { name, exact: true }).first().click(); await page.waitForTimeout(600); };

// 헤더 툴팁 (ActionTooltip / ShortcutTooltip)
await page.locator('header button[aria-label="Desktop"]').first().hover(); await page.waitForTimeout(1300);
log("header tooltip", await M("[role=tooltip], .action-tooltip, .shortcut-tooltip, [role=tooltip] kbd, .shortcut-tooltip-kbd, .action-tooltip-kbd"));
await shot("[role=tooltip]", "chrome-tooltip-header");
await page.mouse.move(700, 700); await page.waitForTimeout(400);
await page.locator("header .header-menu-button").first().hover(); await page.waitForTimeout(1300);
log("menu button tooltip", await M("[role=tooltip], .action-tooltip, .shortcut-tooltip, [role=tooltip] kbd"));
await page.mouse.move(700, 700); await page.waitForTimeout(400);
// 줌 메뉴
await page.locator(".zoom-chevron-button").first().click(); await page.waitForTimeout(500);
log("zoom menu", await M(".zoom-menu, [class*=zoom-menu], [class*=zoom-menu] [role=menuitem], [class*=zoom-menu] kbd, [class*=zoom] [role=separator], [class*=zoom-menu] hr"));
await shot("[class*=zoom-menu-popover], [class*=zoom-menu]", "chrome-zoom-menu");
await page.keyboard.press("Escape"); await page.waitForTimeout(300);
// Button 추가 후 요소 위 컨텍스트 메뉴 + 선택 라벨
await rail("Components");
const item = page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: /^button$/i }) }).first(); await item.scrollIntoViewIfNeeded(); await item.click(); await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Components", exact: true }).first().click().catch(() => {}); await page.waitForTimeout(300);
const btnId = await page.evaluate(async () => { const st = window.__composition_STORE__.getState(); const els = st.elements.filter((e) => e.page_id === st.currentPageId && e.type === "Button"); const el = els[els.length - 1]; st.setSelectedElement(el.id, el.props); await new Promise((r) => setTimeout(r, 300)); return el.id; });
const geo = await page.evaluate((id) => { const st = window.__composition_STORE__.getState(); const lm = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.()?.get(id); const pp = st.pagePositions?.[st.currentPageId]; return { lm: { x: lm.x, y: lm.y, w: lm.width, h: lm.height }, pp }; }, btnId);
await page.evaluate(({ x, y }) => window.__composition_APPLY_VIEWPORT__?.({ scale: 1, x: -x + 500, y: -y + 400 }), { x: geo.pp.x + geo.lm.x, y: geo.pp.y + geo.lm.y }); await page.waitForTimeout(700);
const cb = await page.locator('[data-testid="skia-canvas-unified"]').boundingBox();
await page.screenshot({ path: `${OUT}/canvas-selection-label.png`, clip: { x: cb.x + 400, y: cb.y + 300, width: 400, height: 260 } });
log("selection label", await page.evaluate(() => { const vp = window.__composition_VIEWPORT__?.(); return { vp, labels: Array.from(document.querySelectorAll("[class*=selection-label], [class*=dimension-label], [class*=selection]")).filter((e) => e.getBoundingClientRect().width > 0).map((e) => `${e.className.toString().slice(0, 40)} ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)} @${Math.round(e.getBoundingClientRect().left)},${Math.round(e.getBoundingClientRect().top)}`) }; }));
log("action bar", await M(".contextual-action-bar, .contextual-action-bar-toolbar, .contextual-action-bar-item, .contextual-action-bar-separator, .contextual-action-bar-name, [class*=contextual-action-bar-]", 14));
await page.mouse.click(cb.x + 500 + geo.lm.w / 2, cb.y + 400 + geo.lm.h / 2, { button: "right" }); await page.waitForTimeout(600);
log("context menu (element)", await M(".context-menu-popover, .context-menu, .context-menu-item, .context-menu-separator, .context-menu-item kbd, [role=menu], [role=menuitem]"));
await shot(".context-menu-popover, [role=menu]", "chrome-context-menu");
await page.keyboard.press("Escape"); await page.waitForTimeout(300);
// PropertyRowMenu — Screen 탭 tablet 「+」 (항목 13)
await rail("Styles"); await page.locator(".styles-panel-tab").nth(3).click(); await page.waitForTimeout(400);
await page.locator('header button[aria-label="Tablet"]').first().click(); await page.waitForTimeout(600);
await page.locator('[data-panel-id="styles"] .responsive-overrides .swatch-icon-button').first().click(); await page.waitForTimeout(500);
log("row menu 13 items", await M(".react-aria-Popover, .property-row-menu-popover, .react-aria-Menu.property-row-menu, .react-aria-Menu.property-row-menu .react-aria-MenuItem", 6));
await shot(".react-aria-Popover", "popover-row-menu-13");
await page.keyboard.press("Escape"); await page.waitForTimeout(300);
await page.locator('header button[aria-label="Desktop"]').first().click(); await page.waitForTimeout(300);
// Border 프리셋 ⋮ (항목 적음)
await page.locator(".styles-panel-tab").nth(1).click(); await page.waitForTimeout(400);
await page.locator('[data-panel-id="styles"] button[aria-label="Border width presets"]').first().click(); await page.waitForTimeout(500);
log("row menu few items", await M(".react-aria-Popover, .react-aria-Menu.property-row-menu, .react-aria-Menu.property-row-menu .react-aria-MenuItem", 6));
await page.keyboard.press("Escape"); await page.waitForTimeout(300);
// 단위 suffix 클릭 → 무엇이 열리나 (05 #3)
await page.locator(".styles-panel-tab").nth(0).click(); await page.waitForTimeout(400);
const suf = page.locator('[data-panel-id="styles"] .property-unit-input__suffix').first();
log("suffix count", await page.locator('[data-panel-id="styles"] .property-unit-input__suffix').count());
if (await suf.count()) { const bb = await suf.boundingBox(); await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.waitForTimeout(500); log("after suffix click", await M(".react-aria-Popover, .react-aria-ListBox, .react-aria-ListBoxItem", 8)); await page.keyboard.press("Escape"); }
// ConfirmDialog — 페이지 삭제 (Navigator › Pages › 설정 ⋯ › Delete)
await rail("Navigator");
await page.locator('[data-panel-id="navigator"] .panel-tab').filter({ hasText: /pages/i }).first().click(); await page.waitForTimeout(300);
await page.locator('[data-panel-id="navigator"] button[aria-label="Add Page"]').first().click(); await page.waitForTimeout(900);
log("after Add Page — dialogs", await M("[role=dialog], [role=alertdialog], .react-aria-Modal, .confirm-dialog, [class*=dialog]", 10));
await shot("[role=dialog], [role=alertdialog]", "dialog-add-page");
await page.keyboard.press("Escape"); await page.waitForTimeout(400);
const settingsBtn = page.locator('[data-panel-id="navigator"] button[aria-label^="Settings for"]').last();
if (await settingsBtn.count()) { await settingsBtn.click(); await page.waitForTimeout(500); log("page settings menu", await M("[role=menu], [role=menuitem], .react-aria-Popover", 12)); const del = page.locator("[role=menuitem]").filter({ hasText: /delete/i }).first(); if (await del.count()) { await del.click(); await page.waitForTimeout(700); log("confirm dialog", await M("[role=alertdialog], [role=dialog], .confirm-dialog, .confirm-dialog-header, .confirm-dialog-body, .confirm-dialog-actions, .confirm-dialog button, [role=alertdialog] button, [role=alertdialog] h2, [role=alertdialog] p", 14)); await shot("[role=alertdialog], [role=dialog]", "dialog-confirm"); await page.keyboard.press("Escape"); } else await page.keyboard.press("Escape"); }
// Frame Preset — Navigator › Frames › Add Frame → Properties
await page.locator('[data-panel-id="navigator"] .panel-tab').filter({ hasText: /frames/i }).first().click(); await page.waitForTimeout(300);
await page.locator('[data-panel-id="navigator"] button[aria-label="Add Frame"]').first().click(); await page.waitForTimeout(1500);
log("after Add Frame url", page.url());
await page.waitForFunction(READY, undefined, { timeout: 30000 }).catch(() => {});
const propsOpen = await page.locator('[data-panel-id="properties"]').isVisible().catch(() => false);
if (!propsOpen) await rail("Properties");
log("frame preset", await M('[data-panel-id="properties"] .panel-title, [data-panel-id="properties"] .section-header, [data-panel-id="properties"] .list-subgroup-header, [data-panel-id="properties"] .list-subgroup-count, [data-panel-id="properties"] .list-item.preset-card, [data-panel-id="properties"] .preset-card__name-row, [data-panel-id="properties"] .list-item-badge, [data-panel-id="properties"] .frame-slot-row', 24));
await shot('[data-panel-id="properties"]', "panel-frame-preset");
const left = page.locator('[data-panel-id="properties"] button').filter({ hasText: /Left Sidebar/ }).first(); if (await left.count()) { await left.click(); await page.waitForTimeout(1000); log("frame preset applied", await M('[data-panel-id="properties"] .list-item-badge, [data-panel-id="properties"] .frame-slot-row, [data-panel-id="properties"] .frame-slot-row__count, [data-panel-id="properties"] .section-header', 16)); await shot('[data-panel-id="properties"]', "panel-frame-preset-applied");
  const holy = page.locator('[data-panel-id="properties"] button').filter({ hasText: /Holy Grail/ }).first(); if (await holy.count()) { await holy.click(); await page.waitForTimeout(800); log("existing slots dialog", await M(".existing-slot-dialog, .existing-slot-dialog .confirm-dialog-header, .existing-slot-dialog__row, .existing-slot-dialog .confirm-dialog-actions, .existing-slot-dialog .control-button, [role=alertdialog]", 12)); await shot(".existing-slot-dialog, [role=alertdialog]", "dialog-existing-slots"); await page.keyboard.press("Escape"); } }
log("pageerrors", errors.slice(0, 5));
await browser.close();

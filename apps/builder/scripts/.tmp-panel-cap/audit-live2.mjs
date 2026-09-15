// panel-ui 대조 2차 — Data · Interactions · Settings · Frames/Frame Preset · Data creator · Font manager · Modified/Overrides · Effect 하단 · 색 RGBA/Gradient · 전체 높이 캡처
import { chromium } from "playwright";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
const OUT = "/private/tmp/claude-501/-Users-admin-work-composition/f6bcc488-f176-4644-8364-3625704b801c/scratchpad/audit";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1400 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`audit2-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const report = [];
const log = (k, v) => { report.push(`\n## ${k}\n${typeof v === "string" ? v : JSON.stringify(v, null, 0)}`); console.log("##", k); writeFileSync(`${OUT}/report-2.md`, report.join("\n")); };
const DUMP_SEL = "button, input, textarea, select, [role=slider], [role=switch], [role=radio], [role=tab], [role=option], [role=menuitem], [role=treeitem], [role=row], [role=group], legend, label, .section-header, .panel-tab, .panel-header, output, [class*=addrow], [class*=lrow], [class*=layer-row], [class*=row], [class*=card], [class*=list-item], [class*=chip], [class*=swatch], [class*=empty], [class*=drop], [class*=preset], [class*=stop], [class*=slot]";
const dump = (rootSel, max = 300) => page.evaluate(({ rootSel, max, DUMP_SEL }) => {
  const root = document.querySelector(rootSel); if (!root) return `no root ${rootSel}`;
  const rr = root.getBoundingClientRect(); const rows = [];
  for (const el of root.querySelectorAll(DUMP_SEL)) {
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    const label = el.getAttribute("aria-label") || (el.tagName === "INPUT" ? `[${el.value}]` : "") || (el.childElementCount === 0 ? el.textContent.trim().slice(0, 28) : el.querySelector("legend, .label, [class*=label], [class*=name], [class*=title]")?.textContent?.trim().slice(0, 24) || "");
    const cls = el.className?.toString?.().replace(/react-aria-/g, "").split(/\s+/).filter((c) => c && !/^(is-|data-)/.test(c)).slice(0, 3).join(".");
    rows.push(`${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${el.getAttribute("role") ? "[" + el.getAttribute("role") + "]" : ""} "${label}" ${Math.round(r.width)}×${Math.round(r.height)} @${Math.round(r.left - rr.left)},${Math.round(r.top - rr.top)} fs${parseFloat(cs.fontSize)}`);
    if (rows.length >= max) break;
  }
  return rows.join("\n");
}, { rootSel, max, DUMP_SEL });
// 전체 높이 캡처 — 스크롤 컨테이너를 펼친 뒤 요소 스크린샷, 되돌림
const fullShot = async (sel, name) => {
  try {
    await page.evaluate((sel) => { const root = document.querySelector(sel); if (!root) return; root.dataset.auditH = root.style.height; root.style.height = "auto"; root.style.maxHeight = "none"; root.style.overflow = "visible"; for (const el of root.querySelectorAll("*")) { const cs = getComputedStyle(el); if (/(auto|scroll)/.test(cs.overflowY) && el.scrollHeight > el.clientHeight) { el.dataset.auditOv = "1"; el.style.overflow = "visible"; el.style.height = "auto"; el.style.maxHeight = "none"; el.style.flex = "none"; } } }, sel);
    await page.waitForTimeout(150);
    await page.locator(sel).first().screenshot({ path: `${OUT}/${name}.png` });
    await page.evaluate((sel) => { const root = document.querySelector(sel); if (!root) return; root.style.height = root.dataset.auditH ?? ""; root.style.maxHeight = ""; root.style.overflow = ""; for (const el of root.querySelectorAll("[data-audit-ov]")) { el.style.overflow = ""; el.style.height = ""; el.style.maxHeight = ""; el.style.flex = ""; delete el.dataset.auditOv; } }, sel);
  } catch (e) { console.log("fullShot fail", name, e.message.slice(0, 100)); }
};
const shot = async (sel, name) => { try { await page.locator(sel).first().screenshot({ path: `${OUT}/${name}.png` }); } catch (e) { console.log("shot fail", name, e.message.slice(0, 80)); } };
const rail = async (name) => { await page.getByRole("button", { name, exact: true }).first().click(); await page.waitForTimeout(600); };
const addViaPalette = async (nameRe) => { await rail("Components"); const item = page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: nameRe }) }).first(); await item.scrollIntoViewIfNeeded(); await item.click(); await page.waitForTimeout(1500); await page.getByRole("button", { name: "Components", exact: true }).first().click().catch(() => {}); await page.waitForTimeout(300); };
const selectLast = (type) => page.evaluate(async (type) => { const st = window.__composition_STORE__.getState(); const els = st.elements.filter((e) => e.page_id === st.currentPageId && e.type.toLowerCase() === type.toLowerCase()); const el = els[els.length - 1]; st.setSelectedElement(el.id, el.props); await new Promise((r) => setTimeout(r, 300)); return el.id; }, type);
const P = '[data-panel-id="styles"]';

await addViaPalette(/^button$/i);
const btnId = await selectLast("Button"); await page.waitForTimeout(400);

// ① Styles — 수정 몇 개 넣고 Style 탭 전체 · Modified 탭 · Screen Overrides
await page.evaluate(() => window.__composition_STORE__.getState().updateSelectedStyles({ width: "160px", gap: "8px", borderRadius: "8px", backgroundColor: "#2563EB", color: "#FFFFFF", boxShadow: "0 4px 12px 0 rgba(0,0,0,0.25), inset 0 1px 0 0 rgba(255,255,255,0.2)", filter: "blur(2px)" }));
await page.waitForTimeout(600);
await rail("Styles");
for (const [t, name] of [[0, "layout"], [1, "style"], [2, "text"], [4, "modified"]]) {
  await page.locator(".styles-panel-tab").nth(t).click(); await page.waitForTimeout(500);
  await page.evaluate(() => { for (const h of document.querySelectorAll('[data-panel-id="styles"] .section-caret[aria-expanded="false"]')) h.click(); }); await page.waitForTimeout(300);
  await fullShot(P, `full-styles-${name}`);
  if (t === 1 || t === 4) log(`styles ${name} controls (modified)`, await dump(`${P} .panel-contents, ${P} .panel-content`));
}
// Screen 탭 — tablet 으로 전환 후 Overrides
await page.locator(".styles-panel-tab").nth(3).click(); await page.waitForTimeout(400);
const tabletBtn = page.locator('header button[aria-label*="Tablet" i], header button[aria-label*="tablet" i]').first();
if (await tabletBtn.count()) { await tabletBtn.click(); await page.waitForTimeout(600); }
else await page.evaluate(() => window.__composition_STORE__.getState().setActiveBreakpoint?.("tablet"));
await page.waitForTimeout(500);
log("screen tab (tablet) controls", await dump(`${P} .panel-contents, ${P} .panel-content`));
const addOverride = page.locator(`${P} .responsive-overrides button[aria-label*="Add" i], ${P} .responsive-overrides .swatch-icon-button`).first();
if (await addOverride.count()) { await addOverride.click(); await page.waitForTimeout(500); log("override add menu", await dump(".react-aria-Popover")); const first = page.locator(".react-aria-Popover [role=menuitem]").first(); if (await first.count()) { await first.click(); await page.waitForTimeout(600); } else await page.keyboard.press("Escape"); }
log("screen tab (tablet, override 1) controls", await dump(`${P} .panel-contents, ${P} .panel-content`));
await fullShot(P, "full-styles-screen-tablet");
const desktopBtn = page.locator('header button[aria-label*="Desktop" i]').first(); if (await desktopBtn.count()) { await desktopBtn.click(); await page.waitForTimeout(400); }

// ② 색 피커 RGBA 모드 · Gradient · Image
await page.locator(".styles-panel-tab").nth(1).click(); await page.waitForTimeout(400);
await page.locator(`${P} .section[data-section-id="fill"] .fill-layer-row__trigger`).first().click(); await page.waitForTimeout(700);
const rgba = page.locator(".react-aria-Popover .color-input-mode-selector__btn").filter({ hasText: /rgba/i }).first(); if (await rgba.count()) { await rgba.click(); await page.waitForTimeout(400); log("fill popover RGBA", await dump(".react-aria-Popover")); await shot(".react-aria-Popover", "popover-fill-rgba"); }
const grad = page.locator('.react-aria-Popover [aria-label="Gradient"], .react-aria-Popover [aria-label*="gradient" i]').first(); if (await grad.count()) { await grad.click(); await page.waitForTimeout(800); log("fill popover gradient", await dump(".react-aria-Popover")); await shot(".react-aria-Popover", "popover-fill-gradient"); }
const img = page.locator('.react-aria-Popover [aria-label="Image"], .react-aria-Popover [aria-label*="image" i]').first(); if (await img.count()) { await img.click(); await page.waitForTimeout(800); log("fill popover image", await dump(".react-aria-Popover")); await shot(".react-aria-Popover", "popover-fill-image"); }
await page.keyboard.press("Escape"); await page.waitForTimeout(300);
// Box shadow 행 클릭 → 팝오버 편집기
const shadowRow = page.locator(`${P} .section[data-section-id="effect"] [class*=shadow] button, ${P} .section[data-section-id="effect"] [class*=layer-row] button`).first();
if (await shadowRow.count()) { await shadowRow.click(); await page.waitForTimeout(700); log("shadow popover", await dump(".react-aria-Popover")); await shot(".react-aria-Popover", "popover-shadow"); await page.keyboard.press("Escape"); await page.waitForTimeout(300); }

// ③ Data · Interactions(events) · Settings · Components(full) · Theme(full) · Properties(full)
await rail("Properties"); await page.evaluate(() => { for (const h of document.querySelectorAll('[data-panel-id="properties"] .section-caret[aria-expanded="false"]')) h.click(); }); await page.waitForTimeout(300); await fullShot('[data-panel-id="properties"]', "full-properties"); await rail("Properties");
await rail("Components"); await fullShot('[data-panel-id="components"]', "full-components"); log("components headers", await page.evaluate(() => Array.from(document.querySelectorAll('[data-panel-id="components"] .section-header')).map((h) => h.textContent.trim().slice(0, 40)))); await rail("Components");
await rail("Theme"); await fullShot('[data-panel-id="theme"]', "full-theme"); await rail("Theme");
await rail("Data"); log("data panel", await dump('[data-panel-id="datatable"]')); await fullShot('[data-panel-id="datatable"]', "full-data");
const newTable = page.locator('[data-panel-id="datatable"] button').filter({ hasText: /new table|add table|table/i }).first();
const addBtn = page.locator('[data-panel-id="datatable"] button[aria-label*="Add" i], [data-panel-id="datatable"] button[aria-label*="New" i], [data-panel-id="datatable"] button[aria-label*="Create" i]').first();
if (await addBtn.count()) { await addBtn.click(); } else if (await newTable.count()) { await newTable.click(); }
await page.waitForTimeout(900);
log("data creator ids", await page.evaluate(() => Array.from(document.querySelectorAll("[data-panel-id]")).filter((p) => p.getBoundingClientRect().width > 0).map((p) => `${p.dataset.panelId} ${Math.round(p.getBoundingClientRect().width)}`).join(",")));
log("data creator", await dump('[data-panel-id="datatableEditor"]'));
await fullShot('[data-panel-id="datatableEditor"]', "full-data-creator");
const csv = page.locator('[data-panel-id="datatableEditor"] button, [data-panel-id="datatableEditor"] [role=radio]').filter({ hasText: /csv/i }).first(); if (await csv.count()) { await csv.click(); await page.waitForTimeout(500); log("data creator csv", await dump('[data-panel-id="datatableEditor"]')); await fullShot('[data-panel-id="datatableEditor"]', "full-data-creator-csv"); }
const preset = page.locator('[data-panel-id="datatableEditor"] button, [data-panel-id="datatableEditor"] [role=radio]').filter({ hasText: /preset/i }).first(); if (await preset.count()) { await preset.click(); await page.waitForTimeout(500); log("data creator preset", await dump('[data-panel-id="datatableEditor"]')); await fullShot('[data-panel-id="datatableEditor"]', "full-data-creator-preset"); }
await page.keyboard.press("Escape"); await rail("Data");
await rail("Interactions"); log("interactions panel", await dump('[data-panel-id="events"]')); await fullShot('[data-panel-id="events"]', "full-interactions");
const addRule = page.locator('[data-panel-id="events"] button').filter({ hasText: /add rule|add/i }).first(); if (await addRule.count()) { await addRule.click(); await page.waitForTimeout(600); log("interactions rule", await dump('[data-panel-id="events"]')); await fullShot('[data-panel-id="events"]', "full-interactions-rule"); }
await rail("Interactions");
await page.locator(".header-menu-button").first().click(); await page.waitForTimeout(400);
await page.locator('[role=menuitem]').filter({ hasText: /settings/i }).first().click(); await page.waitForTimeout(700);
log("settings panel", await dump('[data-panel-id="settings"]')); await fullShot('[data-panel-id="settings"]', "full-settings");
await page.getByRole("button", { name: "Settings", exact: true }).first().click().catch(() => {}); await page.keyboard.press("Escape");

// ④ Navigator Frames → + → Frame Preset (Properties layout 모드)
await rail("Navigator");
const frames = page.locator('[data-panel-id="navigator"] .panel-tab').filter({ hasText: /frames/i }).first(); await frames.click(); await page.waitForTimeout(500);
log("navigator frames", await dump('[data-panel-id="navigator"]')); await fullShot('[data-panel-id="navigator"]', "full-navigator-frames");
const plus = page.locator('[data-panel-id="navigator"] button[aria-label*="frame" i], [data-panel-id="navigator"] button[aria-label*="Add" i], [data-panel-id="navigator"] button[aria-label*="New" i]').first();
log("frames add btn", await plus.count() ? await plus.getAttribute("aria-label") : "none");
if (await plus.count()) { await plus.click(); await page.waitForTimeout(1200); log("after frames +", await page.evaluate(() => Array.from(document.querySelectorAll("[data-panel-id]")).filter((p) => p.getBoundingClientRect().width > 0).map((p) => p.dataset.panelId).join(","))); log("frame preset", await dump('[data-panel-id="properties"]')); await fullShot('[data-panel-id="properties"]', "full-frame-preset");
  const holy = page.locator('[data-panel-id="properties"] button').filter({ hasText: /holy grail/i }).first(); if (await holy.count()) { await holy.click(); await page.waitForTimeout(800); const dlg = page.locator("[role=dialog], [role=alertdialog]").first(); if (await dlg.count()) { log("existing slot dialog", await dump("[role=dialog], [role=alertdialog]")); await shot("[role=dialog], [role=alertdialog]", "dialog-existing-slots"); await page.keyboard.press("Escape"); } else { log("holy grail applied (no dialog)", await dump('[data-panel-id="properties"]')); await fullShot('[data-panel-id="properties"]', "full-frame-preset-applied"); } }
}
await page.keyboard.press("Escape");

// ⑤ Font manager
await selectLast("Button"); await page.waitForTimeout(400); if (!(await page.locator(P).isVisible())) await rail("Styles"); await page.locator(".styles-panel-tab").nth(2).click(); await page.waitForTimeout(400);
await page.locator(`${P} .font-picker-trigger`).first().click(); await page.waitForTimeout(600);
log("font popover", await dump(".react-aria-Popover"));
await shot(".react-aria-Popover", "popover-font");
const manage = page.locator(".react-aria-Popover .font-picker-manage").first(); if (await manage.count()) { await manage.click(); await page.waitForTimeout(900); log("font manager dialog", await dump("[role=dialog]")); await shot("[role=dialog]", "dialog-font-manager"); await page.keyboard.press("Escape"); }

log("pageerrors", errors.slice(0, 5));
writeFileSync(`${OUT}/report-2.md`, report.join("\n"));
console.log("written");
await browser.close();

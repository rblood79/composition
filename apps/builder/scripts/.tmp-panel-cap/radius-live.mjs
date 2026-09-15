import { chromium } from "playwright";
import { resolve } from "node:path";
const OUT = "/private/tmp/claude-501/-Users-admin-work-composition/f6bcc488-f176-4644-8364-3625704b801c/scratchpad/audit";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1200 }, deviceScaleFactor: 2 })).newPage();
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`rd-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const panel = async (name) => { await page.getByRole("button", { name, exact: true }).first().click(); await page.waitForTimeout(400); };
await panel("Components"); await page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: /^frame$/i }) }).first().click(); await page.waitForTimeout(900); await panel("Components").catch(() => {});
await page.evaluate(() => { const s = window.__composition_STORE__.getState(); const el = s.elements.filter((e) => e.page_id === s.currentPageId && e.type === "frame").pop(); s.setSelectedElement(el.id, el.props); setTimeout(() => s.updateSelectedStyles({ borderStyle: "solid", borderWidth: "2px", borderRadius: "8px" }), 300); }); await page.waitForTimeout(800);
await panel("Styles"); const PS = '[data-panel-id="styles"]';
await page.locator(".styles-panel-tab").nth(1).click(); await page.waitForTimeout(300);
for (const c of await page.locator(`${PS} .section-caret[aria-expanded="false"]`).all()) { await c.click().catch(() => {}); await page.waitForTimeout(150); }
const st = () => page.evaluate(() => { const s = window.__composition_STORE__.getState(); const el = s.elements.find((e) => e.id === s.selectedElementId) ?? s.elements.filter((e) => e.page_id === s.currentPageId && e.type === "frame").pop(); const st = el.props.style; return { r: st.borderRadius, tl: st.borderTopLeftRadius, tr: st.borderTopRightRadius, br: st.borderBottomRightRadius, bl: st.borderBottomLeftRadius }; });
const ui = () => page.evaluate((PS) => { const f = document.querySelector(`${PS} .border-radius`); const r = f.getBoundingClientRect(); const box = f.querySelector(".react-aria-Group").getBoundingClientRect(); const t = document.querySelector(`${PS} .style-border-radius .fieldset-actions button`); return { legend: f.querySelector("legend")?.textContent, val: f.querySelector("input").value, field: `${Math.round(r.width)}×${Math.round(r.height)}`, box: `${Math.round(box.width)}×${Math.round(box.height)}`, trig: f.querySelector(".react-aria-Group .react-aria-Button")?.getBoundingClientRect().width, toggle: `${t?.getAttribute("aria-label")} sel=${t?.dataset.selected ?? "no"} ${Math.round(t.getBoundingClientRect().width)}×${Math.round(t.getBoundingClientRect().height)}`, corners: document.querySelectorAll(`${PS} .border-corner`).length }; }, PS);
console.log("init:", await ui(), await st());
await page.locator(`${PS} .section[data-section-id="border"]`).screenshot({ path: `${OUT}/radius-collapsed.png` });
// preset 메뉴
await page.locator(`${PS} .border-radius .react-aria-Group .react-aria-Button`).click(); await page.waitForTimeout(400);
console.log("menu:", await page.evaluate(() => Array.from(document.querySelectorAll('.react-aria-Popover [role="option"]')).map((o) => `${o.textContent.trim()}${o.getAttribute("aria-selected") === "true" ? "*" : ""}`)));
await page.locator('.react-aria-Popover [role="option"]').filter({ hasText: /^XL/ }).click(); await page.waitForTimeout(500);
console.log("after XL:", await ui(), await st());
// 값 직접 입력 20
const inp = page.locator(`${PS} .border-radius input`); await inp.click(); await page.keyboard.press("Meta+a"); await page.keyboard.type("20"); await page.keyboard.press("Enter"); await page.waitForTimeout(500);
console.log("after 20:", (await ui()).val, await st());
// 토글 → 코너 4 보임 → TL 4 → 비균일 → 토글 off 해도 유지
await page.locator(`${PS} .style-border-radius .fieldset-actions button`).click(); await page.waitForTimeout(400);
console.log("after toggle on:", await ui());
await page.locator(`${PS} .section[data-section-id="border"]`).screenshot({ path: `${OUT}/radius-expanded.png` });
const tl = page.locator(`${PS} .border-corner-tl input`); await tl.click(); await page.keyboard.press("Meta+a"); await page.keyboard.type("4"); await page.keyboard.press("Enter"); await page.waitForTimeout(500);
console.log("after tl 4:", (await ui()).val, await st());
await page.locator(`${PS} .style-border-radius .fieldset-actions button`).click(); await page.waitForTimeout(400);
console.log("after toggle off (non-uniform stays):", await ui());
// Reset preset → 코너 키 제거
await page.locator(`${PS} .border-radius .react-aria-Group .react-aria-Button`).click(); await page.waitForTimeout(400);
await page.locator('.react-aria-Popover [role="option"]').filter({ hasText: /^Reset$/ }).click(); await page.waitForTimeout(500);
console.log("after Reset:", await ui(), await st());
await browser.close();

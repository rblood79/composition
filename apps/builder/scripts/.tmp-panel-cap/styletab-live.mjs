// 02 Style 탭 live 하니스 — Fill · Border · Effect 3절 실측 (panel-ui 02)
// 실행: node apps/builder/scripts/.tmp-panel-cap/styletab-live.mjs [phase]
import { chromium } from "playwright";
import { resolve } from "node:path";
const OUT = process.env.OUT ?? "/private/tmp/claude-501/-Users-admin-work-composition/f6bcc488-f176-4644-8364-3625704b801c/scratchpad/cap";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 2 })).newPage();
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`st-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);
const elId = await page.evaluate(async () => { const st = window.__composition_STORE__.getState(); const body = st.elements.find(e => e.type === "body" && e.page_id === st.currentPageId) ?? st.elements.find(e => e.type === "body"); const now = new Date().toISOString(); const id = crypto.randomUUID(); await st.addElement({ id, type: "Card", parent_id: body.id, page_id: body.page_id, order_num: 99, created_at: now, updated_at: now, props: { style: { width: "200px", height: "80px" } } }, { skipHistory: true }); await new Promise(r => setTimeout(r, 800)); const st2 = window.__composition_STORE__.getState(); st2.setSelectedElement(id, st2.elements.find(e => e.id === id)?.props); return id; });
await page.waitForTimeout(600);
await page.getByRole("button", { name: "Styles", exact: true }).first().click(); await page.waitForTimeout(500);
await page.locator(".styles-panel-tab").nth(1).click(); await page.waitForTimeout(400);
const P = '[data-panel-id="styles"]';
const M = (sel) => page.evaluate((sel) => Array.from(document.querySelectorAll(sel)).filter(el => el.getBoundingClientRect().width > 0).slice(0, 12).map(el => { const r = el.getBoundingClientRect(); return `${(el.getAttribute("aria-label") || el.className.toString()).slice(0, 44)} | ${Math.round(r.width)}×${Math.round(r.height)}`; }), sel);
const style = () => page.evaluate((id) => { const el = window.__composition_STORE__.getState().elements.find(e => e.id === id); return { style: el?.props?.style, fills: el?.fills }; }, elId);

console.log("sections", JSON.stringify(await M(`${P} .section[data-section-id] .section-header`)));
console.log("fill rows (virtual)", JSON.stringify(await M(`${P} .fill-layer-row, ${P} .fill-layer-row__body, ${P} .fill-layer-row__trigger, ${P} .fill-layer-row__visibility`)));
// 헤더 + 두 번 → 색 + 그라데이션 레이어
const add = page.locator(`${P} .section[data-section-id="fill"] button[aria-label="Add fill"]`);
await add.click(); await page.waitForTimeout(400); await add.click(); await page.waitForTimeout(500);
console.log("fill rows (2)", JSON.stringify(await M(`${P} .fill-layer-row, ${P} .fill-layer-row__body, ${P} .fill-layer-row__opacity-scrub, ${P} .fill-layer-row__visibility`)));
console.log("after add", JSON.stringify(await style()));
// 눈 토글 → enabled false
await page.locator(`${P} .fill-layer-row__visibility`).nth(1).click(); await page.waitForTimeout(400);
console.log("after toggle", JSON.stringify((await style()).fills.map(f => [f.type, f.enabled])));
// 첫 행 trigger → 팝오버 폭
await page.locator(`${P} .fill-layer-row__trigger`).first().click(); await page.waitForTimeout(600);
console.log("popover", JSON.stringify(await M(".fill-detail-popover-container.react-aria-Popover")));
await page.keyboard.press("Escape"); await page.waitForTimeout(300);
await page.locator(`${P} .panel-contents`).screenshot({ path: `${OUT}/styletab-p1.png` });
// Border · Effect 컨트롤 크기
console.log("border", JSON.stringify(await M(`${P} .section[data-section-id="border"] .react-aria-Group, ${P} .section[data-section-id="border"] fieldset, ${P} .section[data-section-id="border"] .slider-inline-label, ${P} .section[data-section-id="border"] .slider-output--input, ${P} .section[data-section-id="border"] .react-aria-ToggleButton`)));
// Width 슬라이더 값 칸 직접 입력 3 → borderWidth 3px
const wIn = page.locator(`${P} .section[data-section-id="border"] .border-width .slider-output--input`);
await wIn.click(); await wIn.fill("3"); await wIn.press("Enter"); await page.waitForTimeout(400);
console.log("width typed", JSON.stringify((await style()).style));
// Radius 프리셋 메뉴 → M (var(--radius-md))
await page.locator(`${P} .section[data-section-id="border"] button[aria-label="Border radius presets"]`).click(); await page.waitForTimeout(400);
console.log("menu", JSON.stringify(await M(".property-row-menu .react-aria-MenuItem")));
await page.locator(".property-row-menu .react-aria-MenuItem").filter({ hasText: /^M ·/ }).click(); await page.waitForTimeout(400);
console.log("radius preset", JSON.stringify((await style()).style));
// Radius 슬라이더 키보드 → 썸 focus 후 ArrowRight
await page.locator(`${P} .section[data-section-id="border"] .border-radius .slider-thumb input`).focus(); await page.keyboard.press("ArrowRight"); await page.waitForTimeout(400);
console.log("radius arrow", JSON.stringify((await style()).style));
// Style seg dashed
await page.locator(`${P} .section[data-section-id="border"] button[aria-label="Dashed"]`).click(); await page.waitForTimeout(400);
console.log("style seg", JSON.stringify((await style()).style));
await page.locator(`${P} .panel-contents`).screenshot({ path: `${OUT}/styletab-p2.png` });
const E = `${P} .section[data-section-id="effect"]`;
console.log("effect", JSON.stringify(await M(`${E} .react-aria-Group, ${E} .effect-add-row, ${E} .effect-add-row__label, ${E} .effect-layer-row`)));
// Opacity 값 칸 60 Enter → opacity 0.6
const oIn = page.locator(`${E} .opacity .slider-output--input`); await oIn.click(); await oIn.fill("60"); await oIn.press("Enter"); await page.waitForTimeout(400);
console.log("opacity typed", JSON.stringify((await style()).style.opacity));
// Box Shadows ⋮ → Add shadow layer ×2 → 2 rows
const shMenu = page.locator(`${E} button[aria-label="Box shadow actions"]`);
await shMenu.click(); await page.waitForTimeout(300); await page.locator(".property-row-menu .react-aria-MenuItem").filter({ hasText: /Add/ }).click(); await page.waitForTimeout(500);
await shMenu.click(); await page.waitForTimeout(300); await page.locator(".property-row-menu .react-aria-MenuItem").filter({ hasText: /Add/ }).click(); await page.waitForTimeout(500);
console.log("shadow rows", JSON.stringify(await M(`${E} .effect-layer-row, ${E} .effect-layer-row__trigger, ${E} .effect-layer-row__tag`)), JSON.stringify((await style()).style.boxShadow));
// 2번째 행 ⋮ → inset
await page.locator(`${E} button[aria-label="Shadow layer actions"]`).nth(1).click(); await page.waitForTimeout(300);
await page.locator(".property-row-menu .react-aria-MenuItem").filter({ hasText: /inset/i }).click(); await page.waitForTimeout(500);
console.log("after inset", JSON.stringify((await style()).style.boxShadow));
await page.locator(`${E}`).screenshot({ path: `${OUT}/styletab-p3-rows.png` });
console.log("shadow color btn", JSON.stringify(await M(`${P} .section[data-section-id="border"] .color-swatch-button`)));
// 1번째 행 클릭 → 팝오버 편집기, Blur 필드 값 12 커밋
await page.locator(`${E} .effect-layer-row__trigger`).first().click(); await page.waitForTimeout(600);
console.log("shadow popover", JSON.stringify(await M(".box-shadow-popover.react-aria-Popover, .box-shadow-popover .property-unit-input, .box-shadow-popover .color-swatch-button")));
const blurIn = page.locator(".box-shadow-popover .box-shadow-blur input").first(); await blurIn.click(); await blurIn.fill("12"); await blurIn.press("Enter"); await page.waitForTimeout(500);
console.log("after blur 12", JSON.stringify((await style()).style.boxShadow), "popover open:", await page.locator(".box-shadow-popover").count());
await page.locator(".box-shadow-popover").screenshot({ path: `${OUT}/styletab-p3-popover.png` });
await page.keyboard.press("Escape"); await page.waitForTimeout(300);
// 프리셋 md → 3 레이어 (inset 있었으므로 inset 유지)
await shMenu.click(); await page.waitForTimeout(300); await page.locator(".property-row-menu .react-aria-MenuItem").filter({ hasText: /md/ }).click(); await page.waitForTimeout(500);
console.log("preset md rows", (await page.locator(`${E} .effect-layer-row`).count()), JSON.stringify((await style()).style.boxShadow));
// 전부 제거 → boxShadow 키 삭제
for (let k = 0; k < 3; k++) { await page.locator(`${E} button[aria-label="Shadow layer actions"]`).first().click(); await page.waitForTimeout(250); await page.locator(".property-row-menu .react-aria-MenuItem").filter({ hasText: /Remove/ }).click(); await page.waitForTimeout(400); }
console.log("removed all", JSON.stringify((await style()).style.boxShadow));
// Filters + → blur(4px), scrub 8 → blur(8px), 삭제 → 키 삭제
await page.locator(`${E} button[aria-label="Add blur filter"]`).click(); await page.waitForTimeout(400);
console.log("blur added", JSON.stringify((await style()).style.filter), JSON.stringify(await M(`${E} .style-filter .effect-layer-row, ${E} .effect-layer-row__scrub`)));
const scrub = page.locator(`${E} .effect-layer-row__scrub`); await scrub.dblclick(); await page.waitForTimeout(200);
const scrubIn = page.locator(`${E} .effect-layer-row__scrub input`); if (await scrubIn.count()) { await scrubIn.fill("8"); await scrubIn.press("Enter"); } await page.waitForTimeout(400);
console.log("blur 8", JSON.stringify((await style()).style.filter));
await page.locator(`${E} .panel-contents, ${P} .panel-contents`).first().screenshot({ path: `${OUT}/styletab-p3.png` });
await page.locator(`${E} button[aria-label="Remove blur filter"]`).click(); await page.waitForTimeout(400);
console.log("blur removed", JSON.stringify((await style()).style.filter));
await browser.close();

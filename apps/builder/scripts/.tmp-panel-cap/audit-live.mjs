// panel-ui 시안 vs 구현 대조 live 하니스 — Styles 5 탭 · 팝오버 · 다른 패널 · 크롬. 스크린샷 + 컨트롤 크기 dump
// 실행: node apps/builder/scripts/.tmp-panel-cap/audit-live.mjs [phase]   (phase = styles | panels | chrome | all)
import { chromium } from "playwright";
import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
const OUT = "/private/tmp/claude-501/-Users-admin-work-composition/f6bcc488-f176-4644-8364-3625704b801c/scratchpad/audit";
const PHASE = process.argv[2] ?? "all";
const READY = () => Boolean(window.__composition_STORE__ && window.__composition_STORE__.getState().currentPageId && document.querySelector(".app:not(.builder-booting)") && document.querySelector('[data-testid="skia-canvas-unified"]'));
const browser = await chromium.launch({ headless: false });
const page = await (await browser.newContext({ storageState: resolve("apps/builder/scripts/.auth-session.json"), viewport: { width: 1600, height: 1100 }, deviceScaleFactor: 2 })).newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://localhost:5173/dashboard", { waitUntil: "networkidle" });
const b = page.locator("button.dashboard-create-button").first(); await b.waitFor({ state: "visible", timeout: 15000 }); await b.click();
const i = page.locator("#new-project-name"); await i.waitFor({ state: "visible" }); await i.fill(`audit-${Date.now()}`); await i.press("Enter");
await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 60000 }); await page.waitForFunction(READY, undefined, { timeout: 90000 }); await page.waitForTimeout(1200);

const report = [];
const log = (k, v) => { report.push(`\n## ${k}\n${typeof v === "string" ? v : JSON.stringify(v, null, 0)}`); console.log("##", k); writeFileSync(`${OUT}/report-${PHASE}.md`, report.join("\n")); };
const openPanel = async (name) => { await page.getByRole("button", { name, exact: true }).first().click(); await page.waitForTimeout(600); };
const addViaPalette = async (nameRe) => {
  await openPanel("Components");
  const item = page.locator("button.list-item").filter({ has: page.locator(".list-item-name", { hasText: nameRe }) }).first();
  await item.scrollIntoViewIfNeeded(); await item.click(); await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "Components", exact: true }).first().click().catch(() => {}); await page.waitForTimeout(300);
};
const selectLast = (type) => page.evaluate(async (type) => { const st = window.__composition_STORE__.getState(); const els = st.elements.filter((e) => e.page_id === st.currentPageId && e.type.toLowerCase() === type.toLowerCase()); const el = els[els.length - 1]; st.setSelectedElement(el.id, el.props); await new Promise((r) => setTimeout(r, 300)); return el.id; }, type);

// 컨트롤 dump — root 아래 상호작용 요소 + 라벨 + 헤더의 크기
const DUMP_SEL = "button, input, textarea, select, [role=slider], [role=switch], [role=radio], [role=tab], [role=option], [role=menuitem], [role=treeitem], [role=row], [role=group], legend, label, .section-header, .panel-tab, .panel-header, output, [class*=addrow], [class*=lrow], [class*=layer-row], [class*=fill-layer], [class*=box-model], [class*=property-slider], [class*=segment], .react-aria-ToggleButtonGroup, .react-aria-Group, [class*=card], [class*=list-item], [class*=chip], [class*=swatch]";
const dump = (rootSel, max = 400) => page.evaluate(({ rootSel, max, DUMP_SEL }) => {
  const root = document.querySelector(rootSel); if (!root) return `no root ${rootSel}`;
  const rr = root.getBoundingClientRect();
  const rows = [];
  for (const el of root.querySelectorAll(DUMP_SEL)) {
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
    const cs = getComputedStyle(el);
    const label = el.getAttribute("aria-label") || (el.tagName === "INPUT" ? `[${el.value}]` : "") || (el.childElementCount === 0 ? el.textContent.trim().slice(0, 24) : el.querySelector("legend, .label, [class*=label]")?.textContent?.trim().slice(0, 20) || "");
    const cls = el.className?.toString?.().replace(/react-aria-/g, "").split(/\s+/).filter((c) => c && !/^(is-|data-)/.test(c)).slice(0, 3).join(".");
    rows.push(`${el.tagName.toLowerCase()}${cls ? "." + cls : ""}${el.getAttribute("role") ? "[" + el.getAttribute("role") + "]" : ""} "${label}" ${Math.round(r.width)}×${Math.round(r.height)} @${Math.round(r.left - rr.left)},${Math.round(r.top - rr.top)} fs${parseFloat(cs.fontSize)}`);
    if (rows.length >= max) break;
  }
  return rows.join("\n");
}, { rootSel, max, DUMP_SEL });
const shot = async (sel, name, full = false) => { try { const loc = page.locator(sel).first(); await loc.screenshot({ path: `${OUT}/${name}.png` }); } catch (e) { console.log("shot fail", name, e.message.slice(0, 80)); } if (full) await page.screenshot({ path: `${OUT}/${name}-full.png` }); };

const P = '[data-panel-id="styles"]';
// ───────────────── Styles 패널 (Button 선택)
if (PHASE === "styles" || PHASE === "all") {
  await addViaPalette(/^button$/i);
  const btnId = await selectLast("Button");
  await page.waitForTimeout(500);
  await openPanel("Styles");
  const tabs = await page.locator(".styles-panel-tab").count();
  log("styles tabs", await dump(`${P} .styles-panel-tabs, ${P} .panel-tabs`));
  log("styles tab strip", await page.evaluate(() => Array.from(document.querySelectorAll('[data-panel-id="styles"] .styles-panel-tab')).map((el) => { const r = el.getBoundingClientRect(); const p = el.parentElement.getBoundingClientRect(); return `${el.textContent.trim()} ${Math.round(r.width)}×${Math.round(r.height)} strip ${Math.round(p.height)}`; })));
  for (let t = 0; t < tabs; t++) {
    await page.locator(".styles-panel-tab").nth(t).click(); await page.waitForTimeout(500);
    // 모든 절 펼치기: 접힌 헤더 클릭
    await page.evaluate(() => { for (const h of document.querySelectorAll('[data-panel-id="styles"] .section-header[aria-expanded="false"], [data-panel-id="styles"] .section-header button[aria-expanded="false"]')) h.click(); });
    await page.waitForTimeout(300);
    const name = await page.locator(".styles-panel-tab").nth(t).textContent();
    log(`styles tab ${t} ${name.trim()} sections`, await page.evaluate(() => Array.from(document.querySelectorAll('[data-panel-id="styles"] .section')).map((s) => { const h = s.querySelector(".section-header"); const r = h?.getBoundingClientRect(); const body = s.querySelector(".section-content, .section-body"); const br = body?.getBoundingClientRect(); const caret = h?.querySelector("svg, [class*=caret], [class*=chevron]"); const cr = caret?.getBoundingClientRect(); return `${s.dataset.sectionId} header ${Math.round(r?.width)}×${Math.round(r?.height)} caret@${cr ? Math.round(cr.left - r.left) : "-"} expanded=${h?.getAttribute("aria-expanded") ?? h?.querySelector("[aria-expanded]")?.getAttribute("aria-expanded")} body ${Math.round(br?.height ?? 0)}`; })));
    log(`styles tab ${t} ${name.trim()} controls`, await dump(`${P} .panel-contents, ${P} .panel-content`));
    await shot(`${P}`, `styles-tab${t}`);
  }
  // Layout 탭 Space=between 상태의 Align 그리드 (막대 모드)
  await page.locator(".styles-panel-tab").nth(0).click(); await page.waitForTimeout(400);
  // 팝오버 — 단위 suffix · 색 · 글꼴
  await page.locator(".styles-panel-tab").nth(1).click(); await page.waitForTimeout(400);
  const colorTrig = page.locator(`${P} .section[data-section-id="border"] .property-color-trigger, ${P} .section[data-section-id="border"] [class*=color-swatch], ${P} .section[data-section-id="border"] button[class*=color]`).first();
  if (await colorTrig.count()) { await colorTrig.click(); await page.waitForTimeout(700); log("color popover (border)", await dump(".property-color-popover, .react-aria-Popover")); await shot(".react-aria-Popover", "popover-color-border"); await page.keyboard.press("Escape"); await page.waitForTimeout(300); }
  const fillTrig = page.locator(`${P} .section[data-section-id="fill"] .fill-layer-row__trigger`).first();
  if (await fillTrig.count()) { await fillTrig.click(); await page.waitForTimeout(700); log("fill popover (color)", await dump(".react-aria-Popover")); await shot(".react-aria-Popover", "popover-fill-color");
    const gradTab = page.locator(".react-aria-Popover [role=tab], .react-aria-Popover .react-aria-ToggleButton").filter({ hasText: /gradient/i }).first();
    if (await gradTab.count()) { await gradTab.click(); await page.waitForTimeout(700); log("fill popover (gradient)", await dump(".react-aria-Popover")); await shot(".react-aria-Popover", "popover-fill-gradient"); }
    const imgTab = page.locator(".react-aria-Popover [role=tab], .react-aria-Popover .react-aria-ToggleButton").filter({ hasText: /image/i }).first();
    if (await imgTab.count()) { await imgTab.click(); await page.waitForTimeout(700); log("fill popover (image)", await dump(".react-aria-Popover")); await shot(".react-aria-Popover", "popover-fill-image"); }
    await page.keyboard.press("Escape"); await page.waitForTimeout(300); }
  await page.locator(".styles-panel-tab").nth(2).click(); await page.waitForTimeout(400);
  const fontTrig = page.locator(`${P} .section[data-section-id="typography"] [class*=font-family] button, ${P} .section[data-section-id="typography"] .font-family-trigger, ${P} [class*=font-picker] button`).first();
  if (await fontTrig.count()) { await fontTrig.click(); await page.waitForTimeout(700); log("font popover", await dump(".react-aria-Popover")); await shot(".react-aria-Popover", "popover-font"); await page.keyboard.press("Escape"); await page.waitForTimeout(300); }
  await page.locator(".styles-panel-tab").nth(0).click(); await page.waitForTimeout(400);
  const suffix = page.locator(`${P} .section[data-section-id="size"] [class*=suffix], ${P} .section[data-section-id="size"] .property-unit-input__suffix, ${P} .section[data-section-id="size"] button[class*=unit]`).first();
  if (await suffix.count()) { await suffix.click(); await page.waitForTimeout(600); log("unit menu", await dump(".react-aria-Popover")); await shot(".react-aria-Popover", "popover-unit"); await page.keyboard.press("Escape"); await page.waitForTimeout(300); } else log("unit menu", "no suffix trigger found");
  // Space between → Align 그리드 막대 모드
  const between = page.locator(`${P} .section[data-section-id="layout"] .react-aria-ToggleButton[aria-label*="between" i], ${P} .section[data-section-id="layout"] [aria-label*="Space between" i]`).first();
  if (await between.count()) { await between.click(); await page.waitForTimeout(500); await shot(`${P} .section[data-section-id="layout"]`, "styles-layout-between"); log("align grid between", await dump(`${P} .section[data-section-id="layout"]`)); }
  // 선택 라벨 · 액션바 위치
  log("selection label / action bar", await page.evaluate((id) => { const lm = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.()?.get(id); const bar = document.querySelector(".contextual-action-bar"); const br = bar?.getBoundingClientRect(); const canvas = document.querySelector('[data-testid="skia-canvas-unified"]').getBoundingClientRect(); const vp = window.__composition_VIEWPORT__?.(); const st = window.__composition_STORE__.getState(); const pp = st.pagePositions?.[st.currentPageId]; return { layout: lm ? { x: lm.x, y: lm.y, w: lm.width, h: lm.height } : null, pp, vp, canvas: { x: canvas.x, y: canvas.y }, bar: br ? { x: br.x, y: br.y, w: br.width, h: br.height, items: Array.from(bar.querySelectorAll("button")).map((b) => `${b.getAttribute("aria-label")} ${Math.round(b.getBoundingClientRect().width)}×${Math.round(b.getBoundingClientRect().height)}`), gap: getComputedStyle(bar).gap } : null }; }, btnId));
  await page.screenshot({ path: `${OUT}/canvas-selection-full.png` });
}

// ───────────────── 다른 패널
if (PHASE === "panels" || PHASE === "all") {
  if (PHASE === "panels") { await addViaPalette(/^button$/i); await selectLast("Button"); await page.waitForTimeout(400); }
  for (const name of ["Properties", "Navigator", "Components", "Theme", "History", "Data", "AI", "Interactions"]) {
    const btn = page.getByRole("button", { name, exact: true }).first();
    if (!(await btn.count())) { log(`panel ${name}`, "no rail button"); continue; }
    await btn.click(); await page.waitForTimeout(700);
    const pid = await page.evaluate(() => Array.from(document.querySelectorAll("[data-panel-id]")).map((p) => p.dataset.panelId).join(","));
    log(`panel ${name} ids`, pid);
    const root = `[data-panel-id="${name.toLowerCase()}"]`;
    const exists = await page.locator(root).count();
    const sel = exists ? root : "[data-panel-id]";
    if (name === "Navigator") { const layers = page.locator(`${sel} .panel-tab`).filter({ hasText: /layers/i }).first(); if (await layers.count()) { await layers.click(); await page.waitForTimeout(400); } }
    if (name === "Properties") { await page.evaluate(() => { for (const h of document.querySelectorAll('[data-panel-id="properties"] .section-caret[aria-expanded="false"]')) h.click(); }); await page.waitForTimeout(300); }
    log(`panel ${name} controls`, await dump(sel));
    await shot(sel, `panel-${name.toLowerCase()}`);
    await page.keyboard.press("Escape"); await page.waitForTimeout(200);
    await btn.click(); await page.waitForTimeout(200);
  }
  // Settings (헤더 메뉴 ⌘,)
  await page.keyboard.press("Meta+,"); await page.waitForTimeout(700);
  log("panel Settings controls", await dump('[data-panel-id="settings"], [data-panel-id]'));
  await shot('[data-panel-id="settings"]', "panel-settings");
  // Navigator › Frames › + (Frame Preset)
  await openPanel("Navigator");
  const frames = page.locator('[data-panel-id="navigator"] .panel-tab').filter({ hasText: /frames/i }).first();
  if (await frames.count()) { await frames.click(); await page.waitForTimeout(400); log("navigator frames", await dump('[data-panel-id="navigator"]')); await shot('[data-panel-id="navigator"]', "panel-navigator-frames");
    const plus = page.locator('[data-panel-id="navigator"] button[aria-label*="frame" i], [data-panel-id="navigator"] button[aria-label*="Add" i]').first();
    if (await plus.count()) { await plus.click(); await page.waitForTimeout(900); log("frame preset (properties layout mode)", await dump('[data-panel-id="properties"]')); await shot('[data-panel-id="properties"]', "panel-frame-preset"); }
  }
  // Data creator
  await openPanel("Data");
  const newTable = page.locator('[data-panel-id="data"] button, [data-panel-id="datatable"] button').filter({ hasText: /new table|add table|\+/i }).first();
  if (await newTable.count()) { await newTable.click(); await page.waitForTimeout(900); log("data creator", await dump("[data-panel-id]")); await page.screenshot({ path: `${OUT}/data-creator-full.png` }); }
  // Font manager
  await openPanel("Styles"); await page.locator(".styles-panel-tab").nth(2).click(); await page.waitForTimeout(400);
  const fontTrig = page.locator(`${P} .section[data-section-id="typography"] button`).first();
  if (await fontTrig.count()) { await fontTrig.click(); await page.waitForTimeout(600); const manage = page.locator(".react-aria-Popover button").filter({ hasText: /manage/i }).first(); if (await manage.count()) { await manage.click(); await page.waitForTimeout(800); log("font manager dialog", await dump(".react-aria-Modal, [role=dialog]")); await shot("[role=dialog]", "dialog-font-manager"); await page.keyboard.press("Escape"); await page.waitForTimeout(300); } else await page.keyboard.press("Escape"); }
}

// ───────────────── 크롬
if (PHASE === "chrome" || PHASE === "all") {
  log("header", await dump("header"));
  await shot("header", "chrome-header");
  await page.locator(".header-menu-button").first().click(); await page.waitForTimeout(500);
  log("header menu", await dump(".react-aria-Popover, .header-menu-popover")); await shot(".react-aria-Popover, .header-menu-popover", "chrome-header-menu"); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  const zoom = page.locator(".zoom-trigger-button").first(); if (await zoom.count()) { await zoom.click(); await page.waitForTimeout(500); log("zoom menu", await dump(".react-aria-Popover, [role=menu]")); await shot(".react-aria-Popover, [role=menu]", "chrome-zoom-menu"); await page.keyboard.press("Escape"); await page.waitForTimeout(300); }
  const cb = await page.locator('[data-testid="skia-canvas-unified"]').boundingBox();
  await page.mouse.click(cb.x + cb.width / 2, cb.y + cb.height - 60, { button: "right" }); await page.waitForTimeout(500);
  log("context menu", await dump("[class*=context-menu], .react-aria-Popover")); await shot("[class*=context-menu-popover], .react-aria-Popover", "chrome-context-menu"); await page.keyboard.press("Escape"); await page.waitForTimeout(300);
  await page.evaluate(() => window.dispatchEvent(new Event("open-command-palette"))); await page.waitForTimeout(600);
  log("command palette", await dump("[class*=command-palette]")); await shot("[class*=command-palette-modal], [class*=command-palette]", "chrome-command-palette");
  await page.keyboard.type("zoom"); await page.waitForTimeout(400); log("command palette search", await dump("[class*=command-palette]")); await shot("[class*=command-palette-modal], [class*=command-palette]", "chrome-command-palette-search");
  await page.keyboard.press("Escape"); await page.waitForTimeout(300); if (await page.locator(".command-palette-overlay").count()) { await page.keyboard.press("Escape"); await page.waitForTimeout(300); } if (await page.locator(".command-palette-overlay").count()) { await page.mouse.click(5, 700); await page.waitForTimeout(300); }
  await page.evaluate(async () => { const m = await import("/src/builder/stores/toast.ts"); m.useToastStore.getState().showToast("success", "요소를 이동했습니다", { action: { label: "되돌리기", onClick: () => {} }, bypassCooldown: true, duration: 20000 }); }); await page.waitForTimeout(500);
  log("toast", await dump("[class*=toast-container], [class*=toast]")); await shot("[class*=toast]", "chrome-toast");
  const hb = page.locator("header .builder-control-group button").first(); await hb.hover(); await page.waitForTimeout(1200);
  log("tooltip", await dump("[role=tooltip], [class*=tooltip]")); await shot("[role=tooltip]", "chrome-tooltip"); await page.mouse.move(700, 600); await page.waitForTimeout(300);
  // 액션바 hover 툴팁 + ⋯ 메뉴 (Button 선택 필요)
  if (PHASE === "chrome") { await addViaPalette(/^button$/i); await selectLast("Button"); await page.waitForTimeout(600); }
  const bar = page.locator(".contextual-action-bar").first();
  if (await bar.count()) { log("action bar", await dump(".contextual-action-bar")); await shot(".contextual-action-bar", "chrome-action-bar"); const first = bar.locator("button").first(); await first.hover(); await page.waitForTimeout(1200); log("action bar tooltip", await dump("[role=tooltip], [class*=tooltip]")); const more = bar.locator('button[aria-label*="more" i], button[aria-label*="More" i], button:has-text("⋯")').first(); if (await more.count()) { await more.click(); await page.waitForTimeout(500); log("action bar menu", await dump(".react-aria-Popover, [role=menu]")); await shot(".react-aria-Popover", "chrome-action-bar-menu"); await page.keyboard.press("Escape"); } }
  // 다이얼로그 — 페이지 삭제 확인 (ConfirmDialog)
  await openPanel("Navigator");
  const pagesTab = page.locator('[data-panel-id="navigator"] .panel-tab').filter({ hasText: /pages/i }).first(); if (await pagesTab.count()) await pagesTab.click(); await page.waitForTimeout(400);
  const addPage = page.locator('[data-panel-id="navigator"] button[aria-label*="page" i]').first();
  if (await addPage.count()) { await addPage.click(); await page.waitForTimeout(800); log("add page dialog", await dump("[role=dialog], .react-aria-Modal")); await shot("[role=dialog]", "dialog-add-page"); await page.keyboard.press("Escape"); await page.waitForTimeout(300); }
  const status = await dump("[class*=status-indicator], [class*=workspace-status], [class*=compare]");
  log("status / compare", status);
}

log("pageerrors", errors.slice(0, 5));
writeFileSync(`${OUT}/report-${PHASE}.md`, report.join("\n"));
console.log("written", `${OUT}/report-${PHASE}.md`);
await browser.close();

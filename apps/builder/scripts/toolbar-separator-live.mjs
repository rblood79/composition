// toolbar-separator-live.mjs — Toolbar 안 vertical Separator 의 margin 축 + Toolbar staticSelectors (align-self stretch · margin 0 10px) 를 layout 이 읽은 뒤 Skia ↔ Preview DOM live (2026-09-18, ADR-223 후속 4).
//   사용: node apps/builder/scripts/toolbar-separator-live.mjs  (dev 5173 · .auth-session.json · headed)
// Toolbar (ref instance) root h · separator y · separator 좌우 간격 — 수리 전 Skia 29/22 · 간격 8/18. 버튼 폭은 텍스트 측정 차 (≤ 2.5/버튼).
import { chromium } from "playwright";
import { resolve } from "node:path";
import { waitReady } from "./perf-baseline.mjs";
const BASE_URL = process.env.BUILDER_URL ?? "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const log = (...a) => console.log("[toolbar live]", ...a);
const RAIL = ["navigator","components","datatable","datatableEditor","theme","ai","properties","styles","interactions","history"];
async function setPanel(page, id, open) {
  const b = page.locator(".panel-toggle-rail button").nth(RAIL.indexOf(id));
  if (((await b.getAttribute("aria-pressed")) === "true") !== open) { await b.click(); await page.waitForTimeout(900); }
}
async function addFromPalette(page, type) {
  await setPanel(page, "components", true);
  await page.evaluate(() => window.__composition_STORE__.getState().setSelectedElement(null));
  const before = await page.evaluate(() => window.__composition_STORE__.getState().elements.map(e=>e.id));
  const search = page.locator('[data-panel-id="components"] input').first();
  await search.waitFor({ state: "visible", timeout: 20000 });
  await search.fill(type); await page.waitForTimeout(400);
  const items = page.locator('[data-panel-id="components"] .list-item');
  const item = items.first();
  await item.click();
  const id = await page.waitForFunction((before) => { const fresh = window.__composition_STORE__.getState().elements.filter(e => !before.includes(e.id)); const ids = new Set(fresh.map(e => e.id)); return fresh.find(e => !ids.has(e.parent_id))?.id ?? null; }, before, {timeout:15000}).then(h=>h.jsonValue());
  await page.waitForTimeout(1200);
  await setPanel(page, "components", false);
  return id;
}
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ storageState: STORAGE_STATE, viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = []; page.on("pageerror", e => errors.push(String(e)));
page.on("console", m => { if (m.text().startsWith("DOMKIDS")) log(m.text()); });
try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20000 }); await create.click();
  const input = page.locator("#new-project-name"); await input.waitFor({ state: "visible", timeout: 10000 });
  await input.fill(`toolbarlive-${Date.now()}`); await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90000 }); await waitReady(page);
  const navId = await addFromPalette(page, "Toolbar");
  const info = await page.evaluate((id) => {
    const st = window.__composition_STORE__.getState();
    const nav = st.elements.find(e => e.id === id);
    const lm = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    const r = (i) => { const l = lm?.get(i); return l ? [l.x,l.y,l.width,l.height].map(v=>Math.round(v*100)/100) : null; };
    const kids = [...lm.keys()].filter(k => k !== id && k.startsWith(id));
    return { style: nav?.props?.style, type: nav?.type, nav: r(id), kids: kids.map(r), kidIds: kids };
  }, navId);
  log("store", info.type, JSON.stringify(info.style), "kidIds", JSON.stringify(info.kidIds));
  const PAGE_W = await page.evaluate(() => { const st = window.__composition_STORE__.getState(); const b = st.elements.find(e => e.type === "body"); return b ? (window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().get(b.id)?.width ?? 1920) : 1920; });
  log("skia nav", info.nav, "kids", JSON.stringify(info.kids));
  // Compare mode → preview iframe
  const compare = page.locator(".header_right .builder-control-group button").first();
  if ((await compare.getAttribute("aria-pressed")) !== "true" && (await compare.getAttribute("aria-checked")) !== "true") { await compare.click(); await page.waitForTimeout(3000); }
  // 반폭 함정: iframe 폭을 Skia 페이지 폭으로 강제 — nav 는 width auto (flex, block-level) 라 부모 폭을 그대로 받는다.
  await page.evaluate((w) => { for (const f of document.querySelectorAll("iframe")) { f.style.width = `${w}px`; f.style.minWidth = `${w}px`; f.style.maxWidth = "none"; } }, PAGE_W);
  await page.waitForTimeout(800);
  const ids = [navId, ...info.kidIds];
  await page.waitForFunction((ids) => [...document.querySelectorAll("iframe")].some(f => ids.every(id => f.contentDocument?.querySelector(`[data-element-id^="${id}"]`))), ids, { timeout: 15000 }).catch(()=>{});
  const dom = await page.evaluate((ids) => {
    for (const f of document.querySelectorAll("iframe")) {
      const d = f.contentDocument; if (!d) continue;
      // wrapper 가 display:contents 로 같은 data-element-id 를 달 수 있다 — 실제 상자 (nav / a) 를 잡는다
      const rootEl = [...d.querySelectorAll(`[data-element-id^="${ids[0]}"]`)].find(e => e.getBoundingClientRect().width > 0); if (!rootEl) continue;
      const els = [rootEl, ...rootEl.querySelectorAll(".react-aria-Button, .react-aria-Separator")];
      const navEl = els[0]; const nr = navEl.getBoundingClientRect(); const cs = getComputedStyle(navEl);
      const kidsDump = [...navEl.querySelectorAll("*")].filter(k => k.getBoundingClientRect().width > 0).slice(0, 12).map(k => { const r = k.getBoundingClientRect(); const c = getComputedStyle(k); return `${k.tagName.toLowerCase()}.${String(k.className).split(" ")[0]}#${(k.dataset.elementId ?? "").slice(-12)} [${[r.x-nr.x, r.y-nr.y, r.width, r.height].map(v=>Math.round(v*10)/10).join(",")}] m=${c.margin} h=${c.height} ai=${c.alignSelf}`; });
      console.log("DOMKIDS " + kidsDump.join(" | ") + " | rootFont=" + getComputedStyle(d.documentElement).fontSize + " spacing-sm=" + getComputedStyle(navEl).getPropertyValue("--spacing-sm"));
      return { cls: navEl.className, size: navEl.dataset.size, variant: navEl.dataset.variant,
        computed: { padding: cs.padding, gap: cs.gap, height: cs.height, display: cs.display, alignItems: cs.alignItems, justifyContent: cs.justifyContent },
        rects: els.map(e => { if (!e) return null; const r = e.getBoundingClientRect(); return [r.x - nr.x, r.y - nr.y, r.width, r.height].map(v=>Math.round(v*100)/100); }) };
    }
    return null;
  }, ids);
  log("dom", JSON.stringify(dom));
  const skiaRel = [info.nav, ...info.kids].map(r => r && [r[0]-info.nav[0], r[1]-info.nav[1], r[2], r[3]]);
  log("skia rel", JSON.stringify(skiaRel));
  // DOM 자식 rect 는 DOMKIDS 순서 (button, button, separator, button) — Skia kids 순서와 같다 (origin 자식 순서).
  const bad = [];
  const D = dom?.rects; const S = skiaRel;
  if (!D || D.slice(1).some(r => !r)) bad.push("DOM 자식 rect 누락");
  else {
    if (Math.abs(S[0][3] - D[0][3]) > 1) bad.push(`root h skia=${S[0][3]} dom=${D[0][3]}`);
    if (Math.abs(S[3][1] - D[3][1]) > 1 || Math.abs(S[3][3] - D[3][3]) > 1) bad.push(`separator y/h skia=${S[3][1]}/${S[3][3]} dom=${D[3][1]}/${D[3][3]}`);
    const gb = (r) => r[3][0] - (r[2][0] + r[2][2]), ga = (r) => r[4][0] - (r[3][0] + r[3][2]);
    if (Math.abs(gb(S) - gb(D)) > 1) bad.push(`separator 앞 간격 skia=${gb(S)} dom=${gb(D)}`);
    if (Math.abs(ga(S) - ga(D)) > 1) bad.push(`separator 뒤 간격 skia=${ga(S)} dom=${ga(D)}`);
    if (Math.abs(S[0][2] - D[0][2]) > 2.5 * 3) bad.push(`root w skia=${S[0][2]} dom=${D[0][2]} (버튼 3 × 2.5 초과)`);
  }
  const pass = bad.length === 0;
  if (!pass) log("bad", JSON.stringify(bad));
  log(pass ? "PASS — Toolbar h · separator y · 좌우 간격 Skia = DOM (Δ ≤ 1 — 수리 전 29/22 · 간격 8/18)" : "FAIL — rect 불일치");
  log("pageerrors", errors.length);
} finally { await browser.close(); }

// nav-factory-catalog-live.mjs — factory Nav 의 gap/padding 인라인 미러 제거 후 catalog 단일 공급 live (2026-09-18).
//   사용: node apps/builder/scripts/nav-factory-catalog-live.mjs  (dev 5173 · .auth-session.json · headed)
// factory Nav 인라인 gap/padding 제거 live — Skia layout rect vs Preview DOM rect (Nav + Link 3)
import { chromium } from "playwright";
import { resolve } from "node:path";
import { waitReady } from "./perf-baseline.mjs";
const BASE_URL = process.env.BUILDER_URL ?? "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const log = (...a) => console.log("[nav live]", ...a);
const RAIL = ["navigator","components","datatable","datatableEditor","theme","ai","properties","styles","interactions","history"];
async function setPanel(page, id, open) {
  const b = page.locator(".panel-toggle-rail button").nth(RAIL.indexOf(id));
  if (((await b.getAttribute("aria-pressed")) === "true") !== open) { await b.click(); await page.waitForTimeout(900); }
}
async function addFromPalette(page, type) {
  await setPanel(page, "components", true);
  await page.evaluate(() => window.__composition_STORE__.getState().setSelectedElement(null));
  const before = await page.evaluate((t) => window.__composition_STORE__.getState().elements.filter(e => e.type===t).map(e=>e.id), type);
  const search = page.locator('[data-panel-id="components"] input').first();
  await search.waitFor({ state: "visible", timeout: 20000 });
  await search.fill(type); await page.waitForTimeout(400);
  const items = page.locator('[data-panel-id="components"] .list-item');
  const n = await items.count(); let item = null;
  // 팔레트 이름은 로케일 번역 (ko "내비게이션") — 이름 대신 검색 결과 1건이면 그것, 아니면 en 이름 매칭
  const names = []; for (let i=0;i<n;i++) names.push(((await items.nth(i).locator(".list-item-name").textContent())??"").trim());
  const idx = n === 1 ? 0 : names.findIndex(l => l.replace(/\s+/g,"").toLowerCase()===type.toLowerCase() || l === "내비게이션");
  if (idx >= 0) item = items.nth(idx);
  if(!item) throw new Error("no palette "+type);
  await item.click();
  const id = await page.waitForFunction(({t,before}) => window.__composition_STORE__.getState().elements.find(e=>e.type===t && !before.includes(e.id))?.id ?? null, {t:type,before},{timeout:15000}).then(h=>h.jsonValue());
  await page.waitForTimeout(1200);
  await setPanel(page, "components", false);
  return id;
}
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ storageState: STORAGE_STATE, viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = []; page.on("pageerror", e => errors.push(String(e)));
try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20000 }); await create.click();
  const input = page.locator("#new-project-name"); await input.waitFor({ state: "visible", timeout: 10000 });
  await input.fill(`navlive-${Date.now()}`); await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90000 }); await waitReady(page);
  const navId = await addFromPalette(page, "Nav");
  const info = await page.evaluate((id) => {
    const st = window.__composition_STORE__.getState();
    const nav = st.elements.find(e => e.id === id);
    const kids = st.elements.filter(e => e.parent_id === id).map(e => e.id);
    const lm = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    const r = (i) => { const l = lm?.get(i); return l ? [l.x,l.y,l.width,l.height].map(v=>Math.round(v*100)/100) : null; };
    return { style: nav?.props?.style, nav: r(id), kids: kids.map(r), kidIds: kids };
  }, navId);
  log("store style", JSON.stringify(info.style));
  log("skia nav", info.nav, "kids", JSON.stringify(info.kids));
  // Compare mode → preview iframe
  const compare = page.locator(".header_right .builder-control-group button").first();
  if ((await compare.getAttribute("aria-pressed")) !== "true" && (await compare.getAttribute("aria-checked")) !== "true") { await compare.click(); await page.waitForTimeout(3000); }
  const ids = [navId, ...info.kidIds];
  await page.waitForFunction((ids) => [...document.querySelectorAll("iframe")].some(f => ids.every(id => f.contentDocument?.querySelector(`[data-element-id^="${id}"]`))), ids, { timeout: 15000 }).catch(()=>{});
  const dom = await page.evaluate((ids) => {
    for (const f of document.querySelectorAll("iframe")) {
      const d = f.contentDocument; if (!d) continue;
      // wrapper 가 display:contents 로 같은 data-element-id 를 달 수 있다 — 실제 상자 (nav / a) 를 잡는다
      const els = ids.map(id => d.querySelector(`nav[data-element-id^="${id}"], a[data-element-id^="${id}"]`) ?? d.querySelector(`[data-element-id^="${id}"]`)); if (els.some(e=>!e)) continue;
      const navEl = els[0]; const nr = navEl.getBoundingClientRect(); const cs = getComputedStyle(navEl);
      return { cls: navEl.className, size: navEl.dataset.size, variant: navEl.dataset.variant,
        computed: { padding: cs.padding, gap: cs.gap, height: cs.height, display: cs.display, alignItems: cs.alignItems, justifyContent: cs.justifyContent },
        rects: els.map(e => { const r = e.getBoundingClientRect(); return [r.x - nr.x, r.y - nr.y, r.width, r.height].map(v=>Math.round(v*100)/100); }) };
    }
    return null;
  }, ids);
  log("dom", JSON.stringify(dom));
  const skiaRel = [info.nav, ...info.kids].map(r => r && [r[0]-info.nav[0], r[1]-info.nav[1], r[2], r[3]]);
  log("skia rel", JSON.stringify(skiaRel));
  // Nav 폭 (width:100%) 은 viewport 폭 — Skia scene 1920 vs Compare iframe 반폭 — 이라 비교에서 뺀다.
  let pass = !!dom && skiaRel.every((s, i) => s && dom.rects[i] && s.every((v, k) => (i === 0 && k === 2) || Math.abs(v - dom.rects[i][k]) <= 2.5));
  pass = pass && dom.computed.padding === "12px 16px" && dom.computed.gap === "12px" && dom.computed.height === "56px";
  log(pass ? "PASS — Skia/DOM rect 일치 (±2.5, 텍스트 run 폭 차)" : "FAIL — rect 불일치");
  log("pageerrors", errors.length);
} finally { await browser.close(); }

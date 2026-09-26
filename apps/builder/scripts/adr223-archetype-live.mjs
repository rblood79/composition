// adr223-archetype-live.mjs — ADR-223 G3: archetype 미지정 base 중립화 live (2026-09-18).
//   사용: node apps/builder/scripts/adr223-archetype-live.mjs  (dev 5173 · .auth-session.json · headed)
//   팔레트 7종 (Toolbar · TableView · Disclosure · Pagination · Card · Tabs · GridList) 을 추가해
//   Skia scene rect (root 상대) vs Preview iframe DOM rect Δ ≤ 2.5 · computed cursor/user-select/transition
//   이 breakdown §3 판정과 일치하는지 · pageerror 0. Compare Mode 는 캔버스를 반폭으로 줄이므로
//   (메모리 feedback-compare-mode-halves-canvas-hides-area-delta) width:100% root 의 폭은 비교에서 뺀다.
import { chromium } from "playwright";
import { resolve } from "node:path";
import { waitReady } from "./perf-baseline.mjs";
const BASE_URL = process.env.BUILDER_URL ?? "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const log = (...a) => console.log("[adr223 live]", ...a);
const RAIL = ["navigator","components","datatable","datatableEditor","theme","ai","properties","styles","interactions","history"];
const TOL = 2.5;
/** 팔레트 type → DOM chrome selector (rootSelectors / 정렬 판정을 재는 요소) + §3 기대 interaction */
const TARGETS = [
  // known: ADR-223 (archetype base) 과 무관한 **기존** 발산 — G2-B before/after arm 과 생성 CSS diff 0 으로 확인.
  //   축이 다르므로 판정에서 분리해 기록만 한다 (docs/adr/evidence/223-phase2-g2.md §G3).
  { type: "Toolbar",    chrome: ".react-aria-Toolbar",      expect: { cursor: "auto",    userSelect: "auto", transitionBg: false },
    // 2026-09-18 후속 4 로 닫힘 (Separator margin 축 + Toolbar staticSelectors 를 layout 이 읽는다). 남는 것은 버튼 텍스트
    //   측정 차 (CanvasKit vs DOM, 버튼당 ≤ 2.5 · 3개 누적) 뿐 — 구조 축은 `toolbar-separator-live.mjs` 가 Δ ≤ 1.
    known: [{ re: /^ref\.w /, why: "Button 텍스트 run 폭 차 (≤ 2.5/버튼) 누적 — 구조 축 아님" }] },
  { type: "TableView",  chrome: ".react-aria-TableView",    expect: { cursor: "auto",    userSelect: "auto", transitionBg: false }, known: [] },
  { type: "Disclosure", chrome: ".react-aria-Disclosure",   expect: { cursor: "auto",    userSelect: "auto", transitionBg: false }, known: [] },
  { type: "Pagination", chrome: ".react-aria-Pagination",   expect: { cursor: "auto",    userSelect: "auto", transitionBg: false, alignItems: "center" },
    // 2026-09-18 후속 1 로 닫힘 (renderPagination catalogChrome) — known 없음
    known: [] },
  { type: "Card",       chrome: ".react-aria-Card",         expect: { cursor: "pointer", userSelect: "auto", transitionBg: false }, known: [] },
  { type: "Tabs",       chrome: ".react-aria-Tab",          expect: { cursor: "pointer", userSelect: "none", transitionBg: true },
    // 2026-09-18 후속 3 으로 닫힘 (TabPanels 래퍼 padding 0 — Tabs 53 = 53). 이 하니스는 **부모 기준** rect 라 TabPanel 의
    //   부모가 다르다 (Skia 는 TabPanels 래퍼 (0) · DOM 은 Tabs 직계 (29)) — Tabs 기준 y 29 = 29 는 `tabs-panel-wrapper-live.mjs`.
    known: [{ re: /^TabPanel\.y /, why: "부모 기준 좌표계 차이 (Skia TabPanels 래퍼 vs DOM Tabs 직계) — Tabs 기준은 일치" }] },
  // 수동 GridList.css 가 cursor:pointer · `transition: all 150ms` 를 재선언 (transitionProperty = "all")
  { type: "GridList",   chrome: ".react-aria-GridListItem", expect: { cursor: "pointer", userSelect: "auto", transitionAll: true }, known: [] },
];
async function setPanel(page, id, open) {
  const b = page.locator(".panel-toggle-rail button").nth(RAIL.indexOf(id));
  if (((await b.getAttribute("aria-pressed")) === "true") !== open) { await b.click(); await page.waitForTimeout(900); }
}
/** 팔레트 검색 (type 정확 일치 = 최고 점수 → 첫 항목) 후 클릭. 새로 생긴 요소 전부 (ref 해석 포함) 를 돌려준다. */
async function addFromPalette(page, type) {
  await setPanel(page, "components", true);
  await page.evaluate(() => window.__composition_STORE__.getState().setSelectedElement(null));
  const before = await page.evaluate(() => window.__composition_STORE__.getState().elements.map(e => e.id));
  const search = page.locator('[data-panel-id="components"] input').first();
  await search.waitFor({ state: "visible", timeout: 20000 });
  await search.fill(type); await page.waitForTimeout(400);
  const items = page.locator('[data-panel-id="components"] .list-item');
  if ((await items.count()) === 0) throw new Error("no palette " + type);
  await items.first().click();
  await page.waitForFunction((before) => window.__composition_STORE__.getState().elements.some(e => !before.includes(e.id)), before, { timeout: 15000 });
  await page.waitForTimeout(1500);
  await setPanel(page, "components", false);
  return page.evaluate((before) => {
    const st = window.__composition_STORE__.getState();
    const fresh = st.elements.filter(e => !before.includes(e.id));
    const ids = new Set(fresh.map(e => e.id));
    const root = fresh.find(e => !ids.has(e.parent_id));
    return { rootId: root?.id ?? null, rootType: root?.type ?? null, nodes: fresh.map(e => ({ id: e.id, type: e.type, parent: e.parent_id })) };
  }, before);
}
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({ storageState: STORAGE_STATE, viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = []; page.on("pageerror", e => errors.push(String(e)));
const results = [];
try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20000 }); await create.click();
  const input = page.locator("#new-project-name"); await input.waitFor({ state: "visible", timeout: 10000 });
  await input.fill(`adr223-${Date.now()}`); await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90000 }); await waitReady(page);

  const added = [];
  for (const t of TARGETS) {
    const a = await addFromPalette(page, t.type);
    log(`added ${t.type} → root ${a.rootType} ${a.rootId} (${a.nodes.length} nodes)`);
    added.push({ ...t, ...a });
  }
  // Skia rects — `ComputedLayout` 은 **부모 기준** x/y (LayoutEngine.ts:18). ref instance (Toolbar · Card ·
  //   GridList) 의 해석된 자식은 store elements 에 없고 layout map 에 root id 접두 키로만 있다 → 접두 키를 노드로 합친다.
  const skia = await page.evaluate((all) => {
    const lm = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    const rects = {}, extra = {};
    for (const a of all) {
      extra[a.rootId] = [];
      for (const [k, l] of lm ?? []) {
        const isProjRow = a.type === "GridList" && k.startsWith(`projection:gridlist-row:${a.rootId}:`);
        if (k === a.rootId || a.nodes.some(n => n.id === k) || k.startsWith(a.rootId) || isProjRow) {
          rects[k] = [l.x, l.y, l.width, l.height];
          if (k !== a.rootId && !a.nodes.some(n => n.id === k)) extra[a.rootId].push(k);
        }
      }
    }
    return { rects, extra };
  }, added);
  for (const a of added) { for (const k of skia.extra[a.rootId]) a.nodes.push({ id: k, type: k.startsWith("projection:gridlist-row:") ? "GridListItem(row)" : "(instance)", parent: null }); }
  // 진단: store 에 없는 layout map 키 (ref instance 해석 자식) 의 형태 + 페이지 (body) 폭
  const diag = await page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    const ids = new Set(st.elements.map(e => e.id));
    const lm = window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap();
    const foreign = [...lm.keys()].filter(k => !ids.has(k));
    const body = st.elements.find(e => e.type === "body");
    const bl = body ? lm.get(body.id) : null;
    const grid = foreign.filter(k => k.includes("gridlist")).map(k => [k, [lm.get(k).x, lm.get(k).y, lm.get(k).width, lm.get(k).height].map(v => Math.round(v))]);
    return { foreign: foreign.slice(0, 8), foreignCount: foreign.length, pageW: bl?.width ?? null, bodyId: body?.id ?? null, grid };
  });
  log("diag", JSON.stringify(diag));
  const PAGE_W = diag.pageW ?? 1920;
  // Compare Mode 한 번 → preview iframe. 반폭 함정: iframe 폭을 Skia 페이지 폭 (1920) 으로 강제해 width:100% 계열을 같은 조건에서 잰다.
  const compare = page.locator(".header_right .builder-control-group button").first();
  if ((await compare.getAttribute("aria-pressed")) !== "true" && (await compare.getAttribute("aria-checked")) !== "true") { await compare.click(); await page.waitForTimeout(3500); }
  const rootIds = added.map(a => a.rootId);
  await page.waitForFunction((ids) => [...document.querySelectorAll("iframe")].some(f => ids.every(id => f.contentDocument?.querySelector(`[data-element-id^="${id}"]`))), rootIds, { timeout: 20000 }).catch(() => log("warn: preview iframe 에 root 일부 미도달"));
  await page.evaluate((w) => { for (const f of document.querySelectorAll("iframe")) { f.style.width = `${w}px`; f.style.minWidth = `${w}px`; f.style.maxWidth = "none"; } }, PAGE_W);
  await page.waitForTimeout(1200);
  const dom = await page.evaluate((all) => {
    const boxOf = (el) => { const r = el.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; };
    const boxEl = (d, id) => {
      // display:contents 래퍼가 같은 id 를 달 수 있다 — 상자를 내는 첫 요소
      for (const el of d.querySelectorAll(`[data-element-id^="${id}"]`)) { const r = el.getBoundingClientRect(); if (r.width > 0 || r.height > 0) return el; }
      return d.querySelector(`[data-element-id^="${id}"]`);
    };
    const parentBox = (el) => { let p = el.parentElement; while (p) { if (p.dataset.elementId) { const r = p.getBoundingClientRect(); if (r.width > 0 || r.height > 0) return boxOf(p); } p = p.parentElement; } return null; };
    for (const f of document.querySelectorAll("iframe")) {
      const d = f.contentDocument; if (!d) continue;
      if (!all.every(a => d.querySelector(`[data-element-id^="${a.rootId}"]`))) continue;
      const out = { viewportW: d.documentElement.clientWidth };
      for (const a of all) {
        const rootEl = boxEl(d, a.rootId);
        const rects = {}, rel = {};
        for (const n of a.nodes) { const el = boxEl(d, n.id); if (el) { const b = boxOf(el); rects[n.id] = b; const pb = parentBox(el); rel[n.id] = pb ? [b[0]-pb[0], b[1]-pb[1], b[2], b[3]] : null; } }
        if (a.type === "GridList" && rootEl) {
          // projection row i ↔ DOM GridListItem i (둘 다 root 기준 상대 — Skia rows 컨테이너는 root 와 같은 원점 0,0)
          const items = [...rootEl.querySelectorAll(".react-aria-GridListItem")];
          const rb = boxOf(rootEl);
          a.nodes.filter(n => n.type === "GridListItem(row)").forEach((n, i) => { const it = items[i]; if (it) { const b = boxOf(it); rects[n.id] = b; rel[n.id] = [b[0]-rb[0], b[1]-rb[1], b[2], b[3]]; } });
        }
        const chrome = (rootEl?.matches(a.chrome) ? rootEl : rootEl?.querySelector(a.chrome)) ?? null;
        const domItemKids = a.type === "GridList" && rootEl ? [...rootEl.querySelectorAll(".react-aria-GridListItem")].slice(0, 2).map(it => ({ item: boxOf(it).map(v=>Math.round(v)), kids: [...it.querySelectorAll("*")].filter(k => k.getBoundingClientRect().width > 0).slice(0, 6).map(k => `${k.tagName.toLowerCase()}.${String(k.className).split(" ")[0]}:${boxOf(k).map(v=>Math.round(v)).join(",")}`) })) : null;
        const domKids = rootEl ? [...rootEl.children].map(c => `${c.tagName.toLowerCase()}.${String(c.className).split(" ")[0]}#${c.dataset.elementId ?? ""}:${boxOf(c).map(v=>Math.round(v)).join(",")}`) : [];
        const cs = chrome ? getComputedStyle(chrome) : null;
        out[a.type] = { rects, rel, domKids, domItemKids, chromeFound: !!chrome, rootTag: rootEl?.tagName.toLowerCase(), rootClass: rootEl?.className, computed: cs && { cursor: cs.cursor, userSelect: cs.userSelect, transitionProperty: cs.transitionProperty, display: cs.display, alignItems: cs.alignItems, justifyContent: cs.justifyContent } };
      }
      return out;
    }
    return null;
  }, added);
  if (!dom) throw new Error("preview iframe 에서 root 전부를 못 찾음");
  log("preview viewport width", dom.viewportW);

  let allPass = true;
  for (const a of added) {
    const r = dom[a.type];
    const sRoot = skia.rects[a.rootId], dRoot = r.rects[a.rootId];
    const bad = []; let compared = 0;
    if (!sRoot || !dRoot) bad.push("root rect 없음");
    else {
      // root: w/h 만 (위치는 페이지 안 배치). 자식: 부모 기준 x/y + w/h.
      for (let k = 2; k < 4; k++) if (Math.abs(sRoot[k] - dRoot[k]) > TOL) bad.push(`${a.rootType}.${"xywh"[k]} skia=${sRoot[k].toFixed(1)} dom=${dRoot[k].toFixed(1)}`);
      compared++;
      for (const n of a.nodes) {
        if (n.id === a.rootId) continue;
        const s = skia.rects[n.id], d = r.rel[n.id];
        if (!s || !d) continue; // 한쪽에만 있는 노드 (portal · 합성 자식) 는 비교 밖
        compared++;
        for (let k = 0; k < 4; k++) if (Math.abs(s[k] - d[k]) > TOL) bad.push(`${n.type}.${"xywh"[k]} skia=${s[k].toFixed(1)} dom=${d[k].toFixed(1)}`);
      }
    }
    if (!r.chromeFound) bad.push("chrome 없음");
    const c = r.computed;
    const inter = !c ? null : c.cursor === a.expect.cursor && c.userSelect === a.expect.userSelect
      && (a.expect.transitionAll ? c.transitionProperty === "all" : (/background/.test(c.transitionProperty) === a.expect.transitionBg))
      && (!a.expect.alignItems || c.alignItems === a.expect.alignItems);
    if (inter === false) bad.push(`interaction 불일치 ${JSON.stringify(c)} ≠ ${JSON.stringify(a.expect)}`);
    // GridList 카드 자식 x parity: 텍스트 span 의 x = item x + padding 16 + border 1, 폭 = item 폭 − 34 (stretch — 종전 base align-items:center 면 가운데·수축)
    if (a.type === "GridList" && r.domItemKids) for (const it of r.domItemKids) { const [ix,,iw] = it.item; for (const k of it.kids) { const [x,,w] = k.split(":")[1].split(",").map(Number); if (Math.abs(x - ix - 17) > TOL || Math.abs(w - (iw - 34)) > TOL) bad.push(`GridListItem 자식 x/w ${k} (item ${it.item})`); } }
    const known = [], rest = [];
    for (const b of bad) { const k = a.known.find(k => k.re.test(b)); (k ? known : rest).push(k ? `${b} ← ${k.why}` : b); }
    const pass = rest.length === 0;
    allPass = allPass && pass;
    results.push({ type: a.type, pass, compared, rest, known, computed: c });
    log(`${pass ? "PASS" : "FAIL"} ${a.type} — root <${r.rootTag} class="${r.rootClass}"> rect 비교 ${compared} 노드${rest.length ? " 발산: " + rest.join(" · ") : ""} · computed ${JSON.stringify(c)}`);
    for (const k of known) log(`   known (ADR-223 축 아님): ${k}`);
    if (a.type === "GridList") log("   gridlist skia projection " + JSON.stringify(diag.grid) + "\n   dom items " + JSON.stringify(r.domItemKids));
    if (!pass) log(`   skia nodes ${JSON.stringify(a.nodes.map(n => [n.type, n.id.slice(0,8), skia.rects[n.id]?.map(v=>Math.round(v))]))}\n   dom kids ${JSON.stringify(r.domKids)}`);
  }
  log(allPass ? "ALL PASS" : "SOME FAIL");
  log("pageerrors", errors.length, errors.slice(0, 3));
} finally { await browser.close(); }

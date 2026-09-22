#!/usr/bin/env node
// adr227-components-theme-live.mjs — ADR-227 Phase 5 G5 live (실제 빌더 · Components 페이지 origin/instance/slot
//   표면 · headed Playwright — Compare Mode 없음. 테마 쓰기는 Phase 4 가 UI 로 검증한 같은 themeActions 경로를
//   dev 핸들로 호출한다).
//   C1) 새 프로젝트 · 홈 페이지에 Form instance (ref component-form) + accent Button instance + 600 요소 seed ·
//       Components 페이지로 이동 → catalog origin ≥ 57 · 상태 변형 origin · template origin (Form) 존재.
//   C2) 테마 복제 + Tint Red (Brand) → Default 활성 → Brand 활성: 전환마다 **현재 페이지 history +1 (type theme) ·
//       다른 페이지 +0** · canonical `children[]` JSON 무변화 (origin/instance/slot 구조) · legacy view 트리 무변화 ·
//       origin 기하 무변화 · origin accent Button (`component-form__actions/component-buttongroup__2`) 픽셀 파랑 → 빨강.
//   C3) 같은 테마 재선택 → 모든 페이지 history +0 · themeVersion 무변화 · 문서 객체 동일 (no-op).
//   C4) 홈 페이지로 이동 → Form instance 안 accent Button + accent Button instance 픽셀 빨강 (origin 과 같이 간다) ·
//       canonical JSON 여전히 무변화.
//   C5) Components 페이지에서 Undo → Default (파랑) · Redo → Brand (빨강) · history 길이 불변.
//   C6) 전환 비용: Components 페이지 (origin 전집) 와 홈 페이지 (600+ 요소) 각각 10회 (sync + 다음 프레임) 최대 ≤ 25ms
//       — 카메라는 한 페이지만 보이게 (공유 layout map = 보이는 페이지 전부).
//   page error 0.
// 사용: node apps/builder/scripts/adr227-components-theme-live.mjs [--headed]
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { seedDocument, waitReady } from "./perf-baseline.mjs";

const require = createRequire(import.meta.url);
const { PNG } = require(
  resolve("node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs"),
);

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR227_OUT ?? "/private/tmp/adr227-p5-live";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[adr227 p5]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail ?? ""}`);
};
mkdirSync(OUT_DIR, { recursive: true });

const FORM_INST = "adr227-form-inst";
const ACCENT_INST = "adr227-accent";
const ORIGIN_ACCENT = "component-form__actions/component-buttongroup__2";
const INST_ACCENT = `${FORM_INST}/ButtonGroup/component-buttongroup__2`;
const state = (page, fn, arg) => page.evaluate(fn, arg);

const currentPage = (page) =>
  state(page, () => window.__composition_STORE__.getState().currentPageId);
const switchPage = (page, pageId) =>
  state(
    page,
    (pageId) =>
      window.__composition_STORE__.getState().setCurrentPageId?.(pageId),
    pageId,
  );
const historyAll = (page) =>
  state(page, () => ({
    current: window.__composition_STORE__.getState().currentPageId,
    counts: window.__composition_HISTORY_DEBUG__?.getAllPageEntryCounts?.() ?? {},
    types: window.__composition_HISTORY_DEBUG__?.getCurrentPageEntryTypes?.() ?? [],
  }));
const sumCounts = (c) => Object.values(c).reduce((a, b) => a + b, 0);
const themesState = (page) =>
  state(page, () => {
    const c = window.__composition_THEME_ACTIONS__.readThemesCollection();
    const t = window.__composition_THEME_CONFIG__.getState();
    return {
      active: c?.active,
      order: c?.order,
      tints: c ? c.order.map((id) => c.items[id].preset.tint) : [],
      themeVersion: t.themeVersion,
      tint: t.tint,
    };
  });
/** canonical 문서 `children[]` (origin/instance/slot 구조 정본) 의 JSON — themes 는 제외한 구조 축. */
const canonicalChildrenJson = (page) =>
  state(page, () => {
    const c = window.__canonical_STORE__.getState();
    const doc = c.documents.get(c.currentProjectId);
    return JSON.stringify(doc?.children ?? null);
  });
const docIdentity = (page) =>
  state(page, () => {
    const c = window.__canonical_STORE__.getState();
    const doc = c.documents.get(c.currentProjectId);
    window.__adr227_lastDoc = window.__adr227_lastDoc ?? doc;
    const same = window.__adr227_lastDoc === doc;
    window.__adr227_lastDoc = doc;
    return same;
  });
/** legacy view (elements) 의 Components 페이지 트리 — ADR-230 하니스와 같은 축 (fill id · metadata 제외). */
const componentsTreeJson = (page) =>
  state(page, () => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find((e) => e.id === "page-components-body");
    const byParent = new Map();
    for (const e of st.elements) {
      const arr = byParent.get(e.parent_id) ?? [];
      arr.push(e);
      byParent.set(e.parent_id, arr);
    }
    const walk = (id) =>
      (byParent.get(id) ?? []).map((e) => ({
        id: e.id,
        type: e.type,
        ref: e.ref ?? null,
        reusable: !!e.reusable,
        props: e.props ?? {},
        children: walk(e.id),
      }));
    return JSON.stringify(walk(body?.id));
  });
/** origin 기하 (테마 tint 전환은 기하를 바꾸지 않는다) — 공유 layout map 은 다른 페이지 항목도 품어 size 는 오라클이 못 된다. */
const layoutRects = (page, ids) =>
  state(
    page,
    (ids) =>
      JSON.stringify(
        ids.map((id) => {
          const l = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.().get(id);
          return l ? [l.x, l.y, l.width, l.height] : null;
        }),
      ),
    ids,
  );
const waitForLayoutKey = async (page, key, ms = 15_000) => {
  await showCurrentPage(page);
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const has = await state(
      page,
      (key) => window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.().has(key) ?? false,
      key,
    );
    if (has) return true;
    await page.waitForTimeout(300);
  }
  return false;
};
const layoutKeysWith = (page, needle) =>
  state(
    page,
    (needle) =>
      [...(window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.().keys() ?? [])].filter(
        (k) => k.includes(needle),
      ),
    needle,
  );

/**
 * layout map 의 절대 (페이지 기준) rect — 자손 키 (`a/b`) 와 legacy 자식 (parent_id) 의 rect 는 부모 기준이라
 * 체인을 body 까지 더한다. 공유 layout map 은 **카메라에 보이는 페이지만** 담는다 (viewport culling) —
 * 다른 페이지로 옮긴 직후엔 그 페이지 요소가 없으므로 먼저 페이지 좌상단으로 카메라를 옮긴 뒤 다시 잰다.
 */
const absRect = (page, id) =>
  state(
    page,
    (id) => {
      const st = window.__composition_STORE__.getState();
      const m = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.();
      if (!m) return null;
      const byId = new Map(st.elements.map((e) => [e.id, e]));
      let cur = id;
      let x = 0;
      let y = 0;
      const self = m.get(id);
      if (!self) return null;
      while (cur) {
        const el = byId.get(cur);
        if (el?.type === "body") break;
        const l = m.get(cur);
        if (!l) return null;
        x += l.x;
        y += l.y;
        if (cur.includes("/")) cur = cur.slice(0, cur.lastIndexOf("/"));
        else cur = el?.parent_id ?? null;
      }
      return { x, y, width: self.width, height: self.height };
    },
    id,
  );
const pagePos = (page) =>
  state(page, () => {
    const st = window.__composition_STORE__.getState();
    const positions = st.pagePositions;
    return (
      (positions instanceof Map
        ? positions.get(st.currentPageId)
        : positions?.[st.currentPageId]) ?? { x: 0, y: 0 }
    );
  });
const applyViewport = (page, v) =>
  state(
    page,
    (v) => {
      window.__composition_APPLY_VIEWPORT__?.(v);
      window.__composition_STORE__.getState().setSelectedElement(null);
    },
    v,
  );
/** 현재 페이지 좌상단을 (100,140) 에 — 그 페이지 요소가 layout map 에 실리게 한다. */
async function showCurrentPage(page) {
  const pos = await pagePos(page);
  await applyViewport(page, { scale: 1, x: 100 - pos.x, y: 140 - pos.y });
  await page.waitForTimeout(900);
}
async function focusOn(page, id, at = { x: 700, y: 420 }) {
  let r = await absRect(page, id);
  if (!r) {
    await showCurrentPage(page);
    r = await absRect(page, id);
  }
  const pos = await pagePos(page);
  await applyViewport(page, {
    scale: 1,
    x: at.x - (pos.x + (r?.x ?? 0)),
    y: at.y - (pos.y + (r?.y ?? 0)),
  });
  await page.waitForTimeout(900);
}
const screenRect = async (page, id) => {
  const r = await absRect(page, id);
  if (!r) return null;
  const pos = await pagePos(page);
  const vp = await state(page, () => window.__composition_VIEWPORT__?.() ?? null);
  const pan = vp?.panOffset ?? { x: 0, y: 0 };
  const zoom = vp?.zoom ?? 1;
  return {
    x: pan.x + (pos.x + r.x) * zoom,
    y: pan.y + (pos.y + r.y) * zoom,
    w: r.width * zoom,
    h: r.height * zoom,
  };
};
/** 요소 안쪽 (x+5, mid) 픽셀 — Phase 4 하니스와 같은 오라클. */
async function fillPixel(page, id, name) {
  await focusOn(page, id);
  await page.mouse.move(2, 890);
  await page.waitForTimeout(500);
  const rect = await screenRect(page, id);
  if (!rect) return { fill: null, rect: null };
  const box = await page.locator("canvas").first().boundingBox();
  const png = await page.screenshot({ type: "png", animations: "disabled" });
  if (name) writeFileSync(resolve(OUT_DIR, `${name}.png`), png);
  const p = PNG.sync.read(png);
  const sx = Math.round(box.x + rect.x + 5);
  const sy = Math.round(box.y + rect.y + rect.h / 2);
  const i = (sy * p.width + sx) * 4;
  return { fill: [p.data[i], p.data[i + 1], p.data[i + 2]], rect };
}
const isBluish = ([r, g, b]) => b > 150 && b - r > 60 && b - g > 40;
const isReddish = ([r, g, b]) => r > 150 && r - g > 60 && r - b > 60;

const setActive = (page, id) =>
  state(
    page,
    (id) => window.__composition_THEME_ACTIONS__.setActiveTheme(id),
    id,
  );
const perfSwitch = (page, [a, b], n = 6) =>
  state(
    page,
    ([a, b, n]) =>
      new Promise((resolve) => {
        const act = window.__composition_THEME_ACTIONS__;
        const runs = [];
        let i = 0;
        const step = () => {
          const target = i % 2 === 0 ? a : b;
          const t0 = performance.now();
          act.setActiveTheme(target);
          const sync = performance.now() - t0;
          requestAnimationFrame(() => {
            const t1 = performance.now();
            requestAnimationFrame(() => {
              runs.push({
                sync: +sync.toFixed(2),
                frame: +(performance.now() - t1).toFixed(2),
              });
              i += 1;
              if (i < n) step();
              else resolve(runs);
            });
          });
        };
        step();
      }),
    [a, b, n],
  );

const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({
  storageState: STORAGE_STATE,
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr227p5-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  await page.waitForTimeout(1500);

  const homePageId = await currentPage(page);
  await state(
    page,
    ({ FORM_INST, ACCENT_INST }) => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find(
        (e) => e.type === "body" && e.page_id === st.currentPageId,
      );
      const now = new Date().toISOString();
      st.addElement({
        id: FORM_INST,
        customId: FORM_INST,
        type: "ref",
        ref: "component-form",
        componentName: "Form",
        parent_id: body.id,
        page_id: st.currentPageId,
        props: {},
        created_at: now,
        updated_at: now,
      });
      st.addElement({
        id: ACCENT_INST,
        customId: ACCENT_INST,
        type: "ref",
        ref: "component-button",
        componentName: "Button",
        parent_id: body.id,
        page_id: st.currentPageId,
        props: { children: "Accent", variant: "accent" },
        created_at: now,
        updated_at: now,
      });
    },
    { FORM_INST, ACCENT_INST },
  );
  await seedDocument(page, 600, "mixed", 1);
  await page.waitForTimeout(2500);

  const pages = await state(page, () =>
    window.__composition_STORE__.getState().pages.map((p) => ({
      id: p.id,
      title: p.title,
    })),
  );
  const componentsPage = pages.find(
    (p) => p.id === "page-components" || /components/i.test(p.title),
  );
  if (!componentsPage) throw new Error("Components 페이지 없음");
  await switchPage(page, componentsPage.id);
  await page.waitForTimeout(2000);
  await waitForLayoutKey(page, ORIGIN_ACCENT);

  // ── C1 ──
  const origins = await state(page, () => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find((e) => e.id === "page-components-body");
    const kids = st.elements.filter((e) => e.parent_id === body?.id);
    const by = (t) => kids.filter((e) => e.metadata?.type === t).length;
    return {
      children: kids.length,
      reusable: kids.filter((e) => e.reusable).length,
      catalog: by("catalog-origin"),
      metaTypes: [...new Set(kids.map((e) => e.metadata?.type ?? "-"))],
      hasForm: kids.some((e) => e.id === "component-form"),
      elements: st.elements.length,
    };
  });
  const originAccentKeys = await layoutKeysWith(page, ORIGIN_ACCENT);
  record(
    "C1: Components 페이지 — catalog origin ≥ 57 · Form template origin · reusable 전집 · 요소 600+ · origin accent Button layout 존재",
    origins.catalog >= 57 &&
      origins.hasForm &&
      origins.reusable >= 60 &&
      origins.elements >= 600 &&
      originAccentKeys.length >= 1,
    JSON.stringify({ origins, originAccentKeys }),
  );

  // ── C2 ──
  // 활성 복제 → 두 번째 활성 → Tint Red = Brand (entry 3, 준비 단계) · 이후 전환 2회가 검증 대상
  await state(page, () => {
    const a = window.__composition_THEME_ACTIONS__;
    a.addThemeFromActive();
    a.setActiveTheme(a.readThemesCollection().order[1]);
    a.setActiveThemePreset({ tint: "red" });
  });
  await page.waitForTimeout(1200);
  const s2 = await themesState(page);
  const [defaultId, brandId] = s2.order;
  const canon0 = await canonicalChildrenJson(page);
  const tree0 = await componentsTreeJson(page);
  const GEOM_IDS = [ORIGIN_ACCENT, "component-form", "component-button"];
  const layout0 = await layoutRects(page, GEOM_IDS);
  const h0 = await historyAll(page);
  await docIdentity(page);

  await setActive(page, defaultId);
  await page.waitForTimeout(1200);
  const h1 = await historyAll(page);
  const p1 = await fillPixel(page, ORIGIN_ACCENT, "c2-origin-default");
  if (!p1.fill) p1.fill = [0, 0, 0];
  await setActive(page, brandId);
  await page.waitForTimeout(1200);
  const h2 = await historyAll(page);
  const p2 = await fillPixel(page, ORIGIN_ACCENT, "c2-origin-brand");
  if (!p2.fill) p2.fill = [0, 0, 0];
  const canon2 = await canonicalChildrenJson(page);
  const tree2 = await componentsTreeJson(page);
  const layout2 = await layoutRects(page, GEOM_IDS);
  const s2b = await themesState(page);
  const cur = componentsPage.id;
  const otherDelta = (from, to) =>
    Object.keys({ ...from.counts, ...to.counts })
      .filter((k) => k !== cur)
      .map((k) => (to.counts[k] ?? 0) - (from.counts[k] ?? 0));
  record(
    "C2: Default → Brand 전환 2회 — 현재 페이지 history +1/전환 (type theme) · 다른 페이지 +0 · canonical children JSON 무변화 · legacy 트리 무변화 · origin 기하 무변화 · origin accent 파랑 → 빨강",
    (h1.counts[cur] ?? 0) === (h0.counts[cur] ?? 0) + 1 &&
      (h2.counts[cur] ?? 0) === (h1.counts[cur] ?? 0) + 1 &&
      h2.types.slice(-2).every((t) => t === "theme") &&
      otherDelta(h0, h2).every((d) => d === 0) &&
      canon2 === canon0 &&
      tree2 === tree0 &&
      layout2 === layout0 &&
      layout0 !== "[null,null,null]" &&
      isBluish(p1.fill) &&
      isReddish(p2.fill) &&
      s2b.active === brandId &&
      s2b.tint === "red",
    JSON.stringify({
      counts: [h0.counts, h1.counts, h2.counts],
      lastTypes: h2.types.slice(-3),
      other: otherDelta(h0, h2),
      canonSame: canon2 === canon0,
      canonLen: canon0.length,
      treeSame: tree2 === tree0,
      layout: [layout0, layout2],
      fill: [p1.fill, p2.fill],
      s2b,
    }),
  );

  // ── C3 같은 테마 재선택 ──
  const s3a = await themesState(page);
  const h3a = await historyAll(page);
  await docIdentity(page);
  await setActive(page, brandId);
  await page.waitForTimeout(600);
  const s3b = await themesState(page);
  const h3b = await historyAll(page);
  const docSame = await docIdentity(page);
  record(
    "C3: 같은 테마 재선택 → 모든 페이지 history +0 · themeVersion 무변화 · 문서 객체 동일 (no-op)",
    sumCounts(h3b.counts) === sumCounts(h3a.counts) &&
      s3b.themeVersion === s3a.themeVersion &&
      docSame,
    JSON.stringify({
      sum: [sumCounts(h3a.counts), sumCounts(h3b.counts)],
      themeVersion: [s3a.themeVersion, s3b.themeVersion],
      docSame,
    }),
  );

  // ── C4 홈 페이지 instance ──
  await switchPage(page, homePageId);
  await page.waitForTimeout(1500);
  const instReady = await waitForLayoutKey(page, INST_ACCENT);
  const instKeys = await layoutKeysWith(page, FORM_INST);
  const instAccentKey = instReady ? INST_ACCENT : null;
  const p4a = instAccentKey
    ? await fillPixel(page, instAccentKey, "c4-inst-form-brand")
    : { fill: null };
  const p4b = await fillPixel(page, ACCENT_INST, "c4-inst-accent-brand");
  const canon4 = await canonicalChildrenJson(page);
  record(
    "C4: 홈 페이지 — Form instance 안 accent Button + accent Button instance 픽셀 빨강 (origin 과 같이) · canonical JSON 무변화",
    !!instAccentKey &&
      isReddish(p4a.fill ?? [0, 0, 0]) &&
      isReddish(p4b.fill) &&
      canon4 === canon0,
    JSON.stringify({
      instAccentKey,
      instKeys: instKeys.length,
      fill: [p4a.fill, p4b.fill],
      canonSame: canon4 === canon0,
    }),
  );

  // ── C5 Undo/Redo (entry 는 Components 페이지 history) ──
  await switchPage(page, componentsPage.id);
  await page.waitForTimeout(1500);
  await waitForLayoutKey(page, ORIGIN_ACCENT);
  const h5 = await historyAll(page);
  await state(page, () => window.__composition_STORE__.getState().undo());
  await page.waitForTimeout(1200);
  const s5a = await themesState(page);
  const p5a = await fillPixel(page, ORIGIN_ACCENT, "c5-undo");
  if (!p5a.fill) p5a.fill = [0, 0, 0];
  await state(page, () => window.__composition_STORE__.getState().redo());
  await page.waitForTimeout(1200);
  const s5b = await themesState(page);
  const p5b = await fillPixel(page, ORIGIN_ACCENT, "c5-redo");
  if (!p5b.fill) p5b.fill = [0, 0, 0];
  const h5b = await historyAll(page);
  const canon5 = await canonicalChildrenJson(page);
  record(
    "C5: Undo → Default (파랑) · Redo → Brand (빨강) · history 길이 불변 · canonical JSON 무변화",
    s5a.active === defaultId &&
      isBluish(p5a.fill) &&
      s5b.active === brandId &&
      isReddish(p5b.fill) &&
      sumCounts(h5b.counts) === sumCounts(h5.counts) &&
      canon5 === canon0,
    JSON.stringify({
      undo: [s5a.active, p5a.fill],
      redo: [s5b.active, p5b.fill],
      sum: [sumCounts(h5.counts), sumCounts(h5b.counts)],
    }),
  );

  // ── C6 perf ── 카메라는 한 페이지만 보이게 둔다 (공유 layout map 은 보이는 페이지를 전부 싣는다 — 두 페이지가
  //   같이 보이면 origin 전집 + 600 요소를 한 프레임에 다시 그려 측정이 섞인다). Components: Form origin (y 648)
  //   을 화면 y 700 에 → 페이지 상단 52 · 홈 페이지 (y +1160) 는 화면 밖. 홈: perf-seed-300 (페이지 깊숙이).
  await switchPage(page, componentsPage.id);
  await page.waitForTimeout(1500);
  await waitForLayoutKey(page, ORIGIN_ACCENT);
  await focusOn(page, "component-form", { x: 700, y: 700 });
  const perfComponents = await perfSwitch(page, [defaultId, brandId], 10);
  await switchPage(page, homePageId);
  await page.waitForTimeout(1500);
  await waitForLayoutKey(page, "perf-seed-300");
  await focusOn(page, "perf-seed-300");
  const perfHome = await perfSwitch(page, [defaultId, brandId], 10);
  const total = (runs) => runs.map((r) => r.sync + r.frame).sort((a, b) => a - b);
  const stats = (runs) => {
    const t = total(runs);
    return {
      worst: t[t.length - 1],
      p95: t[Math.min(t.length - 1, Math.ceil(t.length * 0.95) - 1)],
      median: t[Math.floor(t.length / 2)],
    };
  };
  const stC = stats(perfComponents);
  const stH = stats(perfHome);
  const s6 = await themesState(page);
  record(
    "C6: 전환 비용 — Components 페이지 (origin 전집 · 그 페이지만 보임) · 홈 페이지 (600+ 요소 · 그 페이지만 보임) 각 10회 (sync + 다음 프레임) 최대 ≤ 25ms · 마지막 Brand",
    stC.worst <= 25 && stH.worst <= 25 && s6.active === brandId,
    JSON.stringify({ components: stC, home: stH, perfComponents, perfHome }),
  );

  record("page error 0", errors.length === 0, errors.slice(0, 2).join(" | "));
} catch (e) {
  record("harness", false, String(e?.stack ?? e));
  await page
    .screenshot({ path: resolve(OUT_DIR, "error.png") })
    .catch(() => {});
} finally {
  writeFileSync(
    resolve(OUT_DIR, "findings.json"),
    JSON.stringify({ findings, errors, at: new Date().toISOString() }, null, 2),
  );
  const pass = findings.filter((f) => f.pass).length;
  log(`${pass}/${findings.length} PASS · errors ${errors.length}`);
  await browser.close();
  process.exit(pass === findings.length ? 0 : 1);
}

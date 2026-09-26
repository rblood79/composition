#!/usr/bin/env node
// adr227-themes-migration-live.mjs — ADR-227 Phase 1 G1 live (실제 빌더, headed Playwright — Compare Mode 없음).
//   M1) 새 프로젝트 부팅 → canonical `themes` 가 컬렉션 (Default 하나 · 델타 {}) · localStorage 는 캐시 모양 (`migrated`).
//   M2) legacy 시나리오 — localStorage 에 legacy 실효값 (purple · dark · zinc · lg · fontSize 20) 을 심고 reload →
//       컬렉션 preset 이 그 값 · `.pre227` 백업 · 캐시 축소 · themeConfigStore 도 같은 값 (기존 실효 시각 Δ0).
//   M3) Themes 패널에서 tint 클릭 (Red) → 문서 active preset tint=red · history entry type theme · Skia Button 픽셀이 빨강 계열.
//   M4) reload → tint red 보존 (문서가 정본 — localStorage 는 캐시뿐).
//   M5) Undo → tint 복귀 (문서 + 캔버스) · Redo → 다시 red.
//   page error 0.
// 사용: node apps/builder/scripts/adr227-themes-migration-live.mjs [--headed]
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const require = createRequire(import.meta.url);
const { PNG } = require(
  resolve("node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs"),
);

const BASE_URL = process.env.BUILDER_URL ?? "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR227_OUT ?? "/private/tmp/adr227-p1-live";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[adr227 p1]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail ?? ""}`);
};
mkdirSync(OUT_DIR, { recursive: true });

const BTN = "adr227-button";
const state = (page, fn, arg) => page.evaluate(fn, arg);

const readThemes = (page) =>
  state(page, () => {
    const c = window.__canonical_STORE__.getState();
    const doc = c.documents.get(c.currentProjectId);
    const themes = doc?.themes ?? null;
    const t = window.__composition_THEME_CONFIG__?.getState?.();
    const key = `composition-theme-config-${c.currentProjectId}`;
    return {
      projectId: c.currentProjectId,
      themes,
      active: themes?.items?.[themes.active] ?? null,
      cache: JSON.parse(localStorage.getItem(key) ?? "null"),
      backup: JSON.parse(localStorage.getItem(`${key}.pre227`) ?? "null"),
      runtime: t
        ? {
            tint: t.tint,
            darkMode: t.darkMode,
            neutral: t.neutral,
            radiusScale: t.radiusScale,
            fontSize: t.baseTypography?.fontSize,
          }
        : null,
      historyTotal:
        window.__composition_HISTORY_DEBUG__?.getCurrentPageHistory?.()
          ?.totalEntries ?? null,
    };
  });

async function focusOn(page, id, at = { x: 700, y: 420 }) {
  await state(
    page,
    ({ id, at }) => {
      const st = window.__composition_STORE__.getState();
      const el = st.elements.find((e) => e.id === id);
      const positions = st.pagePositions;
      const pos = (positions instanceof Map
        ? positions.get(el?.page_id)
        : positions?.[el?.page_id]) ?? { x: 0, y: 0 };
      const l = window.__composition_LAYOUT_DEBUG__
        ?.getSharedLayoutMap?.()
        ?.get(id);
      window.__composition_APPLY_VIEWPORT__?.({
        scale: 1,
        x: at.x - (pos.x + (l?.x ?? 0)),
        y: at.y - (pos.y + (l?.y ?? 0)),
      });
      st.setSelectedElement(null);
    },
    { id, at },
  );
  await page.waitForTimeout(900);
}
const screenRect = (page, id) =>
  state(
    page,
    (id) => {
      const st = window.__composition_STORE__.getState();
      const el = st.elements.find((e) => e.id === id);
      const positions = st.pagePositions;
      const pos = (positions instanceof Map
        ? positions.get(el?.page_id)
        : positions?.[el?.page_id]) ?? { x: 0, y: 0 };
      const l = window.__composition_LAYOUT_DEBUG__
        ?.getSharedLayoutMap?.()
        ?.get(id);
      const vp = window.__composition_VIEWPORT__?.();
      const pan = vp?.panOffset ?? { x: 0, y: 0 };
      const zoom = vp?.zoom ?? 1;
      if (!l) return null;
      return { x: pan.x + (pos.x + l.x) * zoom, y: pan.y + (pos.y + l.y) * zoom, w: l.width * zoom, h: l.height * zoom };
    },
    id,
  );
async function skiaPixel(page, id, name) {
  await focusOn(page, id);
  await page.mouse.move(2, 890);
  await page.waitForTimeout(500);
  const rect = await screenRect(page, id);
  const box = await page.locator("canvas").first().boundingBox();
  const png = await page.screenshot({ type: "png", animations: "disabled" });
  if (name) writeFileSync(resolve(OUT_DIR, `${name}.png`), png);
  const p = PNG.sync.read(png);
  const sx = Math.round(box.x + (rect?.x ?? 700) + 5);
  const sy = Math.round(box.y + (rect?.y ?? 420) + (rect?.h ?? 32) / 2);
  const i = (sy * p.width + sx) * 4;
  return { rgb: [p.data[i], p.data[i + 1], p.data[i + 2]], at: [sx, sy] };
}
const isReddish = ([r, g, b]) => r > 150 && r - g > 60 && r - b > 60;
const isBluish = ([r, g, b]) => b > 150 && b - r > 60 && b - g > 40;

async function openThemesPanel(page) {
  const btn = page.locator('button[aria-label="테마"], button[aria-label="Theme"]').first();
  if ((await btn.getAttribute("aria-pressed")) !== "true") {
    await btn.click();
    await page.waitForTimeout(800);
  }
  await page.locator(".themes-panel").first().waitFor({ state: "visible", timeout: 10_000 });
}

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
  await input.fill(`adr227p1-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  await page.waitForTimeout(1500);

  // ── M1: 새 프로젝트 — 컬렉션 · 캐시 모양 ──
  const m1 = await readThemes(page);
  record(
    "M1: 새 프로젝트 부팅 — canonical themes 컬렉션 (Default · 델타 {}) · localStorage 캐시 모양 (migrated)",
    m1.themes?.active === "theme-default" &&
      m1.themes?.order?.length === 1 &&
      JSON.stringify(m1.active?.tokens) === "{}" &&
      m1.cache?.migrated === true &&
      m1.cache?.activeThemeId === "theme-default",
    JSON.stringify({ themes: m1.themes, cache: m1.cache, runtime: m1.runtime }),
  );
  const projectId = m1.projectId;

  // seed Button on the user page (픽셀 오라클)
  await state(page, (BTN) => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find((e) => e.type === "body" && e.page_id === st.currentPageId);
    const now = new Date().toISOString();
    st.addElement({
      id: BTN,
      customId: BTN,
      type: "ref",
      ref: "component-button",
      componentName: "Button",
      parent_id: body.id,
      page_id: st.currentPageId,
      props: { children: "Theme", variant: "accent" },
      created_at: now,
      updated_at: now,
    });
  }, BTN);
  await page.waitForTimeout(1500);
  const pxBlue = await skiaPixel(page, BTN, "m1-blue");

  // ── M2: legacy 시나리오 — 문서 themes 제거 + legacy localStorage 심기 → reload ──
  await state(page, async (projectId) => {
    const key = `composition-theme-config-${projectId}`;
    localStorage.removeItem(`${key}.pre227`);
    localStorage.setItem(
      key,
      JSON.stringify({
        tint: "purple",
        darkMode: "dark",
        neutral: "zinc",
        radiusScale: "lg",
        baseTypography: { fontFamily: "Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, 'Helvetica Neue', 'Segoe UI', sans-serif", fontSize: 20, lineHeight: 1.5 },
      }),
    );
    // IndexedDB document_parts 에서 root "document" 레코드의 themes 를 지운다 (= 227 이전 저장 모양)
    const open = indexedDB.open("composition");
    const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = () => rej(open.error); });
    const tx = db.transaction(["document_parts"], "readwrite");
    const parts = tx.objectStore("document_parts");
    const root = await new Promise((res, rej) => { const r = parts.get([projectId, "document"]); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
    const header = JSON.parse(root.value);
    delete header.themes;
    parts.put({ project_id: projectId, key: "document", value: JSON.stringify(header) });
    await new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
    db.close();
  }, projectId);
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await page.waitForTimeout(2500);
  const m2 = await readThemes(page);
  record(
    "M2: legacy localStorage (purple · dark · zinc · lg · 20) + themes 부재 문서 → 컬렉션 preset 승계 · fontSize 델타 · .pre227 백업 · 캐시 축소 · 런타임 동일 (실효 시각 Δ0)",
    m2.active?.preset?.tint === "purple" &&
      m2.active?.preset?.darkMode === "dark" &&
      m2.active?.preset?.neutral === "zinc" &&
      m2.active?.preset?.radiusScale === "lg" &&
      m2.active?.tokens?.["typography.base-font-size"]?.value === 20 &&
      m2.backup?.tint === "purple" &&
      m2.cache?.migrated === true &&
      m2.runtime?.tint === "purple" &&
      m2.runtime?.darkMode === "dark" &&
      m2.runtime?.fontSize === 20,
    JSON.stringify({ active: m2.active, cache: m2.cache, backup: m2.backup, runtime: m2.runtime }),
  );

  // ── M3: Themes 패널 tint 클릭 → 문서 + history + Skia ──
  await openThemesPanel(page);
  const beforeClick = await readThemes(page);
  await page.locator('.themes-panel [aria-label="Red"]').first().click();
  await page.waitForTimeout(1200);
  const m3 = await readThemes(page);
  const pxRed = await skiaPixel(page, BTN, "m3-red");
  record(
    "M3: Themes 패널 Red 클릭 → 문서 active preset tint=red · history entry +1 · Skia Button 픽셀 빨강 계열",
    m3.active?.preset?.tint === "red" &&
      m3.historyTotal === beforeClick.historyTotal + 1 &&
      isReddish(pxRed.rgb),
    JSON.stringify({ tint: m3.active?.preset?.tint, history: [beforeClick.historyTotal, m3.historyTotal], px: pxRed, before: pxBlue }),
  );

  // ── M4: reload → 보존 ──
  await page.waitForTimeout(2500);
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await page.waitForTimeout(2500);
  const m4 = await readThemes(page);
  const pxRed2 = await skiaPixel(page, BTN, "m4-red");
  record(
    "M4: reload — tint red 보존 (문서 정본) · 캐시는 migrated 모양 그대로 · 캔버스 빨강",
    m4.active?.preset?.tint === "red" && m4.cache?.migrated === true && isReddish(pxRed2.rgb),
    JSON.stringify({ tint: m4.active?.preset?.tint, cache: m4.cache, px: pxRed2 }),
  );

  // ── M5: Undo/Redo (M3 의 entry 는 reload 뒤 IndexedDB 에서 복원된다) ──
  await state(page, () => window.__composition_STORE__.getState().undo());
  await page.waitForTimeout(1200);
  const m5a = await readThemes(page);
  const pxUndo = await skiaPixel(page, BTN, "m5-undo");
  await state(page, () => window.__composition_STORE__.getState().redo());
  await page.waitForTimeout(1200);
  const m5b = await readThemes(page);
  record(
    "M5: Undo → tint purple 복귀 (문서 + 런타임 + 캔버스 비-빨강) · Redo → red",
    m5a.active?.preset?.tint === "purple" &&
      m5a.runtime?.tint === "purple" &&
      !isReddish(pxUndo.rgb) &&
      m5b.active?.preset?.tint === "red" &&
      m5b.runtime?.tint === "red",
    JSON.stringify({ undo: [m5a.active?.preset?.tint, m5a.runtime?.tint, pxUndo.rgb], redo: [m5b.active?.preset?.tint, m5b.runtime?.tint] }),
  );

  record("page error 0", errors.length === 0, errors.slice(0, 2).join(" | "));
} catch (e) {
  record("harness", false, String(e?.stack ?? e));
  await page.screenshot({ path: resolve(OUT_DIR, "error.png") }).catch(() => {});
} finally {
  writeFileSync(resolve(OUT_DIR, "findings.json"), JSON.stringify({ findings, errors, at: new Date().toISOString() }, null, 2));
  const pass = findings.filter((f) => f.pass).length;
  log(`${pass}/${findings.length} PASS · errors ${errors.length}`);
  await browser.close();
  process.exit(pass === findings.length ? 0 : 1);
}

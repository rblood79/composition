#!/usr/bin/env node
// adr227-themes-panel-live.mjs — ADR-227 Phase 4 G4 live (실제 빌더 · Themes 패널 UI 클릭 · headed Playwright — Compare Mode 없음).
//   T1) 새 프로젝트 + accent Button + 600 요소 seed · Themes 패널 열기 · 목록 1 행 (Default 활성 · 삭제 비활성).
//   T2) 헤더 + → 2 행 (복제) · history +1 · 두 번째 활성화 (표지 클릭) → active 전환 · history +1.
//   T3) Tint Red 스와치 → 활성 테마 preset.tint=red · accent 픽셀 빨강 · history +1 (Default 는 파랑 그대로).
//   T4) 이름 변경 (연필 → 입력 Enter) → 목록 이름 · history +1.
//   T5) 토큰 재정의 UI (color · accent · #00a000 → +) → 델타 행 · 픽셀 초록 · history +1 · 행 초기화 (−) → 빨강 · history +1.
//   T6) Default 활성화 → 파랑 · 600 요소 전환 sync 비용 + 다음 프레임 ≤ 25ms (dev 핸들로 같은 경로 재측정).
//   T7) reload → 목록 2 · 활성 · 이름 보존.  T8) Undo ×2 → 활성 다시 두 번째 (빨강) · Redo ×2 → Default (파랑).
//   T9) 두 번째 삭제 (−) → 1 행 · 삭제 비활성 · Default 활성 유지.  page error 0.
// 사용: node apps/builder/scripts/adr227-themes-panel-live.mjs [--headed]
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
const OUT_DIR = process.env.ADR227_OUT ?? "/private/tmp/adr227-p4-live";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[adr227 p4]", ...a);
const findings = [];
const record = (name, pass, detail) => {
  findings.push({ name, pass, detail });
  log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail ?? ""}`);
};
mkdirSync(OUT_DIR, { recursive: true });

const ACCENT = "adr227-accent";
const PRIMARY = "adr227-primary";
const state = (page, fn, arg) => page.evaluate(fn, arg);

const token = (page, key, entry) =>
  state(
    page,
    ({ key, entry }) => {
      const a = window.__composition_THEME_ACTIONS__;
      const c = a.readThemesCollection();
      return a.setThemeToken(c.active, key, entry);
    },
    { key, entry },
  );
const preset = (page, patch) =>
  state(
    page,
    (patch) => window.__composition_THEME_ACTIONS__.setActiveThemePreset(patch),
    patch,
  );
const runtime = (page) =>
  state(page, () => {
    const t = window.__composition_THEME_CONFIG__.getState();
    const c = window.__canonical_STORE__.getState();
    const doc = c.documents.get(c.currentProjectId);
    return {
      themeVersion: t.themeVersion,
      tint: t.tint,
      darkMode: t.darkMode,
      tokens: doc?.themes?.items?.[doc.themes.active]?.tokens,
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
      return {
        x: pan.x + (pos.x + l.x) * zoom,
        y: pan.y + (pos.y + l.y) * zoom,
        w: l.width * zoom,
        h: l.height * zoom,
        lw: l.width,
        lh: l.height,
      };
    },
    id,
  );
/** 요소 안쪽 (x+5, mid) · 모서리 (x+1, y+1) · 왼쪽 바깥 페이지 배경 (x-6, mid) 픽셀. */
async function pixels(page, id, name) {
  await focusOn(page, id);
  await page.mouse.move(2, 890);
  await page.waitForTimeout(500);
  const rect = await screenRect(page, id);
  const box = await page.locator("canvas").first().boundingBox();
  const png = await page.screenshot({ type: "png", animations: "disabled" });
  if (name) writeFileSync(resolve(OUT_DIR, `${name}.png`), png);
  const p = PNG.sync.read(png);
  const at = (dx, dy) => {
    const sx = Math.round(box.x + rect.x + dx);
    const sy = Math.round(box.y + rect.y + dy);
    const i = (sy * p.width + sx) * 4;
    return [p.data[i], p.data[i + 1], p.data[i + 2]];
  };
  return {
    fill: at(5, rect.h / 2),
    corner: at(1, 1),
    outside: at(-6, rect.h / 2),
    rect,
  };
}
const isGreenish = ([r, g, b]) => g > 110 && g - r > 40 && g - b > 40;
const isBluish = ([r, g, b]) => b > 150 && b - r > 60 && b - g > 40;
const isMagenta = ([r, g, b]) => r > 150 && b > 150 && g < 100;
const isDarkish = ([r, g, b]) => r < 60 && g < 60 && b < 60;
const isLight = ([r, g, b]) => r > 200 && g > 200 && b > 200;
const close = (a, b, tol = 8) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

const isReddish = ([r, g, b]) => r > 150 && r - g > 60 && r - b > 60;
const historyTotal = (page) =>
  state(
    page,
    () =>
      window.__composition_HISTORY_DEBUG__?.getCurrentPageHistory?.()
        ?.totalEntries ?? -1,
  );
const themesState = (page) =>
  state(page, () => {
    const c = window.__composition_THEME_ACTIONS__.readThemesCollection();
    return {
      active: c?.active,
      order: c?.order,
      names: c ? c.order.map((id) => c.items[id].name) : [],
      tints: c ? c.order.map((id) => c.items[id].preset.tint) : [],
      tokens: c?.items?.[c.active]?.tokens,
    };
  });
async function openThemesPanel(page) {
  const btn = page
    .locator('button[aria-label="테마"], button[aria-label="Theme"]')
    .first();
  if ((await btn.getAttribute("aria-pressed")) !== "true") {
    await btn.click();
    await page.waitForTimeout(800);
  }
  await page
    .locator(".themes-panel")
    .first()
    .waitFor({ state: "visible", timeout: 10_000 });
}
const rows = (page) => page.locator(".themes-panel .theme-row");

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
  await input.fill(`adr227p4-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  await page.waitForTimeout(1500);

  await state(
    page,
    ({ ACCENT }) => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find(
        (e) => e.type === "body" && e.page_id === st.currentPageId,
      );
      const now = new Date().toISOString();
      st.addElement({
        id: ACCENT,
        customId: ACCENT,
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
    { ACCENT },
  );
  await seedDocument(page, 600, "mixed", 1);
  await page.waitForTimeout(2500);
  await openThemesPanel(page);

  // ── T1 ──
  const h0 = await historyTotal(page);
  const s1 = await themesState(page);
  const removeDisabled = await rows(page)
    .first()
    .locator(".theme-row-remove")
    .isDisabled();
  const a1 = await pixels(page, ACCENT, "t1");
  const elementCount = await state(
    page,
    () => window.__composition_STORE__.getState().elements.length,
  );
  record(
    "T1: 목록 1 행 (Default 활성 · 삭제 비활성) · accent 파랑 · 요소 600+",
    (await rows(page).count()) === 1 &&
      s1.order.length === 1 &&
      removeDisabled &&
      isBluish(a1.fill) &&
      elementCount >= 600,
    JSON.stringify({
      rows: await rows(page).count(),
      s1,
      removeDisabled,
      fill: a1.fill,
      elementCount,
    }),
  );

  // ── T2 복제 + 활성화 ──
  await page
    .locator(
      '.themes-panel .section[data-section-id="theme-list"] .section-actions button',
    )
    .first()
    .click();
  await page.waitForTimeout(600);
  const h2a = await historyTotal(page);
  await rows(page).nth(1).locator(".theme-row-activate").click();
  await page.waitForTimeout(800);
  const h2b = await historyTotal(page);
  const s2 = await themesState(page);
  record(
    "T2: + → 2 행 (복제) · history +1 · 두 번째 활성화 클릭 → active 전환 · history +1",
    (await rows(page).count()) === 2 &&
      h2a === h0 + 1 &&
      h2b === h0 + 2 &&
      s2.active === s2.order[1],
    JSON.stringify({ rows: await rows(page).count(), h: [h0, h2a, h2b], s2 }),
  );

  // ── T3 tint Red ──
  await page.locator('.themes-panel [aria-label="Red"]').first().click();
  await page.waitForTimeout(1200);
  const h3 = await historyTotal(page);
  const s3 = await themesState(page);
  const a3 = await pixels(page, ACCENT, "t3-red");
  record(
    "T3: Tint Red → 활성 테마 preset.tint=red · Default 는 blue 그대로 · accent 픽셀 빨강 · history +1",
    s3.tints[1] === "red" &&
      s3.tints[0] === "blue" &&
      isReddish(a3.fill) &&
      h3 === h2b + 1,
    JSON.stringify({ tints: s3.tints, fill: a3.fill, h: h3 }),
  );

  // ── T4 rename ──
  await rows(page).nth(1).locator(".theme-row-rename").click();
  await page.waitForTimeout(300);
  const nameInput = rows(page)
    .nth(1)
    .locator(".theme-row-editor input")
    .first();
  await nameInput.fill("Brand");
  await nameInput.press("Enter");
  await page.waitForTimeout(800);
  const h4 = await historyTotal(page);
  const s4 = await themesState(page);
  const rowName = await rows(page)
    .nth(1)
    .locator(".theme-row-name")
    .textContent();
  record(
    "T4: 이름 변경 (연필 → 입력 Enter) → 목록 이름 Brand · history +1",
    s4.names[1] === "Brand" && rowName === "Brand" && h4 === h3 + 1,
    JSON.stringify({ names: s4.names, rowName, h: h4 }),
  );

  // ── T5 token override via UI ──
  const tokens = page.locator(
    '.themes-panel .section[data-section-id="theme-tokens"]',
  );
  const valueInput = tokens
    .locator(".theme-token-add-value input, .theme-token-add input")
    .first();
  await valueInput.fill("#00a000");
  await valueInput.press("Enter");
  await tokens
    .locator(
      'button[aria-label="재정의 추가"], button[aria-label="Add override"]',
    )
    .first()
    .click();
  await page.waitForTimeout(1200);
  const h5a = await historyTotal(page);
  const s5a = await themesState(page);
  const a5 = await pixels(page, ACCENT, "t5-green");
  const overrideRows = tokens.locator(".theme-token-row");
  const overrideKey =
    (await overrideRows.count()) > 0
      ? await overrideRows.first().getAttribute("data-token-key")
      : null;
  await overrideRows.first().locator(".theme-token-reset").click();
  await page.waitForTimeout(1200);
  const h5b = await historyTotal(page);
  const a5r = await pixels(page, ACCENT, "t5-reset");
  record(
    "T5: 토큰 재정의 (color · accent · #00a000 → +) → 델타 행 · 픽셀 초록 · history +1 · 초기화 (−) → 빨강 · history +1",
    overrideKey === "color.accent" &&
      s5a.tokens?.["color.accent"]?.value === "#00a000" &&
      isGreenish(a5.fill) &&
      h5a === h4 + 1 &&
      isReddish(a5r.fill) &&
      h5b === h5a + 1 &&
      (await overrideRows.count()) === 0,
    JSON.stringify({
      overrideKey,
      tokens: s5a.tokens,
      green: a5.fill,
      reset: a5r.fill,
      h: [h5a, h5b],
    }),
  );

  // ── T6 Default 활성화 + 600 요소 전환 비용 ──
  await rows(page).nth(0).locator(".theme-row-activate").click();
  await page.waitForTimeout(1200);
  const a6 = await pixels(page, ACCENT, "t6-blue");
  const s6 = await themesState(page);
  const perf = await state(
    page,
    (brandId) =>
      new Promise((resolve) => {
        const a = window.__composition_THEME_ACTIONS__;
        const c = a.readThemesCollection();
        const defaultId = c.order[0];
        const runs = [];
        let i = 0;
        const step = () => {
          const target = i % 2 === 0 ? brandId : defaultId;
          const t0 = performance.now();
          a.setActiveTheme(target);
          const sync = performance.now() - t0;
          requestAnimationFrame(() => {
            const t1 = performance.now();
            requestAnimationFrame(() => {
              runs.push({
                sync: +sync.toFixed(2),
                frame: +(performance.now() - t1).toFixed(2),
              });
              i += 1;
              if (i < 6) step();
              else {
                // 마지막은 Default 로 남긴다 (i=6 → 마지막 target 은 defaultId)
                resolve(runs);
              }
            });
          });
        };
        step();
      }),
    s6.order[1],
  );
  const s6b = await themesState(page);
  const worst = Math.max(...perf.map((r) => r.sync + r.frame));
  record(
    "T6: Default 활성화 → 파랑 · 600 요소 테마 전환 6회 (sync + 다음 프레임) 최대 ≤ 25ms",
    isBluish(a6.fill) &&
      s6.active === s6.order[0] &&
      s6b.active === s6b.order[0] &&
      worst <= 25,
    JSON.stringify({ fill: a6.fill, perf, worst }),
  );

  // ── T7 reload ──
  const h7 = await historyTotal(page);
  await page.waitForTimeout(2500);
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await page.waitForTimeout(2500);
  await openThemesPanel(page);
  const s7 = await themesState(page);
  const a7 = await pixels(page, ACCENT, "t7-reload");
  record(
    "T7: reload → 목록 2 · Default 활성 · 이름 Brand · tint red 보존 · 파랑",
    (await rows(page).count()) === 2 &&
      s7.active === s7.order[0] &&
      s7.names[1] === "Brand" &&
      s7.tints[1] === "red" &&
      isBluish(a7.fill),
    JSON.stringify({ s7, fill: a7.fill }),
  );

  // ── T8 Undo/Redo (reload 뒤 history 는 IndexedDB 에서 복원) ──
  const h8 = await historyTotal(page);
  // 마지막 entry 들: perf 루프 6 (activate) — undo 1 → Brand 활성 (빨강)
  await state(page, () => window.__composition_STORE__.getState().undo());
  await page.waitForTimeout(1200);
  const s8a = await themesState(page);
  const a8a = await pixels(page, ACCENT, "t8-undo");
  await state(page, () => window.__composition_STORE__.getState().redo());
  await page.waitForTimeout(1200);
  const s8b = await themesState(page);
  const a8b = await pixels(page, ACCENT, "t8-redo");
  record(
    "T8: Undo → Brand 활성 (빨강) · Redo → Default (파랑) · 목록 표지도 따라간다",
    s8a.active === s8a.order[1] &&
      isReddish(a8a.fill) &&
      s8b.active === s8b.order[0] &&
      isBluish(a8b.fill) &&
      (await rows(page).nth(0).getAttribute("data-active")) === "true",
    JSON.stringify({
      h: [h7, h8],
      undo: [s8a.active, a8a.fill],
      redo: [s8b.active, a8b.fill],
    }),
  );

  // ── T9 delete ──
  await rows(page).nth(1).locator(".theme-row-remove").click();
  await page.waitForTimeout(800);
  const s9 = await themesState(page);
  record(
    "T9: 두 번째 삭제 (−) → 1 행 · 삭제 비활성 · Default 활성 유지",
    (await rows(page).count()) === 1 &&
      s9.order.length === 1 &&
      (await rows(page).first().locator(".theme-row-remove").isDisabled()) &&
      s9.active === s9.order[0],
    JSON.stringify({ s9 }),
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

#!/usr/bin/env node
// adr227-theme-snapshot-live.mjs — ADR-227 Phase 2 G2 live (실제 빌더, headed Playwright — Compare Mode 없음).
//   활성 테마 snapshot 1회 설치가 캔버스 (Skia 픽셀 · layout map) 에 닿는지 축별로 본다. Preview/Publish 는 unit.
//   S1) 새 프로젝트 + accent Button (md) · primary Button · 기준 픽셀 (accent 파랑 · primary neutral 검정 · 페이지 흰 배경).
//   S2) color.accent = #00a000 (hex → tint 대체) → accent 픽셀 초록 계열 · primary 불변 · reset → 파랑 복귀.
//   S3) color.neutral = #ff00ff → primary Button 픽셀 마젠타 · accent 불변 · reset.
//   S4) radius.md = 0 → accent Button 모서리 (x+1,y+1) 픽셀 = 채움 · reset → 배경 (둥근 모서리).
//   S5) typography.text-sm = 24 → Button 폭 (layout map, 라벨 hug) 증가 · reset → 복귀 (재레이아웃 = notifyLayoutChange).
//   S6) preset darkMode=dark → primary Button 채움 = dark 맵 (밝음) · light 복귀.
//   S7) 델타 2개 (accent hex + radius.md 0) 저장 → reload → 둘 다 캔버스 유지 (문서 정본) · themeVersion 1회 증가 확인은 unit.
//   page error 0.
// 사용: node apps/builder/scripts/adr227-theme-snapshot-live.mjs [--headed]
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
const OUT_DIR = process.env.ADR227_OUT ?? "/private/tmp/adr227-p2-live";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[adr227 p2]", ...a);
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
  state(page, (patch) => window.__composition_THEME_ACTIONS__.setActiveThemePreset(patch), patch);
const runtime = (page) =>
  state(page, () => {
    const t = window.__composition_THEME_CONFIG__.getState();
    const c = window.__canonical_STORE__.getState();
    const doc = c.documents.get(c.currentProjectId);
    return { themeVersion: t.themeVersion, tint: t.tint, darkMode: t.darkMode, tokens: doc?.themes?.items?.[doc.themes.active]?.tokens };
  });

async function focusOn(page, id, at = { x: 700, y: 420 }) {
  await state(
    page,
    ({ id, at }) => {
      const st = window.__composition_STORE__.getState();
      const el = st.elements.find((e) => e.id === id);
      const positions = st.pagePositions;
      const pos = (positions instanceof Map ? positions.get(el?.page_id) : positions?.[el?.page_id]) ?? { x: 0, y: 0 };
      const l = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.()?.get(id);
      window.__composition_APPLY_VIEWPORT__?.({ scale: 1, x: at.x - (pos.x + (l?.x ?? 0)), y: at.y - (pos.y + (l?.y ?? 0)) });
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
      const pos = (positions instanceof Map ? positions.get(el?.page_id) : positions?.[el?.page_id]) ?? { x: 0, y: 0 };
      const l = window.__composition_LAYOUT_DEBUG__?.getSharedLayoutMap?.()?.get(id);
      const vp = window.__composition_VIEWPORT__?.();
      const pan = vp?.panOffset ?? { x: 0, y: 0 };
      const zoom = vp?.zoom ?? 1;
      if (!l) return null;
      return { x: pan.x + (pos.x + l.x) * zoom, y: pan.y + (pos.y + l.y) * zoom, w: l.width * zoom, h: l.height * zoom, lw: l.width, lh: l.height };
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
  return { fill: at(5, rect.h / 2), corner: at(1, 1), outside: at(-6, rect.h / 2), rect };
}
const isGreenish = ([r, g, b]) => g > 110 && g - r > 40 && g - b > 40;
const isBluish = ([r, g, b]) => b > 150 && b - r > 60 && b - g > 40;
const isMagenta = ([r, g, b]) => r > 150 && b > 150 && g < 100;
const isDarkish = ([r, g, b]) => r < 60 && g < 60 && b < 60;
const isLight = ([r, g, b]) => r > 200 && g > 200 && b > 200;
const close = (a, b, tol = 8) => a.every((v, i) => Math.abs(v - b[i]) <= tol);

const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({ storageState: STORAGE_STATE, viewport: { width: 1440, height: 900 } });
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
  await input.fill(`adr227p2-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  await page.waitForTimeout(1500);

  await state(page, ({ ACCENT, PRIMARY }) => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find((e) => e.type === "body" && e.page_id === st.currentPageId);
    const now = new Date().toISOString();
    const add = (id, props, extra = {}) =>
      st.addElement({ id, customId: id, type: "ref", ref: "component-button", componentName: "Button", parent_id: body.id, page_id: st.currentPageId, props, created_at: now, updated_at: now, ...extra });
    add(ACCENT, { children: "Accent", variant: "accent" });
    add(PRIMARY, { children: "Primary", variant: "primary" });
  }, { ACCENT, PRIMARY });
  await page.waitForTimeout(1500);

  // ── S1 기준 ──
  const a0 = await pixels(page, ACCENT, "s1-accent");
  const p0 = await pixels(page, PRIMARY, "s1-primary");
  record(
    "S1: 기준 — accent Button 파랑 · primary neutral 검정 · 모서리 (x+1,y+1) 는 배경 (radius.md 6) · 페이지 배경 흰",
    isBluish(a0.fill) && isDarkish(p0.fill) && isLight(a0.corner) && isLight(a0.outside),
    JSON.stringify({ accent: a0.fill, primary: p0.fill, corner: a0.corner, outside: a0.outside, h: a0.rect.lh }),
  );

  // ── S2 color.accent hex → tint 대체 ──
  const v0 = (await runtime(page)).themeVersion;
  await token(page, "color.accent", { type: "color", value: "#00a000", source: "spec-token" });
  await page.waitForTimeout(900);
  const v1 = (await runtime(page)).themeVersion;
  const a2 = await pixels(page, ACCENT, "s2-accent-green");
  const p2 = await pixels(page, PRIMARY);
  await token(page, "color.accent", null);
  await page.waitForTimeout(900);
  const a2r = await pixels(page, ACCENT, "s2-accent-reset");
  record(
    "S2: color.accent #00a000 → accent 픽셀 초록 계열 · primary 불변 · themeVersion +1 (한 번) · reset → 파랑",
    isGreenish(a2.fill) && close(p2.fill, p0.fill) && v1 === v0 + 1 && isBluish(a2r.fill),
    JSON.stringify({ green: a2.fill, primary: p2.fill, v: [v0, v1], reset: a2r.fill }),
  );

  // ── S3 color.neutral ──
  await token(page, "color.neutral", { type: "color", value: "#ff00ff", source: "spec-token" });
  await page.waitForTimeout(900);
  const p3 = await pixels(page, PRIMARY, "s3-primary-magenta");
  const a3 = await pixels(page, ACCENT);
  await token(page, "color.neutral", null);
  await page.waitForTimeout(900);
  const p3r = await pixels(page, PRIMARY);
  record(
    "S3: color.neutral #ff00ff → primary Button 픽셀 마젠타 · accent 불변 · reset → 검정",
    isMagenta(p3.fill) && isBluish(a3.fill) && isDarkish(p3r.fill),
    JSON.stringify({ magenta: p3.fill, accent: a3.fill, reset: p3r.fill }),
  );

  // ── S4 radius.md ──
  await token(page, "radius.md", { type: "number", value: 0, source: "spec-token" });
  await page.waitForTimeout(900);
  const a4 = await pixels(page, ACCENT, "s4-radius0");
  await token(page, "radius.md", null);
  await page.waitForTimeout(900);
  const a4r = await pixels(page, ACCENT);
  record(
    "S4: radius.md 0 → accent 모서리 픽셀 = 채움 (파랑) · reset → 배경 (둥근 모서리)",
    isBluish(a4.corner) && isLight(a4r.corner),
    JSON.stringify({ corner0: a4.corner, cornerReset: a4r.corner }),
  );

  // ── S5 typography.text-sm → 재레이아웃 (Button md 높이는 catalog 고정값이라 라벨 폭 = hug 폭으로 잰다) ──
  const w0 = a4r.rect.lw;
  await token(page, "typography.text-sm", { type: "number", value: 24, source: "spec-token" });
  await page.waitForTimeout(1200);
  const a5 = await pixels(page, ACCENT, "s5-text24");
  await token(page, "typography.text-sm", null);
  await page.waitForTimeout(1200);
  const a5r = await pixels(page, ACCENT);
  record(
    "S5: typography.text-sm 24 → Button 폭 (layout map, 라벨 hug) 증가 = 텍스트 측정이 새 맵을 읽고 재레이아웃 · reset → 복귀",
    a5.rect.lw > w0 + 8 && Math.abs(a5r.rect.lw - w0) <= 1,
    JSON.stringify({ w0, w24: a5.rect.lw, wReset: a5r.rect.lw }),
  );

  // ── S6 darkMode — Skia 는 페이지 배경을 테마로 안 칠하므로 (stage 소유) primary Button 의 neutral dark 맵 (밝은 채움) 으로 잰다 ──
  await preset(page, { darkMode: "dark" });
  await page.waitForTimeout(1200);
  const p6 = await pixels(page, PRIMARY, "s6-dark");
  await preset(page, { darkMode: "light" });
  await page.waitForTimeout(1200);
  const p6r = await pixels(page, PRIMARY);
  record(
    "S6: preset darkMode=dark → primary Button 채움이 dark 맵 (neutral 100, 밝음) · light 복귀 → 검정",
    isLight(p6.fill) && isDarkish(p6r.fill),
    JSON.stringify({ dark: p6.fill, light: p6r.fill }),
  );

  // ── S7 reload 보존 ──
  await token(page, "color.accent", { type: "color", value: "#00a000", source: "spec-token" });
  await token(page, "radius.md", { type: "number", value: 0, source: "spec-token" });
  await page.waitForTimeout(3000);
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await page.waitForTimeout(2500);
  const a7 = await pixels(page, ACCENT, "s7-reload");
  const r7 = await runtime(page);
  record(
    "S7: 델타 2 (accent #00a000 · radius.md 0) → reload → 초록 채움 + 각진 모서리 유지 (문서 정본)",
    isGreenish(a7.fill) && isGreenish(a7.corner) && r7.tokens?.["color.accent"]?.value === "#00a000",
    JSON.stringify({ fill: a7.fill, corner: a7.corner, tokens: r7.tokens }),
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

#!/usr/bin/env node
// adr227-border-token-live.mjs — ADR-227 Phase 3 G3 live (실제 빌더, headed Playwright — Compare Mode 없음).
//   border 폭 토큰 `{border.width.thin|thick}` 이 캔버스 (Skia stroke · 픽셀 · layout map) 에 닿는지 본다. DOM 은 unit.
//   B1) secondary Button (md) 기준 — Skia strokeWidth 1 · layout 높이 30 (20 + 4·2 + 1·2) · (x+1) 픽셀 = 테두리 (채움보다 어둡다).
//   B2) border.width.thin = 3 → strokeWidth 3 · 높이 34 · (x+2) 픽셀도 테두리 · reset → 1 / 30 (Δ0).
//   B3) DropZone (md, thick) — strokeWidth 2 → border.width.thick = 4 → 4 · reset → 2.
//   B4) thin = 3 저장 → reload → 높이 34 · strokeWidth 3 유지 (문서 정본).
//   page error 0.
// 사용: node apps/builder/scripts/adr227-border-token-live.mjs [--headed]
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const require = createRequire(import.meta.url);
const { PNG } = require(
  resolve("node_modules/.pnpm/pngjs@7.0.0/node_modules/pngjs"),
);

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = process.env.ADR227_OUT ?? "/private/tmp/adr227-p3-live";
const headed = process.argv.includes("--headed");
const log = (...a) => console.log("[adr227 p3]", ...a);
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


const SECONDARY = "adr227-secondary";
const DROPZONE = "adr227-dropzone";

/** Skia 노드 트리에서 첫 stroke 폭 (box.strokeWidth 또는 shape strokeWidth). */
const strokeWidth = (page, id) =>
  state(page, (id) => {
    const find = (n) => {
      if (!n) return null;
      const sw = n.box?.strokeWidth ?? n.strokeWidth;
      if (typeof sw === "number" && sw > 0) return sw;
      for (const c of n.children ?? []) {
        const f = find(c);
        if (f != null) return f;
      }
      return null;
    };
    return find(window.__composition_SKIA_DEBUG__.getSkiaNode(id));
  }, id);
const isDarker = (a, b, by = 20) => a[0] + a[1] + a[2] < b[0] + b[1] + b[2] - by;

const browser = await chromium.launch({ headless: !headed });
const context = await browser.newContext({ storageState: STORAGE_STATE, viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

/** 픽셀 + (x+2, mid) 추가 샘플. */
async function px(page, id, name) {
  const base = await pixels(page, id, name);
  const rect = base.rect;
  const box = await page.locator("canvas").first().boundingBox();
  const png = await page.screenshot({ type: "png", animations: "disabled" });
  const p = PNG.sync.read(png);
  const at = (dx, dy) => {
    const sx = Math.round(box.x + rect.x + dx);
    const sy = Math.round(box.y + rect.y + dy);
    const i = (sy * p.width + sx) * 4;
    return [p.data[i], p.data[i + 1], p.data[i + 2]];
  };
  return { ...base, edge1: at(0, rect.h / 2), edge2: at(2, rect.h / 2), inner: at(8, rect.h / 2) };
}

try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr227p3-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  await page.waitForTimeout(1500);

  await state(page, ({ SECONDARY, DROPZONE }) => {
    const st = window.__composition_STORE__.getState();
    const body = st.elements.find((e) => e.type === "body" && e.page_id === st.currentPageId);
    const now = new Date().toISOString();
    const add = (id, ref, componentName, props) =>
      st.addElement({ id, customId: id, type: "ref", ref, componentName, parent_id: body.id, page_id: st.currentPageId, props, created_at: now, updated_at: now });
    add(SECONDARY, "component-button", "Button", { children: "Secondary", variant: "secondary" });
    add(DROPZONE, "component-dropzone", "DropZone", { size: "md" });
  }, { SECONDARY, DROPZONE });
  await page.waitForTimeout(1500);

  // ── B1 기준 ──
  const s0 = await px(page, SECONDARY, "b1-secondary");
  const sw0 = await strokeWidth(page, SECONDARY);
  record(
    "B1: secondary Button md 기준 — Skia strokeWidth 1 · layout 높이 30 · (x+0) 픽셀 = 테두리 (채움보다 어둡다) · (x+2) = 채움",
    sw0 === 1 && s0.rect.lh === 30 && isDarker(s0.edge1, s0.inner) && close(s0.edge2, s0.inner, 12),
    JSON.stringify({ sw: sw0, h: s0.rect.lh, w: s0.rect.lw, edge1: s0.edge1, edge2: s0.edge2, inner: s0.inner }),
  );

  // ── B2 thin = 3 ──
  await token(page, "border.width.thin", { type: "number", value: 3, source: "spec-token" });
  await page.waitForTimeout(1200);
  const s2 = await px(page, SECONDARY, "b2-thin3");
  const sw2 = await strokeWidth(page, SECONDARY);
  await token(page, "border.width.thin", null);
  await page.waitForTimeout(1200);
  const s2r = await px(page, SECONDARY, "b2-reset");
  const sw2r = await strokeWidth(page, SECONDARY);
  record(
    "B2: border.width.thin 3 → strokeWidth 3 · 높이 34 (+4) · 폭 +4 · (x+2) 픽셀도 테두리 · reset → 1 / 30 / 채움 (Δ0)",
    sw2 === 3 && s2.rect.lh === 34 && s2.rect.lw === s0.rect.lw + 4 && isDarker(s2.edge2, s2.inner) &&
      sw2r === 1 && s2r.rect.lh === 30 && s2r.rect.lw === s0.rect.lw && close(s2r.edge2, s0.edge2, 12),
    JSON.stringify({ sw: sw2, h: s2.rect.lh, w: [s0.rect.lw, s2.rect.lw, s2r.rect.lw], edge2: s2.edge2, inner: s2.inner, reset: { sw: sw2r, h: s2r.rect.lh, edge2: s2r.edge2 } }),
  );

  // ── B3 thick = 4 (DropZone) ──
  const d0 = await strokeWidth(page, DROPZONE);
  await token(page, "border.width.thick", { type: "number", value: 4, source: "spec-token" });
  await page.waitForTimeout(1200);
  const d3 = await strokeWidth(page, DROPZONE);
  const s3 = await strokeWidth(page, SECONDARY);
  await token(page, "border.width.thick", null);
  await page.waitForTimeout(1200);
  const d3r = await strokeWidth(page, DROPZONE);
  record(
    "B3: DropZone md (thick) strokeWidth 2 → border.width.thick 4 → 4 · Button (thin) 불변 1 · reset → 2",
    d0 === 2 && d3 === 4 && s3 === 1 && d3r === 2,
    JSON.stringify({ before: d0, thick4: d3, button: s3, reset: d3r }),
  );

  // ── B4 reload 보존 ──
  await token(page, "border.width.thin", { type: "number", value: 3, source: "spec-token" });
  await page.waitForTimeout(3000);
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await page.waitForTimeout(2500);
  const s4 = await px(page, SECONDARY, "b4-reload");
  const sw4 = await strokeWidth(page, SECONDARY);
  const r4 = await runtime(page);
  record(
    "B4: thin 3 저장 → reload → 높이 34 · strokeWidth 3 (문서 정본)",
    sw4 === 3 && s4.rect.lh === 34 && r4.tokens?.["border.width.thin"]?.value === 3,
    JSON.stringify({ sw: sw4, h: s4.rect.lh, tokens: r4.tokens }),
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

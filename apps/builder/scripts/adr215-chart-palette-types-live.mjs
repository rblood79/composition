#!/usr/bin/env node
// adr215-chart-palette-types-live.mjs — ADR-215 후속 검수: 차트 종류 6 × 팔레트 2 전수.
//
// 질문 하나만 본다 — "palette 를 바꾸면 **모든** 차트 종류가 두 leg (Skia · Preview) 에서 실제로
//   색이 바뀌는가". bar 만 보던 adr215-chart-palette-live.mjs 의 사각지대를 메운다.
//   판정 (종류마다): categorical 에서 Spectrum teal(#0fb5ae) 이 보이고, mono 에서 accent-1
//   (#142bbb, 기본 tint blue) 이 보이며 teal 은 사라진다. 면 마크는 fillAlpha 0.85 합성이라
//   흰 바탕 합성값도 허용한다. Preview 는 마크의 fill/stroke 페인트를 전부 모은다 (line 은 stroke 뿐).
//
// 준비: builder dev (5173) · 로그인 세션 (`apps/builder/scripts/.auth-session.json`).
// 사용: node apps/builder/scripts/adr215-chart-palette-types-live.mjs [--headed]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady, createInstrumentedContext } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = "/private/tmp/adr215-chart-palette-types-live";
const headed = process.argv.includes("--headed");
const TYPES = ["bar", "line", "area", "pie", "radar", "radial"];

function log(...args) {
  console.log("[ADR-215 types]", ...args);
}

async function createProject(page) {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr215-types-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  return page.url();
}

/** Skia 픽셀 — 채도 있는 픽셀을 32-단계 상자로 묶어 상위 색을 돌려준다 (상단 48px 툴바 제외). */
async function skiaInk(page) {
  const canvas = page.locator("canvas").first();
  const png = await canvas.screenshot();
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  return page.evaluate(
    async ({ base64, minRow }) => {
      const blob = await (
        await fetch(`data:image/png;base64,${base64}`)
      ).blob();
      const bitmap = await createImageBitmap(blob);
      const off = document.createElement("canvas");
      off.width = bitmap.width;
      off.height = bitmap.height;
      const ctx = off.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);
      const data = ctx.getImageData(0, 0, off.width, off.height).data;
      const bins = new Map();
      for (let y = minRow; y < off.height; y++)
        for (let x = 0; x < off.width; x++) {
          const i = (y * off.width + x) * 4;
          const r = data[i],
            g = data[i + 1],
            b = data[i + 2];
          const max = Math.max(r, g, b),
            min = Math.min(r, g, b);
          if (max - min < 60 || max < 90) continue;
          const key = `${r >> 5}:${g >> 5}:${b >> 5}`;
          const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
          bin.n++;
          bin.r += r;
          bin.g += g;
          bin.b += b;
          bins.set(key, bin);
        }
      return [...bins.values()]
        .sort((a, b) => b.n - a.n)
        .slice(0, 10)
        .map((bin) => ({
          n: bin.n,
          rgb: [bin.r / bin.n, bin.g / bin.n, bin.b / bin.n].map(Math.round),
        }));
    },
    { base64: png.toString("base64"), minRow: Math.round(48 * dpr) },
  );
}

/** Preview iframe 의 Chart 마크 페인트 (fill + stroke, 장식·격자 제외) 를 rgb 로. */
async function previewPaints(page) {
  return page.evaluate(() => {
    for (const frame of document.querySelectorAll("iframe")) {
      const doc = frame.contentDocument;
      const chart = doc?.querySelector(".react-aria-Chart");
      if (!chart) continue;
      const svg = chart.querySelector("svg");
      const view = doc.defaultView;
      const toRgb = (paint) => {
        const ctx = doc.createElement("canvas").getContext("2d");
        ctx.fillStyle = "#000";
        ctx.fillStyle = paint;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
      };
      const skip = (el) =>
        !!el.closest("[data-chart-grid], [data-chart-decoration]") ||
        !!el.closest(".recharts-cartesian-grid, .recharts-polar-grid, .recharts-cartesian-axis, .recharts-polar-angle-axis, .recharts-polar-radius-axis");
      const paints = new Set();
      for (const el of svg?.querySelectorAll("path, rect, circle, polygon, sector") ?? []) {
        if (skip(el)) continue;
        const cs = view.getComputedStyle(el);
        for (const key of ["fill", "stroke"]) {
          const v = cs[key];
          if (!v || v === "none" || /^rgba?\(0, 0, 0, 0\)$/.test(v)) continue;
          paints.add(JSON.stringify(toRgb(v)));
        }
      }
      return {
        found: true,
        palette: chart.getAttribute("data-palette"),
        status: chart.getAttribute("data-chart-status"),
        paints: [...paints].map((t) => JSON.parse(t)),
      };
    }
    return { found: false, paints: [] };
  });
}

const near = (a, b, tol = 20) =>
  !!a && !!b && a.every((c, i) => Math.abs(c - b[i]) <= tol);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const onWhite = (rgb, a = 0.85) => rgb.map((v) => Math.round(v * a + 255 * (1 - a)));
const TEAL = hex("#0fb5ae");
const MONO1 = hex("#142bbb");
const anyNear = (list, rgb) =>
  list.some((c) => near(c, rgb) || near(c, onWhite(rgb)));

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: !headed });
  const storageState = JSON.parse(readFileSync(STORAGE_STATE, "utf8"));
  const { context, page } = await createInstrumentedContext(browser, {
    storageState,
    cpuThrottle: 1,
  });
  const findings = [];
  const record = (name, pass, detail) => {
    findings.push({ name, pass, detail });
    log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
  };
  const setProps = (id, props) =>
    page.evaluate(
      ({ id, props }) =>
        window.__composition_STORE__.getState().updateElementProps(id, props),
      { id, props },
    );

  try {
    log("project", await createProject(page));
    const rail = page.locator(".panel-toggle-rail button");
    // components 패널 = rail 1번째
    await rail.nth(1).click();
    await page.waitForTimeout(900);
    const chartButton = page
      .locator('[data-component-type="Chart"], button:has-text("chart")')
      .first();
    await chartButton.waitFor({ state: "visible", timeout: 20_000 });
    await chartButton.click();
    await page.waitForTimeout(2500);
    const placed = await page.evaluate(() => {
      const chart = window.__composition_STORE__
        .getState()
        .elements.find((e) => e.type === "Chart");
      return chart ? { id: chart.id } : null;
    });
    if (!placed) throw new Error("Chart 미생성");
    // 패널 닫고 선택 해제 — overlay·범례 견본이 픽셀에 섞이지 않게
    const n = await rail.count();
    for (let i = 0; i < n; i++)
      if ((await rail.nth(i).getAttribute("aria-pressed")) === "true") {
        await rail.nth(i).click();
        await page.waitForTimeout(400);
      }
    await page.evaluate(() =>
      window.__composition_STORE__.getState().setSelectedElement(null),
    );
    await setProps(placed.id, { showLegend: false });
    await page.waitForTimeout(800);

    // 1단계 — Skia 만 (Compare Mode 전). Compare Mode 는 캔버스를 반폭으로 밀어 다른 페이지가
    //   같이 잡힌다 (메모리 feedback-compare-mode-halves-canvas-hides-area-delta) — 픽셀 판정은 전폭에서.
    const seen = Object.fromEntries(TYPES.map((t) => [t, {}]));
    for (const chartType of TYPES)
      for (const palette of ["categorical", "mono"]) {
        await setProps(placed.id, { chartType, palette });
        await page.waitForTimeout(2200);
        seen[chartType][palette] = { ink: await skiaInk(page) };
        await page.screenshot({
          path: `${OUT_DIR}/${chartType}-${palette}-skia.png`,
        });
      }

    // 2단계 — Preview (Compare Mode)
    const compare = page
      .locator('[aria-label="Compare Mode (Preview + Skia)"]')
      .first();
    if (!(await compare.count())) throw new Error("Compare Mode 버튼 없음");
    await compare.click();
    await page.waitForTimeout(4000);
    for (const chartType of TYPES)
      for (const palette of ["categorical", "mono"]) {
        await setProps(placed.id, { chartType, palette });
        await page.waitForTimeout(2200);
        seen[chartType][palette].preview = await previewPaints(page);
        await page.screenshot({
          path: `${OUT_DIR}/${chartType}-${palette}-preview.png`,
        });
      }

    for (const chartType of TYPES) {
      const cat = seen[chartType].categorical,
        mono = seen[chartType].mono;
      const skiaBins = (s) => s.ink.map((b) => b.rgb);
      record(
        `${chartType} · Skia: categorical 에 teal, mono 에 accent-1 (teal 소실)`,
        anyNear(skiaBins(cat), TEAL) &&
          anyNear(skiaBins(mono), MONO1) &&
          !anyNear(skiaBins(mono), TEAL),
        `cat ${JSON.stringify(skiaBins(cat).slice(0, 4))} mono ${JSON.stringify(skiaBins(mono).slice(0, 4))}`,
      );
      record(
        `${chartType} · Preview: data-palette 전환 + 마크 페인트가 teal → accent-1`,
        cat.preview.found &&
          cat.preview.palette === null &&
          mono.preview.palette === "mono" &&
          anyNear(cat.preview.paints, TEAL) &&
          anyNear(mono.preview.paints, MONO1) &&
          !anyNear(mono.preview.paints, TEAL),
        `status ${mono.preview.status} cat ${JSON.stringify(cat.preview.paints.slice(0, 4))} mono ${JSON.stringify(mono.preview.paints.slice(0, 4))}`,
      );
    }
  } finally {
    writeFileSync(`${OUT_DIR}/findings.json`, JSON.stringify(findings, null, 2));
    const failed = findings.filter((f) => !f.pass);
    log(`${findings.length - failed.length}/${findings.length} PASS`);
    await context.close();
    await browser.close();
    process.exitCode = failed.length ? 1 : 0;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

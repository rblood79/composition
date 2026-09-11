#!/usr/bin/env node
// adr215-chart-palette-live.mjs — ADR-215 G4 live exercise (실제 Canvas / Preview 소비).
//
// browser 테스트 (chartPalette.browser.test.tsx, G1) 가 못 보는 것만 확인한다:
//   1) 기본 팔레트가 Spectrum categorical 로 그려진다 (Skia 픽셀 teal · indigo)
//   2) Properties > Appearance > Palette → Mono 가 canonical `palette:"mono"` 를 쓰고 Skia 가 accent 사다리로 다시 그린다
//   3) Preview(Compare Mode) 가 `data-palette="mono"` + 같은 `--chart-series-N` 해소값을 낸다
//   4) Themes tint Pink 로 mono 가 양 leg 에서 accent 를 따라간다 (CSS relative color ↔ oklchToHex 같은 공식)
//   5) dark + categorical — 값이 테마 공용이라 Preview fill 무변경
//
// 준비: builder dev (5173) · 로그인 세션 (`apps/builder/scripts/.auth-session.json`).
// 사용: node apps/builder/scripts/adr215-chart-palette-live.mjs [--headed]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady, createInstrumentedContext } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const PUBLISH_URL = "http://localhost:3001";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = "/private/tmp/adr215-chart-palette-live";
const headed = process.argv.includes("--headed");

function log(...args) {
  console.log("[ADR-215 live]", ...args);
}

async function createProject(page) {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr215-palette-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  return page.url();
}

/**
 * Skia 픽셀 — 페이지 안에서 못 읽으므로 스크린샷을 디코드한다. 채도 있는 픽셀의 **주색**
 * (가장 많은 32-단계 색 상자의 평균 rgb) 을 돌려준다 — Preview fill 과 대조하는 값이다.
 * 상단 48px (툴바 DOM overlay) 은 뺀다.
 */
async function skiaInk(page) {
  const canvas = page.locator("canvas").first();
  const png = await canvas.screenshot();
  // 스크린샷은 device px 다 — 48 CSS px 툴바를 DPR 로 환산해 뺀다.
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
      let chroma = 0;
      for (let y = minRow; y < off.height; y++)
        for (let x = 0; x < off.width; x++) {
          const i = (y * off.width + x) * 4;
          const r = data[i],
            g = data[i + 1],
            b = data[i + 2];
          const max = Math.max(r, g, b),
            min = Math.min(r, g, b);
          if (max - min < 60 || max < 90) continue;
          chroma++;
          const key = `${r >> 5}:${g >> 5}:${b >> 5}`;
          const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
          bin.n++;
          bin.r += r;
          bin.g += g;
          bin.b += b;
          bins.set(key, bin);
        }
      const ranked = [...bins.values()].sort((a, b) => b.n - a.n);
      const avg = (bin) => ({
        n: bin.n,
        rgb: [bin.r / bin.n, bin.g / bin.n, bin.b / bin.n].map(Math.round),
      });
      return {
        chroma,
        dominant: ranked[0] ? avg(ranked[0]) : null,
        // 상위 색 상자 — Preview fill 이 이 중 하나와 가까우면 두 leg 가 같은 토큰을 푼 것이다
        //   (dark 에서는 캔버스 바탕이 주색이 될 수 있어 dominant 하나로 판정하지 않는다).
        bins: ranked.slice(0, 8).map(avg),
      };
    },
    { base64: png.toString("base64"), minRow: Math.round(48 * dpr) },
  );
}

async function chartProps(page, id) {
  return page.evaluate((elementId) => {
    const el = window.__composition_STORE__
      .getState()
      .elements.find((e) => e.id === elementId);
    return el ? el.props : null;
  }, id);
}

const RAIL_ORDER = [
  "navigator",
  "components",
  "datatable",
  "datatableEditor",
  "theme",
  "ai",
  "properties",
  "styles",
  "interactions",
  "history",
];
function railButton(page, panelId) {
  return page
    .locator(".panel-toggle-rail button")
    .nth(RAIL_ORDER.indexOf(panelId));
}
async function setPanel(page, panelId, open) {
  const button = railButton(page, panelId);
  const pressed = (await button.getAttribute("aria-pressed")) === "true";
  if (pressed !== open) {
    await button.click();
    await page.waitForTimeout(900);
  }
}
async function closeAllPanels(page) {
  const buttons = page.locator(".panel-toggle-rail button");
  const n = await buttons.count();
  for (let i = 0; i < n; i++)
    if ((await buttons.nth(i).getAttribute("aria-pressed")) === "true") {
      await buttons.nth(i).click();
      await page.waitForTimeout(500);
    }
  await page.waitForTimeout(600);
}

async function pickOption(page, groupName, optionName) {
  const group = page.getByRole("group", { name: groupName }).first();
  await group.getByRole("button").first().click();
  await page.getByRole("option", { name: optionName }).first().click();
  await page.waitForTimeout(400);
}

/** Preview(Compare Mode) iframe 의 Chart — 문자열 · fill · 토큰 값. */
async function readPreview(page) {
  return page.evaluate(() => {
    for (const frame of document.querySelectorAll("iframe")) {
      const doc = frame.contentDocument;
      const chart = doc?.querySelector(".react-aria-Chart");
      if (!chart) continue;
      const svg = chart.querySelector("svg");
      const view = doc.defaultView;
      const cs = view.getComputedStyle(chart);
      // 마크 = 격자/장식 밖의 채워진 path (bar rect · area · pie 조각). fill 은 oklch 일 수 있어
      //   2D 캔버스로 rgb 를 얻고, fill-opacity 를 컨테이너 배경 위에 합성한다 (Skia 픽셀과 같은 뜻).
      const toRgb = (paint) => {
        const ctx = doc.createElement("canvas").getContext("2d");
        ctx.fillStyle = paint;
        ctx.fillRect(0, 0, 1, 1);
        return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
      };
      const bg = toRgb(
        cs.backgroundColor === "rgba(0, 0, 0, 0)"
          ? view.getComputedStyle(doc.body).backgroundColor
          : cs.backgroundColor,
      );
      const paths = [...(svg?.querySelectorAll("path") ?? [])].filter((p) => {
        if (p.closest("[data-chart-grid], [data-chart-decoration]"))
          return false;
        const fill = view.getComputedStyle(p).fill;
        return fill && fill !== "none" && !/^rgba?\(0, 0, 0, 0\)$/.test(fill);
      });
      const fills = [
        ...new Set(
          paths.map((p) => {
            const ps = view.getComputedStyle(p);
            const alpha = Number(ps.fillOpacity || 1);
            const c = toRgb(ps.fill);
            return JSON.stringify(
              c.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha))),
            );
          }),
        ),
      ].map((t) => JSON.parse(t));
      return {
        found: true,
        theme: doc.documentElement.getAttribute("data-theme"),
        pathCount: paths.length,
        fills,
        texts: [...(svg?.querySelectorAll("text") ?? [])]
          .map((t) => t.textContent?.trim())
          .filter(Boolean),
        legend: [
          ...(svg?.querySelectorAll("[data-chart-decoration] text") ?? []),
        ].map((t) => t.textContent?.trim()),
        seriesVars: [1, 2, 3, 4].map((i) =>
          cs.getPropertyValue(`--chart-series-${i}`).trim(),
        ),
        palette: chart.getAttribute("data-palette"),
        status: chart.getAttribute("data-chart-status"),
      };
    }
    return { found: false };
  });
}

/** Preview iframe 의 Chart svg 를 실제 마우스 좌표로 hover 하고 키보드로 이동한다. */
async function previewFrame(page) {
  for (const frame of page.frames()) {
    if (frame === page.mainFrame()) continue;
    if (await frame.locator(".react-aria-Chart").count()) return frame;
  }
  return null;
}

const near = (a, b, tol = 16) =>
  !!a && !!b && a.every((c, i) => Math.abs(c - b[i]) <= tol);
const inBins = (rgb, ink) =>
  !!rgb && (ink?.bins ?? []).some((bin) => near(rgb, bin.rgb));

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
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const EXPECT = {
    categorical: [hex("#0fb5ae"), hex("#4046ca")],
    monoBlue: [hex("#142bbb"), hex("#3660f0")],
  };
  const inkHas = (ink, rgb, tol = 20) =>
    (ink?.bins ?? []).some((bin) => near(rgb, bin.rgb, tol));

  try {
    const projectUrl = await createProject(page);
    log("project", projectUrl);
    await setPanel(page, "components", true);
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
      return chart ? { id: chart.id, chartType: chart.props?.chartType } : null;
    });
    if (!placed) throw new Error("Chart 미생성");
    // bar 로 고정 — area 는 fill-opacity 합성이라 픽셀이 토큰 hex 와 달라진다 (합성은 ADR-210 P3 몫).
    //   불투명 막대에서 팔레트 값 자체를 본다.
    await page.evaluate(
      (id) =>
        window.__composition_STORE__
          .getState()
          .updateElementProps(id, { chartType: "bar" }),
      placed.id,
    );
    await page.waitForTimeout(1500);
    placed.chartType = (await chartProps(page, placed.id))?.chartType;
    log("chart", placed);
    await closeAllPanels(page);
    await page.evaluate(() =>
      window.__composition_STORE__.getState().setSelectedElement(null),
    );
    await page.waitForTimeout(800);

    // 1. 기본 팔레트 = Spectrum categorical — Skia 픽셀
    const inkCat = await skiaInk(page);
    await page.screenshot({ path: `${OUT_DIR}/skia-categorical.png` });
    record(
      "기본 팔레트 (categorical): Skia 가 Spectrum 1·2 (teal #0fb5ae · indigo #4046ca) 로 그린다",
      inkHas(inkCat, EXPECT.categorical[0]) &&
        inkHas(inkCat, EXPECT.categorical[1]),
      `bins ${JSON.stringify(inkCat.bins.map((b) => b.rgb))}`,
    );

    // 2. Properties > Appearance > Palette → Mono
    await page.evaluate(
      (id) => window.__composition_STORE__.getState().setSelectedElement(id),
      placed.id,
    );
    await setPanel(page, "properties", true);
    await page.waitForTimeout(1200);
    const paletteGroup = page
      .getByRole("group", { name: /^(Palette|팔레트)$/ })
      .first();
    await paletteGroup.scrollIntoViewIfNeeded();
    await paletteGroup.getByRole("button").first().click();
    await page
      .getByRole("option", { name: /^(Mono|단색)$/ })
      .first()
      .click();
    await page.waitForTimeout(1200);
    const props = await chartProps(page, placed.id);
    record(
      '패널 Palette → Mono 가 canonical `palette:"mono"` 를 쓴다',
      props?.palette === "mono",
      JSON.stringify({ palette: props?.palette }),
    );
    await page.screenshot({ path: `${OUT_DIR}/panel-mono.png` });
    await closeAllPanels(page);
    await page.evaluate(() =>
      window.__composition_STORE__.getState().setSelectedElement(null),
    );
    await page.waitForTimeout(1000);
    const inkMono = await skiaInk(page);
    await page.screenshot({ path: `${OUT_DIR}/skia-mono.png` });
    record(
      "mono: Skia 가 accent 사다리 1·2 (#142bbb · #3660f0, 기본 tint blue) 로 다시 그리고 teal 은 사라진다",
      inkHas(inkMono, EXPECT.monoBlue[0]) &&
        inkHas(inkMono, EXPECT.monoBlue[1]) &&
        !inkHas(inkMono, EXPECT.categorical[0]),
      `bins ${JSON.stringify(inkMono.bins.map((b) => b.rgb))}`,
    );

    // 3. Preview (Compare Mode) — data-palette + --chart-series-N 해소값 == Skia
    const compare = page
      .locator('[aria-label="Compare Mode (Preview + Skia)"]')
      .first();
    let preview = { found: false };
    if (await compare.count()) {
      await compare.click();
      await page.waitForTimeout(4000);
      preview = await readPreview(page);
      await page.screenshot({ path: `${OUT_DIR}/preview-mono.png` });
    }
    record(
      "Preview: data-palette=mono · --chart-series-1 해소 fill 이 Skia mono 주색과 같다",
      preview.found &&
        preview.palette === "mono" &&
        preview.fills.some(
          (f) =>
            near(f, EXPECT.monoBlue[0], 20) || near(f, EXPECT.monoBlue[1], 20),
        ),
      JSON.stringify({
        palette: preview.palette,
        fills: preview.fills,
        seriesVars: preview.seriesVars,
      }),
    );

    // 4. tint pink → mono 가 따라간다 (Skia + Preview)
    await setPanel(page, "theme", true);
    await page.waitForTimeout(900);
    const pink = page.getByRole("button", { name: "Pink" }).first();
    let inkPink = null;
    let previewPink = { found: false };
    if (await pink.count()) {
      await pink.click({ force: true });
      await page.waitForTimeout(2500);
      await setPanel(page, "theme", false);
      await page.waitForTimeout(1200);
      previewPink = await readPreview(page);
      inkPink = await skiaInk(page);
      await page.screenshot({ path: `${OUT_DIR}/pink.png` });
    }
    const pinkish = (rgb) => !!rgb && rgb[0] > rgb[1] + 40 && rgb[0] > rgb[2];
    record(
      "tint Pink: mono 가 accent 를 따라간다 — Skia 주색이 파랑→분홍, Preview fill 도 분홍 (양 leg 같은 공식)",
      !!inkPink &&
        pinkish(inkPink.dominant?.rgb) &&
        previewPink.found &&
        previewPink.fills.some(pinkish),
      JSON.stringify({ skia: inkPink?.dominant, preview: previewPink.fills }),
    );
    record(
      "tint Pink: Preview fill ⊂ Skia bins (±20)",
      previewPink.found &&
        previewPink.fills.every(
          (f) =>
            inBins(f, inkPink) ||
            f.every(
              (c, i) => Math.abs(c - (inkPink?.dominant?.rgb?.[i] ?? 0)) <= 20,
            ),
        ),
      `preview ${JSON.stringify(previewPink.fills)} vs skia ${JSON.stringify(inkPink?.bins?.map((b) => b.rgb))}`,
    );

    // 5. dark — categorical 값이 테마 공용 (Preview var 해소값 무변경)
    await page.evaluate(
      (id) => window.__composition_STORE__.getState().setSelectedElement(id),
      placed.id,
    );
    await setPanel(page, "properties", true);
    await page.waitForTimeout(1000);
    await paletteGroup.scrollIntoViewIfNeeded();
    await paletteGroup.getByRole("button").first().click();
    await page
      .getByRole("option", { name: /^(Categorical|범주형)$/ })
      .first()
      .click();
    await page.waitForTimeout(1000);
    await closeAllPanels(page);
    await page.evaluate(() =>
      window.__composition_STORE__.getState().setSelectedElement(null),
    );
    await setPanel(page, "theme", true);
    await page.waitForTimeout(600);
    const darkSwitch = page.getByLabel("Switch to dark mode").first();
    let previewDark = { found: false };
    if (await darkSwitch.count()) {
      await darkSwitch.click({ force: true });
      await page.waitForTimeout(3000);
      await setPanel(page, "theme", false);
      await page.waitForTimeout(1000);
      previewDark = await readPreview(page);
      await page.screenshot({
        path: `${OUT_DIR}/preview-dark-categorical.png`,
      });
    }
    record(
      "dark + categorical: Preview data-palette 없음 · fill 이 Spectrum 1·2 그대로 (테마 공용)",
      previewDark.found &&
        previewDark.theme === "dark" &&
        previewDark.palette === null &&
        previewDark.fills.some((f) => near(f, EXPECT.categorical[0], 20)) &&
        previewDark.fills.some((f) => near(f, EXPECT.categorical[1], 20)),
      JSON.stringify({
        theme: previewDark.theme,
        palette: previewDark.palette,
        fills: previewDark.fills,
      }),
    );
  } finally {
    writeFileSync(
      `${OUT_DIR}/findings.json`,
      JSON.stringify(findings, null, 2),
    );
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

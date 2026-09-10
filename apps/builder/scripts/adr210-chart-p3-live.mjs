#!/usr/bin/env node
// adr210-chart-p3-live.mjs — ADR-210 G3 live exercise (실제 Canvas / Preview / Publish 소비).
//
// 브라우저 테스트 (adr210Presentation.browser.test.tsx) 가 못 보는 것만 확인한다:
//   1) 실제 패널로 만든 문서 (columns + 표시 이름 + 팔레트 토큰 + 통화) 가 canonical 에 실린다
//   2) Skia 가 지정 토큰 색으로 다시 그린다 (픽셀 주색 변화)
//   3) Preview(Compare Mode) 의 Recharts 가 같은 문서에서 표시 이름 · 통화 눈금 · 같은 색을 낸다
//      (Preview fill rgb ≈ Skia 주색 rgb — 두 leg 가 같은 토큰을 푼다)
//   4) Preview 의 hover / 키보드 tooltip 이 표시 이름 · 통화 문자열을 내고 canonical write 0
//   5) Themes 패널 dark 전환이 두 leg 의 색을 함께 바꾸고 문자열은 그대로다 (Skia 는 Compare Mode 전에 잰다)
//   6) 메뉴 Export → 독립 publish (3001) 가 Builder 없이 같은 문자열 · 색을 낸다 (T11 "export 독립 publish")
//
// 준비: builder dev (5173) · publish dev (`pnpm -F @composition/publish dev`, 3001) · 로그인 세션.
// 사용: node apps/builder/scripts/adr210-chart-p3-live.mjs [--headed]
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady, createInstrumentedContext } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const PUBLISH_URL = "http://localhost:3001";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = "/private/tmp/adr210-chart-p3-live";
const headed = process.argv.includes("--headed");
const LABEL = "모바일 방문자 (월간 합계)";
const TOKEN = "--chart-series-5";

function log(...args) {
  console.log("[ADR-210 P3 live]", ...args);
}

async function createProject(page) {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr210-p3-${Date.now()}`);
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
      const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
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
          const r = data[i], g = data[i + 1], b = data[i + 2];
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
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
      const avg = (bin) => ({ n: bin.n, rgb: [bin.r / bin.n, bin.g / bin.n, bin.b / bin.n].map(Math.round) });
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
    const el = window.__composition_STORE__.getState().elements.find((e) => e.id === elementId);
    return el ? el.props : null;
  }, id);
}

const RAIL_ORDER = ["navigator", "components", "datatable", "datatableEditor", "theme", "ai", "properties", "styles", "interactions", "history"];
function railButton(page, panelId) {
  return page.locator(".panel-toggle-rail button").nth(RAIL_ORDER.indexOf(panelId));
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
      const bg = toRgb(cs.backgroundColor === "rgba(0, 0, 0, 0)" ? view.getComputedStyle(doc.body).backgroundColor : cs.backgroundColor);
      const paths = [...(svg?.querySelectorAll("path") ?? [])].filter((p) => {
        if (p.closest("[data-chart-grid], [data-chart-decoration]")) return false;
        const fill = view.getComputedStyle(p).fill;
        return fill && fill !== "none" && !/^rgba?\(0, 0, 0, 0\)$/.test(fill);
      });
      const fills = [...new Set(paths.map((p) => {
        const ps = view.getComputedStyle(p);
        const alpha = Number(ps.fillOpacity || 1);
        const c = toRgb(ps.fill);
        return JSON.stringify(c.map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha))));
      }))].map((t) => JSON.parse(t));
      return {
        found: true,
        theme: doc.documentElement.getAttribute("data-theme"),
        pathCount: paths.length,
        fills,
        texts: [...(svg?.querySelectorAll("text") ?? [])].map((t) => t.textContent?.trim()).filter(Boolean),
        legend: [...(svg?.querySelectorAll("[data-chart-decoration] text") ?? [])].map((t) => t.textContent?.trim()),
        seriesVar: cs.getPropertyValue("--chart-series-5").trim(),
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

const near = (a, b, tol = 16) => !!a && !!b && a.every((c, i) => Math.abs(c - b[i]) <= tol);
const inBins = (rgb, ink) => !!rgb && (ink?.bins ?? []).some((bin) => near(rgb, bin.rgb));

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: !headed });
  const storageState = JSON.parse(readFileSync(STORAGE_STATE, "utf8"));
  const { context, page } = await createInstrumentedContext(browser, { storageState, cpuThrottle: 1 });
  const findings = [];
  const record = (name, pass, detail) => {
    findings.push({ name, pass, detail });
    log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
  };
  let fileServer = null;

  try {
    const projectUrl = await createProject(page);
    log("project", projectUrl);

    await setPanel(page, "components", true);
    const chartButton = page.locator('[data-component-type="Chart"], button:has-text("chart")').first();
    await chartButton.waitFor({ state: "visible", timeout: 20_000 });
    await chartButton.click();
    await page.waitForTimeout(2500);
    const placed = await page.evaluate(() => {
      const chart = window.__composition_STORE__.getState().elements.find((e) => e.type === "Chart");
      return chart ? { id: chart.id } : null;
    });
    if (!placed) throw new Error("Chart 미생성");
    await page.evaluate((id) => window.__composition_STORE__.getState().setSelectedElement(id), placed.id);
    await setPanel(page, "components", false);
    await setPanel(page, "properties", true);
    await page.waitForTimeout(1200);

    // ── 1) 실제 패널: 값 컬럼 → 표시 이름 → 팔레트 토큰 → 통화 USD ─────────────
    await pickOption(page, /Series Source|시리즈 원천/, /Value Columns|값 컬럼/);
    const picker = page.getByRole("group", { name: /Choose value fields|값 필드 선택/ }).first();
    await picker.waitFor({ state: "visible", timeout: 5_000 });
    await picker.getByText(/^value ·/).first().click();
    if (!(await picker.getByRole("checkbox", { name: /^value ·/ }).first().isChecked()))
      await picker.getByRole("checkbox", { name: /^value ·/ }).first().click({ force: true });
    await picker.getByRole("button", { name: /Apply|적용/ }).first().click();
    await page.waitForTimeout(1500);
    // 색 토큰을 바꾸기 전 Skia 주색 (series-1).
    await closeAllPanels(page);
    await page.evaluate(() => window.__composition_STORE__.getState().setSelectedElement(null));
    await page.waitForTimeout(800);
    const inkBefore = await skiaInk(page);
    await page.evaluate((id) => window.__composition_STORE__.getState().setSelectedElement(id), placed.id);
    await setPanel(page, "properties", true);
    await page.waitForTimeout(1000);

    const seriesGroup = page.getByRole("group", { name: /Series Settings|시리즈 설정/ }).first();
    const nameInput = seriesGroup.getByRole("group", { name: /Display Name|표시 이름/ }).first().locator("input").first();
    await nameInput.click();
    await nameInput.fill(LABEL);
    await nameInput.press("Enter");
    await page.waitForTimeout(900);
    const colorGroup = seriesGroup.getByRole("group", { name: /Palette Color|팔레트 색/ }).first();
    await colorGroup.getByRole("button").first().click();
    await page.getByRole("option", { name: TOKEN }).first().click();
    await page.waitForTimeout(900);
    await pickOption(page, /Number Format|숫자 형식/, /Currency|통화/);
    await pickOption(page, /Currency Code|통화 코드/, "USD");
    await page.getByRole("button", { name: /Apply|적용/ }).first().click();
    await page.waitForTimeout(1500);
    const props = await chartProps(page, placed.id);
    record(
      "실제 패널 조작이 canonical 에 columns + 표시 이름 + 토큰 + 통화를 쓴다",
      props?.dataMode === "columns" &&
        JSON.stringify(props?.valueFields) === JSON.stringify(["value"]) &&
        props?.seriesConfig?.[0]?.label === LABEL &&
        props?.seriesConfig?.[0]?.colorToken === TOKEN &&
        props?.valueFormat === "currency" &&
        props?.valueCurrency === "USD",
      JSON.stringify({
        dataMode: props?.dataMode,
        valueFields: props?.valueFields,
        seriesConfig: props?.seriesConfig,
        valueFormat: props?.valueFormat,
        valueCurrency: props?.valueCurrency,
      }),
    );
    await page.screenshot({ path: `${OUT_DIR}/panel.png` });

    // ── 2) Skia 주색이 토큰 지정으로 바뀐다 ────────────────────────────────────
    await closeAllPanels(page);
    await page.evaluate(() => window.__composition_STORE__.getState().setSelectedElement(null));
    await page.waitForTimeout(1000);
    const inkAfter = await skiaInk(page);
    await page.screenshot({ path: `${OUT_DIR}/skia-token.png` });
    record(
      "Skia 가 지정 토큰 (--chart-series-5) 색으로 다시 그린다 (주색 변화)",
      !!inkAfter.dominant && !!inkBefore.dominant && !near(inkAfter.dominant.rgb, inkBefore.dominant.rgb, 24),
      `dominant ${JSON.stringify(inkBefore.dominant)} → ${JSON.stringify(inkAfter.dominant)}`,
    );

    // ── 3) dark 전환 (Themes 패널 실제 스위치) → Skia dark 픽셀 — Compare Mode 전에 잰다
    //     (Compare Mode 는 캔버스를 반폭으로 줄여 차트가 화면 밖으로 밀린다).
    await setPanel(page, "theme", true);
    await page.waitForTimeout(900);
    const darkSwitch = page.getByLabel("Switch to dark mode").first();
    const hasDark = await darkSwitch.count();
    let inkDark = null;
    if (hasDark) {
      await darkSwitch.click({ force: true });
      await page.waitForTimeout(3000);
      await setPanel(page, "theme", false);
      await page.waitForTimeout(800);
      inkDark = await skiaInk(page);
      await page.screenshot({ path: `${OUT_DIR}/skia-dark.png` });
    }

    // ── 4) Preview (Compare Mode) — 같은 문서의 Recharts, dark → light ───────
    const compare = page.locator('[aria-label="Compare Mode (Preview + Skia)"]').first();
    let dark = { found: false };
    let preview = { found: false };
    if (await compare.count()) {
      await compare.click();
      await page.waitForTimeout(4000);
      dark = await readPreview(page);
      await page.screenshot({ path: `${OUT_DIR}/preview-dark.png` });
      if (hasDark) {
        await setPanel(page, "theme", true);
        await page.getByLabel("Switch to light mode").first().click({ force: true });
        await page.waitForTimeout(2500);
        await setPanel(page, "theme", false);
        await page.waitForTimeout(800);
      }
      preview = await readPreview(page);
    }
    await page.screenshot({ path: `${OUT_DIR}/preview.png` });
    const previewFill = preview.fills?.[0] ?? null;
    record(
      "Preview 가 표시 이름 · USD 통화 눈금을 그린다 (R6 문자열 대칭)",
      preview.found && preview.texts.includes(LABEL) && preview.texts.some((t) => /^\$\d/.test(t)) && !preview.texts.includes("value"),
      JSON.stringify({ texts: preview.texts, status: preview.status }),
    );
    record(
      "Preview 의 시리즈 fill 이 Skia 주색과 같다 (같은 토큰을 두 leg 가 푼다)",
      preview.fills?.length === 1 && inBins(previewFill, inkAfter),
      `preview ${JSON.stringify(preview.fills)} vs skia bins ${JSON.stringify(inkAfter.bins.map((b) => b.rgb))} · --chart-series-5=${preview.seriesVar}`,
    );
    record(
      "dark 전환이 두 leg 의 토큰 색을 함께 바꾸고 문자열은 그대로다 (T10 light/dark)",
      !!hasDark && dark.theme === "dark" && preview.theme !== "dark" && dark.seriesVar !== preview.seriesVar &&
        JSON.stringify(dark.texts) === JSON.stringify(preview.texts) &&
        !!inkDark && dark.fills?.length === 1 && inBins(dark.fills[0], inkDark) && !near(dark.fills[0], previewFill, 24),
      `theme ${dark.theme} → ${preview.theme} · --chart-series-5 ${dark.seriesVar} → ${preview.seriesVar} · dark preview fill ${JSON.stringify(dark.fills?.[0])} vs skia dark bins ${JSON.stringify(inkDark?.bins?.map((b) => b.rgb))}`,
    );

    // ── 5) hover / 키보드 tooltip → canonical write 0 ───────────────────────
    const versionBefore = await page.evaluate(() => window.__canonical_STORE__.getState().documentVersion);
    const frame = await previewFrame(page);
    let tooltip = "";
    if (frame) {
      const svg = frame.locator('svg[role="application"]').first();
      const box = await svg.boundingBox();
      if (box) {
        await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.55);
        await page.waitForTimeout(600);
      }
      tooltip = (await frame.locator(".react-aria-Chart-tooltip").first().textContent().catch(() => "")) ?? "";
      if (!tooltip.includes(LABEL)) {
        await svg.focus();
        await page.keyboard.press("ArrowRight");
        await page.waitForTimeout(600);
        tooltip = (await frame.locator(".react-aria-Chart-tooltip").first().textContent().catch(() => "")) ?? "";
      }
    }
    const versionAfter = await page.evaluate(() => window.__canonical_STORE__.getState().documentVersion);
    record(
      "Preview hover/키보드 tooltip 이 표시 이름 + 통화 문자열을 내고 canonical write 0",
      tooltip.includes(LABEL) && /\$\d/.test(tooltip) && versionAfter === versionBefore,
      `tooltip=${JSON.stringify(tooltip)} documentVersion ${versionBefore} → ${versionAfter}`,
    );

    // ── 6) Export → 독립 publish ─────────────────────────────────────────────
    await page.waitForTimeout(3000);
    let exported = null;
    try {
      await page.locator(".header-menu-trigger, button.header-menu-button, [aria-label='Menu']").first().click();
      await page.waitForTimeout(600);
      const exportItem = page.locator('.header-menu-item[id$="export"], .header-menu-item').filter({ hasText: /^(내보내기|Export)$/ }).first();
      const [download] = await Promise.all([page.waitForEvent("download", { timeout: 20_000 }), exportItem.click()]);
      await download.saveAs(`${OUT_DIR}/project.json`);
      exported = readFileSync(`${OUT_DIR}/project.json`, "utf8");
    } catch (error) {
      log("export 실패", error?.message ?? error);
    }
    let publish = { found: false };
    if (exported) {
      fileServer = createServer((_req, res) => {
        res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
        res.end(exported);
      });
      await new Promise((r) => fileServer.listen(0, "127.0.0.1", r));
      const projectJsonUrl = `http://127.0.0.1:${fileServer.address().port}/project.json`;
      const publishPage = await browser.newPage({ viewport: { width: 1200, height: 800 } });
      try {
        await publishPage.goto(`${PUBLISH_URL}/?project=${encodeURIComponent(projectJsonUrl)}`, { waitUntil: "networkidle", timeout: 60_000 });
        await publishPage.waitForSelector(".react-aria-Chart svg", { timeout: 30_000 });
        await publishPage.waitForTimeout(2500);
        publish = await publishPage.evaluate(() => {
          const chart = document.querySelector(".react-aria-Chart");
          const svg = chart?.querySelector("svg");
          const toRgb = (paint) => {
            const ctx = document.createElement("canvas").getContext("2d");
            ctx.fillStyle = paint;
            ctx.fillRect(0, 0, 1, 1);
            return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3);
          };
          const cs = getComputedStyle(chart);
          const bg = toRgb(cs.backgroundColor === "rgba(0, 0, 0, 0)" ? getComputedStyle(document.body).backgroundColor : cs.backgroundColor);
          const paths = [...(svg?.querySelectorAll("path") ?? [])].filter((p) => {
            if (p.closest("[data-chart-grid], [data-chart-decoration]")) return false;
            const fill = getComputedStyle(p).fill;
            return fill && fill !== "none" && !/^rgba?\(0, 0, 0, 0\)$/.test(fill);
          });
          return {
            found: !!svg,
            texts: [...(svg?.querySelectorAll("text") ?? [])].map((t) => t.textContent?.trim()).filter(Boolean),
            fills: [...new Set(paths.map((p) => {
              const ps = getComputedStyle(p);
              const alpha = Number(ps.fillOpacity || 1);
              return JSON.stringify(toRgb(ps.fill).map((v, i) => Math.round(v * alpha + bg[i] * (1 - alpha))));
            }))].map((t) => JSON.parse(t)),
            theme: document.documentElement.getAttribute("data-theme"),
          };
        });
        await publishPage.screenshot({ path: `${OUT_DIR}/publish.png` });
      } catch (error) {
        log("publish 실패", error?.message ?? error);
      } finally {
        await publishPage.close();
      }
    }
    record(
      "독립 publish 가 Builder 없이 같은 표시 이름 · USD 눈금 · 같은 fill 을 낸다 (T11)",
      publish.found && publish.texts.includes(LABEL) && publish.texts.some((t) => /^\$\d/.test(t)) &&
        JSON.stringify(publish.texts) === JSON.stringify(preview.texts) && publish.fills.length === 1 && near(publish.fills[0], previewFill),
      JSON.stringify({ export: !!exported, texts: publish.texts, fills: publish.fills, previewFill: preview.fills, theme: publish.theme }),
    );
  } catch (error) {
    record("harness", false, String(error?.stack ?? error));
  } finally {
    writeFileSync(`${OUT_DIR}/findings.json`, JSON.stringify({ at: new Date().toISOString(), findings }, null, 2));
    fileServer?.close();
    await context.close();
    await browser.close();
  }
  const failed = findings.filter((f) => !f.pass);
  log(`${findings.length - failed.length}/${findings.length} PASS`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main();

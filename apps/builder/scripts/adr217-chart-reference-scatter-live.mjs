#!/usr/bin/env node
// adr217-chart-reference-scatter-live.mjs — ADR-217 Phase 6 live: 실제 빌더 (Skia) + Preview (DOM) 에서
// 기준선 · 산점도 · 미지원 chartType 안전 경로 · 패널 편집을 한 번 실제로 exercise 한다 (G4).
//
// 판정 (두 단계 — Compare Mode 는 캔버스를 반폭으로 밀므로 Skia 픽셀은 먼저 전폭에서):
//   1) Skia — bar 3 범주에 `referenceLines` (120, dashed, "Target") 를 주면 막대 **위** 에 진한 중립색
//      가로 잉크 행이 생긴다 (전에는 0 행). 산점도로 바꾸면 (chartType 전환 — dimensionScale 미설정 =
//      linear) 시리즈 색 픽셀이 선 없이 점 묶음으로만 남는다 (teal 열 묶음 ≥ 3).
//   2) Preview (Compare Mode) — `[data-chart-reference-front] line` (dash 6 4) + `text` "Target" · backdrop
//      의 back 선 · 눈금 "120" · 산점도 점 8 (`[data-chart-scatter-dot]`) · 12,000 점 창 [0, 5000] thumb 2 ·
//      End 로 넓히면 점 ≤ 5,000 (희소 극값) · 미지원 chartType ("hexbin") 은 두 leg 가 설정 오류 표시
//      (pageerror 0) · 패널 "기준선 추가" 클릭 → canonical props.referenceLines +1 (write 1) · 창 write 0.
//
// 준비: builder dev (5173) · 라이선스 세션 (`apps/builder/scripts/.auth-session.json`).
// 사용: node apps/builder/scripts/adr217-chart-reference-scatter-live.mjs [--headed]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady, createInstrumentedContext } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = "/private/tmp/adr217-p6/live";
const headed = process.argv.includes("--headed");
const log = (...args) => console.log("[ADR-217 live]", ...args);

const BAR_ROWS = [
  { id: "a", category: "A", value: 40 },
  { id: "b", category: "B", value: 100 },
  { id: "c", category: "C", value: 70 },
];
const SCATTER_ROWS = [
  { id: "1", x: 1, y: 12, series: "A" },
  { id: "2", x: 2, y: 20, series: "A" },
  { id: "3", x: 3, y: 8, series: "A" },
  { id: "4", x: 4, y: 25, series: "A" },
  { id: "5", x: 4, y: 25, series: "A" },
  { id: "6", x: 1.5, y: 6, series: "B" },
  { id: "7", x: 2.5, y: 14, series: "B" },
  { id: "8", x: 3.5, y: 18, series: "B" },
];
const SCATTER_12K = Array.from({ length: 12_000 }, (_, i) => ({
  id: String(i),
  x: i / 10 + ((i * 7) % 13) / 40,
  y: 20 + ((i * 31) % 97),
  series: ["A", "B", "C", "D"][i % 4],
}));

async function createProject(page) {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr217-ref-scatter-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  return page.url();
}

/** Skia 픽셀 — 시리즈 색 (teal · indigo) 열 프로파일 + 진한 중립 잉크 행 (상단 48px 툴바 제외). */
async function skiaProfile(page) {
  const canvas = page.locator("canvas").first();
  const png = await canvas.screenshot();
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
      const cols = new Array(off.width).fill(0);
      let sMinY = Infinity, sMaxY = -Infinity, sMinX = Infinity, sMaxX = -Infinity;
      const isTeal = (i) => Math.abs(data[i] - 15) < 40 && Math.abs(data[i + 1] - 181) < 40 && Math.abs(data[i + 2] - 174) < 40;
      for (let y = minRow; y < off.height; y++)
        for (let x = 0; x < off.width; x++) {
          const i = (y * off.width + x) * 4;
          if (isTeal(i)) {
            cols[x]++;
            if (y < sMinY) sMinY = y;
            if (y > sMaxY) sMaxY = y;
            if (x < sMinX) sMinX = x;
            if (x > sMaxX) sMaxX = x;
          }
        }
      // 진한 중립 잉크 행 — 시리즈 x 범위의 30% 이상을 덮는 행 (파선이라 60% 근처). 축 눈금 글자는 짧다.
      const darkRows = [];
      if (Number.isFinite(sMinX) && sMaxX - sMinX > 40)
        for (let y = minRow; y < off.height; y++) {
          let ink = 0;
          for (let x = sMinX; x <= sMaxX; x++) {
            const i = (y * off.width + x) * 4;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            // 1px 파선은 안티에일리어싱으로 회색 (~120) 이 된다 — 격자 (border ≈ 229) 만 뺀다.
            if (Math.max(r, g, b) < 160 && Math.max(r, g, b) - Math.min(r, g, b) < 30) ink++;
          }
          if (ink >= (sMaxX - sMinX) * 0.25) darkRows.push(y);
        }
      return { cols, darkRows, series: { minY: sMinY, maxY: sMaxY, minX: sMinX, maxX: sMaxX }, width: off.width, height: off.height };
    },
    { base64: png.toString("base64"), minRow: Math.round(48 * dpr) },
  );
}
/** teal 열 묶음 수 (연속 teal 열 run). 선이 있으면 1~2, 점만 있으면 점의 x 수. */
function tealClusters(profile) {
  const { cols, series } = profile;
  if (!Number.isFinite(series.minX)) return 0;
  let clusters = 0, on = false;
  for (let x = series.minX; x <= series.maxX; x++) {
    const v = cols[x] > 0;
    if (v && !on) clusters++;
    on = v;
  }
  return clusters;
}

async function previewState(page) {
  return page.evaluate(() => {
    for (const frame of document.querySelectorAll("iframe")) {
      const doc = frame.contentDocument;
      const chart = doc?.querySelector(".react-aria-Chart");
      if (!chart) continue;
      const texts = [...chart.querySelectorAll("[data-chart-decoration] text")].map((t) => t.textContent);
      const front = chart.querySelector("[data-chart-reference-front]");
      const frontLine = front?.querySelector("line");
      const host = chart.querySelector(".chart-window-track-host");
      return {
        found: true,
        texts,
        front: front
          ? { lines: front.querySelectorAll("line").length, dash: frontLine?.getAttribute("stroke-dasharray") ?? null, stroke: frontLine?.getAttribute("stroke") ?? null, labels: [...front.querySelectorAll("text")].map((t) => t.textContent) }
          : null,
        back: chart.querySelectorAll("[data-chart-grid] line[stroke*='--chart-reference']").length,
        dots: [...chart.querySelectorAll("[data-chart-scatter-series]")].reduce((n, p) => n + (p.getAttribute("d")?.match(/M /g)?.length ?? 0), 0),
        window: host
          ? { start: Number(host.dataset.chartWindowStart), end: Number(host.dataset.chartWindowEnd), n: Number(host.dataset.chartWindowN), thumbs: host.querySelectorAll(".react-aria-SliderThumb").length }
          : null,
        status: chart.querySelector("[data-chart-diagnostics]")?.getAttribute("data-chart-diagnostics") ?? null,
      };
    }
    return { found: false };
  });
}
async function focusPreviewThumb(page, index) {
  return page.evaluate((i) => {
    for (const frame of document.querySelectorAll("iframe")) {
      const doc = frame.contentDocument;
      const inputs = doc?.querySelectorAll(".react-aria-Chart .react-aria-SliderThumb input");
      if (inputs?.[i]) { inputs[i].focus(); return true; }
    }
    return false;
  }, index);
}
async function waitPreview(page, pred, tries = 24) {
  let pv = await previewState(page);
  for (let i = 0; i < tries && !(pv.found && pred(pv)); i++) {
    await page.waitForTimeout(500);
    pv = await previewState(page);
  }
  return pv;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: !headed });
  const storageState = JSON.parse(readFileSync(STORAGE_STATE, "utf8"));
  const { context, page } = await createInstrumentedContext(browser, { storageState, cpuThrottle: 1 });
  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e)));
  const findings = [];
  const record = (name, pass, detail) => {
    findings.push({ name, pass, detail });
    log(`${pass ? "PASS" : "FAIL"} — ${name} :: ${detail}`);
  };
  const setProps = (id, props) =>
    page.evaluate(({ id, props }) => window.__composition_STORE__.getState().updateElementProps(id, props), { id, props });
  const elementProps = (id) =>
    page.evaluate((id) => window.__composition_STORE__.getState().elements.find((e) => e.id === id)?.props ?? null, id);

  try {
    log("project", await createProject(page));
    const rail = page.locator(".panel-toggle-rail button");
    await rail.nth(1).click();
    await page.waitForTimeout(900);
    const chartButton = page.locator('[data-component-type="Chart"], button:has-text("chart"), button:has-text("차트")').first();
    await chartButton.waitFor({ state: "visible", timeout: 20_000 });
    await chartButton.click();
    await page.waitForTimeout(2500);
    const placed = await page.evaluate(() => {
      const chart = window.__composition_STORE__.getState().elements.find((e) => e.type === "Chart");
      return chart ? { id: chart.id } : null;
    });
    if (!placed) throw new Error("Chart 미생성");
    // 새 프로젝트는 템플릿 페이지 ("Components", 요소 50) 가 (0,0) 에, 차트가 놓인 "Home" 페이지가 그 아래
    //   (y 1160) 에 있어 뷰포트 밖이다 — 뷰포트를 차트 페이지 원점으로 옮긴다 (dev 전용 `__composition_APPLY_VIEWPORT__`).
    const moved = await page.evaluate((id) => {
      const st = window.__composition_STORE__.getState();
      const chart = st.elements.find((e) => e.id === id);
      const pos = st.pagePositions?.[chart.page_id] ?? { x: 0, y: 0 };
      window.__composition_APPLY_VIEWPORT__?.({ scale: 1, x: -pos.x + 60, y: -pos.y + 80 });
      return { page: chart.page_id, pos };
    }, placed.id);
    log(`viewport → chart page ${moved.page} at ${JSON.stringify(moved.pos)}`);
    await page.waitForTimeout(2000);
    const n = await rail.count();
    for (let i = 0; i < n; i++)
      if ((await rail.nth(i).getAttribute("aria-pressed")) === "true") {
        await rail.nth(i).click();
        await page.waitForTimeout(400);
      }
    await page.evaluate(() => window.__composition_STORE__.getState().setSelectedElement(null));

    // 1) Skia — bar 기준선 전/후
    await setProps(placed.id, { chartType: "bar", dimension: "category", metric: "value", color: "", showLegend: false, data: BAR_ROWS });
    await page.waitForTimeout(2500);
    const before = await skiaProfile(page);
    await page.screenshot({ path: `${OUT_DIR}/skia-bar-before.png` });
    await setProps(placed.id, { referenceLines: [{ value: 120, label: "Target", lineType: "dashed" }, { value: 30, layer: "back", lineType: "dotted" }] });
    await page.waitForTimeout(2500);
    const after = await skiaProfile(page);
    await page.screenshot({ path: `${OUT_DIR}/skia-bar-reference.png` });
    // 축선 (x 축, 막대 아래) 은 전/후 모두 잡힌다 — 막대 top **위** 의 잉크 행만 기준선 (120 > max 100).
    const aboveBefore = before.darkRows.filter((y) => y < before.series.minY);
    const aboveBars = after.darkRows.filter((y) => y < after.series.minY);
    record(
      "Skia · 기준선 120 (dashed) = 막대 top 위 진한 중립 가로 잉크 행 (전 0 → 후 ≥ 1)",
      aboveBefore.length === 0 && aboveBars.length >= 1,
      `above-bars dark rows before ${aboveBefore.length} → after ${aboveBars.length} (all rows ${before.darkRows.length} → ${after.darkRows.length}) · bars top y ${after.series.minY}`,
    );

    // 2) Skia — 산점도 전환 (chartType 만 바꿔도 x 는 linear 로 읽힌다)
    // `updateElementProps` 는 undefined 로 키를 지우지 않는다 (패널은 patch 필터가 지운다) — 빈 배열 = 미설정과 같은 scene.
    await setProps(placed.id, { chartType: "scatter", dimension: "x", metric: "y", color: "series", referenceLines: [], data: SCATTER_ROWS });
    await page.waitForTimeout(2500);
    const scatter = await skiaProfile(page);
    await page.screenshot({ path: `${OUT_DIR}/skia-scatter.png` });
    // 축선 (플롯 바닥) 은 점 아래다 — 점 범위 안의 진한 가로 잉크 행 (기준선) 만 0 이어야 한다.
    const scatterDarkInside = scatter.darkRows.filter((y) => y <= scatter.series.maxY);
    record(
      "Skia · 산점도 = teal (시리즈 A) 점 묶음 ≥ 3 (선 없음), 점 범위 안 진한 가로 잉크 행 0 (기준선 [] = 없음)",
      tealClusters(scatter) >= 3 && scatterDarkInside.length === 0,
      `teal clusters ${tealClusters(scatter)} · darkRows inside points ${scatterDarkInside.length} (all ${scatter.darkRows.length})`,
    );

    // 3) Skia — 미지원 chartType 안전 경로 (throw 0)
    const errorsBefore = pageErrors.length;
    await setProps(placed.id, { chartType: "hexbin" });
    await page.waitForTimeout(2000);
    const unknown = await skiaProfile(page);
    record(
      "Skia · 미지원 chartType 'hexbin' — pageerror 0 · 시리즈 픽셀 0 (설정 오류 scene, 캔버스 유지)",
      pageErrors.length === errorsBefore && !Number.isFinite(unknown.series.minX),
      `pageErrors +${pageErrors.length - errorsBefore} · teal cols ${unknown.cols.filter((c) => c > 0).length}`,
    );
    await setProps(placed.id, { chartType: "scatter" });
    await page.waitForTimeout(1500);

    // 4) 패널 — 기준선 추가 (canonical write 1)
    await page.evaluate((id) => window.__composition_STORE__.getState().setSelectedElement(id), placed.id);
    await page.waitForTimeout(800);
    const propertiesRail = page.locator('.panel-toggle-rail button:has-text("Properties"), .panel-toggle-rail button[aria-label="Properties"]').first();
    if (await propertiesRail.count()) {
      await propertiesRail.click();
      await page.waitForTimeout(1200);
    }
    const addButton = page.locator("[data-chart-add-reference-line]").first();
    let panelOk = false;
    try {
      await addButton.waitFor({ state: "visible", timeout: 10_000 });
      await addButton.click();
      await page.waitForTimeout(1200);
      const props = await elementProps(placed.id);
      panelOk = Array.isArray(props?.referenceLines) && props.referenceLines.length === 1 && props.referenceLines[0].value === 0;
      record("패널 · '기준선 추가' 클릭 = canonical props.referenceLines [{value:0}] (write 1)", panelOk, JSON.stringify(props?.referenceLines));
    } catch (error) {
      record("패널 · '기준선 추가' 버튼", false, String(error).slice(0, 120));
    }
    await page.evaluate(() => window.__composition_STORE__.getState().setSelectedElement(null));
    if (await propertiesRail.count()) {
      for (let i = 0; i < (await rail.count()); i++)
        if ((await rail.nth(i).getAttribute("aria-pressed")) === "true") {
          await rail.nth(i).click();
          await page.waitForTimeout(300);
        }
    }
    await setProps(placed.id, { referenceLines: [{ value: 22, label: "Target", lineType: "dashed" }, { value: 5, layer: "back", lineType: "dotted" }] });
    await page.waitForTimeout(1500);

    // 5) Preview (Compare Mode) — 산점도 8 점 + 기준선 front/back
    const compare = page.locator('[aria-label="Compare Mode (Preview + Skia)"]').first();
    if (!(await compare.count())) throw new Error("Compare Mode 버튼 없음");
    await compare.click();
    await page.waitForTimeout(4000);
    let pv = await waitPreview(page, (p) => p.dots > 0);
    record(
      "Preview · 산점도 점 8 · front 기준선 1 (dash 6 4, --chart-reference, 라벨 Target) · back 1 · 설정 오류 0",
      pv.found && pv.dots === 8 && pv.front?.lines === 1 && pv.front?.dash === "6 4" && String(pv.front?.stroke).includes("--chart-reference") && pv.front?.labels?.includes("Target") && pv.back === 1 && pv.status === null,
      `dots ${pv.dots} front ${JSON.stringify(pv.front)} back ${pv.back} status ${pv.status} texts ${JSON.stringify(pv.texts.slice(0, 10))}`,
    );
    await page.screenshot({ path: `${OUT_DIR}/preview-scatter-reference.png` });

    // 6) Preview — 미지원 chartType 은 설정 오류 표시 (데이터 보존)
    await setProps(placed.id, { chartType: "hexbin" });
    pv = await waitPreview(page, (p) => p.status !== null);
    record("Preview · 미지원 chartType = 설정 오류 표시 (chartType.unsupported) · pageerror 0", pv.found && String(pv.status).includes("chartType.unsupported") && pageErrors.length === errorsBefore, `status ${pv.status} · pageErrors ${pageErrors.length}`);
    await setProps(placed.id, { chartType: "scatter" });
    await page.waitForTimeout(1500);

    // 7) Preview — 12,000 점 창 (thumb 2 · End 로 넓히면 희소 극값 ≤ 5,000)
    await setProps(placed.id, { budgetOverflow: "window", referenceLines: [], data: SCATTER_12K });
    pv = await waitPreview(page, (p) => !!p.window, 40);
    record(
      "Preview · 12,000 점 창 트랙 thumb 2, 초기 [0, 5000], n 12000 · 점 5,000",
      !!pv.window && pv.window.thumbs === 2 && pv.window.start === 0 && pv.window.end === 5000 && pv.window.n === 12_000 && pv.dots === 5000,
      `${JSON.stringify(pv.window)} dots ${pv.dots}`,
    );
    await focusPreviewThumb(page, 1);
    await page.keyboard.press("End");
    pv = await waitPreview(page, (p) => p.window?.end === 12_000, 40);
    record(
      "Preview · 끝 thumb End = 창 [0, 12000], 희소 극값 재추출로 점 ≤ 5,000 (집계 라벨 '~' 0)",
      pv.window?.end === 12_000 && pv.dots > 0 && pv.dots <= 5000 && !pv.texts.some((t) => t.includes("~")),
      `${JSON.stringify(pv.window)} dots ${pv.dots}`,
    );
    await page.screenshot({ path: `${OUT_DIR}/preview-scatter-window-wide.png` });
    const props = await elementProps(placed.id);
    record(
      "창 상태 canonical write 0 · chartType=scatter 저장 · dimensionScale 미저장 (linear 해석)",
      !!props && !("windowStart" in props) && !("windowEnd" in props) && props.chartType === "scatter" && !("dimensionScale" in props),
      `keys ${Object.keys(props ?? {}).filter((k) => /window|dimension|chartType|reference/i.test(k)).join(",")}`,
    );
  } finally {
    writeFileSync(`${OUT_DIR}/findings.json`, JSON.stringify({ findings, pageErrors }, null, 2));
    const failed = findings.filter((f) => !f.pass);
    log(`${findings.length - failed.length}/${findings.length} PASS${pageErrors.length ? ` · pageErrors ${pageErrors.length}` : ""}`);
    await context.close();
    await browser.close();
    process.exitCode = failed.length ? 1 : 0;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

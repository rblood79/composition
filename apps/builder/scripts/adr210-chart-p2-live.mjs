#!/usr/bin/env node
// adr210-chart-p2-live.mjs — ADR-210 G2 live exercise (실제 Properties → semantic write → history → reload).
//
// test/type-check 가 못 보는 것만 확인한다:
//   1) 실제 빌더에서 Chart 를 놓고 선택하면 Properties 에 ADR-210 컨트롤 (시리즈 원천 · 시리즈
//      설정 · 숫자 형식) 이 **mount** 된다 (`editorExtras` 결선이 live 에서 이어졌는가)
//   2) 실제 컨트롤 조작 (값 컬럼 → 필드 체크 → 적용) 이 canonical 에 dataMode+valueFields 를
//      **한 patch** 로 쓰고, Skia 픽셀이 실제로 바뀐다 (시리즈 2 → 1)
//   3) Undo 한 번에 전부 돌아온다 (history 1건)
//   4) 숫자 형식 Currency+USD 묶음 Apply 가 한 patch 로 저장된다
//   5) 페이지 reload 뒤에도 (DB 왕복) 새 props 가 살아 있다
//
// 사용: node apps/builder/scripts/adr210-chart-p2-live.mjs [--headed]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady, createInstrumentedContext } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = "/private/tmp/adr210-chart-p2-live";
const headed = process.argv.includes("--headed");

function log(...args) {
  console.log("[ADR-210 P2 live]", ...args);
}

async function createProject(page) {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr210-p2-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  return page.url();
}

/** Skia 픽셀 — 페이지 안에서 못 읽으므로 스크린샷을 디코드한다 (adr194 harness 와 같은 방식). */
async function analyzeCanvas(page) {
  const png = await page.locator("canvas").first().screenshot();
  return page.evaluate(
    async ({ base64 }) => {
      const blob = await (await fetch(`data:image/png;base64,${base64}`)).blob();
      const bitmap = await createImageBitmap(blob);
      const off = document.createElement("canvas");
      off.width = bitmap.width;
      off.height = bitmap.height;
      const ctx = off.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);
      const data = ctx.getImageData(0, 0, off.width, off.height).data;
      let blue = 0;
      let purple = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        if (b > 120 && r > 90 && b - g > 60 && r - g > 40) purple++;
        else if (b > 140 && b - g > 70 && b - r > 70) blue++;
      }
      return { blue, purple };
    },
    { base64: png.toString("base64") },
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

async function openPanel(page, label) {
  const toggle = page
    .locator(`.panel-toggle-rail button[aria-label="${label}" i]`)
    .first();
  if (await toggle.count()) {
    const pressed = await toggle.getAttribute("aria-pressed");
    if (pressed === "false") await toggle.click();
    await page.waitForTimeout(600);
  }
}

async function pickOption(page, groupName, optionName) {
  const group = page.getByRole("group", { name: groupName }).first();
  await group.getByRole("button").first().click();
  await page.getByRole("option", { name: optionName }).first().click();
  await page.waitForTimeout(300);
}

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

  try {
    const projectUrl = await createProject(page);
    log("project", projectUrl);

    await openPanel(page, "components");
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
      return chart ? { id: chart.id, props: chart.props } : null;
    });
    if (!placed) throw new Error("Chart 미생성");
    log("chart", placed.id, JSON.stringify(placed.props.data?.[0]));

    // ── 1) 선택 → Properties 에 ADR-210 컨트롤 mount ──────────────────────
    await page.evaluate((id) => {
      window.__composition_STORE__.getState().setSelectedElement(id);
    }, placed.id);
    await openPanel(page, "properties");
    await page.waitForTimeout(1200);
    const sourceGroup = page.getByRole("group", { name: /Series Source|시리즈 원천/ }).first();
    const seriesGroup = page.getByRole("group", { name: /Series Settings|시리즈 설정/ }).first();
    const formatGroup = page.getByRole("group", { name: /Number Format|숫자 형식/ }).first();
    const mounted =
      (await sourceGroup.count()) > 0 &&
      (await seriesGroup.count()) > 0 &&
      (await formatGroup.count()) > 0;
    record(
      "Properties 에 시리즈 원천 · 시리즈 설정 · 숫자 형식 컨트롤이 mount 된다",
      mounted,
      `source=${await sourceGroup.count()} series=${await seriesGroup.count()} format=${await formatGroup.count()}`,
    );
    await page.screenshot({ path: `${OUT_DIR}/panel-group.png` });
    if (!mounted) throw new Error("컨트롤 미mount");

    // ── 2) 값 컬럼 전환 (실제 컨트롤) ───────────────────────────────────────
    const groupInk = await analyzeCanvas(page);
    const versionBefore = await page.evaluate(
      () => window.__composition_STORE__.getState().elements.length,
    );
    await pickOption(page, /Series Source|시리즈 원천/, /Value Columns|값 컬럼/);
    const picker = page.getByRole("group", { name: /Choose value fields|값 필드 선택/ }).first();
    await picker.waitFor({ state: "visible", timeout: 5_000 });
    // factory 샘플 행은 {category, value, series} — 수치 필드는 value 하나.
    // RAC Checkbox 의 실제 input 은 시각 상자 뒤에 있다 — 라벨(legend) 텍스트를 클릭한다.
    await picker.getByText(/^value ·/).first().click();
    const checked = await picker
      .getByRole("checkbox", { name: /^value ·/ })
      .first()
      .isChecked();
    if (!checked) {
      await picker.getByRole("checkbox", { name: /^value ·/ }).first().click({ force: true });
    }
    await picker.getByRole("button", { name: /Apply|적용/ }).first().click();
    await page.waitForTimeout(1500);
    const afterApply = await chartProps(page, placed.id);
    record(
      "값 컬럼 적용이 canonical 에 dataMode=columns + valueFields=[value] 를 쓴다",
      afterApply?.dataMode === "columns" &&
        JSON.stringify(afterApply?.valueFields) === JSON.stringify(["value"]),
      `dataMode=${afterApply?.dataMode} valueFields=${JSON.stringify(afterApply?.valueFields)} metric(보존)=${afterApply?.metric}`,
    );
    const columnsInk = await analyzeCanvas(page);
    record(
      "Skia 픽셀이 바뀐다 (시리즈 2 → 단일 시리즈: 보라 감소)",
      columnsInk.purple < groupInk.purple * 0.5,
      `purple ${groupInk.purple} → ${columnsInk.purple}, blue ${groupInk.blue} → ${columnsInk.blue}`,
    );
    await page.screenshot({ path: `${OUT_DIR}/panel-columns.png` });
    void versionBefore;

    // ── 3) Undo 한 번 ──────────────────────────────────────────────────────
    await page.evaluate(() => window.__composition_STORE__.getState().undo());
    await page.waitForTimeout(1200);
    const afterUndo = await chartProps(page, placed.id);
    record(
      "Undo 한 번에 dataMode/valueFields 가 함께 사라진다 (history 1건)",
      afterUndo?.dataMode === undefined && afterUndo?.valueFields === undefined,
      `dataMode=${afterUndo?.dataMode} valueFields=${JSON.stringify(afterUndo?.valueFields)}`,
    );
    await page.evaluate(() => window.__composition_STORE__.getState().redo());
    await page.waitForTimeout(1200);

    // ── 4) 숫자 형식 Currency + USD 묶음 ─────────────────────────────────────
    await pickOption(page, /Number Format|숫자 형식/, /Currency|통화/);
    await pickOption(page, /Currency Code|통화 코드/, "USD");
    await page.getByRole("button", { name: /Apply|적용/ }).first().click();
    await page.waitForTimeout(1500);
    const afterFormat = await chartProps(page, placed.id);
    record(
      "Currency+USD 묶음 Apply 가 valueFormat/valueCurrency 를 함께 저장한다",
      afterFormat?.valueFormat === "currency" && afterFormat?.valueCurrency === "USD",
      `valueFormat=${afterFormat?.valueFormat} valueCurrency=${afterFormat?.valueCurrency}`,
    );
    await page.screenshot({ path: `${OUT_DIR}/panel-format.png` });

    // ── 5) reload (DB 왕복) ────────────────────────────────────────────────
    await page.waitForTimeout(2500);
    await page.goto(projectUrl, { waitUntil: "networkidle" });
    await waitReady(page);
    await page.waitForTimeout(1500);
    const reloaded = await chartProps(page, placed.id);
    record(
      "reload 뒤 새 props 가 살아 있다 (dataMode/valueFields/valueFormat/valueCurrency)",
      reloaded?.dataMode === "columns" &&
        JSON.stringify(reloaded?.valueFields) === JSON.stringify(["value"]) &&
        reloaded?.valueFormat === "currency" &&
        reloaded?.valueCurrency === "USD",
      JSON.stringify({
        dataMode: reloaded?.dataMode,
        valueFields: reloaded?.valueFields,
        valueFormat: reloaded?.valueFormat,
        valueCurrency: reloaded?.valueCurrency,
      }),
    );
  } catch (error) {
    record("harness", false, String(error?.stack ?? error));
  } finally {
    writeFileSync(
      `${OUT_DIR}/findings.json`,
      JSON.stringify({ at: new Date().toISOString(), findings }, null, 2),
    );
    await context.close();
    await browser.close();
  }
  const failed = findings.filter((f) => !f.pass);
  log(`${findings.length - failed.length}/${findings.length} PASS`);
  process.exit(failed.length === 0 ? 0 : 1);
}

main();

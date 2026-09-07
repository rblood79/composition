#!/usr/bin/env node
// adr194-chart-perf.mjs — ADR-194 G4 프레임 축.
//
// 재는 것: **200행 × 4시리즈 bar 차트가 캔버스에 있을 때와 없을 때** 의 프레임 비용 차이.
// 대조군(차트 없음)을 같은 세션·같은 문서·같은 드라이버로 잰다 — 절대값이 아니라 Δ 가 판정
// 대상이고, headless 는 SwiftShader + rAF 60Hz 고정이라 절대값은 실기와 다르다.
//
// 드라이버는 zoom (가시 집합이 매 프레임 바뀌어 캐시에 **불리한** 쪽) 을 쓴다. 유휴 프레임만
// 재면 어떤 변경이든 통과한다 (measurement-validity §1 Q2).
//
// 사용: node apps/builder/scripts/adr194-chart-perf.mjs [--duration-ms 4000] [--headed]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady, createInstrumentedContext } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = "/private/tmp/adr194-chart-perf";
const headed = process.argv.includes("--headed");
const durationIdx = process.argv.indexOf("--duration-ms");
const DURATION_MS =
  durationIdx >= 0 ? Number(process.argv[durationIdx + 1]) : 4000;

const log = (...a) => console.log("[ADR-194 perf]", ...a);

function rowsFixture() {
  const rows = [];
  const series = ["A", "B", "C", "D"];
  for (let i = 0; i < 50; i++) {
    for (const s of series) {
      rows.push({
        category: `c${i}`,
        value: ((i * 7 + s.charCodeAt(0)) % 40) + 1,
        series: s,
      });
    }
  }
  return rows; // 50 범주 × 4 시리즈 = 200 행
}

async function createProject(page) {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr194-perf-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
}

/** zoom 을 반복하며 rAF 간격 분포를 모은다. */
async function measure(page, durationMs) {
  return page.evaluate(async (duration) => {
    const gaps = [];
    let last = performance.now();
    let stop = false;
    const tick = () => {
      const now = performance.now();
      gaps.push(now - last);
      last = now;
      if (!stop) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);

    const canvas = document.querySelector("canvas");
    const box = canvas.getBoundingClientRect();
    const cx = box.left + box.width / 2;
    const cy = box.top + box.height / 2;
    const start = performance.now();
    let direction = -1;
    while (performance.now() - start < duration) {
      canvas.dispatchEvent(
        new WheelEvent("wheel", {
          bubbles: true,
          cancelable: true,
          clientX: cx,
          clientY: cy,
          deltaY: direction * 60,
          ctrlKey: true,
        }),
      );
      direction = -direction;
      await new Promise((r) => requestAnimationFrame(r));
    }
    stop = true;
    await new Promise((r) => setTimeout(r, 200));

    // 워밍업 앞 30 프레임은 버린다 (첫 기록·셰이더 컴파일).
    const sorted = gaps.slice(30).sort((a, b) => a - b);
    const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))];
    return {
      frames: sorted.length,
      p50: sorted.length ? at(0.5) : null,
      p95: sorted.length ? at(0.95) : null,
      p99: sorted.length ? at(0.99) : null,
      max: sorted.length ? sorted[sorted.length - 1] : null,
    };
  }, durationMs);
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: !headed });
  const storageState = JSON.parse(readFileSync(STORAGE_STATE, "utf8"));
  const { context, page } = await createInstrumentedContext(browser, {
    storageState,
    cpuThrottle: 1,
  });

  try {
    await createProject(page);

    // ── 대조군: 차트 없음 ────────────────────────────────────────────────
    const control = await measure(page, DURATION_MS);
    log("control (차트 없음)", JSON.stringify(control));

    // ── 실험군: 200행 × 4시리즈 bar ─────────────────────────────────────
    const componentsToggle = page
      .locator('.panel-toggle-rail button[aria-label="Components" i]')
      .first();
    if (await componentsToggle.count()) {
      const pressed = await componentsToggle.getAttribute("aria-pressed");
      if (pressed === "false") await componentsToggle.click();
      await page.waitForTimeout(600);
    }
    await page
      .locator('[data-component-type="Chart"], button:has-text("chart")')
      .first()
      .click();
    await page.waitForTimeout(2500);

    const seeded = await page.evaluate((rows) => {
      const store = window.__composition_STORE__;
      const chart = store
        .getState()
        .elements.find((e) => e.type === "Chart");
      if (!chart) return null;
      store.getState().updateElementProps(chart.id, {
        data: rows,
        chartType: "bar",
        color: "series",
        stackType: "dodged",
        showAxis: true,
        showGrid: true,
        showLegend: true,
        style: { width: 800, height: 400 },
      });
      return chart.id;
    }, rowsFixture());
    if (!seeded) throw new Error("Chart 생성 실패");
    await page.waitForTimeout(2500);

    // Components 패널을 닫아 대조군과 같은 화면 구성으로 되돌린다.
    if (await componentsToggle.count()) {
      const pressed = await componentsToggle.getAttribute("aria-pressed");
      if (pressed === "true") await componentsToggle.click();
      await page.waitForTimeout(600);
    }

    const withChart = await measure(page, DURATION_MS);
    log("with chart (200행 × 4시리즈)", JSON.stringify(withChart));

    const deltaP95 = withChart.p95 - control.p95;
    const pass = deltaP95 <= 1;
    log(
      `${pass ? "PASS" : "FAIL"} — frame p95 Δ = ${deltaP95.toFixed(3)} ms (한도 +1ms)`,
    );
    writeFileSync(
      `${OUT_DIR}/result.json`,
      JSON.stringify(
        { durationMs: DURATION_MS, control, withChart, deltaP95, pass },
        null,
        2,
      ),
    );
    process.exitCode = pass ? 0 : 1;
  } catch (error) {
    log("ERROR", error.message);
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

main();

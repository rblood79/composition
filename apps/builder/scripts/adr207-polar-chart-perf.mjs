#!/usr/bin/env node
// adr207-polar-chart-perf.mjs — ADR-207 G4 프레임 축.
//
// 재는 것: 같은 200행 × 4시리즈 문서에서 **bar → radar(circle) → radial(stacked)** 로
// chartType 만 바꿨을 때의 프레임 비용 차이. 대조군은 ADR-194 가 이미 통과시킨 **bar** 다
// (차트 없음이 아니라 — ADR-207 이 지불하는 추가 비용만 재야 한다).
//
// 불리 케이스 (measurement-validity §1 Q2): `gridType="circle"` 이 path 수가 가장 많고
// (동심원 5개 + 스포크 50), radial 은 범주당 트랙+값 호 2겹이라 마크가 100개다.
//
// 드라이버는 zoom (가시 집합이 매 프레임 바뀌어 캐시에 **불리한** 쪽) 을 쓴다. 유휴 프레임만
// 재면 어떤 변경이든 통과한다 (measurement-validity §1 Q2).
//
// 사용: node apps/builder/scripts/adr207-polar-chart-perf.mjs [--duration-ms 4000] [--headed]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady, createInstrumentedContext } from "./perf-baseline.mjs";

const BASE_URL = "http://localhost:5173";
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const OUT_DIR = "/private/tmp/adr207-polar-perf";
const headed = process.argv.includes("--headed");
const durationIdx = process.argv.indexOf("--duration-ms");
const DURATION_MS =
  durationIdx >= 0 ? Number(process.argv[durationIdx + 1]) : 4000;

const log = (...a) => console.log("[ADR-207 perf]", ...a);

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
  await input.fill(`adr207-perf-${Date.now()}`);
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

    const id = await page.evaluate((rows) => {
      const store = window.__composition_STORE__;
      const chart = store.getState().elements.find((e) => e.type === "Chart");
      if (!chart) return null;
      store.getState().updateElementProps(chart.id, {
        data: rows,
        color: "series",
        showAxis: true,
        showGrid: true,
        showLegend: true,
        style: { width: 800, height: 400 },
      });
      return chart.id;
    }, rowsFixture());
    if (!id) throw new Error("Chart 생성 실패");
    await page.waitForTimeout(2500);

    // Components 패널을 닫아 arm 마다 같은 화면 구성을 쓴다.
    if (await componentsToggle.count()) {
      const pressed = await componentsToggle.getAttribute("aria-pressed");
      if (pressed === "true") await componentsToggle.click();
      await page.waitForTimeout(600);
    }

    const arm = async (name, props) => {
      await page.evaluate(
        ({ id, props }) =>
          window.__composition_STORE__
            .getState()
            .updateElementProps(id, props),
        { id, props },
      );
      await page.waitForTimeout(2500);
      const result = await measure(page, DURATION_MS);
      log(name, JSON.stringify(result));
      return result;
    };

    // 워밍업 arm — 첫 arm 만 cold 라서 생기는 순서 편향을 뺀다
    //   (measurement-validity §2 #8 — 측정 조건이 결과를 만든다).
    await arm("warmup (버림)", {
      chartType: "bar",
      stackType: "dodged",
      gridType: "polygon",
    });
    const bar = await arm("bar (ADR-194 대조군)", {
      chartType: "bar",
      stackType: "dodged",
      gridType: "polygon",
    });
    const radar = await arm("radar / circle grid (불리)", {
      chartType: "radar",
      gridType: "circle",
    });
    const radial = await arm("radial / stacked", {
      chartType: "radial",
      stackType: "stacked",
    });

    // 대조군 재측정 — 뒤 arm 이 유리해지는 drift 가 없는지 확인한다.
    const barAgain = await arm("bar (재측정 — drift 점검)", {
      chartType: "bar",
      stackType: "dodged",
    });

    const deltas = {
      radar: radar.p95 - bar.p95,
      radial: radial.p95 - bar.p95,
    };
    const pass = deltas.radar <= 1 && deltas.radial <= 1;
    log(
      `${pass ? "PASS" : "FAIL"} — p95 Δ radar ${deltas.radar.toFixed(3)} ms · ` +
        `radial ${deltas.radial.toFixed(3)} ms (한도 각 +1ms, 대조군 bar) · ` +
        `bar drift ${(barAgain.p95 - bar.p95).toFixed(3)} ms`,
    );
    writeFileSync(
      `${OUT_DIR}/result.json`,
      JSON.stringify(
        { durationMs: DURATION_MS, bar, radar, radial, barAgain, deltas, pass },
        null,
        2,
      ),
    );
    process.exitCode = pass ? 0 : 1;
  } catch (error) {
    log("ERROR", error?.message ?? error);
    process.exitCode = 1;
  } finally {
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }
}

main();

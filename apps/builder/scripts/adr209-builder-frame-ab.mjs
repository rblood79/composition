#!/usr/bin/env node
// adr209-builder-frame-ab.mjs — ADR-209 후속 F3 §8.4 "Builder" 축: before/after 프레임 총비용 A/B.
//
// 재는 것: 같은 기기·같은 화면에서 **두 revision 의 DEV Builder** 를 각각 띄워 (before = 별도 worktree,
// after = 현재 트리) 새 프로젝트에 6종 Chart × 200행×4series 를 싣고 Properties 를 연 채
// select → showGrid 편집 → 불리한 resize(width 토글) → 선택 해제 후 zoom 휠 을 120ms 간격으로
// 18회 warm-up + 54회 측정한다. 판정값은 앱의 `render.frame` inclusive CPU p95 (frame capture
// `__composition_PERF__`) 이고, rAF timestamp gap p95·longtask·alloc 을 같이 적는다.
// before/after 는 쌍마다 순서를 교대한다 (5쌍 기본). 대리 지표(재계산 횟수)가 아니라 총비용을 본다.
//
// 인증: `.auth-session.json` 의 localStorage 를 두 origin 모두에 싣는다 (같은 Supabase 세션).
//
// 사용: node apps/builder/scripts/adr209-builder-frame-ab.mjs --before http://localhost:5174 --after http://localhost:5173 [--pairs 5] [--headed] [--before-dir <worktree>] [--after-dir <worktree>] [--out <dir>]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { chromium } from "playwright";
import {
  waitReady,
  createInstrumentedContext,
  loadStorageState,
  summarizeRecording,
  RECORDER_SCRIPT,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const BEFORE = opt("before", "http://localhost:5174");
const AFTER = opt("after", "http://localhost:5173");
const PAIRS = Number(opt("pairs", "5"));
const headed = args.includes("--headed");
const OUT_DIR = opt("out", "/private/tmp/adr209-f3");
// ADR-210 P4 — 장면 선택 (기본 group200 = ADR-209 와 같은 6종 × 50범주×4시리즈). columns800 은
//   wide 4종 (bar/line/area/radar 순환) × 200행×4필드, group800 은 같은 마크 수의 group 표현.
const SCENE = opt("scene", "group200");
const SCENE_BEFORE = opt("scene-before", SCENE);
const SCENE_AFTER = opt("scene-after", SCENE);
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const WARMUP = 18,
  OPS = 54,
  INTERVAL_MS = 120;
const log = (...a) => console.log("[ADR-209 frame A/B]", ...a);

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
async function setPanel(page, panelId, open) {
  const button = page
    .locator(".panel-toggle-rail button")
    .nth(RAIL_ORDER.indexOf(panelId));
  const pressed = (await button.getAttribute("aria-pressed")) === "true";
  if (pressed !== open) {
    await button.click();
    await page.waitForTimeout(900);
  }
}

function rows200() {
  const rows = [];
  for (let i = 0; i < 50; i++)
    for (const s of ["A", "B", "C", "D"])
      rows.push({
        category: `c${i}`,
        value: ((i * 7 + s.charCodeAt(0)) % 40) + 1,
        series: s,
      });
  return rows;
}
const FIELDS = ["desktop", "mobile", "tablet", "tv"];
function sceneInput(scene) {
  if (scene === "group200")
    return { rows: rows200(), kinds: ["bar", "line", "area", "pie", "radar", "radial"], extra: {} };
  const categories = 200;
  if (scene === "group800" || scene === "group800wide") {
    const rows = [];
    for (let i = 0; i < categories; i++)
      for (const s of ["A", "B", "C", "D"])
        rows.push({ category: `c${i}`, value: ((i * 7 + s.charCodeAt(0)) % 40) + 1, series: s });
    // group800wide = columns800 과 같은 종류 배치 (같은 마크 수의 group 표현 — §7 동등 비교)
    return {
      rows,
      kinds: scene === "group800wide" ? ["bar", "line", "area", "radar", "bar", "line"] : ["bar", "line", "area", "pie", "radar", "radial"],
      extra: {},
    };
  }
  if (scene === "columns800") {
    const rows = Array.from({ length: categories }, (_, i) => ({
      category: `c${i}`,
      ...Object.fromEntries(FIELDS.map((f, s) => [f, ((i * 7 + 65 + s) % 40) + 1])),
    }));
    return {
      rows,
      kinds: ["bar", "line", "area", "radar", "bar", "line"],
      extra: { dataMode: "columns", valueFields: FIELDS },
    };
  }
  throw new Error(`unknown scene ${scene}`);
}

/** storage state 의 origin 을 대상 base URL 로 복제한다 (localStorage 는 origin 별). */
const PROFILE = args.includes("--profile");
/** CDP 프로파일 → 함수별 self time (ms) 상위 40 + 파일별 합계 상위 20. */
function summarizeProfile(profile) {
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const self = new Map();
  const deltas = profile.timeDeltas ?? [];
  for (let i = 0; i < profile.samples.length; i++) {
    const node = byId.get(profile.samples[i]);
    const f = node?.callFrame;
    if (!f) continue;
    const url = (f.url || "").replace(/^.*\/(src|node_modules)\//, "$1/").split("?")[0];
    const key = `${f.functionName || "(anon)"} ${url}:${f.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + (deltas[i] ?? 0) / 1000);
  }
  // wasm(CanvasKit) self time 을 가장 가까운 src/ 조상 함수로 귀속 (누가 그리게 했나).
  const parent = new Map();
  for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const wasmByCaller = new Map();
  for (let i = 0; i < profile.samples.length; i++) {
    let node = byId.get(profile.samples[i]);
    if (!node || !/wasm/.test(node.callFrame.url || "")) continue;
    let cur = node, owner = "(none)";
    while (cur) {
      const f = cur.callFrame;
      if (f?.url && /\/src\//.test(f.url)) { owner = `${f.functionName || "(anon)"} ${f.url.replace(/^.*\/src\//, "src/").split("?")[0]}:${f.lineNumber + 1}`; break; }
      cur = byId.get(parent.get(cur.id));
    }
    wasmByCaller.set(owner, (wasmByCaller.get(owner) ?? 0) + (deltas[i] ?? 0) / 1000);
  }
  const files = new Map();
  for (const [k, v] of self) {
    const file = k.slice(k.indexOf(" ") + 1).replace(/:\d+$/, "");
    files.set(file, (files.get(file) ?? 0) + v);
  }
  const top = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => [k, Number(v.toFixed(1))]);
  return { totalMs: Number(([...self.values()].reduce((a, b) => a + b, 0)).toFixed(1)), functions: top(self, 40), files: top(files, 20), wasmByCaller: top(wasmByCaller, 20) };
}

function storageStateFor(baseUrl) {
  const state = loadStorageState(STORAGE_STATE);
  const origin = new URL(baseUrl).origin;
  const source = state.origins?.[0];
  if (
    source &&
    source.origin !== origin &&
    !state.origins.some((o) => o.origin === origin)
  )
    state.origins.push({
      origin,
      localStorage: source.localStorage.map((e) => ({ ...e })),
    });
  return state;
}

async function runOnce(browser, baseUrl, tag, scene = "group200") {
  const { context, page, errors } = await createInstrumentedContext(browser, {
    storageState: storageStateFor(baseUrl),
    cpuThrottle: 1,
    initScript: RECORDER_SCRIPT,
  });
  try {
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
    const create = page.locator("button.dashboard-create-button").first();
    await create.waitFor({ state: "visible", timeout: 20_000 });
    await create.click();
    const input = page.locator("#new-project-name");
    await input.waitFor({ state: "visible", timeout: 10_000 });
    await input.fill(`adr209-frame-${tag}-${Date.now()}`);
    await input.press("Enter");
    await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
    await waitReady(page);

    await setPanel(page, "components", true);
    const palette = page
      .locator('[data-component-type="Chart"], button:has-text("chart")')
      .first();
    for (let i = 0; i < 6; i++) {
      await palette.click();
      await page.waitForTimeout(700);
    }
    await page.waitForTimeout(1500);
    const sceneData = sceneInput(scene);
    const ids = await page.evaluate(({ rows, kinds, extra }) => {
      const st = window.__composition_STORE__.getState();
      const charts = st.elements
        .filter((e) => e.type === "Chart")
        .map((e) => e.id);
      charts.forEach((id, i) =>
        st.updateElementProps(id, {
          data: rows,
          chartType: kinds[i % kinds.length],
          color: "series",
          ...extra,
          showLegend: true,
          showGrid: true,
          showAxis: true,
          style: { width: 640, height: 300 },
        }),
      );
      return charts;
    }, sceneData);
    if (ids.length !== 6) throw new Error(`Chart 6개 기대, ${ids.length}개`);
    await setPanel(page, "components", false);
    await setPanel(page, "properties", true);
    await page.waitForTimeout(2500);

    const inputHash = execSync(
      // 기본 장면은 ADR-209 manifest 와 같은 payload 를 유지한다 (해시 비교 가능성).
      `printf '%s' '${JSON.stringify(scene === "group200" ? { ids: ids.length, rows: 200, kinds: 6 } : { ids: ids.length, rows: sceneData.rows.length, kinds: sceneData.kinds, scene })}' | shasum -a 256 | cut -c1-16`,
      { encoding: "utf8" },
    ).trim();

    // 드라이버 — 페이지 안에서 120ms 간격으로 op 를 돌린다. warm-up 은 recorder 시작 전.
    const drive = (count) =>
      page.evaluate(
        async ({ ids, count, interval }) => {
          const st = () => window.__composition_STORE__.getState();
          const canvas = document.querySelector(
            '[data-testid="skia-canvas-unified"]',
          );
          const r = canvas.getBoundingClientRect();
          const cx = r.left + r.width / 2,
            cy = r.top + r.height / 2;
          let width = 640;
          for (let i = 0; i < count; i++) {
            const id = ids[Math.floor(i / 4) % ids.length];
            switch (i % 4) {
              case 0:
                st().setSelectedElement(id);
                break;
              case 1: {
                const el = st().elements.find((e) => e.id === id);
                st().updateElementProps(id, { showGrid: !el?.props?.showGrid });
                break;
              }
              case 2:
                width = width === 640 ? 660 : 640;
                st().updateElementProps(id, { style: { width, height: 300 } });
                break;
              case 3:
                st().setSelectedElement(null);
                canvas.dispatchEvent(
                  new WheelEvent("wheel", {
                    clientX: cx,
                    clientY: cy,
                    bubbles: true,
                    cancelable: true,
                    deltaY: i % 8 === 3 ? 30 : -30,
                    ctrlKey: true,
                  }),
                );
                break;
            }
            await new Promise((res) => setTimeout(res, interval));
          }
        },
        { ids, count, interval: INTERVAL_MS },
      );
    await drive(WARMUP);
    const heapBefore = await page.evaluate(
      () => performance.memory?.usedJSHeapSize ?? null,
    );
    // ADR-211 P4 — `--profile`: 측정 구간의 CDP CPU 프로파일 (함수별 self time 상위) 를 같이 남긴다.
    const cdp = PROFILE ? await context.newCDPSession(page) : null;
    if (cdp) {
      await cdp.send("Profiler.enable");
      await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
      await cdp.send("Profiler.start");
    }
    await page.evaluate(() => window.__perfRecorder.start());
    await drive(OPS);
    const rec = await page.evaluate(() => window.__perfRecorder.stop());
    if (cdp) {
      const { profile } = await cdp.send("Profiler.stop");
      rec.profileTop = summarizeProfile(profile);
      await cdp.detach();
    }
    const heapAfter = await page.evaluate(
      () => performance.memory?.usedJSHeapSize ?? null,
    );
    const summary = summarizeRecording(rec);
    const visibility = rec.visibility;
    return {
      baseUrl,
      tag,
      scene,
      projectUrl: page.url(),
      inputHash,
      // 프로파일 실행은 계측 비용이 섞인다 — 판정 집계에서 제외할 표지.
      profiled: PROFILE,
      ...(rec.profileTop ? { profileTop: rec.profileTop } : {}),
      renderFrameP95: summary.renderFrame?.p95 ?? null,
      renderFrameP50: summary.renderFrame?.p50 ?? null,
      renderFrameCount: summary.renderFrame?.count ?? null,
      rafGapP95: summary.rafTimestampGap.p95,
      rafGapP50: summary.rafTimestampGap.p50,
      longTasks: summary.longTasks,
      longTaskMs: summary.longTaskMs,
      allocMBps: summary.allocMBps,
      gcCount: summary.gcCount,
      ms: summary.ms,
      frames: summary.frames,
      heapBefore,
      heapAfter,
      visibility,
      errors: errors.slice(0, 5),
      recordContentP95: summary.recordContent?.p95 ?? null,
      flushContentP95: summary.flushContent?.p95 ?? null,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: !headed });
  const revision = (dir) =>
    execSync(`git -C "${dir}" rev-parse HEAD`, { encoding: "utf8" }).trim();
  const beforeDir = opt("before-dir", "/Users/admin/work/composition-baseline");
  const meta = {
    date: new Date().toISOString(),
    before: { url: BEFORE, sha: revision(beforeDir), scene: SCENE_BEFORE },
    after: { url: AFTER, sha: revision(opt("after-dir", process.cwd())), scene: SCENE_AFTER },
    mode: "DEV",
    cpuThrottle: 1,
    viewport: [1440, 900],
    headed,
    method: `${WARMUP} warmup + ${OPS} ops at ${INTERVAL_MS}ms; op cycle select → showGrid edit → width 640↔660 resize → deselect + ctrl-wheel zoom; 6 Chart (bar/line/area/pie/radar/radial) × 200 rows × 4 series, 640×300, Properties open; order alternates per pair; metric = render.frame inclusive CPU p95 (frame capture)`,
    pairs: [],
  };
  try {
    for (let p = 1; p <= PAIRS; p++) {
      const order = p % 2 === 1 ? ["before", "after"] : ["after", "before"];
      const result = { round: p, order };
      for (const side of order) {
        log(`pair ${p} · ${side}`);
        result[side] = await runOnce(
          browser,
          side === "before" ? BEFORE : AFTER,
          side,
          side === "before" ? SCENE_BEFORE : SCENE_AFTER,
        );
        log(
          `  render.frame p95 ${result[side].renderFrameP95} ms · rAF gap p95 ${result[side].rafGapP95} · longtasks ${result[side].longTasks} · frames ${result[side].renderFrameCount}`,
        );
      }
      result.deltaP95Ms =
        result.after.renderFrameP95 != null &&
        result.before.renderFrameP95 != null
          ? +(
              result.after.renderFrameP95 - result.before.renderFrameP95
            ).toFixed(2)
          : null;
      meta.pairs.push(result);
      writeFileSync(
        `${OUT_DIR}/builder-frame-ab.json`,
        JSON.stringify(meta, null, 2),
      );
    }
    console.log(
      `| 쌍 | before p95 (ms) | after p95 (ms) | Δ (ms) | before rAF gap p95 | after rAF gap p95 | longtasks b/a |`,
    );
    console.log("| --- | ---: | ---: | ---: | ---: | ---: | --- |");
    for (const r of meta.pairs)
      console.log(
        `| ${r.round} | ${r.before.renderFrameP95} | ${r.after.renderFrameP95} | ${r.deltaP95Ms} | ${r.before.rafGapP95} | ${r.after.rafGapP95} | ${r.before.longTasks}/${r.after.longTasks} |`,
      );
    const deltas = meta.pairs.map((r) => r.deltaP95Ms).filter((d) => d != null);
    const worst = Math.max(...deltas);
    const pass = deltas.length === PAIRS && worst <= 1;
    log(
      `${pass ? "PASS" : "FAIL"} — 최악 Δ p95 ${worst} ms (한도 +1ms, ${deltas.length}/${PAIRS} 쌍)`,
    );
    process.exitCode = pass ? 0 : 1;
  } catch (error) {
    log("ERROR", error?.stack ?? error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main();

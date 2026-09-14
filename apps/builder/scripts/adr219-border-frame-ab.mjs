#!/usr/bin/env node
// adr219-border-frame-ab.mjs — ADR-219 G4: 비균일 border 렌더 채널의 before/after 프레임 총비용 A/B.
//
// 재는 것 (breakdown §4 G4 · ADR HC4): 같은 기기·같은 화면에서 두 revision 의 DEV Builder 를 각각 띄워
// 같은 fixture (frame 600 + 비균일 100 — 코너 4값 · 변 폭 4값) 를 싣고 **불리한 동작** 을 같은 스크립트로
// 돌린다 — 비균일 요소를 선택한 채 반경 슬라이더 드래그 60 스텝 · 폭 드래그 60 · 비균일 요소 리사이즈
// 60 (`updateSelectedStylePreview`, 50ms 간격 — path 가 매 프레임 재생성된다). 판정값은 앱의
// `render.frame` inclusive CPU p95 (frame capture `__composition_PERF__`), rAF gap p95·longtask·alloc·
// 힙 Δ 를 같이 적는다. before/after 는 쌍마다 순서를 교대한다. 대리 지표가 아니라 총비용을 본다.
//
// before 는 별도 worktree (P1 커밋 931168eaa — helper 만 있고 렌더 채널 없음) + 원래 의존성, 5174.
// 환경: DPR 2 · 전경 탭 (`--headed` 권장, headless 는 rAF 60Hz + SwiftShader 라 절대값이 부풀고
// 비교치만 유효) · CPU throttle 0.
//
// 사용: node apps/builder/scripts/adr219-border-frame-ab.mjs --before http://localhost:5174 --after http://localhost:5173 [--pairs 3] [--headed] [--before-dir /Users/admin/work/composition-baseline] [--out <dir>]
import { writeFileSync, mkdirSync } from "node:fs";
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
const PAIRS = Number(opt("pairs", "3"));
const headed = args.includes("--headed");
const OUT_DIR = opt("out", "/private/tmp/adr219-g4");
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const UNIFORM = 600,
  NONUNIFORM = 100,
  STEPS = 60,
  WARMUP = 20,
  INTERVAL_MS = 50;
const log = (...a) => console.log("[ADR-219 G4 A/B]", ...a);

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

/** fixture — root frame 1600×1400 + frame 700 (600 균일 · 100 비균일). addComplexElement = canonical 경유. */
async function seed(page) {
  return page.evaluate(
    async ({ UNIFORM, NONUNIFORM }) => {
      const store = window.__composition_STORE__;
      const st = store.getState();
      const pageId = st.currentPageId;
      const body = st.elements.find(
        (e) => e.page_id === pageId && e.type === "body",
      );
      const now = new Date().toISOString();
      const root = {
        id: "adr219-root",
        type: "frame",
        parent_id: body.id,
        page_id: pageId,
        created_at: now,
        updated_at: now,
        props: {
          style: {
            position: "absolute",
            left: "0px",
            top: "0px",
            width: "1600px",
            height: "1400px",
          },
        },
      };
      const children = [];
      const total = UNIFORM + NONUNIFORM;
      for (let i = 0; i < total; i++) {
        const nonUniform = i >= UNIFORM;
        const col = i % 14,
          row = Math.floor(i / 14);
        children.push({
          id: `adr219-${nonUniform ? "nu" : "u"}-${i}`,
          type: "frame",
          parent_id: root.id,
          page_id: pageId,
          order_num: i,
          created_at: now,
          updated_at: now,
          props: {
            style: {
              position: "absolute",
              left: `${8 + col * 112}px`,
              top: `${8 + row * 26}px`,
              width: "100px",
              height: "20px",
              backgroundColor: nonUniform ? "#e8443f" : "#dbe7ff",
              borderStyle: "solid",
              borderColor: "#102A5C",
              ...(nonUniform
                ? {
                    borderTopLeftRadius: 8,
                    borderTopRightRadius: 2,
                    borderBottomRightRadius: 6,
                    borderBottomLeftRadius: 0,
                    borderTopWidth: 1,
                    borderRightWidth: 3,
                    borderBottomWidth: 2,
                    borderLeftWidth: 4,
                  }
                : { borderRadius: 4, borderWidth: 1 }),
            },
          },
        });
      }
      await st.addComplexElement(root, children);
      await new Promise((r) => setTimeout(r, 300));
      return {
        nonUniformIds: children
          .filter((c) => c.id.startsWith("adr219-nu-"))
          .map((c) => c.id),
        count: store.getState().elements.length,
      };
    },
    { UNIFORM, NONUNIFORM },
  );
}

async function runOnce(browser, baseUrl, tag) {
  const { context, page, errors } = await createInstrumentedContext(browser, {
    storageState: storageStateFor(baseUrl),
    cpuThrottle: 1,
    initScript: RECORDER_SCRIPT,
    deviceScaleFactor: 2,
  });
  try {
    await page.goto(`${baseUrl}/dashboard`, { waitUntil: "networkidle" });
    const create = page.locator("button.dashboard-create-button").first();
    await create.waitFor({ state: "visible", timeout: 20_000 });
    await create.click();
    const input = page.locator("#new-project-name");
    await input.waitFor({ state: "visible", timeout: 10_000 });
    await input.fill(`adr219-g4-${tag}-${Date.now()}`);
    await input.press("Enter");
    await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
    await waitReady(page);

    const seeded = await seed(page);
    if (seeded.nonUniformIds.length !== NONUNIFORM)
      throw new Error(`비균일 ${NONUNIFORM} 기대, ${seeded.nonUniformIds.length}`);
    // Styles 패널 열기 (편집 경로와 같은 표면) + 요소가 보이도록 뷰포트
    await page
      .getByRole("button", { name: "Styles", exact: true })
      .first()
      .click()
      .catch(() => {});
    await page.waitForTimeout(800);
    await page.evaluate(() => {
      const st = window.__composition_STORE__.getState();
      const pp = st.pagePositions?.[st.currentPageId] ?? { x: 0, y: 0 };
      window.__composition_APPLY_VIEWPORT__?.({
        scale: 0.6,
        x: -pp.x * 0.6 + 40,
        y: -pp.y * 0.6 + 60,
      });
    });
    await page.waitForTimeout(1500);

    const inputHash = execSync(
      `printf '%s' '${JSON.stringify({ UNIFORM, NONUNIFORM, STEPS, INTERVAL_MS })}' | shasum -a 256 | cut -c1-16`,
      { encoding: "utf8" },
    ).trim();

    // 드라이버 — 비균일 요소 하나를 선택한 채 슬라이더 드래그를 흉내낸다 (updateSelectedStylePreview).
    //   반경 60 · 폭 60 · 리사이즈 60 을 한 사이클로, count 스텝만큼.
    const drive = (count) =>
      page.evaluate(
        async ({ ids, count, interval, STEPS }) => {
          const st = () => window.__composition_STORE__.getState();
          const id = ids[0];
          const el = st().elements.find((e) => e.id === id);
          st().setSelectedElement(id, el?.props, el?.props?.style ?? {}, {});
          for (let i = 0; i < count; i++) {
            const phase = Math.floor(i / STEPS) % 3;
            const step = i % STEPS;
            if (phase === 0)
              st().updateSelectedStylePreview(
                "borderRadius",
                `${2 + (step % 20)}px`,
              );
            else if (phase === 1)
              st().updateSelectedStylePreview(
                "borderWidth",
                `${1 + (step % 6)}px`,
              );
            else
              st().updateSelectedStylePreview(
                "width",
                `${100 + (step % 10) * 6}px`,
              );
            await new Promise((res) => setTimeout(res, interval));
          }
          // 프리뷰 되돌리기 (다음 사이클이 같은 출발점)
          st().updateSelectedStylePreview("width", "100px");
        },
        { ids: seeded.nonUniformIds, count, interval: INTERVAL_MS, STEPS },
      );
    await drive(WARMUP);
    const heapBefore = await page.evaluate(
      () => performance.memory?.usedJSHeapSize ?? null,
    );
    await page.evaluate(() => window.__perfRecorder.start());
    await drive(STEPS * 3);
    const rec = await page.evaluate(() => window.__perfRecorder.stop());
    const heapAfter = await page.evaluate(
      () => performance.memory?.usedJSHeapSize ?? null,
    );
    const summary = summarizeRecording(rec);
    return {
      baseUrl,
      tag,
      projectUrl: page.url(),
      inputHash,
      elements: seeded.count,
      renderFrameP50: summary.renderFrame?.p50 ?? null,
      renderFrameP95: summary.renderFrame?.p95 ?? null,
      renderFrameP99: summary.renderFrame?.p99 ?? null,
      renderFrameCount: summary.renderFrame?.count ?? null,
      rafGapP50: summary.rafTimestampGap.p50,
      rafGapP95: summary.rafTimestampGap.p95,
      longTasks: summary.longTasks,
      longTaskMs: summary.longTaskMs,
      allocMBps: summary.allocMBps,
      gcCount: summary.gcCount,
      ms: summary.ms,
      frames: summary.frames,
      heapBefore,
      heapAfter,
      heapDeltaMB:
        heapBefore != null && heapAfter != null
          ? +((heapAfter - heapBefore) / 1048576).toFixed(1)
          : null,
      visibility: rec.visibility,
      dpr: await page.evaluate(() => window.devicePixelRatio),
      errors: errors.slice(0, 5),
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
    before: { url: BEFORE, sha: revision(beforeDir) },
    after: { url: AFTER, sha: revision(opt("after-dir", process.cwd())) },
    mode: "DEV",
    cpuThrottle: 1,
    headed,
    method: `frame ${UNIFORM} 균일 (radius 4 · width 1) + ${NONUNIFORM} 비균일 (코너 [8,2,6,0] · 변 [1,3,2,4]) in root 1600×1400, zoom 0.6, Styles 열림; 비균일 요소 선택 후 updateSelectedStylePreview ${INTERVAL_MS}ms 간격 — borderRadius ${STEPS} 스텝 → borderWidth ${STEPS} → width ${STEPS} (warm-up ${WARMUP} 스텝은 기록 전); metric = render.frame inclusive CPU p50/p95/p99 (frame capture), rAF gap, longtask, alloc, 힙 Δ; 쌍마다 순서 교대`,
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
        );
        log(
          `  render.frame p50 ${result[side].renderFrameP50} · p95 ${result[side].renderFrameP95} ms · rAF gap p95 ${result[side].rafGapP95} · longtasks ${result[side].longTasks} · frames ${result[side].renderFrameCount} · heap Δ ${result[side].heapDeltaMB} MB · visible ${JSON.stringify(result[side].visibility)}`,
        );
      }
      result.deltaP95Ms =
        result.after.renderFrameP95 != null &&
        result.before.renderFrameP95 != null
          ? +(result.after.renderFrameP95 - result.before.renderFrameP95).toFixed(2)
          : null;
      meta.pairs.push(result);
      writeFileSync(`${OUT_DIR}/border-frame-ab.json`, JSON.stringify(meta, null, 2));
    }
    console.log(
      `| 쌍 | before p50/p95 (ms) | after p50/p95 (ms) | Δ p95 (ms) | rAF gap p95 b/a | longtasks b/a | 힙 Δ b/a (MB) |`,
    );
    console.log("| --- | ---: | ---: | ---: | ---: | --- | --- |");
    for (const r of meta.pairs)
      console.log(
        `| ${r.round} | ${r.before.renderFrameP50}/${r.before.renderFrameP95} | ${r.after.renderFrameP50}/${r.after.renderFrameP95} | ${r.deltaP95Ms} | ${r.before.rafGapP95}/${r.after.rafGapP95} | ${r.before.longTasks}/${r.after.longTasks} | ${r.before.heapDeltaMB}/${r.after.heapDeltaMB} |`,
      );
    const deltas = meta.pairs.map((r) => r.deltaP95Ms).filter((d) => d != null);
    const worst = Math.max(...deltas);
    const pass = deltas.length === PAIRS && worst <= 1;
    log(`${pass ? "PASS" : "FAIL"} — 최악 Δ p95 ${worst} ms (한도 +1ms, ${deltas.length}/${PAIRS} 쌍)`);
    process.exitCode = pass ? 0 : 1;
  } catch (error) {
    log("ERROR", error?.stack ?? error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}
main();

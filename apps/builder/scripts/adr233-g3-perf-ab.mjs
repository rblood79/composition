#!/usr/bin/env node
// adr233-g3-perf-ab.mjs — ADR-233 G3 `scene.build` A/B (같은 세션 · headed · arm 교대).
//
// fixture 쌍 (breakdown §3 Phase 3 · 리뷰 l3):
//   tabs   — Tabs instance 100 × Tab 5. plain arm = 템플릿 origin 없음 (`component-tabs.slot` 이 없는 id
//            → 해소 실패 → 주입 0) · ref arm = 233 모양 (slot 정상 + Tab/Default style 있음 → 행마다 주입).
//   radio  — RadioGroup 100 × Radio 3. plain arm = Radio 자식 plain · ref arm = Radio 자식이
//            `component-radio` instance (233 조합 자식 규칙의 모양).
// 조작 3: static (instance 하나 props) · originEdit (불리 — Tab/Default padding · component-radio padding,
//   ref arm 에서 전 instance 무효화 · 레이아웃이 바뀌는 편집 · instance 가 있는 origin 은 영향 대화상자
//   확인 뒤 커밋 — 1차 시험은 확인을 안 눌러 rebuilt 0/7 였다) · breakpoint (desktop ↔ tablet).
// plain arm 의 originEdit 은 같은 origin 을 편집하지만 plain 노드는 그 origin 을 읽지 않는다 — 표본마다
//   sceneVersion 변화 (= scene 재구성 발생) 를 같이 기록해 "재구성이 일어난 표본" 끼리만 비교한다.
// 조건: warm-up 3 · 표본 7 · Home 페이지만 보이게 (Components 열은 화면 밖) · DPR 1 · visibilityState 기록.
// 지표: `scene.build` 라벨 누적 ms 의 조작별 p95 → pair 간 median. 판정: Δ (ref − plain) ≤ +1 ms.
//
// 사용: node apps/builder/scripts/adr233-g3-perf-ab.mjs [--pairs 3] [--base http://localhost:5173]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const BASE_URL = opt("base", "http://localhost:5173");
const PAIRS = Number(opt("pairs", "3"));
const OUT_DIR = opt("out", "/private/tmp/adr233-g3");
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const WARMUP = 3;
const RUNS = 7;
const N = 100;
const log = (...a) => console.log("[adr233 G3]", ...a);
const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length
    ? Number(s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)].toFixed(2))
    : 0;
};
const median = (xs) => pct(xs, 50);

async function seed(page, fixture, arm) {
  return page.evaluate(
    async ({ fixture, arm, N }) => {
      const store = window.__composition_STORE__;
      const st = store.getState();
      const body = st.elements.find(
        (e) => e.type === "body" && e.page_id === st.currentPageId,
      );
      const now = new Date().toISOString();
      const pageId = st.currentPageId;
      const els = [];
      if (fixture === "tabs") {
        // arm 설정은 instance 가 생기기 전에 (영향 대화상자 없음).
        if (arm === "plain") {
          st.updateElement("component-tabs", {
            slot: ["adr233-none-default", "adr233-none-selected"],
          });
        } else {
          const def = st.elements.find((e) => e.id === "component-tab-item-default");
          st.updateElement("component-tab-item-default", {
            props: {
              ...def.props,
              style: { ...(def.props?.style ?? {}), paddingLeft: 14, paddingRight: 14 },
            },
          });
        }
        for (let i = 0; i < N; i += 1) {
          const c = i % 5;
          const r = Math.floor(i / 5);
          els.push({
            id: `g3-tabs-${i}`,
            customId: `g3-tabs-${i}`,
            type: "ref",
            ref: "component-tabs",
            componentName: "Tabs",
            parent_id: body.id,
            page_id: pageId,
            order_num: i,
            created_at: now,
            updated_at: now,
            props: {
              items: Array.from({ length: 5 }, (_, k) => ({
                id: `k${k}`,
                title: `Tab ${i}-${k}`,
              })),
              defaultSelectedKey: "k1",
              style: {
                position: "absolute",
                left: `${20 + c * 380}px`,
                top: `${20 + r * 60}px`,
                width: "360px",
              },
            },
          });
        }
      } else {
        for (let i = 0; i < N; i += 1) {
          const c = i % 8;
          const r = Math.floor(i / 8);
          const gid = `g3-rg-${i}`;
          els.push({
            id: gid,
            customId: gid,
            type: "RadioGroup",
            parent_id: body.id,
            page_id: pageId,
            order_num: i,
            created_at: now,
            updated_at: now,
            props: {
              label: `Group ${i}`,
              value: "b",
              style: {
                position: "absolute",
                left: `${20 + c * 220}px`,
                top: `${20 + r * 140}px`,
              },
            },
          });
          ["a", "b", "c"].forEach((value, k) => {
            const rid = `${gid}__r${k}`;
            if (arm === "ref") {
              els.push({
                id: rid,
                type: "ref",
                ref: "component-radio",
                componentName: "Radio",
                parent_id: gid,
                page_id: pageId,
                order_num: k,
                created_at: now,
                updated_at: now,
                props: { value },
              });
            } else {
              els.push({
                id: rid,
                type: "Radio",
                parent_id: gid,
                page_id: pageId,
                order_num: k,
                created_at: now,
                updated_at: now,
                props: { value, children: "Radio" },
              });
              els.push({
                id: `${rid}__label`,
                type: "Label",
                parent_id: rid,
                page_id: pageId,
                order_num: 0,
                created_at: now,
                updated_at: now,
                props: { children: `Option ${value}` },
              });
            }
          });
        }
      }
      await st.addComplexElement(els[0], els.slice(1));
      st.setSelectedElement(null);
      return els.length;
    },
    { fixture, arm, N },
  );
}

/** Home 페이지만 화면에 — scale 0.3, Home 원점을 캔버스 (0, 0) 에 (Components 열은 왼쪽 밖). */
async function focusHome(page) {
  await page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    const homeId = st.pages.find((p) => p.id !== "page-components")?.id;
    const pos = st.derivedPagePositions?.[homeId] ?? { x: 0, y: 0 };
    window.__composition_APPLY_VIEWPORT__({
      scale: 0.3,
      x: -pos.x * 0.3,
      y: -pos.y * 0.3,
    });
  });
  await page.waitForTimeout(1200);
}

async function measure(page, fixture, arm, kind, runs) {
  return page.evaluate(
    async ({ fixture, arm, kind, runs }) => {
      const store = window.__composition_STORE__;
      const perf = window.__composition_PERF__;
      const scene = window.__composition_SCENE_DEBUG__;
      perf.setRecordingEnabled(true);
      const bp = [...document.querySelectorAll(".builder-control-group button")].slice(0, 3);
      const apply = (i) => {
        const st = store.getState();
        if (kind === "breakpoint") {
          bp[i % 2 ? 1 : 0]?.click();
          return;
        }
        if (kind === "static") {
          const id = fixture === "tabs" ? "g3-tabs-0" : "g3-rg-0";
          const el = st.elements.find((e) => e.id === id);
          st.updateElementProps(
            id,
            fixture === "tabs"
              ? { defaultSelectedKey: i % 2 ? "k2" : "k1" }
              : { value: i % 2 ? "a" : "b", ...(el ? {} : {}) },
          );
          return;
        }
        // originEdit — 두 arm 같은 편집 (plain arm 은 그 origin 을 읽는 노드가 없다).
        if (fixture === "tabs") {
          const def = st.elements.find((e) => e.id === "component-tab-item-default");
          st.updateElement("component-tab-item-default", {
            props: {
              ...def.props,
              style: { ...(def.props?.style ?? {}), paddingTop: i % 2 ? 6 : 4 },
            },
          });
        } else {
          const radio = st.elements.find((e) => e.id === "component-radio");
          st.updateElement("component-radio", {
            props: {
              ...radio.props,
              style: { ...(radio.props?.style ?? {}), paddingLeft: i % 2 ? 4 : 0 },
            },
          });
        }
      };
      const samples = [];
      for (let i = 0; i < runs; i += 1) {
        const v0 = scene.readSceneVersion();
        const lv0 = store.getState().layoutVersion;
        perf.reset();
        const t0 = performance.now();
        apply(i);
        // instance 가 있는 origin 편집은 영향 대화상자 확인 뒤에 커밋된다 (확인 전엔 편집 0 — 1차 시험의
        //   radio originEdit rebuilt 0/7 원인). 대화상자가 뜨면 마지막 버튼 (적용) 을 누른다.
        if (kind === "originEdit") {
          const until = performance.now() + 1500;
          while (performance.now() < until) {
            const btns = document.querySelectorAll(".editing-impact-actions button");
            if (btns.length > 0) {
              btns[btns.length - 1].click();
              break;
            }
            await new Promise((r) => requestAnimationFrame(r));
          }
        }
        await new Promise((res) => {
          const deadline = performance.now() + 3000;
          const tick = () => {
            if (
              scene.readSceneVersion() !== v0 ||
              store.getState().layoutVersion > lv0 ||
              performance.now() > deadline
            )
              res();
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        await new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        );
        const snap = perf.snapshot("scene.build");
        samples.push({
          sceneBuild: snap?.totalDurationMs ?? 0,
          count: snap?.count ?? 0,
          rebuilt: scene.readSceneVersion() !== v0,
          total: performance.now() - t0,
        });
        await new Promise((r) => setTimeout(r, 80));
      }
      return samples;
    },
    { fixture, arm, kind, runs },
  );
}

async function runArm(browser, fixture, arm) {
  const context = await browser.newContext({
    storageState: STORAGE_STATE,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr233-g3-${fixture}-${arm}-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const seeded = await seed(page, fixture, arm);
  await page.waitForTimeout(2500);
  await focusHome(page);
  const env = await page.evaluate(() => ({
    visibility: document.visibilityState,
    dpr: window.devicePixelRatio,
    pageFrames: window.__composition_SCENE_DEBUG__.readPageFrames().length,
  }));
  const out = { fixture, arm, seeded, env, ops: {} };
  for (const kind of ["static", "originEdit", "breakpoint"]) {
    await measure(page, fixture, arm, kind, WARMUP);
    const samples = await measure(page, fixture, arm, kind, RUNS);
    // breakpoint 는 짝수 번 눌러 desktop 으로 되돌아온다 (RUNS 홀수 → 한 번 더).
    if (kind === "breakpoint") await measure(page, fixture, arm, kind, 1);
    out.ops[kind] = {
      p95: pct(samples.map((s) => s.sceneBuild), 95),
      p50: pct(samples.map((s) => s.sceneBuild), 50),
      rebuilt: samples.filter((s) => s.rebuilt).length,
      samples,
    };
  }
  out.errors = errors;
  await context.close();
  return out;
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: false });
const runs = [];
try {
  for (const fixture of ["tabs", "radio"]) {
    for (let p = 0; p < PAIRS; p += 1) {
      const order = p % 2 === 0 ? ["plain", "ref"] : ["ref", "plain"];
      for (const arm of order) {
        const r = await runArm(browser, fixture, arm);
        runs.push({ pair: p, ...r });
        log(
          fixture,
          `pair ${p}`,
          arm,
          JSON.stringify({
            env: r.env,
            ...Object.fromEntries(
              Object.entries(r.ops).map(([k, v]) => [k, { p95: v.p95, rebuilt: v.rebuilt }]),
            ),
            errors: r.errors.length,
          }),
        );
      }
    }
  }
} finally {
  await browser.close();
}

const summary = {};
for (const fixture of ["tabs", "radio"]) {
  summary[fixture] = {};
  for (const kind of ["static", "originEdit", "breakpoint"]) {
    const arm = (a) =>
      runs.filter((r) => r.fixture === fixture && r.arm === a).map((r) => r.ops[kind]);
    const plain = arm("plain");
    const ref = arm("ref");
    const plainMed = median(plain.map((o) => o.p95));
    const refMed = median(ref.map((o) => o.p95));
    summary[fixture][kind] = {
      plainP95Median: plainMed,
      refP95Median: refMed,
      delta: Number((refMed - plainMed).toFixed(2)),
      plainRebuilt: plain.map((o) => `${o.rebuilt}/${RUNS}`),
      refRebuilt: ref.map((o) => `${o.rebuilt}/${RUNS}`),
      pass: refMed - plainMed <= 1,
    };
  }
}
writeFileSync(
  resolve(OUT_DIR, "g3.json"),
  JSON.stringify({ at: new Date().toISOString(), summary, runs }, null, 2),
);
log("summary", JSON.stringify(summary, null, 2));

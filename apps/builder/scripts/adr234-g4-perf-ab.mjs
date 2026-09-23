#!/usr/bin/env node
// adr234-g4-perf-ab.mjs — ADR-234 G4 `scene.build` A/B (같은 세션 · headed · arm 교대).
//
// fixture (ADR G4 — 합성 = 규모 전용): tabs = Tabs 100 × Tab 5 · taggroup = TagGroup 100 × Tag 5.
// arm — 두 arm 모두 문서의 plain owner (runtime 추가라 hydration 이관을 거치지 않는다):
//   items    = 이관 전 모델 — owner `items` 5 행 · 목록 틀 자식 0 (Canvas projection 가상 행)
//   instance = 234 모델 — 목록 틀 자식 = 항목 origin 의 instance 5 (`props.id` · label descendants)
// 조작 3 (불리): originEdit (항목 origin padding — 전 instance 무효화) · variantEdit (휴지 변형
//   `--unselected` padding) · breakpoint (desktop ↔ tablet). 영향 대화상자가 뜨면 적용을 누른다.
// 조건: warm-up 3 · 표본 7 · Home 페이지만 보이게 · DPR 1 · visibilityState 기록.
// 지표: `scene.build` 누적 ms 의 조작별 p95 → pair 간 median. 판정: Δ (instance − items) ≤ +1 ms.
// Preview hover 재렌더는 사용자 지시 (Preview iframe 미개방) 로 이 하니스에서 재지 않는다.
//
// 사용: node apps/builder/scripts/adr234-g4-perf-ab.mjs [--pairs 3] [--base http://localhost:5173]
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
const OUT_DIR = opt("out", "/private/tmp/adr234-g4");
const STORAGE_STATE = resolve("apps/builder/scripts/.auth-session.json");
const WARMUP = 3;
const RUNS = 7;
const N = 100;
const log = (...a) => console.log("[adr234 G4]", ...a);
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
      const node = (id, type, parent, order, props, extra = {}) =>
        els.push({
          id,
          customId: id,
          type,
          parent_id: parent,
          page_id: pageId,
          order_num: order,
          created_at: now,
          updated_at: now,
          props,
          ...extra,
        });
      const tabs = fixture === "tabs";
      const originId = tabs ? "component-tab-item-default" : "component-tag-item-default";
      for (let i = 0; i < N; i += 1) {
        const c = i % 5;
        const r = Math.floor(i / 5);
        const oid = `g4-${fixture}-${i}`;
        const rows = Array.from({ length: 5 }, (_, k) => ({
          id: `k${k}`,
          title: `${tabs ? "Tab" : "Tag"} ${i}-${k}`,
          label: `${tabs ? "Tab" : "Tag"} ${i}-${k}`,
        }));
        node(oid, tabs ? "Tabs" : "TagGroup", body.id, i, {
          ...(arm === "items" ? { items: rows } : {}),
          ...(tabs ? { defaultSelectedKey: "k1" } : { label: `Group ${i}` }),
          style: {
            position: "absolute",
            left: `${20 + c * 380}px`,
            top: `${20 + r * (tabs ? 90 : 80)}px`,
            width: "360px",
          },
        });
        const listId = `${oid}__list`;
        node(listId, tabs ? "TabList" : "TagList", oid, 0, {});
        if (arm === "instance") {
          rows.forEach((row, k) =>
            node(`${listId}__item-${k}`, "ref", listId, k, { id: row.id }, {
              ref: originId,
              componentName: tabs ? "Tab" : "Tag",
              descendants: tabs
                ? { Label: { children: row.title } }
                : {
                    Label: { children: row.label },
                    Icon: { enabled: false },
                    Avatar: { enabled: false },
                  },
            }),
          );
        }
        if (tabs) {
          const panelsId = `${oid}__panels`;
          node(panelsId, "TabPanels", oid, 1, {});
          rows.forEach((row, k) =>
            node(`${panelsId}__p${k}`, "TabPanel", panelsId, k, { itemId: row.id }),
          );
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
        const tabs = fixture === "tabs";
        const target =
          kind === "originEdit"
            ? tabs
              ? "component-tab-item-default"
              : "component-tag-item-default"
            : tabs
              ? "component-tab-item-default--unselected"
              : "component-tag-item-default--unselected";
        const el = st.elements.find((e) => e.id === target);
        st.updateElement(target, {
          props: {
            ...el.props,
            style: { ...(el.props?.style ?? {}), paddingTop: i % 2 ? 6 : 4 },
          },
        });
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
        if (kind !== "breakpoint") {
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
  await input.fill(`adr234-g4-${fixture}-${arm}-${Date.now()}`);
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
  for (const kind of ["originEdit", "variantEdit", "breakpoint"]) {
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
  for (const fixture of ["tabs", "taggroup"]) {
    for (let p = 0; p < PAIRS; p += 1) {
      const order = p % 2 === 0 ? ["items", "instance"] : ["instance", "items"];
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
for (const fixture of ["tabs", "taggroup"]) {
  summary[fixture] = {};
  for (const kind of ["originEdit", "variantEdit", "breakpoint"]) {
    const arm = (a) =>
      runs.filter((r) => r.fixture === fixture && r.arm === a).map((r) => r.ops[kind]);
    const plain = arm("items");
    const ref = arm("instance");
    const plainMed = median(plain.map((o) => o.p95));
    const refMed = median(ref.map((o) => o.p95));
    summary[fixture][kind] = {
      itemsP95Median: plainMed,
      instanceP95Median: refMed,
      delta: Number((refMed - plainMed).toFixed(2)),
      itemsRebuilt: plain.map((o) => `${o.rebuilt}/${RUNS}`),
      instanceRebuilt: ref.map((o) => `${o.rebuilt}/${RUNS}`),
      pass: refMed - plainMed <= 1,
    };
  }
}
writeFileSync(
  resolve(OUT_DIR, "g4.json"),
  JSON.stringify({ at: new Date().toISOString(), summary, runs }, null, 2),
);
log("summary", JSON.stringify(summary, null, 2));

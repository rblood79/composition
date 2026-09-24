#!/usr/bin/env node
// adr240-g3-perf-ab.mjs — ADR-240 G3 `scene.build` A/B (237 G4 방식 계승: 같은 세션 · headed · arm 교대).
//
// fixture (breakdown §4 Phase 3): Card 50 · Dialog 20 instance — 영역 채움 3 노드씩 (Text 2 + Button ref 1).
//   Card = `descendants.Content.children` · Dialog = `descendants["component-dialog__2/Content"].children` (`defaultOpen` —
//   Canvas 는 열린 Dialog 만 그린다).
// arm — 두 arm 에 **같은 문서** (runtime 추가):
//   base = 240 전 빌드 (`--base-arm`, 61d29f98a 별도 worktree) — Card 채움은 그린다 (진단 (b) 기준선 GREEN) · Dialog 영역 키는
//          그 경로가 없어 무시 (240 전에는 Dialog 에 채울 자리가 없다) → Δ = 240 이 더 그리는 것까지 포함한 총비용 (Q3).
//   r240 = 240 빌드 (`--base`) — Dialog origin 에 Content · Actions frame · 채움 3 노드.
// 조작 4 (불리, Q2): fillEdit (Card 0 채운 Text 글자 — instance descendants 쓰기) · cardOriginEdit (Card origin padding —
//   instance 50 무효화) · dialogOriginEdit (Dialog 본문 origin padding — instance 20 무효화) · breakpoint.
// 조건: warm-up 3 · 표본 7 · Home 만 보이게 · DPR 1 · visibilityState 기록. 판정: p95 median Δ (r240 − base) ≤ +1 ms.
//
// 사용: node apps/builder/scripts/adr240-g3-perf-ab.mjs --base http://localhost:5181 --base-arm http://localhost:5182
//   --auth <두 origin storageState> [--pairs 3]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const R240_URL = opt("base", "http://localhost:5181");
const BASE_ARM_URL = opt("base-arm", "http://localhost:5182");
const PAIRS = Number(opt("pairs", "3"));
const OUT_DIR = opt("out", "/private/tmp/adr240-g3");
const STORAGE_STATE = resolve(
  opt("auth", "apps/builder/scripts/.auth-session.json"),
);
const WARMUP = 3;
const RUNS = 7;
const CARDS = 50;
const DIALOGS = 20;
/** `--dialog-fill 0` — 분해 측정: Dialog 채움 없이 (240 구조 비용 · 채움 내용 비용 분리). */
const DIALOG_FILL = opt("dialog-fill", "1") !== "0";
const OPS = opt(
  "ops",
  "fillEdit,cardOriginEdit,dialogOriginEdit,breakpoint",
).split(",");
const DIALOG_KEY = "component-dialog__2/Content";
const log = (...a) => console.log("[adr240 G3]", ...a);
const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length
    ? Number(
        s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)].toFixed(
          2,
        ),
      )
    : 0;
};
const median = (xs) => pct(xs, 50);

async function seed(page) {
  return page.evaluate(
    async ({ CARDS, DIALOGS, DIALOG_KEY, DIALOG_FILL }) => {
      const st = window.__composition_STORE__.getState();
      const all = [...st.elementsMap.values()];
      const body = all.find(
        (e) => e.type === "body" && e.page_id === st.currentPageId,
      );
      const now = new Date().toISOString();
      const pageId = st.currentPageId;
      const fill = (tag) => [
        { id: "text", type: "Text", props: { children: `${tag} a` } },
        { id: "text-2", type: "Text", props: { children: `${tag} b` } },
        {
          id: "component-button",
          type: "ref",
          ref: "component-button",
          props: { children: `${tag} go` },
        },
      ];
      const inst = (id, ref, order, style, props, descendants) => ({
        id,
        customId: id,
        type: "ref",
        ref,
        parent_id: body.id,
        page_id: pageId,
        order_num: order,
        created_at: now,
        updated_at: now,
        props: { ...props, style },
        descendants,
      });
      const at = (left, top, width) => ({
        position: "absolute",
        left: `${left}px`,
        top: `${top}px`,
        width: `${width}px`,
      });
      const els = [];
      for (let i = 0; i < CARDS; i += 1) {
        els.push(
          inst(
            `g3-card-${i}`,
            "component-card",
            i,
            at(20 + (i % 5) * 320, 20 + Math.floor(i / 5) * 300, 300),
            {},
            { Content: { children: fill(`Card ${i}`) } },
          ),
        );
      }
      for (let i = 0; i < DIALOGS; i += 1) {
        els.push(
          inst(
            `g3-dialog-${i}`,
            "component-dialog",
            CARDS + i,
            at(1700 + (i % 4) * 440, 20 + Math.floor(i / 4) * 360, 400),
            { defaultOpen: true },
            DIALOG_FILL
              ? { [DIALOG_KEY]: { children: fill(`Dialog ${i}`) } }
              : {},
          ),
        );
      }
      const perf = window.__composition_PERF__;
      perf.setRecordingEnabled(true);
      perf.reset();
      // 컨테이너 없이 형제로 — 첫 요소 + 나머지를 같은 부모 (body) 에 (addComplexElement 는 parent_id 를 존중한다).
      await st.addComplexElement(els[0], els.slice(1));
      st.setSelectedElement(null);
      return els.length;
    },
    { CARDS, DIALOGS, DIALOG_KEY, DIALOG_FILL },
  );
}

/** Home 페이지만 화면에 — scale 0.25, Home 원점을 캔버스 (0, 0) 에. */
async function focusHome(page) {
  await page.evaluate(() => {
    const st = window.__composition_STORE__.getState();
    const homeId = st.pages.find((p) => p.id !== "page-components")?.id;
    if (homeId && st.currentPageId !== homeId) st.setCurrentPageId(homeId);
    const pos = st.derivedPagePositions?.[homeId] ?? { x: 0, y: 0 };
    window.__composition_APPLY_VIEWPORT__({
      scale: 0.25,
      x: -pos.x * 0.25,
      y: -pos.y * 0.25,
    });
  });
  await page.waitForTimeout(1500);
}

async function measure(page, kind, runs) {
  return page.evaluate(
    async ({ kind, runs, DIALOG_KEY }) => {
      const store = window.__composition_STORE__;
      const perf = window.__composition_PERF__;
      const scene = window.__composition_SCENE_DEBUG__;
      perf.setRecordingEnabled(true);
      const bp = [
        ...document.querySelectorAll(".builder-control-group button"),
      ].slice(0, 3);
      const pad = (id, i) => {
        const st = store.getState();
        const el = st.elementsMap.get(id);
        st.updateElement(id, {
          props: {
            ...el.props,
            style: { ...(el.props?.style ?? {}), paddingTop: i % 2 ? 6 : 4 },
          },
        });
      };
      const apply = (i) => {
        const st = store.getState();
        if (kind === "breakpoint") {
          bp[i % 2 ? 1 : 0]?.click();
          return;
        }
        if (kind === "cardOriginEdit") return pad("component-card", i);
        if (kind === "dialogOriginEdit") return pad("component-dialog__2", i);
        // fillEdit — Card 0 Content 채움 첫 Text 글자 (instance descendants 쓰기, Phase 2 편집 경로의 결과 모양).
        const el = st.elementsMap.get("g3-card-0");
        const content = el.descendants.Content;
        const children = content.children.map((c, k) =>
          k === 0 ? { ...c, props: { ...c.props, children: `edit ${i}` } } : c,
        );
        st.updateElement("g3-card-0", {
          descendants: { ...el.descendants, Content: { ...content, children } },
        });
        void DIALOG_KEY;
      };
      const samples = [];
      for (let i = 0; i < runs; i += 1) {
        const v0 = scene.readSceneVersion();
        const lv0 = store.getState().layoutVersion;
        perf.reset();
        const t0 = performance.now();
        apply(i);
        // instance 가 있는 origin 편집은 영향 대화상자 확인 뒤에 커밋된다 — 뜨면 마지막 버튼 (적용).
        if (kind.endsWith("OriginEdit")) {
          const until = performance.now() + 1500;
          while (performance.now() < until) {
            const btns = document.querySelectorAll(
              ".editing-impact-actions button",
            );
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
    { kind, runs, DIALOG_KEY },
  );
}

/** 채움이 실제로 그려졌는지 — layout map 의 채움 노드 수 (Card · Dialog). */
const fillProbe = (page) =>
  page.evaluate(() => {
    const keys = [
      ...window.__composition_LAYOUT_DEBUG__.getSharedLayoutMap().keys(),
    ];
    return {
      cardFill: keys.filter((k) => /^g3-card-\d+\/Content\/text$/.test(k))
        .length,
      dialogFill: keys.filter((k) =>
        /^g3-dialog-\d+\/component-dialog__2\/Content\/text$/.test(k),
      ).length,
      dialogBody: keys.filter((k) =>
        /^g3-dialog-\d+\/component-dialog__2$/.test(k),
      ).length,
      nodes: keys.filter((k) => k.startsWith("g3-")).length,
    };
  });

async function runArm(browser, arm) {
  const context = await browser.newContext({
    storageState: STORAGE_STATE,
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 300)));
  const base = arm === "base" ? BASE_ARM_URL : R240_URL;
  await page.goto(`${base}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr240-g3-${arm}-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  await focusHome(page);
  const seeded = await seed(page);
  await page.waitForTimeout(3000);
  const seedBuild = await page.evaluate(
    () => window.__composition_PERF__.snapshot("scene.build")?.maxDurationMs,
  );
  await focusHome(page);
  const env = await page.evaluate(() => ({
    visibility: document.visibilityState,
    dpr: window.devicePixelRatio,
  }));
  const probe = await fillProbe(page);
  const out = { arm, base, seeded, env, probe, seedBuild, ops: {} };
  for (const kind of OPS) {
    await measure(page, kind, WARMUP);
    const samples = await measure(page, kind, RUNS);
    // breakpoint 는 짝수 번 눌러 desktop 으로 되돌아온다 (RUNS 홀수 → 한 번 더).
    if (kind === "breakpoint") await measure(page, kind, 1);
    out.ops[kind] = {
      p95: pct(
        samples.map((s) => s.sceneBuild),
        95,
      ),
      p50: pct(
        samples.map((s) => s.sceneBuild),
        50,
      ),
      totalP95: pct(
        samples.map((s) => s.total),
        95,
      ),
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
  for (let p = 0; p < PAIRS; p += 1) {
    const order = p % 2 === 0 ? ["base", "r240"] : ["r240", "base"];
    for (const arm of order) {
      const r = await runArm(browser, arm);
      runs.push({ pair: p, ...r });
      log(
        `pair ${p}`,
        arm,
        JSON.stringify({
          env: r.env,
          probe: r.probe,
          seedBuild: r.seedBuild,
          ...Object.fromEntries(
            Object.entries(r.ops).map(([k, v]) => [
              k,
              { p95: v.p95, total: v.totalP95, rebuilt: v.rebuilt },
            ]),
          ),
          errors: r.errors.length,
        }),
      );
    }
  }
} finally {
  await browser.close();
}

const summary = {};
for (const kind of OPS) {
  const arm = (a) => runs.filter((r) => r.arm === a).map((r) => r.ops[kind]);
  const b = arm("base");
  const r = arm("r240");
  const bMed = median(b.map((o) => o.p95));
  const rMed = median(r.map((o) => o.p95));
  summary[kind] = {
    baseP95Median: bMed,
    r240P95Median: rMed,
    delta: Number((rMed - bMed).toFixed(2)),
    totalDelta: Number(
      (
        median(r.map((o) => o.totalP95)) - median(b.map((o) => o.totalP95))
      ).toFixed(2),
    ),
    baseRebuilt: b.map((o) => `${o.rebuilt}/${RUNS}`),
    r240Rebuilt: r.map((o) => `${o.rebuilt}/${RUNS}`),
    pass: rMed - bMed <= 1,
  };
}
writeFileSync(
  resolve(OUT_DIR, "g3.json"),
  JSON.stringify(
    {
      at: new Date().toISOString(),
      dialogFill: DIALOG_FILL,
      r240: R240_URL,
      baseArm: BASE_ARM_URL,
      summary,
      runs,
    },
    null,
    2,
  ),
);
log("summary", JSON.stringify(summary, null, 2));

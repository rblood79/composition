#!/usr/bin/env node
// adr224-size-perf-ab.mjs — ADR-224 G6: Fill marker (sizing) 도입 전후의 layout+commit 비용 A/B.
//   같은 fixture (Row 900px · Fill 자식 N=100 / 1,000) 를 두 빌드에서 각각 만들고
//   ① 부모 resize (Row width 를 ±10px 씩 흔든다 — updateElementProps)
//   ② 가중치 편집 (after: `updateElement(sizing.width.factor)` · before: `updateElementProps(flexGrow)` — 같은 사용자 동작의 각 빌드 경로)
//   를 워밍업 5 + 30회 실행해 commit (동기 store 호출) + layout (공유 layout map 갱신까지) 지연의 p50/p95 를 잰다.
//   before = ADR-224 이전 commit (e8987c394) 의 별도 worktree dev 서버, after = HEAD — 같은 머신·viewport·zoom·DPR·headless 조건.
//   Gate (breakdown §G6): after.p95 ≤ before.p95 + max(before.p95 × 10%, 1ms), 신규 강제 DOM 측정 0 (코드 검토).
// 사용: node apps/builder/scripts/adr224-size-perf-ab.mjs --arm before --base http://localhost:5174 [--out DIR]
//       node apps/builder/scripts/adr224-size-perf-ab.mjs --arm after  --base http://localhost:5173 [--out DIR]
//       node apps/builder/scripts/adr224-size-perf-ab.mjs --verdict DIR   (두 arm 의 report 를 비교)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import {
  waitReady,
  createInstrumentedContext,
  loadStorageState,
} from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const OUT_DIR = opt("out", "/private/tmp/adr224-g6");
const ARM = opt("arm", "after");
const BASE_URL = opt("base", "http://localhost:5173");
const SIZES = [100, 1000];
const WARMUP = 5;
const RUNS = 30;
const log = (...a) => console.log(`[ADR-224 G6 ${ARM}]`, ...a);

const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  if (!s.length) return null;
  return +s[Math.min(s.length - 1, Math.floor((s.length * p) / 100))].toFixed(3);
};

if (args.includes("--verdict")) {
  const dir = opt("verdict", OUT_DIR);
  const before = JSON.parse(readFileSync(resolve(dir, "before.json"), "utf8"));
  const after = JSON.parse(readFileSync(resolve(dir, "after.json"), "utf8"));
  const rows = [];
  let pass = true;
  for (const key of Object.keys(after.metrics)) {
    const b = before.metrics[key];
    const a = after.metrics[key];
    if (!b || !a) continue;
    const allowance = Math.max(b.totalP95 * 0.1, 1);
    const ok = a.totalP95 <= b.totalP95 + allowance;
    pass &&= ok;
    rows.push({ key, before: b, after: a, allowance: +allowance.toFixed(3), delta: +(a.totalP95 - b.totalP95).toFixed(3), pass: ok });
  }
  const verdict = { pass, rows, conditions: { before: before.conditions, after: after.conditions } };
  writeFileSync(resolve(dir, "verdict.json"), JSON.stringify(verdict, null, 2));
  for (const r of rows)
    console.log(`${r.pass ? "PASS" : "FAIL"} ${r.key}: before p95 ${r.before.totalP95} (commit ${r.before.commitP95} · layout ${r.before.layoutP95}) → after p95 ${r.after.totalP95} (commit ${r.after.commitP95} · layout ${r.after.layoutP95}) Δ ${r.delta} (허용 +${r.allowance})`);
  console.log("VERDICT", pass ? "PASS" : "FAIL");
  process.exit(pass ? 0 : 1);
}

async function seed(page, count, arm) {
  return page.evaluate(
    async ({ count, arm }) => {
      const store = window.__composition_STORE__;
      const st = store.getState();
      const pageId = st.currentPageId;
      const body = st.elements.find((e) => e.page_id === pageId && e.type === "body");
      const now = new Date().toISOString();
      const rootId = `adr224-row-${count}`;
      const root = {
        id: rootId,
        type: "frame",
        parent_id: body.id,
        page_id: pageId,
        created_at: now,
        updated_at: now,
        props: { style: { display: "flex", flexDirection: "row", width: "900px", height: "40px" } },
      };
      const children = [];
      for (let i = 0; i < count; i++) {
        const factor = (i % 3) + 1;
        children.push({
          id: `adr224-child-${count}-${i}`,
          type: "frame",
          parent_id: rootId,
          page_id: pageId,
          order_num: i,
          created_at: now,
          updated_at: now,
          ...(arm === "after" ? { sizing: { width: { factor } } } : {}),
          props: {
            style: {
              height: "12px",
              backgroundColor: i % 2 ? "#dbe7ff" : "#e8443f",
              ...(arm === "after" ? {} : { flexGrow: factor, flexShrink: 1, flexBasis: "0px", minWidth: "0px" }),
            },
          },
        });
      }
      await st.addComplexElement(root, children);
      await new Promise((r) => setTimeout(r, 800));
      return { rootId, childId: `adr224-child-${count}-0`, count: store.getState().elements.length };
    },
    { count, arm },
  );
}

/** 한 번의 편집: commit = 동기 호출 시간, layout = 공유 layout map 이 새 폭을 반영할 때까지 (rAF 폴링) */
async function measureOp(page, op, runs) {
  return page.evaluate(
    async ({ op, runs }) => {
      const store = window.__composition_STORE__;
      const dbg = window.__composition_LAYOUT_DEBUG__;
      const readWidth = (id) => dbg.getSharedLayoutMap()?.get(id)?.width ?? null;
      const samples = [];
      for (let i = 0; i < runs; i++) {
        const st = store.getState();
        const version0 = st.layoutVersion;
        const t0 = performance.now();
        if (op.kind === "parentResize") {
          const el = st.elements.find((e) => e.id === op.rootId);
          const next = 900 + (i % 2 ? 10 : -10) * ((i % 5) + 1);
          st.updateElementProps(op.rootId, { style: { ...el.props.style, width: `${next}px` } });
        } else if (op.kind === "factorEditAfter") {
          // 실제 패널 경로 (Size 상자 가중치 입력 → applySizingFromSelection → updateAndSave)
          st.applySizingFromSelection(
            { selectedElementId: op.childId, currentPageId: st.currentPageId },
            { axis: "width", mode: "fill", factor: (i % 4) + 1 },
          );
        } else {
          // ADR-224 이전 패널 경로 (flexGrow 를 style 로 — updateSelectedStyle)
          st.updateSelectedStyle("flexGrow", String((i % 4) + 1));
        }
        const t1 = performance.now();
        // layout: layoutVersion 증가 뒤 공유 layout map 이 새 결과를 실을 때까지
        const before = readWidth(op.childId);
        await new Promise((resolve) => {
          const deadline = performance.now() + 4000;
          const tick = () => {
            const st2 = store.getState();
            const w = readWidth(op.childId);
            if ((st2.layoutVersion > version0 && w !== before) || performance.now() > deadline) resolve();
            else requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        const t2 = performance.now();
        samples.push({ commit: t1 - t0, layout: t2 - t1, total: t2 - t0 });
        await new Promise((r) => setTimeout(r, 40));
      }
      return samples;
    },
    { op, runs },
  );
}

mkdirSync(OUT_DIR, { recursive: true });
const browser = await chromium.launch({ headless: true });
// 라이선스 세션은 origin 별 localStorage 다 — 5173 에서 만든 storageState 를 base origin 에도 복제 (before worktree 서버)
const storageState = loadStorageState(resolve("apps/builder/scripts/.auth-session.json"));
const baseOrigin = new URL(BASE_URL).origin;
if (storageState.origins && !storageState.origins.some((o) => o.origin === baseOrigin)) {
  const source = storageState.origins.find((o) => o.origin.includes("localhost"));
  if (source) storageState.origins.push({ ...source, origin: baseOrigin });
}
const { context, page, errors } = await createInstrumentedContext(browser, {
  storageState,
  cpuThrottle: 1,
  deviceScaleFactor: 2,
});
const metrics = {};
try {
  await page.goto(`${BASE_URL}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr224-g6-${ARM}-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  await page.waitForTimeout(1500);
  for (const count of SIZES) {
    const { rootId, childId } = await seed(page, count, ARM);
    log(`seeded N=${count}`);
    const ops = [
      { name: `parentResize.N${count}`, select: rootId, op: { kind: "parentResize", rootId, childId } },
      { name: `factorEdit.N${count}`, select: childId, op: { kind: ARM === "after" ? "factorEditAfter" : "factorEditBefore", rootId, childId } },
      // (HEAD 에서 flexGrow style 편집을 대조군으로 두지 않는다 — marker 자식은 projection 이 flexGrow 를
      //  덮어 layout 이 안 바뀌고 폴링이 deadline 까지 기다린다: 설계된 dead 채널이지 비용이 아니다)
    ];
    for (const { name, select, op } of ops) {
      await page.evaluate((id) => window.__composition_STORE__.getState().setSelectedElement(id), select);
      await page.waitForTimeout(600);
      await measureOp(page, op, WARMUP);
      const samples = await measureOp(page, op, RUNS);
      const m = {
        commitP50: pct(samples.map((s) => s.commit), 50),
        commitP95: pct(samples.map((s) => s.commit), 95),
        layoutP50: pct(samples.map((s) => s.layout), 50),
        layoutP95: pct(samples.map((s) => s.layout), 95),
        totalP50: pct(samples.map((s) => s.total), 50),
        totalP95: pct(samples.map((s) => s.total), 95),
        runs: samples.length,
      };
      metrics[name] = m;
      log(`${name}: total p50 ${m.totalP50} p95 ${m.totalP95} (commit p95 ${m.commitP95} · layout p95 ${m.layoutP95})`);
    }
    // 다음 크기 전에 이 fixture 를 지워 문서 크기를 같게 유지
    await page.evaluate((id) => {
      const st = window.__composition_STORE__.getState();
      st.setSelectedElements([id]);
      return st.deleteSelectedElements?.() ?? st.removeElement?.(id);
    }, rootId).catch(() => {});
    await page.waitForTimeout(800);
  }
} finally {
  const conditions = await page
    .evaluate(() => ({
      visibility: document.visibilityState,
      dpr: devicePixelRatio,
      viewport: [innerWidth, innerHeight],
      zoom: window.__composition_STORE__?.getState().zoom,
      ua: navigator.userAgent,
    }))
    .catch(() => null);
  const report = { arm: ARM, base: BASE_URL, conditions: { ...conditions, warmup: WARMUP, runs: RUNS, sizes: SIZES, headless: true, cpuThrottle: 1 }, metrics, errors: errors.slice(0, 5) };
  writeFileSync(resolve(OUT_DIR, `${ARM}.json`), JSON.stringify(report, null, 2));
  log("report", resolve(OUT_DIR, `${ARM}.json`));
  await context.close();
  await browser.close();
}

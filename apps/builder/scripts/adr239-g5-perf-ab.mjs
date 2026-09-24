#!/usr/bin/env node
// adr239-g5-perf-ab.mjs — ADR-239 G5 `scene.build` A/B (238 G4 방식 계승: 같은 세션 · headed · arm 교대).
//
// fixture (사람이 만든 모양 — 두 arm 모두 239 전 모양 (plain TreeItem · 정적 `items`) 으로 넣고 reload 해 그 빌드의
//   hydration 이 만든 production 모양을 잰다):
//   tree = Tree 20 × 항목 30 (최상위 10 × 자식 1 × 손자 1 — 3 단계) · `expandedKeys: []` (factory 기본값).
//          239 전: plain TreeItem (Canvas 는 자식 행을 부모 행에 겹쳐 그림) · 239: TreeItem origin ref + 펼침 채움 (전부 펼침,
//          행을 쌓아 그림).
//   menu = Menu 20 × 행 10 (행 3 개가 하위 메뉴 2 단계). 239 전: `children` 행이 있어 `items` 그대로 · 239: 중첩 MenuItem instance.
// arm — base = 239 전 빌드 (`--base-url`, a2d1fe649 worktree) · adr239 = 239 빌드.
// 조작 4 (불리, Q2): ownerEdit (fixture owner 0 padding) · originEdit (239: TreeItem origin padding — 전 항목 무효화 ·
//   base: 같은 자리 origin 이 없어 Tree origin `component-tree` padding) · expand (tree 0 `expandedKeys` [] ↔ 부모 전부 —
//   base 는 이 키가 layout 무효화 목록 밖) · breakpoint.
// 조건: warm-up 3 · 표본 7 · Home 만 보이게 · DPR 1 · visibilityState 기록. 판정: p95 median Δ (adr239 − base) ≤ +1 ms.
// 총비용 (Q3): 조작 → scene 갱신 → 2 rAF 까지 `total` 도 같은 표본으로 기록.
//
// 사용: node apps/builder/scripts/adr239-g5-perf-ab.mjs --base-url http://localhost:5182 --url http://localhost:5181
//   [--pairs 3] [--fixture tree|menu]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const BASE_URL = opt("url", "http://localhost:5181");
const ITEMS_BASE_URL = opt("base-url", "http://localhost:5182");
const ONLY_FIXTURE = opt("fixture", null);
/** `--profile originEdit` — 그 조작 표본 구간의 CPU 프로파일 자체 시간 상위 (진단용, 판정과 무관). */
const PROFILE_KIND = opt("profile", null);
const ONLY_ARM = opt("arm", null);
const PAIRS = Number(opt("pairs", "3"));
const OUT_DIR = opt("out", "/private/tmp/adr239-g5");
const STORAGE_STATE = resolve(
  opt("auth", "apps/builder/scripts/.auth-session.json"),
);
const WARMUP = 3;
const RUNS = 7;
const FIXTURES = ["tree", "menu"].filter(
  (f) => !ONLY_FIXTURE || f === ONLY_FIXTURE,
);
const KINDS = ["ownerEdit", "originEdit", "expand", "breakpoint"];
const log = (...a) => console.log("[adr239 G5]", ...a);
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

async function seed(page, fixture) {
  return page.evaluate(
    async ({ fixture }) => {
      const st = window.__composition_STORE__.getState();
      const body = st.elements.find(
        (e) => e.type === "body" && e.page_id === st.currentPageId,
      );
      const now = new Date().toISOString();
      const pageId = st.currentPageId;
      const els = [];
      const node = (id, type, parent, order, props) =>
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
        });
      const place = (i, cols, w, h) => ({
        position: "absolute",
        left: `${20 + (i % cols) * (w + 20)}px`,
        top: `${20 + Math.floor(i / cols) * (h + 20)}px`,
        width: `${w}px`,
      });
      if (fixture === "tree") {
        for (let i = 0; i < 20; i += 1) {
          const tid = `g5-tree-${i}`;
          node(tid, "Tree", body.id, i, {
            "aria-label": `Tree ${i}`,
            selectionMode: "single",
            expandedKeys: [],
            style: place(i, 5, 300, 1000),
          });
          for (let k = 0; k < 10; k += 1) {
            const a = `${tid}-a${k}`;
            node(a, "TreeItem", tid, k, { children: `Item ${i}.${k}` });
            const b = `${a}-b`;
            node(b, "TreeItem", a, 0, { children: `Item ${i}.${k}.1` });
            node(`${b}-c`, "TreeItem", b, 0, {
              children: `Item ${i}.${k}.1.1`,
            });
          }
        }
      } else {
        const rows = (i) =>
          Array.from({ length: 10 }, (_, k) =>
            k % 3 === 0
              ? {
                  id: `k${k}`,
                  label: `Item ${i}-${k}`,
                  children: [
                    {
                      id: `k${k}-s`,
                      label: `Sub ${i}-${k}`,
                      children: [{ id: `k${k}-ss`, label: `Leaf ${i}-${k}` }],
                    },
                    { id: `k${k}-t`, label: `Sub2 ${i}-${k}` },
                  ],
                }
              : { id: `k${k}`, label: `Item ${i}-${k}` },
          );
        for (let i = 0; i < 20; i += 1) {
          node(`g5-menu-${i}`, "Menu", body.id, i, {
            label: `Menu ${i}`,
            items: rows(i),
            style: place(i, 5, 280, 40),
          });
        }
      }
      await st.addComplexElement(els[0], els.slice(1));
      st.setSelectedElement(null);
      return els.length;
    },
    { fixture },
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

async function measure(page, fixture, kind, runs) {
  const owner = fixture === "tree" ? "g5-tree-0" : "g5-menu-0";
  return page.evaluate(
    async ({ kind, runs, owner, fixture }) => {
      const hasTreeItemOrigin = Boolean(
        window.__composition_STORE__
          .getState()
          .elementsMap.get("component-tree-item-default"),
      );
      const target =
        kind === "ownerEdit" || kind === "expand"
          ? owner
          : kind === "originEdit"
            ? fixture === "tree"
              ? hasTreeItemOrigin
                ? "component-tree-item-default"
                : "component-tree"
              : "component-menu-item-default"
            : null;
      const store = window.__composition_STORE__;
      const perf = window.__composition_PERF__;
      const scene = window.__composition_SCENE_DEBUG__;
      perf.setRecordingEnabled(true);
      const bp = [
        ...document.querySelectorAll(".builder-control-group button"),
      ].slice(0, 3);
      const apply = (i) => {
        const st = store.getState();
        if (kind === "breakpoint") {
          bp[i % 2 ? 1 : 0]?.click();
          return;
        }
        const el = st.elements.find((e) => e.id === target);
        if (kind === "expand") {
          // tree 0 의 부모 항목 key 전부 ↔ [] (239 이관은 key = 옛 노드 id · 중첩 부모는 부모 key 접두).
          const parents = [];
          for (let k = 0; k < 10; k += 1) {
            parents.push(`g5-tree-0-a${k}`, `g5-tree-0-a${k}/g5-tree-0-a${k}-b`);
          }
          st.updateElementProps(target, { expandedKeys: i % 2 ? parents : [] });
          return;
        }
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
        // instance 가 있는 origin 편집은 영향 대화상자 확인 뒤에 커밋된다 — 뜨면 마지막 버튼 (적용).
        if (kind !== "breakpoint") {
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
    { kind, runs, owner, fixture },
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
  const base = arm === "base" ? ITEMS_BASE_URL : BASE_URL;
  await page.goto(`${base}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr239-g5-${fixture}-${arm}-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const seeded = await seed(page, fixture);
  await page.waitForTimeout(2500);
  // reload — hydration 이 그 빌드의 production 모양을 만든다 (239: 이관 · 239 전: plain · items 그대로).
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await page.waitForTimeout(2500);
  await focusHome(page);
  const env = await page.evaluate((fixture) => {
    const st = window.__composition_STORE__.getState();
    const owner = st.elementsMap.get(
      fixture === "tree" ? "g5-tree-0" : "g5-menu-0",
    );
    return {
      visibility: document.visibilityState,
      dpr: window.devicePixelRatio,
      pageFrames: window.__composition_SCENE_DEBUG__.readPageFrames().length,
      elements: st.elements.length,
      ownerHasItems: Array.isArray(owner?.props?.items),
      ownerExpanded: owner?.props?.expandedKeys ?? null,
      ownerChildren: st.elements.filter((e) => e.parent_id === owner?.id)
        .length,
    };
  }, fixture);
  const out = { fixture, arm, base, seeded, env, ops: {} };
  for (const kind of KINDS) {
    await measure(page, fixture, kind, WARMUP);
    let cdp = null;
    if (PROFILE_KIND === kind) {
      cdp = await page.context().newCDPSession(page);
      await cdp.send("Profiler.enable");
      await cdp.send("Profiler.setSamplingInterval", { interval: 50 });
      await cdp.send("Profiler.start");
    }
    const samples = await measure(page, fixture, kind, RUNS);
    if (cdp) {
      const { profile } = await cdp.send("Profiler.stop");
      const byId = new Map(profile.nodes.map((n) => [n.id, n]));
      const self = new Map();
      profile.samples.forEach((id, i) => {
        const n = byId.get(id);
        const url = String(n.callFrame.url).split("/").pop().split("?")[0];
        const key = `${n.callFrame.functionName || "(anon)"} ${url}:${n.callFrame.lineNumber}`;
        self.set(
          key,
          (self.get(key) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000 / RUNS,
        );
      });
      out.profile = [...self.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 60);
      await cdp.detach();
    }
    // breakpoint 는 짝수 번 눌러 desktop 으로 되돌아온다 (RUNS 홀수 → 한 번 더).
    if (kind === "breakpoint") await measure(page, fixture, kind, 1);
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
  for (const fixture of FIXTURES) {
    for (let p = 0; p < PAIRS; p += 1) {
      const order = p % 2 === 0 ? ["base", "adr239"] : ["adr239", "base"];
      for (const arm of order.filter((a) => !ONLY_ARM || a === ONLY_ARM)) {
        const r = await runArm(browser, fixture, arm);
        runs.push({ pair: p, ...r });
        log(
          fixture,
          `pair ${p}`,
          arm,
          JSON.stringify({
            env: r.env,
            ...Object.fromEntries(
              Object.entries(r.ops).map(([k, v]) => [
                k,
                { p95: v.p95, totalP95: v.totalP95, rebuilt: v.rebuilt },
              ]),
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
for (const fixture of FIXTURES) {
  summary[fixture] = {};
  for (const kind of KINDS) {
    const arm = (a) =>
      runs
        .filter((r) => r.fixture === fixture && r.arm === a)
        .map((r) => r.ops[kind]);
    const plain = arm("base");
    const ref = arm("adr239");
    const plainMed = median(plain.map((o) => o.p95));
    const refMed = median(ref.map((o) => o.p95));
    summary[fixture][kind] = {
      baseP95Median: plainMed,
      adr239P95Median: refMed,
      delta: Number((refMed - plainMed).toFixed(2)),
      totalDelta: Number(
        (
          median(ref.map((o) => o.totalP95)) -
          median(plain.map((o) => o.totalP95))
        ).toFixed(2),
      ),
      baseRebuilt: plain.map((o) => `${o.rebuilt}/${RUNS}`),
      adr239Rebuilt: ref.map((o) => `${o.rebuilt}/${RUNS}`),
      pass: refMed - plainMed <= 1,
    };
  }
}
writeFileSync(
  resolve(OUT_DIR, "g5.json"),
  JSON.stringify(
    {
      at: new Date().toISOString(),
      base: BASE_URL,
      baseUrl: ITEMS_BASE_URL,
      summary,
      runs,
    },
    null,
    2,
  ),
);
log("summary", JSON.stringify(summary, null, 2));

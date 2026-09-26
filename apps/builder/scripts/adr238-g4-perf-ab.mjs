#!/usr/bin/env node
// adr238-g4-perf-ab.mjs — ADR-238 G4 `scene.build` A/B (237 G4 방식 계승: 같은 세션 · headed · arm 교대).
//
// fixture (사람이 만든 모양 — 두 arm 모두 정적 `items` 로 넣고 reload 해 hydration 이 만든 production 모양을 잰다):
//   sections = ListBox 6 · Menu 6, 각 section 3 × 항목 10 (238 전: section 행은 이관 대상 밖이라 `items` 그대로 ·
//              238: section 노드 + Header + 항목 instance 자식)
//   select   = Select 50 × 20 행 (238 전: `items` · 238: ListBoxItem instance 자식 20)
//   flat     = 대조군 — ListBox 6 × 평면 행 30 (두 빌드 모두 234 이관 = 실제 노드 + 글자). section 구조 자체의 비용과
//              "238 전은 section 목록을 빈 행으로 그렸다" (G0) 를 가른다.
// arm — items = 238 전 빌드 (`--items-base`, 61d29f98a worktree) · instance = 238 빌드.
// 조작 3 (불리): ownerEdit (fixture owner 0 padding) · originEdit (ListBoxItem 항목 origin padding — 두 arm 에 다 있다;
//   238 arm 은 전 instance 무효화) · breakpoint.
// 조건: warm-up 3 · 표본 7 · Home 만 보이게 · DPR 1 · visibilityState 기록. 판정: p95 median Δ (instance − items) ≤ +1 ms.
// 총비용 (Q3): 조작 → scene 갱신 → 2 rAF 까지 `total` 도 같은 표본으로 기록.
//
// 사용: node apps/builder/scripts/adr238-g4-perf-ab.mjs --items-base http://127.0.0.1:5174 --auth <두 origin storageState>
//   [--pairs 3] [--fixture sections|select]
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium } from "playwright";
import { waitReady } from "./perf-baseline.mjs";

const args = process.argv.slice(2);
const opt = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const BASE_URL = opt("base", process.env.BUILDER_URL ?? "http://localhost:5173");
const ITEMS_BASE_URL = opt("items-base", BASE_URL);
const ONLY_FIXTURE = opt("fixture", null);
/** `--profile originEdit` — 그 조작 표본 구간의 CPU 프로파일 자체 시간 상위 (진단용, 판정과 무관). */
const PROFILE_KIND = opt("profile", null);
const ONLY_ARM = opt("arm", null);
const PAIRS = Number(opt("pairs", "3"));
const OUT_DIR = opt("out", "/private/tmp/adr238-g4");
const STORAGE_STATE = resolve(
  opt("auth", "apps/builder/scripts/.auth-session.json"),
);
const WARMUP = 3;
const RUNS = 7;
const FIXTURES = ["sections", "select", "flat"].filter(
  (f) => !ONLY_FIXTURE || f === ONLY_FIXTURE,
);
const KINDS = ["ownerEdit", "originEdit", "breakpoint"];
const ORIGIN_TARGET = "component-listbox-item-default";
const log = (...a) => console.log("[adr238 G4]", ...a);
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
      if (fixture === "flat") {
        // 대조군 — sections 와 같은 규모 (목록 6 × 행 30 + 헤더 없이) 의 평면 목록 (234 이관 = 실제 노드).
        const rows = (i) =>
          Array.from({ length: 30 }, (_, k) => ({
            id: `k${k}`,
            label: `Item ${i}-${k}`,
          }));
        for (let i = 0; i < 6; i += 1) {
          node(`g4-lb-${i}`, "ListBox", body.id, i, {
            "aria-label": `List ${i}`,
            items: rows(i),
            style: place(i, 6, 280, 1100),
          });
        }
      } else if (fixture === "sections") {
        const sections = (i) =>
          Array.from({ length: 3 }, (_, s) => ({
            id: `s${s}`,
            type: "section",
            header: `Group ${i}-${s}`,
            items: Array.from({ length: 10 }, (_, k) => ({
              id: `s${s}-k${k}`,
              label: `Item ${i}-${s}-${k}`,
            })),
          }));
        for (let i = 0; i < 6; i += 1) {
          node(`g4-lb-${i}`, "ListBox", body.id, i, {
            "aria-label": `List ${i}`,
            items: sections(i),
            style: place(i, 6, 280, 1100),
          });
        }
        for (let i = 0; i < 6; i += 1) {
          node(`g4-menu-${i}`, "Menu", body.id, 6 + i, {
            label: `Menu ${i}`,
            items: sections(i),
            style: { ...place(i, 6, 280, 40), top: "1200px" },
          });
        }
      } else {
        for (let i = 0; i < 50; i += 1) {
          const oid = `g4-sel-${i}`;
          node(oid, "Select", body.id, i, {
            placeholder: "Pick",
            items: Array.from({ length: 20 }, (_, k) => ({
              id: `r${k}`,
              value: `v${k}`,
              label: `Option ${i}-${k}`,
            })),
            selectedKey: "r3",
            selectedValue: "v3",
            style: place(i, 6, 240, 60),
          });
          node(`${oid}-label`, "Label", oid, 0, { children: `Select ${i}` });
          node(`${oid}-trigger`, "SelectTrigger", oid, 1, {});
          node(`${oid}-value`, "SelectValue", `${oid}-trigger`, 0, {
            placeholder: "Pick",
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
  const target =
    kind === "ownerEdit"
      ? fixture === "select"
        ? "g4-sel-0"
        : "g4-lb-0"
      : kind === "originEdit"
        ? ORIGIN_TARGET
        : null;
  return page.evaluate(
    async ({ kind, runs, target }) => {
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
    { kind, runs, target },
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
  const base = arm === "items" ? ITEMS_BASE_URL : BASE_URL;
  await page.goto(`${base}/dashboard`, { waitUntil: "networkidle" });
  const create = page.locator("button.dashboard-create-button").first();
  await create.waitFor({ state: "visible", timeout: 20_000 });
  await create.click();
  const input = page.locator("#new-project-name");
  await input.waitFor({ state: "visible", timeout: 10_000 });
  await input.fill(`adr238-g4-${fixture}-${arm}-${Date.now()}`);
  await input.press("Enter");
  await page.waitForURL(/\/builder\/[^/?]+$/, { timeout: 90_000 });
  await waitReady(page);
  const seeded = await seed(page, fixture);
  await page.waitForTimeout(2500);
  // reload — hydration 이 그 빌드의 production 모양을 만든다 (238: 이관 · 238 전: items 그대로).
  await page.reload({ waitUntil: "networkidle" });
  await waitReady(page);
  await page.waitForTimeout(2500);
  await focusHome(page);
  const env = await page.evaluate((fixture) => {
    const st = window.__composition_STORE__.getState();
    const owner = st.elementsMap.get(
      fixture === "select" ? "g4-sel-0" : "g4-lb-0",
    );
    return {
      visibility: document.visibilityState,
      dpr: window.devicePixelRatio,
      pageFrames: window.__composition_SCENE_DEBUG__.readPageFrames().length,
      elements: st.elements.length,
      ownerHasItems: Array.isArray(owner?.props?.items),
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
      const order = p % 2 === 0 ? ["items", "instance"] : ["instance", "items"];
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
    const plain = arm("items");
    const ref = arm("instance");
    const plainMed = median(plain.map((o) => o.p95));
    const refMed = median(ref.map((o) => o.p95));
    summary[fixture][kind] = {
      itemsP95Median: plainMed,
      instanceP95Median: refMed,
      delta: Number((refMed - plainMed).toFixed(2)),
      totalDelta: Number(
        (
          median(ref.map((o) => o.totalP95)) -
          median(plain.map((o) => o.totalP95))
        ).toFixed(2),
      ),
      itemsRebuilt: plain.map((o) => `${o.rebuilt}/${RUNS}`),
      instanceRebuilt: ref.map((o) => `${o.rebuilt}/${RUNS}`),
      pass: refMed - plainMed <= 1,
    };
  }
}
writeFileSync(
  resolve(OUT_DIR, "g4.json"),
  JSON.stringify(
    {
      at: new Date().toISOString(),
      base: BASE_URL,
      itemsBase: ITEMS_BASE_URL,
      summary,
      runs,
    },
    null,
    2,
  ),
);
log("summary", JSON.stringify(summary, null, 2));

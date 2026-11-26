#!/usr/bin/env node
// ADR-318 후속 (사용자 2026-11-26 「내용이 많은 Panel 에서 끄는 느낌이 무거울지」) — Panel 안 자식 수별 끌기
// frame time, production 빌드 · headed Chrome · 보이는 탭 · CPU 1x 와 4x.
// 문서: Group (가로, 1200 × 600) > Panel [글자 N 개 — 폭이 바뀌면 줄바꿈이 바뀌는 긴 문장] · Handle · Panel.
// 두 경로 (Styles 숫자 칸 scrub 은 Canvas 손잡이와 같은 미리보기 — previewRecord 의 flexGrow):
//   canvas  — Builder 에서 Panel 을 골라 오른쪽 크기 손잡이를 끈다 (Canvas 레이아웃 · Skia)
//   publish — Preview 창에서 separator 를 끈다 (DOM flex — 브라우저 레이아웃)
// 끌기 = ±150 px 왕복 3 번 (6 px 걸음 — 한 걸음 = 한 pointermove). 지표 = rAF 간격 p50 · p95 · p99 · LoAF,
// 탭의 idle rAF 간격 (화면 · 브라우저 속도 — 바닥) 과 같이. 판정 (HC5 와 같은 식) = p95 ≤ max(16.7, idle + 1.7) ·
// LoAF 0. 3 회 중앙값.
//
//   node apps/builder/scripts/adr318-heavy-panel-frame.mjs --dist <dir> [<out-dir>]
//   (dist = `pnpm perf:build-dist -- --out <dir>`; DEVBASE=http://localhost:5173/composition 이면 dev 서버)
//   COUNTS=0,300,1000 (기본) · RATES=1,4 (기본)
//   PROFILE=1 — Canvas 끌기 1 회 (COUNTS 첫 값 · RATES 첫 값) 의 CPU 프로필 — self time 상위 함수 · 파일별 합
//   CONTROL=1 — 대조군: Resizable 대신 Frame (600 × 600) 에 같은 글자 N 개, Canvas 폭 손잡이만 (일반 크기 조절)
//   TEXTS=distinct — 글자마다 다른 문장 (기본 same — 모든 글자가 같은 문장이라 측정 캐시가 공유된다)
// 표본 유효성 (ADR-319 리뷰 R1 H3): 매 표본이 같은 시작 크기 (Canvas = undo, Publish = 다시 열기) 에서 시작하고
// 손잡이 좌표를 그때 다시 구한다. 시작 크기가 처음과 다르거나 끝 크기가 시작과 같은 표본은 버리고 (INVALID 로
// 표시), 유효 표본 3 개를 모을 때까지 최대 6 회 잰다.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { createFrameResolver, serveHarnessDist } from "./perfDist.mjs";

const argv = process.argv.slice(2);
const opt = (name) => {
  const at = argv.indexOf(name);
  return at >= 0 ? argv[at + 1] : undefined;
};
const OUT =
  argv.filter(
    (a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"),
  )[0] ?? "/private/tmp/adr318-heavy-panel";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const COUNTS = (process.env.COUNTS ?? "0,300,1000").split(",").map(Number);
const RATES = (process.env.RATES ?? "1,4").split(",").map(Number);
const RUNS = 3;
const MAX_TRIES = 6;
const DISTINCT = process.env.TEXTS === "distinct";

const quantile = (values, q) => {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};
const median = (values) => quantile(values, 0.5);

const server = process.env.DEVBASE
  ? { url: process.env.DEVBASE, close: async () => {} }
  : await serveHarnessDist(opt("--dist"), 4320);
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const errors = [];

/** rAF intervals · LoAF on `page` while `drag` runs, and the idle interval before. */
async function measure(page, rate, drag) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate });
  await page.waitForTimeout(300);
  const idle = await page.evaluate(
    () =>
      new Promise((done) => {
        const f = [];
        const loop = (t) => {
          f.push(t);
          if (f.length < 61) requestAnimationFrame(loop);
          else done(f.slice(1).map((v, i) => v - f[i]));
        };
        requestAnimationFrame(loop);
      }),
  );
  await page.evaluate(() => {
    window.__frames = [];
    window.__loaf = [];
    const loop = (t) => {
      window.__frames.push(t);
      if (window.__recording) requestAnimationFrame(loop);
    };
    window.__recording = true;
    requestAnimationFrame(loop);
    window.__loafObserver?.disconnect();
    window.__loafObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__loaf.push(entry.duration);
    });
    window.__loafObserver.observe({ type: "long-animation-frame" });
  });
  await drag();
  const got = await page.evaluate(() => {
    window.__recording = false;
    const f = window.__frames;
    return {
      deltas: f.slice(1).map((t, i) => t - f[i]),
      loaf: window.__loaf,
    };
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await cdp.detach();
  return {
    p50: median(got.deltas),
    p95: quantile(got.deltas, 0.95),
    p99: quantile(got.deltas, 0.99),
    frames: got.deltas.length,
    loafCount: got.loaf.length,
    loafMax: got.loaf.length ? Math.max(...got.loaf) : 0,
    idle: median(idle),
  };
}

/**
 * ±150 px, 3 laps, 6 px steps from `start` (one step = one pointermove), then 60 px left — so the
 * end size differs from the start (the drag is seen to take).
 */
async function zigzag(page, start) {
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  let x = start.x;
  for (let lap = 0; lap < 3; lap++)
    for (const dir of [-1, 1, 1, -1])
      for (let s = 0; s < 25; s++) {
        x += dir * 6;
        await page.mouse.move(x, start.y);
      }
  for (let s = 0; s < 10; s++) {
    x -= 6;
    await page.mouse.move(x, start.y);
  }
  await page.mouse.up();
}
const CONTROL = !!process.env.CONTROL;

async function openWith(count) {
  const state = JSON.parse(
    readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
  );
  state.origins = (state.origins ?? []).map((o) => ({
    ...o,
    origin: new URL(server.url).origin,
  }));
  const context = await browser.newContext({
    storageState: state,
    viewport: { width: 1600, height: 1000 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${count} builder: ${e.message}`));
  await page.goto(`${server.url}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type(`adr318 heavy ${count}`);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 60000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 60000 },
  );
  await page.waitForTimeout(1500);
  const ids = await page.evaluate(
    ({ count, CONTROL, DISTINCT }) => {
      const h = window.__COMPOSITION_CATALOG__;
      const ws = h.workspace;
      const g = ws.root.runtime.graph;
      const C = h.commands;
      const set = (value) => ({ kind: "set", value });
      const pageId = ws.session.getSnapshot().pageId;
      const body = g.getEntry(pageId).children[0];
      const node = (id, definitionId, sizing = {}) => ({
        kind: "node",
        id,
        definitionId,
        children: [],
        props: {},
        visual: {},
        sizing: Object.fromEntries(
          Object.entries(sizing).map(([k, v]) => [k, set(v)]),
        ),
        descendantOverrides: [],
      });
      const host = CONTROL
        ? "project:node:heavy-frame"
        : "project:node:heavy-group";
      ws.execute(
        C.insertNodes({
          parent: { kind: "node", id: body },
          entries: [
            CONTROL
              ? node(host, "lib:definition:type-frame", {
                  width: 600,
                  height: 600,
                })
              : node(
                  host,
                  "lib:definition:origin-component-resizablepanelgroup",
                  { width: 1200, height: 600 },
                ),
          ],
          rootIds: [host],
          newId: ws.newId,
        }),
      );
      const [left] = CONTROL
        ? [host]
        : g
            .getEntry(host)
            .descendantOverrides.find((o) => o.kind === "fillSlot").childIds;
      if (count) {
        const WORDS = [
          "revenue",
          "support",
          "region",
          "pipeline",
          "forecast",
          "churn",
          "margin",
          "backlog",
          "quota",
          "renewal",
          "invoice",
          "segment",
        ];
        const TEXT = h.palette.catalogPaletteDefinitionId(g.library, "Text");
        const ids = Array.from(
          { length: count },
          (_, i) => `project:node:heavy-text-${i}`,
        );
        ws.execute(
          C.insertNodes({
            parent: { kind: "node", id: left },
            entries: ids.map((id) => node(id, TEXT)),
            rootIds: ids,
            newId: ws.newId,
          }),
        );
        const SAME =
          "Quarterly revenue grew across every region while support tickets fell, so the panel text wraps differently at each width.";
        // (distinct: each text its own words and length — no two share a measure-cache key.)
        const sentence = (i) =>
          `Item ${i}: ${Array.from(
            { length: 12 + (i % 9) },
            (_, k) => WORDS[(i * 7 + k * 5) % WORDS.length],
          ).join(" ")} closed ${i % 31} days early.`;
        if (DISTINCT)
          for (const [i, id] of ids.entries())
            ws.execute(
              C.setFields({
                targets: [{ kind: "node", id }],
                props: { children: set(sentence(i)) },
                label: "text",
              }),
            );
        else
          ws.execute(
            C.setFields({
              targets: ids.map((id) => ({ kind: "node", id })),
              props: { children: set(SAME) },
              label: "text",
            }),
          );
      }
      const r = ws.root;
      const rec = (n) => r.recordsOfSource(n)[0];
      if (CONTROL) return { left: rec(host) };
      const group = r.canvasInputs.get(rec(host));
      return {
        group: group.id,
        left: group.children[0],
        handle: group.children[1],
      };
    },
    { count, CONTROL, DISTINCT },
  );
  await page.waitForTimeout(2500);
  return { context, page, ids };
}

const table = {};
const note = (key, value) => (table[key] ??= []).push(value);

for (const count of COUNTS) {
  const { context, page, ids } = await openWith(count);
  // Canvas: the left Panel's right size handle.
  await page.evaluate(
    (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
    ids.left,
  );
  await page.waitForTimeout(600);
  // (The Frame control's mid edge is its padding handle — it takes the bottom-right corner.)
  const edgeOf = () =>
    page.evaluate(
      ({ id, fy }) => {
        const cat = window.__COMPOSITION_CATALOG__;
        const box = cat.canvas.boundsOf(id);
        const camera = cat.canvas.camera();
        const rect = document
          .querySelector('[data-catalog-canvas="true"]')
          .getBoundingClientRect();
        return {
          x: rect.left + camera.x + (box.x + box.width) * camera.zoom,
          y: rect.top + camera.y + (box.y + box.height * fy) * camera.zoom,
        };
      },
      { id: ids.left, fy: CONTROL ? 1 : 0.5 },
    );
  const edge = await edgeOf();
  // (The written size: the Panel's Default size · the Frame's width — undefined = the initial.)
  const sizeNow = () =>
    page.evaluate((id) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const entry = ws.runtime.graph.getEntry(
        ws.root.canvasInputs.get(id)?.sourceId,
      );
      return entry?.props?.defaultSize?.value ?? entry?.sizing?.width?.value;
    }, ids.left);
  const initial = await sizeNow();
  const drawn = await page.evaluate(
    (id) =>
      window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.get(id)
        ?.children.length,
    ids.left,
  );
  if (process.env.PROFILE) {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: RATES[0] });
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
    await cdp.send("Profiler.start");
    await zigzag(page, edge);
    const { profile } = await cdp.send("Profiler.stop");
    const resolve = process.env.DEVBASE
      ? (label) => label.replace(/https?:\/\/[^ ]*?\/(src|packages)\//, "$1/")
      : createFrameResolver(opt("--dist"));
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    const self = new Map();
    const byFile = new Map();
    profile.samples.forEach((id, i) => {
      const n = byId.get(id);
      const ms = (profile.timeDeltas[i] ?? 0) / 1000;
      const { functionName, url, lineNumber } = n.callFrame;
      const file = url.split("/").pop() || "(native)";
      byFile.set(file, (byFile.get(file) ?? 0) + ms);
      const key = resolve(
        `${functionName || "(anon)"} ${url}:${lineNumber + 1}`,
      );
      self.set(key, (self.get(key) ?? 0) + ms);
    });
    // Inclusive time per function (a node's subtree), counted once per stack.
    const parent = new Map();
    for (const n of profile.nodes)
      for (const c of n.children ?? []) parent.set(c, n.id);
    const label = (n) =>
      resolve(
        `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url}:${n.callFrame.lineNumber + 1}`,
      );
    const total = new Map();
    profile.samples.forEach((id, i) => {
      const ms = (profile.timeDeltas[i] ?? 0) / 1000;
      const seen = new Set();
      for (let at = id; at !== undefined; at = parent.get(at)) {
        const key = label(byId.get(at));
        if (seen.has(key)) continue;
        seen.add(key);
        total.set(key, (total.get(key) ?? 0) + ms);
      }
    });
    const top = (map, n) =>
      [...map.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([k, v]) => `${v.toFixed(0).padStart(6)} ms  ${k}`);
    const text = [
      `PROFILE canvas ${count} ${RATES[0]}x — self time`,
      ...top(self, 35),
      "— inclusive (app source)",
      ...top(
        new Map([...total].filter(([k]) => / (src|packages)\//.test(k))),
        40,
      ),
      "— by file",
      ...top(byFile, 10),
    ].join("\n");
    writeFileSync(`${OUT}/profile-${count}.txt`, text + "\n");
    process.stdout.write(text + "\n");
    await context.close();
    continue;
  }
  for (const rate of RATES)
    for (let valid = 0, tries = 0; valid < RUNS && tries < MAX_TRIES; tries++) {
      const before = await sizeNow();
      const start = await edgeOf();
      const result = await measure(page, rate, () => zigzag(page, start));
      const after = await sizeNow();
      // (A sample counts when it started at the initial size and the release wrote a new one.)
      const ok = before === initial && after !== before;
      note(`${CONTROL ? "control" : "canvas"} ${count} ${rate}x`, {
        ...result,
        drawn,
        before,
        moved: after,
        ok,
      });
      if (ok) valid++;
      // (Each release writes the size — put it back so every run starts at the initial size.)
      if (after !== before)
        await page.evaluate(() =>
          window.__COMPOSITION_CATALOG__.workspace.undo(),
        );
      await page.waitForTimeout(500);
    }
  await page.screenshot({ path: `${OUT}/canvas-${count}.png` });
  if (CONTROL) {
    await context.close();
    continue;
  }
  // Publish: the separator.
  const popup = context.waitForEvent("page", { timeout: 60000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) =>
        ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
      )
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`${count} publish: ${e.message}`));
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 60000 });
  await pub.waitForSelector(
    `[data-catalog-id="${ids.handle}"][role="separator"]`,
    { timeout: 60000 },
  );
  await pub.waitForTimeout(1500);
  // (The Builder tab goes — its Canvas would draw beside the measured page.)
  await page.close();
  await pub.bringToFront();
  const handle = pub.locator(`[data-catalog-id="${ids.handle}"]`);
  const publishInitial = await handle.getAttribute("aria-valuenow");
  const domKids = await pub.evaluate(
    (id) =>
      document.querySelector(`[data-catalog-id="${id}"]`)?.children.length,
    ids.left,
  );
  for (const rate of RATES)
    for (let valid = 0, tries = 0; valid < RUNS && tries < MAX_TRIES; tries++) {
      // (Every sample from the initial split: the sizes are runtime state — the Builder tab that
      //  feeds this window is closed, so it cannot be opened again — and the separator's own keys
      //  (an arrow = one 5 % step, the zigzag's tail is one step) put it back; its center is found again.)
      for (let step = 0; step < 20; step++) {
        const now = Number(await handle.getAttribute("aria-valuenow"));
        const want = Number(publishInitial);
        if (now === want) break;
        await handle.focus();
        await pub.keyboard.press(now < want ? "ArrowRight" : "ArrowLeft");
        await pub.waitForTimeout(100);
      }
      await pub.waitForTimeout(400);
      const before = await handle.getAttribute("aria-valuenow");
      const box = await handle.boundingBox();
      const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const result = await measure(pub, rate, () => zigzag(pub, start));
      const after = await handle.getAttribute("aria-valuenow");
      const ok = before === publishInitial && after !== before;
      note(`publish ${count} ${rate}x`, {
        ...result,
        drawn: domKids,
        before,
        moved: after,
        ok,
      });
      if (ok) valid++;
    }
  await pub.screenshot({ path: `${OUT}/publish-${count}.png` });
  await context.close();
}
await browser.close();
await server.close();

const lines = [];
let pass = true;
for (const [key, all] of Object.entries(table)) {
  const runs = all.filter((r) => r.ok);
  const dropped = all.length - runs.length;
  if (runs.length < RUNS) {
    pass = false;
    lines.push(
      `[${key}] INVALID 유효 표본 ${runs.length}/${RUNS} (버림 ${dropped} — 시작 → 끝 ${all.map((r) => `${r.before ?? "기본"}→${r.moved ?? "기본"}`).join(" · ")})`,
    );
    continue;
  }
  const p95 = median(runs.map((r) => r.p95));
  const idle = median(runs.map((r) => r.idle));
  const loaf = median(runs.map((r) => r.loafCount));
  const ok = p95 <= Math.max(16.7, idle + 1.7) && loaf === 0;
  if (!ok) pass = false;
  lines.push(
    `[${key}] ${ok ? "ok  " : "SLOW"} p50 ${median(runs.map((r) => r.p50)).toFixed(1)} · p95 ${p95.toFixed(1)} · p99 ${median(
      runs.map((r) => r.p99),
    ).toFixed(1)} ms · LoAF ${loaf} (최대 ${median(
      runs.map((r) => r.loafMax),
    ).toFixed(
      0,
    )} ms) · 프레임 ${median(runs.map((r) => r.frames))} · idle ${idle.toFixed(
      1,
    )} · 자식 ${runs[0].drawn} · 시작 → 끝 ${runs.map((r) => `${r.before ?? "기본"}→${r.moved}`).join(" · ")}${dropped ? ` (버림 ${dropped})` : ""} · p95 [${runs.map((r) => r.p95.toFixed(1)).join(" / ")}]`,
  );
}
lines.push(
  `page errors ${errors.length}${errors.length ? ` — ${errors.slice(0, 3).join(" | ")}` : ""}`,
);
lines.push(
  pass && !errors.length
    ? "PASS (p95 ≤ max(16.7, idle + 1.7) ms · LoAF 0 — 전 칸)"
    : "SLOW · INVALID 칸 있음",
);
writeFileSync(`${OUT}/heavy-panel.txt`, lines.join("\n") + "\n");
process.stdout.write(lines.join("\n") + "\n");

#!/usr/bin/env node
// ADR-318 HC5 (G6) — 끌기 중 frame time, production 빌드 · headed Chrome · 보이는 탭 · CPU 1x 와 4x.
// 문서 (부하용 — 규모 전용): Group (가로, 1200 × 600) > Panel [Table 1,000 행 · 가상 스크롤] · Handle ·
// Panel [중첩 Group (세로) > Panel [이름 붙인 상태 leftSize 를 읽는 글자 3] · Handle · Panel].
// 바깥 손잡이를 ±300 px 왕복 3 번 (6 px 걸음 — 한 걸음 = 한 pointermove) 끄는 동안의 rAF 간격 p50 · p95 ·
// p99 · LoAF. 대조군 = 같은 문서에서 실행 상태 쓰기를 끌기 끝으로 민 빌드 (arm `end`), 교대 3 쌍 중앙값.
//
//   node apps/builder/scripts/adr318-hc5-frame.mjs --frame <dist> --end <dist> [<out-dir>]
//   (각 dist = `pnpm perf:build-dist -- --out <dir>` — end 빌드는 rAF 쓰기를 뺀 판으로 따로 만든다)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { serveHarnessDist } from "./perfDist.mjs";

const argv = process.argv.slice(2);
const opt = (name) => {
  const at = argv.indexOf(name);
  return at >= 0 ? argv[at + 1] : undefined;
};
const DIST = { frame: opt("--frame"), end: opt("--end") };
const OUT =
  argv.filter(
    (a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"),
  )[0] ?? "/private/tmp/adr318-hc5";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const ROWS = 1000;

const quantile = (values, q) => {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
};
const median = (values) => quantile(values, 0.5);

const servers = process.env.DEVBASE
  ? { frame: { url: process.env.DEVBASE, close: async () => {} } }
  : {
      frame: await serveHarnessDist(DIST.frame, 4318),
      end: await serveHarnessDist(DIST.end, 4319),
    };
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const errors = [];

async function openPublishFor(arm) {
  const base = servers[arm].url;
  const state = JSON.parse(
    readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
  );
  state.origins = (state.origins ?? []).map((o) => ({
    ...o,
    origin: new URL(base).origin,
  }));
  const context = await browser.newContext({
    storageState: state,
    viewport: { width: 1600, height: 1000 },
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(`${arm} builder: ${e.message}`));
  await page.goto(`${base}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type(`adr318 hc5 ${arm}`);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 60000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    {
      timeout: 60000,
    },
  );
  await page.waitForTimeout(1500);
  const ids = await page.evaluate(
    async ({ ROWS, NOSTATE }) => {
      const h = window.__COMPOSITION_CATALOG__;
      const ws = h.workspace;
      const g = ws.root.runtime.graph;
      const C = h.commands;
      const set = (value) => ({ kind: "set", value });
      ws.execute(
        C.setDataEntries({
          puts: [
            {
              kind: "collection",
              id: "data:collection:people",
              name: "People",
              schema: [
                { id: "f-id", key: "id", type: "string" },
                { id: "f-name", key: "name", type: "string" },
                { id: "f-city", key: "city", type: "string" },
              ],
              mockData: Array.from({ length: ROWS }, (_, i) => ({
                id: `p${i + 1}`,
                name: `Person ${i + 1}`,
                city: `City ${i % 37}`,
              })),
              useMockData: true,
            },
          ],
          label: "HC5 data",
        }),
      );
      const pageId = ws.session.getSnapshot().pageId;
      const body = g.getEntry(pageId).children[0];
      const insert = (parent, id, definitionId, sizing = {}, props = {}) =>
        ws.execute(
          C.insertNodes({
            parent: { kind: "node", id: parent },
            entries: [
              {
                kind: "node",
                id,
                definitionId,
                children: [],
                props: Object.fromEntries(
                  Object.entries(props).map(([k, v]) => [k, set(v)]),
                ),
                visual: {},
                sizing: Object.fromEntries(
                  Object.entries(sizing).map(([k, v]) => [k, set(v)]),
                ),
                descendantOverrides: [],
              },
            ],
            rootIds: [id],
            newId: ws.newId,
          }),
        );
      const GROUP = "lib:definition:origin-component-resizablepanelgroup";
      const slotKids = (id) =>
        g.getEntry(id).descendantOverrides.find((o) => o.kind === "fillSlot")
          .childIds;
      insert(body, "project:node:hc5-outer", GROUP, {
        width: 1200,
        height: 600,
      });
      const [left, , right] = slotKids("project:node:hc5-outer");
      insert(
        left,
        "project:node:hc5-table",
        h.palette.catalogPaletteDefinitionId(g.library, "Table"),
      );
      ws.execute(
        C.setFields({
          targets: [{ kind: "node", id: "project:node:hc5-table" }],
          visual: { width: set("100%"), height: set("100%") },
          label: "fill",
        }),
      );
      ws.execute(
        h.binding.catalogBindingCommand(
          [{ kind: "node", id: "project:node:hc5-table" }],
          h.binding.catalogBindingRef({
            source: "dataTable",
            collectionId: "people",
            name: "People",
          }),
        ),
      );
      ws.execute(
        h.rowDisplay.setRowDisplay("project:node:hc5-table", {
          mode: "virtual",
        }),
      );
      insert(
        right,
        "project:node:hc5-inner",
        GROUP,
        {},
        { orientation: "vertical" },
      );
      ws.execute(
        C.setFields({
          targets: [{ kind: "node", id: "project:node:hc5-inner" }],
          visual: { width: set("100%"), height: set("100%") },
          label: "fill",
        }),
      );
      const [top] = slotKids("project:node:hc5-inner");
      // The named state the three texts read (the left Panel's size — Phase 5).
      if (!NOSTATE)
        ws.execute(
          C.addRecord({
            entry: {
              kind: "stateVariable",
              id: ws.newId("stateVariable"),
              ownerId: pageId,
              name: "leftSize",
              valueType: "number",
              defaultValue: 50,
              source: { nodeId: left, prop: "size" },
            },
            label: "Name state",
          }),
        );
      const TEXT = h.palette.catalogPaletteDefinitionId(g.library, "Text");
      for (const n of NOSTATE ? [1] : [1, 2, 3]) {
        insert(top, `project:node:hc5-text-${n}`, TEXT);
        ws.execute(
          C.setFields({
            targets: [{ kind: "node", id: `project:node:hc5-text-${n}` }],
            props: { children: set(`Left ${n}: {{ leftSize }} %`) },
            label: "text",
          }),
        );
      }
      const r = ws.root;
      const rec = (node) => r.recordsOfSource(node)[0];
      const outer = r.canvasInputs.get(rec("project:node:hc5-outer"));
      return {
        outer: outer.id,
        handle: outer.children[1],
        text: rec("project:node:hc5-text-1"),
        table: rec("project:node:hc5-table"),
      };
    },
    { ROWS, NOSTATE: !!process.env.NOSTATE },
  );
  await page.waitForTimeout(1500);
  const popup = context.waitForEvent("page", { timeout: 60000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) =>
        ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
      )
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`${arm} publish: ${e.message}`));
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 60000 });
  await pub.waitForSelector(
    `[data-catalog-id="${ids.handle}"][role="separator"]`,
    {
      timeout: 60000,
    },
  );
  await pub.waitForTimeout(1500);
  // (The Builder tab goes — its Canvas would draw beside the measured page.)
  await page.close();
  return { context, pub, ids };
}

const table = {};

const cdpOf = new Map();
const opened = {};
for (const arm of Object.keys(servers)) opened[arm] = await openPublishFor(arm);
if (process.env.PROFILE) {
  const { pub, ids } = opened.frame;
  const cdp = await pub.context().newCDPSession(pub);
  await cdp.send("Profiler.enable");
  await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
  const box = await pub
    .locator(`[data-catalog-id="${ids.handle}"]`)
    .boundingBox();
  const x0 = box.x + box.width / 2,
    y0 = box.y + box.height / 2;
  await pub.mouse.move(x0, y0);
  await pub.mouse.down();
  await cdp.send("Profiler.start");
  for (let s = 1; s <= 120; s++) await pub.mouse.move(x0 - 2 * s, y0);
  const { profile } = await cdp.send("Profiler.stop");
  await pub.mouse.up();
  const self = new Map();
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const dt = profile.timeDeltas;
  profile.samples.forEach((id, i) => {
    const n = byId.get(id);
    const key = `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").pop()}:${n.callFrame.lineNumber}`;
    self.set(key, (self.get(key) ?? 0) + (dt[i] ?? 0) / 1000);
  });
  const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30);
  writeFileSync(
    `${OUT}/profile-top.txt`,
    top.map(([k, v]) => `${v.toFixed(1)} ms  ${k}`).join("\n"),
  );
  writeFileSync(`${OUT}/drag.cpuprofile`, JSON.stringify(profile));
  process.stdout.write(
    top
      .slice(0, 30)
      .map(([k, v]) => `${v.toFixed(1)} ms  ${k}`)
      .join("\n") + "\n",
  );
  process.exit(0);
}
if (process.env.PROBE) {
  for (const arm of ["frame", "end"]) {
    const { pub, ids } = opened[arm];
    await pub.bringToFront();
    const box = await pub
      .locator(`[data-catalog-id="${ids.handle}"]`)
      .boundingBox();
    const x0 = box.x + box.width / 2,
      y0 = box.y + box.height / 2;
    await pub.mouse.move(x0, y0);
    await pub.mouse.down();
    for (let s = 1; s <= 25; s++) await pub.mouse.move(x0 - 6 * s, y0);
    await pub.waitForTimeout(400);
    const during = {
      now: await pub
        .locator(`[data-catalog-id="${ids.handle}"]`)
        .getAttribute("aria-valuenow"),
      text: await pub.locator(`[data-catalog-id="${ids.text}"]`).textContent(),
    };
    await pub.mouse.up();
    await pub.waitForTimeout(400);
    const after = {
      now: await pub
        .locator(`[data-catalog-id="${ids.handle}"]`)
        .getAttribute("aria-valuenow"),
      text: await pub.locator(`[data-catalog-id="${ids.text}"]`).textContent(),
    };
    process.stdout.write(`probe ${arm} ${JSON.stringify({ during, after })}\n`);
  }
  process.exit(0);
}
const rows = await opened.frame.pub.evaluate(
  (id) =>
    document
      .querySelector(`[data-catalog-id="${id}"]`)
      ?.querySelectorAll('[role="row"]').length,
  opened.frame.ids.table,
);
for (const rate of [1, 4])
  for (const pair of [0, 1, 2]) {
    const order = pair % 2 ? ["end", "frame"] : ["frame", "end"];
    for (const arm of order) {
      const { pub, ids } = opened[arm];
      await pub.bringToFront();
      let cdp = cdpOf.get(pub);
      if (!cdp) cdpOf.set(pub, (cdp = await pub.context().newCDPSession(pub)));
      await cdp.send("Emulation.setCPUThrottlingRate", { rate });
      await pub.waitForTimeout(300);
      const box = await pub
        .locator(`[data-catalog-id="${ids.handle}"]`)
        .boundingBox();
      const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
      const visible = await pub.evaluate(() => document.visibilityState);
      const before = await pub
        .locator(`[data-catalog-id="${ids.text}"]`)
        .textContent();
      // The idle rAF interval of this tab now (the display · the browser's own pace — the floor).
      const idle = await pub.evaluate(
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
      await pub.evaluate(() => {
        window.__frames = [];
        window.__loaf = [];
        const loop = (t) => {
          window.__frames.push(t);
          if (window.__recording) requestAnimationFrame(loop);
        };
        window.__recording = true;
        requestAnimationFrame(loop);
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            window.__loaf.push(entry.duration);
        }).observe({ type: "long-animation-frame" });
      });
      await pub.mouse.move(start.x, start.y);
      await pub.mouse.down();
      let x = start.x;
      let mid = "";
      for (let lap = 0; lap < 3; lap++)
        for (const dir of [-1, 1, 1, -1])
          for (let s = 0; s < 25; s++) {
            x += dir * 6;
            await pub.mouse.move(x, start.y);
            if (lap === 0 && dir === -1 && s === 24)
              mid = await pub
                .locator(`[data-catalog-id="${ids.text}"]`)
                .textContent();
          }
      const now = await pub
        .locator(`[data-catalog-id="${ids.handle}"]`)
        .getAttribute("aria-valuenow");
      await pub.mouse.up();
      if (rate === 1 && pair === 0)
        await pub.screenshot({ path: `${OUT}/${arm}-dragged.png` });
      const got = await pub.evaluate(() => {
        window.__recording = false;
        const f = window.__frames;
        return {
          deltas: f.slice(1).map((t, i) => t - f[i]),
          loaf: window.__loaf,
        };
      });
      const key = `${rate}x ${arm}`;
      (table[key] ??= []).push({
        p50: median(got.deltas),
        p95: quantile(got.deltas, 0.95),
        p99: quantile(got.deltas, 0.99),
        frames: got.deltas.length,
        loafCount: got.loaf.length,
        loafMax: got.loaf.length ? Math.max(...got.loaf) : 0,
        visible,
        idle: median(idle),
        now,
        before,
        mid,
      });
    }
  }
for (const { context } of Object.values(opened)) await context.close();
await browser.close();
for (const server of Object.values(servers)) await server.close();

const lines = [`Publish Table rows in DOM (virtual window): ${rows}`];
let pass = true;
for (const [key, runs] of Object.entries(table)) {
  const p95 = median(runs.map((r) => r.p95));
  // (The floor is the display's pace: 16.7 ms at 60 Hz — this tab's idle rAF interval when the
  //  browser paces slower (a 50 Hz run: 20 ms). Over that by 1.7 ms = a dropped frame's share.)
  const idle = median(runs.map((r) => r.idle));
  if (
    key.endsWith("frame") &&
    (p95 > Math.max(16.7, idle + 1.7) ||
      median(runs.map((r) => r.loafCount)) > 0)
  )
    pass = false;
  lines.push(
    `[${key}] p50 ${median(runs.map((r) => r.p50)).toFixed(1)} · p95 ${p95.toFixed(1)} · p99 ${median(
      runs.map((r) => r.p99),
    ).toFixed(
      1,
    )} ms · LoAF ${median(runs.map((r) => r.loafCount))} (최대 ${median(
      runs.map((r) => r.loafMax),
    ).toFixed(
      0,
    )} ms) · 프레임 ${median(runs.map((r) => r.frames))} · idle p50 ${median(
      runs.map((r) => r.idle),
    ).toFixed(
      1,
    )} · 끝 valuenow ${runs[0].now} · ${runs[0].visible} · p95 [${runs
      .map((r) => r.p95.toFixed(1))
      .join(
        " / ",
      )}] · 글자 ${runs[0].before?.trim()} → 끄는 중 ${runs[0].mid?.trim()}`,
  );
}
lines.push(
  `page errors ${errors.length}${errors.length ? ` — ${errors.slice(0, 3).join(" | ")}` : ""}`,
);
lines.push(
  pass && !errors.length
    ? "HC5 PASS (frame arm 1x · 4x p95 ≤ max(16.7, idle + 1.7) ms · LoAF 0)"
    : "HC5 FAIL",
);
writeFileSync(`${OUT}/hc5.txt`, lines.join("\n") + "\n");
process.stdout.write(lines.join("\n") + "\n");

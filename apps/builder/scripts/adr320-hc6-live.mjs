#!/usr/bin/env node
// ADR-320 HC6 — 조건 변경 → 결과 표시 (production · headed Chrome · 10,000 행 · 가상 스크롤 Table).
//
// 같은 문서의 같은 표에서 두 팔을 교대로 잰다 (A B · B A · A B — 3 쌍, CPU 1x · 4x):
//   A (필터 바)   「조건 편집」 빌더의 2 단 묶음 「그리고 · 또는」 전환 버튼 클릭 — 조건 6 개, 「또는」
//                 묶음 안에 「그리고」 묶음 (2 단 중첩). 클릭마다 결과 행 집합이 바뀐다.
//   B (대조군)    같은 표의 머리글 정렬 클릭 — HC6 의 기준선 (ADR-315 G0 「정렬 클릭 → 화면」
//                 1x 154 ~ 169 · 4x 556 ~ 589 ms) 과 같은 동작을 이 환경에서 같이 잰다.
// 값 = 클릭 한 번 (interaction) 의 Event Timing 가장 긴 entry — 입력 → 다음 paint.
// 결과가 맞는지는 이 파일의 행 생성기로 따로 센 행 수와 표의 `aria-rowcount` 로 본다.
//
//   pnpm perf:build-dist
//   node apps/builder/scripts/adr320-hc6-live.mjs <out-dir> --serve-dist /private/tmp/perf-baseline-dist [--rows 10000]
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { serveHarnessDist } from "./perfDist.mjs";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr320-hc6-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const arg = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at > 0 ? process.argv[at + 1] : fallback;
};
const distDir = arg("--serve-dist", null);
if (!distDir) throw new Error("--serve-dist <dir> (pnpm perf:build-dist)");
const ROWS = Number(arg("--rows", "10000"));
const CLICKS = 6;
const dist = await serveHarnessDist(distDir, 4193);
const BASE = dist.url;
const log = (line) => process.stdout.write(`${line}\n`);

const COLUMNS = [
  { key: "name", label: "Name", type: "string" },
  { key: "dept", label: "Dept", type: "string" },
  { key: "city", label: "City", type: "string" },
  { key: "amount", label: "Amount", type: "number" },
  { key: "qty", label: "Qty", type: "number" },
  { key: "date", label: "Date", type: "string" },
];
// (mulberry32 — `datagrid-table-vs-tanstack-live.mjs` 와 같은 행.)
function makeRows(count) {
  let a = count;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pad = (n) => String(n).padStart(2, "0");
  return Array.from({ length: count }, (_, i) => ({
    id: `r${i}`,
    name: `Person ${Math.floor(next() * count * 4)}`,
    dept: `Dept ${Math.floor(next() * 12)}`,
    city: `City ${Math.floor(next() * 50)}`,
    amount: Math.floor(next() * 1_000_000) / 100,
    qty: Math.floor(next() * 500),
    date: `2026-${pad(Math.floor(next() * 12) + 1)}-${pad(Math.floor(next() * 28) + 1)}`,
  }));
}
const ALL = makeRows(ROWS);
const DATA = JSON.stringify({ items: ALL, next: null });
const server = createServer((req, res) => {
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
  };
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }
  res.writeHead(200, { "content-type": "application/json", ...cors });
  res.end(DATA);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const REMOTE_BASE = `http://127.0.0.1:${server.address().port}`;

// 조건 6 개 · 2 단 중첩: qty ≥ 50 그리고 (dept = Dept 1 또는 city = City 2 또는 (amount ≥ 5000
// <g2> date 가 「2026-0」 로 시작)) 그리고 name 에 「1」.
const f = (key) => [`data:field:f-${key}`];
const TREE = {
  id: "filter-scope",
  op: "and",
  items: [
    { id: "q", fields: [f("qty")], op: "gte", value: 50 },
    {
      id: "g1",
      op: "or",
      items: [
        { id: "d", fields: [f("dept")], op: "equals", value: "Dept 1" },
        { id: "c", fields: [f("city")], op: "equals", value: "City 2" },
        {
          id: "g2",
          op: "and",
          items: [
            { id: "a", fields: [f("amount")], op: "gte", value: 5000 },
            { id: "t", fields: [f("date")], op: "startsWith", value: "2026-0" },
          ],
        },
      ],
    },
    { id: "n", fields: [f("name")], op: "contains", value: "1" },
  ],
};
/** 따로 센 행 수 — `g2` 가 「그리고」 · 「또는」 일 때. */
const expectedCount = (g2) =>
  ALL.filter((row) => {
    const a = row.amount >= 5000;
    const t = row.date.startsWith("2026-0");
    return (
      row.qty >= 50 &&
      (row.dept === "Dept 1" ||
        row.city === "City 2" ||
        (g2 === "and" ? a && t : a || t)) &&
      row.name.includes("1")
    );
  }).length;

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
  locale: "en-US",
});
const page = await context.newPage();
const errors = [];
const watch = (p, name) =>
  p.on("pageerror", (e) => errors.push(`${name}: ${e.message.slice(0, 300)}`));
watch(page, "builder");
const results = { rows: ROWS, expected: { and: expectedCount("and"), or: expectedCount("or") } };

try {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type(`adr320 hc6 ${ROWS}`);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
    timeout: 30000,
  });
  await page.waitForTimeout(1500);

  // ── 데이터 + Table (열 6 · 연결 · 정렬 가능 · 가상 스크롤) ──
  const setup = await page.evaluate(
    ({ REMOTE_BASE, COLUMNS }) => {
      const h = window.__COMPOSITION_CATALOG__;
      const ws = h.workspace;
      const root = ws.root;
      const g = root.runtime.graph;
      const C = h.commands;
      const set = (value) => ({ kind: "set", value });
      ws.execute(
        C.setDataEntries({
          puts: [
            {
              kind: "collection",
              id: "data:collection:grid",
              name: "Grid",
              schema: [
                { id: "f-id", key: "id", type: "string" },
                ...COLUMNS.map((c) => ({ id: `f-${c.key}`, key: c.key, type: c.type })),
              ],
              mockData: [],
              useMockData: false,
            },
            {
              kind: "endpoint",
              id: "data:endpoint:grid",
              name: "listGrid",
              method: "GET",
              baseUrl: REMOTE_BASE,
              path: "/grid",
              headers: [],
              queryParams: [
                { key: "page", value: "{{ cursor }}", type: "string", required: false },
              ],
              bodyType: "none",
              responseMapping: { dataPath: "items", cursorPath: "next" },
              targetCollectionId: "data:collection:grid",
              executionMode: "client",
            },
          ],
          label: "grid data",
        }),
      );
      const body = g.getEntry(ws.session.getSnapshot().pageId).children[0];
      const id = "project:node:dg-table";
      ws.execute(
        C.insertNodes({
          parent: { kind: "node", id: body },
          entries: [
            {
              kind: "node",
              id,
              definitionId: h.palette.catalogPaletteDefinitionId(g.library, "Table"),
              children: [],
              props: {},
              visual: {},
              sizing: { width: set(900), height: set(500) },
              descendantOverrides: [],
            },
          ],
          rootIds: [id],
          newId: ws.newId,
        }),
      );
      const table = () => [...root.canvasInputs.values()].find((r) => r.sourceId === id);
      const all = (rec, type) => {
        const out = [];
        const stack = [rec];
        while (stack.length) {
          const r = stack.shift();
          for (const child of r.children ?? []) {
            const c = root.canvasInputs.get(child);
            if (!c) continue;
            if (root.typeOf(c) === type) out.push(c);
            stack.push(c);
          }
        }
        return out;
      };
      const owned = (rec) => rec?.sourceId?.split("#row:")[0];
      const header = owned(all(table(), "TableHeader")[0]);
      const columnEntry = g.getEntry(owned(all(table(), "Column")[0]));
      const templatePath = (target) => {
        const path = [target];
        for (let guard = 0; guard < 8; guard++) {
          const parent = [...g.library.templates.entries()].find(([, t]) =>
            (t.children ?? []).includes(path[0]),
          );
          if (!parent) break;
          path.unshift(parent[0]);
        }
        return path;
      };
      const headerParent = g.getEntry(header)
        ? { kind: "node", id: header }
        : {
            kind: "descendant",
            ownerId: id,
            address: { instances: [id], templatePath: templatePath(header) },
          };
      const node = (definitionId) => ({
        kind: "node",
        id: ws.newId("node"),
        definitionId,
        children: [],
        props: {},
        visual: {},
        sizing: {},
        descendantOverrides: [],
      });
      ws.execute(
        C.insertTableColumns({
          header: headerParent,
          columns: COLUMNS.map((c) => ({ key: c.key, label: c.label })),
          replace: true,
          buildColumn: () => {
            const entry = node(columnEntry.definitionId);
            return { entries: [entry], rootId: entry.id };
          },
          buildCell: () => {
            const entry = node(h.palette.catalogPaletteDefinitionId(g.library, "Cell"));
            return { entries: [entry], rootId: entry.id };
          },
          newId: ws.newId,
        }),
      );
      ws.execute(
        h.binding.catalogBindingCommand(
          [{ kind: "node", id }],
          h.binding.catalogBindingRef({ source: "dataTable", collectionId: "grid", name: "Grid" }),
        ),
      );
      ws.execute(
        C.setFields({
          targets: all(table(), "Column")
            .map(owned)
            .filter((x) => x && g.getEntry(x))
            .map((x) => ({ kind: "node", id: x })),
          props: { allowsSorting: set(true) },
          label: "sortable",
        }),
      );
      ws.execute(h.rowDisplay.setRowDisplay(id, { mode: "virtual" }));
      ws.selectRecords([ws.recordsOfNode(id)[0]]);
      return { columns: all(table(), "Column").length };
    },
    { REMOTE_BASE, COLUMNS },
  );
  log(`setup ${JSON.stringify(setup)}`);
  await page.waitForTimeout(1500);

  // ── 「Add filter bar」 (the product step) → its start = TREE ──
  const rail = railButton(page, "properties");
  if ((await rail.getAttribute("aria-pressed")) !== "true") {
    await rail.click();
    await page.waitForTimeout(900);
  }
  const add = page.getByRole("button", { name: /^add filter bar$/i }).first();
  await add.waitFor({ state: "visible", timeout: 15000 });
  await add.click();
  await page.waitForTimeout(1200);
  await page.evaluate((TREE) => {
    const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
    const r = ws.root;
    const bar = [...r.canvasInputs.values()].find((x) => r.typeOf(x) === "FilterBar");
    ws.execute(
      c.setFields({
        targets: [{ kind: "node", id: bar.sourceId }],
        props: { defaultQuery: { kind: "set", value: TREE } },
      }),
    );
    ws.selectItems([]);
  }, TREE);
  await page.waitForTimeout(1000);

  // ── Publish ──
  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => ["Preview", "미리보기"].includes(b.getAttribute("aria-label")))
      ?.click(),
  );
  const pub = await popup;
  watch(pub, "publish");
  await pub.bringToFront();
  await pub.waitForURL((url) => String(url) !== "about:blank", { timeout: 30000 });
  const OURS = '[data-catalog-id*="dg-table"]';
  await pub.waitForFunction(
    (OURS) =>
      [...document.querySelectorAll(`${OURS} [role=row]`)].some((row) =>
        /Person \d+/.test(row.textContent ?? ""),
      ),
    OURS,
    { timeout: 180000 },
  );
  await pub.waitForTimeout(1500);
  const rowCount = () =>
    pub.evaluate((OURS) => {
      const table = document.querySelector(OURS);
      const grid = table.matches("[role=grid]") ? table : table.querySelector("[role=grid]");
      return Number(grid?.getAttribute("aria-rowcount") ?? 0) - 1;
    }, OURS);
  results.start = await rowCount();
  log(`start rows ${results.start} (expected and ${results.expected.and})`);

  await pub.evaluate(() => {
    window.__events = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries())
        if (entry.interactionId)
          window.__events.push({ id: entry.interactionId, duration: entry.duration });
    }).observe({ type: "event", durationThreshold: 16, buffered: false });
  });
  const durations = async () => {
    const events = await pub.evaluate(() => window.__events);
    const byId = new Map();
    for (const event of events)
      byId.set(event.id, Math.max(byId.get(event.id) ?? 0, event.duration));
    return [...byId.values()];
  };
  const cdp = await context.newCDPSession(pub);

  /** A — the level-2 group's switch, CLICKS times (and → or → and …). */
  const armA = async (rate) => {
    await pub.getByRole("button", { name: "Edit conditions" }).click();
    await pub.waitForSelector('[role="treegrid"]', { timeout: 15000 });
    await pub.waitForTimeout(rate === 4 ? 2500 : 1200);
    await pub.evaluate(() => (window.__events = []));
    const counts = [];
    for (let i = 0; i < CLICKS; i += 1) {
      const row = pub.locator('[role="treegrid"] [role="row"][aria-level="2"][aria-expanded]');
      const now = (await row.getAttribute("aria-label")).endsWith("And") ? "And" : "Or";
      await row.getByRole("button", { name: now, exact: true }).click();
      await pub.waitForTimeout(rate === 4 ? 1500 : 700);
      counts.push({ op: now === "And" ? "or" : "and", rows: await rowCount() });
    }
    const values = await durations();
    await pub.keyboard.press("Escape");
    await pub.waitForTimeout(800);
    return { values, counts };
  };
  /** B — the Amount header's sort click, CLICKS times. */
  const armB = async (rate) => {
    await pub.waitForTimeout(rate === 4 ? 1500 : 700);
    await pub.evaluate(() => (window.__events = []));
    const header = pub
      .locator(`${OURS} [role=columnheader]`)
      .filter({ hasText: /^Amount/ })
      .first();
    for (let i = 0; i < CLICKS; i += 1) {
      await header.click({ position: { x: 20, y: 10 } });
      await pub.waitForTimeout(rate === 4 ? 1500 : 700);
    }
    return { values: await durations() };
  };

  const pct = (values, p) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
  };
  results.runs = {};
  for (const rate of [1, 4]) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    const A = [];
    const B = [];
    const counts = [];
    for (const order of [["A", "B"], ["B", "A"], ["A", "B"]])
      for (const arm of order) {
        if (arm === "A") {
          const run = await armA(rate);
          A.push(run.values);
          counts.push(...run.counts);
        } else B.push((await armB(rate)).values);
      }
    const flat = (lists) => lists.flat();
    results.runs[`${rate}x`] = {
      A: { perRound: A, median: pct(flat(A), 50), p95: pct(flat(A), 95), n: flat(A).length },
      B: { perRound: B, median: pct(flat(B), 50), p95: pct(flat(B), 95), n: flat(B).length },
      correct: counts.every(({ op, rows }) => rows === results.expected[op]),
      counts: counts.slice(0, 4),
    };
    log(`${rate}x ${JSON.stringify(results.runs[`${rate}x`])}`);
  }
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await pub.screenshot({ path: `${OUT}/hc6.png` });
} catch (error) {
  results.error = String(error?.stack ?? error).slice(0, 1500);
  log(`error ${results.error}`);
} finally {
  results.errors = errors;
  writeFileSync(`${OUT}/hc6.json`, JSON.stringify(results, null, 2));
  log(`errors ${JSON.stringify(errors)}`);
  await browser.close();
  server.close();
  dist.close?.();
}

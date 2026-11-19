#!/usr/bin/env node
// 데이터 그리드 성능 비교 — 현재 Table (catalog · RAC Table + Virtualizer) vs 순수 RAC Table vs
// TanStack Table + TanStack Virtual. headed Chrome · production 빌드 · 같은 Publish 문서.
//
// 새 프로젝트에 원격 collection (이 스크립트의 127.0.0.1 서버 — N 행을 한 번에) 과 가상 스크롤
// Table (900 × 500 · 열 6 · 모든 열 정렬 가능) 을 두고 Publish 를 연다. 같은 문서에 대조군 둘
// (`datagridBaselines.mjs`) 을 같은 행 · 열 · 상자 · 행 높이로 올린 뒤 팔마다 (다른 팔은
// `display: none`) 잰다:
//   mount    대조군 둘의 render → 첫 행 + 1 frame (우리 Table 은 페이지 로드와 섞여 재지 않는다)
//   dom      DOM 의 행 수 · 요소 수
//   scroll   한 frame 에 120px 씩 600 frame (또는 끝까지) — rAF 간격 p50 · p95 · p99 와 그 구간의
//            main thread 일 (CDP `Performance.getMetrics` Task · Script · Layout · RecalcStyle ÷ frame)
//   sort     머리글 클릭 (숫자 열 · 글자 열, 6 회) → 첫 행이 바뀐 다음 frame 까지 ms
// CPU 1x · 4x, 팔 순서를 돌려 3 회 — 중앙값.
//
//   pnpm perf:build-dist
//   node apps/builder/scripts/datagrid-table-vs-tanstack-live.mjs <out-dir> \
//     --serve-dist /private/tmp/perf-baseline-dist [--rows 1000]
//
// Q1 합성 행 (seed 고정 · 섞인 순서) — 규모 전용. Q2 불리한 경우 = 빠른 스크롤 (frame 마다 보이는
// 행 3 ~ 4 개 교체) · 글자 열 정렬 · 4x. Q3 대조군 = 같은 문서의 두 팔. Q5 판정값은 브라우저의 rAF ·
// CDP 계측 (시스템 자신의 계측 아님).
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { createFrameResolver, serveHarnessDist } from "./perfDist.mjs";

const OUT = process.argv[2] ?? "/private/tmp/datagrid-perf";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const arg = (name, fallback) => {
  const at = process.argv.indexOf(name);
  return at > 0 ? process.argv[at + 1] : fallback;
};
const distDir = arg("--serve-dist", null);
if (!distDir)
  throw new Error("--serve-dist <dir> (pnpm perf:build-dist) 가 필요하다");
const ROWS = Number(arg("--rows", "1000"));
// `--baselines-only`: 우리 Table 없이 대조군 둘만 (우리 Table 이 그 행 수를 열지 못할 때) — 상자는
//   1,000 행 실행에서 잰 값. `--load-only`: Publish 가 첫 데이터 행을 그릴 때까지의 시간만.
const BASELINES = process.argv.includes("--baselines-only");
const LOAD_ONLY = process.argv.includes("--load-only");
const dist = await serveHarnessDist(distDir, 4192);
const BASE = dist.url;

const COLUMNS = [
  { key: "name", label: "Name", type: "string" },
  { key: "dept", label: "Dept", type: "string" },
  { key: "city", label: "City", type: "string" },
  { key: "amount", label: "Amount", type: "number" },
  { key: "qty", label: "Qty", type: "number" },
  { key: "date", label: "Date", type: "string" },
];
// (mulberry32 — 같은 행.)
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
const DATA = JSON.stringify({ items: makeRows(ROWS), next: null });

const requests = [];
const server = createServer((req, res) => {
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET, OPTIONS",
  };
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }
  requests.push(req.url);
  res.writeHead(200, { "content-type": "application/json", ...cors });
  res.end(DATA);
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const REMOTE_BASE = `http://127.0.0.1:${server.address().port}`;

// 대조군 모듈 — dist 옆에 lib build (매번: 원본이 바뀔 수 있다).
async function baselinesUrl() {
  const { build } = await import("vite");
  await build({
    configFile: false,
    logLevel: "warn",
    root: `${REPO}/apps/builder`,
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    resolve: {
      alias: {
        // (`@tanstack/react-table` 은 packages/shared 의 의존성 — builder 에서는 보이지 않는다.)
        "@tanstack/react-table": `${REPO}/packages/shared/node_modules/@tanstack/react-table`,
      },
    },
    build: {
      lib: {
        entry: `${REPO}/apps/builder/scripts/datagridBaselines.mjs`,
        formats: ["es"],
        fileName: () => "dg-baselines.js",
      },
      outDir: distDir,
      emptyOutDir: false,
      minify: true,
    },
  });
  return `${BASE}/dg-baselines.js?t=${Date.now()}`;
}

const results = { rows: ROWS, columns: COLUMNS.length, notes: [] };
const log = (line) => process.stdout.write(`${line}\n`);

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const page = await context.newPage();
const errors = [];
const watch = (p, name) => {
  p.on("pageerror", (e) =>
    errors.push(`${name} pageerror: ${e.message.slice(0, 300)}`),
  );
  p.on("console", (m) => {
    if (m.type() === "error" && !/favicon\.ico/.test(m.location()?.url ?? ""))
      errors.push(`${name} console: ${m.text().slice(0, 300)}`);
  });
};
watch(page, "builder");

try {
  let pub;
  let box;
  if (BASELINES) {
    pub = page;
    await pub.goto(`${BASE}/perf-build.json`);
    box = {
      width: 900,
      height: 500,
      rowHeight: 43,
      headHeight: 32,
      font: "normal 400 14px/18px Pretendard, ui-sans-serif, system-ui, sans-serif",
      cell: {
        paddingLeft: "16px",
        paddingRight: "16px",
        boxSizing: "border-box",
        overflow: "hidden",
        whiteSpace: "nowrap",
      },
    };
  } else {
    // ── 새 프로젝트 ──
    await page.goto(`${BASE}/dashboard`);
    await page
      .getByRole("button", { name: /new project/i })
      .first()
      .click();
    await page.waitForTimeout(300);
    await page.keyboard.type(`datagrid perf ${ROWS}`);
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/builder\//, { timeout: 30000 });
    await page.waitForSelector(".app:not(.builder-booting)", {
      timeout: 30000,
    });
    await page.waitForFunction(
      () => window.__COMPOSITION_CATALOG__?.workspace,
      null,
      { timeout: 30000 },
    );
    await page.waitForTimeout(1500);

    // ── 데이터 + Table ──
    await page.evaluate(
      ({ REMOTE_BASE, COLUMNS }) => {
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
                id: "data:collection:grid",
                name: "Grid",
                schema: [
                  { id: "f-id", key: "id", type: "string" },
                  ...COLUMNS.map((c) => ({
                    id: `f-${c.key}`,
                    key: c.key,
                    type: c.type,
                  })),
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
                // (Preview 세션은 cursor 를 읽는 endpoint 만 스스로 불러온다 — 한 쪽에 전부, `next: null`.)
                queryParams: [
                  {
                    key: "page",
                    value: "{{ cursor }}",
                    type: "string",
                    required: false,
                  },
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
        const snap = ws.session.getSnapshot();
        const body = g.getEntry(snap.pageId).children[0];
        const id = "project:node:dg-table";
        ws.execute(
          C.insertNodes({
            parent: { kind: "node", id: body },
            entries: [
              {
                kind: "node",
                id,
                definitionId: h.palette.catalogPaletteDefinitionId(
                  g.library,
                  "Table",
                ),
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
      },
      { REMOTE_BASE, COLUMNS },
    );
    await page.waitForTimeout(2000);

    // ── 열 6 (starter 열 교체) → 연결 → 정렬 가능 → 가상 스크롤 ──
    const setup = await page.evaluate(
      ({ COLUMNS }) => {
        const h = window.__COMPOSITION_CATALOG__;
        const ws = h.workspace;
        const root = ws.root;
        const g = root.runtime.graph;
        const C = h.commands;
        const set = (value) => ({ kind: "set", value });
        const id = "project:node:dg-table";
        const table = () =>
          [...root.canvasInputs.values()].find((r) => r.sourceId === id);
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
        const out = { steps: [] };
        const step = (name, run) => {
          try {
            run();
            out.steps.push([name, "ok"]);
          } catch (error) {
            out.steps.push([
              name,
              String(error?.message ?? error).slice(0, 400),
            ]);
          }
        };
        const header = owned(all(table(), "TableHeader")[0]);
        const column = all(table(), "Column")[0];
        const columnEntry = g.getEntry(owned(column));
        // (놓은 Table 의 머리글은 원본 template 자리다 — 주소 = instance + template 루트부터의 경로.)
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
        out.header = headerParent;
        out.columnDefinition = columnEntry?.definitionId ?? null;
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
        step("columns", () =>
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
                const entry = node(
                  h.palette.catalogPaletteDefinitionId(g.library, "Cell"),
                );
                return { entries: [entry], rootId: entry.id };
              },
              newId: ws.newId,
            }),
          ),
        );
        step("bind", () =>
          ws.execute(
            h.binding.catalogBindingCommand(
              [{ kind: "node", id }],
              h.binding.catalogBindingRef({
                source: "dataTable",
                collectionId: "grid",
                name: "Grid",
              }),
            ),
          ),
        );
        step("sortable", () =>
          ws.execute(
            C.setFields({
              targets: all(table(), "Column")
                .map(owned)
                .filter((x) => x && g.getEntry(x))
                .map((x) => ({ kind: "node", id: x })),
              props: { allowsSorting: set(true) },
              label: "sortable",
            }),
          ),
        );
        step("virtual", () =>
          ws.execute(h.rowDisplay.setRowDisplay(id, { mode: "virtual" })),
        );
        const e = g.getEntry(id);
        out.rowDisplay = e.rowDisplay;
        out.binding = !!e.binding;
        out.columns = all(table(), "Column").map((c) => ({
          id: owned(c),
          props: g.getEntry(owned(c))?.props ?? null,
        }));
        return out;
      },
      { COLUMNS },
    );
    log(`setup ${JSON.stringify(setup).slice(0, 1500)}`);
    results.setup = setup;
    if (setup.steps.some(([, r]) => r !== "ok"))
      throw new Error("setup failed");
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/builder.png` });

    // ── Publish ──
    const loadStart = Date.now();
    const popup = context.waitForEvent("page", { timeout: 30000 });
    await page.evaluate(() =>
      [...document.querySelectorAll("button")]
        .find((b) =>
          ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
        )
        ?.click(),
    );
    pub = await popup;
    // (`--heap-profile`: 로드 동안 살아남은 할당을 함수별로 — CDP sampling heap profiler.)
    const heapCdp = process.argv.includes("--heap-profile")
      ? await context.newCDPSession(pub)
      : null;
    if (heapCdp) {
      await heapCdp.send("HeapProfiler.enable");
      await heapCdp.send("HeapProfiler.startSampling", {
        samplingInterval: 65536,
        // (수거된 객체까지 — 로드 중 임시 할당이 어디서 나는지.)
        includeObjectsCollectedByMajorGC: true,
        includeObjectsCollectedByMinorGC: true,
      });
    }
    results.heapCdp = !!heapCdp;
    globalThis.__heapCdp = heapCdp;
    watch(pub, "publish");
    await pub.bringToFront();
    await pub.waitForURL((url) => String(url) !== "about:blank", {
      timeout: 30000,
    });
    const OURS = '[data-catalog-id*="dg-table"]';
    try {
      await pub.waitForFunction(
        (OURS) =>
          [...document.querySelectorAll(`${OURS} [role=row]`)].some((row) =>
            /Person \d+/.test(row.textContent ?? ""),
          ),
        OURS,
        { timeout: 180000 },
      );
    } catch (error) {
      results.loadFailed = `${Math.round((Date.now() - loadStart) / 1000)} s: ${String(
        error?.message ?? error,
      )
        .split("\n")[0]
        .slice(0, 160)}`;
      await pub
        .screenshot({ path: `${OUT}/publish-timeout.png` })
        .catch((e) => {
          results.loadFailed += ` · ${String(e?.message ?? e)
            .split("\n")[0]
            .slice(0, 80)}`;
        });
      throw new Error(
        `Publish 에 데이터 행이 없다: ${await pub.evaluate(() => document.body.innerText.slice(0, 300))}`,
      );
    }
    results.loadMs = Date.now() - loadStart;
    results.heapMB = await pub.evaluate(() =>
      Math.round((performance.memory?.usedJSHeapSize ?? 0) / 1e6),
    );
    log(
      `load (Preview 클릭 → 첫 데이터 행) ${results.loadMs} ms · heap ${results.heapMB} MB`,
    );
    await pub.waitForTimeout(3000);
    if (globalThis.__heapCdp) {
      const cdp = globalThis.__heapCdp;
      await cdp.send("HeapProfiler.collectGarbage");
      const { profile } = await cdp.send("HeapProfiler.stopSampling");
      const resolve = createFrameResolver(distDir);
      const label = (f) =>
        resolve(`${f.functionName || "(anon)"} ${f.url}:${f.lineNumber + 1}`);
      const self = new Map();
      const inclusive = new Map();
      let total = 0;
      const walk = (node, stack) => {
        const name = label(node.callFrame);
        const here = [...stack, name];
        if (node.selfSize) {
          total += node.selfSize;
          self.set(name, (self.get(name) ?? 0) + node.selfSize);
          for (const n of new Set(here))
            inclusive.set(n, (inclusive.get(n) ?? 0) + node.selfSize);
        }
        for (const child of node.children ?? []) walk(child, here);
      };
      walk(profile.head, []);
      const top = (m, filter, k) =>
        [...m]
          .filter(([n]) => filter(n))
          .sort((a, b) => b[1] - a[1])
          .slice(0, k)
          .map(([n, v]) => `${(v / 1e6).toFixed(1).padStart(8)} MB  ${n}`);
      writeFileSync(
        `${OUT}/heap-profile.txt`,
        `sampled (collected included) ${(total / 1e6).toFixed(1)} MB\n--- self\n${top(self, () => true, 40).join("\n")}\n--- inclusive (src/)\n${top(inclusive, (n) => / src\//.test(n), 60).join("\n")}\n`,
      );
      log(`heap profile → ${OUT}/heap-profile.txt`);
    }

    // ── 우리 Table 의 상자 (대조군이 같은 값으로 그린다) ──
    box = await pub.evaluate((OURS) => {
      const table = document.querySelector(OURS);
      const scroller = [table, ...table.querySelectorAll("*")].find((el) => {
        const s = getComputedStyle(el);
        return (
          /auto|scroll/.test(s.overflowY) &&
          el.scrollHeight > el.clientHeight + 1
        );
      });
      table.setAttribute("data-dg-arm", "ours");
      scroller?.setAttribute("data-dg-scroll", "ours");
      const rows = [...table.querySelectorAll("[role=row]")];
      const head = rows.find((r) => r.querySelector("[role=columnheader]"));
      const data = rows.find((r) => !r.querySelector("[role=columnheader]"));
      const cell = data.querySelector("[role=gridcell], [role=rowheader]");
      const cs = getComputedStyle(cell);
      const rect = table.getBoundingClientRect();
      return {
        tag: table.tagName,
        scrollerIsTable: scroller === table,
        scrollHeight: scroller?.scrollHeight ?? null,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        rowHeight: Math.round(data.getBoundingClientRect().height * 100) / 100,
        // (머리글 행은 상자가 없을 수 있다 — 칸 높이로.)
        headHeight:
          Math.round(
            head.querySelector("[role=columnheader]").getBoundingClientRect()
              .height * 100,
          ) / 100,
        font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize}/${cs.lineHeight} ${cs.fontFamily}`,
        cell: {
          paddingLeft: cs.paddingLeft,
          paddingRight: cs.paddingRight,
          boxSizing: "border-box",
          overflow: "hidden",
          whiteSpace: "nowrap",
        },
      };
    }, OURS);
    log(`ours box ${JSON.stringify(box)}`);
    results.box = box;
    if (!box.scrollHeight)
      throw new Error("우리 Table 의 스크롤 상자를 찾지 못했다");
    if (LOAD_ONLY) throw new Error("load only");
  }

  // ── 대조군 둘 ──
  const src = await baselinesUrl();
  results.mount = await pub.evaluate(
    async ({ src, url, COLUMNS, box }) => {
      const m = await import(src);
      const { items } = await (await fetch(url)).json();
      const out = {};
      for (const kind of ["rac", "tanstack"]) {
        out[kind] =
          Math.round((await m.mount(kind, items, COLUMNS, box)) * 10) / 10;
        await new Promise((r) => setTimeout(r, 800));
      }
      return out;
    },
    { src, url: `${REMOTE_BASE}/grid`, COLUMNS, box },
  );
  log(`mount (render → 첫 행 + 1 frame, ms) ${JSON.stringify(results.mount)}`);

  // (Builder 탭의 Canvas · 패널 일이 같은 renderer 에 섞이지 않게 비운다.)
  if (!BASELINES) await page.goto("about:blank").catch(() => {});
  await pub.bringToFront();
  results.visibility = await pub.evaluate(() => document.visibilityState);

  const ARMS = {
    ours: {
      hide: '[data-dg-arm="ours"]',
      scroll: '[data-dg-scroll="ours"]',
      rows: '[data-dg-arm="ours"] [role=row]',
      heads: '[data-dg-arm="ours"] [role=columnheader]',
    },
    rac: {
      hide: "#dg-host-rac",
      scroll: "#dg-rac",
      rows: "#dg-rac [role=row]",
      heads: "#dg-rac [role=columnheader]",
    },
    tanstack: {
      hide: "#dg-host-tanstack",
      scroll: "#dg-tanstack",
      rows: "#dg-tanstack tbody tr",
      heads: "#dg-tanstack th",
    },
  };
  const show = (arm) =>
    pub.evaluate(
      async ({ arm, ARMS }) => {
        document.getElementById("dg-hide")?.remove();
        const hide = document.createElement("style");
        hide.id = "dg-hide";
        hide.textContent = Object.entries(ARMS)
          .filter(([key]) => key !== arm)
          .map(([, a]) => `${a.hide} { display: none !important; }`)
          .join("\n");
        document.head.appendChild(hide);
        await new Promise((r) => setTimeout(r, 400));
        const list = document.querySelector(ARMS[arm].scroll);
        list.scrollTop = 0;
        await new Promise((r) => setTimeout(r, 400));
      },
      { arm, ARMS },
    );
  const cdp = await context.newCDPSession(pub);
  await cdp.send("Performance.enable");
  const metrics = async () => {
    const { metrics } = await cdp.send("Performance.getMetrics");
    const get = (name) => metrics.find((m) => m.name === name)?.value ?? 0;
    return {
      task: get("TaskDuration"),
      script: get("ScriptDuration"),
      layout: get("LayoutDuration"),
      style: get("RecalcStyleDuration"),
    };
  };
  const delta = (a, b, per) =>
    Object.fromEntries(
      Object.keys(a).map((k) => [
        k,
        Math.round(((b[k] - a[k]) * 1000 * 100) / per) / 100,
      ]),
    );

  if (BASELINES) delete ARMS.ours;
  // ── dom ──
  results.dom = {};
  for (const arm of Object.keys(ARMS)) {
    await show(arm);
    results.dom[arm] = await pub.evaluate(
      ({ a }) => ({
        rows: document.querySelectorAll(a.rows).length,
        elements: document.querySelector(a.hide).querySelectorAll("*").length,
        scrollHeight: document.querySelector(a.scroll).scrollHeight,
      }),
      { a: ARMS[arm] },
    );
  }
  log(`dom ${JSON.stringify(results.dom)}`);

  const sweep = async (arm) => {
    await show(arm);
    const before = await metrics();
    const frames = await pub.evaluate(
      async ({ a }) => {
        const list = document.querySelector(a.scroll);
        const maxNow = () => list.scrollHeight - list.clientHeight;
        const gaps = [];
        let pendingFrames = 0;
        let maxRows = 0;
        let prev = performance.now();
        await new Promise((resolve) => {
          const tick = (now) => {
            gaps.push(now - prev);
            prev = now;
            // (행 창: 내용 없이 그려진 행 — 창이 보이는 행을 따라오지 못한 frame.)
            const blank = list.querySelectorAll("[data-row-pending]").length;
            if (blank) pendingFrames += 1;
            if (list.scrollTop >= maxNow() - 1 || gaps.length > 600)
              return resolve();
            list.scrollTop = Math.min(maxNow(), list.scrollTop + 120);
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        maxRows = document.querySelectorAll(a.rows).length;
        gaps.shift();
        const sorted = [...gaps].sort((x, y) => x - y);
        const q = (p) =>
          Math.round(
            sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] *
              10,
          ) / 10;
        const refresh = sorted[Math.floor(sorted.length * 0.1)];
        return {
          frames: gaps.length,
          p50: q(0.5),
          p95: q(0.95),
          p99: q(0.99),
          dropped:
            Math.round(
              (gaps.filter((g) => g > refresh * 1.5).length / gaps.length) *
                1000,
            ) / 10,
          scrolledTo: Math.round(list.scrollTop),
          scrollHeight: list.scrollHeight,
          pendingFrames,
          // (행 높이 — 추정과 측정이 다르면 뒤 행이 전부 다시 배치된다.)
          rowHeights: [
            ...new Set(
              [...document.querySelectorAll(a.rows)].map(
                (row) =>
                  Math.round(row.getBoundingClientRect().height * 100) / 100,
              ),
            ),
          ],
          rowsInDom: maxRows,
        };
      },
      { a: ARMS[arm] },
    );
    const after = await metrics();
    return { ...frames, perFrame: delta(before, after, frames.frames) };
  };

  const sortOnce = async (arm, label) => {
    const a = ARMS[arm];
    const at = await pub.evaluate(
      ({ a, label }) => {
        const head = [...document.querySelectorAll(a.heads)].find((el) =>
          (el.textContent ?? "").trim().startsWith(label),
        );
        if (!head) return null;
        const r = head.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      },
      { a, label },
    );
    if (!at) return null;
    const probe = pub.evaluate(
      ({ a }) =>
        new Promise((resolve) => {
          const first = () => {
            let best = null;
            let top = Infinity;
            for (const row of document.querySelectorAll(a.rows)) {
              if (row.querySelector("[role=columnheader], th")) continue;
              const y = row.getBoundingClientRect().top;
              if (y < top) {
                top = y;
                best = row;
              }
            }
            return best?.textContent ?? "";
          };
          const before = first();
          let t0 = 0;
          document.addEventListener(
            "pointerdown",
            () => {
              t0 = performance.now();
            },
            { capture: true, once: true },
          );
          const started = performance.now();
          const tick = () => {
            if (t0 && first() !== before)
              return requestAnimationFrame(() =>
                resolve(Math.round((performance.now() - t0) * 10) / 10),
              );
            if (performance.now() - started > 120000) return resolve(null);
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        }),
      { a },
    );
    await pub.waitForTimeout(100);
    await pub.mouse.click(at.x, at.y);
    return probe;
  };
  const sortArm = async (arm, clicks) => {
    await show(arm);
    const out = {};
    for (const label of ["Amount", "Name"]) {
      const before = await metrics();
      const times = [];
      for (let i = 0; i < clicks; i++) {
        times.push(await sortOnce(arm, label));
        await pub.waitForTimeout(300);
      }
      const after = await metrics();
      const ok = times.filter((t) => t != null).sort((x, y) => x - y);
      out[label] = {
        times,
        median: ok.length ? ok[Math.floor(ok.length / 2)] : null,
        taskPerClick: delta(before, after, clicks).task,
      };
    }
    return out;
  };

  const median = (list, pick) => {
    const s = list.map(pick).sort((x, y) => x - y);
    return s[Math.floor(s.length / 2)];
  };
  // (`--profile-sort` · `--profile-scroll`: 우리 Table 의 정렬 클릭 한 번 · 스크롤 한 번의 CPU profile
  //  — self · inclusive 상위 함수.)
  const profiled = async (file, run, marker) => {
    await cdp.send("Profiler.enable");
    await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
    await cdp.send("Profiler.start");
    const title = await run();
    const { profile } = await cdp.send("Profiler.stop");
    const resolve = createFrameResolver(distDir);
    const parent = new Map();
    for (const n of profile.nodes)
      for (const c of n.children ?? []) parent.set(c, n.id);
    const label = (n) =>
      resolve(
        `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url}:${n.callFrame.lineNumber + 1}`,
      );
    const names = new Map(profile.nodes.map((n) => [n.id, label(n)]));
    const self = new Map();
    const inclusive = new Map();
    let total = 0;
    profile.samples.forEach((id, i) => {
      const dt = (profile.timeDeltas[i] ?? 0) / 1000;
      const name = names.get(id);
      if (/^\((idle|program)\)/.test(name)) return;
      total += dt;
      self.set(name, (self.get(name) ?? 0) + dt);
      const seen = new Set();
      for (let cur = id; cur != null; cur = parent.get(cur)) {
        const n = names.get(cur);
        if (seen.has(n)) continue;
        seen.add(n);
        inclusive.set(n, (inclusive.get(n) ?? 0) + dt);
      }
    });
    const top = (m, filter, k) =>
      [...m]
        .filter(([n]) => filter(n))
        .sort((a, b) => b[1] - a[1])
        .slice(0, k)
        .map(([n, v]) => `${v.toFixed(1).padStart(8)} ms  ${n}`);
    // (`marker` 를 실행한 task 만 — 쉬는 sample 로 끊긴 연속 구간 — 따로 모은다: 창 이동 한 번의 비용.)
    let marked = "";
    if (marker) {
      const bursts = [];
      let burst = null;
      profile.samples.forEach((id, i) => {
        const dt = (profile.timeDeltas[i] ?? 0) / 1000;
        const name = names.get(id);
        if (/^\((idle|program)\)/.test(name)) {
          burst = null;
          return;
        }
        if (!burst)
          bursts.push((burst = { ms: 0, hit: false, inc: new Map() }));
        burst.ms += dt;
        const seen = new Set();
        for (let cur = id; cur != null; cur = parent.get(cur)) {
          const n = names.get(cur);
          if (seen.has(n)) continue;
          seen.add(n);
          if (n.startsWith(marker)) burst.hit = true;
          burst.inc.set(n, (burst.inc.get(n) ?? 0) + dt);
        }
      });
      const hits = bursts.filter((b) => b.hit).sort((a, b) => a.ms - b.ms);
      const rest = bursts.filter((b) => !b.hit).sort((a, b) => a.ms - b.ms);
      // (무거운 쪽 1/3 만 합친다 — 긴 frame 을 만드는 task.)
      const heavy = hits.slice(Math.floor((hits.length * 2) / 3));
      const sum = new Map();
      for (const b of heavy)
        for (const [n, v] of b.inc) sum.set(n, (sum.get(n) ?? 0) + v);
      const mid = (list) =>
        list.length ? list[Math.floor(list.length / 2)].ms.toFixed(1) : "-";
      marked = `--- tasks with ${marker}: ${hits.length} · median ${mid(hits)} ms · max ${hits.at(-1)?.ms.toFixed(1)} ms · total ${hits.reduce((a, b) => a + b.ms, 0).toFixed(1)} ms | other tasks ${rest.length} · median ${mid(rest)} ms · max ${rest.at(-1)?.ms.toFixed(1)} ms\n    each: ${hits.map((b) => b.ms.toFixed(0)).join(" ")}\n--- the heaviest third (${heavy.length} tasks, ${heavy.reduce((a, b) => a + b.ms, 0).toFixed(1)} ms)\n${top(sum, (n) => / (src|nm)\//.test(n), 70).join("\n")}\n`;
    }
    writeFileSync(
      `${OUT}/${file}`,
      `${title} · sampled ${total.toFixed(1)} ms\n${marked}--- self\n${top(self, () => true, 45).join("\n")}\n--- inclusive (src/ · nm/)\n${top(inclusive, (n) => / (src|nm)\//.test(n), 90).join("\n")}\n`,
    );
    log(`profile → ${OUT}/${file}`);
  };
  if (process.argv.includes("--profile-sort")) {
    await show("ours");
    await sortOnce("ours", "Amount");
    await pub.waitForTimeout(500);
    await profiled(
      "sort-profile.txt",
      async () => `sort click ${await sortOnce("ours", "Amount")} ms`,
    );
    throw new Error("load only");
  }
  if (process.argv.includes("--profile-scroll")) {
    await sweep("ours");
    await pub.evaluate(
      ({ a }) => (document.querySelector(a.scroll).scrollTop = 0),
      { a: ARMS.ours },
    );
    await pub.waitForTimeout(500);
    await profiled(
      "scroll-profile.txt",
      async () => {
        const run = await sweep("ours");
        return `scroll ${run.frames} frames p50 ${run.p50} p95 ${run.p95} task/frame ${run.perFrame.task} · scrollHeight ${run.scrollHeight} · frames with a blank row ${run.pendingFrames} · row heights ${run.rowHeights.join(",")}`;
      },
      "moveRowWindow ",
    );
    throw new Error("load only");
  }
  results.scroll = {};
  results.sort = {};
  const names = Object.keys(ARMS);
  for (const rate of [1, 4]) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    const runs = Object.fromEntries(names.map((n) => [n, []]));
    for (let i = 0; i < 3; i++) {
      // (팔 순서를 돌린다 — 먼저 잰 팔만 유리하거나 불리하지 않게.)
      const order = names.map((_, k) => names[(k + i) % names.length]);
      for (const arm of order) runs[arm].push(await sweep(arm));
      log(
        `scroll cpu${rate}x #${i + 1} ${names
          .map(
            (arm) =>
              `${arm} p50 ${runs[arm].at(-1).p50} p95 ${runs[arm].at(-1).p95} task/frame ${runs[arm].at(-1).perFrame.task}`,
          )
          .join(" | ")}`,
      );
    }
    results.scroll[`cpu${rate}x`] = Object.fromEntries(
      names.map((arm) => [
        arm,
        {
          frames: runs[arm][0].frames,
          p50: median(runs[arm], (r) => r.p50),
          p95: median(runs[arm], (r) => r.p95),
          p99: median(runs[arm], (r) => r.p99),
          dropped: median(runs[arm], (r) => r.dropped),
          taskPerFrame: median(runs[arm], (r) => r.perFrame.task),
          scriptPerFrame: median(runs[arm], (r) => r.perFrame.script),
          layoutPerFrame: median(runs[arm], (r) => r.perFrame.layout),
          stylePerFrame: median(runs[arm], (r) => r.perFrame.style),
          rowsInDom: runs[arm][0].rowsInDom,
          runs: runs[arm],
        },
      ]),
    );
    results.sort[`cpu${rate}x`] = {};
    for (const arm of names) {
      // (4x 는 클릭 3 회 — 큰 행 수에서 한 번이 수십 초일 수 있다.)
      results.sort[`cpu${rate}x`][arm] = await sortArm(arm, rate === 4 ? 3 : 6);
      log(
        `sort cpu${rate}x ${arm} ${JSON.stringify(results.sort[`cpu${rate}x`][arm])}`,
      );
    }
  }
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  results.refreshMs = await pub.evaluate(
    () =>
      new Promise((resolve) => {
        const t = [];
        const tick = (now) => {
          t.push(now);
          if (t.length < 61) requestAnimationFrame(tick);
          else resolve(Math.round(((t[60] - t[0]) / 60) * 100) / 100);
        };
        requestAnimationFrame(tick);
      }),
  );
  if (!BASELINES) {
    await show("ours");
    await pub.screenshot({ path: `${OUT}/publish-ours.png` });
  }
  await show("tanstack");
  await pub.screenshot({ path: `${OUT}/publish-tanstack.png` });
  await show("rac");
  await pub.screenshot({ path: `${OUT}/publish-rac.png` });
} catch (error) {
  if (String(error?.message) !== "load only") {
    results.error = String(error?.stack ?? error).slice(0, 1500);
    log(`FAIL ${results.error}`);
  }
} finally {
  results.errors = errors.slice(0, 12);
  results.requests = requests;
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  log(
    `\n→ ${OUT}/results.json${errors.length ? ` · 콘솔 오류 ${errors.length}` : ""}`,
  );
  await browser.close();
  server.close();
  await dist.close();
  process.exitCode = results.error ? 1 : 0;
}

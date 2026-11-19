#!/usr/bin/env node
// ADR-310 Phase 8 · G8 — 가상 스크롤 목록의 browser 하니스 (headed Chrome, 실제 Builder + Publish).
//
// 새 프로젝트에 dev 핸들 (`__COMPOSITION_CATALOG__`) 로 1,000 행 mock collection 과 원격 collection
// (이 스크립트가 띄운 127.0.0.1 서버 — 100 행씩 3 쪽, cursor `next`) 을 두고, 목록 여섯을 넣는다:
//   vlist   ListBox 600 × 300 · 가상 스크롤 (세로)
//   hlist   ListBox 600 × 120 · flex row · 항목 폭 100 · 가상 스크롤 (가로)
//   table   Table 600 × 300 · 가상 스크롤 · 첫 열 = 선택 열 (Column · Row 템플릿 Cell 의 Checkbox[slot=selection])
//   cards   CardView 700 × 420 · 가상 스크롤 (grid — 사용자 결정 7)
//   more    ListBox 600 × 300 · 더 보기 (대조군)
//   remote  ListBox 600 × 300 · 가상 스크롤 · 원격 collection
// Publish (Preview 버튼의 `window.open` 주소) 에서 G8 을 잰다:
//   ① 1,000 행 가상 목록의 DOM 행 수 ≤ 60
//   ② 같은 스크롤 위치 (0) 에서 보이는 행의 위치 · 크기 = Canvas 표본 행 (1px 안, 목록 기준
//      `getBoundingClientRect` ↔ Canvas record geometry 의 부모 사슬 합) — 세로 · 가로 · Table · grid
//   ③ 원격 목록의 끝에 닿으면 다음 쪽을 받는다 (요청 page 2 · 3, DOM 에 Person250)
//   ④ 키보드 End · ↑ · Space 가 RAC 그대로 (focus 행 · 스크롤 따라감 · aria-selected)
//   ⑧ 선택 Checkbox — 머리글 + 보이는 행마다 하나 (Row 템플릿 Cell 의 반복) · 라벨 글자 없음
//   ⑦ 터치 기기 (Preview `data-catalog-touch`) 의 Table 선택 열 = S2 52 · 머리글 = 본문 행 · 데스크톱 40
//   ⑤ frame — 1,000 행을 위에서 끝까지 같은 속도로 스크롤할 때 rAF 간격 p50 · p95 · p99:
//      가상 목록 vs 더 보기 목록 (1,000 행을 모두 불러온 뒤 — 더 보기의 불리한 상태), CPU 1x · 4x.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr310-g8-virtual-live.mjs <out-dir>
//   production (frame 판정은 이쪽 — dev React 는 렌더 비용이 몇 배다):
//     pnpm perf:build-dist && node apps/builder/scripts/adr310-g8-virtual-live.mjs <out-dir> \
//       --serve-dist /private/tmp/perf-baseline-dist
//   --profile: 4x 가상 목록 sweep 의 CPU profile 만 (self time 상위 함수)
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { createFrameResolver, serveHarnessDist } from "./perfDist.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr310-g8";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const distAt = process.argv.indexOf("--serve-dist");
const dist =
  distAt > 0 ? await serveHarnessDist(process.argv[distAt + 1], 4191) : null;
const BASE = dist?.url ?? process.env.BUILDER_URL ?? "http://localhost:5173";
// ⑤ 대조군 모듈 주소 — dev 는 Vite 가 원본 그대로, production 은 dist 옆에 lib build 한 번.
async function racBaselineUrl() {
  const source = `${REPO}/apps/builder/scripts/adr310VirtualBaseline.mjs`;
  if (!dist) return `/@fs${source}`;
  const distDir = process.argv[distAt + 1];
  if (!existsSync(`${distDir}/g8-racbase.js`)) {
    const { build } = await import("vite");
    await build({
      configFile: false,
      logLevel: "warn",
      root: `${REPO}/apps/builder`,
      define: { "process.env.NODE_ENV": JSON.stringify("production") },
      build: {
        lib: {
          entry: source,
          formats: ["es"],
          fileName: () => "g8-racbase.js",
        },
        outDir: distDir,
        emptyOutDir: false,
        minify: true,
      },
    });
  }
  return `${BASE}/g8-racbase.js`;
}
const ROWS = 1000;
// (대조군 — ⑥ 의 목록 둘 없이: 다른 목록이 스크롤 비용에 닿는지.)
const SKIP_PANEL = process.argv.includes("--no-panel");
const REMOTE_PAGES = 3;
const REMOTE_PAGE_SIZE = 100;
const REMOTE_ROWS = 250;

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1200)}\n`,
  );
};

// ── 원격 endpoint: GET /people?page=N → { items, next } (100 행씩, 250 행) ──
const remoteRequests = [];
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET, OPTIONS",
    });
    res.end();
    return;
  }
  remoteRequests.push(`${url.pathname}${url.search}`);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const start = (page - 1) * REMOTE_PAGE_SIZE;
  const items = [];
  for (let i = start; i < Math.min(start + REMOTE_PAGE_SIZE, REMOTE_ROWS); i++)
    items.push({ id: `r${i + 1}`, name: `Person${i + 1}` });
  res.writeHead(200, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
  });
  res.end(
    JSON.stringify({
      items,
      next: page < REMOTE_PAGES ? String(page + 1) : null,
    }),
  );
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const REMOTE_BASE = `http://127.0.0.1:${server.address().port}`;

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
if (process.argv.includes("--render-count"))
  // (dev 전용 진단 — React 가 붙는 DevTools hook 자리에서 commit 마다 다시 그린 fiber 를 이름별로 센다.)
  await context.addInitScript(() => {
    const nameOf = (f) => {
      const t = f.type;
      if (!t || typeof t === "string") return null;
      return (
        t.displayName ||
        t.name ||
        t.render?.displayName ||
        t.render?.name ||
        null
      );
    };
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      renderers: new Map(),
      supportsFiber: true,
      isDisabled: false,
      inject() {
        return 1;
      },
      checkDCE() {},
      onCommitFiberUnmount() {},
      onPostCommitFiberRoot() {},
      onCommitFiberRoot(_id, root) {
        const counts = window.__g8RenderCounts;
        if (!counts) return;
        counts.__commits = (counts.__commits ?? 0) + 1;
        // (React DevTools `didFiberRender` 방식 — 이번 commit 에 다시 맞춘 하위 트리만 걷는다: 자식이
        //  이전 트리와 같은 fiber 면 그 아래는 bail out.)
        const stack = [root.current];
        while (stack.length) {
          const f = stack.pop();
          const mounted = !f.alternate;
          if (mounted || f.flags & 1) {
            const n = nameOf(f);
            if (n)
              counts[mounted ? `+${n}` : n] =
                (counts[mounted ? `+${n}` : n] ?? 0) + 1;
          }
          if (f.sibling) stack.push(f.sibling);
          if (f.child && (mounted || f.child !== f.alternate.child))
            stack.push(f.child);
        }
      },
    };
  });
const page = await context.newPage();
const errors = [];
const watch = (p, name) => {
  p.on("pageerror", (e) =>
    errors.push(`${name} pageerror: ${e.message.slice(0, 300)}`),
  );
  p.on("crash", () => errors.push(`${name} crash`));
  p.on("close", () => process.stdout.write(`[${name} closed]\n`));
  p.on("response", (r) => {
    if (r.status() >= 400 && !r.url().endsWith("/favicon.ico"))
      errors.push(`${name} ${r.status()} ${r.url().slice(0, 200)}`);
  });
  p.on("console", (m) => {
    if (m.type() === "error" && !/favicon\.ico/.test(m.location()?.url ?? ""))
      errors.push(
        `${name} console: ${m.text().slice(0, 300)} @ ${m.location()?.url ?? ""}`,
      );
  });
};
watch(page, "builder");

try {
  // ── 새 프로젝트 ──
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("ADR-310 G8 virtual");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  // ── 데이터 · 목록 넣기 (명령 — 사용자 편집과 같은 workspace.execute) ──
  const setup = await page.evaluate(
    async ({ ROWS, REMOTE_BASE, SKIP_PANEL }) => {
      const h = window.__COMPOSITION_CATALOG__;
      const ws = h.workspace;
      const g = ws.root.runtime.graph;
      const C = h.commands;
      const lib = g.library;
      const set = (value) => ({ kind: "set", value });
      // (harness 핸들 — dev 와 harness production 빌드 둘 다.)
      const db = h.binding;
      const dbc = h.binding;
      const rd = h.rowDisplay;
      const schema = [
        { id: "f-id", key: "id", type: "string" },
        { id: "f-name", key: "name", type: "string" },
      ];
      ws.execute(
        C.setDataEntries({
          puts: [
            {
              kind: "collection",
              id: "data:collection:people",
              name: "People",
              schema,
              mockData: Array.from({ length: ROWS }, (_, i) => ({
                id: `p${i + 1}`,
                name: `Person${i + 1}`,
              })),
              useMockData: true,
            },
            {
              kind: "collection",
              id: "data:collection:remote",
              name: "Remote",
              schema,
              mockData: [],
              useMockData: false,
            },
            {
              kind: "endpoint",
              id: "data:endpoint:remote",
              name: "listRemote",
              method: "GET",
              baseUrl: REMOTE_BASE,
              path: "/people",
              headers: [],
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
              targetCollectionId: "data:collection:remote",
              executionMode: "client",
            },
          ],
          label: "G8 data",
        }),
      );
      const snap = ws.session.getSnapshot();
      const body = g.getEntry(snap.pageId).children[0];
      const lists = [
        ["vlist", "ListBox", { width: 600, height: 300 }, {}, "virtual"],
        ["hlist", "ListBox", { width: 600, height: 120 }, {}, "virtual"],
        // (2026-11-19: the Table's height is its Styles height — no `height` prop.)
        ["table", "Table", { width: 600, height: 300 }, {}, "virtual"],
        ["cards", "CardView", { width: 700, height: 420 }, {}, "virtual"],
        ["more", "ListBox", { width: 600, height: 300 }, {}, "more"],
        ["remote", "ListBox", { width: 600, height: 300 }, {}, "virtual"],
        // (패널에서 고른다 — ⑥.)
        ...(SKIP_PANEL
          ? []
          : [
              ["panel", "ListBox", { width: 600, height: 300 }, {}, null],
              ["wrap", "ListBox", { width: 600, height: 300 }, {}, null],
            ]),
      ];
      const out = {};
      for (const [key, type, sizing, props, mode] of lists) {
        const id = `project:node:g8-${key}`;
        ws.execute(
          C.insertNodes({
            parent: { kind: "node", id: body },
            entries: [
              {
                kind: "node",
                id,
                definitionId: h.palette.catalogPaletteDefinitionId(lib, type),
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
        const remote = key === "remote";
        ws.execute(
          dbc.catalogBindingCommand(
            [{ kind: "node", id }],
            db.catalogBindingRef({
              source: "dataTable",
              collectionId: remote ? "remote" : "people",
              name: remote ? "Remote" : "People",
            }),
          ),
        );
        // (ListBox 는 overflow 를 두지 않는다 — 사용자 결정 2026-11-13, 스크롤은 저작한 overflow.
        //  더 보기 대조군도 스크롤 상자여야 같은 sweep 이 성립한다.)
        if (key === "more")
          ws.execute(
            C.setFields({
              targets: [{ kind: "node", id }],
              visual: { overflow: set("auto") },
              label: "scroll",
            }),
          );
        if (key === "hlist") {
          ws.execute(
            C.setFields({
              targets: [{ kind: "node", id }],
              layout: { flexDirection: set("row") },
              label: "row",
            }),
          );
          const entry = g.getEntry(id);
          const ids = JSON.stringify([
            entry.children,
            entry.descendantOverrides,
          ]).match(/project:node:[\w-]+/g);
          const item = (ids ?? [])
            .map((x) => g.getEntry(x))
            .find((x) => x?.repeat);
          if (item)
            ws.execute(
              C.setFields({
                targets: [{ kind: "node", id: item.id }],
                sizing: { width: set(100) },
                label: "item width",
              }),
            );
          out.hlistItem = item?.id ?? null;
        }
        if (key === "wrap")
          ws.execute(
            C.setFields({
              targets: [{ kind: "node", id }],
              layout: { flexDirection: set("row"), flexWrap: set("wrap") },
              label: "wrap",
            }),
          );
        if (mode) ws.execute(rd.setRowDisplay(id, { mode }));
        const e = g.getEntry(id);
        out[key] = { rowDisplay: e.rowDisplay, binding: !!e.binding };
      }
      return out;
    },
    { ROWS, REMOTE_BASE, SKIP_PANEL },
  );
  record("setup — 목록 여섯이 연결 · 표시 방식을 받았다", true, setup);
  await page.waitForTimeout(3000);

  // (Table 의 첫 열을 선택 열로 — 첫 Column 과 Row 템플릿 첫 Cell 에 `Checkbox[slot=selection]`
  //  (RAC 레퍼런스 · S2 TableView 의 checkbox 열: 40 · 터치 52). ② 가 Canvas 40 = DOM 을, ⑦ 이
  //  터치 기기의 52 를 본다.)
  const selection = await page.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const root = ws.root;
    const g = root.runtime.graph;
    const C = h.commands;
    const set = (value) => ({ kind: "set", value });
    const table = [...root.canvasInputs.values()].find(
      (r) => r.sourceId === "project:node:g8-table",
    );
    const first = (rec, type) => {
      const stack = [rec];
      while (stack.length) {
        const r = stack.shift();
        for (const id of r.children ?? []) {
          const child = root.canvasInputs.get(id);
          if (!child) continue;
          if (root.typeOf(child) === type) return child;
          stack.push(child);
        }
      }
      return undefined;
    };
    const column = first(table, "Column");
    const cell = first(first(table, "TableBody"), "Cell");
    const owned = (rec) => rec?.sourceId?.split("#row:")[0];
    // (선택 열은 체크박스만 — 레퍼런스의 `<Column><Checkbox slot="selection" /></Column>`: 그 열의
    //  이름 (Column `children`) · 칸 글자 (Cell `children` = `{name}`) 는 비운다. 40px 열 (내용
    //  16px) 에 글자가 남으면 행이 글자 높이로 는다.)
    ws.execute(
      C.setFields({
        targets: [owned(column), owned(cell)]
          .filter((id) => id && g.getEntry(id))
          .map((id) => ({ kind: "node", id })),
        props: { children: set("") },
        label: "selection column text",
      }),
    );
    const placed = [];
    // (머리글 Column 에 전체선택, 행 템플릿 Cell 에 행 선택 — 레퍼런스 그대로. 행 템플릿 안 편집이
    //  RESOLVED_INSTANCE_MISSING 으로 거부되고 비운 라벨이 「Checkbox」 로 돌아오던 결함은 2026-11-15
    //  수리 — `adr310TableTemplate.test.tsx`.)
    for (const parent of [owned(column), owned(cell)]) {
      if (!parent || !g.getEntry(parent)) continue;
      const id = ws.newId("node");
      ws.execute(
        C.insertNodes({
          parent: { kind: "node", id: parent },
          index: 0,
          entries: [
            {
              kind: "node",
              id,
              definitionId: h.palette.catalogPaletteDefinitionId(
                g.library,
                "Checkbox",
              ),
              children: [],
              props: { slot: set("selection") },
              visual: {},
              sizing: {},
              descendantOverrides: [],
            },
          ],
          rootIds: [id],
          newId: ws.newId,
        }),
      );
      // (라벨 글자를 비운다 — 레퍼런스의 맨 `<Checkbox slot="selection" />`. 삽입 entry 의 빈
      //  `children` 은 남지 않아 Checkbox 기본 글자가 된다 — adr256-p5i2 하니스와 같은 쓰기.)
      ws.execute(
        C.setFields({
          targets: [{ kind: "node", id }],
          props: { children: set("") },
          label: "selection checkbox text",
        }),
      );
      placed.push(parent);
    }
    ws.execute(
      C.setFields({
        targets: [{ kind: "node", id: "project:node:g8-table" }],
        props: { selectionMode: set("multiple") },
        label: "selection",
      }),
    );
    return placed;
  });
  record(
    "setup — Table 첫 열 = 선택 열 (Column · Row 템플릿 Cell 에 Checkbox[slot=selection] · 그 열 글자 비움)",
    selection.length === 2,
    selection,
  );
  await page.waitForTimeout(1500);

  if (!SKIP_PANEL) {
    // ⑥ 패널: 「Show rows」 에서 Virtual scroll 을 고른다 (실제 클릭) · 줄바꿈 목록은 막히고 이유를 보인다
    const selectList = (key) =>
      page.evaluate((key) => {
        const ws = window.__COMPOSITION_CATALOG__.workspace;
        const rec = [...ws.root.canvasInputs.values()].find(
          (r) => r.sourceId === `project:node:g8-${key}`,
        );
        ws.selectRecords([rec.id]);
      }, key);
    const showRows = page.locator('[aria-label="Show rows"]').first();
    const openShowRows = async () => {
      for (let i = 0; i < 4; i++) {
        if (await showRows.isVisible().catch(() => false)) break;
        await page
          .getByRole("button", { name: "Design", exact: true })
          .first()
          .click()
          .catch(() => {});
        await page.waitForTimeout(1200);
      }
      await showRows.scrollIntoViewIfNeeded();
      const trigger =
        (await showRows.evaluate((el) => el.tagName)) === "BUTTON"
          ? showRows
          : showRows.locator("button").first();
      await trigger.click();
      await page.waitForTimeout(500);
      return page.getByRole("option", { name: /Virtual scroll/ }).first();
    };
    await selectList("wrap");
    await page.waitForTimeout(1200);
    const wrapOption = await openShowRows();
    const wrapState = {
      disabled: await wrapOption.getAttribute("aria-disabled"),
      text: (await wrapOption.textContent())?.trim(),
    };
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await selectList("panel");
    await page.waitForTimeout(1200);
    const panelOption = await openShowRows();
    const panelDisabled = await panelOption.getAttribute("aria-disabled");
    await panelOption.click();
    await page.waitForTimeout(800);
    const panelMode = await page.evaluate(
      () =>
        window.__COMPOSITION_CATALOG__.workspace.root.runtime.graph.getEntry(
          "project:node:g8-panel",
        )?.rowDisplay ?? null,
    );
    await page.screenshot({ path: `${OUT}/panel.png` });
    record(
      "⑥ 패널 Show rows: Virtual scroll 클릭 → 문서 rowDisplay virtual · 줄바꿈 목록은 막힘 + 이유",
      panelDisabled !== "true" &&
        panelMode?.mode === "virtual" &&
        wrapState.disabled === "true" &&
        /one line/i.test(wrapState.text ?? ""),
      { panelDisabled, panelMode, wrap: wrapState },
    );
  }

  // ── Canvas: 표본 항목의 목록 기준 rect (부모 사슬의 geometry 합) ──
  const canvas = await page.evaluate(() => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const abs = (id) => {
      let x = 0;
      let y = 0;
      let cur = id;
      let size = null;
      while (cur) {
        const geo = root.getGeometry([cur]).get(cur);
        if (!geo) break;
        if (!size) size = { width: geo.width, height: geo.height };
        x += geo.x;
        y += geo.y;
        cur = root.canvasInputs.get(cur)?.parentId;
      }
      return { x, y, ...size };
    };
    const listOf = (key) =>
      [...root.canvasInputs.values()].find(
        (r) => r.sourceId === `project:node:g8-${key}`,
      );
    const descendants = (rec, types) => {
      const out = [];
      const walk = (r) => {
        for (const c of r.children ?? []) {
          const child = root.canvasInputs.get(c);
          if (!child) continue;
          if (types.includes(root.typeOf(child))) out.push(child);
          else walk(child);
        }
      };
      walk(rec);
      return out;
    };
    const rel = (listRec, items) => {
      const base = abs(listRec.id);
      return items.map((r) => {
        const a = abs(r.id);
        return [a.x - base.x, a.y - base.y, a.width, a.height].map(
          (v) => Math.round(v * 100) / 100,
        );
      });
    };
    const out = {};
    for (const [key, types] of [
      ["vlist", ["ListBoxItem"]],
      ["hlist", ["ListBoxItem"]],
      ["table", ["Row"]],
      ["cards", ["Card"]],
    ]) {
      const rec = listOf(key);
      if (!rec) continue;
      let items = descendants(rec, types);
      // (Table: 머리글 행이 아니라 본문 Row — TableBody 아래.)
      if (key === "table")
        items = items.filter(
          (r) => root.typeOf(root.canvasInputs.get(r.parentId)) === "TableBody",
        );
      out[key] = rel(rec, items);
      if (key === "table")
        out.tableColumns = rel(rec, descendants(rec, ["Column"]));
    }
    return out;
  });
  writeFileSync(`${OUT}/canvas.json`, JSON.stringify(canvas, null, 2));

  // ── Publish 열기 (Preview 버튼이 연 창 — 빈 창을 먼저 열고 주소를 나중에 넣는다) ──
  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) =>
        ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
      )
      ?.click(),
  );
  const pub = await popup;
  watch(pub, "publish");
  await pub.bringToFront();
  await pub.waitForURL((url) => String(url) !== "about:blank", {
    timeout: 30000,
  });
  const opened = [pub.url()];
  try {
    await pub.waitForSelector('[data-catalog-id*="g8-vlist"] [role=option]', {
      state: "attached",
      timeout: 60000,
    });
  } catch (error) {
    await pub.screenshot({ path: `${OUT}/publish-timeout.png` });
    const seen = await pub.evaluate(() => ({
      url: location.href,
      ids: [...document.querySelectorAll("[data-catalog-id]")]
        .map((e) => e.getAttribute("data-catalog-id"))
        .filter((id) => id.includes("g8"))
        .slice(0, 20),
      text: document.body.innerText.slice(0, 400),
    }));
    throw new Error(`Publish: ${opened[0]} ${JSON.stringify(seen)}`);
  }
  await pub.waitForTimeout(2000);

  const domRects = (key, selector) =>
    pub.evaluate(
      ({ key, selector }) => {
        const list = document.querySelector(`[data-catalog-id*="g8-${key}"]`);
        if (!list) return null;
        const base = list.getBoundingClientRect();
        return [...list.querySelectorAll(selector)].map((el) => {
          const r = el.getBoundingClientRect();
          return [
            r.x - base.x,
            r.y - base.y,
            r.width,
            r.height,
            /Person\d+/.exec(el.textContent ?? "")?.[0] ?? null,
          ].map((v) => (typeof v === "number" ? Math.round(v * 100) / 100 : v));
        });
      },
      { key, selector },
    );

  if (process.argv.includes("--item-tree")) {
    // (dev 전용 — 첫 행 option 의 fiber 에서 위로 VirtualizerItem 까지 올라가 그 아래 컴포넌트 트리를 낸다.)
    const tree = await pub.evaluate(() => {
      const option = document.querySelector(
        '[data-catalog-id$="g8-vlist"] [role=option]',
      );
      const key = Object.keys(option).find((k) =>
        k.startsWith("__reactFiber$"),
      );
      let f = option[key];
      const nameOf = (x) => {
        const t = x.type;
        if (!t) return null;
        if (typeof t === "string") return `<${t}>`;
        return (
          t.displayName ||
          t.name ||
          t.render?.displayName ||
          t.render?.name ||
          "(anon)"
        );
      };
      while (f && !/VirtualizerItem|6796df8ba7398521/.test(nameOf(f) ?? ""))
        f = f.return;
      const out = [];
      const walk = (x, depth) => {
        for (let c = x.child; c; c = c.sibling) {
          const n = nameOf(c);
          const props = c.memoizedProps ?? {};
          const id = props.id ?? props.record?.id ?? props.recordId ?? "";
          const hint =
            n === "CatalogDomNode"
              ? ` {${Object.keys(props).join(",")}} ${String(id).split("::").pop()} → ${c.child ? "renders" : "null"}`
              : n === "RacSlotScope"
                ? ` ${props.context} → ${c.child ? "renders" : "null"}`
                : "";
          if (n) out.push(`${"  ".repeat(depth)}${n}${hint}`);
          walk(c, depth + (n ? 1 : 0));
        }
      };
      if (f) walk(f, 0);
      return out.slice(0, 160);
    });
    writeFileSync(`${OUT}/item-tree.txt`, tree.join("\n"));
    process.stdout.write(
      `item tree → ${OUT}/item-tree.txt (${tree.length} lines)\n`,
    );
    throw new Error("item tree only");
  }
  if (process.argv.includes("--inspect-item")) {
    const info = await pub.evaluate(() => {
      const list = document.querySelector('[data-catalog-id$="g8-vlist"]');
      const option = list.querySelector("[role=option]");
      const wrapper = option.parentElement;
      return {
        descendants: option.querySelectorAll("*").length,
        styled:
          [...option.querySelectorAll("[style]")].length +
          (option.hasAttribute("style") ? 1 : 0),
        wrapper: wrapper.getAttribute("style"),
        html: option.outerHTML.slice(0, 3000),
      };
    });
    writeFileSync(`${OUT}/item.json`, JSON.stringify(info, null, 2));
    process.stdout.write(`item: ${JSON.stringify(info).slice(0, 3500)}\n`);
    throw new Error("inspect only");
  }
  if (process.argv.includes("--trace")) {
    // 4x 가상 목록 sweep 의 renderer main thread 단계별 시간 (devtools.timeline).
    await pub.bringToFront();
    const cdpTrace = await context.newCDPSession(pub);
    await cdpTrace.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const events = [];
    cdpTrace.on("Tracing.dataCollected", (e) => events.push(...e.value));
    const done = new Promise((r) =>
      cdpTrace.once("Tracing.tracingComplete", r),
    );
    await cdpTrace.send("Tracing.start", {
      categories:
        "devtools.timeline,disabled-by-default-devtools.timeline,blink,cc",
      transferMode: "ReportEvents",
    });
    await pub.evaluate(async () => {
      const list = document.querySelector('[data-catalog-id*="g8-vlist"]');
      for (let i = 0; i < 200; i++) {
        list.scrollTop += 60;
        await new Promise((r) => requestAnimationFrame(r));
      }
    });
    await cdpTrace.send("Tracing.end");
    await done;
    await cdpTrace.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    const main = events.find(
      (e) => e.name === "thread_name" && e.args?.name === "CrRendererMain",
    );
    const sums = new Map();
    for (const e of events) {
      if (e.ph !== "X" || !e.dur) continue;
      if (main && (e.pid !== main.pid || e.tid !== main.tid)) continue;
      sums.set(e.name, (sums.get(e.name) ?? 0) + e.dur / 1000);
    }
    const top = [...sums.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40);
    writeFileSync(`${OUT}/trace-top.json`, JSON.stringify(top, null, 2));
    process.stdout.write(
      `trace (200 frames, ms): ${top.map(([k, v]) => `${k} ${v.toFixed(0)}`).join(" | ")}\n`,
    );
    throw new Error("trace only");
  }
  if (process.argv.includes("--render-count")) {
    await pub.bringToFront();
    await pub.evaluate(
      async ({ src, estimate }) => {
        const m = await import(src);
        m.mount(1000, estimate);
        await new Promise((r) => setTimeout(r, 1500));
      },
      {
        src: await racBaselineUrl(),
        estimate: !process.argv.includes("--rac-fixed"),
      },
    );
    const countFor = (sel) =>
      pub.evaluate(async (sel) => {
        const list = document.querySelector(sel);
        list.scrollTop = 600;
        await new Promise((r) => setTimeout(r, 500));
        window.__g8RenderCounts = {};
        for (let i = 0; i < 30; i++) {
          list.scrollTop += 60;
          await new Promise((r) => requestAnimationFrame(r));
        }
        await new Promise((r) => setTimeout(r, 300));
        const c = window.__g8RenderCounts;
        window.__g8RenderCounts = null;
        return Object.entries(c)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 24);
      }, sel);
    const counts = {
      ours: await countFor('[data-catalog-id$="g8-vlist"]'),
      rac: await countFor("#g8-base"),
    };
    writeFileSync(`${OUT}/render-counts.json`, JSON.stringify(counts, null, 2));
    process.stdout.write(
      `render counts ours (30 frames): ${JSON.stringify(counts.ours)}\nrender counts rac (30 frames): ${JSON.stringify(counts.rac)}\n`,
    );
    throw new Error("render count only");
  }
  if (process.argv.includes("--profile")) {
    // 4x 에서 가상 목록 sweep 한 번의 CPU profile — self time 상위 함수 (호출자 탐색용).
    const cdpProfile = await context.newCDPSession(pub);
    await cdpProfile.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    await cdpProfile.send("Profiler.enable");
    await cdpProfile.send("Profiler.setSamplingInterval", { interval: 200 });
    await cdpProfile.send("Profiler.start");
    await pub.evaluate(async () => {
      const list = document.querySelector('[data-catalog-id*="g8-vlist"]');
      for (let i = 0; i < 300; i++) {
        list.scrollTop += 60;
        await new Promise((r) => requestAnimationFrame(r));
      }
    });
    const { profile } = await cdpProfile.send("Profiler.stop");
    writeFileSync(`${OUT}/vlist-4x.cpuprofile`, JSON.stringify(profile));
    const resolveFrame = dist
      ? createFrameResolver(process.argv[distAt + 1])
      : (label) => label;
    const byId = new Map(profile.nodes.map((n) => [n.id, n]));
    const parentOf = new Map();
    for (const n of profile.nodes)
      for (const c of n.children ?? []) parentOf.set(c, n.id);
    const labelOf = (n) => {
      const f = n.callFrame;
      return resolveFrame(
        `${f.functionName || "(anon)"} ${f.url.split("?")[0]}:${f.lineNumber + 1}`,
      );
    };
    const self = new Map();
    const inclusive = new Map();
    const dt = profile.timeDeltas;
    profile.samples.forEach((id, i) => {
      const ms = (dt[i] ?? 0) / 1000;
      const key = labelOf(byId.get(id));
      self.set(key, (self.get(key) ?? 0) + ms);
      const seen = new Set();
      for (let cur = id; cur; cur = parentOf.get(cur)) {
        const k = labelOf(byId.get(cur));
        if (seen.has(k)) continue;
        seen.add(k);
        inclusive.set(k, (inclusive.get(k) ?? 0) + ms);
      }
    });
    const total = [...self.values()].reduce((a, b) => a + b, 0);
    const list = (m, filter, n) =>
      [...m.entries()]
        .filter(([k]) => filter(k))
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([k, v]) => `${v.toFixed(1)}ms ${k}`);
    writeFileSync(
      `${OUT}/vlist-4x-top.txt`,
      `total ${total.toFixed(1)}ms\n--- self\n${list(self, () => true, 30).join("\n")}\n--- inclusive (src/)\n${list(inclusive, (k) => / src\//.test(k), 40).join("\n")}\n`,
    );
    process.stdout.write(`profile → ${OUT}/vlist-4x-top.txt\n`);
    await cdpProfile.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    throw new Error("profile only");
  }
  // ① DOM 행 수 (1,000 행 가상 목록)
  const counts = await pub.evaluate(() => {
    const n = (key, sel) =>
      document
        .querySelector(`[data-catalog-id*="g8-${key}"]`)
        ?.querySelectorAll(sel).length ?? null;
    return {
      vlist: n("vlist", "[role=option]"),
      hlist: n("hlist", "[role=option]"),
      table: n("table", "[role=row]"),
      cards: n("cards", "[role=row]"),
      more: n("more", "[role=option]"),
    };
  });
  record(
    "① 1,000 행 가상 목록의 DOM 행 수 ≤ 60 (세로 · 가로 · Table · grid)",
    ["vlist", "hlist", "table", "cards"].every(
      (k) => counts[k] > 0 && counts[k] <= 60,
    ),
    counts,
  );

  // ② 위치 · 크기 대조 (스크롤 0)
  const dom = {
    vlist: await domRects("vlist", "[role=option]"),
    hlist: await domRects("hlist", "[role=option]"),
    table: (await domRects("table", "[role=row]"))?.slice(1),
    tableColumns: await domRects("table", "[role=columnheader]"),
    cards: await domRects("cards", "[role=row]"),
  };
  writeFileSync(`${OUT}/dom.json`, JSON.stringify(dom, null, 2));
  for (const key of ["vlist", "hlist", "table", "tableColumns", "cards"]) {
    const c = canvas[key] ?? [];
    const d = dom[key] ?? [];
    const n = Math.min(c.length, d.length);
    let worst = 0;
    for (let i = 0; i < n; i++)
      for (let k = 0; k < 4; k++)
        worst = Math.max(worst, Math.abs(c[i][k] - d[i][k]));
    record(
      `② ${key}: 보이는 행 위치 · 크기 Canvas = DOM (1px 안)`,
      n > 0 && worst <= 1,
      {
        compared: n,
        worstDelta: Math.round(worst * 100) / 100,
        canvas: c.slice(0, 3),
        dom: d.slice(0, 3),
      },
    );
  }

  // ⑧ 선택 Checkbox: 머리글 하나 + 보이는 행마다 하나 (Row 템플릿 Cell 의 반복), 라벨 글자 없음.
  const boxes = await pub.evaluate(() => {
    const table = document.querySelector('[data-catalog-id*="g8-table"]');
    const rows = [...table.querySelectorAll("[role=row]")];
    const box = (row) => row.querySelector(".react-aria-Checkbox");
    return {
      rows: rows.length,
      withBox: rows.filter(box).length,
      texts: [...new Set(rows.map((row) => box(row)?.textContent ?? null))],
    };
  });
  record(
    "⑧ 선택 Checkbox: 머리글 + 보이는 행마다 하나 (Row 템플릿 반복) · 라벨 글자 없음",
    boxes.rows > 1 &&
      boxes.withBox === boxes.rows &&
      boxes.texts.length === 1 &&
      boxes.texts[0] === "",
    boxes,
  );

  // ⑦ 터치 기기: 선택 열 = S2 52 (Canvas 는 데스크톱 40) — 머리글 · 본문 행의 첫 칸이 같은 폭,
  //    데스크톱으로 돌아오면 40. 터치 보기는 Preview 의 `data-catalog-touch` (S2 기기 media 와 같은 시트).
  const firstCells = () =>
    pub.evaluate(() => {
      const table = document.querySelector('[data-catalog-id*="g8-table"]');
      const width = (el) => Math.round(el.getBoundingClientRect().width * 100) / 100;
      const rows = [...table.querySelectorAll("[role=row]")];
      return {
        header: [...rows[0].querySelectorAll("[role=columnheader]")].map(width),
        row: [...rows[1].querySelectorAll("[role=gridcell],[role=rowheader]")].map(width),
        token: getComputedStyle(document.documentElement).getPropertyValue(
          "--catalog-token-size-table-selection-column",
        ),
      };
    });
  const desktopCells = await firstCells();
  await pub.evaluate(() =>
    document.documentElement.setAttribute("data-catalog-touch", ""),
  );
  await pub.waitForTimeout(600);
  const touchCells = await firstCells();
  await pub.evaluate(() =>
    document.documentElement.removeAttribute("data-catalog-touch"),
  );
  await pub.waitForTimeout(600);
  const backCells = await firstCells();
  const sameRow = (c) =>
    c.header.length === c.row.length &&
    c.header.every((w, i) => Math.abs(w - c.row[i]) <= 1);
  record(
    "⑦ 터치 기기: 가상 Table 선택 열 52 (데스크톱 40) · 머리글 = 본문 행",
    Math.abs(desktopCells.header[0] - 40) <= 0.5 &&
      Math.abs(touchCells.header[0] - 52) <= 0.5 &&
      Math.abs(backCells.header[0] - 40) <= 0.5 &&
      [desktopCells, touchCells, backCells].every(sameRow),
    { desktop: desktopCells, touch: touchCells, back: backCells },
  );

  // ③ 원격: 끝에 닿으면 다음 쪽 (page 2 · 3) → Person250
  const remote = await pub.evaluate(async () => {
    const list = document.querySelector('[data-catalog-id*="g8-remote"]');
    const last = () =>
      [...list.querySelectorAll("[role=option]")]
        .map((o) => Number(/Person(\d+)/.exec(o.textContent ?? "")?.[1] ?? 0))
        .reduce((a, b) => Math.max(a, b), 0);
    for (let i = 0; i < 80 && last() < 250; i++) {
      list.scrollTop = list.scrollHeight;
      await new Promise((r) => setTimeout(r, 250));
    }
    return {
      last: last(),
      scrollHeight: list.scrollHeight,
      domRows: list.querySelectorAll("[role=option]").length,
    };
  });
  record(
    "③ 원격 가상 목록: 끝에서 다음 쪽을 받아 Person250 까지 (요청 page 2 · 3)",
    remote.last === 250 &&
      remoteRequests.some((u) => u.includes("page=2")) &&
      remoteRequests.some((u) => u.includes("page=3")),
    { ...remote, requests: remoteRequests },
  );

  // ④ 키보드 (RAC 그대로): 첫 행 클릭 → End → Person1000 · ↑ → Person999 · Space → 선택
  await pub
    .locator('[data-catalog-id*="g8-vlist"] [role=option]')
    .first()
    .click();
  const focused = () =>
    pub.evaluate(() => {
      const list = document.querySelector('[data-catalog-id*="g8-vlist"]');
      const a = document.activeElement;
      return {
        text: /Person\d+/.exec(a?.textContent ?? "")?.[0] ?? null,
        selected: a?.getAttribute("aria-selected"),
        scrollTop: Math.round(list.scrollTop),
      };
    });
  const clicked = await focused();
  await pub.keyboard.press("End");
  await pub.waitForTimeout(500);
  const end = await focused();
  await pub.keyboard.press("ArrowUp");
  await pub.waitForTimeout(300);
  const up = await focused();
  await pub.keyboard.press("Space");
  await pub.waitForTimeout(300);
  const space = await focused();
  await pub.keyboard.press("Home");
  await pub.waitForTimeout(500);
  const home = await focused();
  record(
    "④ 키보드 End · ↑ · Space · Home (focus 행 · 스크롤 따라감 · 선택)",
    clicked.text === "Person1" &&
      end.text === `Person${ROWS}` &&
      end.scrollTop > 0 &&
      up.text === `Person${ROWS - 1}` &&
      space.selected === "true" &&
      home.text === "Person1" &&
      home.scrollTop === 0,
    { clicked, end, up, space, home },
  );

  // (Publish 는 Builder 가 연 같은 사이트 창이라 같은 renderer main thread 를 쓸 수 있다 — Builder 의
  //  Canvas · 패널 일이 Publish frame 에 섞이지 않게 frame 측정 전에 Builder 탭을 비운다. 사용자의
  //  Publish 는 배포 주소에서 혼자 돈다. `--keep-builder` 면 그대로 — 섞인 조건의 대조군.)
  if (!process.argv.includes("--keep-builder"))
    await page.goto("about:blank").catch(() => {});
  // (가설 실험 — `--inject-css "<rule>"`: Publish 문서에 CSS 한 줄을 더한 뒤 sweep.)
  const injectAt = process.argv.indexOf("--inject-css");
  if (injectAt > 0)
    await pub.addStyleTag({ content: process.argv[injectAt + 1] });
  // (rAF · IntersectionObserver 는 보이는 탭에서만 돈다 — Publish 창을 앞으로.)
  await pub.bringToFront();
  const visibility = await pub.evaluate(() => document.visibilityState);
  process.stdout.write(`  publish visibility ${visibility}\n`);
  // ⑤ frame — 사용자 결정 (2026-11-15): 가상 스크롤은 **같은 문서의 순수 RAC 가상 목록**
  //  (`adr310VirtualBaseline.mjs` — 600 × 300 · 행 32) 과 비교한다. 대조군은 우리 목록과 같은 입력
  //  조건 — Preview 에는 배치 geometry 가 없어 행 크기를 추정하고 RAC 가 잰다 (`estimatedRowSize`).
  //  `--rac-fixed` 는 행 크기를 아는 RAC (참고 — 우리가 가질 수 없는 입력). 「더 보기」 는 compositor 스크롤이라
  //  main thread 일이 0 이고, 순수 RAC 가상 목록도 목록이 여럿인 문서 · 4x 에서 그보다 늦다 (실측) —
  //  더 보기 값은 참고로만 잰다. 통과: 1x 에서 60Hz 최소선 (p95 ≤ 16.7 ms) · 1x · 4x 모두 우리 p95 ≤
  //  RAC p95 + 0.5 ms. 더 보기 목록은 1,000 행을 모두 불러온 뒤 (그 방식의 불리한 상태).
  await pub.evaluate(
    async ({ src, estimate }) => {
      const m = await import(src);
      m.mount(1000, estimate);
      await new Promise((r) => setTimeout(r, 1500));
    },
    {
      src: await racBaselineUrl(),
      estimate: !process.argv.includes("--rac-fixed"),
    },
  );
  const moreLoaded = await pub.evaluate(async (ROWS) => {
    const list = document.querySelector('[data-catalog-id$="g8-more"]');
    const count = () => list.querySelectorAll("[role=option]").length;
    for (let i = 0; i < 120 && count() < ROWS; i++) {
      list.scrollTop = list.scrollHeight;
      await new Promise((r) => setTimeout(r, 200));
    }
    list.scrollTop = 0;
    return count();
  }, ROWS);
  process.stdout.write(`  more loaded ${moreLoaded}\n`);
  // (같은 문서 A/B — 한 팔을 잴 때 다른 팔의 목록은 `display: none`: 1,000 행 DOM 의 더 보기 목록이
  //  같은 문서에 떠 있으면 가상 목록 비용만 커진다 (실측 4x p95 25 → 10.2 ms). 나머지 목록 (가로 ·
  //  Table · grid · 원격 · 패널) 은 세 팔의 공통 내용이다.)
  const ARMS = {
    virtual: '[data-catalog-id$="g8-vlist"]',
    rac: "#g8-base",
    more: '[data-catalog-id$="g8-more"]',
  };
  const sweep = (arm) =>
    pub.evaluate(
      async ({ arm, ARMS }) => {
        const hide = document.createElement("style");
        hide.textContent = Object.entries(ARMS)
          .filter(([key]) => key !== arm)
          .map(([, sel]) => `${sel} { display: none !important; }`)
          .join("\n");
        document.head.appendChild(hide);
        await new Promise((r) => setTimeout(r, 300));
        const list = document.querySelector(ARMS[arm]);
        list.scrollTop = 0;
        await new Promise((r) => setTimeout(r, 300));
        const startHeight = list.scrollHeight;
        // (가상 목록의 전체 높이는 RAC 가 행을 재며 줄어든다 — 끝은 매 프레임 다시 읽는다.)
        const maxNow = () => list.scrollHeight - list.clientHeight;
        const gaps = [];
        let prev = performance.now();
        await new Promise((resolve) => {
          const tick = (now) => {
            gaps.push(now - prev);
            prev = now;
            if (list.scrollTop >= maxNow() - 1 || gaps.length > 4000)
              return resolve();
            list.scrollTop = Math.min(maxNow(), list.scrollTop + 60);
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        gaps.shift();
        hide.remove();
        const sorted = [...gaps].sort((a, b) => a - b);
        const q = (p) =>
          Math.round(
            sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] *
              10,
          ) / 10;
        const refresh = sorted[Math.floor(sorted.length * 0.1)];
        return {
          dropped:
            Math.round(
              (gaps.filter((g) => g > refresh * 1.5).length / gaps.length) *
                1000,
            ) / 10,
          frames: gaps.length,
          p50: q(0.5),
          p95: q(0.95),
          p99: q(0.99),
          height: [startHeight, list.scrollHeight],
        };
      },
      { arm, ARMS },
    );
  const cdp = await context.newCDPSession(pub);
  const frames = {};
  for (const rate of [1, 4]) {
    await cdp.send("Emulation.setCPUThrottlingRate", { rate });
    const runs = { virtual: [], rac: [], more: [] };
    for (let i = 0; i < 3; i++) {
      for (const arm of Object.keys(runs)) runs[arm].push(await sweep(arm));
      process.stdout.write(
        `  frame cpu${rate}x #${i + 1} ${Object.keys(runs)
          .map((arm) => `${arm} ${JSON.stringify(runs[arm].at(-1))}`)
          .join(" ")}\n`,
      );
    }
    const median = (arr, k) =>
      [...arr.map((r) => r[k])].sort((a, b) => a - b)[1];
    frames[`cpu${rate}x`] = Object.fromEntries(
      Object.entries(runs).map(([arm, list]) => [
        arm,
        {
          p50: median(list, "p50"),
          p95: median(list, "p95"),
          p99: median(list, "p99"),
          dropped: median(list, "dropped"),
          frames: list[0].frames,
        },
      ]),
    );
    frames[`cpu${rate}x`].runs = runs;
  }
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  const refresh = await pub.evaluate(
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
  const summary = (k) => ({
    virtual: frames[k].virtual,
    rac: frames[k].rac,
    more: frames[k].more,
  });
  record(
    "⑤ frame: 1x p95 ≤ 16.7 ms (60Hz) · 1x · 4x 가상 p95 ≤ 같은 문서 순수 RAC 가상 목록 + 0.5 ms (1,000 행, 3 회 교대 중앙값 — 더 보기는 참고)",
    moreLoaded === ROWS &&
      frames.cpu1x.virtual.p95 <= 16.7 &&
      ["cpu1x", "cpu4x"].every(
        (k) => frames[k].virtual.p95 <= frames[k].rac.p95 + 0.5,
      ),
    {
      moreLoaded,
      refreshMs: refresh,
      cpu1x: summary("cpu1x"),
      cpu4x: summary("cpu4x"),
    },
  );
  writeFileSync(`${OUT}/frames.json`, JSON.stringify(frames, null, 2));
  await pub.screenshot({ path: `${OUT}/publish.png` });
} catch (error) {
  record("harness", false, String(error?.stack ?? error).slice(0, 1500));
} finally {
  record("콘솔 오류 0", errors.length === 0, errors.slice(0, 8));
  writeFileSync(
    `${OUT}/results.json`,
    JSON.stringify({ results, errors, remoteRequests }, null, 2),
  );
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(
    `\n${results.length - failed}/${results.length} PASS → ${OUT}/results.json\n`,
  );
  await browser.close();
  server.close();
  await dist?.close();
  process.exitCode = failed ? 1 : 0;
}

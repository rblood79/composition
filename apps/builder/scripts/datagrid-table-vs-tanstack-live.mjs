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
import { chromium, webkit } from "playwright";
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
// `--display more` : 가상 스크롤 대신 「더 보기」 (불러온 행의 첫 100). `--check-sort` : 헤더 정렬이
//   표시 창을 자르기 전에 되는지 — 보이는 행이 「정렬된 전체」 의 첫 행들인지 확인하고 끝낸다.
const DISPLAY = arg("--display", "virtual");
const CHECK_SORT = process.argv.includes("--check-sort");
// `--check-remember on|off` (ADR-315 사용자 결정 1): Builder 의 Property 패널에서 Table 의
//   「Remember state」 스위치를 실제로 누르고 (on), Publish 에서 머리글을 눌러 정렬한 뒤 새로고침 —
//   on 이면 정렬이 그대로, off 이면 작성 순서로 돌아오는지 확인하고 끝낸다.
const CHECK_REMEMBER = arg("--check-remember", null);
// `--check-multisort` (ADR-315 Phase 2): Builder 의 Property 패널에서 Table 의 「Multi-column sort」
//   스위치를 실제로 누르고, Publish 에서 「Dept」 머리글을 누른 뒤 Shift 를 누른 채 「Amount」 를 두 번
//   눌러 (오름 → 내림) 보이는 첫 행들이 「Dept 오름 · 그 안에서 Amount 내림」 인지 — 이 파일의 행
//   생성기로 따로 계산한 순서와 — 그리고 머리글의 순번 표시 · `aria-sort` 를 확인하고 끝낸다.
const CHECK_MULTISORT = process.argv.includes("--check-multisort");
// `--check-search [fuzzy]` (ADR-315 Phase 3): Builder 의 Property 패널에서 Table 의 「Search」
//   스위치를 켜고 (SearchField 가 표 앞에 놓인다), Publish 에서 그 칸에 글자를 쳐 표의 행이 이
//   파일의 행 생성기로 따로 계산한 결과와 같은지 본다. 글자마다 입력 → 다음 paint 시간 (Event
//   Timing) 을 CPU 1x · 4x 에서 잰다. `fuzzy` 는 「Search match」 를 유사로 둔다.
const CHECK_SEARCH = process.argv.includes("--check-search");
const SEARCH_FUZZY =
  CHECK_SEARCH &&
  process.argv[process.argv.indexOf("--check-search") + 1] === "fuzzy";
// `--check-facet` (ADR-315 Phase 3): Builder 의 「검색 · 필터」 구획에서 `city` 필드의 RadioGroup 필터를
//   넣고 (항목 = 그 필드의 후보 값 보기), Publish 에서 항목이 「전체」 + 데이터의 도시 전부 (50 — 옛
//   표본 상한 20 을 넘는다) 인지, 하나를 고르면 표의 행 수가 이 파일의 행 생성기로 센 값인지 본다.
const CHECK_FACET = process.argv.includes("--check-facet");
// `--check-pin` (ADR-315 Phase 4 — G4): 열 여섯을 400px 로 넓혀 가로 스크롤을 만들고 `Dept` 를 앞에,
//   `Date` 를 뒤에 고정한다 (Column 「Pinned」 의 작성 기본값). Publish 에서 가로로 스크롤한 뒤
//   고정 열의 머리글 · 칸이 표의 왼쪽 · 오른쪽 끝에 붙어 있고 다른 열은 밀려 났는지를
//   `getBoundingClientRect` 로 본다. `--display more` 는 가상 스크롤을 쓰지 않는 표,
//   `--browser webkit` 은 WebKit.
const CHECK_PIN = process.argv.includes("--check-pin");
// `--check-resize` (ADR-315 Phase 4 — 폭을 상태로): Name 열을 「Allow resizing」 으로, Table 을
//   「Remember state」 로 둔다. Publish 에서 Name 머리글의 손잡이를 오른쪽으로 120px 끌고, 표 상태가
//   브라우저에 남았는지 · 새로고침 뒤 Name 폭이 끈 폭인지를 본다.
const CHECK_RESIZE = process.argv.includes("--check-resize");
// `--check-filter` (ADR-315 Phase 4 증분 4c — 열 메뉴 「필터」): Dept · Amount 열을 「Allow filtering」
//   으로 둔다. Publish 에서 Dept 메뉴 「Filter…」 → 「Contains」 에 `dept 1` → 적용, Amount 「At least」
//   5000 → 적용, Dept 를 다시 열어 「Equals」 의 후보 값 (자기 필터 제외 — Amount 조건만 건 행의
//   부서별 행 수) 을 보고 `Dept 3` 을 골라 적용, 끝으로 Dept 메뉴 「Clear filter」. 단계마다 표의 행 수
//   (`aria-rowcount`) 와 후보 값을 이 파일의 행 생성기로 따로 센 값과 대조한다.
const CHECK_FILTER = process.argv.includes("--check-filter");
// `--check-drag` (ADR-315 Phase 4 증분 5 — 머리글 끌기): Table 을 「Reorder columns」 로 둔다. Publish 에서
//   Name 머리글의 손잡이를 포인터로 끌어 Amount 머리글에 놓고 (→ Dept · City · Amount · Name · Qty · Date),
//   Date 손잡이에서 키보드 끌기 (Enter → Tab → Enter) 로 순서가 바뀌는지, 끌기가 정렬을 일으키지 않는지,
//   끌기 뒤 머리글 클릭이 정렬하는지 (S5 의 WebKit 첫 클릭) 를 본다.
const CHECK_DRAG = process.argv.includes("--check-drag");
// `--check-group` (ADR-315 Phase 5 — 표 안 묶음 행): Dept 열을 「Allow grouping」, Amount 를 「Group
//   aggregate」 Sum 으로 둔다. Publish 에서 Dept 메뉴 「Group by column」 → 묶음 행의 수 · 각 묶음의
//   「Dept N (개수)」 · Amount 합계를 이 파일의 행 생성기로 따로 센 값과 대조하고, Dept 가 첫 머리글인지,
//   첫 묶음의 펼침 버튼을 눌러 자식 행 수 (aria-level 2) 가 그 묶음의 개수인지, 「Ungroup」 뒤 행이 돌아오는지 본다.
//   메뉴 Button 은 내용 감싸개가 있는 Column 의 것이라 `--column-origin` 과 같이 돌린다.
const CHECK_GROUP = process.argv.includes("--check-group");
// `--check-authored-group` (ADR-315 Phase 5 증분 5b-3 — 작성 「Grouped」): Dept 열 「Grouped」 · Amount
//   「Group aggregate」 Sum 을 작성한다. Builder Canvas 의 record (묶음 행 수 · 접힘 표시 `_treeCell` ·
//   중첩 행 0 · Dept 첫 열) 와 화면, Publish 의 첫 화면 (treegrid · 묶음 12 · 모두 접힘 · 개수 · 합계) 을
//   행 생성기로 따로 센 값과 대조한다. `--column-origin` 과 같이 돌린다.
const CHECK_AUTHORED_GROUP = process.argv.includes("--check-authored-group");
// `--check-totals` (ADR-315 Phase 5 증분 5c — 합계 행): Name 「Count」 · Amount 「Sum」 · Qty 「Mean」 을
//   작성하고 「Totals row」 를 켠다 (같은 행을 mock 으로도 실어 Builder Canvas 가 그린다). Builder Canvas
//   의 footer 행 record 와 Publish 의 `tfoot` 행 (가상 표 포함) 을 행 생성기로 따로 센 값과 대조한다.
const CHECK_TOTALS = process.argv.includes("--check-totals");
// `--check-tree` (ADR-315 Phase 5 증분 5d — 계층 데이터): 행마다 `parent` 필드 (r0 ~ r99 최상위 · r100 ~ r499
//   는 r(i % 100) 아래 · r500 ~ 는 r(100 + i % 400) 아래) 를 두고 Table 연결에 부모 ID 필드를 고른다 (같은
//   행을 mock 으로도 실어 Builder Canvas 가 그린다). Builder Canvas record (최상위 100 · 접힘 표시 · 중첩 0)
//   와 Publish (treegrid · 최상위 접힘 → r0 펼침 → 자식 4 행 `aria-level` 2 → Name 정렬 뒤 단계마다 정렬)
//   를 행 생성기로 따로 센 값과 대조한다.
const CHECK_TREE = process.argv.includes("--check-tree");
// `--check-detail` (ADR-315 Phase 5 증분 5e — 상세 행): Table 「Detail row」 를 켠다 (같은 행을 mock 으로도
//   실어 Builder Canvas 가 그린다). Builder Canvas record (모든 행 접힘 표시 · 중첩 0) 와 Publish (treegrid ·
//   모두 접힘 → r0 펼침 → 바로 아래 `r0/detail` 단계 2 · 칸 하나 · `aria-colspan` = 열 6 · 글자 = r0 의
//   Name) 를 행 생성기로 따로 센 값과 대조한다.
const CHECK_DETAIL = process.argv.includes("--check-detail");
// `--check-rowpin` (ADR-315 Phase 5 증분 5f — 행 고정): Table 「Row pinning」 을 켠다. Builder Canvas record
//   (Table 의 `_rowPinnable` · 고정 행 0) 와 Publish (행마다 마지막 칸의 행 메뉴 — 쉴 때 그리지 않음 → r3
//   「Pin to top」 · r5 「Pin to bottom」 → 위 · 가운데 · 끝까지 스크롤하며 r3 은 머리글 바로 아래, r5 는
//   스크롤 상자 바닥에 1 px 안에서 붙고 그 자리의 hit test 가 그 행) 를 잰다.
const CHECK_ROWPIN = process.argv.includes("--check-rowpin");
// `--check-server group|pin` (ADR-315 Phase 5 증분 5g — 서버가 쪽을 나누는 표): endpoint 가 `body` 형식
//   (쪽 50 · 「묶음의 행 조회」 · 「key 로 행 조회」), 서버는 mock 조회 서버 (`answerBody` — 독립 oracle).
//   group: Dept 「Grouped」 + 합계 행 — Publish 의 묶음 행 · 합계가 행 생성기로 따로 센 값과 같고, 묶음
//   하나를 펼치면 `groupOf` 요청이 그 묶음의 행만 준다 (행 쪽 요청 없음). pin: 「Row pinning」 — r3 을 위에
//   고정하면 본문 요청이 `keys.except` · 고정 요청이 `keys.only` 이고, 「더 보기」 로 다음 쪽을 불러도 r3 은
//   한 번만.
const CHECK_SERVER = arg("--check-server", "");
const SERVER_GROUP = CHECK_SERVER === "group";
const SERVER_PIN = CHECK_SERVER === "pin";
// ADR-315 Phase 4 증분 6 — the Table's view sorts Dept ↑ then Amount ↓ (authored): the Builder's
// Column records carry the marks (`_sortMark` · the mark part), the Publish header shows them, a
// press on Amount starts from its authored direction.
const CHECK_AUTHORED = process.argv.includes("--check-authored-sort");
// `--profile-columns` (ADR-315 Phase 4 — HC4): every data Column 「Allow hiding」 · 「Allow pinning」, the
//   Table 「Reorder columns」 and its 「Column visibility menu」 (the panel chip). Publish: per CPU 1x · 4x,
//   three times — Dept 「Pin to start」 · 「Unpin」, Name 「Move right」 · 「Move left」, the chooser's Qty
//   off · on — each item press → the next frame after the header changed, ms; then the sort (Amount ·
//   Name, ascending · descending) from the same menu as the baseline (item press → the first row
//   changed — a Column with a menu sorts from it). HC4: a column change ≤ the sort. With
//   `--column-origin` (the menu Button is the Column's content wrapper).
const PROFILE_COLUMNS = process.argv.includes("--profile-columns");
const BROWSER = arg("--browser", "chromium");
// `--column-origin` : 열을 제품의 Quick Connect · 「+ Column」 과 같은 원본 (내용 감싸개가 있는 Column)
//   으로 만든다 — 기본은 Table 원본의 첫 열과 같은 정의 (감싸개 없는 Column, 글자는 `children`).
const COLUMN_ORIGIN = process.argv.includes("--column-origin")
  ? "lib:definition:origin-component-table-column"
  : null;
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
    ...(CHECK_TREE
      ? {
          parent:
            i < 100 ? null : i < 500 ? `r${i % 100}` : `r${100 + (i % 400)}`,
        }
      : {}),
  }));
}
const DATA = JSON.stringify({ items: makeRows(ROWS), next: null });
const { answerBody } = await import("./mock-query-server.mjs");
const SERVER_ROWS = makeRows(ROWS);

const requests = [];
const server = createServer((req, res) => {
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
  };
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }
  // (`--check-server`: the mock query server's body format over the same rows.)
  if (req.method === "POST") {
    let text = "";
    req.on("data", (chunk) => (text += chunk));
    req.on("end", () => {
      const body = text ? JSON.parse(text) : {};
      requests.push({ url: req.url, body });
      res.writeHead(200, { "content-type": "application/json", ...cors });
      res.end(JSON.stringify(answerBody(SERVER_ROWS, body)));
    });
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
const browser =
  BROWSER === "webkit"
    ? await webkit.launch({ headless: false })
    : await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
  // (`--check-filter` reads the column menu · dialog by their English labels.)
  ...(CHECK_FILTER ||
  CHECK_GROUP ||
  CHECK_AUTHORED_GROUP ||
  CHECK_TOTALS ||
  CHECK_TREE ||
  CHECK_DETAIL ||
  CHECK_ROWPIN ||
  CHECK_SERVER
    ? { locale: "en-US" }
    : {}),
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
      ({ REMOTE_BASE, COLUMNS, MOCK, CHECK_TREE, SERVER }) => {
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
                  ...(CHECK_TREE
                    ? [{ id: "f-parent", key: "parent", type: "string" }]
                    : []),
                ],
                // (`--check-authored-group`: the Builder's Canvas draws its rows — the same rows
                //  as the server's, as mock data.)
                mockData: MOCK ?? [],
                useMockData: !!MOCK,
              },
              SERVER
                ? {
                    // (ADR-315 5g — a server that pages its rows and answers a group's · a key's rows.)
                    kind: "endpoint",
                    id: "data:endpoint:grid",
                    name: "queryGrid",
                    method: "POST",
                    baseUrl: REMOTE_BASE,
                    path: "/grid",
                    headers: [],
                    queryParams: [],
                    bodyType: "none",
                    responseMapping: {
                      dataPath: "items",
                      totalPath: "total",
                      cursorPath: "cursor",
                    },
                    querySerialization: {
                      kind: "body",
                      pageSize: 50,
                      groupRows: true,
                      keyRows: true,
                    },
                    targetCollectionId: "data:collection:grid",
                    executionMode: "client",
                  }
                : {
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
      {
        REMOTE_BASE,
        COLUMNS,
        // (`--check-rowpin`: local rows — since ADR-315 5g a Table on a server's cursor pages pins
        //  no row unless its request asks for rows by key: `--check-server pin` covers that.)
        MOCK:
          CHECK_AUTHORED_GROUP ||
          CHECK_TOTALS ||
          CHECK_TREE ||
          CHECK_DETAIL ||
          (CHECK_ROWPIN && !SERVER_PIN)
            ? makeRows(ROWS)
            : null,
        CHECK_TREE,
        SERVER: !!CHECK_SERVER,
      },
    );
    await page.waitForTimeout(2000);

    // ── 열 6 (starter 열 교체) → 연결 → 정렬 가능 → 가상 스크롤 ──
    const setup = await page.evaluate(
      ({
        COLUMNS,
        DISPLAY,
        COLUMN_ORIGIN,
        CHECK_PIN,
        CHECK_RESIZE,
        CHECK_FILTER,
        CHECK_GROUP,
        CHECK_AUTHORED_GROUP,
        CHECK_TOTALS,
        CHECK_TREE,
        CHECK_DETAIL,
        CHECK_ROWPIN,
        CHECK_DRAG,
        CHECK_AUTHORED,
        PROFILE_COLUMNS,
      }) => {
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
                const entry = node(COLUMN_ORIGIN ?? columnEntry.definitionId);
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
                ...(CHECK_TREE ? { fieldMap: { parentId: "f-parent" } } : {}),
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
        if (DISPLAY === "virtual")
          step("virtual", () =>
            ws.execute(h.rowDisplay.setRowDisplay(id, { mode: "virtual" })),
          );
        if (CHECK_PIN)
          step("pin", () => {
            const keyed = (key) =>
              all(table(), "Column")
                .map(owned)
                .filter((x) => x && g.getEntry(x)?.props?.key?.value === key)
                .map((x) => ({ kind: "node", id: x }));
            ws.execute(
              C.setFields({
                targets: all(table(), "Column")
                  .map(owned)
                  .filter((x) => x && g.getEntry(x)?.props?.key)
                  .map((x) => ({ kind: "node", id: x })),
                props: { width: set(400) },
                label: "wide",
              }),
            );
            ws.execute(
              C.setFields({
                targets: keyed("dept"),
                props: { defaultPinned: set("start") },
                label: "pin start",
              }),
            );
            ws.execute(
              C.setFields({
                targets: keyed("date"),
                props: { defaultPinned: set("end") },
                label: "pin end",
              }),
            );
          });
        if (CHECK_RESIZE)
          step("resize", () => {
            ws.execute(
              C.setFields({
                targets: all(table(), "Column")
                  .map(owned)
                  .filter(
                    (x) => x && g.getEntry(x)?.props?.key?.value === "name",
                  )
                  .map((x) => ({ kind: "node", id: x })),
                props: { allowsResizing: set(true) },
                label: "resizable",
              }),
            );
            ws.execute(
              C.setFields({
                targets: [{ kind: "node", id }],
                props: { rememberState: set(true) },
                label: "remember",
              }),
            );
          });
        if (CHECK_FILTER)
          step("filter", () => {
            ws.execute(
              C.setFields({
                targets: all(table(), "Column")
                  .map(owned)
                  .filter(
                    (x) =>
                      x &&
                      ["dept", "amount"].includes(
                        g.getEntry(x)?.props?.key?.value,
                      ),
                  )
                  .map((x) => ({ kind: "node", id: x })),
                props: { allowsFiltering: set(true) },
                label: "filterable",
              }),
            );
          });
        if (CHECK_GROUP)
          step("group", () => {
            const columnOf = (key) =>
              all(table(), "Column")
                .map(owned)
                .filter((x) => x && g.getEntry(x)?.props?.key?.value === key)
                .map((x) => ({ kind: "node", id: x }));
            ws.execute(
              C.setFields({
                targets: columnOf("dept"),
                props: { allowsGrouping: set(true) },
                label: "groupable",
              }),
            );
            ws.execute(
              C.setFields({
                targets: columnOf("amount"),
                props: { aggregate: set("sum") },
                label: "aggregate",
              }),
            );
          });
        if (CHECK_AUTHORED_GROUP)
          step("authored group", () => {
            const columnOf = (key) =>
              all(table(), "Column")
                .map(owned)
                .filter((x) => x && g.getEntry(x)?.props?.key?.value === key)
                .map((x) => ({ kind: "node", id: x }));
            ws.execute(
              C.setFields({
                targets: columnOf("dept"),
                props: { defaultGrouped: set(true) },
                label: "grouped",
              }),
            );
            ws.execute(
              C.setFields({
                targets: columnOf("amount"),
                props: { aggregate: set("sum") },
                label: "aggregate",
              }),
            );
          });
        if (CHECK_TOTALS)
          step("totals", () => {
            const columnOf = (key) =>
              all(table(), "Column")
                .map(owned)
                .filter((x) => x && g.getEntry(x)?.props?.key?.value === key)
                .map((x) => ({ kind: "node", id: x }));
            for (const [key, fn] of [
              ["name", "count"],
              ["amount", "sum"],
              ["qty", "mean"],
            ])
              ws.execute(
                C.setFields({
                  targets: columnOf(key),
                  props: { aggregate: set(fn) },
                  label: "aggregate",
                }),
              );
            ws.execute(
              C.setTableTotalsRow({
                tableId: id,
                on: true,
                buildCell: () => {
                  const cell = node(
                    h.palette.catalogPaletteDefinitionId(g.library, "Cell"),
                  );
                  return { entries: [cell], rootId: cell.id };
                },
                buildRow: (cellIds) => ({
                  ...node(
                    h.palette.catalogPaletteDefinitionId(g.library, "Row"),
                  ),
                  children: [...cellIds],
                }),
                newId: ws.newId,
              }),
            );
          });
        if (CHECK_DETAIL)
          step("detail", () =>
            ws.execute(
              C.setTableDetailRow({
                tableId: id,
                on: true,
                buildCell: () => {
                  const cell = node(
                    h.palette.catalogPaletteDefinitionId(g.library, "Cell"),
                  );
                  return { entries: [cell], rootId: cell.id };
                },
                buildRow: (cellIds) => ({
                  ...node(
                    h.palette.catalogPaletteDefinitionId(g.library, "Row"),
                  ),
                  children: [...cellIds],
                }),
                newId: ws.newId,
              }),
            ),
          );
        if (CHECK_ROWPIN)
          step("row pinning", () =>
            ws.execute(
              C.setFields({
                targets: [{ kind: "node", id }],
                props: { allowsRowPinning: set(true) },
                label: "row pinning",
              }),
            ),
          );
        if (CHECK_AUTHORED)
          step("authored sort", () =>
            ws.execute(
              h.binding.catalogBindingCommand([{ kind: "node", id }], {
                ...h.binding.catalogBindingRef({
                  source: "dataTable",
                  collectionId: "grid",
                  name: "Grid",
                }),
                view: {
                  where: { id: "where", op: "and", items: [] },
                  sort: [
                    { field: ["data:field:f-dept"], direction: "ascending" },
                    { field: ["data:field:f-amount"], direction: "descending" },
                  ],
                },
              }),
            ),
          );
        if (CHECK_DRAG)
          step("reorder", () =>
            ws.execute(
              C.setFields({
                targets: [{ kind: "node", id }],
                props: { allowsColumnReordering: set(true) },
                label: "reorder",
              }),
            ),
          );
        if (PROFILE_COLUMNS) {
          step("column menu", () =>
            ws.execute(
              C.setFields({
                targets: all(table(), "Column")
                  .map(owned)
                  .filter((x) => x && g.getEntry(x))
                  .map((x) => ({ kind: "node", id: x })),
                props: { allowsHiding: set(true), allowsPinning: set(true) },
                label: "column menu",
              }),
            ),
          );
          step("reorder", () =>
            ws.execute(
              C.setFields({
                targets: [{ kind: "node", id }],
                props: { allowsColumnReordering: set(true) },
                label: "reorder",
              }),
            ),
          );
        }
        const e = g.getEntry(id);
        out.rowDisplay = e.rowDisplay;
        out.binding = !!e.binding;
        out.columns = all(table(), "Column").map((c) => ({
          id: owned(c),
          props: g.getEntry(owned(c))?.props ?? null,
        }));
        return out;
      },
      {
        COLUMNS,
        DISPLAY,
        COLUMN_ORIGIN,
        CHECK_PIN,
        CHECK_RESIZE,
        CHECK_FILTER,
        CHECK_GROUP,
        // (`--check-server group`: the authored grouping · the totals row; `pin`: row pinning.)
        CHECK_AUTHORED_GROUP: CHECK_AUTHORED_GROUP || SERVER_GROUP,
        CHECK_TOTALS: CHECK_TOTALS || SERVER_GROUP,
        CHECK_TREE,
        CHECK_DETAIL,
        CHECK_ROWPIN: CHECK_ROWPIN || SERVER_PIN,
        CHECK_DRAG,
        CHECK_AUTHORED,
        PROFILE_COLUMNS,
      },
    );
    log(`setup ${JSON.stringify(setup).slice(0, 1500)}`);
    results.setup = setup;
    if (setup.steps.some(([, r]) => r !== "ok"))
      throw new Error("setup failed");
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/builder.png` });
    if (CHECK_TREE || CHECK_DETAIL) {
      // (The Builder's Canvas: the body's top rows — each closed, no child Row inside it, the
      //  first data cell of a row with child rows marked for its chevron.)
      results.treeBuilder = await page.evaluate(() => {
        const root = window.__COMPOSITION_CATALOG__.workspace.root;
        const records = [...root.canvasInputs.values()];
        const rows = records.filter(
          (r) =>
            r.ruleId === "Row" &&
            r.rowIndex !== undefined &&
            root.canvasInputs.get(r.parentId)?.ruleId === "TableBody",
        );
        const cellsOf = (row) =>
          row.children
            .map((c) => root.canvasInputs.get(c))
            .filter(
              (c) =>
                c?.ruleId === "Cell" &&
                !c.children.some(
                  (part) =>
                    root.canvasInputs.get(part)?.props?.slot === "selection",
                ),
            );
        return {
          rows: rows.length,
          nested: rows.reduce(
            (n, row) =>
              n +
              row.children.filter(
                (c) => root.canvasInputs.get(c)?.ruleId === "Row",
              ).length,
            0,
          ),
          ids: rows.slice(0, 3).map((row) => row.props.id ?? null),
          marks: rows
            .slice(0, 3)
            .map((row) =>
              cellsOf(row).map((cell) => cell.props._treeCell ?? null),
            ),
        };
      });
      log(`tree builder ${JSON.stringify(results.treeBuilder)}`);
    }
    if (CHECK_TOTALS) {
      // (The Builder's Canvas: the footer's row — its cells' texts by the header's keys.)
      results.totalsBuilder = await page.evaluate(() => {
        const root = window.__COMPOSITION_CATALOG__.workspace.root;
        const records = [...root.canvasInputs.values()];
        const footer = records.find((r) => r.ruleId === "TableFooter");
        const row = footer?.children
          .map((c) => root.canvasInputs.get(c))
          .find((r) => r?.ruleId === "Row");
        const header = records.find((r) => r.ruleId === "TableHeader");
        const keys = (header?.children ?? [])
          .map((c) => root.canvasInputs.get(c))
          .filter((c) => c?.ruleId === "Column")
          .map((c) => String(c.props.key ?? ""));
        const cells = (row?.children ?? [])
          .map((c) => root.canvasInputs.get(c))
          .filter((c) => c?.ruleId === "Cell");
        return Object.fromEntries(
          keys.map((key, at) => [
            key,
            String(cells[at]?.props?.children ?? ""),
          ]),
        );
      });
      log(`totals builder ${JSON.stringify(results.totalsBuilder)}`);
    }
    if (CHECK_AUTHORED_GROUP) {
      // (The Builder's Canvas: the Table's body rows as records — each a closed group row, the
      //  grouped cell marked for its chevron, no child row inside it.)
      results.authoredGroupBuilder = await page.evaluate(() => {
        const root = window.__COMPOSITION_CATALOG__.workspace.root;
        const records = [...root.canvasInputs.values()];
        const rows = records.filter(
          (r) =>
            r.ruleId === "Row" &&
            r.rowIndex !== undefined &&
            root.canvasInputs.get(r.parentId)?.ruleId === "TableBody",
        );
        // (The selection column's cell — its `Checkbox[slot=selection]` — is no data cell.)
        const cellsOf = (row) =>
          row.children
            .map((c) => root.canvasInputs.get(c))
            .filter(
              (c) =>
                c?.ruleId === "Cell" &&
                !c.children.some(
                  (part) =>
                    root.canvasInputs.get(part)?.props?.slot === "selection",
                ),
            );
        const header = records.find((r) => r.ruleId === "TableHeader");
        return {
          headers: (header?.children ?? [])
            .map((c) => root.canvasInputs.get(c))
            .filter((c) => c?.ruleId === "Column" && !c.hidden)
            .map((c) => String(c.props.key ?? "")),
          rows: rows.length,
          nested: rows.reduce(
            (n, row) =>
              n +
              row.children.filter(
                (c) => root.canvasInputs.get(c)?.ruleId === "Row",
              ).length,
            0,
          ),
          first: rows.slice(0, 3).map((row) =>
            cellsOf(row).map((cell) => ({
              text: cell.props.children ?? "",
              tree: cell.props._treeCell ?? null,
            })),
          ),
        };
      });
      log(
        `authored group builder ${JSON.stringify(results.authoredGroupBuilder)}`,
      );
    }
    if (CHECK_AUTHORED) {
      // (The Builder's Canvas — the authored layer: each Column's content wrapper record carries
      //  its mark, the engine lays the mark part out before the name.)
      results.authoredBuilder = await page.evaluate(() => {
        const root = window.__COMPOSITION_CATALOG__.workspace.root;
        const records = [...root.canvasInputs.values()];
        const table = records.find(
          (r) => r.sourceId === "project:node:dg-table" && r.ruleId === "Table",
        );
        const marks = records
          .filter((r) => r.derivedProps?._sortMark)
          .map((r) => {
            const column = root.canvasInputs.get(r.parentId);
            const part = `${r.id}::part:sort`;
            const name = r.children.find(
              (c) => root.canvasInputs.get(c)?.bindingId === "text",
            );
            const rects = root.getGeometry([part, ...(name ? [name] : [])]);
            return {
              column: column?.props?.children ?? column?.props?.key,
              mark: r.derivedProps._sortMark,
              fontSize: r.visual.fontSize ?? r.inheritedText?.fontSize ?? null,
              part: rects.get(part) ?? null,
              nameX: name ? (rects.get(name)?.x ?? null) : null,
            };
          });
        return { authoredSort: table?.props?._authoredSort ?? null, marks };
      });
      log(`authored builder ${JSON.stringify(results.authoredBuilder)}`);
    }
    if (
      CHECK_REMEMBER ||
      CHECK_MULTISORT ||
      CHECK_SEARCH ||
      CHECK_FACET ||
      PROFILE_COLUMNS
    ) {
      await page.evaluate(() => {
        const ws = window.__COMPOSITION_CATALOG__.workspace;
        const record = [...ws.root.canvasInputs.values()].find(
          (r) => r.sourceId === "project:node:dg-table",
        );
        ws.selectRecords([record.id]);
      });
      await page.waitForTimeout(1000);
      // (Design 패널을 열고 Property 탭으로 — 닫힌 패널 · 구획은 내용을 그리지 않는다.)
      await page.getByRole("button", { name: "Design", exact: true }).click();
      await page.waitForTimeout(800);
      const propertyTab = page.getByRole("tab", { name: /propert|속성/i });
      if (await propertyTab.count()) {
        await propertyTab.first().click();
        await page.waitForTimeout(600);
      }
      // (접힌 구획을 펼친다 — Behavior 구획에 Table 의 상태 스위치들이 있다.)
      const behavior = page.getByRole("button", {
        name: "Behavior",
        exact: true,
      });
      if ((await behavior.getAttribute("aria-expanded")) === "false") {
        await behavior.click();
        await page.waitForTimeout(500);
      }
      if (process.argv.includes("--list-buttons"))
        log(
          `panel ${JSON.stringify(
            await page.evaluate(() =>
              [...document.querySelectorAll("button, [role=switch]")]
                .map(
                  (el) =>
                    `${el.getAttribute("role") ?? "button"}[${el.getAttribute("aria-pressed") ?? el.getAttribute("aria-checked") ?? el.getAttribute("aria-expanded") ?? ""}]:${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 30)}`,
                )
                .slice(-40),
            ),
          )}`,
        );
      // (boolean prop 은 누르는 칩이다 — 패널의 다른 boolean 「Quiet」 과 같은 컨트롤.)
      const toggle = page.getByRole("button", {
        name: /^(remember state|상태 기억)$/i,
      });
      results.rememberSwitch = { shown: await toggle.count() };
      if (CHECK_REMEMBER === "on" && results.rememberSwitch.shown) {
        await toggle.first().click({ force: true });
        await page.waitForTimeout(800);
      }
      // (문서의 prop — 작성 값은 `{ kind: "set", value }` 로 적힌다.)
      results.rememberSwitch.prop = await page.evaluate(
        () =>
          window.__COMPOSITION_CATALOG__.workspace.root.runtime.graph.getEntry(
            "project:node:dg-table",
          )?.props?.rememberState?.value ?? null,
      );
      log(`remember switch ${JSON.stringify(results.rememberSwitch)}`);
      if (PROFILE_COLUMNS) {
        const chip = page.getByRole("switch", {
          name: /^(column visibility menu|열 선택 메뉴)$/i,
        });
        results.chooserSwitch = { shown: await chip.count() };
        if (results.chooserSwitch.shown) {
          // (RAC Switch: the role is on its visually hidden input — a pointer click at its box
          //  did not toggle it; the input's own click does, as a keyboard Space would.)
          await chip.first().evaluate((el) => el.click());
          await page.waitForTimeout(1500);
        }
        results.chooserSwitch.checked = await chip.first().isChecked();
        log(`chooser switch ${JSON.stringify(results.chooserSwitch)}`);
      }
      if (CHECK_MULTISORT) {
        const chip = page.getByRole("button", {
          name: /^(multi-column sort|여러 열 정렬)$/i,
        });
        results.multiSortSwitch = { shown: await chip.count() };
        if (results.multiSortSwitch.shown) {
          await chip.first().click({ force: true });
          await page.waitForTimeout(800);
        }
        results.multiSortSwitch.prop = await page.evaluate(
          () =>
            window.__COMPOSITION_CATALOG__.workspace.root.runtime.graph.getEntry(
              "project:node:dg-table",
            )?.props?.allowsMultiSort?.value ?? null,
        );
        log(`multi-sort switch ${JSON.stringify(results.multiSortSwitch)}`);
      }
      if (CHECK_SEARCH) {
        const rules = () =>
          page.evaluate(() => {
            const g =
              window.__COMPOSITION_CATALOG__.workspace.root.runtime.graph;
            const project = g.getEntry(g.projectId);
            return (project?.interactionIds ?? [])
              .map((id) => g.getEntry(id))
              .filter((rule) =>
                (rule?.actions ?? []).some(
                  (action) => action.capabilityId === "setSearchText",
                ),
              )
              .map((rule) => ({
                trigger: rule.trigger,
                owner: g.getEntry(rule.ownerId)?.definitionId ?? null,
                target: rule.actions[0]?.target ?? null,
              }));
          });
        const toggleSearch = page.getByRole("switch", {
          name: /^(search|검색)$/i,
        });
        results.searchSwitch = { shown: await toggleSearch.count() };
        if (results.searchSwitch.shown) {
          // (RAC Switch — 보이는 것은 감싸는 label 이다: 그 한가운데를 누른다.)
          const label = toggleSearch
            .first()
            .locator("xpath=ancestor::label[1]");
          await label.scrollIntoViewIfNeeded();
          await page.waitForTimeout(300);
          const box = await label.boundingBox();
          results.searchSwitch.box = box;
          if (box)
            await page.mouse.click(
              box.x + box.width / 2,
              box.y + box.height / 2,
            );
          await page.waitForTimeout(1500);
          results.searchSwitch.checked = await toggleSearch
            .first()
            .isChecked()
            .catch(() => null);
        }
        results.searchSwitch.rules = await rules();
        if (SEARCH_FUZZY) {
          // (「Search match」 — 값 둘짜리 고르기: 패널의 「Fuzzy」 를 누른다.)
          const fuzzy = page
            .locator("[role=radio], [role=option], button, label")
            .filter({ hasText: /^(Fuzzy|유사)$/ });
          let through = "panel";
          if (await fuzzy.count()) {
            await fuzzy.first().click({ force: true });
            await page.waitForTimeout(800);
          } else through = "no control";
          results.searchSwitch.match = await page.evaluate(
            () =>
              window.__COMPOSITION_CATALOG__.workspace.root.runtime.graph.getEntry(
                "project:node:dg-table",
              )?.props?.searchMatch?.value ?? null,
          );
          results.searchSwitch.matchThrough = through;
        }
        log(`search switch ${JSON.stringify(results.searchSwitch)}`);
      }
      if (CHECK_FACET) {
        const add = page.getByRole("button", {
          name: /^(Add search|검색 추가)$/,
        });
        results.facetAdd = { shown: await add.count() };
        if (results.facetAdd.shown) {
          await add.first().scrollIntoViewIfNeeded();
          await add.first().click();
          await page.waitForTimeout(600);
          const form = page.locator(".data-view-add-form");
          // (양식의 고르기 둘 — 필드 · 컨트롤: 각각 눌러 목록에서 고른다.)
          const pick = async (index, text) => {
            await form.locator("button").nth(index).click();
            await page.waitForTimeout(400);
            const option = page.getByRole("option").filter({ hasText: text });
            const found = await option.count();
            if (found) await option.first().click();
            else await page.keyboard.press("Escape");
            await page.waitForTimeout(400);
            return found;
          };
          results.facetAdd.field = await pick(0, /^city$/);
          results.facetAdd.control = await pick(1, /^RadioGroup/);
          await form.getByRole("button", { name: /^(Create|생성)$/ }).click();
          await page.waitForTimeout(1500);
        }
        // (문서: 새 RadioGroup 이 후보 값 보기 — `facet` — 에 연결됐다.)
        results.facetAdd.bound = await page.evaluate(() => {
          const ws = window.__COMPOSITION_CATALOG__.workspace;
          const g = ws.root.runtime.graph;
          const out = [];
          const seen = new Set();
          for (const record of ws.root.canvasInputs.values()) {
            if (record.ruleId !== "RadioGroup" || seen.has(record.sourceId))
              continue;
            seen.add(record.sourceId);
            const node = g.getEntry(record.sourceId);
            const view = node?.binding?.viewId
              ? g.getEntry(node.binding.viewId)
              : undefined;
            out.push({
              facet: view?.facet === true,
              groupBy: view?.groupBy ?? null,
            });
          }
          return out;
        });
        log(`facet add ${JSON.stringify(results.facetAdd)}`);
      }
      await page.screenshot({ path: `${OUT}/builder-remember.png` });
      await page.waitForTimeout(1500);
    }

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
        ({ OURS, GROUPED }) =>
          [...document.querySelectorAll(`${OURS} [role=row]`)].some((row) =>
            (GROUPED ? /Dept \d+ \(\d+\)/ : /Person \d+/).test(
              row.textContent ?? "",
            ),
          ),
        { OURS, GROUPED: CHECK_AUTHORED_GROUP || SERVER_GROUP },
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

    if (CHECK_REMEMBER) {
      const state = () =>
        pub.evaluate((OURS) => {
          const table = document.querySelector(OURS);
          const heads = [...table.querySelectorAll("[role=columnheader]")];
          const at = heads.findIndex((el) =>
            (el.textContent ?? "").trim().startsWith("Name"),
          );
          return {
            sort: heads[at]?.getAttribute("aria-sort") ?? null,
            names: [...table.querySelectorAll("[role=row]")]
              .filter((row) => !row.querySelector("[role=columnheader]"))
              .map((row) =>
                (
                  row.querySelectorAll("[role=rowheader], [role=gridcell]")[at]
                    ?.textContent ?? ""
                ).trim(),
              )
              .filter(Boolean)
              .slice(0, 5),
            kept: Object.keys(localStorage)
              .filter((key) => key.startsWith("composition:table-state:"))
              .map((key) => localStorage.getItem(key)),
          };
        }, OURS);
      const rows = () =>
        pub.waitForFunction(
          (OURS) =>
            [...document.querySelectorAll(`${OURS} [role=row]`)].some((row) =>
              /Person \d+/.test(row.textContent ?? ""),
            ),
          OURS,
          { timeout: 60000 },
        );
      const opened = await state();
      const head = await pub.evaluate((OURS) => {
        const el = [
          ...document
            .querySelector(OURS)
            .querySelectorAll("[role=columnheader]"),
        ].find((h) => (h.textContent ?? "").trim().startsWith("Name"));
        const r = el.getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }, OURS);
      await pub.mouse.click(head.x, head.y);
      await pub.waitForTimeout(1500);
      const sorted = await state();
      await pub.reload();
      await rows();
      await pub.waitForTimeout(1000);
      const reloaded = await state();
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      results.checkRemember = {
        mode: CHECK_REMEMBER,
        switch: results.rememberSwitch,
        opened,
        sorted,
        reloaded,
        pass:
          sorted.sort === "ascending" &&
          !same(sorted.names, opened.names) &&
          (CHECK_REMEMBER === "on"
            ? results.rememberSwitch?.prop === true &&
              sorted.kept.length === 1 &&
              reloaded.sort === "ascending" &&
              same(reloaded.names, sorted.names)
            : sorted.kept.length === 0 &&
              reloaded.sort !== "ascending" &&
              same(reloaded.names, opened.names)),
      };
      log(`check-remember ${JSON.stringify(results.checkRemember)}`);
      await pub.screenshot({ path: `${OUT}/check-remember.png` });
      throw new Error("load only");
    }

    if (CHECK_MULTISORT) {
      const state = () =>
        pub.evaluate((OURS) => {
          const table = document.querySelector(OURS);
          const heads = [...table.querySelectorAll("[role=columnheader]")];
          const label = (el) =>
            (el.textContent ?? "").replace(/^\d+/, "").trim();
          const at = (name) => heads.findIndex((el) => label(el) === name);
          const cell = (row, index) =>
            (
              row.querySelectorAll("[role=rowheader], [role=gridcell]")[index]
                ?.textContent ?? ""
            ).trim();
          return {
            ariaSort: heads
              .filter(
                (el) =>
                  el.getAttribute("aria-sort") &&
                  el.getAttribute("aria-sort") !== "none",
              )
              .map((el) => `${label(el)}:${el.getAttribute("aria-sort")}`),
            marks: heads.flatMap((el) => {
              const mark = el.querySelector(".sort-order");
              return mark
                ? [
                    `${label(el)}:${mark.textContent}:${el.querySelector(".sort-indicator")?.getAttribute("data-sort-direction")}`,
                  ]
                : [];
            }),
            rows: [...table.querySelectorAll("[role=row]")]
              .filter((row) => !row.querySelector("[role=columnheader]"))
              .map(
                (row) =>
                  `${cell(row, at("Name"))}|${cell(row, at("Dept"))}|${cell(row, at("Amount"))}`,
              )
              .filter((text) => text.startsWith("Person"))
              .slice(0, 8),
          };
        }, OURS);
      const press = async (name, shift) => {
        const head = await pub.evaluate(
          ({ OURS, name }) => {
            const el = [
              ...document
                .querySelector(OURS)
                .querySelectorAll("[role=columnheader]"),
            ].find(
              (h) => (h.textContent ?? "").replace(/^\d+/, "").trim() === name,
            );
            const r = el.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
          },
          { OURS, name },
        );
        if (shift) await pub.keyboard.down("Shift");
        await pub.mouse.click(head.x, head.y);
        if (shift) await pub.keyboard.up("Shift");
        await pub.waitForTimeout(1500);
      };
      // (따로 계산한 순서 — 이 파일의 행 생성기에서: Dept 번호 오름, 그 안에서 Amount 내림.)
      const dept = (row) => Number(row.dept.replace("Dept ", ""));
      const expected = (rows) =>
        rows.slice(0, 8).map((row) => `${row.name}|${row.dept}|${row.amount}`);
      const all = makeRows(ROWS);
      const byDept = [...all].sort((a, b) => dept(a) - dept(b));
      const byDeptAmount = [...all].sort(
        (a, b) => dept(a) - dept(b) || b.amount - a.amount,
      );
      const opened = await state();
      await press("Dept", false);
      const one = await state();
      await press("Amount", true);
      await press("Amount", true);
      const two = await state();
      await pub.screenshot({ path: `${OUT}/check-multisort-two.png` });
      // (Shift 없이 누르면 그 열 하나만 — 목록이 사라진다.)
      await press("Name", false);
      const back = await state();
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      results.checkMultiSort = {
        switch: results.multiSortSwitch,
        opened,
        one,
        two,
        back,
        expectedOne: expected(byDept),
        expectedTwo: expected(byDeptAmount),
        pass:
          results.multiSortSwitch?.prop === true &&
          same(one.ariaSort, ["Dept:ascending"]) &&
          one.marks.length === 0 &&
          same(one.rows, expected(byDept)) &&
          same(two.ariaSort, ["Dept:ascending"]) &&
          same(two.marks, ["Dept:1:ascending", "Amount:2:descending"]) &&
          same(two.rows, expected(byDeptAmount)) &&
          same(back.ariaSort, ["Name:ascending"]) &&
          back.marks.length === 0,
      };
      log(`check-multisort ${JSON.stringify(results.checkMultiSort)}`);
      await pub.screenshot({ path: `${OUT}/check-multisort.png` });
      throw new Error("load only");
    }

    if (CHECK_AUTHORED) {
      const errors = [];
      pub.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      pub.on("pageerror", (e) => errors.push(String(e)));
      const state = () =>
        pub.evaluate((OURS) => {
          const table = document.querySelector(OURS);
          const heads = [...table.querySelectorAll("[role=columnheader]")];
          const label = (el) =>
            (el.textContent ?? "").replace(/^\d+/, "").trim();
          const at = (name) => heads.findIndex((el) => label(el) === name);
          const cell = (row, index) =>
            (
              row.querySelectorAll("[role=rowheader], [role=gridcell]")[index]
                ?.textContent ?? ""
            ).trim();
          const mark = table.querySelector(".sort-mark");
          return {
            ariaSort: heads
              .filter(
                (el) =>
                  el.getAttribute("aria-sort") &&
                  el.getAttribute("aria-sort") !== "none",
              )
              .map((el) => `${label(el)}:${el.getAttribute("aria-sort")}`),
            arrows: heads.flatMap((el) => {
              const arrow = el.querySelector(".sort-indicator");
              const order = el.querySelector(".sort-order");
              return arrow
                ? [
                    `${label(el)}:${arrow.getAttribute("data-sort-direction")}${order ? `:${order.textContent}` : ""}`,
                  ]
                : [];
            }),
            // (The mark box: arrow · order as one — its width against the Canvas's formula.)
            markBox: mark
              ? {
                  // (The arrow's color = the header name's — the Canvas paints it in the name
                  //  Text's color.)
                  arrowColor: getComputedStyle(
                    mark.querySelector(".sort-indicator"),
                  ).color,
                  nameColor: (() => {
                    const head = mark.closest("[role=columnheader]");
                    const leaf = [...head.querySelectorAll("*")].find(
                      (el) =>
                        !el.children.length &&
                        !el.closest(".sort-mark") &&
                        el.textContent.trim() === label(head),
                    );
                    return leaf ? getComputedStyle(leaf).color : null;
                  })(),
                  width: mark.getBoundingClientRect().width,
                  height: mark.getBoundingClientRect().height,
                  fontSize: parseFloat(
                    getComputedStyle(mark.parentElement).fontSize,
                  ),
                }
              : null,
            rows: [...table.querySelectorAll("[role=row]")]
              .filter((row) => !row.querySelector("[role=columnheader]"))
              .map(
                (row) =>
                  `${cell(row, at("Name"))}|${cell(row, at("Dept"))}|${cell(row, at("Amount"))}`,
              )
              .filter((text) => text.startsWith("Person"))
              .slice(0, 8),
          };
        }, OURS);
      const press = async (name) => {
        const head = await pub.evaluate(
          ({ OURS, name }) => {
            const el = [
              ...document
                .querySelector(OURS)
                .querySelectorAll("[role=columnheader]"),
            ].find(
              (h) => (h.textContent ?? "").replace(/^\d+/, "").trim() === name,
            );
            const r = el.getBoundingClientRect();
            return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
          },
          { OURS, name },
        );
        await pub.mouse.click(head.x, head.y);
        await pub.waitForTimeout(1500);
      };
      // (따로 계산한 순서 — 이 파일의 행 생성기에서.)
      const dept = (row) => Number(row.dept.replace("Dept ", ""));
      const expected = (rows) =>
        rows.slice(0, 8).map((row) => `${row.name}|${row.dept}|${row.amount}`);
      const all = makeRows(ROWS);
      const authored = [...all].sort(
        (a, b) => dept(a) - dept(b) || b.amount - a.amount,
      );
      // (A press on Amount: ascending — a stable sort over the authored order.)
      const byAmount = [...authored].sort((a, b) => a.amount - b.amount);
      const opened = await state();
      await pub.screenshot({ path: `${OUT}/check-authored-opened.png` });
      await press("Amount");
      const pressed = await state();
      await pub.screenshot({ path: `${OUT}/check-authored-pressed.png` });
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      // (Arrow 16 · 2 · one digit 7.2 — fixed px on both sides, `CATALOG_SORT_MARK`.)
      const formula = () => 16 + 2 + 7.2;
      const builder = results.authoredBuilder;
      results.checkAuthored = {
        builder,
        opened,
        pressed,
        expectedOpened: expected(authored),
        expectedPressed: expected(byAmount),
        errors,
        pass:
          same(
            builder?.marks.map((m) => `${m.column}:${m.mark}`),
            ["Dept:ascending:1", "Amount:descending:2"],
          ) &&
          builder.marks.every(
            (m) =>
              m.part &&
              Math.abs(m.part.width - formula(m.fontSize)) < 0.01 &&
              m.part.height === 16 &&
              m.nameX >= m.part.x + m.part.width + 8 - 0.01,
          ) &&
          same(opened.ariaSort, ["Dept:ascending"]) &&
          same(opened.arrows, ["Dept:ascending:1", "Amount:descending:2"]) &&
          !!opened.markBox &&
          Math.abs(opened.markBox.width - formula(opened.markBox.fontSize)) <
            0.5 &&
          opened.markBox.arrowColor === opened.markBox.nameColor &&
          same(opened.rows, expected(authored)) &&
          same(pressed.ariaSort, ["Amount:ascending"]) &&
          same(pressed.arrows, ["Amount:ascending"]) &&
          same(pressed.rows, expected(byAmount)) &&
          errors.length === 0,
      };
      log(`check-authored ${JSON.stringify(results.checkAuthored)}`);
      throw new Error("load only");
    }

    if (CHECK_DRAG) {
      const errors = [];
      pub.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      pub.on("pageerror", (e) => errors.push(String(e)));
      const heads = () =>
        pub.evaluate(
          (OURS) =>
            [...document.querySelectorAll(`${OURS} [role=columnheader]`)]
              .map((el) =>
                [...el.childNodes]
                  .filter(
                    (n) =>
                      !(
                        n instanceof Element &&
                        (n.classList.contains("catalog-column-drag-handle") ||
                          n.classList.contains("catalog-column-drop"))
                      ),
                  )
                  .map((n) => n.textContent ?? "")
                  .join("")
                  .trim(),
              )
              .join(","),
          OURS,
        );
      const sorted = () =>
        pub.evaluate(
          (OURS) =>
            [...document.querySelectorAll(`${OURS} [role=columnheader]`)]
              .map((el) => el.getAttribute("aria-sort"))
              .filter((v) => v && v !== "none")
              .join(","),
          OURS,
        );
      const box = (label, selector) =>
        pub.evaluate(
          ({ OURS, label, selector }) => {
            const head = [
              ...document.querySelectorAll(`${OURS} [role=columnheader]`),
            ].find((el) => (el.textContent ?? "").trim().startsWith(label));
            const el = selector ? head?.querySelector(selector) : head;
            const r = el?.getBoundingClientRect();
            return r ? { x: r.x, y: r.y, w: r.width, h: r.height } : null;
          },
          { OURS, label, selector },
        );
      const settle = () => pub.waitForTimeout(600);
      const before = await heads();
      const handles = await pub.evaluate(
        (OURS) =>
          document.querySelectorAll(`${OURS} .catalog-column-drag-handle`)
            .length,
        OURS,
      );
      // 포인터: Name 의 손잡이 → Amount 머리글 (정중앙을 누르지 않는다 — react-aria 의 TalkBack 판정).
      const nameHead = await box("Name");
      await pub.mouse.move(
        nameHead.x + nameHead.w / 2,
        nameHead.y + nameHead.h / 2,
      );
      await settle();
      const handle = await box("Name", ".catalog-column-drag-handle");
      const handleShown = await pub.evaluate(
        (OURS) =>
          getComputedStyle(
            document.querySelector(`${OURS} .catalog-column-drag-handle`),
          ).opacity,
        OURS,
      );
      let pointerError = null;
      try {
        await pub.mouse.move(handle.x + 3, handle.y + handle.h / 2 - 4);
        await pub.mouse.down();
        await pub.mouse.move(handle.x + 20, handle.y + handle.h / 2, {
          steps: 5,
        });
        const amount = await box("Amount");
        await pub.mouse.move(amount.x + amount.w / 2, amount.y + amount.h / 2, {
          steps: 12,
        });
        await pub.waitForTimeout(150);
        await pub.mouse.up();
      } catch (error) {
        pointerError = String(error).split("\n")[0];
      }
      await settle();
      const afterPointer = await heads();
      const dropsLeft = await pub.evaluate(
        (OURS) =>
          document.querySelectorAll(`${OURS} .catalog-column-drop`).length,
        OURS,
      );
      // 키보드: Date 손잡이에서 Enter → Tab → Enter.
      await pub
        .locator(`${OURS} [role=columnheader]`, { hasText: "Date" })
        .locator(".catalog-column-drag-handle")
        .focus();
      await pub.keyboard.press("Enter");
      await settle();
      const started = await pub.evaluate(
        (OURS) =>
          !!document.querySelector(
            `${OURS} .catalog-column-drag-handle[data-dragging]`,
          ),
        OURS,
      );
      const targets = await pub.evaluate(
        (OURS) =>
          document.querySelectorAll(`${OURS} .catalog-column-drop`).length,
        OURS,
      );
      await pub.keyboard.press("Tab");
      await settle();
      const target = await pub.evaluate(
        () => document.activeElement?.getAttribute("aria-label") ?? null,
      );
      await pub.keyboard.press("Enter");
      await settle();
      const afterKey = await heads();
      const sortAfterDrags = await sorted();
      // 끌기 뒤 머리글 클릭 = 정렬 (Qty — 메뉴의 「Sort Ascending」 이 아니라 머리글 누름: 메뉴가 열리면
      //  첫 항목을 고른다).
      const qty = await box("Qty");
      await pub.mouse.click(qty.x + qty.w / 2, qty.y + qty.h / 2);
      await settle();
      // (WebKit: the first press after a native (pointer) drag gets no `pointerdown` — mousedown only,
      //  so react-aria's press does not start. A second click sorts. Not ours: Phase 0 S5's plain
      //  react-aria prototype too. Recorded, not hidden: `firstClickEaten`.)
      const firstClickEaten = (await sorted()) === "";
      if (firstClickEaten) {
        await pub.mouse.click(qty.x + qty.w / 2, qty.y + qty.h / 2);
        await settle();
      }
      const menuOpen = await pub.evaluate(
        () => !!document.querySelector("[role=menu]"),
      );
      if (menuOpen) {
        await pub
          .getByRole("menuitem", { name: /Sort Ascending|오름차순/ })
          .click();
        await settle();
      }
      const sortAfterClick = await sorted();
      results.checkDrag = {
        before,
        handles,
        handleShown,
        afterPointer,
        pointerError,
        dropsLeft,
        started,
        targets,
        target,
        afterKey,
        sortAfterDrags,
        menuOpen,
        firstClickEaten,
        sortAfterClick,
        errors,
        pass:
          before === "Name,Dept,City,Amount,Qty,Date" &&
          handles === 6 &&
          handleShown === "1" &&
          afterPointer === "Dept,City,Amount,Name,Qty,Date" &&
          dropsLeft === 0 &&
          started &&
          targets === 5 &&
          afterKey !== afterPointer &&
          afterKey.split(",").length === 6 &&
          sortAfterDrags === "" &&
          sortAfterClick === "ascending" &&
          (BROWSER === "webkit" || !firstClickEaten) &&
          errors.length === 0,
      };
      log(`check-drag ${JSON.stringify(results.checkDrag)}`);
      await pub.screenshot({ path: `${OUT}/check-drag.png` });
      throw new Error("load only");
    }

    if (CHECK_RESIZE) {
      const measure = () =>
        pub.evaluate((OURS) => {
          const table = document.querySelector(OURS);
          const head = [...table.querySelectorAll("[role=columnheader]")].find(
            (el) => (el.textContent ?? "").trim().startsWith("Name"),
          );
          const handle = head?.querySelector(
            ".react-aria-ColumnResizer, [role=separator]",
          );
          const r = head?.getBoundingClientRect();
          const h = handle?.getBoundingClientRect();
          return {
            head: r ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null,
            hit: h
              ? (() => {
                  const el = document.elementFromPoint(
                    h.x + h.width / 2,
                    h.y + h.height / 2,
                  );
                  return `${el?.tagName}.${el?.className}`;
                })()
              : null,
            width: r ? Math.round(r.width) : null,
            handle: h ? { x: h.x + h.width / 2, y: h.y + h.height / 2 } : null,
            kept: Object.keys(localStorage)
              .filter((key) => key.startsWith("composition:table-state:"))
              .map((key) => localStorage.getItem(key)),
          };
        }, OURS);
      // (S2: the handle shows while the column is hovered.)
      const hovered = async () => {
        const at = await measure();
        if (at.head) await pub.mouse.move(at.head.x, at.head.y);
        await pub.waitForTimeout(300);
        return measure();
      };
      const opened = await hovered();
      if (opened.handle) {
        // (The handle's start half: its end half is under the next column's header.)
        const x0 = opened.handle.x - 3;
        await pub.mouse.move(x0, opened.handle.y);
        await pub.mouse.down();
        for (let step = 1; step <= 12; step += 1) {
          await pub.mouse.move(x0 + step * 10, opened.handle.y);
          await pub.waitForTimeout(16);
        }
        await pub.mouse.up();
      }
      await pub.waitForTimeout(1000);
      const resized = await hovered();
      await pub.reload();
      await pub.waitForFunction(
        (OURS) =>
          [...document.querySelectorAll(`${OURS} [role=row]`)].some((row) =>
            /Person \d+/.test(row.textContent ?? ""),
          ),
        OURS,
        { timeout: 60000 },
      );
      await pub.waitForTimeout(1000);
      const reloaded = await hovered();
      results.checkResize = {
        opened,
        resized,
        reloaded,
        pass:
          !!opened.handle?.x &&
          typeof opened.width === "number" &&
          resized.width >= opened.width + 100 &&
          resized.kept.length === 1 &&
          /"columnWidths":\{"name":\d/.test(resized.kept[0] ?? "") &&
          Math.abs(reloaded.width - resized.width) <= 1,
      };
      log(`check-resize ${JSON.stringify(results.checkResize)}`);
      await pub.screenshot({ path: `${OUT}/check-resize.png` });
      throw new Error("load only");
    }

    if (CHECK_PIN) {
      const measure = () =>
        pub.evaluate((OURS) => {
          const table = document.querySelector(OURS);
          const scroller =
            [table, ...table.querySelectorAll("*")].find(
              (el) => el.scrollWidth > el.clientWidth + 1,
            ) ?? table;
          const box = scroller.getBoundingClientRect();
          const rect = (el) => {
            const r = el.getBoundingClientRect();
            return {
              left: Math.round(r.left - box.left),
              right: Math.round(box.left + scroller.clientWidth - r.right),
            };
          };
          const heads = [...table.querySelectorAll("[role=columnheader]")];
          const head = (name) =>
            heads.find((el) => (el.textContent ?? "").trim() === name);
          const row = [...table.querySelectorAll("[role=row]")].find((r) =>
            /Person \d+/.test(r.textContent ?? ""),
          );
          const cells = row
            ? [...row.querySelectorAll("[role=rowheader], [role=gridcell]")]
            : [];
          const cell = (pattern) =>
            cells.find((el) => pattern.test((el.textContent ?? "").trim()));
          const detail = (el) => {
            const wrap = el.parentElement;
            const cs = getComputedStyle(wrap);
            const r = el.getBoundingClientRect();
            return `${(el.textContent ?? "").trim().slice(0, 10)}@${Math.round(r.left - box.left)} w${Math.round(r.width)} wrap[${wrap.getAttribute("role")} ${cs.position} l:${cs.left} r:${cs.right} o:${cs.order}] pin:${el.getAttribute("data-pinned")}/${el.getAttribute("data-pinned-at")}`;
          };
          const rowEl = row;
          const headRow = heads[0]?.closest("[role=row]");
          const rowInfo = (el) =>
            el
              ? `${getComputedStyle(el).display} w${Math.round(el.getBoundingClientRect().width)} x${Math.round(el.getBoundingClientRect().left - box.left)}`
              : null;
          return {
            details: {
              heads: heads.map(detail),
              cells: cells.map(detail),
              row: rowInfo(rowEl),
              headRow: rowInfo(headRow),
              vars: [0, 1, 2].map((n) =>
                getComputedStyle(table).getPropertyValue(
                  `--table-pin-end-${n}`,
                ),
              ),
            },
            scrollLeft: Math.round(scroller.scrollLeft),
            scrollWidth: scroller.scrollWidth,
            clientWidth: scroller.clientWidth,
            order: heads.map((el) => (el.textContent ?? "").trim()),
            cellCount: cells.length,
            // (고정 쪽의 경계선 — Column · Cell rule 의 `pinned-edge`: 앞 고정의 끝, 뒤 고정의 시작.)
            edge: [
              [head("Dept"), "borderRightWidth"],
              [cell(/^Dept \d+$/), "borderRightWidth"],
              [head("Date"), "borderLeftWidth"],
              [cell(/^2026-\d\d-\d\d$/), "borderLeftWidth"],
              [head("Name"), "borderRightWidth"],
              [cell(/^Person \d+$/), "borderRightWidth"],
            ].map(([el, key]) => (el ? getComputedStyle(el)[key] : null)),
            head: {
              dept: head("Dept") ? rect(head("Dept")) : null,
              date: head("Date") ? rect(head("Date")) : null,
              name: head("Name") ? rect(head("Name")) : null,
            },
            cell: {
              dept: cell(/^Dept \d+$/) ? rect(cell(/^Dept \d+$/)) : null,
              date: cell(/^2026-\d\d-\d\d$/)
                ? rect(cell(/^2026-\d\d-\d\d$/))
                : null,
              name: cell(/^Person \d+$/) ? rect(cell(/^Person \d+$/)) : null,
            },
          };
        }, OURS);
      const scrollTo = (left) =>
        pub.evaluate(
          ({ OURS, left }) => {
            const table = document.querySelector(OURS);
            const scroller =
              [table, ...table.querySelectorAll("*")].find(
                (el) => el.scrollWidth > el.clientWidth + 1,
              ) ?? table;
            scroller.scrollLeft = left;
          },
          { OURS, left },
        );
      await pub.waitForTimeout(1000);
      const rest = await measure();
      await scrollTo(700);
      await pub.waitForTimeout(1200);
      const scrolled = await measure();
      await pub.screenshot({ path: `${OUT}/check-pin.png` });
      const near = (value, want) =>
        typeof value === "number" && Math.abs(value - want) <= 2;
      results.checkPin = { browser: BROWSER, display: DISPLAY, rest, scrolled };
      results.checkPin.pass =
        // (고정 순서: Dept 가 맨 앞, Date 가 맨 뒤.)
        rest.order[0] === "Dept" &&
        rest.order.at(-1) === "Date" &&
        scrolled.scrollLeft >= 600 &&
        // (스크롤한 뒤에도 Dept 는 왼쪽 끝, Date 는 오른쪽 끝 — 머리글과 칸 둘 다.)
        near(scrolled.head.dept?.left, 0) &&
        near(scrolled.cell.dept?.left, 0) &&
        near(scrolled.head.date?.right, 0) &&
        near(scrolled.cell.date?.right, 0) &&
        // (경계선: 고정 쪽 끝 열에만 1px.)
        JSON.stringify(scrolled.edge) ===
          JSON.stringify(["1px", "1px", "1px", "1px", "0px", "0px"]) &&
        // (고정하지 않은 열은 밀려 났다 — 보이지 않거나 왼쪽 밖.)
        !(
          scrolled.head.name &&
          scrolled.head.name.left >= 0 &&
          scrolled.head.name.left < 400 - 700 + 400
        );
      log(`check-pin ${JSON.stringify(results.checkPin)}`);
      throw new Error("load only");
    }

    if (CHECK_FILTER) {
      const all = makeRows(ROWS);
      // (A virtual Table's `aria-rowcount`; a 「더 보기」 Table draws its first 100 rows and has
      //  none — its drawn data rows, against the expected count cut at 100.)
      const rowCount = () =>
        pub.evaluate((OURS) => {
          const table = document.querySelector(OURS);
          const grid = table.matches("[role=grid]")
            ? table
            : table.querySelector("[role=grid]");
          const count = grid?.getAttribute("aria-rowcount");
          if (count) return Number(count) - 1;
          return [...grid.querySelectorAll("[role=row]")].filter((row) =>
            /Person \d+/.test(row.textContent ?? ""),
          ).length;
        }, OURS);
      const shownOf = (count) =>
        DISPLAY === "more" ? Math.min(count, 100) : count;
      const header = (name) =>
        pub
          .locator(`${OURS} [role=columnheader]`)
          .filter({ hasText: new RegExp(`^${name}`) })
          .first();
      const menu = async (name, item) => {
        await header(name).locator("button").first().click();
        await pub.waitForTimeout(300);
        const items = await pub
          .locator("[role=menu] [role=menuitem]")
          .allTextContents();
        log(`menu ${name}: ${JSON.stringify(items)}`);
        await pub
          .locator("[role=menu] [role=menuitem]")
          .filter({ hasText: new RegExp(`^${item}$`) })
          .first()
          .click();
        await pub.waitForTimeout(800);
        return items.map((text) => text.trim());
      };
      const dialog = () => pub.locator("[role=dialog]").first();
      const choose = async (label) => {
        await dialog().locator(".react-aria-Select button").first().click();
        await pub.waitForTimeout(300);
        await pub
          .locator("[role=listbox] [role=option]")
          .filter({ hasText: new RegExp(`^${label}$`) })
          .first()
          .click();
        await pub.waitForTimeout(300);
      };
      const apply = async () => {
        await dialog().getByRole("button", { name: "Apply" }).click();
        await pub.waitForTimeout(1500);
      };
      await pub.waitForTimeout(1500);
      const before = await rowCount();
      // 1) Dept 「Contains」 `dept 1` (기본 감도 — 대소문자 무시)
      const deptItems = await menu("Dept", "Filter…");
      const firstOp = (
        await dialog().locator(".react-aria-SelectValue").first().textContent()
      )?.trim();
      await dialog().locator("input").first().fill("dept 1");
      await apply();
      const contains = (row) => row.dept.toLowerCase().includes("dept 1");
      const one = await rowCount();
      // 2) Amount 「At least」 5000
      await menu("Amount", "Filter…");
      await choose("At least");
      await dialog().locator("input").first().fill("5000");
      await apply();
      const two = await rowCount();
      // 3) Dept 를 다시 — 「Equals」 의 후보 값 = Amount 조건만 건 행의 부서별 수 (자기 필터 제외)
      const deptAgain = await menu("Dept", "Filter…");
      const prefilled = await dialog().locator("input").first().inputValue();
      await choose("Equals");
      await pub.screenshot({ path: `${OUT}/check-filter-dialog.png` });
      const candidates = (
        await dialog().locator("[role=listbox] [role=option]").allTextContents()
      ).map((text) => text.replace(/\s+/g, " ").trim());
      await dialog()
        .locator("[role=listbox] [role=option]")
        .filter({
          has: pub.locator("[slot=label]", { hasText: /^Dept 3$/ }),
        })
        .first()
        .click();
      await apply();
      const three = await rowCount();
      await pub.screenshot({ path: `${OUT}/check-filter.png` });
      // 4) Dept 「Clear filter」
      await menu("Dept", "Clear filter");
      const four = await rowCount();
      const rich = all.filter((row) => row.amount >= 5000);
      const perDept = new Map();
      for (const row of rich)
        perDept.set(row.dept, (perDept.get(row.dept) ?? 0) + 1);
      const expectedCandidates = [...perDept]
        .map(([dept, count]) => `${dept}${count}`)
        .sort();
      results.checkFilter = {
        deptItems,
        deptAgain,
        firstOp,
        prefilled,
        rows: { before, one, two, three, four },
        expected: {
          one: shownOf(all.filter(contains).length),
          two: shownOf(
            all.filter((row) => contains(row) && row.amount >= 5000).length,
          ),
          three: shownOf(rich.filter((row) => row.dept === "Dept 3").length),
          four: shownOf(rich.length),
        },
        candidates,
        expectedCandidates,
        sameCandidates:
          JSON.stringify(
            candidates.map((text) => text.replace(/ /g, "")).sort(),
          ) ===
          JSON.stringify(
            expectedCandidates.map((text) => text.replace(/ /g, "")),
          ),
      };
      const { rows, expected } = results.checkFilter;
      results.checkFilter.pass =
        before === shownOf(ROWS) &&
        firstOp === "Contains" &&
        prefilled === "dept 1" &&
        rows.one === expected.one &&
        rows.two === expected.two &&
        rows.three === expected.three &&
        rows.four === expected.four &&
        results.checkFilter.sameCandidates &&
        deptItems.includes("Filter…") &&
        !deptItems.includes("Clear filter") &&
        deptAgain.includes("Clear filter");
      log(`check-filter ${JSON.stringify(results.checkFilter)}`);
      throw new Error("load only");
    }

    if (SERVER_GROUP) {
      // (ADR-315 5g — the group rows are the server's group query; one opened asks for its rows.)
      await pub.waitForTimeout(1500);
      const all = makeRows(ROWS);
      const groups = new Map();
      for (const row of all) {
        const held = groups.get(row.dept) ?? { count: 0, sum: 0 };
        held.count += 1;
        held.sum += row.amount;
        groups.set(row.dept, held);
      }
      const read = () =>
        pub.evaluate((OURS) => {
          const table = document.querySelector(OURS);
          const grid = table.matches("[role=grid],[role=treegrid]")
            ? table
            : table.querySelector("[role=grid],[role=treegrid]");
          const heads = [...grid.querySelectorAll("[role=columnheader]")].map(
            (cell) => (cell.textContent ?? "").trim(),
          );
          const cellsOf = (row) =>
            Object.fromEntries(
              [...row.querySelectorAll("[role=rowheader],[role=gridcell]")]
                .map((cell) => (cell.textContent ?? "").trim())
                .map((text, at) => [heads[at] ?? at, text]),
            );
          return {
            heads,
            groups: [...grid.querySelectorAll("[role=row][aria-expanded]")].map(
              (row) => ({
                expanded: row.getAttribute("aria-expanded"),
                cells: cellsOf(row),
              }),
            ),
            leaves: [...grid.querySelectorAll('[role=row][aria-level="2"]')].map(
              cellsOf,
            ),
            footer: [...grid.querySelectorAll("tfoot [role=row], [role=rowgroup]:last-child [role=row]")]
              .map(cellsOf)
              .at(-1),
          };
        }, OURS);
      const before = await read();
      const number = (text) => Number(String(text).replace(/[^0-9.\-]/g, ""));
      const groupOk = before.groups.map((row) => {
        const [, dept, count] =
          /^(Dept \d+) \((\d+)\)$/.exec(row.cells.Dept ?? "") ?? [];
        const want = groups.get(dept);
        return (
          !!want &&
          want.count === Number(count) &&
          Math.abs(want.sum - number(row.cells.Amount)) < 0.02
        );
      });
      // Open the first group: its rows are the server's answer to `groupOf`.
      const first = /^(Dept \d+)/.exec(before.groups[0]?.cells.Dept ?? "")?.[1];
      await pub
        .locator(`${OURS} [role=row][aria-expanded]`)
        .first()
        .locator('[slot="chevron"]')
        .click();
      await pub.waitForTimeout(2000);
      const after = await read();
      await pub.screenshot({ path: `${OUT}/check-server-group.png` });
      const bodies = requests.filter((r) => r && r.body).map((r) => r.body);
      const groupOf = bodies.filter((b) => b.groupOf);
      const totalsWant = {
        Name: all.length,
        Amount: Math.round(all.reduce((t, r) => t + r.amount, 0) * 100) / 100,
        Qty: all.reduce((t, r) => t + r.qty, 0) / all.length,
      };
      results.checkServerGroup = {
        heads: before.heads,
        groups: before.groups.length,
        groupOk: groupOk.filter(Boolean).length,
        expectedGroups: groups.size,
        opened: first,
        leaves: after.leaves.length,
        leavesDept: [...new Set(after.leaves.map((c) => c.Dept))],
        expected: groups.get(first)?.count,
        groupRequests: bodies.filter((b) => b.group && b.group.by?.length).length,
        totalsRequests: bodies.filter((b) => b.group && !b.group.by?.length).length,
        groupOf: groupOf.map((b) => b.groupOf),
        rowPages: bodies.filter((b) => !b.group && !b.groupOf).length,
        footer: before.footer,
        totalsWant,
      };
      const c = results.checkServerGroup;
      c.pass =
        c.groups === groups.size &&
        c.groupOk === groups.size &&
        c.leaves === c.expected &&
        c.leavesDept.length === 1 &&
        c.leavesDept[0] === first &&
        c.groupOf.length >= 1 &&
        JSON.stringify(c.groupOf.at(-1)) ===
          JSON.stringify({ by: ["dept"], values: [first] }) &&
        c.rowPages === 0 &&
        c.totalsRequests >= 1 &&
        number(c.footer?.Name) === totalsWant.Name &&
        Math.abs(number(c.footer?.Amount) - totalsWant.Amount) < 0.02 &&
        Math.abs(number(c.footer?.Qty) - totalsWant.Qty) < 0.01;
      log(`check-server group ${JSON.stringify(c)}`);
      throw new Error("load only");
    }
    if (SERVER_PIN) {
      // (ADR-315 5g — a pinned row of a server's pages: its own request; the pages leave it out.)
      await pub.waitForTimeout(1500);
      const keys = () =>
        pub.evaluate(
          (OURS) =>
            [
              ...document.querySelectorAll(
                `${OURS} [role=rowgroup] [role=row][data-key]`,
              ),
            ].map((row) => [
              row.getAttribute("data-key"),
              row.getAttribute("data-pinned-row"),
            ]),
          OURS,
        );
      const rest = await keys();
      const row = pub.locator(`${OURS} [role=row][data-key="r3"]`);
      await row.hover();
      await row.locator(".table-row-pin-button").click();
      await pub.getByRole("menuitem", { name: "Pin to top" }).click();
      await pub.waitForTimeout(2000);
      const pinned = await keys();
      // 「더 보기」: the next page by the server's cursor.
      for (let round = 0; round < 3; round += 1) {
        await pub.evaluate((OURS) => {
          const table = document.querySelector(OURS);
          const scroller = [table, ...table.querySelectorAll("*")].find(
            (el) =>
              /auto|scroll/.test(getComputedStyle(el).overflowY) &&
              el.scrollHeight > el.clientHeight + 1,
          );
          if (scroller) scroller.scrollTop = scroller.scrollHeight;
        }, OURS);
        await pub.waitForTimeout(1200);
      }
      const more = await keys();
      await pub.screenshot({ path: `${OUT}/check-server-pin.png` });
      const bodies = requests.filter((r) => r && r.body).map((r) => r.body);
      const only = bodies.filter((b) => b.keys?.only);
      const except = bodies.filter((b) => b.keys?.except);
      results.checkServerPin = {
        rest: rest.length,
        pinnedFirst: pinned[0],
        pinnedCount: pinned.length,
        r3: pinned.filter(([key]) => key === "r3").length,
        more: more.length,
        r3More: more.filter(([key]) => key === "r3").length,
        only: only.map((b) => ({ keys: b.keys, page: b.page ?? null })),
        except: except.map((b) => ({ keys: b.keys, page: b.page ?? null })),
      };
      const c = results.checkServerPin;
      c.pass =
        c.pinnedFirst?.[0] === "r3" &&
        c.pinnedFirst?.[1] === "top" &&
        c.pinnedCount === 51 &&
        c.r3 === 1 &&
        c.more > c.pinnedCount &&
        c.r3More === 1 &&
        c.only.length >= 1 &&
        JSON.stringify(c.only.at(-1)) ===
          JSON.stringify({ keys: { field: "id", only: ["r3"] }, page: null }) &&
        c.except.length >= 2 &&
        c.except.every(
          (e) => JSON.stringify(e.keys) === JSON.stringify({ field: "id", except: ["r3"] }),
        );
      log(`check-server pin ${JSON.stringify(c)}`);
      throw new Error("load only");
    }
    if (CHECK_ROWPIN) {
      // (The Builder's Canvas: its Table pinnable, no row pinned — a viewer pins rows.)
      const builder = await page.evaluate(() => {
        const root = window.__COMPOSITION_CATALOG__.workspace.root;
        const records = [...root.canvasInputs.values()];
        return {
          pinnable: records.some(
            (r) => r.ruleId === "Table" && r.props._rowPinnable === true,
          ),
          pinned: records.filter((r) => r.props?._pinnedRow !== undefined)
            .length,
        };
      });
      const measure = () =>
        pub.evaluate((OURS) => {
          const table = document.querySelector(OURS);
          const scroller =
            [table, ...table.querySelectorAll("*")].find(
              (el) => el.scrollHeight > el.clientHeight + 1,
            ) ?? table;
          const box = scroller.getBoundingClientRect();
          // (A virtual Table's header row has no height of its own — its cells do.)
          const header = table
            .querySelector("[role=columnheader]")
            .getBoundingClientRect();
          const rows = [
            ...table.querySelectorAll("[role=row][data-key]"),
          ].filter((row) => row.querySelector("[role=gridcell]"));
          const pinned = rows
            .filter((row) => row.hasAttribute("data-pinned-row"))
            .map((row) => {
              const r = row.getBoundingClientRect();
              const hit = document.elementFromPoint(
                r.left + r.width / 2,
                r.top + r.height / 2,
              );
              return {
                key: row.getAttribute("data-key"),
                side: row.getAttribute("data-pinned-row"),
                top: Math.round((r.top - box.top) * 10) / 10,
                bottom:
                  Math.round((box.top + scroller.clientHeight - r.bottom) * 10) /
                  10,
                hit: hit?.closest("[role=row]")?.getAttribute("data-key") ?? null,
                wrap: row.parentElement?.getAttribute("role") === "presentation"
                  ? `${getComputedStyle(row.parentElement).position} t:${row.parentElement.style.top} b:${getComputedStyle(row.parentElement).bottom} parent:${row.parentElement.parentElement?.getAttribute("role")}/${row.parentElement.parentElement?.className}/${getComputedStyle(row.parentElement.parentElement).display}/h${Math.round(row.parentElement.parentElement.getBoundingClientRect().height)} gp:${row.parentElement.parentElement?.parentElement?.getAttribute("role")}/h${Math.round(row.parentElement.parentElement?.parentElement?.getBoundingClientRect().height ?? 0)}/${getComputedStyle(row.parentElement.parentElement.parentElement).overflow}`
                  : `${getComputedStyle(row).position} top:${getComputedStyle(row).top} var:${row.style.getPropertyValue("--table-row-pin-at")} measure:${!!row.querySelector("span[hidden]")}`,
              };
            });
          const pinnedAll = [
            ...table.querySelectorAll("[role=row][data-pinned-row]"),
          ].map(
            (row) =>
              `${row.getAttribute("data-key")}:${row.querySelectorAll("[role=gridcell]").length}`,
          );
          const button = rows[8]?.querySelector(".table-row-pin-button");
          return {
            scrollTop: Math.round(scroller.scrollTop),
            scrollHeight: scroller.scrollHeight,
            clientHeight: scroller.clientHeight,
            headerBottom: Math.round((header.bottom - box.top) * 10) / 10,
            first: rows[0]?.getAttribute("data-key") ?? null,
            last: rows.at(-1)?.getAttribute("data-key") ?? null,
            menus: table.querySelectorAll(".table-row-pin-button").length,
            pinnedAll,
            restOpacity: button ? getComputedStyle(button).opacity : null,
            pinned,
          };
        }, OURS);
      const scrollTo = (top) =>
        pub.evaluate(
          ({ OURS, top }) => {
            const table = document.querySelector(OURS);
            const scroller =
              [table, ...table.querySelectorAll("*")].find(
                (el) => el.scrollHeight > el.clientHeight + 1,
              ) ?? table;
            scroller.scrollTop = top === "end" ? scroller.scrollHeight : top;
          },
          { OURS, top },
        );
      const pin = async (key, item) => {
        const row = pub.locator(`${OURS} [role=row][data-key="${key}"]`);
        await row.hover();
        await row.locator(".table-row-pin-button").click();
        await pub.getByRole("menuitem", { name: item }).click();
        await pub.waitForTimeout(1200);
      };
      await pub.waitForTimeout(1000);
      await pub.mouse.move(5, 5);
      const rest = await measure();
      await pin("r3", "Pin to top");
      await pin("r5", "Pin to bottom");
      await pub.mouse.move(5, 5);
      const at = [await measure()];
      for (const top of [3000, "end"]) {
        await scrollTo(top);
        await pub.waitForTimeout(1200);
        at.push(await measure());
      }
      await pub.screenshot({ path: `${OUT}/check-rowpin.png` });
      const near = (value, want) =>
        typeof value === "number" && Math.abs(value - want) <= 1;
      const stuck = (m) => {
        const top = m.pinned.find((row) => row.key === "r3");
        const bottom = m.pinned.find((row) => row.key === "r5");
        return (
          m.pinned.length === 2 &&
          top?.side === "top" &&
          near(top.top, m.headerBottom) &&
          top.hit === "r3" &&
          bottom?.side === "bottom" &&
          near(bottom.bottom, 0) &&
          bottom.hit === "r5"
        );
      };
      results.checkRowPin = { display: DISPLAY, builder, rest, at };
      results.checkRowPin.pass =
        builder.pinnable &&
        builder.pinned === 0 &&
        rest.menus > 5 &&
        rest.restOpacity === "0" &&
        rest.pinned.length === 0 &&
        at[0].first === "r3" &&
        at[0].last === "r5" &&
        at[1].scrollTop > 1000 &&
        at[2].scrollTop > at[1].scrollTop &&
        at.every(stuck);
      log(`check-rowpin ${JSON.stringify(results.checkRowPin)}`);
      throw new Error("load only");
    }

    if (CHECK_DETAIL) {
      const all = makeRows(ROWS);
      const drawn = () =>
        pub.evaluate((OURS) => {
          const table = document.querySelector(OURS);
          const grid = table.matches("[role=grid],[role=treegrid]")
            ? table
            : table.querySelector("[role=grid],[role=treegrid]");
          return {
            role: grid.getAttribute("role"),
            columns: grid.querySelectorAll("[role=columnheader]").length,
            rows: [...grid.querySelectorAll("[role=row][data-key]")]
              .filter((row) =>
                row.querySelector("[role=rowheader],[role=gridcell]"),
              )
              .map((row) => {
                const cells = [
                  ...row.querySelectorAll("[role=rowheader],[role=gridcell]"),
                ];
                const box = row.getBoundingClientRect();
                const cellBox = cells[0]?.getBoundingClientRect();
                return {
                  key: row.getAttribute("data-key"),
                  level: row.getAttribute("aria-level"),
                  expanded: row.getAttribute("aria-expanded"),
                  cells: cells.map((cell) => (cell.textContent ?? "").trim()),
                  span: cells[0]?.getAttribute("aria-colspan") ?? null,
                  // (The detail cell covers the row's width.)
                  wide: !!cellBox && cellBox.width >= box.width - 2,
                };
              }),
          };
        }, OURS);
      const first = await drawn();
      await pub
        .locator(`${OURS} [role=row][data-key="r0"] [slot=chevron]`)
        .click();
      await pub.waitForTimeout(1200);
      const opened = await drawn();
      await pub.screenshot({ path: `${OUT}/check-detail-open.png` });
      const at = opened.rows.findIndex((row) => row.key === "r0");
      const detail = opened.rows[at + 1];
      const b = results.treeBuilder;
      results.checkDetail = {
        builder: b,
        first: {
          role: first.role,
          rows: first.rows.length,
          expanded: [...new Set(first.rows.map((row) => row.expanded))],
        },
        detail,
        next: opened.rows[at + 2]?.key ?? null,
        want: { name: all[0].name, columns: first.columns },
      };
      results.checkDetail.pass =
        b.rows >= 10 &&
        b.nested === 0 &&
        b.marks.every(
          (cells) =>
            cells[0] === "closed" && cells.slice(1).every((m) => m === null),
        ) &&
        first.role === "treegrid" &&
        first.rows.length > 5 &&
        first.rows.every((row) => row.expanded === "false") &&
        detail?.key === "r0/detail" &&
        detail.level === "2" &&
        detail.cells.length === 1 &&
        detail.cells[0] === all[0].name &&
        detail.span === String(first.columns) &&
        detail.wide &&
        opened.rows[at + 2]?.key === "r1";
      log(`check-detail ${JSON.stringify(results.checkDetail)}`);
      throw new Error("load only");
    }

    if (CHECK_TREE) {
      const all = makeRows(ROWS);
      const childrenOf = (key) =>
        all.filter((row) => row.parent === key).map((row) => row.id);
      const nameOf = new Map(all.map((row) => [row.id, row.name]));
      /** The rows drawn (their key · level · expanded state), in order. */
      const drawn = () =>
        pub.evaluate((OURS) => {
          const table = document.querySelector(OURS);
          const grid = table.matches("[role=grid],[role=treegrid]")
            ? table
            : table.querySelector("[role=grid],[role=treegrid]");
          return {
            role: grid.getAttribute("role"),
            rows: [...grid.querySelectorAll("[role=row][data-key]")]
              .filter((row) =>
                row.querySelector("[role=rowheader],[role=gridcell]"),
              )
              .map((row) => ({
                key: row.getAttribute("data-key"),
                level: row.getAttribute("aria-level"),
                expanded: row.getAttribute("aria-expanded"),
              })),
          };
        }, OURS);
      const first = await drawn();
      await pub
        .locator(`${OURS} [role=row][data-key="r0"] [slot=chevron]`)
        .click();
      await pub.waitForTimeout(1200);
      const opened = await drawn();
      await pub.screenshot({ path: `${OUT}/check-tree-open.png` });
      const under = (list) => {
        const at = list.findIndex((row) => row.key === "r0");
        const out = [];
        for (const row of list.slice(at + 1)) {
          if (row.level !== "2") break;
          out.push(row.key);
        }
        return out;
      };
      // Sort by Name (the header press): each level among itself.
      await pub
        .locator(`${OURS} [role=columnheader]`, { hasText: "Name" })
        .first()
        .click();
      await pub.waitForTimeout(1500);
      const sorted = await drawn();
      await pub.screenshot({ path: `${OUT}/check-tree-sorted.png` });
      // (The views' sort — `sortOrder.ts` `COLLATOR`: numbers in text by value.)
      const compare = new Intl.Collator(undefined, {
        numeric: true,
        sensitivity: "base",
      }).compare;
      const byName = (keys) =>
        [...keys].sort((a, b) => compare(nameOf.get(a), nameOf.get(b)));
      const top = sorted.rows
        .filter((row) => row.level === "1")
        .map((row) => row.key);
      const wantTop = byName(
        all.filter((row) => row.parent === null).map((row) => row.id),
      );
      results.checkTree = {
        builder: results.treeBuilder,
        first: {
          role: first.role,
          rows: first.rows.length,
          levels: [...new Set(first.rows.map((row) => row.level))],
          expanded: [...new Set(first.rows.map((row) => row.expanded))],
          keys: first.rows.slice(0, 4).map((row) => row.key),
        },
        opened: { under: under(opened.rows), want: childrenOf("r0") },
        sorted: {
          under: under(sorted.rows),
          want: byName(childrenOf("r0")),
          top: top.slice(0, 5),
          wantTop: wantTop.slice(0, top.length).slice(0, 5),
          topInOrder: top.every((key, at) => key === wantTop[at]),
        },
      };
      const b = results.treeBuilder;
      results.checkTree.pass =
        // (The Builder draws its sample — the rows a 500 px Table holds.)
        b.rows >= 10 &&
        b.nested === 0 &&
        b.ids.join() === "r0,r1,r2" &&
        b.marks.every(
          (cells) =>
            cells[0] === "closed" && cells.slice(1).every((m) => m === null),
        ) &&
        first.role === "treegrid" &&
        first.rows.length > 5 &&
        first.rows.every(
          (row) => row.level === "1" && row.expanded === "false",
        ) &&
        first.rows
          .slice(0, 4)
          .map((row) => row.key)
          .join() === "r0,r1,r2,r3" &&
        under(opened.rows).join() === childrenOf("r0").join() &&
        // (A virtual Table draws the rows in view: r0 may have sorted out of it.)
        (!sorted.rows.some((row) => row.key === "r0") ||
          under(sorted.rows).join() === byName(childrenOf("r0")).join()) &&
        results.checkTree.sorted.topInOrder;
      log(`check-tree ${JSON.stringify(results.checkTree)}`);
      throw new Error("load only");
    }

    if (CHECK_TOTALS) {
      const all = makeRows(ROWS);
      const sum = (key) => all.reduce((total, row) => total + row[key], 0);
      const want = {
        Name: String(all.length),
        Amount: Math.round(sum("amount") * 100) / 100,
        Qty: sum("qty") / all.length,
      };
      // (The totals row is the footer — after the last row: scroll to the end. A virtual Table
      //  draws it once it is in view.)
      // (「더 보기」: each scroll to the end shows 100 more — until the rows stop growing.)
      for (let round = 0, last = -1; round < 20; round += 1) {
        const height = await pub.evaluate((OURS) => {
          const table = document.querySelector(OURS);
          const scroller = [table, ...table.querySelectorAll("*")].find(
            (el) => {
              const style = getComputedStyle(el);
              return (
                /auto|scroll/.test(style.overflowY) &&
                el.scrollHeight > el.clientHeight + 1
              );
            },
          );
          if (scroller) scroller.scrollTop = scroller.scrollHeight;
          return scroller?.scrollHeight ?? 0;
        }, OURS);
        await pub.waitForTimeout(900);
        if (height === last) break;
        last = height;
      }
      await pub.screenshot({ path: `${OUT}/check-totals.png` });
      const drawn = await pub.evaluate((OURS) => {
        const table = document.querySelector(OURS);
        const grid = table.matches("[role=grid]")
          ? table
          : table.querySelector("[role=grid]");
        const heads = [...grid.querySelectorAll("[role=columnheader]")].map(
          (cell) => (cell.textContent ?? "").trim(),
        );
        const footer = grid.querySelector("tfoot, [role=rowgroup]:last-child");
        const rows = [...grid.querySelectorAll("[role=rowgroup]")];
        const last = rows.at(-1);
        const row = last?.querySelector("[role=row]");
        const cells = row
          ? [...row.querySelectorAll("[role=rowheader],[role=gridcell]")].map(
              (cell) => (cell.textContent ?? "").trim(),
            )
          : [];
        const box = row?.getBoundingClientRect();
        const tableBox = table.getBoundingClientRect();
        return {
          heads,
          groups: rows.length,
          footerTag: footer?.tagName ?? null,
          cells: Object.fromEntries(
            heads.map((head, at) => [head, cells[at] ?? ""]),
          ),
          inTable: !!box && box.bottom <= tableBox.bottom + 1 && box.height > 0,
        };
      }, OURS);
      const number = (text) => Number(String(text).replace(/[^0-9.\-]/g, ""));
      const b = results.totalsBuilder;
      results.checkTotals = { want, builder: b, publish: drawn };
      results.checkTotals.pass =
        b.name === want.Name &&
        Math.abs(number(b.amount) - want.Amount) < 0.005 &&
        Math.abs(number(b.qty) - want.Qty) < 1e-6 &&
        drawn.cells.Name === want.Name &&
        Math.abs(number(drawn.cells.Amount) - want.Amount) < 0.005 &&
        Math.abs(number(drawn.cells.Qty) - want.Qty) < 1e-6 &&
        drawn.groups === 3 &&
        drawn.inTable;
      log(`check-totals ${JSON.stringify(results.checkTotals)}`);
      throw new Error("load only");
    }

    if (CHECK_AUTHORED_GROUP) {
      const all = makeRows(ROWS);
      const groups = new Map();
      for (const row of all) {
        const held = groups.get(row.dept) ?? { count: 0, sum: 0 };
        held.count += 1;
        held.sum += row.amount;
        groups.set(row.dept, held);
      }
      await pub.screenshot({ path: `${OUT}/check-authored-group.png` });
      const drawn = await pub.evaluate((OURS) => {
        const table = document.querySelector(OURS);
        const grid = table.matches("[role=grid],[role=treegrid]")
          ? table
          : table.querySelector("[role=grid],[role=treegrid]");
        const heads = [...grid.querySelectorAll("[role=columnheader]")].map(
          (cell) => (cell.textContent ?? "").trim(),
        );
        return {
          role: grid.getAttribute("role"),
          heads,
          rows: [...grid.querySelectorAll("[role=row][aria-expanded]")].map(
            (row) => {
              const cells = [
                ...row.querySelectorAll("[role=rowheader],[role=gridcell]"),
              ].map((cell) => (cell.textContent ?? "").trim());
              return {
                expanded: row.getAttribute("aria-expanded"),
                cells: Object.fromEntries(
                  heads.map((head, at) => [head, cells[at] ?? ""]),
                ),
              };
            },
          ),
        };
      }, OURS);
      const number = (text) => Number(String(text).replace(/[^0-9.\-]/g, ""));
      const checks = drawn.rows.map((row) => {
        const [, dept, count] =
          /^(Dept \d+) \((\d+)\)$/.exec(row.cells.Dept ?? "") ?? [];
        const want = groups.get(dept);
        return (
          !!want &&
          row.expanded === "false" &&
          want.count === Number(count) &&
          Math.abs(want.sum - number(row.cells.Amount)) < 0.02
        );
      });
      const b = results.authoredGroupBuilder;
      results.checkAuthoredGroup = {
        builder: b,
        publish: {
          role: drawn.role,
          heads: drawn.heads,
          groups: drawn.rows.length,
          ok: checks.filter(Boolean).length,
        },
        expectedGroups: groups.size,
      };
      results.checkAuthoredGroup.pass =
        b.headers[0] === "dept" &&
        b.nested === 0 &&
        b.first.every(
          (cells) =>
            /^Dept \d+ \(\d+\)$/.test(String(cells[0]?.text)) &&
            cells[0]?.tree === "closed" &&
            cells.slice(1).every((cell) => cell.tree === null),
        ) &&
        drawn.role === "treegrid" &&
        drawn.heads[0]?.startsWith("Dept") &&
        drawn.rows.length === groups.size &&
        checks.every(Boolean);
      log(`check-authored-group ${JSON.stringify(results.checkAuthoredGroup)}`);
      throw new Error("load only");
    }

    if (CHECK_GROUP) {
      const all = makeRows(ROWS);
      const headerNames = () =>
        pub
          .locator(`${OURS} [role=columnheader]`)
          .allTextContents()
          .then((texts) => texts.map((text) => text.trim()).filter(Boolean));
      const menu = async (name, item) => {
        await pub
          .locator(`${OURS} [role=columnheader]`)
          .filter({ hasText: new RegExp(`^${name}`) })
          .first()
          .locator("button")
          .first()
          .click();
        await pub.waitForTimeout(300);
        const items = (
          await pub.locator("[role=menu] [role=menuitem]").allTextContents()
        ).map((text) => text.trim());
        await pub
          .locator("[role=menu] [role=menuitem]")
          .filter({ hasText: new RegExp(`^${item}$`) })
          .first()
          .click();
        await pub.waitForTimeout(1200);
        return items;
      };
      /** Each drawn row: its level, expanded state and cell texts by header. */
      const drawn = () =>
        pub.evaluate((OURS) => {
          const table = document.querySelector(OURS);
          const grid = table.matches("[role=grid],[role=treegrid]")
            ? table
            : table.querySelector("[role=grid],[role=treegrid]");
          const heads = [...grid.querySelectorAll("[role=columnheader]")].map(
            (cell) => (cell.textContent ?? "").trim(),
          );
          return {
            role: grid.getAttribute("role"),
            rows: [...grid.querySelectorAll("[role=row]")]
              .filter(
                (row) => row.closest("[role=rowgroup]")?.tagName !== "THEAD",
              )
              .map((row) => {
                const cells = [
                  ...row.querySelectorAll("[role=rowheader],[role=gridcell]"),
                ].map((cell) => (cell.textContent ?? "").trim());
                return {
                  level: row.getAttribute("aria-level"),
                  expanded: row.getAttribute("aria-expanded"),
                  cells: Object.fromEntries(
                    heads.map((head, at) => [head, cells[at] ?? ""]),
                  ),
                };
              })
              .filter((row) => Object.values(row.cells).some(Boolean)),
          };
        }, OURS);
      const groups = new Map();
      for (const row of all) {
        const held = groups.get(row.dept) ?? { count: 0, sum: 0 };
        held.count += 1;
        held.sum += row.amount;
        groups.set(row.dept, held);
      }
      const deptItems = await menu("Dept", "Group by column");
      const heads = await headerNames();
      const grouped = await drawn();
      const groupRows = grouped.rows.filter((row) => row.expanded !== null);
      const number = (text) => Number(String(text).replace(/[^0-9.\-]/g, ""));
      const groupChecks = groupRows.map((row) => {
        const [, dept, count] =
          /^(Dept \d+) \((\d+)\)$/.exec(row.cells.Dept ?? "") ?? [];
        const want = groups.get(dept);
        return {
          dept,
          count: Number(count),
          sum: number(row.cells.Amount),
          ok:
            !!want &&
            want.count === Number(count) &&
            Math.abs(want.sum - number(row.cells.Amount)) < 0.02,
        };
      });
      // Open the first group: its rows under it, one level down.
      await pub
        .locator(`${OURS} [role=row][aria-expanded] [slot=chevron]`)
        .first()
        .click();
      await pub.waitForTimeout(1200);
      const opened = await drawn();
      await pub.screenshot({ path: `${OUT}/check-group-open.png` });
      // (The open group's chevron turns — `Table.css` `[data-expanded]`.)
      const chevronRotate = await pub.evaluate((OURS) => {
        const svg = document.querySelector(
          `${OURS} [role=row][aria-expanded=true] [slot=chevron] svg`,
        );
        return svg ? getComputedStyle(svg).rotate : null;
      }, OURS);
      const first = groupChecks[0];
      let children = opened.rows.filter((row) => row.level === "2");
      // ADR-315 Phase 5 증분 5b-2 — a virtual Table draws the rows in view: scroll through the open
      // group, gathering its rows by key, and count the rows in view drawn without their cells (the
      // window's empty rows a move left on screen) and the DOM's rows.
      let virtualScan;
      if (DISPLAY === "virtual") {
        virtualScan = await pub.evaluate(async (OURS) => {
          const table = document.querySelector(OURS);
          const scroller = [table, ...table.querySelectorAll("*")].find(
            (el) => {
              const style = getComputedStyle(el);
              return (
                /auto|scroll/.test(style.overflowY) &&
                el.scrollHeight > el.clientHeight + 1
              );
            },
          );
          if (!scroller) return { scroller: false };
          const wait = (ms) => new Promise((done) => setTimeout(done, ms));
          const heads = [...table.querySelectorAll("[role=columnheader]")].map(
            (cell) => (cell.textContent ?? "").trim(),
          );
          const dept = heads.findIndex((head) => head.startsWith("Dept"));
          const seen = new Map();
          let emptyInView = 0;
          let domRowsMax = 0;
          let steps = 0;
          scroller.scrollTop = 0;
          await wait(400);
          for (;;) {
            const box = scroller.getBoundingClientRect();
            const rows = [...table.querySelectorAll("[role=row][data-key]")];
            domRowsMax = Math.max(domRowsMax, rows.length);
            for (const row of rows) {
              const rect = row.getBoundingClientRect();
              const inView =
                rect.bottom > box.top + 1 && rect.top < box.bottom - 1;
              const cells = [
                ...row.querySelectorAll("[role=rowheader], [role=gridcell]"),
              ];
              if (inView && !cells.length) emptyInView += 1;
              if (row.getAttribute("aria-level") === "2" && cells.length)
                seen.set(
                  row.getAttribute("data-key"),
                  (cells[dept]?.textContent ?? "").trim(),
                );
            }
            if (
              scroller.scrollTop + scroller.clientHeight >=
                scroller.scrollHeight - 1 ||
              steps > 400
            )
              break;
            scroller.scrollTop += Math.max(40, scroller.clientHeight - 40);
            steps += 1;
            await wait(250);
          }
          return {
            scroller: true,
            steps,
            emptyInView,
            domRowsMax,
            children: [...seen.values()],
          };
        }, OURS);
        children = (virtualScan.children ?? []).map((text) => ({
          cells: { Dept: text },
        }));
      }
      const ungroupItems = await menu("Dept", "Ungroup");
      const ungrouped = await drawn();
      await pub.screenshot({ path: `${OUT}/check-group.png` });
      results.checkGroup = {
        role: grouped.role,
        deptItems,
        ungroupItems,
        heads,
        groups: groupChecks.length,
        expectedGroups: groups.size,
        groupChecks,
        chevronRotate,
        firstExpanded: opened.rows.find((row) => row.expanded === "true")?.cells
          .Dept,
        children: children.length,
        childrenDept: [...new Set(children.map((row) => row.cells.Dept))],
        ungroupedRows: ungrouped.rows.length,
        ...(virtualScan
          ? {
              virtual: {
                steps: virtualScan.steps,
                emptyInView: virtualScan.emptyInView,
                domRowsMax: virtualScan.domRowsMax,
              },
            }
          : {}),
      };
      const r = results.checkGroup;
      r.pass =
        deptItems.includes("Group by column") &&
        ungroupItems.includes("Ungroup") &&
        heads[0]?.startsWith("Dept") &&
        r.groups === r.expectedGroups &&
        groupChecks.every((item) => item.ok) &&
        r.children === first.count &&
        r.childrenDept.length === 1 &&
        r.childrenDept[0] === first.dept &&
        r.ungroupedRows > r.groups &&
        r.chevronRotate === "90deg" &&
        (!r.virtual ||
          (r.virtual.emptyInView === 0 && r.virtual.domRowsMax < 200));
      log(`check-group ${JSON.stringify(results.checkGroup)}`);
      throw new Error("load only");
    }

    if (CHECK_FACET) {
      const all = makeRows(ROWS);
      const cities = [...new Set(all.map((row) => row.city))];
      const radios = () =>
        pub.evaluate(() =>
          [...document.querySelectorAll("[role=radiogroup] label")].map(
            (label) => (label.textContent ?? "").trim(),
          ),
        );
      const rowCount = () =>
        pub.evaluate((OURS) => {
          const table = document.querySelector(OURS);
          const grid = table.matches("[role=grid]")
            ? table
            : table.querySelector("[role=grid]");
          return Number(grid?.getAttribute("aria-rowcount")) - 1;
        }, OURS);
      await pub.waitForTimeout(1500);
      const shown = await radios();
      const chosen = "City 7";
      const before = await rowCount();
      await pub
        .locator("[role=radiogroup] label")
        .filter({ hasText: new RegExp(`^${chosen}$`) })
        .first()
        .click();
      await pub.waitForTimeout(1500);
      const after = await rowCount();
      const afterRadios = await radios();
      await pub.screenshot({ path: `${OUT}/check-facet.png` });
      const expectedRows = all.filter((row) => row.city === chosen).length;
      results.checkFacet = {
        add: results.facetAdd,
        items: shown.length,
        first: shown.slice(0, 4),
        expectedItems: cities.length + 1,
        // (항목의 집합 = 「전체」 를 뺀 도시 전부.)
        sameValues:
          JSON.stringify([...shown.slice(1)].sort()) ===
          JSON.stringify([...cities].sort()),
        rowsBefore: before,
        rowsAfter: after,
        expectedRows,
        // (자기 선택으로 항목이 줄지 않는다.)
        itemsAfterChoice: afterRadios.length,
      };
      results.checkFacet.pass =
        results.facetAdd?.bound?.length === 1 &&
        results.facetAdd.bound[0].facet === true &&
        shown.length === cities.length + 1 &&
        results.checkFacet.sameValues &&
        before === ROWS &&
        after === expectedRows &&
        afterRadios.length === shown.length;
      log(`check-facet ${JSON.stringify(results.checkFacet)}`);
      throw new Error("load only");
    }

    if (CHECK_SEARCH) {
      const state = () =>
        pub.evaluate((OURS) => {
          const table = document.querySelector(OURS);
          const heads = [...table.querySelectorAll("[role=columnheader]")];
          const label = (el) =>
            (el.textContent ?? "").replace(/^\d+/, "").trim();
          const at = (name) => heads.findIndex((el) => label(el) === name);
          const cell = (row, index) =>
            (
              row.querySelectorAll("[role=rowheader], [role=gridcell]")[index]
                ?.textContent ?? ""
            ).trim();
          const grid = table.matches("[role=grid]")
            ? table
            : table.querySelector("[role=grid]");
          return {
            rowCount: grid?.getAttribute("aria-rowcount") ?? null,
            rows: [...table.querySelectorAll("[role=row]")]
              .filter((row) => !row.querySelector("[role=columnheader]"))
              .map(
                (row) =>
                  `${cell(row, at("Name"))}|${cell(row, at("Dept"))}|${cell(row, at("Amount"))}`,
              )
              .filter((text) => text.startsWith("Person"))
              .slice(0, 8),
          };
        }, OURS);
      // (따로 계산한 결과 — 이 파일의 행 생성기에서: 검색 대상 열 여섯 중 하나라도 글자를 품은 행.
      //  「포함」 은 대소문자를 접는다.)
      const all = makeRows(ROWS);
      const expectedOf = (text) => {
        const q = text.toLowerCase();
        const kept = all.filter((row) =>
          COLUMNS.some((column) =>
            String(row[column.key]).toLowerCase().includes(q),
          ),
        );
        return {
          count: kept.length,
          rows: kept
            .slice(0, 8)
            .map((row) => `${row.name}|${row.dept}|${row.amount}`),
        };
      };
      const input = pub.locator('input[type="search"]').first();
      results.checkSearch = {
        switch: results.searchSwitch,
        inputs: await pub.locator('input[type="search"]').count(),
        opened: await state(),
        steps: [],
      };
      await pub.evaluate(() => {
        window.__events = [];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries())
            if (entry.interactionId)
              window.__events.push({
                id: entry.interactionId,
                name: entry.name,
                duration: entry.duration,
              });
        }).observe({ type: "event", durationThreshold: 16, buffered: false });
      });
      const cdp = await context.newCDPSession(pub);
      const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
      const typed = async (text, rate) => {
        await input.click();
        await pub.keyboard.press("ControlOrMeta+a");
        await pub.keyboard.press("Backspace");
        await pub.waitForTimeout(700);
        await pub.evaluate(() => (window.__events = []));
        for (const char of text) {
          await pub.keyboard.type(char);
          await pub.waitForTimeout(rate === 4 ? 900 : 450);
        }
        await pub.waitForTimeout(600);
        // (한 글자 = 한 interaction: 그 interaction 의 가장 긴 entry — 입력 → 다음 paint.)
        const events = await pub.evaluate(() => window.__events);
        const byId = new Map();
        for (const event of events)
          byId.set(event.id, Math.max(byId.get(event.id) ?? 0, event.duration));
        return [...byId.values()];
      };
      if (process.argv.includes("--profile-search")) {
        // (글자 치기의 CPU profile — self · inclusive 상위 함수.)
        await typed("Person 1", 1);
        await cdp.send("Profiler.enable");
        await cdp.send("Profiler.setSamplingInterval", { interval: 200 });
        await cdp.send("Profiler.start");
        const durations = await typed(arg("--profile-text", "Person 12"), 1);
        const { profile } = await cdp.send("Profiler.stop");
        const resolve = createFrameResolver(distDir);
        const parent = new Map();
        for (const n of profile.nodes)
          for (const c of n.children ?? []) parent.set(c, n.id);
        const names = new Map(
          profile.nodes.map((n) => [
            n.id,
            resolve(
              `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url}:${n.callFrame.lineNumber + 1}`,
            ),
          ]),
        );
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
        writeFileSync(
          `${OUT}/search-profile.txt`,
          `typing 「Person 12」 (9 keys) ${durations.join(" · ")} ms · sampled ${total.toFixed(1)} ms\n--- self\n${top(self, () => true, 45).join("\n")}\n--- inclusive (src/)\n${top(inclusive, (n) => / src\//.test(n) || /packages\//.test(n), 90).join("\n")}\n`,
        );
        // (위에서 아래로 보는 호출 나무 — 전체의 1.5 % 이상인 가지만.)
        const kids = new Map(
          profile.nodes.map((n) => [n.id, n.children ?? []]),
        );
        const selfOf = new Map();
        profile.samples.forEach((id, i) =>
          selfOf.set(
            id,
            (selfOf.get(id) ?? 0) + (profile.timeDeltas[i] ?? 0) / 1000,
          ),
        );
        const totalOf = new Map();
        const sum = (id) => {
          let t = selfOf.get(id) ?? 0;
          for (const c of kids.get(id)) t += sum(c);
          totalOf.set(id, t);
          return t;
        };
        const rootId = profile.nodes[0].id;
        sum(rootId);
        const lines = [];
        const walk = (id, depth) => {
          const t = totalOf.get(id);
          if (t < total * 0.015 || depth > 70) return;
          lines.push(
            `${" ".repeat(Math.min(depth, 40))}${t.toFixed(1)} (${(selfOf.get(id) ?? 0).toFixed(1)}) ${names.get(id)}`,
          );
          for (const c of [...kids.get(id)].sort(
            (a, b) => totalOf.get(b) - totalOf.get(a),
          ))
            walk(c, depth + 1);
        };
        walk(rootId, 0);
        writeFileSync(
          `${OUT}/search-profile-tree.txt`,
          lines.join("\n") + "\n",
        );
        log(`profile → ${OUT}/search-profile.txt`);
        throw new Error("load only");
      }
      const QUERIES = SEARCH_FUZZY
        ? ["prsn 12", "dpt 3"]
        : ["Person 12", "e", "dept 3", "2026-0", "zzz"];
      for (const rate of [1, 4]) {
        await cdp.send("Emulation.setCPUThrottlingRate", { rate });
        for (const text of QUERIES) {
          const durations = await typed(text, rate);
          const shown = await state();
          const expected = SEARCH_FUZZY ? null : expectedOf(text);
          results.checkSearch.steps.push({
            rate,
            text,
            keys: text.length,
            durations,
            shown,
            ...(expected
              ? {
                  expected,
                  rowsMatch: same(shown.rows, expected.rows),
                  countMatch:
                    shown.rowCount === null
                      ? null
                      : Number(shown.rowCount) - 1 === expected.count,
                }
              : {}),
          });
          log(
            `search cpu${rate}x 「${text}」 ${durations.join(" · ")} ms → ${shown.rows.length} rows shown (rowcount ${shown.rowCount})${expected ? ` · expected ${expected.count} · rows ${same(shown.rows, expected.rows)}` : ""}`,
          );
        }
        if (rate === 1)
          await pub.screenshot({ path: `${OUT}/check-search.png` });
      }
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      // (지우면 모든 행이 돌아온다.)
      await input.click();
      await pub.keyboard.press("ControlOrMeta+a");
      await pub.keyboard.press("Backspace");
      await pub.waitForTimeout(1200);
      const cleared = await state();
      const p95 = (list) => {
        const sorted = [...list].sort((a, b) => a - b);
        return sorted.length
          ? sorted[
              Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)
            ]
          : null;
      };
      const of = (rate) =>
        results.checkSearch.steps
          .filter((step) => step.rate === rate)
          .flatMap((step) => step.durations);
      results.checkSearch.cleared = cleared;
      results.checkSearch.p95 = { cpu1x: p95(of(1)), cpu4x: p95(of(4)) };
      results.checkSearch.keystrokes = {
        cpu1x: of(1).length,
        cpu4x: of(4).length,
      };
      results.checkSearch.pass =
        results.searchSwitch?.rules?.length === 1 &&
        results.checkSearch.inputs === 1 &&
        same(cleared.rows, results.checkSearch.opened.rows) &&
        (SEARCH_FUZZY
          ? results.searchSwitch?.match === "fuzzy" &&
            results.checkSearch.steps.every(
              (step) => step.shown.rows.length > 0,
            )
          : results.checkSearch.steps.every(
              (step) => step.rowsMatch && step.countMatch !== false,
            ));
      log(
        `check-search ${JSON.stringify({ pass: results.checkSearch.pass, p95: results.checkSearch.p95, keystrokes: results.checkSearch.keystrokes })}`,
      );
      throw new Error("load only");
    }

    if (CHECK_SORT) {
      // (보이는 데이터 행의 Name 칸 — 헤더 「Name」 의 열 자리.)
      const shown = () =>
        pub.evaluate((OURS) => {
          const table = document.querySelector(OURS);
          const heads = [...table.querySelectorAll("[role=columnheader]")];
          const at = heads.findIndex((el) =>
            (el.textContent ?? "").trim().startsWith("Name"),
          );
          const head = heads[at];
          return {
            sort: head?.getAttribute("aria-sort") ?? null,
            names: [...table.querySelectorAll("[role=row]")]
              .filter((row) => !row.querySelector("[role=columnheader]"))
              .map((row) =>
                (
                  row.querySelectorAll("[role=rowheader], [role=gridcell]")[at]
                    ?.textContent ?? ""
                ).trim(),
              )
              .filter(Boolean),
          };
        }, OURS);
      const clickName = async () => {
        const at = await pub.evaluate((OURS) => {
          const head = [
            ...document
              .querySelector(OURS)
              .querySelectorAll("[role=columnheader]"),
          ].find((el) => (el.textContent ?? "").trim().startsWith("Name"));
          const r = head.getBoundingClientRect();
          return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
        }, OURS);
        await pub.mouse.click(at.x, at.y);
        await pub.waitForTimeout(1500);
      };
      // (우리 정렬의 글자 비교와 같은 collator — `sortOrder.ts`.)
      const collator = new Intl.Collator(undefined, {
        numeric: true,
        sensitivity: "base",
      });
      const all = makeRows(ROWS).map((row) => row.name);
      const ascending = [...all].sort(collator.compare);
      const checks = [];
      const before = await shown();
      const headHeight = () =>
        pub.evaluate((OURS) => {
          const head = [
            ...document
              .querySelector(OURS)
              .querySelectorAll("[role=columnheader]"),
          ].find((el) => (el.textContent ?? "").trim().startsWith("Name"));
          return Math.round(head.getBoundingClientRect().height);
        }, OURS);
      const headBefore = await headHeight();
      for (let click = 0; click < 2; click += 1) {
        await clickName();
        const now = await shown();
        const want = (
          now.sort === "descending" ? [...ascending].reverse() : ascending
        ).slice(0, now.names.length);
        checks.push({
          sort: now.sort,
          rows: now.names.length,
          first: now.names[0],
          last: now.names.at(-1),
          wantFirst: want[0],
          wantLast: want.at(-1),
          pass:
            now.names.length > 0 &&
            now.names.every(
              (name, index) => collator.compare(name, want[index]) === 0,
            ),
        });
      }
      results.checkSort = {
        display: DISPLAY,
        total: ROWS,
        unsorted: { rows: before.names.length, first: before.names[0] },
        checks,
      };
      // (정렬된 머리글의 구조 · 배치 — 화살표와 이름이 한 줄인가.)
      results.sortedHeader = await pub.evaluate((OURS) => {
        const table = document.querySelector(OURS);
        const heads = [...table.querySelectorAll("[role=columnheader]")];
        const head = heads.find((el) =>
          (el.textContent ?? "").trim().startsWith("Name"),
        );
        const other = heads.find((el) =>
          (el.textContent ?? "").trim().startsWith("Dept"),
        );
        const describe = (el, depth = 0) => {
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return {
            tag: el.tagName.toLowerCase(),
            cls: el.getAttribute("class"),
            display: cs.display,
            flow: cs.flexDirection,
            align: cs.alignItems,
            box: [Math.round(r.width), Math.round(r.height)],
            kids:
              depth < 4
                ? [...el.children].map((kid) => describe(kid, depth + 1))
                : [],
          };
        };
        return {
          sorted: describe(head),
          otherHeight: Math.round(other.getBoundingClientRect().height),
          sortedHeight: Math.round(head.getBoundingClientRect().height),
        };
      }, OURS);
      results.sortedHeader.heightBeforeSort = headBefore;
      log(`sorted header ${JSON.stringify(results.sortedHeader)}`);
      log(`check-sort ${JSON.stringify(results.checkSort)}`);
      await pub.screenshot({ path: `${OUT}/check-sort.png` });
      throw new Error("load only");
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
    // (`--profile-sort scrolled`: after a scroll sweep — the full run sorts after its sweeps.)
    if (
      process.argv[process.argv.indexOf("--profile-sort") + 1] === "scrolled"
    ) {
      await sweep("ours");
      await show("ours");
    }
    await sortOnce("ours", "Amount");
    await pub.waitForTimeout(500);
    // (`--profile-rate 4`: the profiled click at CPU 4x.)
    await cdp.send("Emulation.setCPUThrottlingRate", {
      rate: Number(arg("--profile-rate", "1")),
    });
    await profiled(
      "sort-profile.txt",
      async () => `sort click ${await sortOnce("ours", "Amount")} ms`,
    );
    throw new Error("load only");
  }
  // `--strip-has [text]` (ADR-315 Phase 7 — HC4 원인 실험): Publish 의 스타일 규칙 중 선택자에 `:has(`
  //   (와 `text` 가 있으면 그 글자도) 가 든 것을 지우고 잰다 — `:has` 무효화가 스크롤 · 정렬의 스타일
  //   재계산을 키우는지 본다. 제품 동작이 아니라 측정용이다.
  if (process.argv.includes("--strip-has")) {
    const next = process.argv[process.argv.indexOf("--strip-has") + 1];
    const text = next && !next.startsWith("--") ? next : "";
    results.strippedHas = await pub.evaluate((text) => {
      const removed = [];
      const visit = (list) => {
        for (let i = list.length - 1; i >= 0; i -= 1) {
          const rule = list[i];
          if (
            rule.selectorText?.includes(":has(") &&
            (!text || rule.selectorText.includes(text))
          ) {
            removed.push(rule.selectorText.slice(0, 120));
            list.deleteRule ? list.deleteRule(i) : rule.parentRule.deleteRule(i);
            continue;
          }
          if (rule.cssRules) visit(rule.cssRules);
        }
      };
      for (const sheet of document.styleSheets) {
        try {
          const rules = sheet.cssRules;
          for (let i = rules.length - 1; i >= 0; i -= 1) {
            const rule = rules[i];
            if (
              rule.selectorText?.includes(":has(") &&
              (!text || rule.selectorText.includes(text))
            ) {
              removed.push(rule.selectorText.slice(0, 120));
              sheet.deleteRule(i);
            } else if (rule.cssRules) {
              const inner = rule.cssRules;
              for (let j = inner.length - 1; j >= 0; j -= 1) {
                const r = inner[j];
                if (
                  r.selectorText?.includes(":has(") &&
                  (!text || r.selectorText.includes(text))
                ) {
                  removed.push(r.selectorText.slice(0, 120));
                  rule.deleteRule(j);
                } else if (r.cssRules) visit(r.cssRules);
              }
            }
          }
        } catch {
          /* cross-origin sheet */
        }
      }
      return removed;
    }, text);
    log(`strip-has: ${results.strippedHas.length} rules`);
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
  if (PROFILE_COLUMNS) {
    await show("ours");
    const timed = async (press) => {
      const probe = pub.evaluate(
        ({ sel }) =>
          new Promise((resolve) => {
            const sig = () =>
              [...document.querySelectorAll(sel)]
                .map((el) => (el.textContent ?? "").trim())
                .join("|");
            const before = sig();
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
              if (t0 && sig() !== before)
                return requestAnimationFrame(() =>
                  resolve(Math.round((performance.now() - t0) * 10) / 10),
                );
              if (performance.now() - started > 120000) return resolve(null);
              requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }),
        { sel: ARMS.ours.heads },
      );
      await pub.waitForTimeout(100);
      await press();
      const ms = await probe;
      await pub.waitForTimeout(400);
      return ms;
    };
    const firstRowTimed = async (press) => {
      const probe = pub.evaluate(
        ({ rows }) =>
          new Promise((resolve) => {
            const first = () => {
              let best = null;
              let top = Infinity;
              for (const row of document.querySelectorAll(rows)) {
                if (row.querySelector("[role=columnheader]")) continue;
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
              if (performance.now() - started > 60000) return resolve(null);
              requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }),
        { rows: ARMS.ours.rows },
      );
      await pub.waitForTimeout(100);
      await press();
      const ms = await probe;
      await pub.waitForTimeout(400);
      return ms;
    };
    const heads = () =>
      pub.evaluate(
        (sel) =>
          [...document.querySelectorAll(sel)]
            .map((el) => (el.textContent ?? "").trim())
            .join(","),
        ARMS.ours.heads,
      );
    const item = (label) =>
      pub
        .locator("[role=menu] [role^=menuitem]")
        .filter({ hasText: new RegExp(`^(${label})$`) })
        .first();
    const columnItem = async (column, label) => {
      await pub
        .locator(ARMS.ours.heads)
        .filter({ hasText: new RegExp(`^${column}`) })
        .first()
        .locator("button")
        .first()
        .click();
      await pub.waitForTimeout(400);
      if (!results.columns.menu)
        results.columns.menu = await pub
          .locator("[role=menu] [role^=menuitem]")
          .allTextContents();
      return timed(() => item(label).click());
    };
    const chooser = () =>
      pub.getByRole("button", { name: /^(Columns|열)$/ }).first();
    results.columns = { start: await heads() };
    const med = (list) => {
      const ok = list.filter((t) => t != null).sort((x, y) => x - y);
      return ok.length ? ok[Math.floor(ok.length / 2)] : null;
    };
    // `--profile-chooser`: one chooser hide at CPU 4x under the sampling profiler.
    if (process.argv.includes("--profile-chooser")) {
      // (`--profile-chooser sorted`: Name sorted first — the loop's 4x round runs after the sorts.)
      if (
        process.argv[process.argv.indexOf("--profile-chooser") + 1] === "sorted"
      ) {
        await pub
          .locator(ARMS.ours.heads)
          .filter({ hasText: /^Name/ })
          .first()
          .locator("button")
          .first()
          .click();
        await pub.waitForTimeout(400);
        await item("Sort Ascending|오름차순 정렬").click();
        await pub.waitForTimeout(1500);
      }
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
      await chooser().click();
      await pub.waitForTimeout(600);
      await profiled(
        "chooser-profile.txt",
        async () => `chooser hide ${await timed(() => item("Qty").click())} ms`,
      );
      await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
      throw new Error("load only");
    }
    for (const rate of [1, 4]) {
      await cdp.send("Emulation.setCPUThrottlingRate", { rate });
      const runs = {
        pin: [],
        unpin: [],
        right: [],
        left: [],
        hide: [],
        show: [],
      };
      for (let i = 0; i < 3; i++) {
        runs.pin.push(await columnItem("Dept", "Pin to start|앞에 고정"));
        if (i === 0 && rate === 1) results.columns.pinned = await heads();
        runs.unpin.push(await columnItem("Dept", "Unpin|고정 해제"));
        runs.right.push(await columnItem("Name", "Move right|오른쪽으로 이동"));
        if (i === 0 && rate === 1) results.columns.moved = await heads();
        runs.left.push(await columnItem("Name", "Move left|왼쪽으로 이동"));
        await chooser().click();
        await pub.waitForTimeout(400);
        runs.hide.push(await timed(() => item("Qty").click()));
        if (i === 0 && rate === 1) results.columns.hidden = await heads();
        runs.show.push(await timed(() => item("Qty").click()));
        await pub.keyboard.press("Escape");
        await pub.waitForTimeout(400);
        log(
          `columns cpu${rate}x #${i + 1} ${JSON.stringify(Object.fromEntries(Object.entries(runs).map(([k, v]) => [k, v.at(-1)])))}`,
        );
      }
      // (A Column with a menu sorts from it — the header press opens the menu, S2 `isMenu`. The
      //  baseline is the same sort through the menu item: item press → the first row changed.)
      const sort = {};
      for (const column of ["Amount", "Name"]) {
        const times = [];
        for (let i = 0; i < (rate === 4 ? 3 : 6); i++) {
          await pub
            .locator(ARMS.ours.heads)
            .filter({ hasText: new RegExp(`^${column}`) })
            .first()
            .locator("button")
            .first()
            .click();
          await pub.waitForTimeout(400);
          times.push(
            await firstRowTimed(() =>
              item(
                i % 2
                  ? "Sort Descending|내림차순 정렬"
                  : "Sort Ascending|오름차순 정렬",
              ).click(),
            ),
          );
        }
        sort[column] = { times, median: med(times) };
      }
      results.columns[`cpu${rate}x`] = {
        ...Object.fromEntries(
          Object.entries(runs).map(([k, v]) => [
            k,
            { times: v, median: med(v) },
          ]),
        ),
        sort,
      };
      log(
        `columns cpu${rate}x ${JSON.stringify(results.columns[`cpu${rate}x`])}`,
      );
    }
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    results.columns.end = await heads();
    await pub.screenshot({ path: `${OUT}/profile-columns.png` });
    throw new Error("load only");
  }
  // `--sort-only`: our Table's sort clicks only (CPU 1x · 4x) — a short arm for A/B pairs.
  if (process.argv.includes("--sort-only")) {
    results.sort = {};
    // (`--sort-only scrolled`: CPU 4x only, after a scroll sweep — as the full run sorts.)
    const scrolled =
      process.argv[process.argv.indexOf("--sort-only") + 1] === "scrolled";
    for (const rate of scrolled ? [4] : [1, 4]) {
      await cdp.send("Emulation.setCPUThrottlingRate", { rate });
      if (scrolled) {
        await sweep("ours");
        await show("ours");
      }
      results.sort[`cpu${rate}x`] = { ours: await sortArm("ours", 6) };
      log(
        `sort cpu${rate}x ${JSON.stringify(results.sort[`cpu${rate}x`].ours)}`,
      );
    }
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
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

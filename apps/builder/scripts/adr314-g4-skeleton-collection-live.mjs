#!/usr/bin/env node
// ADR-314 Phase 4 · G4 live — S2 SkeletonCollection 이 실제 Publish 에서 CardView 의 로딩 동안 자리 항목을
// 그리는가 (headed Chrome, 실제 Builder + Publish).
//
// 새 프로젝트에 dev 핸들 (`__COMPOSITION_CATALOG__`) 로 원격 collection (이 스크립트가 띄운 127.0.0.1 서버 —
// 응답을 스크립트가 놓을 때까지 붙잡는다, cursor `next`) 과 CardView (팔레트) + 그 안의 SkeletonCollection
// (팔레트, CardView 를 고른 채) 을 두고 CardView 를 연결한다. Publish 에서:
//   ① 첫 요청이 붙잡혀 있는 동안 (`loading`) — 자리 항목 수 = 그려진 grid 의 열 · 템플릿 높이로 셈한 기대값
//      (`skeletonRepeat.ts` 의 내용 높이 정책 — 지금 행 끝 + 한 행), 카드 행 0
//   ② 첫 쪽 응답 뒤 — 자리 항목 0, 카드 행 = 응답 수
//   ③ 끝 sentinel 이 다음 쪽을 부르는 동안 (`loadingMore`) — 기존 카드 유지 + 그 뒤 자리 항목, 스피너 없음
//   ④ 마지막 쪽 응답 뒤 — 자리 항목 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr314-g4-skeleton-collection-live.mjs <out-dir>
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/adr314-g4";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const PAGE_SIZE = 4;

const held = [];
const requests = [];
const server = createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
    });
    res.end();
    return;
  }
  requests.push(`${url.pathname}${url.search}`);
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  held.push(() => {
    const items = Array.from({ length: PAGE_SIZE }, (_, i) => ({
      id: `u${(page - 1) * PAGE_SIZE + i + 1}`,
      name: `Person${(page - 1) * PAGE_SIZE + i + 1}`,
    }));
    res.writeHead(200, {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
    });
    res.end(JSON.stringify({ items, next: page < 2 ? String(page + 1) : null }));
  });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const REMOTE = `http://127.0.0.1:${server.address().port}`;
const release = () => held.splice(0).forEach((answer) => answer());

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(`${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 900)}\n`);
};

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1400, height: 500 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

try {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type("ADR-314 G4 SkeletonCollection");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
    timeout: 30000,
  });
  await page.waitForTimeout(1500);

  const setup = await page.evaluate(async (REMOTE) => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const ctx = () => ({
      graph: ws.runtime.graph,
      records: ws.root.domInputs,
      selection: () => ws.session.getSnapshot().selection,
      itemOfRecord: (i) => ws.itemOfRecord(i),
      pageContent: () => ({ kind: "node", id: "project:node:home-body" }),
      newId: ws.newId,
    });
    ws.execute(
      h.commands.setDataEntries({
        puts: [
          {
            kind: "collection",
            id: "data:collection:people",
            name: "People",
            schema: [
              { id: "f-id", key: "id", type: "string" },
              { id: "f-name", key: "name", type: "string" },
            ],
            mockData: [],
            useMockData: false,
          },
          {
            kind: "endpoint",
            id: "data:endpoint:people",
            name: "listPeople",
            method: "GET",
            baseUrl: REMOTE,
            path: "/people",
            headers: [],
            queryParams: [
              { key: "page", value: "{{ cursor }}", type: "string", required: false },
            ],
            bodyType: "none",
            responseMapping: { dataPath: "items", cursorPath: "next" },
            targetCollectionId: "data:collection:people",
            executionMode: "client",
          },
        ],
        label: "G4 data",
      }),
    );
    ws.selectRecords([]);
    ws.execute(h.palette.catalogPaletteInsertPlan(ctx(), "CardView").command);
    const cv = [...ws.root.domInputs.values()]
      .filter((r) => ws.root.typeOf(r) === "CardView")
      .at(-1);
    ws.selectRecords([cv.id]);
    const plan = h.palette.catalogPaletteInsertPlan(ctx(), "SkeletonCollection");
    ws.execute(plan.command);
    ws.execute(
      h.binding.catalogBindingCommand(
        [{ kind: "node", id: cv.sourceId }],
        h.binding.catalogBindingRef({
          source: "dataTable",
          collectionId: "people",
          name: "People",
        }),
      ),
    );
    return { cardView: cv.sourceId, relocated: plan.relocated ?? false };
  }, REMOTE);
  record("setup", !setup.relocated, setup);
  await page.waitForTimeout(1000);
  release(); // (any request the Builder made itself)

  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => ["Preview", "미리보기"].includes(b.getAttribute("aria-label")))
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.bringToFront();
  await pub.waitForURL((url) => String(url) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".react-aria-CardView", { timeout: 60000 });

  const probe = () =>
    pub.evaluate(() => {
      const grid = document.querySelector(".react-aria-CardView");
      const rows = [...grid.querySelectorAll('[role="row"]')];
      const measure = grid.querySelector("[data-skeleton-measure]");
      const template = measure?.nextElementSibling;
      const templateId = template?.getAttribute("data-catalog-id");
      const skeletons = templateId
        ? grid.querySelectorAll(`[data-catalog-id="${CSS.escape(templateId)}"]`).length
        : 0;
      const cs = getComputedStyle(grid);
      const tracks = cs.gridTemplateColumns
        .split(/\s+/)
        .filter((t) => /px$/.test(t)).length;
      const lastRow = rows.at(-1);
      const firstSkeleton = template;
      return {
        rows: rows.length,
        names: rows.map((r) => /Person\d+/.exec(r.textContent ?? "")?.[0]),
        skeletons,
        tracks,
        display: cs.display,
        template: template
          ? (({ width, height }) => ({ width: Math.round(width), height: Math.round(height) }))(
              template.getBoundingClientRect(),
            )
          : null,
        order:
          lastRow && firstSkeleton
            ? !!(lastRow.compareDocumentPosition(firstSkeleton) & Node.DOCUMENT_POSITION_FOLLOWING)
            : null,
        progress: grid.querySelectorAll('[role="progressbar"]').length,
        looks: grid.querySelectorAll("[data-skeleton-look]").length,
        animations: document.getAnimations().length,
      };
    });

  // ① loading — the first request is held.
  await pub.waitForTimeout(800);
  const loading = await probe();
  const existing = 0;
  const expectGrid = (cols, n) => {
    // content-height policy: the current row to its end and one row more
    const firstRow = cols - (n % cols);
    return firstRow + cols;
  };
  record("① loading — skeleton items only, count = row end + one row", loading.rows === 0 && loading.skeletons === expectGrid(Math.max(1, loading.tracks), existing), { ...loading, expected: expectGrid(Math.max(1, loading.tracks), existing) });
  await pub.screenshot({ path: `${OUT}/1-loading.png` });

  // ② the first page answered.
  release();
  await pub.waitForTimeout(800);
  const loaded = await probe();
  // (RAC's load-more sentinel loads a screen ahead — `scrollOffset` — so the next page may already be
  //  requested: then the skeleton items are `loadingMore`'s, after the cards. ④ checks the end.)
  const prefetched = requests.some((r) => r.includes("page=2"));
  record(
    "② first page — the cards (skeleton items only if the next page is already loading)",
    loaded.rows === PAGE_SIZE && (loaded.skeletons === 0 || (prefetched && loaded.order === true)),
    { ...loaded, prefetched, requests: [...requests] },
  );
  await pub.screenshot({ path: `${OUT}/2-loaded.png` });

  // ③ loadingMore — scroll to the end sentinel, its request is held.
  await pub.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await pub.waitForTimeout(1000);
  const more = await probe();
  record(
    "③ loadingMore — cards kept, skeleton items after them, no spinner",
    more.rows === PAGE_SIZE && more.skeletons === expectGrid(Math.max(1, more.tracks), PAGE_SIZE) && more.order === true && more.progress === 0,
    { ...more, expected: expectGrid(Math.max(1, more.tracks), PAGE_SIZE), requests: [...requests] },
  );
  await pub.screenshot({ path: `${OUT}/3-loading-more.png` });

  // ④ the last page answered.
  release();
  await pub.waitForTimeout(800);
  const done = await probe();
  record("④ done — no skeleton, all cards", done.skeletons === 0 && done.rows === PAGE_SIZE * 2, done);
} finally {
  writeFileSync(`${OUT}/result.json`, JSON.stringify({ results, errors, requests }, null, 2));
  process.stdout.write(`errors ${errors.length}: ${errors.slice(0, 5).join(" | ")}\n`);
  release();
  await browser.close();
  server.close();
}

#!/usr/bin/env node
// ADR-314 후속 (2026-11-19 사용자 결정) live — Skeleton 은 자기 연결 없이 안쪽에 연결된 컴포넌트의 로딩을
// 따르는가 (headed Chrome, 실제 Builder + Publish).
//
// 새 프로젝트에 dev 핸들로 원격 collection (이 스크립트가 띄운 127.0.0.1 서버 — 응답을 놓을 때까지 붙잡는다) 과
// Skeleton (팔레트) + 그 안의 Text · Table (팔레트, Skeleton 을 고른 채) 을 두고 Table 만 연결한다. Publish 에서:
//   ① 첫 요청이 붙잡혀 있는 동안 — Skeleton 안 Text 가 로딩 모양 (`data-skeleton` 1), 표의 머리 글자는 그대로
//      (S2 TableView 의 머리 칸 · 칸 글자는 Text 가 아니라 span)
//   ② 응답 뒤 — 로딩 모양 0, 표에 응답 행
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr314-skeleton-derived-loading-live.mjs <out-dir>
import { createServer } from "node:http";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/adr314-derived-loading";
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
  viewport: { width: 1400, height: 700 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

try {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type("ADR-314 derived loading");
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
        label: "derived loading data",
      }),
    );
    ws.selectRecords([]);
    ws.execute(h.palette.catalogPaletteInsertPlan(ctx(), "Skeleton").command);
    const sk = [...ws.root.domInputs.values()].find((r) => ws.root.typeOf(r) === "Skeleton");
    const placedChildren = sk.children.length;
    // (A Text beside the Table: the Table's own header · cell words are plain spans in S2 — only this
    //  Text takes the loading look.)
    ws.selectRecords([sk.id]);
    ws.execute(h.palette.catalogPaletteInsertPlan(ctx(), "Text").command);
    ws.selectRecords([sk.id]);
    const plan = h.palette.catalogPaletteInsertPlan(ctx(), "Table");
    ws.execute(plan.command);
    const table = [...ws.root.domInputs.values()].find((r) => ws.root.typeOf(r) === "Table");
    ws.execute(
      h.binding.catalogBindingCommand(
        [{ kind: "node", id: table.sourceId }],
        h.binding.catalogBindingRef({ source: "dataTable", collectionId: "people", name: "People" }),
      ),
    );
    const skAfter = ws.root.domInputs.get(sk.id);
    return {
      placedChildren,
      relocated: plan.relocated ?? false,
      inside: skAfter.children.map((c) => ws.root.typeOf(ws.root.domInputs.get(c))),
      skeletonBinding: !!ws.runtime.graph.getEntry(sk.sourceId).binding,
    };
  }, REMOTE);
  record("setup — empty Skeleton, Text + Table inside, only the Table bound", setup.placedChildren === 0 && !setup.relocated && setup.inside.join() === "Text,Table" && !setup.skeletonBinding, setup);
  await page.waitForTimeout(1000);
  release();

  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => ["Preview", "미리보기"].includes(b.getAttribute("aria-label")))
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  pub.on("console", (m) => {
    if (m.type() === "error" && /Fragment|Invalid prop/.test(m.text())) errors.push(`publish console: ${m.text()}`);
  });
  await pub.bringToFront();
  await pub.waitForURL((url) => String(url) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector('[role="grid"]', { timeout: 60000 });

  const probe = () =>
    pub.evaluate(() => {
      const grid = document.querySelector('[role="grid"]');
      return {
        skeletonMarks: document.querySelectorAll("[data-skeleton]").length,
        // (S2: a TableView's header · cell words are not `Text` — no loading look inside the grid.)
        gridMarks: grid.querySelectorAll("[data-skeleton-look='text']").length,
        headers: [...grid.querySelectorAll('[role="columnheader"]')].map((c) => c.textContent?.trim()).filter(Boolean),
        looks: document.querySelectorAll("[data-skeleton-look]").length,
        rows: [...grid.querySelectorAll('[role="row"]')]
          .map((r) => /Person\d+/.exec(r.textContent ?? "")?.[0])
          .filter(Boolean),
        progress: grid.querySelectorAll('[role="progressbar"]').length,
      };
    });

  await pub.waitForTimeout(800);
  const loading = await probe();
  record("① request held — the Skeleton's content takes the loading look", loading.skeletonMarks === 1 && loading.gridMarks === 0 && loading.rows.length === 0, { ...loading, requests: [...requests] });
  await pub.screenshot({ path: `${OUT}/1-loading.png` });

  // (The Table's end sentinel may ask for page 2 at once — `loadingMore` is not `loading`, S2's
  //  `isLoading` example: the Skeleton lets go after the first page.)
  release();
  await pub.waitForTimeout(1000);
  const done = await probe();
  record("② answered — no loading look, the rows shown", done.skeletonMarks === 0 && done.rows.length >= PAGE_SIZE, { ...done, requests: [...requests] });
  await pub.screenshot({ path: `${OUT}/2-loaded.png` });
  record("no React Fragment warning · page errors", errors.length === 0, errors);
} finally {
  writeFileSync(`${OUT}/result.json`, JSON.stringify({ results, errors, requests }, null, 2));
  process.stdout.write(`errors ${errors.length}: ${errors.slice(0, 5).join(" | ")}\n`);
  release();
  await browser.close();
  server.close();
}

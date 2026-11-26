#!/usr/bin/env node
// ADR-325 G5 live — the runtime store in the real Builder → Publish (Chrome · WebKit):
//   1. Builder: Users (remote — keyed by `id`, interval 4 s) · its query endpoint (cursor pages of
//      20 · total · suffix views · `{{ filterText }}` · server sort), a Table (「Edit marks」,
//      Name sortable) bound to it, a ListBox bound with a view (gender = female), Buttons with
//      rules: Rename (update u2 name), Load more, Search 「a」, Reload.
//   2. Publish: the Table's request and the ListBox's own (Decision 6) — no request for every page.
//   3. Rename → u2 「Edited」 in both lists, the Table row marked dirty.
//   4. Load more (page 2) → sort by Name (server) → Search 「a」 → Reload → wait for an interval
//      load: after each, u2 is 「Edited」 and still marked (사용자 결정 2 · Decision 5).
//   5. page error 0.
// The API is played by `context.route` (Chrome and WebKit alike) — rows written here, apart from
// the product.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr325-g5-live.mjs <out-dir> [--browser webkit]
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium, webkit } from "playwright";

const OUT = process.argv[2] ?? "/private/tmp/adr325-g5-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const API = "https://api.example.test";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1200)}\n`,
  );
};

/** 60 users: u1 … u60 — even ids female. u2 = 「Ahn 2」 (first by name — still on the first page of a server sort). */
const NAMES = ["Kim", "Ahn", "Lee", "Choi", "Jung", "Kang", "Cho", "Yoon"];
const USERS = Array.from({ length: 60 }, (_, i) => ({
  id: `u${i + 1}`,
  name: `${NAMES[i % NAMES.length]} ${i + 1}`,
  gender: i % 2 ? "female" : "male",
}));

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const BROWSER = process.argv.includes("--browser")
  ? process.argv[process.argv.indexOf("--browser") + 1]
  : "chrome";
const browser =
  BROWSER === "webkit"
    ? await webkit.launch({ headless: false })
    : await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const errors = [];
const urls = [];
await context.route(`${API}/**`, async (route) => {
  const url = new URL(route.request().url());
  urls.push(`${url.pathname}${url.search}`);
  let rows = [...USERS];
  const gender = url.searchParams.get("gender");
  if (gender) rows = rows.filter((row) => row.gender === gender);
  const q = url.searchParams.get("q");
  if (q) rows = rows.filter((row) => row.name.toLowerCase().includes(q));
  const sort = url.searchParams.get("sort");
  if (sort === "name") {
    rows.sort((a, b) => a.name.localeCompare(b.name));
    if (url.searchParams.get("dir") === "descending") rows.reverse();
  }
  const page = Number(url.searchParams.get("page") ?? 1);
  const size = 20;
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    headers: { "access-control-allow-origin": "*" },
    body: JSON.stringify({
      items: rows.slice((page - 1) * size, page * size),
      next: page * size < rows.length ? String(page + 1) : null,
      total: rows.length,
    }),
  });
});
const page = await context.newPage();
let pub;
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("adr325 g5 live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);

  const built = await page.evaluate(async (API) => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    const g = ws.runtime.graph;
    const C = h.commands;
    const set = (value) => ({ kind: "set", value });
    const loaded = (path) =>
      performance
        .getEntriesByType("resource")
        .map((entry) => entry.name)
        .filter((name) => new URL(name).pathname === path)
        .at(-1) ?? path;
    ws.execute(
      C.setDataEntries({
        puts: [
          {
            kind: "collection",
            id: "data:collection:users",
            name: "Users",
            schema: [
              { id: "f-id", key: "id", type: "string" },
              { id: "f-name", key: "name", type: "string" },
              { id: "f-gender", key: "gender", type: "string" },
            ],
            keyField: "f-id",
            mockData: [],
            useMockData: false,
            executionPolicy: { mode: "interval", intervalSec: 4 },
          },
          {
            kind: "endpoint",
            id: "data:endpoint:users",
            name: "listUsers",
            method: "GET",
            baseUrl: API,
            path: "/users",
            headers: [],
            queryParams: [
              { key: "page", value: "{{ cursor }}", type: "string", required: false },
              { key: "q", value: "{{ filterText }}", type: "string", required: false },
              { key: "sort", value: "{{ sortDescriptor.column }}", type: "string", required: false },
              { key: "dir", value: "{{ sortDescriptor.direction }}", type: "string", required: false },
            ],
            bodyType: "none",
            responseMapping: { dataPath: "items", cursorPath: "next", totalPath: "total" },
            querySerialization: { kind: "suffix" },
            targetCollectionId: "data:collection:users",
            executionMode: "client",
          },
        ],
        label: "users",
      }),
    );
    const snap = ws.session.getSnapshot();
    const body = g.getEntry(snap.pageId).children[0];
    const node = (id, type, props = {}) => ({
      kind: "node",
      id,
      definitionId: h.palette.catalogPaletteDefinitionId(g.library, type),
      children: [],
      props: Object.fromEntries(
        Object.entries(props).map(([key, value]) => [key, set(value)]),
      ),
      visual: {},
      sizing: {},
      descendantOverrides: [],
    });
    const ids = {
      table: "project:node:g5-table",
      list: "project:node:g5-list",
      rename: "project:node:g5-rename",
      more: "project:node:g5-more",
      search: "project:node:g5-search",
      reload: "project:node:g5-reload",
    };
    const buttons = [
      [ids.rename, "Rename"],
      [ids.more, "Load more"],
      [ids.search, "Search a"],
      [ids.reload, "Reload"],
    ];
    ws.execute(
      C.insertNodes({
        parent: { kind: "node", id: body },
        entries: [
          { ...node(ids.table, "Table"), sizing: { width: set(700), height: set(420) } },
          node(ids.list, "ListBox"),
          ...buttons.map(([id, label]) => node(id, "Button", { label })),
        ],
        rootIds: [ids.table, ids.list, ...buttons.map(([id]) => id)],
        newId: ws.newId,
      }),
    );
    const bind = (id, view) =>
      ws.execute(
        h.binding.catalogBindingCommand([{ kind: "node", id }], {
          ...h.binding.catalogBindingRef({
            source: "dataTable",
            collectionId: "users",
            name: "Users",
          }),
          ...(view ? { view } : {}),
        }),
      );
    bind(ids.table);
    bind(ids.list, {
      where: {
        id: "where",
        op: "and",
        items: [
          {
            id: "g",
            fields: [["data:field:f-gender"]],
            op: "equals",
            value: "female",
          },
        ],
      },
    });
    ws.execute(
      C.setFields({
        targets: [{ kind: "node", id: ids.table }],
        props: { showEditMarks: set(true), selectionMode: set("none") },
        label: "marks",
      }),
    );
    // (Name sortable — a header click sorts on the server: the endpoint reads `sortDescriptor`.)
    const root = ws.root;
    const all = [...root.canvasInputs.values()];
    const name = all.find(
      (r) => root.typeOf(r) === "Column" && r.props.key === "name",
    );
    if (name)
      ws.execute(
        C.setFields({
          targets: [ws.positionOfRecord(name.id).target],
          props: { allowsSorting: set(true) },
          label: "sortable",
        }),
      );
    const { catalogInteractionsCommand, catalogNewInteraction } = await import(
      loaded("/src/builder/catalogRuntime/interactions.ts")
    );
    const USERS_ID = "data:collection:users";
    const rule = (ownerId, action) =>
      ws.execute(
        catalogInteractionsCommand(
          { ownerId },
          [catalogNewInteraction({ ownerId }, "onPress", [action], ws.newId)],
          "Rules",
        ),
      );
    rule(ids.rename, {
      opcode: "update",
      collectionId: USERS_ID,
      key: "u2",
      field: "data:field:f-name",
      value: "Edited",
    });
    rule(ids.more, { opcode: "loadMore", collectionId: USERS_ID });
    rule(ids.search, { opcode: "setFilterText", collectionId: USERS_ID, value: "a" });
    rule(ids.reload, { opcode: "reload", collectionId: USERS_ID });
    await new Promise((r) => setTimeout(r, 500));
    const project = g.getEntry(g.projectId);
    return {
      rules: (project.interactionIds ?? []).length,
      sortable: !!name,
      table: !!g.getEntry(ids.table)?.binding,
      list: !!g.getEntry(ids.list)?.binding?.view,
      ids,
    };
  }, API);
  record(
    "1 Builder: Users (remote · key id · interval) · Table (Edit marks) · ListBox (female view) · 규칙 4",
    built.rules === 4 && built.table && built.list && built.sortable,
    built,
  );
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/builder.png` });

  // ── Publish ──
  const before = urls.length;
  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) =>
        ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
      )
      ?.click(),
  );
  pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.setViewportSize({ width: 1600, height: 1000 });
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector('[role="row"][data-key="u1"]', { timeout: 60000 });
  await pub.waitForTimeout(2000);
  const opened = urls.slice(before);
  record(
    "2 Publish: Table 의 요청 · ListBox 보기의 자기 요청 — 모든 페이지 불러오기 없음 (Decision 6)",
    opened.includes("/users") &&
      opened.includes("/users?gender=female") &&
      // (A short list's 「더 보기」 sentinel asks for page 2 — never past it: no load of every page.)
      !opened.some((u) => /page=([3-9]|\d\d)/.test(u)),
    { opened },
  );

  const press = async (label) => {
    await pub.getByRole("button", { name: label, exact: true }).click();
    await pub.waitForTimeout(1500);
  };
  /** u2's value in the Table · the ListBox, and its Table row mark. */
  const u2 = () =>
    pub.evaluate(() => {
      const row = document.querySelector('[role="row"][data-key="u2"]');
      const option = document.querySelector('[role="option"][data-key="u2"]');
      return {
        table: row?.textContent?.includes("Edited") ?? null,
        mark: row?.getAttribute("data-edit-status") ?? null,
        list: option ? option.textContent?.includes("Edited") : null,
      };
    });

  await press("Rename");
  const renamed = await u2();
  record(
    "3 Rename → u2 「Edited」 (Table · female ListBox 같은 값) · Table 행 dirty",
    renamed.table === true && renamed.list === true && renamed.mark === "dirty",
    renamed,
  );

  const n0 = urls.length;
  await press("Load more");
  const more = await u2();
  // (The page after the one the Table's own list holds — not a fixed `page=2`: a short first
  //  screen's sentinel may have asked for page 2 before the button (then the button asks for 3),
  //  and an interval load starts the list over (then 2 again). Round 3 판독: the fixed `page=2`
  //  failed Chrome's first run though the product asked rightly. The female view's list pages
  //  apart.)
  const own = urls.filter((u) => !u.includes("gender="));
  const pageOf = (u) => Number(/[?&]page=(\d+)/.exec(u)?.[1] ?? 1);
  const ownBefore = urls.slice(0, n0).filter((u) => !u.includes("gender=")).length;
  const followed = own.findIndex(
    (u, index) =>
      index >= ownBefore &&
      index > 0 &&
      pageOf(u) > 1 &&
      pageOf(u) === pageOf(own[index - 1]) + 1,
  );
  record(
    "4a 다음 페이지 (지금 페이지의 다음) 뒤 값 · 표시 남음",
    followed >= 0 &&
      more.table === true &&
      more.mark === "dirty",
    { requests: urls.slice(n0), ...more },
  );

  const n1 = urls.length;
  await pub
    .locator('[role="columnheader"]')
    .filter({ hasText: /^Name/ })
    .first()
    .click();
  await pub.waitForTimeout(2000);
  const sorted = await u2();
  record(
    "4b 정렬 (서버) 뒤 값 · 표시 남음",
    urls.slice(n1).some((u) => u.includes("sort=name")) &&
      sorted.table === true &&
      sorted.mark === "dirty",
    { requests: urls.slice(n1), ...sorted },
  );

  const n2 = urls.length;
  await press("Search a");
  const searched = await u2();
  record(
    "4c 검색 「a」 (서버) 뒤 값 · 표시 남음 (Ahn 2 는 「a」 를 가진다)",
    urls.slice(n2).some((u) => u.includes("q=a")) &&
      searched.table === true &&
      searched.mark === "dirty",
    { requests: urls.slice(n2), ...searched },
  );

  const n3 = urls.length;
  await press("Reload");
  const reloaded = await u2();
  record(
    "4d 다시 불러오기 뒤 값 · 표시 남음 (사용자 결정 2)",
    urls.length > n3 && reloaded.table === true && reloaded.mark === "dirty",
    { requests: urls.slice(n3), ...reloaded },
  );

  const n4 = urls.length;
  await pub.waitForTimeout(5000);
  const ticked = await u2();
  record(
    "4e 주기 조회 (4 s) 가 돈다 — 미저장 변경이 있어도 건너뛰지 않음, 값 · 표시 남음",
    urls.length > n4 && ticked.table === true && ticked.mark === "dirty",
    { requests: urls.slice(n4), ...ticked },
  );
  await pub.screenshot({ path: `${OUT}/publish.png` });

  record("5 page error 0", errors.length === 0, { errors });
} catch (error) {
  record("run", false, { error: String(error?.stack ?? error).slice(0, 1500) });
  await page.screenshot({ path: `${OUT}/failure.png` }).catch(() => {});
  await pub?.screenshot({ path: `${OUT}/failure-publish.png` }).catch(() => {});
  const text = await pub?.evaluate(() => document.body.innerText.slice(0, 800)).catch(() => "");
  if (text) process.stdout.write(`publish text: ${JSON.stringify(text)}\nrequests: ${JSON.stringify(urls)}\nerrors: ${JSON.stringify(errors)}\n`);
} finally {
  writeFileSync(`${OUT}/results.json`, JSON.stringify(results, null, 2));
  await browser.close();
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(
    `\n${results.length - failed}/${results.length} PASS → ${OUT}/results.json\n`,
  );
  process.exit(failed ? 1 : 0);
}

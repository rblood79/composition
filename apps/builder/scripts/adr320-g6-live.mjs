#!/usr/bin/env node
// ADR-320 G6 live — the closing exercise in a real Publish tab, Chrome or WebKit: three collections,
// three filter bars, each added by the Builder's 「Add filter bar」.
//   Users   — local rows (Ann A · Ben A · Cal B · Dee B · Eve C · Fox C) → a Table.
//   Orders  — a `suffix` endpoint (GET, 3 rows a page, json-server `name=` · `status=` · `page=`) →
//             a ListBox (no author condition) and a GridList (author `status = open`), one bar over
//             both (R10), its start `name = Kang`. The Kangs are on the third page of the whole data.
//   Tickets — a `body` endpoint (POST, 3 rows a page) that answers candidate values
//             (`querySerialization.facets` — 사용자 결정 9) → a Table.
// Steps:
//   0. Publish opens; three bars.
//   1. local: Users bar 「Add filter」 › Type › Is one of → the candidates A · B · C (the loaded rows')
//      → A → Apply → Ann Ben.
//   2. suffix (R10): each Orders list's request carries its own conditions — the ListBox
//      `name=Kang`, the GridList `status=open&name=Kang` — the ListBox shows both Kangs, the GridList
//      the open one; no Orders request carried `status=open` without `name=Kang`.
//   3. body (사용자 결정 9): Tickets bar 「Add filter」 › Status › Is one of → the candidates come from
//      the server (a `facet` request — `paused` · `review`, which no loaded row has) → type 「wa」 →
//      250 ms later one request with `search: "wa"` → 「waiting」 alone → pick · Apply → the rows
//      request carries `status oneOf [waiting]` → the waiting tickets.
//   2b. from the Publish tab's first paint, no Orders list showed a row other than Kang.
//   4. page errors 0.
//
//   BUILDER_URL=http://localhost:5173 [BROWSER=webkit] node apps/builder/scripts/adr320-g6-live.mjs <out-dir> [--headless]
import { mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { chromium, webkit } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr320-g6-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const HEADLESS = process.argv.includes("--headless");

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`,
  );
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── The remote server ────────────────────────────────────────────────────────────────────────────
const ORDERS = [
  ["Kim", "open"],
  ["Park", "closed"],
  ["Lee", "open"],
  ["Choi", "closed"],
  ["Jung", "open"],
  ["Han", "closed"],
  ["Kang", "open"],
  ["Kang", "closed"],
].map(([name, status], index) => ({ id: `o${index + 1}`, name, status }));
// (30 tickets: the first 24 open · closed · waiting in turn, then paused · review — the Table's
//  first pages hold none of those two.)
const TICKETS = Array.from({ length: 30 }, (_, index) => ({
  id: `t${index + 1}`,
  name: `T${index + 1}`,
  status:
    index < 24
      ? ["open", "closed", "waiting"][index % 3]
      : ["paused", "review"][index % 2],
}));
const WAITING = TICKETS.filter((row) => row.status === "waiting").map(
  (row) => row.name,
);
const passes = (row, node) => {
  if (!node) return true;
  if ("items" in node) {
    const results = node.items.map((item) => passes(row, item));
    return node.op === "or" ? results.some(Boolean) : results.every(Boolean);
  }
  const cell = row[node.fields?.[0]];
  if (node.op === "equals") return cell === node.value;
  if (node.op === "oneOf") return node.value.includes(cell);
  if (node.op === "contains")
    return String(cell).toLowerCase().includes(String(node.value).toLowerCase());
  return true;
};
const log = [];
const server = createServer((req, res) => {
  const cors = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "*",
    "access-control-expose-headers": "*",
  };
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors);
    res.end();
    return;
  }
  let text = "";
  req.on("data", (chunk) => (text += chunk));
  req.on("end", () => {
    const url = new URL(req.url, "http://x");
    const body = text ? JSON.parse(text) : undefined;
    log.push({
      method: req.method,
      path: url.pathname,
      query: url.search,
      body,
      from: String(req.headers.referer ?? "").replace(/^https?:\/\/[^/]+/, "").slice(0, 24),
    });
    let answer;
    if (url.pathname === "/orders") {
      let list = ORDERS;
      for (const [key, value] of url.searchParams)
        if (key === "name" || key === "status")
          list = list.filter((row) => row[key] === value);
      const page = Number(url.searchParams.get("page") || 1);
      answer = {
        items: list.slice((page - 1) * 3, page * 3),
        next: page * 3 < list.length ? String(page + 1) : null,
      };
    } else if (url.pathname === "/tickets") {
      const kept = TICKETS.filter((row) => passes(row, body?.where));
      if (body?.facet) {
        // (Candidate values: two a page, `nextCursor` the next index.)
        const counts = new Map();
        for (const row of kept) {
          const value = row[body.facet.field];
          if (
            body.facet.search &&
            !String(value).toLowerCase().includes(body.facet.search.toLowerCase())
          )
            continue;
          counts.set(value, (counts.get(value) ?? 0) + 1);
        }
        const all = [...counts].map(([value, count]) => ({ value, count }));
        const at = Number(body.facet.cursor ?? 0);
        answer = {
          items: all.slice(at, at + 2),
          ...(at + 2 < all.length ? { nextCursor: String(at + 2) } : {}),
        };
      } else {
        const page = Number(body?.page?.cursor ?? 1);
        const limit = body?.page?.limit ?? 50;
        answer = {
          items: kept.slice((page - 1) * limit, page * limit),
          next: page * limit < kept.length ? String(page + 1) : null,
          total: kept.length,
        };
      }
    } else answer = { items: [] };
    res.writeHead(200, { "content-type": "application/json", ...cors });
    res.end(JSON.stringify(answer));
  });
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const REMOTE = `http://127.0.0.1:${server.address().port}`;

// ── The browser ──────────────────────────────────────────────────────────────────────────────────
const state = JSON.parse(
  readFileSync(
    process.env.AUTH_STATE ?? `${REPO}/apps/builder/scripts/.auth-session.json`,
    "utf8",
  ),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const WEBKIT = process.env.BROWSER === "webkit";
const browser = WEBKIT
  ? await webkit.launch({ headless: HEADLESS })
  : await chromium.launch({ headless: HEADLESS, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1920, height: 1300 },
});
// (Every name an Orders list ever shows in the Publish tab — from its first paint on.)
await context.addInitScript(() => {
  window.__ordersSeen = new Set();
  const look = () => {
    for (const item of document.querySelectorAll(
      ".react-aria-ListBox [role='option'], .react-aria-GridList [role='row']",
    )) {
      const name = /Kim|Park|Lee|Choi|Jung|Han|Kang/.exec(item.textContent ?? "")?.[0];
      if (name) window.__ordersSeen.add(name);
    }
  };
  new MutationObserver(look).observe(document, { childList: true, subtree: true, characterData: true });
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));
const settle = (ms = 500) => page.waitForTimeout(ms);

const openRail = async (id) => {
  const button = railButton(page, id);
  if ((await button.getAttribute("aria-pressed")) !== "true") {
    await button.click();
    await settle(900);
  }
};

try {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await settle(300);
  await page.keyboard.type("adr320 g6 live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
    timeout: 30000,
  });
  await settle(1500);

  const ids = await page.evaluate(async (remote) => {
    const { workspace: ws, commands: c, palette, binding } =
      window.__COMPOSITION_CATALOG__;
    const field = (id, key, type, label) => ({ id, key, type, ...(label ? { label } : {}) });
    ws.execute(
      c.setDataEntries({
        puts: [
          {
            kind: "collection",
            id: "data:collection:users",
            name: "Users",
            schema: [
              field("f-id", "id", "string"),
              field("f-name", "name", "string", "Name"),
              field("f-type", "type", "string", "Type"),
            ],
            mockData: ["A", "A", "B", "B", "C", "C"].map((type, index) => ({
              id: `p${index + 1}`,
              name: ["Ann", "Ben", "Cal", "Dee", "Eve", "Fox"][index],
              type,
            })),
            useMockData: true,
          },
          {
            kind: "collection",
            id: "data:collection:orders",
            name: "Orders",
            schema: [
              field("f-oid", "id", "string"),
              field("f-oname", "name", "string", "Name"),
              field("f-ostatus", "status", "string", "Status"),
            ],
            mockData: [],
            useMockData: false,
          },
          {
            kind: "collection",
            id: "data:collection:tickets",
            name: "Tickets",
            schema: [
              field("f-tid", "id", "string"),
              field("f-title", "name", "string", "Title"),
              field("f-tstatus", "status", "string", "Status"),
            ],
            mockData: [],
            useMockData: false,
          },
          {
            kind: "endpoint",
            id: "data:endpoint:orders",
            name: "listOrders",
            method: "GET",
            baseUrl: remote,
            path: "/orders",
            headers: [],
            queryParams: [
              { key: "page", value: "{{ cursor }}", type: "string", required: false },
            ],
            bodyType: "none",
            responseMapping: { dataPath: "items", cursorPath: "next" },
            querySerialization: { kind: "suffix" },
            targetCollectionId: "data:collection:orders",
            executionMode: "client",
          },
          {
            kind: "endpoint",
            id: "data:endpoint:tickets",
            name: "listTickets",
            method: "POST",
            baseUrl: remote,
            path: "/tickets",
            headers: [{ key: "Content-Type", value: "application/json" }],
            queryParams: [],
            bodyType: "json",
            bodyTemplate: "{}",
            responseMapping: { dataPath: "items", cursorPath: "next", totalPath: "total" },
            querySerialization: { kind: "body", pageSize: 3, facets: true },
            targetCollectionId: "data:collection:tickets",
            executionMode: "client",
          },
        ],
        label: "g6 data",
      }),
    );
    const graph = ws.runtime.graph;
    const project = graph.getEntry(graph.projectId);
    const body = graph.getEntry(project.pageIds[0]).children[0];
    const put = (type) => {
      const id = ws.newId("node");
      ws.execute(
        c.insertNodes({
          parent: { kind: "node", id: body },
          entries: [
            {
              kind: "node",
              id,
              definitionId: palette.catalogPaletteDefinitionId(graph.library, type),
              children: [],
              props: {},
              visual: {},
              sizing: {},
              descendantOverrides: [],
            },
          ],
          rootIds: [id],
          newId: ws.newId,
        }),
      );
      return id;
    };
    const bind = (id, collectionId, name, view) =>
      ws.execute(
        binding.catalogBindingCommand([{ kind: "node", id }], {
          ...binding.catalogBindingRef({ source: "dataTable", collectionId, name }),
          ...(view ? { view } : {}),
        }),
      );
    const users = put("Table");
    const box = put("ListBox");
    const grid = put("GridList");
    const tickets = put("Table");
    bind(users, "users", "Users");
    bind(box, "orders", "Orders");
    bind(grid, "orders", "Orders", {
      where: {
        id: "author",
        op: "and",
        items: [
          {
            id: "open",
            fields: [["data:field:f-ostatus"]],
            op: "equals",
            value: "open",
          },
        ],
      },
    });
    // (An author sort: the Tickets Table's view goes to the server — its pages, `page.limit` 3.)
    bind(tickets, "tickets", "Tickets", {
      where: { id: "author", op: "and", items: [] },
      sort: [{ field: ["data:field:f-tid"], direction: "ascending" }],
    });
    return { users, box, grid, tickets };
  }, REMOTE);
  await settle(800);

  // Three 「Add filter bar」s — the Builder's own path.
  await openRail("properties");
  const addBar = async (node) => {
    await page.evaluate((id) => {
      const { workspace: ws } = window.__COMPOSITION_CATALOG__;
      ws.selectRecords([ws.recordsOfNode(id)[0]]);
    }, node);
    await settle(700);
    const add = page.getByRole("button", { name: /^add filter bar$/i }).first();
    await add.waitFor({ state: "visible", timeout: 15000 });
    await add.click();
    await settle(1000);
    return page.evaluate((id) => {
      const g = window.__COMPOSITION_CATALOG__.workspace.runtime.graph;
      const project = g.getEntry(g.projectId);
      const seen = new Set();
      const walk = (nodeId) => {
        const entry = g.getEntry(nodeId);
        if (!entry || seen.has(nodeId)) return undefined;
        seen.add(nodeId);
        if (entry.filtersOf?.includes(id)) return nodeId;
        for (const child of entry.children ?? []) {
          const found = walk(child);
          if (found) return found;
        }
        return undefined;
      };
      for (const pageId of project.pageIds) {
        const found = walk(g.getEntry(pageId).children[0]);
        if (found) return found;
      }
      return undefined;
    }, node);
  };
  const usersBar = await addBar(ids.users);
  const ordersBar = await addBar(ids.box);
  const ticketsBar = await addBar(ids.tickets);
  // The Orders bar over both lists (R10) and its start condition.
  await page.evaluate(
    async ({ bar, box, grid, repo }) => {
      const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
      const { setFilterBarTargets } = await import(
        "/@fs/" +
          repo +
          "/packages/shared/src/catalog/commands/filterBar.ts"
      );
      ws.execute(setFilterBarTargets(bar, [box, grid]));
      ws.execute(
        c.setFields({
          targets: [{ kind: "node", id: bar }],
          props: {
            defaultQuery: {
              kind: "set",
              value: {
                id: "filter-scope",
                op: "and",
                items: [
                  {
                    id: "c-kang",
                    fields: [["data:field:f-oname"]],
                    op: "equals",
                    value: "Kang",
                  },
                ],
              },
            },
          },
        }),
      );
      ws.selectItems([]);
    },
    { bar: ordersBar, box: ids.box, grid: ids.grid, repo: REPO.replace(/^\//, "") },
  ).catch(async (error) => {
    throw new Error(`orders bar: ${error}`);
  });
  await settle(800);
  const bars = { usersBar, ordersBar, ticketsBar };
  record("setup — three bars by 「Add filter bar」", Object.values(bars).every(Boolean), bars);

  // ── Publish ── (requests from here on are the Publish tab's — before, the Builder's own reads)
  const publishFrom = log.length;
  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) => ["Preview", "미리보기"].includes(b.getAttribute("aria-label")))
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector(".react-aria-FilterBar", { timeout: 60000 });
  await pub.waitForTimeout(2500);
  const pause = (ms = 600) => pub.waitForTimeout(ms);

  const read = () =>
    pub.evaluate(() => {
      const text = (el) => el.textContent.trim();
      const tables = [...document.querySelectorAll(".react-aria-Table")];
      const rowsOf = (table, pattern) =>
        [...(table?.querySelectorAll('[role="row"]') ?? [])]
          .map((row) => pattern.exec(row.textContent)?.[0])
          .filter(Boolean);
      return {
        bars: document.querySelectorAll(".react-aria-FilterBar").length,
        users: rowsOf(tables[0], /Ann|Ben|Cal|Dee|Eve|Fox/),
        tickets: [...(tables[1]?.querySelectorAll('[role="row"]') ?? [])]
          .map((row) => row.querySelector('[role="rowheader"], [role="gridcell"]'))
          .filter(Boolean)
          .map((cell) => text(cell))
          .filter((name) => /^T\d+$/.test(name)),
        box: [...document.querySelectorAll(".react-aria-ListBox [role='option']")]
          .map((item) => /Kim|Park|Lee|Choi|Jung|Han|Kang/.exec(text(item))?.[0])
          .filter(Boolean),
        grid: [...document.querySelectorAll(".react-aria-GridList [role='row']")]
          .map((item) => /Kim|Park|Lee|Choi|Jung|Han|Kang/.exec(text(item))?.[0])
          .filter(Boolean),
        options: [...document.querySelectorAll('[role="dialog"] [role="option"]')].map(
          (item) => item.querySelector('[slot="label"]')?.textContent ?? text(item),
        ),
      };
    });
  const barNth = (index) => pub.locator(".react-aria-FilterBar").nth(index);
  const addFilter = async (index, field, op) => {
    await barNth(index).getByRole("button", { name: "Add filter" }).click();
    await pause(500);
    await pub.getByRole("menuitem", { name: field }).last().click();
    await pause(700);
    await pub.getByRole("menuitemradio", { name: op }).click();
    await pub.waitForSelector('[role="dialog"] [role="listbox"]', { timeout: 10000 });
    await pause(900);
  };

  let now = await read();
  record(
    "0 Publish — three bars · Users all six · Tickets loaded by pages (not all 30 — no paused · review row)",
    now.bars === 3 &&
      now.users.length === 6 &&
      now.tickets.length >= 3 &&
      now.tickets.length < 24,
    now,
  );

  // 1. local
  await addFilter(0, "Type", "Is one of");
  const localOptions = (await read()).options;
  await pub.locator('[role="dialog"] [role="option"]').filter({ hasText: /^A/ }).click();
  await pause(300);
  await pub.getByRole("button", { name: "Apply" }).click();
  await pause(900);
  now = await read();
  record(
    "1 local — Type › Is one of: candidates A · B · C (loaded rows) → A → Ann Ben",
    same(localOptions, ["A", "B", "C"]) && same(now.users, ["Ann", "Ben"]),
    { localOptions, users: now.users },
  );
  await pub.screenshot({ path: `${OUT}/1-local.png` });

  // 2. suffix — R10
  const builderOrders = log
    .slice(0, publishFrom)
    .filter((item) => item.path === "/orders")
    .map((item) => item.query);
  const orders = log
    .slice(publishFrom)
    .filter((item) => item.path === "/orders")
    .map((item) => item.query);
  record(
    "2 suffix · R10 — each list's request carries its own conditions; the ListBox both Kangs, the GridList the open one",
    orders.some((q) => /name=Kang/.test(q) && !/status=/.test(q)) &&
      orders.some((q) => /status=open/.test(q) && /name=Kang/.test(q)) &&
      !orders.some((q) => /status=open/.test(q) && !/name=Kang/.test(q)) &&
      same(now.box, ["Kang", "Kang"]) &&
      same(now.grid, ["Kang"]),
    { orders, box: now.box, grid: now.grid },
  );

  const seen = await pub.evaluate(() => [...window.__ordersSeen]);
  record(
    // (The collection's own first request (ADR-325 — `""`) and its next page are asked too — no
    //  list shows them; recorded, LOW — breakdown §9 Phase 6.)
    "2b start — no Orders list ever showed a row its start condition leaves out",
    same(seen, ["Kang"]),
    { seen, orders, builderOrders },
  );

  // 3. body — the server's candidate values
  const before = log.length;
  await addFilter(2, "Status", "Is one of");
  // (The list's end loads the next pages while it is in view.)
  await pause(1500);
  const served = (await read()).options;
  const facetRequests = () =>
    log.slice(before).filter((item) => item.path === "/tickets" && item.body?.facet);
  const first = facetRequests();
  record(
    "3a body — the candidates come from the server (`facet` request): paused · review that no loaded row has",
    first.length >= 1 &&
      first[0].body.facet.field === "status" &&
      served.includes("paused") &&
      served.includes("review") &&
      served.includes("waiting"),
    { served, requests: first.map((item) => item.body) },
  );
  await pub.screenshot({ path: `${OUT}/3a-server-values.png` });
  const search = pub.locator('[role="dialog"] input[type="search"]');
  const typedAt = log.length;
  await search.fill("w");
  await pub.waitForTimeout(80);
  await search.fill("wa");
  await pub.waitForTimeout(150);
  const tooEarly = log.slice(typedAt).filter((item) => item.body?.facet).length;
  await pause(900);
  const searched = log.slice(typedAt).filter((item) => item.body?.facet);
  const afterSearch = (await read()).options;
  record(
    "3b search — nothing before 250 ms, then one request `search: \"wa\"` → waiting",
    tooEarly === 0 &&
      searched.length === 1 &&
      searched[0].body.facet.search === "wa" &&
      same(afterSearch, ["waiting"]),
    { tooEarly, searched: searched.map((item) => item.body), afterSearch },
  );
  const rowsAt = log.length;
  await pub.locator('[role="dialog"] [role="option"]').filter({ hasText: /^waiting/ }).click();
  await pause(300);
  await pub.getByRole("button", { name: "Apply" }).click();
  await pause(1500);
  now = await read();
  const rowRequests = log
    .slice(rowsAt)
    .filter((item) => item.path === "/tickets" && !item.body?.facet)
    .map((item) => item.body);
  record(
    "3c Apply — the rows request carries `status oneOf [waiting]` → the waiting tickets",
    rowRequests.some((item) =>
      JSON.stringify(item?.where ?? {}).includes('"oneOf","value":["waiting"]'),
    ) && same(now.tickets, WAITING),
    { rowRequests, tickets: now.tickets },
  );
  await pub.screenshot({ path: `${OUT}/3c-applied.png` });
  await pub.close();
} catch (error) {
  record("harness", false, String(error?.stack ?? error));
} finally {
  record("4 page errors 0", errors.length === 0, errors);
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(failed ? `FAILED ${failed}\n` : `ALL PASS ${results.length}\n`);
  await browser.close();
  server.close();
}

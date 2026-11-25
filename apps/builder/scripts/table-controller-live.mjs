#!/usr/bin/env node
// Table controller live (2026-11-25 — the Preview session's Tables moved to `catalogTableController.ts`):
// the paths the controller runs, pressed in Publish.
//   1. Components 패널 「table」 → Users (4 행) 연결 · data Column 마다 `allowsSorting`, 마지막 Column 에 MenuItem (메뉴 열)
//   2. Publish: 첫 data 열 머리글 클릭 → aria-sort ascending · 첫 열 글자가 오름차순 (pressTableSort →
//      setTableState → 행 다시 읽기 → 정렬 표시)
//   3. 같은 머리글 다시 클릭 → descending · 내림차순
//   4. 메뉴 열의 메뉴 버튼 → 항목에 정렬 항목 · 「Export」 (tableColumnMenu), 정렬 항목 실행 →
//      그 열이 정렬됨 (runTableColumnMenu)
//   5. page error 0
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/table-controller-live.mjs <out-dir>
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/table-controller-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`,
  );
};

const state = JSON.parse(
  readFileSync(`${REPO}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1920, height: 1100 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

const place = async (label) => {
  const components = railButton(page, "components");
  if ((await components.getAttribute("aria-pressed")) !== "true") {
    await components.click();
    await page.waitForTimeout(900);
  }
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
  );
  const item = page
    .locator("button, [role='button'], [role='option'], [role='gridcell']")
    .filter({ hasText: label })
    .first();
  await item.waitFor({ state: "visible", timeout: 15000 });
  await item.click();
  await page.waitForTimeout(1500);
};

const openDesign = async () => {
  const components = railButton(page, "components");
  if ((await components.getAttribute("aria-pressed")) === "true") {
    await components.click();
    await page.waitForTimeout(600);
  }
  const design = railButton(page, "properties");
  if ((await design.getAttribute("aria-pressed")) !== "true") {
    await design.click();
    await page.waitForTimeout(900);
  }
  await page.waitForTimeout(800);
};

const field = (label) =>
  page
    .locator(".panel-wrapper[data-panel='properties'] fieldset", {
      has: page.locator("legend", { hasText: label }),
    })
    .first();

/** The first record of `type` (its edit target) — and a write of `props` to it, one command. */
const write = (type, props) =>
  page.evaluate(
    ({ type, props }) => {
      const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
      const r = ws.root;
      const record = [...r.canvasInputs.values()]
        .filter((x) => r.typeOf(x) === type)
        .at(-1);
      if (Object.keys(props).length)
        ws.execute(
          c.setFields({
            targets: [ws.itemOfRecord(record.id).target],
            props: Object.fromEntries(
              Object.entries(props).map(([k, v]) => [
                k,
                { kind: "set", value: v },
              ]),
            ),
          }),
        );
      return record.id;
    },
    { type, props },
  );

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("table controller live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(1500);
  await place(/^table$/i);
  // (A bound Table — rows the state sorts: the Users rows in an unsorted order.)
  await page.evaluate(() => {
    const h = window.__COMPOSITION_CATALOG__;
    const ws = h.workspace;
    ws.execute(
      h.commands.setDataEntries({
        puts: [
          {
            kind: "collection",
            id: "data:collection:users",
            name: "Users",
            schema: [
              { id: "f-id", key: "id", type: "string" },
              { id: "f-name", key: "name", type: "string" },
              { id: "f-type", key: "type", type: "string" },
              { id: "f-status", key: "status", type: "number" },
            ],
            mockData: [
              { id: "p1", name: "Bora", type: "B", status: 2 },
              { id: "p2", name: "Chan", type: "A", status: 1 },
              { id: "p3", name: "Ara", type: "B", status: 3 },
              { id: "p4", name: "Dana", type: "A", status: 5 },
            ],
            useMockData: true,
          },
        ],
      }),
    );
    const r = ws.root;
    const table = [...r.canvasInputs.values()].find(
      (x) => r.typeOf(x) === "Table",
    );
    ws.execute(
      h.binding.catalogBindingCommand(
        [{ kind: "node", id: table.sourceId }],
        h.binding.catalogBindingRef({
          source: "dataTable",
          collectionId: "users",
          name: "Users",
        }),
      ),
    );
  });
  await page.waitForTimeout(1500);
  const setup = await page.evaluate(() => {
    const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
    const r = ws.root;
    const columns = [...r.canvasInputs.values()].filter(
      (x) =>
        r.typeOf(x) === "Column" &&
        typeof x.props.children === "string" &&
        x.props.children !== "",
    );
    const targets = columns.map((x) => ws.itemOfRecord(x.id).target);
    if (targets.some((t) => t.kind !== "node")) return { error: "not owned" };
    ws.execute(
      c.setFields({
        targets,
        props: { allowsSorting: { kind: "set", value: true } },
      }),
    );
    const last = targets.at(-1);
    const blank = { visual: {}, sizing: {}, descendantOverrides: [] };
    ws.execute(
      c.insertNodes({
        parent: { kind: "node", id: last.id },
        entries: [
          {
            kind: "node",
            id: "project:node:live-ctrl-item",
            definitionId: "lib:definition:type-MenuItem",
            children: ["project:node:live-ctrl-text"],
            props: { id: { kind: "set", value: "export" } },
            ...blank,
          },
          {
            kind: "node",
            id: "project:node:live-ctrl-text",
            definitionId: "lib:definition:text",
            children: [],
            props: { children: { kind: "set", value: "Export" } },
            ...blank,
          },
        ],
        rootIds: ["project:node:live-ctrl-item"],
        newId: ws.newId,
      }),
    );
    return { columns: columns.map((x) => x.props.children) };
  });
  await page.waitForTimeout(1000);

  const popup = context.waitForEvent("page", { timeout: 30000 });
  await page.evaluate(() =>
    [...document.querySelectorAll("button")]
      .find((b) =>
        ["Preview", "미리보기"].includes(b.getAttribute("aria-label")),
      )
      ?.click(),
  );
  const pub = await popup;
  pub.on("pageerror", (e) => errors.push(`publish: ${e.message}`));
  await pub.waitForURL((u) => String(u) !== "about:blank", { timeout: 30000 });
  await pub.waitForSelector('[role="columnheader"]', { timeout: 60000 });
  await pub.waitForTimeout(1000);
  /** The data rows' cell texts of column `index` (in DOM order) and each header's aria-sort. */
  const read = (index) =>
    pub.evaluate((index) => {
      const headers = [...document.querySelectorAll('[role="columnheader"]')]
        .filter((h) => (h.textContent ?? "").trim() !== "")
        .map((h) => ({
          name: (h.textContent ?? "").trim(),
          sort: h.getAttribute("aria-sort"),
        }));
      const rows = [...document.querySelectorAll('[role="row"]')]
        .map((row) =>
          [
            ...row.querySelectorAll('[role="rowheader"], [role="gridcell"]'),
          ].map((cell) => (cell.textContent ?? "").trim()),
        )
        .filter((cells) => cells.length > 0)
        .map((cells) => cells.filter((text) => text !== ""));
      return { headers, values: rows.map((cells) => cells[index]) };
    }, index);
  const sorted = (values, dir) => {
    const copy = [...values].sort((a, b) =>
      String(a).localeCompare(String(b), undefined, { numeric: true }),
    );
    if (dir === "descending") copy.reverse();
    return JSON.stringify(copy) === JSON.stringify(values);
  };
  const before = await read(0);
  const firstHeader = pub
    .locator('[role="columnheader"]')
    .filter({ hasText: before.headers[0].name })
    .first();
  await firstHeader.click();
  await pub.waitForTimeout(800);
  const up = await read(0);
  record(
    "2 머리글 클릭: ascending · 첫 열 오름차순",
    up.headers[0].sort === "ascending" &&
      sorted(up.values, "ascending") &&
      up.values.length > 1,
    { before: before.values, after: up.values, headers: up.headers, setup },
  );
  await firstHeader.click();
  await pub.waitForTimeout(800);
  const down = await read(0);
  record(
    "3 다시 클릭: descending · 내림차순",
    down.headers[0].sort === "descending" && sorted(down.values, "descending"),
    { after: down.values, headers: down.headers },
  );
  const button = pub.locator(".catalog-column-menu-button").first();
  await button.click();
  await pub.waitForTimeout(800);
  const items = await pub.evaluate(() =>
    [
      ...document.querySelectorAll('[role="menuitem"], [role="menuitemradio"]'),
    ].map((e) => e.textContent.trim()),
  );
  const sortItem = pub
    .locator('[role="menuitem"], [role="menuitemradio"]')
    .filter({ hasText: /ascending|오름차순|Sort A|Sort/i })
    .first();
  const sortLabel = (await sortItem.count())
    ? await sortItem.innerText()
    : null;
  if (sortLabel) await sortItem.click();
  await pub.waitForTimeout(900);
  const index = down.headers.length - 1;
  const menuSorted = await read(index);
  await pub.screenshot({ path: `${OUT}/publish.png` });
  record(
    "4 열 메뉴: 정렬 항목 · Export, 정렬 항목 실행 → 그 열 정렬",
    items.includes("Export") &&
      !!sortLabel &&
      menuSorted.headers[index].sort !== null &&
      menuSorted.headers[index].sort !== "none" &&
      sorted(menuSorted.values, menuSorted.headers[index].sort),
    {
      items,
      sortLabel,
      headers: menuSorted.headers,
      values: menuSorted.values,
    },
  );
} catch (error) {
  record("run", false, String(error?.stack ?? error));
  await page.screenshot({ path: `${OUT}/error.png` }).catch(() => {});
}

record("5 page error 0", errors.length === 0, errors);
await browser.close();
const failed = results.filter((r) => !r.pass);
process.stdout.write(
  `\n${results.length - failed.length}/${results.length} PASS\n`,
);
process.exit(failed.length ? 1 : 0);

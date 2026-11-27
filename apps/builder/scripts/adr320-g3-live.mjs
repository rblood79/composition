#!/usr/bin/env node
// ADR-320 G3 live — the running chip line in a real Publish tab (Phase 3), Chrome or WebKit:
//   0. a bound Table (Users — 6 rows) → its 「Add filter bar」 → the start condition 「Type is one of A, B」
//   1. Publish: one chip, the Table's 4 rows (the start filters the rows)
//   2. pointer: the chip's comparison → 「Equals」 → its value editor opens → the candidate 「C」 →
//      「Apply」 → 2 rows, the chip 「Type Equals C」
//   3. keyboard: Tab to 「Add filter」 → Enter → type 「Sta」 → Enter (Status) → the comparison menu
//      opens → Enter → the value editor opens → type 1 → Enter → 「Status Equals 1」 · 1 row
//   4. keyboard: the chip's condition menu → 「Turn off」 → the rows of the other condition
//   5. pointer: the remove button → the chip goes; 「Clear」 → the start again (1 chip · 4 rows)
//   6. announce: the live region says the applied count
//   7. page errors 0
//
//   BUILDER_URL=http://localhost:5173 [BROWSER=webkit] node apps/builder/scripts/adr320-g3-live.mjs <out-dir> [--headless]
import { mkdirSync, readFileSync } from "node:fs";
import { chromium, webkit } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr320-g3-live";
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const HEADLESS = process.argv.includes("--headless");

const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1200)}\n`,
  );
};

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
  viewport: { width: 1920, height: 1100 },
});
const errors = [];
const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`builder: ${e.message}`));

const openRail = async (id) => {
  const button = railButton(page, id);
  if ((await button.getAttribute("aria-pressed")) !== "true") {
    await button.click();
    await page.waitForTimeout(900);
  }
};

/** The bar's Canvas records: type · texts · box relative to the bar. */
const barRecords = () =>
  page.evaluate(() => {
    const { workspace: ws, canvas } = window.__COMPOSITION_CATALOG__;
    const r = ws.root;
    const bar = [...r.canvasInputs.values()].find(
      (x) => r.typeOf(x) === "FilterBar",
    );
    if (!bar) return null;
    const g = canvas.boundsOf(bar.id);
    const rows = [];
    const visit = (id) => {
      const rec = r.canvasInputs.get(id);
      if (!rec || rec.hidden) return;
      const b = canvas.boundsOf(id);
      rows.push({
        id,
        node: rec.sourceId,
        type: r.typeOf(rec),
        text:
          typeof rec.props?.children === "string"
            ? rec.props.children
            : undefined,
        label: rec.props?.label,
        x: b && b.x - g.x,
        y: b && b.y - g.y,
        w: b?.width,
        h: b?.height,
      });
      for (const child of rec.children) visit(child);
    };
    visit(bar.id);
    const node = ws.runtime.graph.getEntry(bar.sourceId);
    return { rows, filtersOf: node?.filtersOf ?? null, barNode: bar.sourceId };
  });

try {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type("adr320 g3 live");
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    {
      timeout: 30000,
    },
  );
  await page.waitForTimeout(1500);

  // 0. A Users collection and a bound Table (the product commands — the data UI is not this gate's).
  const tableNode = await page.evaluate(async () => {
    const {
      workspace: ws,
      commands: c,
      palette,
      binding,
    } = window.__COMPOSITION_CATALOG__;
    ws.execute(
      c.setDataEntries({
        puts: [
          {
            kind: "collection",
            id: "data:collection:users",
            name: "Users",
            schema: [
              { id: "f-id", key: "id", type: "string" },
              { id: "f-name", key: "name", type: "string", label: "Name" },
              { id: "f-type", key: "type", type: "string", label: "Type" },
              {
                id: "f-status",
                key: "status",
                type: "number",
                label: "Status",
              },
            ],
            mockData: [
              { id: "p1", name: "Ann", type: "A", status: 1 },
              { id: "p2", name: "Ben", type: "A", status: 2 },
              { id: "p3", name: "Cal", type: "B", status: 1 },
              { id: "p4", name: "Dee", type: "B", status: 2 },
              { id: "p5", name: "Eve", type: "C", status: 1 },
              { id: "p6", name: "Fox", type: "C", status: 2 },
            ],
            useMockData: true,
          },
        ],
      }),
    );
    const graph = ws.runtime.graph;
    const project = graph.getEntry(graph.projectId);
    const pageEntry = graph.getEntry(project.pageIds[0]);
    const body = pageEntry.children[0];
    const id = ws.newId("node");
    ws.execute(
      c.insertNodes({
        parent: { kind: "node", id: body },
        entries: [
          {
            kind: "node",
            id,
            definitionId: palette.catalogPaletteDefinitionId(
              graph.library,
              "Table",
            ),
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
    ws.execute(
      binding.catalogBindingCommand(
        [{ kind: "node", id }],
        binding.catalogBindingRef({
          source: "dataTable",
          collectionId: "users",
          name: "Users",
        }),
      ),
    );
    const [recordId] = ws.recordsOfNode(id);
    ws.selectRecords([recordId]);
    return id;
  });
  await page.waitForTimeout(800);

  // 0. 「Add filter bar」, then its start condition.
  await openRail("properties");
  const add = page.getByRole("button", { name: /^add filter bar$/i }).first();
  await add.waitFor({ state: "visible", timeout: 15000 });
  await add.click();
  await page.waitForTimeout(1200);
  const bar = await barRecords();
  await page.evaluate((node) => {
    const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
    ws.execute(
      c.setFields({
        targets: [{ kind: "node", id: node }],
        props: {
          defaultQuery: {
            kind: "set",
            value: {
              id: "filter-scope",
              op: "and",
              items: [
                {
                  id: "c1",
                  fields: [["data:field:f-type"]],
                  op: "oneOf",
                  value: ["A", "B"],
                },
              ],
            },
          },
        },
      }),
    );
    ws.selectItems([]);
  }, bar.barNode);
  await page.waitForTimeout(800);
  const rail = railButton(page, "properties");
  if ((await rail.getAttribute("aria-pressed")) === "true") await rail.click();

  // Publish.
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
  await pub.waitForSelector(".react-aria-FilterBar", { timeout: 60000 });
  await pub.waitForTimeout(1500);
  const read = () =>
    pub.evaluate(() => {
      const barEl =
        document.querySelector(".react-aria-FilterBar") ?? document.body;
      return {
        bar: !!document.querySelector(".react-aria-FilterBar"),
        body: document.body.innerText.slice(0, 300),
        chips: [...barEl.querySelectorAll('[role="group"]')].map((chip) =>
          chip.getAttribute("aria-label"),
        ),
        rows: [...document.querySelectorAll('[role="row"]')]
          .map((row) => /Ann|Ben|Cal|Dee|Eve|Fox/.exec(row.textContent)?.[0])
          .filter(Boolean),
        live: [...document.querySelectorAll("[aria-live]")]
          .map((el) => el.textContent)
          .join(" | "),
        menu: [
          ...document.querySelectorAll(
            '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]',
          ),
        ].map((item) => item.textContent.trim()),
        dialog: !!document.querySelector('[role="dialog"]'),
        focused: document.activeElement?.textContent?.trim() ?? "",
      };
    });
  const settle = (ms = 500) => pub.waitForTimeout(ms);
  const chipButton = (index, name) =>
    pub
      .locator('.react-aria-FilterBar [role="group"]')
      .nth(index)
      .getByRole("button", { name });

  let now = await read();
  record(
    "1 Publish — the start is one chip and filters the Table (4 rows)",
    now.chips.length === 1 &&
      JSON.stringify(now.rows) === JSON.stringify(["Ann", "Ben", "Cal", "Dee"]),
    now,
  );
  await pub.screenshot({ path: `${OUT}/1-start.png` });

  // 2. Pointer: comparison → Equals → the value editor opens → C → Apply.
  await chipButton(0, "Is one of").click();
  await settle();
  await pub.getByRole("menuitemradio", { name: "Equals" }).click();
  await pub.waitForSelector('[role="dialog"]', { timeout: 10000 });
  await settle();
  await pub.screenshot({ path: `${OUT}/2a-dialog.png` });
  await pub.locator('[role="dialog"] [role="option"]', { hasText: "C" }).click();
  await settle(200);
  await pub.screenshot({ path: `${OUT}/2b-picked.png` });
  await pub.getByRole("button", { name: "Apply" }).click();
  await settle(800);
  now = await read();
  record(
    "2 pointer — comparison 「Equals」 opens the value editor; 「C」 · Apply → 2 rows",
    JSON.stringify(now.chips) === JSON.stringify(["Type Equals C"]) &&
      JSON.stringify(now.rows) === JSON.stringify(["Eve", "Fox"]),
    now,
  );
  await pub.screenshot({ path: `${OUT}/2-pointer.png` });

  // 3. Keyboard: Add filter → Status → Equals → 1.
  const addFilter = pub.getByRole("button", { name: "Add filter" });
  await addFilter.focus();
  await pub.keyboard.press("Enter");
  await settle();
  await pub.keyboard.type("Sta");
  await settle(300);
  await pub.keyboard.press("ArrowDown");
  await pub.keyboard.press("Enter");
  await settle(800);
  const afterField = await read();
  // (The comparison menu of the new condition is open, its first item focused.)
  await pub.keyboard.press("Enter");
  await pub.waitForSelector('[role="dialog"]', { timeout: 10000 });
  await settle();
  await pub.keyboard.type("1");
  await pub.keyboard.press("Enter");
  await settle(800);
  now = await read();
  record(
    "3 keyboard — Add filter · Enter · 「Sta」 · Enter → its comparison menu → Enter → its value editor → 1 · Enter",
    afterField.menu.includes("Equals") &&
      JSON.stringify(now.chips) ===
        JSON.stringify(["Type Equals C", "Status Equals 1"]) &&
      JSON.stringify(now.rows) === JSON.stringify(["Eve"]),
    { afterField: afterField.menu, now },
  );

  // 4. Keyboard: the first chip's condition menu → Turn off.
  await chipButton(0, "Condition menu").focus();
  await pub.keyboard.press("Enter");
  await settle();
  const menu = (await read()).menu;
  await pub.keyboard.press("ArrowDown");
  await pub.keyboard.press("Enter");
  await settle(800);
  now = await read();
  record(
    "4 keyboard — condition menu (Duplicate · Turn off · Delete) → Turn off → the other condition's rows",
    JSON.stringify(menu) ===
      JSON.stringify(["Duplicate", "Turn off", "Delete"]) &&
      now.chips[0] === "Type Equals C off" &&
      JSON.stringify(now.rows) === JSON.stringify(["Ann", "Cal", "Eve"]),
    { menu, now },
  );

  // 5. Pointer: remove, then Clear.
  await chipButton(1, "Remove condition").click();
  await settle(800);
  const removed = await read();
  await pub.getByRole("button", { name: "Clear" }).click();
  await settle(800);
  now = await read();
  record(
    "5 remove → the chip goes; 「Clear」 → the start (1 chip · 4 rows)",
    removed.chips.length === 1 &&
      JSON.stringify(now.chips) === JSON.stringify(["Type Is one of A, B"]) &&
      JSON.stringify(now.rows) === JSON.stringify(["Ann", "Ben", "Cal", "Dee"]),
    { removed: removed.chips, now },
  );
  record(
    "6 announce — the live region says the applied count",
    /condition.* applied/.test(now.live),
    now.live,
  );
  await pub.screenshot({ path: `${OUT}/5-cleared.png` });
  await pub.close();
} catch (error) {
  record("harness", false, String(error?.stack ?? error));
} finally {
  record("7 page errors 0", errors.length === 0, errors);
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(
    failed ? `FAILED ${failed}\n` : `ALL PASS ${results.length}\n`,
  );
  await browser.close();
}

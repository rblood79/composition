#!/usr/bin/env node
// ADR-320 G2 live — the filter bar's registration and authoring in the real Builder (Phase 2):
//   1. a bound Table (Users) → its Design panel 「Search · filter」 → 「Add filter bar」 (the panel
//      button): a FilterBar right before the Table, connected (`filtersOf`), its buttons on the Canvas
//   2. the bar's Design panel 「Add condition」 (the start conditions field) → a chip on the Canvas
//   3. a start tree of three (a condition · a condition · a group) → three chips, their texts
//   4. Publish: RAC Toolbar 「Filters」 > a RAC Group per chip named 「field comparison value」; the bar's
//      · chips' · buttons' boxes = the Canvas records' (±1 px, relative to the bar)
//   5. undo ×2 → the start tree back to one condition, then none (the chip gone)
//   6. page errors 0
//
//   BUILDER_URL=http://localhost:5173 AUTH_STATE=<.auth-session.json> node apps/builder/scripts/adr320-g2-live.mjs <out-dir> [--headless]
import { mkdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
import { railButton } from "./railButton.mjs";

const OUT = process.argv[2] ?? "/private/tmp/adr320-g2-live";
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
const browser = await chromium.launch({
  headless: HEADLESS,
  channel: "chrome",
});
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
  await page.keyboard.type("adr320 g2 live");
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
              { id: "p1", name: "Bora", type: "B", status: 2 },
              { id: "p2", name: "Chan", type: "A", status: 1 },
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

  // 1. The Table's Design panel → 「Add filter bar」.
  await openRail("properties");
  const add = page.getByRole("button", { name: /^add filter bar$/i }).first();
  await add.waitFor({ state: "visible", timeout: 15000 });
  await add.click();
  await page.waitForTimeout(1200);
  let bar = await barRecords();
  const bodyOrder = await page.evaluate(() => {
    const { workspace: ws } = window.__COMPOSITION_CATALOG__;
    const graph = ws.runtime.graph;
    const project = graph.getEntry(graph.projectId);
    const body = graph.getEntry(graph.getEntry(project.pageIds[0]).children[0]);
    return body.children.map(
      (id) => graph.getDefinition(graph.getEntry(id).definitionId)?.name,
    );
  });
  record(
    "1 「Add filter bar」 — FilterBar before the Table, connected, its buttons drawn",
    !!bar &&
      bodyOrder.join(",") === "FilterBar,Table" &&
      JSON.stringify(bar.filtersOf) === JSON.stringify([tableNode]) &&
      bar.rows.filter((row) => row.type === "FilterChip").length === 0 &&
      ["Add filter", "Edit conditions", "Clear"].every((text) =>
        bar.rows.some((row) => row.text === text),
      ),
    {
      bodyOrder,
      filtersOf: bar?.filtersOf,
      types: bar?.rows.map((row) => row.type),
    },
  );
  await page.screenshot({ path: `${OUT}/1-added.png` });

  // 2. The bar's Design panel → 「Add condition」 (start conditions).
  await page.evaluate((node) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const [recordId] = ws.recordsOfNode(node);
    ws.selectRecords([recordId]);
  }, bar.barNode);
  await page.waitForTimeout(800);
  const addCondition = page
    .getByRole("button", { name: /^add condition$/i })
    .first();
  await addCondition.waitFor({ state: "visible", timeout: 15000 });
  await addCondition.click();
  await page.waitForTimeout(1000);
  bar = await barRecords();
  const one = bar.rows.filter((row) => row.type === "FilterChip");
  record(
    "2 「Add condition」 → one chip (the first field, its first comparison)",
    one.length === 1 && /^id /.test(String(one[0].label)),
    one.map((chip) => chip.label),
  );

  // 3. A start tree of three.
  await page.evaluate((node) => {
    const { workspace: ws, commands: c } = window.__COMPOSITION_CATALOG__;
    const cond = (id, field, op, value) => ({
      id,
      fields: [[`data:field:f-${field}`]],
      op,
      ...(value === undefined ? {} : { value }),
    });
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
                cond("c1", "name", "contains", "Bo"),
                cond("c2", "status", "gte", 2),
                {
                  id: "g1",
                  op: "or",
                  items: [
                    cond("c3", "type", "equals", "A"),
                    cond("c4", "type", "equals", "B"),
                  ],
                },
              ],
            },
          },
        },
      }),
    );
    ws.selectItems([]);
  }, bar.barNode);
  await page.waitForTimeout(1000);
  bar = await barRecords();
  const labels = bar.rows
    .filter((row) => row.type === "FilterChip")
    .map((row) => row.label);
  const texts = bar.rows.filter((row) => row.text).map((row) => row.text);
  record(
    "3 three chips — field label · comparison · value, the group counted",
    JSON.stringify(labels) ===
      JSON.stringify([
        "Name Contains Bo",
        "Status At least 2",
        "Group (2 conditions)",
      ]) &&
      [
        "Name",
        "Contains",
        "Bo",
        "Status",
        "At least",
        "2",
        "Group (2 conditions)",
      ].every((t) => texts.includes(t)),
    { labels, texts },
  );
  const rail = railButton(page, "properties");
  if ((await rail.getAttribute("aria-pressed")) === "true") await rail.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/3-chips.png` });

  // 4. Publish.
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
  await pub.waitForTimeout(1200);
  const dom = await pub.evaluate(() => {
    const barEl = document.querySelector(".react-aria-FilterBar");
    const origin = barEl.getBoundingClientRect();
    const box = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x - origin.x, y: r.y - origin.y, w: r.width, h: r.height };
    };
    return {
      role: barEl.getAttribute("role"),
      name: barEl.getAttribute("aria-label"),
      bar: box(barEl),
      chips: [...barEl.querySelectorAll(".react-aria-FilterChip")].map(
        (chip) => ({
          role: chip.getAttribute("role"),
          name: chip.getAttribute("aria-label"),
          ...box(chip),
        }),
      ),
      buttons: [...barEl.querySelectorAll("button")].map((b) => ({
        text: b.textContent.trim(),
        ...box(b),
      })),
    };
  });
  await pub.screenshot({ path: `${OUT}/4-publish.png` });
  record(
    "4a Publish — RAC Toolbar 「Filters」 > Group per chip named 「field comparison value」",
    dom.role === "toolbar" &&
      dom.name === "Filters" &&
      dom.chips.every((chip) => chip.role === "group") &&
      JSON.stringify(dom.chips.map((chip) => chip.name)) ===
        JSON.stringify(labels),
    {
      role: dom.role,
      name: dom.name,
      chips: dom.chips.map((c) => [c.role, c.name]),
    },
  );
  const canvasChips = bar.rows.filter((row) => row.type === "FilterChip");
  const canvasButtons = bar.rows.filter((row) => row.type === "ActionButton");
  const close = (a, b) =>
    Math.abs(a.x - b.x) <= 1 &&
    Math.abs(a.y - b.y) <= 1 &&
    Math.abs(a.w - b.w) <= 1 &&
    Math.abs(a.h - b.h) <= 1;
  const chipPairs = canvasChips.map((chip, i) => [chip, dom.chips[i]]);
  const buttonPairs = canvasButtons.map((button, i) => [
    button,
    dom.buttons[i],
  ]);
  const badPairs = [...chipPairs, ...buttonPairs].filter(
    ([a, b]) => !b || !close(a, b),
  );
  record(
    "4b chips · buttons — Canvas record box = Publish box (±1 px, relative to the bar)",
    canvasChips.length === 3 &&
      canvasButtons.length === dom.buttons.length &&
      badPairs.length === 0 &&
      Math.abs(bar.rows[0].h - dom.bar.h) <= 1,
    {
      bar: [bar.rows[0].h, dom.bar.h],
      counts: [canvasChips.length, canvasButtons.length, dom.buttons.length],
      bad: badPairs.map(([a, b]) => [a.type, a, b]),
    },
  );
  await pub.close();

  // 5. Undo: the three-item tree → the one condition → none.
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());
  await page.waitForTimeout(600);
  const afterOne = (await barRecords()).rows.filter(
    (row) => row.type === "FilterChip",
  ).length;
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());
  await page.waitForTimeout(600);
  const afterTwo = (await barRecords()).rows.filter(
    (row) => row.type === "FilterChip",
  ).length;
  record("5 undo ×2 → 1 chip, then 0", afterOne === 1 && afterTwo === 0, {
    afterOne,
    afterTwo,
  });
} catch (error) {
  record("harness", false, String(error?.stack ?? error));
} finally {
  record("6 page errors 0", errors.length === 0, errors);
  const failed = results.filter((r) => !r.pass).length;
  process.stdout.write(
    failed ? `FAILED ${failed}\n` : `ALL PASS ${results.length}\n`,
  );
  await browser.close();
}

// ADR-256 Phase 5 review (Round 12) live — the repairs in the real Builder with the Preview open
// (Compare Mode), headed Chrome: a palette Table (h2) hides a column with its cells and refuses a
// cell hidden alone, (m3) names its rows by the second column once the first is marked not a row
// header, (h1) keeps a row made a component aligned on a new column and a deleted one; (m5) a
// SubmenuTrigger whose Popover comes first still opens its submenu; (m4) a leaf item's chevron
// wrapped in a frame stays a hidden chevron of the same box.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p5-review-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
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
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`,
  );
};
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
async function addFromPalette(label) {
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page
      .getByRole("button", { name: "Components", exact: true })
      .first()
      .click();
  await search.fill(label);
  await page.waitForTimeout(300);
  await page
    .locator(".list-item", { hasText: new RegExp(`^${label}$`, "i") })
    .first()
    .click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
}
async function compareOn() {
  const button = page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first();
  if (await button.isVisible().catch(() => false)) await button.click();
  await page.waitForTimeout(3000);
}

const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const shortcuts = `/@fs${REPO}/apps/builder/src/builder/catalogRuntime/shortcuts.ts`;
async function newProject(name) {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
}
const partId = (type, index = 0) =>
  page.evaluate(
    ({ type, index }) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      return [...ws.root.canvasInputs.values()].filter(
        (r) => ws.root.typeOf(r) === type,
      )[index]?.id;
    },
    { type, index },
  );
async function insertVia(partType, label, times) {
  const id = await partId(partType);
  await page.evaluate(
    (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
    id,
  );
  await page.waitForTimeout(600);
  if (
    !(await page
      .getByRole("button", { name: label, exact: true })
      .first()
      .isVisible()
      .catch(() => false))
  ) {
    await page
      .getByRole("button", { name: "Design", exact: true })
      .first()
      .click()
      .catch(() => {});
    await page.waitForTimeout(800);
  }
  for (let k = 0; k < times; k++) {
    await page
      .getByRole("button", { name: label, exact: true })
      .first()
      .click();
    await page.waitForTimeout(500);
    await page.evaluate(
      (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
      id,
    );
    await page.waitForTimeout(400);
  }
}
/** Run a catalog command in the page: `build(commands, ws)` returns the command. */
async function run(build, arg) {
  return page.evaluate(
    async ({ commands, build, arg }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const at = (id) => ws.positionOfRecord(id).target;
      try {
        ws.execute(
          new Function(
            "c",
            "ws",
            "at",
            "arg",
            `return (${build})(c, ws, at, arg);`,
          )(c, ws, at, arg),
        );
        await new Promise((r) => setTimeout(r, 400));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, build: build.toString(), arg },
  );
}
const tableGrid = (tableId) =>
  page.evaluate((tableId) => {
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const table = doc?.querySelector(
      `[data-catalog-id="${CSS.escape(tableId)}"]`,
    );
    return {
      columns: table?.querySelectorAll("[role=columnheader]").length ?? -1,
      rows: [...(table?.querySelectorAll("tbody [role=row]") ?? [])].map(
        (row) => row.children.length,
      ),
      rowHeaderAt: [...(table?.querySelectorAll("tbody [role=row]") ?? [])].map(
        (row) =>
          [...row.children].findIndex(
            (cell) => cell.getAttribute("role") === "rowheader",
          ),
      ),
    };
  }, tableId);

// ── Table (h1 · h2 · m3) ────────────────────────────────────────────────
await newProject("ADR-256 P5 review table");
await addFromPalette("table");
await page.waitForTimeout(800);
const tableId = await partId("Table");
await insertVia("TableHeader", "Insert Column", 2);
await insertVia("TableBody", "Insert Row", 2);
await compareOn();
const g0 = await tableGrid(tableId);
const col0 = await page.evaluate(
  (id) =>
    window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.get(id).sourceId,
  await partId("Column", 0),
);
const node = (c, ws, at, id) => ({ kind: "node", id });
const hide = await run(
  (c, ws, at, id) =>
    c.setWholeField({
      targets: [{ kind: "node", id }],
      field: "enabled",
      value: false,
    }),
  col0,
);
const g1 = await tableGrid(tableId);
// (The hidden column has no record — the layer row's eye names the node.)
const show = await run(
  (c, ws, at, id) =>
    c.setWholeField({
      targets: [{ kind: "node", id }],
      field: "enabled",
      value: undefined,
    }),
  col0,
);
const g2 = await tableGrid(tableId);
record(
  "R-1 (h2) hiding a column (the layer eye's command) hides its cells: the Preview grid stays whole, and comes back",
  JSON.stringify(g0.rows) === "[2,2]" &&
    hide.ok &&
    g1.columns === 1 &&
    JSON.stringify(g1.rows) === "[1,1]" &&
    show.ok &&
    g2.columns === 2 &&
    JSON.stringify(g2.rows) === "[2,2]",
  { g0, hide, g1, show, g2 },
);
const cell0 = await partId("Cell", 0);
const cellHide = await run(
  (c, ws, at, id) =>
    c.setWholeField({
      targets: [at(id)],
      field: "visibility",
      value: { tablet: false },
    }),
  cell0,
);
const g3 = await tableGrid(tableId);
record(
  "R-2 (h2) a cell hidden alone at a breakpoint (the Styles panel's command) is refused; nothing changes",
  !cellHide.ok &&
    cellHide.code === "TABLE_CELLS_NOT_ALIGNED" &&
    JSON.stringify(g3) === JSON.stringify(g2),
  { cellHide, g3 },
);
const notHeader = await run(
  (c, ws, at, id) =>
    c.setFields({
      targets: [{ kind: "node", id }],
      props: { isRowHeader: { kind: "set", value: false } },
    }),
  col0,
);
await page.waitForTimeout(800);
const g4 = await tableGrid(tableId);
record(
  "R-3 (m3) the first column marked not a row header: the Preview (mounted) names the rows by the second",
  notHeader.ok &&
    g4.columns === 2 &&
    JSON.stringify(g4.rowHeaderAt) === "[1,1]",
  { notHeader, g4 },
);
const row0 = await page.evaluate(
  (id) =>
    window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.get(id)
      ?.sourceId,
  await partId("Row", 0),
);
const made = await run(
  (c, ws, at, id) =>
    c.createComponent({ id, name: "File row", newId: ws.newId }),
  row0,
);
await insertVia("TableHeader", "Insert Column", 1);
await page.waitForTimeout(800);
const g5 = await tableGrid(tableId);
const del = await page.evaluate(
  async ({ shortcuts, id }) => {
    const { planCatalogShortcut } = await import(shortcuts);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.selectRecords([id]);
    const plan = planCatalogShortcut(ws, "delete");
    plan?.();
    await new Promise((r) => setTimeout(r, 500));
    return typeof plan === "function";
  },
  { shortcuts, id: await partId("Column", 0) },
);
const g6 = await tableGrid(tableId);
record(
  "R-4 (h1) a row made a component: a new column gives it a cell, deleting a column takes its cell — the Preview grid stays whole",
  made.ok &&
    g5.columns === 3 &&
    JSON.stringify(g5.rows) === "[3,3]" &&
    del &&
    g6.columns === 2 &&
    JSON.stringify(g6.rows) === "[2,2]",
  { made, g5, del, g6 },
);

// ── Menu (m5) ───────────────────────────────────────────────────────────
await newProject("ADR-256 P5 review submenu");
await addFromPalette("menu");
const menuId = await partId("Menu");
const built = await run((c, ws, at, menuId) => {
  const set = (value) => ({ kind: "set", value });
  const node = (id, definitionId, props = {}, children = []) => ({
    kind: "node",
    id,
    definitionId,
    children,
    props: Object.fromEntries(
      Object.entries(props).map(([k, v]) => [k, set(v)]),
    ),
    visual: {},
    sizing: {},
    descendantOverrides: [],
  });
  const id = () => ws.newId("node");
  const [trigger, item, label, popover, menu, sms, smsLabel] = [
    id(),
    id(),
    id(),
    id(),
    id(),
    id(),
    id(),
  ];
  // (Popover first — the order a move or a paste can leave.)
  return c.insertNodes({
    parent: at(menuId),
    index: 1,
    entries: [
      node(trigger, "lib:definition:type-SubmenuTrigger", {}, [popover, item]),
      node(item, "lib:definition:type-MenuItem", {}, [label]),
      node(label, "lib:definition:text", { slot: "label", children: "Share" }),
      node(popover, "lib:definition:type-Popover", {}, [menu]),
      node(menu, "lib:definition:type-Menu", {}, [sms]),
      node(sms, "lib:definition:type-MenuItem", {}, [smsLabel]),
      node(smsLabel, "lib:definition:text", { slot: "label", children: "SMS" }),
    ],
    rootIds: [trigger],
    newId: ws.newId,
  });
}, menuId);
await compareOn();
const frame = page.frameLocator("#previewFrame");
await frame
  .locator("button")
  .filter({ hasText: /^Menu$/ })
  .first()
  .evaluate((b) => b.click());
await page.waitForTimeout(800);
await frame
  .locator("[role=menu] [aria-haspopup=menu]")
  .first()
  .evaluate((el) => el.click())
  .catch(() => {});
await page.waitForTimeout(1000);
const menus = await page.evaluate(() => {
  const doc = document.querySelector("#previewFrame")?.contentDocument;
  return [...(doc?.querySelectorAll("[role=menu]") ?? [])].map((menu) =>
    [...menu.querySelectorAll(":scope > [role^=menuitem]")].map(
      (item) =>
        `${item.textContent}${item.getAttribute("aria-haspopup") ? "▸" : ""}`,
    ),
  );
});
record(
  "R-5 (m5) a SubmenuTrigger whose Popover comes first: the Preview menu opens, its item opens the submenu",
  built.ok &&
    menus.length === 2 &&
    menus[0].some((t) => t.startsWith("Share") && t.endsWith("▸")) &&
    JSON.stringify(menus[1]) === '["SMS"]',
  { built, menus },
);

// ── Tree (m4) ───────────────────────────────────────────────────────────
await newProject("ADR-256 P5 review tree");
// (An owned Tree — what a paste or an AI insert leaves: `insertNodes`. A palette Tree's items are
// origin instances whose positions cannot be detached — POSITION_HAS_DISPLAY_STATE.)
const bodyId = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const records = [...ws.root.canvasInputs.values()];
  return records.find((r) => ws.root.typeOf(r).toLowerCase() === "body")?.id;
});
const built2 = await run((c, ws, at, bodyId) => {
  const set = (value) => ({ kind: "set", value });
  const n = (id, type, props = {}, children = []) => ({
    kind: "node",
    id,
    definitionId:
      type === "frame"
        ? "lib:definition:frame"
        : type === "Text"
          ? "lib:definition:text"
          : `lib:definition:type-${type}`,
    children,
    props: Object.fromEntries(
      Object.entries(props).map(([k, v]) => [k, set(v)]),
    ),
    visual: {},
    sizing: {},
    descendantOverrides: [],
  });
  const row = (key, items = []) => [
    n(`project:node:r12-${key}`, "TreeItem", { id: key }, [
      `project:node:r12-${key}-c`,
      ...items,
    ]),
    n(`project:node:r12-${key}-c`, "TreeItemContent", {}, [
      `project:node:r12-${key}-b`,
      `project:node:r12-${key}-t`,
    ]),
    n(
      `project:node:r12-${key}-b`,
      "Button",
      { slot: "chevron", size: "sm", children: "" },
      [`project:node:r12-${key}-i`],
    ),
    n(`project:node:r12-${key}-i`, "Icon", {
      iconName: "chevron-right",
      size: "xs",
    }),
    n(`project:node:r12-${key}-t`, "Text", { children: key }),
  ];
  return c.insertNodes({
    parent: at(bodyId),
    entries: [
      n("project:node:r12-tree", "Tree", {}, [
        "project:node:r12-a",
        "project:node:r12-b",
      ]),
      ...row("a", ["project:node:r12-a1"]),
      ...row("a1"),
      ...row("b"),
    ],
    rootIds: ["project:node:r12-tree"],
    newId: ws.newId,
  });
}, bodyId);
const detached = built2;
const leafDetached = { ok: true };
const chevron = { source: "project:node:r12-b-b" };
const wrapped = await run(
  (c, ws, at, id) =>
    c.groupNodes({
      ids: [id],
      group: {
        kind: "node",
        id: ws.newId("node"),
        definitionId: "lib:definition:type-frame",
        children: [],
        props: {},
        visual: {},
        sizing: {},
        descendantOverrides: [],
      },
      newId: ws.newId,
    }),
  chevron.source,
);
await compareOn();
const tree = await page.evaluate((source) => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const root = ws.root;
  const button = [...root.canvasInputs.values()].find(
    (r) => r.sourceId === source,
  );
  const icon = root.canvasInputs.get(button.children[0]);
  const box = root.getGeometry([button.id]).get(button.id);
  const doc = document.querySelector("#previewFrame")?.contentDocument;
  const dom = doc?.querySelector(
    `[data-catalog-id="${CSS.escape(button.id)}"]`,
  );
  const r = dom?.getBoundingClientRect();
  return {
    parentType: root.typeOf(root.canvasInputs.get(button.parentId)),
    glyphHidden: icon?.hidden === true,
    canvasSize: [box?.width, box?.height],
    domSize: r ? [Math.round(r.width), Math.round(r.height)] : null,
    domVisibility: dom ? getComputedStyle(dom).visibility : null,
    domMinWidth: dom?.style.minWidth ?? null,
  };
}, chevron.source);
record(
  "R-6 (m4) an owned Tree (as pasted): a leaf item's chevron wrapped in a frame stays its chevron: Canvas glyph hidden · chevron box, Preview hidden RAC chevron of the same size",
  detached.ok &&
    leafDetached.ok &&
    wrapped.ok &&
    tree.parentType === "frame" &&
    tree.glyphHidden &&
    JSON.stringify(tree.canvasSize) === JSON.stringify(tree.domSize) &&
    tree.domVisibility === "hidden" &&
    tree.domMinWidth !== "50px",
  { bodyId, built: detached, chevron, wrapped, tree },
);
record("R-7 no page errors", errors.length === 0, { errors });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

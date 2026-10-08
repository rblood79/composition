// ADR-256 Phase 6h live: a Column's name sits in a RAC `Group` (react-aria.adobe.com Table — the
// starter Column is `Column > Group[role=presentation].column-name > children`). In the real
// Builder: a palette Table → Design's "Insert Column" (twice) and "Insert Row" → each Column is
// `Column > Group > Text`; the Design "Text" field of a Column renames it (Preview header · Canvas
// text); the Preview header is `th > div[role=presentation].react-aria-Group > name` in bold; the
// Canvas places every part where the Preview does; a TableView keeps plain Columns; a reload keeps
// it. Headed Chrome.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p6h-live.mjs <out>
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
const select = (id) =>
  page.evaluate(
    (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
    id,
  );
async function openDesign() {
  await page
    .getByRole("button", { name: "Design", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(800);
}

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-256 P6h column group");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await addFromPalette("table");
await page.waitForTimeout(800);
const idsOf = (type) =>
  page.evaluate((type) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    return [...ws.root.canvasInputs.values()]
      .filter((r) => ws.root.typeOf(r) === type)
      .map((r) => r.id);
  }, type);
const [tableId] = await idsOf("Table");
async function insertVia(partType, label, times) {
  const [id] = await idsOf(partType);
  await select(id);
  await page.waitForTimeout(600);
  const button = page.getByRole("button", { name: label, exact: true }).first();
  if (!(await button.isVisible().catch(() => false))) await openDesign();
  for (let k = 0; k < times; k++) {
    await page
      .getByRole("button", { name: label, exact: true })
      .first()
      .click();
    await page.waitForTimeout(500);
    await select(id);
    await page.waitForTimeout(400);
  }
}
await insertVia("TableHeader", "Insert Column", 2);
await insertVia("TableBody", "Insert Row", 1);
const shapeOf = (rootId) =>
  page.evaluate((rootId) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const walk = (id) => {
      const r = root.canvasInputs.get(id);
      return { t: root.typeOf(r), k: r.children.map(walk) };
    };
    const shape = (n) =>
      `${n.t}${n.k.length ? `(${n.k.map(shape).join(",")})` : ""}`;
    return shape(walk(rootId));
  }, rootId);
const shape0 = await shapeOf(tableId);
record(
  "L-1 Insert Column builds `Column > Group > Text` (the name group)",
  shape0 ===
    "Table(TableHeader(Column(Group(Text)),Column(Group(Text))),TableBody(Row(Cell,Cell)))",
  shape0,
);

// The Design panel's "Text" field of the first Column.
const [firstColumn] = await idsOf("Column");
await select(firstColumn);
await page.waitForTimeout(600);
// (The panel field is named by its fieldset legend.)
const field = page
  .locator(".panel-wrapper fieldset", {
    has: page.locator("legend", { hasText: /^Text$/ }),
  })
  .locator("input")
  .first();
const fieldBefore = await field.inputValue().catch(() => null);
await field.fill("Name");
await field.press("Enter");
await page.waitForTimeout(800);
await compareOn();

const read = () =>
  page.evaluate((tableId) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const grid = doc?.querySelector(
      `[data-catalog-id="${CSS.escape(tableId)}"]`,
    );
    const gb = grid?.getBoundingClientRect();
    const abs = (rid) => {
      let x = 0,
        y = 0,
        cur = root.canvasInputs.get(rid);
      while (cur && cur.id !== tableId) {
        const g = root.getGeometry([cur.id]).get(cur.id);
        x += g.x;
        y += g.y;
        cur = root.canvasInputs.get(cur.parentId);
      }
      const g = root.getGeometry([rid]).get(rid);
      return [
        Math.round(x),
        Math.round(y),
        Math.round(g.width),
        Math.round(g.height),
      ];
    };
    const inTable = (r) => {
      for (let cur = r; cur; cur = root.canvasInputs.get(cur.parentId))
        if (cur.id === tableId) return true;
      return false;
    };
    const pairs = [...root.canvasInputs.values()].filter(inTable).map((r) => {
      const el = doc?.querySelector(`[data-catalog-id="${CSS.escape(r.id)}"]`);
      const rect = el?.getBoundingClientRect();
      return {
        type: root.typeOf(r),
        canvas: abs(r.id),
        preview: rect
          ? [
              Math.round(rect.x - gb.x),
              Math.round(rect.y - gb.y),
              Math.round(rect.width),
              Math.round(rect.height),
            ]
          : null,
      };
    });
    const headers = grid
      ? [...grid.querySelectorAll("[role=columnheader]")].map((th) => {
          const group = th.firstElementChild;
          const name = group?.firstElementChild;
          return {
            th: th.tagName.toLowerCase(),
            group: group
              ? `${group.tagName.toLowerCase()}[${group.getAttribute("role")}].${group.className}`
              : null,
            text: th.textContent,
            weight: name ? getComputedStyle(name).fontWeight : null,
          };
        })
      : [];
    const names = [...root.canvasInputs.values()]
      .filter((r) => root.typeOf(r) === "Text" && inTable(r))
      .map((r) => ({
        text: r.props.children,
        weight: r.visual.fontWeight,
      }));
    return { tag: grid?.tagName.toLowerCase() ?? null, headers, names, pairs };
  }, tableId);
const near = (a, b) => !!a && !!b && a.every((v, k) => Math.abs(v - b[k]) <= 1);
const r0 = await read();
record(
  "L-2 the Design 'Text' field renames the column — Preview header and Canvas name Text",
  fieldBefore === "Column 1" &&
    r0.headers.map((h) => h.text).join() === "Name,Column 2" &&
    r0.names.map((n) => n.text).join() === "Name,Column 2",
  { fieldBefore, headers: r0.headers, names: r0.names },
);
record(
  "L-3 the Preview header is `th > div[role=presentation].react-aria-Group > name`, bold (600) like the Canvas name",
  r0.tag === "table" &&
    r0.headers.length === 2 &&
    r0.headers.every(
      (h) =>
        h.th === "th" &&
        h.group === "div[presentation].react-aria-Group" &&
        h.weight === "600",
    ) &&
    r0.names.every((n) => String(n.weight) === "600"),
  { headers: r0.headers, names: r0.names },
);
record(
  "L-4 the Canvas places the Table and each part (the Group and the name included) where the Preview does (±1px)",
  r0.pairs.length === 12 && r0.pairs.every((p) => near(p.canvas, p.preview)),
  r0.pairs,
);

// A TableView keeps plain Columns (its own grid).
// (Nothing selected: a palette add goes into the selection.)
await page.evaluate(() =>
  window.__COMPOSITION_CATALOG__.workspace.selectRecords([]),
);
await page.waitForTimeout(400);
await addFromPalette("table view");
await page.waitForTimeout(1500);
const [tableViewId] = await idsOf("TableView");
const tableViewShape = tableViewId ? await shapeOf(tableViewId) : null;
const tableViewHeaders = await page.evaluate((id) => {
  const doc = document.querySelector("#previewFrame")?.contentDocument;
  const grid = doc?.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
  return grid
    ? [...grid.querySelectorAll('[data-tableview-part="Column"]')].map((c) => ({
        text: c.textContent,
        kids: c.children.length,
      }))
    : null;
}, tableViewId);
record(
  "L-5 a TableView keeps plain Columns (no name group) — its headers as before",
  !!tableViewShape &&
    tableViewShape.startsWith("TableView(TableHeader(Column,Column,Column)") &&
    JSON.stringify(tableViewHeaders) ===
      JSON.stringify([
        { text: "Name", kids: 0 },
        { text: "Type", kids: 0 },
        { text: "Status", kids: 0 },
      ]),
  { tableViewShape, tableViewHeaders },
);

await page.waitForTimeout(1500);
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(2500);
await compareOn();
const r1 = await read();
record(
  "L-6 reopened: the same names, structure and places",
  (await shapeOf(tableId)) === shape0 &&
    JSON.stringify(r1.headers) === JSON.stringify(r0.headers) &&
    JSON.stringify(r1.pairs.map((p) => `${p.type}${p.canvas}`).sort()) ===
      JSON.stringify(r0.pairs.map((p) => `${p.type}${p.canvas}`).sort()) &&
    r1.pairs.every((p) => near(p.canvas, p.preview)),
  { headers: r1.headers, pairs: r1.pairs.length },
);
record("L-7 no page errors", errors.length === 0, { errors });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

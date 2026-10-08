// ADR-256 Phase 5i-3 live: a RAC Table's rows keep one cell per column (G0 ⑨ — RAC throws
// otherwise). In the real Builder: a palette Table → Insert Column ×2 · Insert Row ×2 → the first
// column selected and deleted (the Delete shortcut's plan) → every row loses its cell there, the
// Preview grid stays whole → a cell selected and deleted → refused, nothing changes → a reload keeps
// the table. Headed Chrome.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p5i3-table-cells-live.mjs <out>
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

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-256 P5i-3 table cells");
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
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const partId = (type) =>
  page.evaluate((type) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    return [...ws.root.canvasInputs.values()].find(
      (r) => ws.root.typeOf(r) === type,
    )?.id;
  }, type);
const tableId = await partId("Table");
async function insertVia(partType, label, times) {
  const id = await partId(partType);
  await page.evaluate(
    (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
    id,
  );
  await page.waitForTimeout(600);
  const button = page.getByRole("button", { name: label, exact: true }).first();
  if (!(await button.isVisible().catch(() => false))) {
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
await insertVia("TableHeader", "Insert Column", 2);
await insertVia("TableBody", "Insert Row", 2);
const shapeOf = () =>
  page.evaluate((tableId) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const walk = (id) => {
      const r = root.canvasInputs.get(id);
      return `${root.typeOf(r)}${r.children.length ? `(${r.children.map(walk).join(",")})` : ""}`;
    };
    return walk(tableId);
  }, tableId);
const grid = () =>
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
    };
  }, tableId);
// The Delete shortcut's plan (`planCatalogShortcut` — what ⌫ runs; a key press does not reach the
// Builder's shortcut scope under automation here, the Table itself included) on the selection.
const shortcuts = `/@fs${REPO}/apps/builder/src/builder/catalogRuntime/shortcuts.ts`;
async function deleteRecord(type, index = 0) {
  return page.evaluate(
    async ({ type, index, shortcuts }) => {
      const { planCatalogShortcut, catalogMenuHost } = await import(shortcuts);
      const { catalogCanvasMenuItems } = await import(
        shortcuts.replace("shortcuts.ts", "canvasMenu.ts")
      );
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const record = [...ws.root.canvasInputs.values()].filter(
        (r) => ws.root.typeOf(r) === type,
      )[index];
      ws.selectRecords([record.id]);
      const refusals = [];
      catalogCanvasMenuItems(
        {
          ...catalogMenuHost(ws, () => {}),
          noteRefusal: (item, error) =>
            refusals.push(`${item}:${error?.code ?? error}`),
        },
        "canvas-element",
        undefined,
      );
      const plan = planCatalogShortcut(ws, "delete");
      plan?.();
      await new Promise((resolve) => setTimeout(resolve, 300));
      return {
        id: record.id,
        planned: typeof plan === "function",
        refusals: refusals.filter((r) => r.startsWith("delete:")),
      };
    },
    { type, index, shortcuts },
  );
}
const s0 = await shapeOf();
const del1 = await deleteRecord("Column", 0);
const s1 = await shapeOf();
await compareOn();
const g1 = await grid();
record(
  "K-1 deleting the first column (the Delete shortcut's plan) deletes its cell in every row; the Preview grid stays whole",
  s0 ===
    "Table(TableHeader(Column,Column),TableBody(Row(Cell,Cell),Row(Cell,Cell)))" &&
    s1 === "Table(TableHeader(Column),TableBody(Row(Cell),Row(Cell)))" &&
    g1.columns === 1 &&
    JSON.stringify(g1.rows) === "[1,1]",
  { s0, s1, g1, del1 },
);
const del2 = await deleteRecord("Cell", 0);
const s2 = await shapeOf();
record(
  "K-2 deleting a cell alone is refused (the Delete plan's refusal notice); nothing changes",
  s2 === s1 &&
    JSON.stringify(del2.refusals) ===
      JSON.stringify(["delete:TABLE_CELLS_NOT_ALIGNED"]),
  { s2, del2 },
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
const s3 = await shapeOf();
const g3 = await grid();
record(
  "K-3 reopened: the same table",
  s3 === s1 && JSON.stringify(g3) === JSON.stringify(g1),
  { s3, g3 },
);
record("K-4 no page errors", errors.length === 0, { errors });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

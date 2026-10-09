// S2 Table density live (사용자 2026-10-10 「개별 10건 착수」 — ③ 나머지): real Builder (headed
// Chrome, Compare Mode). A Table with two Columns and a Row (the node tree): the Design panel
// offers Density; Compact tightens every Column · Cell to paddingY 4 (32px rows), Spacious to 12
// (48px) — in the Preview (row height) and on the Canvas (record paddings); no errors. Card's
// density waits for the deferred Card S2 restructure (user decision 2026-09-29).
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/s2-density-live.mjs <out>
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
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1200)}\n`,
  );
};
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
async function addFromPalette(label) {
  await page.evaluate(() => {
    window.__COMPOSITION_CATALOG__.workspace.selectRecords([]);
  });
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
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
}
const field = (label) =>
  page
    .locator(".panel-wrapper[data-panel='properties'] fieldset", {
      has: page.locator("legend", { hasText: new RegExp(`^${label}$`) }),
    })
    .first();
const choose = async (label, option) => {
  const box = field(label);
  const radio = box.getByRole("radio", { name: option, exact: true });
  if (await radio.count()) await radio.first().click();
  else {
    await box.locator("button").first().click();
    await page.waitForTimeout(400);
    await page.getByRole("option", { name: option, exact: true }).click();
  }
  await page.waitForTimeout(1500);
};
const openDesign = async (label) => {
  for (let i = 0; i < 3; i++) {
    if (await field(label).isVisible().catch(() => false)) return true;
    await page
      .getByRole("button", { name: "Design", exact: true })
      .first()
      .click();
    await page.waitForTimeout(1200);
  }
  return field(label).isVisible().catch(() => false);
};
const panelToggleQuiet = async () => {
  await page
    .locator(".panel-wrapper[data-panel='properties']")
    .getByText("Quiet", { exact: true })
    .first()
    .click();
  await page.waitForTimeout(1500);
};
const select = (kind) =>
  page.evaluate((kind) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()]
      .filter((r) => root.typeOf(r) === kind)
      .at(-1);
    ws.selectRecords([node.id]);
    return { id: node.id, source: node.sourceId };
  }, kind);

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("S2 density");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
const compare = page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await page.waitForTimeout(1500);

// ── Table ──
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const paletteModule = `/@fs${REPO}/apps/builder/src/builder/catalogRuntime/paletteInsert.ts`;
await page.evaluate(
  async ({ commands, paletteModule }) => {
    const c = await import(commands);
    const palette = await import(paletteModule);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    ws.selectRecords([]);
    const graph = ws.runtime.graph;
    const { pageId } = ws.session.getSnapshot();
    const body = graph.getEntry(pageId).children[0];
    const node = (id, type, children, props = {}) => ({
      kind: "node",
      id,
      definitionId: `lib:definition:type-${type}`,
      children,
      props: Object.fromEntries(
        Object.entries(props).map(([key, value]) => [key, { kind: "set", value }]),
      ),
      visual: {},
      sizing: {},
      descendantOverrides: [],
    });
    const base = ws.newId("node");
    const ids = Object.fromEntries(
      ["th", "c1", "c2", "tb", "r1", "d1", "d2"].map((key) => [key, ws.newId("node")]),
    );
    ws.execute(
      c.insertNodes({
        parent: { kind: "node", id: body },
        entries: [
          node(base, "Table", [ids.th, ids.tb]),
          node(ids.th, "TableHeader", [ids.c1, ids.c2]),
          node(ids.c1, "Column", [], { children: "Name" }),
          node(ids.c2, "Column", [], { children: "Kind" }),
          node(ids.tb, "TableBody", [ids.r1]),
          node(ids.r1, "Row", [ids.d1, ids.d2]),
          node(ids.d1, "Cell", [], { children: "A" }),
          node(ids.d2, "Cell", [], { children: "B" }),
        ],
        rootIds: [base],
        newId: ws.newId,
        label: "Add table",
      }),
    );
    await new Promise((r) => setTimeout(r, 800));
  },
  { commands, paletteModule },
);
const table = await select("Table");
record(
  "Design offers Density on a Table",
  await openDesign("Density"),
  { table },
);
const rowHeights = (id) =>
  page.evaluate((id) => {
    const doc = document.querySelector("#previewFrame").contentDocument;
    const owner = doc.querySelector(`[data-catalog-id="${id}"]`);
    const cell = owner?.querySelector("td");
    const column = owner?.querySelector("th");
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const parts = [...root.canvasInputs.values()].filter(
      (r) => r.bindingId === "cell" || r.bindingId === "column",
    );
    return {
      domCell: cell?.getBoundingClientRect().height ?? null,
      domColumn: column?.getBoundingClientRect().height ?? null,
      canvasPaddings: [...new Set(parts.map((r) => r.visual.paddingY))],
    };
  }, id);
const tRegular = await rowHeights(table.id);
await choose("Density", "Compact");
const tCompact = await rowHeights(table.id);
await page.screenshot({ path: `${OUT}/table-compact.png` });
await choose("Density", "Spacious");
const tSpacious = await rowHeights(table.id);
await page.screenshot({ path: `${OUT}/table-spacious.png` });
const near = (a, b) => typeof a === "number" && Math.abs(a - b) <= 2;
record(
  "Table density: rows 40 → 32 → 48 and every Column · Cell padding 8 → 4 → 12",
  near(tRegular.domCell, 40) &&
    String(tRegular.canvasPaddings) === "8" &&
    near(tCompact.domCell, 32) &&
    String(tCompact.canvasPaddings) === "4" &&
    near(tSpacious.domCell, 48) &&
    String(tSpacious.canvasPaddings) === "12",
  { tRegular, tCompact, tSpacious },
);

// ── Table isQuiet ──
const quietRead = (id) =>
  page.evaluate((id) => {
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = doc.querySelector(`[data-catalog-id="${id}"]`);
    const styles = el ? doc.defaultView.getComputedStyle(el) : null;
    const node = window.__composition_SKIA_DEBUG__?.getSkiaNode(id);
    const radius = node?.box?.borderRadius;
    const fill = node?.box?.fillColor;
    return {
      quiet: el?.getAttribute("data-quiet") ?? null,
      domBorder: styles?.borderTopColor ?? null,
      domRadius: styles?.borderTopLeftRadius ?? null,
      domBg: styles?.backgroundColor ?? null,
      canvasRadius: Array.isArray(radius) ? radius[0] : (radius ?? null),
      canvasFillAlpha: fill ? [...fill][3] : null,
    };
  }, id);
const framed = await quietRead(table.id);
await panelToggleQuiet();
const quiet = await quietRead(table.id);
await page.screenshot({ path: `${OUT}/table-quiet.png` });
record(
  "Quiet: transparent frame, square corners, in both consumers",
  framed.domBorder !== "rgba(0, 0, 0, 0)" &&
    quiet.quiet === "true" &&
    quiet.domBorder === "rgba(0, 0, 0, 0)" &&
    quiet.domRadius === "0px" &&
    quiet.domBg === "rgba(0, 0, 0, 0)" &&
    quiet.canvasRadius === 0 &&
    quiet.canvasFillAlpha === 0,
  { framed, quiet },
);

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();

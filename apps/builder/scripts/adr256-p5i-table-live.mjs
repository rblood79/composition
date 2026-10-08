// ADR-256 Phase 5i-1 live: a Table draws its node tree (react-aria.adobe.com Table — `Table >
// TableHeader > Column`, `TableBody > Row > Cell`). In the real Builder: a palette Table → Design's
// "Insert Column" on its header (twice) and "Insert Row" on its body (twice) → the Preview grid has
// the columns and rows (RAC roles, the first column naming the rows), the Canvas places every part
// where the Preview does, a cell's text reaches both, a reload keeps it. Headed Chrome.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p5i-table-live.mjs <out>
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
await page.keyboard.type("ADR-256 P5i table nodes");
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
const tree = await page.evaluate((tableId) => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const root = ws.root;
  const walk = (id) => {
    const r = root.canvasInputs.get(id);
    return { t: root.typeOf(r), k: r.children.map(walk) };
  };
  return walk(tableId);
}, tableId);
const shape = (n) =>
  `${n.t}${n.k.length ? `(${n.k.map(shape).join(",")})` : ""}`;
record(
  "I-1 Design's Insert Column / Insert Row build the Table's node tree (a cell per column in every row)",
  shape(tree) ===
    "Table(TableHeader(Column,Column),TableBody(Row(Cell,Cell),Row(Cell,Cell)))",
  shape(tree),
);
// A cell's text (the Design text field's command).
await page.evaluate(async (commands) => {
  const { setFields } = await import(commands);
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const cell = [...ws.root.canvasInputs.values()].find(
    (r) => ws.root.typeOf(r) === "Cell",
  );
  ws.execute(
    setFields({
      targets: [ws.positionOfRecord(cell.id).target],
      props: { children: { kind: "set", value: "Games" } },
    }),
  );
}, commands);
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
    const pairs = [...root.canvasInputs.values()]
      .filter((r) =>
        ["Table", "TableHeader", "Column", "TableBody", "Row", "Cell"].includes(
          root.typeOf(r),
        ),
      )
      .map((r) => {
        const el = doc?.querySelector(
          `[data-catalog-id="${CSS.escape(r.id)}"]`,
        );
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
    return {
      tag: grid?.tagName.toLowerCase() ?? null,
      roles: grid
        ? [...grid.querySelectorAll("[role]")].map((el) =>
            el.getAttribute("role"),
          )
        : [],
      firstCell: grid?.querySelector("[role=rowheader]")?.textContent ?? null,
      rowName: (() => {
        const row = grid?.querySelector("tbody [role=row]");
        const ids = (row?.getAttribute("aria-labelledby") ?? "")
          .split(" ")
          .filter(Boolean);
        return ids.map((id) => doc.getElementById(id)?.textContent ?? null);
      })(),
      pairs,
    };
  }, tableId);
const near = (a, b) => !!a && !!b && a.every((v, k) => Math.abs(v - b[k]) <= 1);
const r0 = await read();
record(
  "I-2 the Preview grid is RAC's: columnheaders · rows · a row header per row (the first column) — named by it",
  r0.tag === "table" &&
    r0.roles.filter((r) => r === "columnheader").length === 2 &&
    r0.roles.filter((r) => r === "rowheader").length === 2 &&
    r0.firstCell === "Games" &&
    r0.rowName.includes("Games"),
  {
    tag: r0.tag,
    roles: r0.roles,
    firstCell: r0.firstCell,
    rowName: r0.rowName,
  },
);
record(
  "I-3 the Canvas places the Table and each part where the Preview does (±1px)",
  r0.pairs.length === 11 && r0.pairs.every((p) => near(p.canvas, p.preview)),
  r0.pairs,
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
  "I-4 reopened: the same grid and places",
  JSON.stringify(r1.roles) === JSON.stringify(r0.roles) &&
    JSON.stringify(r1.pairs.map((p) => `${p.type}${p.canvas}`).sort()) ===
      JSON.stringify(r0.pairs.map((p) => `${p.type}${p.canvas}`).sort()) &&
    r1.pairs.every((p) => near(p.canvas, p.preview)),
  { roles: r1.roles.length, pairs: r1.pairs },
);
record("I-5 no page errors", errors.length === 0, { errors });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

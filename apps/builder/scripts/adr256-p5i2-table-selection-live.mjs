// ADR-256 Phase 5i-2 live: the Table's selection column is the author's nodes (react-aria.adobe.com
// Table, G0 example 11) — a Column holding `Checkbox[slot=selection]` (select-all) and each row's
// Cell holding one. In the real Builder: a palette Table → Insert Column ×2 · Insert Row ×2 →
// multiple selection → the palette's Checkbox into the first column and each row's first cell →
// Design's slot select names each `selection`. The Preview: select-all in the header, a row
// checkbox named by its row (the Name column — the selection column names no row), presses select
// rows; the Canvas places the checkboxes where the Preview does; a reload keeps it. Headed Chrome.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p5i2-table-selection-live.mjs <out>
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
await page.keyboard.type("ADR-256 P5i-2 table selection");
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
// The selection column: the first column (its text cleared) — the second names the rows.
const ids = await page.evaluate(async (commands) => {
  const { setFields } = await import(commands);
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const root = ws.root;
  const of = (type) =>
    [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type);
  const write = (record, props) =>
    ws.execute(
      setFields({
        targets: [ws.positionOfRecord(record.id).target],
        props: Object.fromEntries(
          Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
        ),
      }),
    );
  write(of("Table")[0], { selectionMode: "multiple", heightMode: "auto" });
  const [select, name] = of("Column");
  write(select, { children: "" });
  write(name, { children: "Name" });
  const rows = of("Row");
  rows.forEach((row, r) =>
    write(root.canvasInputs.get(row.children[1]), {
      children: r ? "Docs" : "Games",
    }),
  );
  return { select: select.id, cells: rows.map((row) => row.children[0]) };
}, commands);
await page.waitForTimeout(800);
const placed = [];
for (const target of [ids.select, ...ids.cells]) {
  await page.evaluate(
    (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
    target,
  );
  await page.waitForTimeout(500);
  await addFromPalette("checkbox");
  const box = await page.evaluate((target) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const record = root.canvasInputs.get(target);
    const child = record.children
      .map((id) => root.canvasInputs.get(id))
      .find((r) => root.typeOf(r) === "Checkbox");
    return child?.id ?? null;
  }, target);
  placed.push(box);
  if (!box) continue;
  await page.evaluate(
    (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
    box,
  );
  await page.waitForTimeout(700);
  if (
    !(await page
      .getByRole("button", { name: /Slot of|^Slot/ })
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
  await page
    .getByRole("button", { name: /Slot of|^Slot/ })
    .first()
    .click();
  await page.waitForTimeout(300);
  const option = page.getByRole("option", { name: "selection", exact: true });
  await option.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
}
const slots = await page.evaluate((placed) => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  return placed.map((id) => {
    const r = id && ws.root.canvasInputs.get(id);
    return r
      ? `${ws.root.typeOf(ws.root.canvasInputs.get(r.parentId))}:${r.props.slot}`
      : null;
  });
}, placed);
record(
  "J-1 the palette's Checkbox goes into the column and each row's first cell; Design names each `selection`",
  JSON.stringify(slots) ===
    JSON.stringify(["Column:selection", "Cell:selection", "Cell:selection"]),
  slots,
);
// (Each Checkbox origin's label text cleared — the reference's bare `<Checkbox slot="selection" />`.)
await page.evaluate(
  async ({ commands, placed }) => {
    const { setFields } = await import(commands);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    for (const id of placed)
      ws.execute(
        setFields({
          targets: [ws.positionOfRecord(id).target],
          props: { children: { kind: "set", value: "" } },
        }),
      );
  },
  { commands, placed },
);
await page.waitForTimeout(800);
await compareOn();
const read = () =>
  page.evaluate(
    ({ tableId, placed }) => {
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
      const named = (el) =>
        (el?.getAttribute("aria-labelledby") ?? "")
          .split(" ")
          .filter(Boolean)
          .map((id) => doc.getElementById(id)?.textContent ?? null);
      const inputs = [
        ...(grid?.querySelectorAll("input[type=checkbox]") ?? []),
      ];
      const rows = [...(grid?.querySelectorAll("tbody [role=row]") ?? [])];
      return {
        headerLabel: inputs[0]?.getAttribute("aria-label") ?? null,
        rowBoxNames: inputs.slice(1).map((input) => named(input)),
        rowHeaders: [...(grid?.querySelectorAll("[role=rowheader]") ?? [])].map(
          (c) => c.textContent,
        ),
        selected: rows.map((row) => row.getAttribute("aria-selected")),
        pairs: placed.map((id) => {
          const el = doc?.querySelector(
            `[data-catalog-id="${CSS.escape(id)}"]`,
          );
          const rect = el?.getBoundingClientRect();
          return {
            canvas: abs(id),
            preview: rect
              ? [
                  Math.round(rect.x - gb.x),
                  Math.round(rect.y - gb.y),
                  Math.round(rect.width),
                  Math.round(rect.height),
                ]
              : null,
          };
        }),
      };
    },
    { tableId, placed },
  );
const near = (a, b) => !!a && !!b && a.every((v, k) => Math.abs(v - b[k]) <= 1);
const r0 = await read();
record(
  "J-2 the Preview is RAC's: select-all in the header, each row checkbox named by its row (the Name column — the selection column names none)",
  !!r0.headerLabel &&
    JSON.stringify(r0.rowHeaders) === JSON.stringify(["Games", "Docs"]) &&
    r0.rowBoxNames.every((names, r) => names.includes(r ? "Docs" : "Games")),
  r0,
);
record(
  "J-3 the Canvas places the three checkboxes where the Preview does (±1px)",
  r0.pairs.every((p) => near(p.canvas, p.preview)),
  r0.pairs,
);
const frame = page.frameLocator("#previewFrame");
await frame
  .locator("tbody input[type=checkbox]")
  .first()
  .evaluate((i) => i.click());
await page.waitForTimeout(600);
const r1 = await read();
await frame
  .locator("thead input[type=checkbox]")
  .first()
  .evaluate((i) => i.click());
await page.waitForTimeout(600);
const r2 = await read();
record(
  "J-4 a row checkbox selects its row, select-all every row (RAC)",
  JSON.stringify(r1.selected) === JSON.stringify(["true", "false"]) &&
    JSON.stringify(r2.selected) === JSON.stringify(["true", "true"]),
  { after1: r1.selected, after2: r2.selected },
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
const r3 = await read();
record(
  "J-5 reopened: the same checkboxes and places",
  JSON.stringify(r3.pairs.map((p) => p.canvas)) ===
    JSON.stringify(r0.pairs.map((p) => p.canvas)) &&
    r3.pairs.every((p) => near(p.canvas, p.preview)),
  r3.pairs,
);
record("J-6 no page errors", errors.length === 0, { errors });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

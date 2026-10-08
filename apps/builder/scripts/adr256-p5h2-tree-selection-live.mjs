// ADR-256 Phase 5h-2 live: a TreeItem's selection checkbox is the author's `Checkbox
// slot="selection"` in its row content (react-aria.adobe.com Tree — `<Checkbox slot="selection" />`
// in TreeItemContent). In the real Builder: a palette Tree (multiple, checkbox style) → its first
// row content selected (Layers) → the palette's Checkbox goes into it → Design's slot select names
// it `selection` → it moves first. The Preview row holds RAC's selection checkbox (named by the
// row), the Canvas places it where the Preview does, a press on it selects the row, a row press
// toggles (checkbox style), a reload keeps it. Headed Chrome.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p5h2-tree-selection-live.mjs <out>
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
await page.keyboard.type("ADR-256 P5h-2 tree selection");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await addFromPalette("tree");
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const ids = await page.evaluate(async (commands) => {
  const { setFields } = await import(commands);
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const root = ws.root;
  const tree = [...root.canvasInputs.values()].find(
    (r) => root.typeOf(r) === "Tree",
  );
  // (The Tree's selection mode and style — the Design selects' own command.)
  ws.execute(
    setFields({
      targets: [ws.positionOfRecord(tree.id).target],
      props: {
        selectionMode: { kind: "set", value: "multiple" },
        selectionStyle: { kind: "set", value: "checkbox" },
      },
    }),
  );
  const label = [...root.canvasInputs.values()].find(
    (r) => root.typeOf(r) === "Text" && r.props.children === "Node 1",
  );
  const content = root.canvasInputs.get(label.parentId);
  // (The row content in Layers.)
  ws.selectRecords([content.id]);
  return { tree: tree.id, content: content.id };
}, commands);
await page.waitForTimeout(800);
await compareOn();
// The palette's Checkbox goes into the selected row content.
await addFromPalette("checkbox");
const placed = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const root = ws.root;
  const box = [...root.canvasInputs.values()].find(
    (r) => root.typeOf(r) === "Checkbox",
  );
  const parent = box && root.canvasInputs.get(box.parentId);
  return {
    box: box?.id ?? null,
    parent: parent ? root.typeOf(parent) : null,
    siblings: parent
      ? parent.children.map((id) => {
          const c = root.canvasInputs.get(id);
          return `${root.typeOf(c)}:${c.props.slot ?? c.props.children ?? ""}`;
        })
      : [],
  };
});
record(
  "H-1 the palette's Checkbox goes into the selected row content, which keeps its chevron and title",
  placed.parent === "TreeItemContent" &&
    placed.siblings[0] === "Button:chevron" &&
    placed.siblings[1] === "Text:Node 1" &&
    placed.siblings[2]?.startsWith("Checkbox"),
  placed,
);
// Design's slot select: the TreeItem's Checkbox slot names.
await page.evaluate(
  (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
  placed.box,
);
await page.waitForTimeout(800);
if (
  !(await page
    .locator(".section", { hasText: "RAC slot" })
    .first()
    .isVisible()
    .catch(() => false))
) {
  await page
    .getByRole("button", { name: "Design", exact: true })
    .first()
    .click();
  await page.waitForTimeout(1000);
}
await page
  .getByRole("button", { name: /Slot of|^Slot/ })
  .first()
  .click();
await page.waitForTimeout(300);
const options = await page.getByRole("option").allTextContents();
const selection = page.getByRole("option", { name: "selection", exact: true });
await selection.focus();
await page.keyboard.press("Enter");
await page.waitForTimeout(1200);
record(
  "H-2 Design lists the TreeItem's Checkbox slot `selection` and sets it",
  options.includes("selection") &&
    (await page.evaluate(
      (id) =>
        window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.get(id)
          ?.props.slot,
      placed.box,
    )) === "selection",
  { options },
);
// First in the row content, as the reference (the Layers reorder's command).
await page.evaluate(
  async ({ commands, box }) => {
    const { moveNodes } = await import(commands);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const record = ws.root.canvasInputs.get(box);
    const parent = ws.positionOfRecord(record.parentId).target;
    ws.execute(
      moveNodes({ ids: [record.sourceId], parent, index: 0, newId: ws.newId }),
    );
  },
  { commands, box: placed.box },
);
await page.waitForTimeout(2000);
const read = () =>
  page.evaluate((treeId) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const owner = doc?.querySelector(
      `[data-catalog-id="${CSS.escape(treeId)}"]`,
    );
    const ob = owner?.getBoundingClientRect();
    const abs = (rid) => {
      let x = 0,
        y = 0,
        cur = root.canvasInputs.get(rid);
      while (cur && cur.id !== treeId) {
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
    const rows = [...(owner?.querySelectorAll("[role=row]") ?? [])];
    const row = rows[0];
    const cell = row?.querySelector("[role=gridcell]");
    const shape = (el) =>
      `${el.tagName.toLowerCase()}${el.getAttribute("slot") ? `[${el.getAttribute("slot")}]` : ""}`;
    const input = row?.querySelector("input[type=checkbox]");
    const named = (attr, el) =>
      (el?.getAttribute(attr) ?? "")
        .split(" ")
        .filter(Boolean)
        .map((id) => doc.getElementById(id)?.textContent ?? null);
    const box = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "Checkbox",
    );
    const content = root.canvasInputs.get(box.parentId);
    const item = root.canvasInputs.get(content.parentId);
    const pairs = [
      box,
      ...content.children
        .map((id) => root.canvasInputs.get(id))
        .filter((r) => r.id !== box.id),
      item,
    ]
      .filter((r) => r.hidden !== true)
      .map((r) => {
        const el = owner?.querySelector(
          `[data-catalog-id="${CSS.escape(r.id)}"]`,
        );
        const rect = el?.getBoundingClientRect();
        return {
          type: root.typeOf(r),
          canvas: abs(r.id),
          preview: rect
            ? [
                Math.round(rect.x - ob.x),
                Math.round(rect.y - ob.y),
                Math.round(rect.width),
                Math.round(rect.height),
              ]
            : null,
        };
      });
    return {
      cell: cell ? [...cell.children].map(shape) : null,
      inputLabel: input?.getAttribute("aria-label") ?? null,
      inputNamedBy: named("aria-labelledby", input),
      rowsSelected: rows.map((r) => r.getAttribute("aria-selected")),
      checked: input?.checked ?? null,
      canvasSelected: box.derivedProps?._isSelected ?? null,
      pairs,
    };
  }, ids.tree);
const near = (a, b) => !!a && !!b && a.every((v, k) => Math.abs(v - b[k]) <= 1);
const r0 = await read();
record(
  "H-3 the Preview row is the reference's: Checkbox[selection] + chevron Button + title; RAC names the checkbox by the row",
  JSON.stringify(r0.cell) ===
    JSON.stringify(["div[selection]", "button[chevron]", "span"]) &&
    !!r0.inputLabel &&
    r0.inputNamedBy.length === 2 &&
    r0.inputNamedBy.every((t) => t !== null),
  { cell: r0.cell, inputLabel: r0.inputLabel, inputNamedBy: r0.inputNamedBy },
);
record(
  "H-4 the Canvas places the checkbox · chevron · title · item where the Preview does (±1px), unselected as the item",
  r0.pairs.length >= 4 &&
    r0.pairs.every((p) => near(p.canvas, p.preview)) &&
    r0.canvasSelected === false,
  { pairs: r0.pairs, canvasSelected: r0.canvasSelected },
);
const frame = page.frameLocator("#previewFrame");
await frame
  .locator("[role=row] input[type=checkbox]")
  .first()
  .evaluate((i) => i.click());
await page.waitForTimeout(800);
const r1 = await read();
record(
  "H-5 a press on the checkbox selects the row (RAC)",
  r1.rowsSelected[0] === "true" && r1.checked === true,
  {
    rowsSelected: r1.rowsSelected,
    checked: r1.checked,
  },
);
// A row press in a checkbox-style Tree adds the row (RAC `toggle`).
await frame
  .locator("[role=row]")
  .nth(1)
  .evaluate((row) => row.click());
await page.waitForTimeout(800);
const r2 = await read();
record(
  "H-6 a row press adds the row (checkbox style — RAC toggle)",
  JSON.stringify(r2.rowsSelected) === JSON.stringify(["true", "true"]),
  {
    rowsSelected: r2.rowsSelected,
  },
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
  "H-7 reopened: the same row and places",
  JSON.stringify(r3.cell) === JSON.stringify(r0.cell) &&
    JSON.stringify(r3.pairs.map((p) => `${p.type}${p.canvas}`).sort()) ===
      JSON.stringify(r0.pairs.map((p) => `${p.type}${p.canvas}`).sort()),
  { cell: r3.cell, pairs: r3.pairs },
);
record("H-8 no page errors", errors.length === 0, { errors });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

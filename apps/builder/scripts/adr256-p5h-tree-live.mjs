// ADR-256 Phase 5h live: a TreeItem is the reference's row (react-aria.adobe.com Tree): `TreeItem >
// TreeItemContent > Button[slot=chevron] > Icon + title`, the child items after it. In the real
// Builder: a palette Tree → its node tree → the Preview row is a plain RAC chevron button + the title,
// the Canvas places each part where the Preview does → the Preview chevron expands the row → the
// author removes item 2's chevron (free content) → a reload keeps it. Headed Chrome.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p5h-tree-live.mjs <out>
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
await page.keyboard.type("ADR-256 P5h tree content");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
async function shot(name) {
  await page.evaluate(() =>
    document
      .querySelectorAll(".panel-wrapper")
      .forEach((p) => (p.style.visibility = "hidden")),
  );
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    clip: { x: 0, y: 40, width: 800, height: 400 },
  });
  await page.evaluate(() =>
    document
      .querySelectorAll(".panel-wrapper")
      .forEach((p) => (p.style.visibility = "")),
  );
}
await addFromPalette("tree");
await page.waitForTimeout(1000);
const treeId = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  return [...ws.root.canvasInputs.values()].find(
    (r) => ws.root.typeOf(r) === "Tree",
  )?.id;
});
const structureOf = () =>
  page.evaluate((treeId) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const walk = (id) => {
      const r = root.canvasInputs.get(id);
      const type = root.typeOf(r);
      const name =
        type === "Button"
          ? `Button[${r.props.slot}]`
          : type === "Text"
            ? `Text(${r.props.children})`
            : type;
      return {
        name: `${name}${r.hidden ? " hidden" : ""}`,
        kids: r.children.map(walk),
      };
    };
    return root.canvasInputs.get(treeId).children.map(walk);
  }, treeId);
const flat = (nodes, depth = 0) =>
  nodes.flatMap((n) => [
    `${"  ".repeat(depth)}${n.name}`,
    ...flat(n.kids, depth + 1),
  ]);
const s0 = flat(await structureOf());
record(
  "T-1 each TreeItem holds TreeItemContent > Button[chevron] > Icon + Text (the reference's row); a leaf's glyph rests hidden",
  JSON.stringify(s0) ===
    JSON.stringify([
      "TreeItem",
      "  TreeItemContent",
      "    Button[chevron]",
      "      Icon",
      "    Text(Node 1)",
      "  TreeItem hidden",
      "    TreeItemContent",
      "      Button[chevron]",
      "        Icon hidden",
      "      Text(Node 1.1)",
      "TreeItem",
      "  TreeItemContent",
      "    Button[chevron]",
      "      Icon hidden",
      "    Text(Node 2)",
    ]),
  s0,
);
await compareOn();
const frame = page.frameLocator("#previewFrame");
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
    const rows = [...(owner?.querySelectorAll("[role=row]") ?? [])].map(
      (row) => {
        const cell = row.querySelector("[role=gridcell]");
        const button = row.querySelector("button[slot=chevron]");
        const svg = button?.querySelector("svg");
        return {
          text: row.textContent,
          expanded: row.getAttribute("aria-expanded"),
          cell: cell
            ? [...cell.children].map(
                (el) =>
                  `${el.tagName.toLowerCase()}${el.getAttribute("slot") ? `[${el.getAttribute("slot")}]` : ""}`,
              )
            : null,
          buttonClass: button?.className ?? null,
          buttonLabel: button?.getAttribute("aria-label") ?? null,
          buttonBg: button ? getComputedStyle(button).backgroundColor : null,
          visibility: button ? getComputedStyle(button).visibility : null,
          rotate: svg ? getComputedStyle(svg).rotate : null,
          strokeIsRowColor: svg
            ? getComputedStyle(svg).stroke === getComputedStyle(row).color
            : null,
        };
      },
    );
    const pairs = [...root.canvasInputs.values()]
      .filter(
        (r) =>
          !r.hidden &&
          ["TreeItem", "Button", "Text", "Icon"].includes(root.typeOf(r)),
      )
      // (In the Tree, outside a hidden subtree — only its top node is marked hidden.)
      .filter((r) => {
        let c = r;
        while (c && c.id !== treeId) {
          if (c.hidden) return false;
          c = root.canvasInputs.get(c.parentId);
        }
        return !!c;
      })
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
    return { rows, pairs };
  }, treeId);
const near = (a, b) => !!a && !!b && a.every((v, k) => Math.abs(v - b[k]) <= 1);
const r0 = await read();
record(
  "T-2 the Preview row is the reference's: a plain RAC chevron button (RAC's name, no filled paint) + the title; Canvas places every part where the Preview does (±1)",
  r0.rows.length === 2 &&
    r0.rows.every(
      (row) =>
        JSON.stringify(row.cell) ===
          JSON.stringify(["button[chevron]", "span"]) &&
        row.buttonClass === "react-aria-Button" &&
        !!row.buttonLabel &&
        row.buttonBg === "rgba(0, 0, 0, 0)" &&
        row.strokeIsRowColor === true,
    ) &&
    r0.rows[0].visibility === "visible" &&
    r0.rows[1].visibility === "hidden" &&
    r0.pairs.length >= 7 &&
    r0.pairs.every((p) => near(p.canvas, p.preview)),
  r0,
);
await shot("collapsed");
// The Preview's chevron expands the row (RAC's expand button — a runtime state, no document write).
await frame
  .locator("[role=row] button[slot=chevron]")
  .first()
  .evaluate((el) => el.click());
await page.waitForTimeout(1000);
const r1 = await read();
record(
  "T-3 pressing the Preview chevron expands the row: the child row shows, the glyph turns 90°",
  r1.rows.length === 3 &&
    r1.rows[0].expanded === "true" &&
    r1.rows[1].text === "Node 1.1" &&
    r1.rows[0].rotate === "90deg",
  r1.rows,
);
await shot("expanded");
// (Collapse the Preview again — its expansion is a run state the Canvas does not draw, ADR-250.)
await frame
  .locator("[role=row] button[slot=chevron]")
  .first()
  .evaluate((el) => el.click());
await page.waitForTimeout(800);
// Free content: item 2's chevron button removed — the delete command the Canvas menu runs
// (`removeTargets`; selecting a node inside an instance through the UI is not this phase's).
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const removed = await page.evaluate(async (commands) => {
  const { removeTargets } = await import(commands);
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const root = ws.root;
  const label = [...root.canvasInputs.values()].find(
    (r) => root.typeOf(r) === "Text" && r.props.children === "Node 2",
  );
  const content = root.canvasInputs.get(label.parentId);
  const button = content.children
    .map((c) => root.canvasInputs.get(c))
    .find((r) => r.props.slot === "chevron");
  ws.execute(
    removeTargets({ targets: [ws.positionOfRecord(button.id).target] }),
  );
  return { button: button.id, label: label.id };
}, commands);
await page.waitForTimeout(2000);
const r2 = await read();
const gone = await page.evaluate(
  (id) => !window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.get(id),
  removed.button,
);
const node2 = r2.rows.find((row) => row.text === "Node 2");
record(
  "T-4 the content is free: without its chevron Button item 2's row draws none, the title starts the row (Canvas = Preview)",
  gone &&
    JSON.stringify(node2?.cell) === JSON.stringify(["span"]) &&
    r2.pairs.every((p) => near(p.canvas, p.preview)),
  { gone, node2, pairs: r2.pairs },
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
const s3 = flat(await structureOf());
record(
  "T-5 reopened: the same node tree (item 2 without its chevron)",
  JSON.stringify(s3) ===
    JSON.stringify([
      "TreeItem",
      "  TreeItemContent",
      "    Button[chevron]",
      "      Icon",
      "    Text(Node 1)",
      "  TreeItem hidden",
      "    TreeItemContent",
      "      Button[chevron]",
      "        Icon hidden",
      "      Text(Node 1.1)",
      "TreeItem",
      "  TreeItemContent",
      "    Text(Node 2)",
    ]),
  s3,
);
record("T-6 no page errors", errors.length === 0, { errors });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

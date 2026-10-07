// ADR-256 Phase 5e-2 live: Tabs draws its node tree — the reference example 8 assembled in the
// Builder: a Tabs whose TabList sits in a frame with two Buttons beside it (detach · group · insert
// · the list's aria-label). The Preview is the reference structure (`Tabs > div > (TabList + div >
// Button × 2) + TabPanels > TabPanel`), the Canvas places every part where the Preview does, a press
// on Tab 2 shows its panel, and a reload keeps it. Real Builder, headed Chrome.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p5e2-tabs-free-live.mjs <out>
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p5c-listbox-live.mjs <out>
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
await page.keyboard.type("ADR-256 P5e2 tabs free");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await addFromPalette("tabs");
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const tabsId = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  return [...ws.root.canvasInputs.values()].find((r) => ws.root.typeOf(r) === "Tabs").sourceId;
});
await compareOn();
// Example 8 from the Builder's commands: detach, frame around the TabList, two Buttons beside it.
await page.evaluate(
  async ({ commands, tabsId }) => {
    const { detachInstances, groupNodes, insertNodes, setNodeAttribute } = await import(commands);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const graph = ws.runtime.graph;
    ws.execute(detachInstances({ ids: [tabsId], newId: ws.newId }));
    const node = (id, definitionId, children = [], layout) => ({
      kind: "node", id, definitionId, children, props: {}, visual: {}, sizing: {}, descendantOverrides: [],
      ...(layout ? { layout } : {}),
    });
    // The example's rows are flex rows (`<div style={{display: 'flex'}}>` · `.button-group`).
    const row = { display: { kind: "set", value: "flex" }, flexDirection: { kind: "set", value: "row" } };
    const tabList = graph.getEntry(tabsId).children.find((id) =>
      graph.getEntry(id).definitionId.endsWith("type-TabList"),
    );
    const rowId = ws.newId("node");
    ws.execute(groupNodes({ ids: [tabList], group: node(rowId, "lib:definition:type-frame", [], row), newId: ws.newId }));
    const buttons = ws.newId("node");
    const add = ws.newId("node");
    const remove = ws.newId("node");
    ws.execute(
      insertNodes({
        parent: { kind: "node", id: rowId },
        entries: [
          node(buttons, "lib:definition:type-frame", [add, remove], row),
          node(add, "lib:definition:origin-component-button"),
          node(remove, "lib:definition:origin-component-button"),
        ],
        rootIds: [buttons],
        newId: ws.newId,
      }),
    );
    ws.execute(setNodeAttribute({ id: tabList, field: "ariaLabel", value: "Dynamic tabs" }));
  },
  { commands, tabsId },
);
await page.waitForTimeout(2000);
const read = () =>
  page.evaluate((tabsId) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const top = [...root.canvasInputs.values()].find((r) => r.sourceId === tabsId || r.id.endsWith(tabsId));
    const owner = doc?.querySelector(`[data-catalog-id="${CSS.escape(top.id)}"]`);
    const ob = owner?.getBoundingClientRect();
    const abs = (rid) => {
      let x = 0, y = 0, cur = root.canvasInputs.get(rid);
      while (cur && cur.id !== top.id) {
        const g = root.getGeometry([cur.id]).get(cur.id);
        x += g.x; y += g.y;
        cur = root.canvasInputs.get(cur.parentId);
      }
      const g = root.getGeometry([rid]).get(rid);
      return [Math.round(x), Math.round(y), Math.round(g.width), Math.round(g.height)];
    };
    const mine = [...root.canvasInputs.values()].filter((r) => {
      for (let cur = r; cur; cur = root.canvasInputs.get(cur.parentId)) if (cur.id === top.id) return true;
      return false;
    });
    const shape = (el) =>
      `${el.tagName.toLowerCase()}${el.getAttribute("role") ? `[${el.getAttribute("role")}]` : ""}(${[...el.children]
        .filter((c) => !c.matches("[role=tab] *"))
        .map(shape)
        .join(",")})`;
    const pairs = mine
      .filter((r) => r.hidden !== true && ["frame", "TabList", "Button", "TabPanels", "TabPanel"].includes(root.typeOf(r)))
      .map((r) => {
        const el = owner?.querySelector(`[data-catalog-id="${CSS.escape(r.id)}"]`);
        const rect = el?.getBoundingClientRect();
        return {
          type: root.typeOf(r),
          canvas: abs(r.id),
          preview: rect ? [Math.round(rect.x - ob.x), Math.round(rect.y - ob.y), Math.round(rect.width), Math.round(rect.height)] : null,
        };
      });
    const list = owner?.querySelector("[role=tablist]");
    const panel = owner?.querySelector("[role=tabpanel]");
    return {
      structure: owner ? shape(owner) : null,
      listName: list?.getAttribute("aria-label") ?? null,
      panelOf: panel ? doc.getElementById(panel.getAttribute("aria-labelledby"))?.textContent : null,
      pairs,
    };
  }, tabsId);
const near = (a, b) => !!a && !!b && a.every((v, k) => Math.abs(v - b[k]) <= 1);
const r0 = await read();
record(
  "F-1 the Preview is the reference structure: Tabs > div > (tablist + div > button × 2) + TabPanels > tabpanel; the list is named",
  r0.structure === "div(div(div[tablist](div[tab](),div[tab]()),div(button(),button())),div(div[tabpanel]()))" &&
    r0.listName === "Dynamic tabs",
  { structure: r0.structure, listName: r0.listName },
);
record(
  "F-2 the Canvas places the frames · TabList · Buttons · TabPanels · TabPanel where the Preview does (±1px)",
  r0.pairs.length >= 7 && r0.pairs.every((p) => near(p.canvas, p.preview)),
  r0.pairs,
);
await page.screenshot({ path: `${OUT}/example8.png` });
await page.frameLocator("#previewFrame").locator("[role=tab]").nth(1).evaluate((t) => t.click());
await page.waitForTimeout(800);
const r1 = await read();
record("F-3 a press on Tab 2 shows Tab 2's panel", r1.panelOf === "Tab 2", { panelOf: r1.panelOf });
await page.waitForTimeout(1500);
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await page.waitForTimeout(2500);
await compareOn();
const r2 = await read();
record(
  "F-4 reopened: the same structure and places",
  r2.structure === r0.structure &&
    JSON.stringify(r2.pairs.map((p) => `${p.type}${p.canvas}`).sort()) ===
      JSON.stringify(r0.pairs.map((p) => `${p.type}${p.canvas}`).sort()),
  { structure: r2.structure, pairs: r2.pairs },
);
record("F-5 no page errors", errors.length === 0, { errors });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

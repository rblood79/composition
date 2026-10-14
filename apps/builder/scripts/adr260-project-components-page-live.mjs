// ADR-260 후속 (user 2026-10-14): the components made with Create component are listed on one page
// — Navigator Components tab → "Local" — as the built-in origins are. A card draws the
// origin node itself (a click there selects it, an edit there is the origin's) and an instance
// beside it.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr260-project-components-page-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const state = JSON.parse(readFileSync(`${process.cwd()}/apps/builder/scripts/.auth-session.json`, "utf8"));
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({ storageState: state, viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`); });
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail });
  process.stdout.write(`${ok ? "PASS" : "FAIL"} ${name}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}\n`);
};
const panelButton = (name) =>
  page.locator('.workspace-panel-frame[data-panel="properties"]').getByRole("button", { name, exact: true }).first();

await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-260 components page");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Design", exact: true }).first().click().catch(() => {});

const nodesOf = (type) =>
  page.evaluate((type) => {
    const { workspace } = window.__COMPOSITION_CATALOG__;
    const root = workspace.root;
    return [...root.canvasInputs.values()]
      .filter((r) => root.typeOf(r) === type)
      .map((r) => workspace.itemOfRecord(r.id)?.target)
      .filter((t) => t?.kind === "node")
      .map((t) => t.id);
  }, type);
async function addFromPalette(label) {
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.selectRecords([]));
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page.getByRole("button", { name: "Components", exact: true }).first().click();
  await search.fill(label);
  await page.waitForTimeout(300);
  await page.locator(".list-item", { hasText: new RegExp(`^${label}$`, "i") }).first().click();
  await page.waitForTimeout(700);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Components", exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(200);
}
const selectNode = (id) =>
  page.evaluate((id) => {
    const { workspace } = window.__COMPOSITION_CATALOG__;
    workspace.selectRecords([workspace.root.recordsOfSource(id)[0]]);
  }, id);
const snapshot = () =>
  page.evaluate(() => {
    const s = window.__COMPOSITION_CATALOG__.workspace.session.getSnapshot();
    return { view: s.definitionView ?? null, target: s.selection[0]?.target ?? null };
  });

// Two components: a Button and a Radio Group, each with an instance on the page.
const made = {};
for (const [label, type] of [["Button", "Button"], ["Radio Group", "RadioGroup"]]) {
  const before = await nodesOf(type);
  await addFromPalette(label);
  const origin = (await nodesOf(type)).find((id) => !before.includes(id));
  await selectNode(origin);
  await page.waitForTimeout(300);
  await panelButton("Create component").click();
  await page.waitForTimeout(800);
  const definitionId = await page.evaluate((id) => window.__COMPOSITION_CATALOG__.workspace.runtime.graph.definitionOfTemplateRoot(id), origin);
  const instance = await page.evaluate((origin) => {
    const { workspace, commands } = window.__COMPOSITION_CATALOG__;
    return workspace.execute(commands.duplicateNodes({ ids: [origin], newId: workspace.newId })).plan.selectAfter[0];
  }, origin);
  await page.waitForTimeout(400);
  made[type] = { origin, definitionId, instance };
}
check("setup: two components with an instance each", !!made.Button?.definitionId && !!made.RadioGroup?.definitionId, made);

// Navigator → Components tab: the two pages, no item per component.
await page.getByRole("button", { name: "Navigator", exact: true }).first().click().catch(() => {});
await page.waitForTimeout(300);
await page.getByRole("tab", { name: "Components", exact: true }).first().click();
await page.waitForTimeout(400);
const rows = await page.evaluate(() =>
  [...document.querySelectorAll('[data-section-id="navigator-components"] .elementItemLabel')].map((e) => e.textContent.trim()),
);
check("Components tab lists the Library and Local pages only", JSON.stringify(rows) === JSON.stringify(["Library", "Local"]), rows);
writeFileSync(`${OUT}/1-tab.png`, await page.screenshot());

await page.locator('[data-section-id="navigator-components"] .elementItem', { hasText: /^Local$/ }).first().click();
await page.waitForTimeout(1500);
const opened = await page.evaluate((made) => {
  const { workspace } = window.__COMPOSITION_CATALOG__;
  const root = workspace.root;
  const count = (id) => root.recordsOfSource(id).length;
  // The origin node itself sits in its card's origin cell (the card's instance draws it again).
  const own = (id) =>
    root.recordsOfSource(id).filter((r) => root.domInputs.get(root.domInputs.get(r)?.parentId)?.sourceId?.endsWith("/origin")).length;
  return {
    view: workspace.session.getSnapshot().definitionView ?? null,
    origins: [own(made.Button.origin), own(made.RadioGroup.origin)],
    pageInstancesDrawn: [count(made.Button.instance), count(made.RadioGroup.instance)],
  };
}, made);
check(
  "Local opens one page: each origin node itself, once (no instance; the page's instances are not drawn)",
  opened.view === "view:project-components" &&
    opened.origins.every((n) => n === 1) &&
    opened.pageInstancesDrawn.every((n) => n === 0),
  opened,
);
const tabSelected = await page.evaluate(() =>
  document.querySelector('[data-section-id="navigator-components"] [aria-selected="true"] .elementItemLabel')?.textContent?.trim() ?? null,
);
check("Local row is selected in the tab", tabSelected === "Local", tabSelected);
await page.locator('[data-section-id="navigator-layers"] .layer-expand-button').first().click().catch((e) => process.stdout.write(`expand: ${e.message.slice(0, 120)}\n`));
await page.waitForTimeout(600);
const layerRows = await page.evaluate(() =>
  [...document.querySelectorAll('[data-section-id="navigator-layers"] .elementItemLabelText, .layer-tree .elementItemLabelText')].map((e) => e.textContent.trim()),
);
check("Layers: root body (as a page), then the origins themselves", layerRows[0] === "body" && layerRows.includes("Button") && layerRows.includes("RadioGroup"), layerRows);
writeFileSync(`${OUT}/2-page.png`, await page.screenshot());

// A Canvas click on the Radio Group origin's card selects the origin node itself.
const point = await page.evaluate((origin) => {
  const { workspace, canvas } = window.__COMPOSITION_CATALOG__;
  const root = workspace.root;
  const record = root.recordsOfSource(origin).find((r) => root.domInputs.get(root.domInputs.get(r)?.parentId)?.sourceId?.endsWith("/origin"));
  const box = canvas.boundsOf(record);
  const cam = canvas.camera();
  const rect = document.querySelector(".canvas-container").getBoundingClientRect();
  return { x: rect.left + cam.x + (box.x + Math.min(12, box.width / 2)) * cam.zoom, y: rect.top + cam.y + (box.y + box.height / 2) * cam.zoom, box, cam };
}, made.RadioGroup.origin);
process.stdout.write(`point ${JSON.stringify(point)}\n`);
await page.mouse.click(point.x, point.y);
await page.waitForTimeout(500);
const clicked = await snapshot();
check("a Canvas click in the card selects the origin node", clicked.target?.id === made.RadioGroup.origin && clicked.view === "view:project-components", { clicked, point });
const chip = await page.evaluate(() =>
  document.querySelector('.workspace-panel-frame[data-panel="properties"] .component-semantics-identity')?.getAttribute("data-role") ?? null,
);
check("the Design panel shows it as the ORIGIN", chip === "origin", chip);

// An edit there (the Design panel's Orientation) is the origin's: the page instance follows.
const horizontal = page
  .locator('.workspace-panel-frame[data-panel="properties"]')
  .getByRole("radio", { name: "Horizontal", exact: true })
  .or(page.locator('.workspace-panel-frame[data-panel="properties"]').getByRole("button", { name: "Horizontal", exact: true }))
  .first();
await horizontal.click();
await page.waitForTimeout(600);
// (The first edit of an origin with instances asks once.)
const dialog = page.locator('[role="dialog"], [role="alertdialog"]').first();
if (await dialog.isVisible().catch(() => false)) {
  await dialog.getByRole("button").filter({ hasNotText: /cancel|취소/i }).last().click();
  await page.waitForTimeout(500);
}
const edited = await page.evaluate((made) => {
  const { workspace } = window.__COMPOSITION_CATALOG__;
  const node = workspace.runtime.graph.getEntry(made.RadioGroup.origin);
  const root = workspace.root;
  const drawn = root.canvasInputs.get(root.recordsOfSource(made.RadioGroup.origin).find((r) => root.domInputs.get(root.domInputs.get(r)?.parentId)?.sourceId?.endsWith("/origin")));
  return { origin: node?.props?.orientation ?? null, drawn: drawn?.props.orientation ?? null };
}, made);
check("the edit wrote the origin node and the card redraws it", edited.origin?.value === "horizontal" && edited.drawn === "horizontal", edited);
writeFileSync(`${OUT}/3-edited.png`, await page.screenshot());

// Delete the Button component from its Layers row: it leaves the page; its instance stays and
// offers Restore origin (Figma). Undo brings it back.
const deleteButton = page.locator(".elementItem", { hasText: /^Button$/ }).getByRole("button", { name: /^Delete /i }).first();
const hasDelete = await deleteButton.isVisible().catch(() => false);
check("Layers: the origin row has a Delete button", hasDelete);
if (hasDelete) {
  await deleteButton.click();
  await page.waitForTimeout(800);
  const afterDelete = await page.evaluate((made) => {
    const { workspace } = window.__COMPOSITION_CATALOG__;
    const root = workspace.root;
    const graph = workspace.runtime.graph;
    return {
      drawn: root.recordsOfSource(made.Button.origin).length,
      rows: [...document.querySelectorAll('[data-section-id="navigator-layers"] .elementItemLabelText')].map((e) => e.textContent.trim()),
      instanceKept: graph.getEntry(made.Button.instance)?.definitionId === made.Button.definitionId,
    };
  }, made);
  check("delete: the component leaves the page, its instance stays", afterDelete.drawn === 0 && !afterDelete.rows.includes("Button") && afterDelete.instanceKept, afterDelete);
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());
  await page.waitForTimeout(800);
  const back = await page.evaluate((id) => window.__COMPOSITION_CATALOG__.workspace.root.recordsOfSource(id).length, made.Button.origin);
  check("undo: the component is back on the page", back === 1, back);
}

// Back to the pages: the origin there and its instance show the edit.
await page.getByRole("tab", { name: "Pages", exact: true }).first().click();
await page.waitForTimeout(1200);
const onPage = await page.evaluate((made) => {
  const { workspace } = window.__COMPOSITION_CATALOG__;
  const root = workspace.root;
  const of = (id) => root.canvasInputs.get(root.recordsOfSource(id)[0])?.props.orientation ?? null;
  return { view: workspace.session.getSnapshot().definitionView ?? null, origin: of(made.RadioGroup.origin), instance: of(made.RadioGroup.instance) };
}, made);
check("on the page the origin and its instance are horizontal", onPage.view === null && onPage.origin === "horizontal" && onPage.instance === "horizontal", onPage);
writeFileSync(`${OUT}/4-page-after.png`, await page.screenshot());

// Saved: nothing of the derived page is in the document.
await page.waitForTimeout(1500);
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await page.waitForTimeout(2000);
const reloaded = await page.evaluate((made) => {
  const graph = window.__COMPOSITION_CATALOG__.workspace.runtime.graph;
  return {
    orientation: graph.getEntry(made.RadioGroup.origin)?.props?.orientation?.value ?? null,
    viewNode: !!graph.getEntry("project:node:catalog-origin-view-project"),
  };
}, made);
check("reload: the edit is saved, no page node in the document", reloaded.orientation === "horizontal" && !reloaded.viewNode, reloaded);

check("no page errors", errors.filter((e) => e.startsWith("pageerror")).length === 0, errors.slice(0, 5));
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
const failed = results.filter((r) => !r.ok).length;
process.stdout.write(`\n${results.length - failed}/${results.length} PASS\n`);
await browser.close();
process.exit(failed ? 1 : 0);

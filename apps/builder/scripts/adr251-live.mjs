// ADR-251 live G3: RadioGroup · CheckboxGroup items wrapper node in the real Builder (headless
// Chrome, a fresh profile on the worktree dev server — IndexedDB empty, the saved auth session only).
//
//   L1  palette → RadioGroup: the document shows Label · RadioItems > Radio ×2; the DOM-side shared
//       `div.radio-items` stays one (Canvas record = wrapper)
//   L2  Layers: the RadioItems row is listed and selects the wrapper record
//   L3  Styles Direction on the wrapper (Row) → the group's `orientation` = horizontal, one history
//       step, the wrapper lays the radios out in a row; Block disabled
//   L4  undo (keyboard) → orientation vertical again
//   L5  the group's own Direction stays `labelPosition`
//   L6  "+" (Properties) on the wrapper, then on the group → Radios option3 · option4 inside the wrapper
//   L7  CheckboxGroup: the same Direction · "+" path
// Preview / Compare Mode are not opened (user rule — Preview is a user check).
// Usage: ADR251_AUTH_SESSION=<session> BUILDER_URL=http://localhost:5175 node scripts/adr251-live.mjs <outDir>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BUILDER_URL ?? "http://localhost:5175";
const state = JSON.parse(readFileSync(process.env.ADR251_AUTH_SESSION, "utf8"));
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: true, channel: "chrome" });
const context = await browser.newContext({ storageState: state, viewport: { width: 1600, height: 1000 } });
const errors = [];
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(`${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 500)}\n`);
};
const step = async (id, run) => {
  try {
    await run();
  } catch (error) {
    record(id, false, { threw: String(error?.message ?? error).slice(0, 500) });
    writeFileSync(`${OUT}/${id}-error.png`, await page.screenshot());
  }
};

const page = await context.newPage();
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});

async function newProject(name) {
  await page.goto(`${BASE}/dashboard`);
  await page.getByRole("button", { name: /new project/i }).first().click();
  await page.waitForTimeout(300);
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
  await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
  await page.waitForTimeout(1500);

  await page.evaluate(() => {
    const ws = () => window.__COMPOSITION_CATALOG__.workspace;
    const typeOf = (record) => {
      try {
        return ws().runtime.graph.getDefinition(record.definitionId)?.name ?? "";
      } catch {
        return "";
      }
    };
    /** Records under a source's first record, depth-first, with their resolved type names. */
    const tree = (record) => ({
      id: record.id,
      type: record.ruleId ?? typeOf(record),
      binding: record.bindingId,
      props: record.props,
      layout: record.layout,
      children: record.children.map((id) => tree(ws().root.layoutInputs.get(id))).filter(Boolean),
    });
    window.__L251__ = {
      groups(type) {
        return [...ws().root.layoutInputs.values()]
          .filter((r) => r.bindingId === type.toLowerCase() && r.parentId?.endsWith?.("home-body") !== false)
          .map((r) => r.id);
      },
      tree: (id) => tree(ws().root.layoutInputs.get(id)),
      selection: () => ws().session.getSnapshot().selection.map((s) => s.identity),
      steps: () => ws().history.getSnapshot().labels.length,
      groupProp(id, key) {
        const position = ws().positionOfRecord(id);
        return ws().readModel.propSource(position.target, key).value;
      },
      geometry(ids) {
        const g = ws().root.getGeometry(ids);
        return Object.fromEntries(ids.map((id) => [id, g.get(id)]));
      },
    };
  });

}

const groupTree = async (type) => {
  const [id] = await page.evaluate((t) => window.__L251__.groups(t), type);
  return page.evaluate((i) => window.__L251__.tree(i), id);
};

async function addFromPalette(label) {
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page.getByRole("button", { name: "Components", exact: true }).first().click();
  await search.fill(label);
  await page.waitForTimeout(300);
  await page.locator(".list-item", { hasText: new RegExp(`^${label}$`, "i") }).first().click();
  await page.waitForTimeout(800);
}
async function openPanel(name) {
  // A rail button toggles its panel: open it only when it is not shown.
  const visible = {
    Navigator: () => page.locator(".elementItem").first().isVisible().catch(() => false),
    Styles: () => page.getByRole("radio", { name: "Block" }).isVisible().catch(() => false),
    Properties: () => page.locator('[aria-label="Items"]').first().isVisible().catch(() => false),
  }[name];
  if (visible && (await visible())) return;
  await page.getByRole("button", { name, exact: true }).first().click();
  await page.waitForTimeout(500);
}
/** The Layers row whose name is `text` (expanding collapsed rows until it shows), clicked. */
async function selectLayer(text) {
  await openPanel("Navigator");
  for (let round = 0; round < 8; round++) {
    const rows = page.locator(".elementItem").filter({ hasText: new RegExp(`^\\s*${text}\\s*$`) });
    if (await rows.count()) {
      await rows.first().click();
      await page.waitForTimeout(400);
      return;
    }
    const expand = page.getByRole("button", { name: /^Expand / });
    if (!(await expand.count())) break;
    await expand.first().click();
    await page.waitForTimeout(250);
  }
  const names = await page.locator(".elementItem").allTextContents();
  throw new Error(`no Layers row ${text}: ${JSON.stringify(names)}`);
}

for (const group of ["RadioGroup", "CheckboxGroup"]) {
  await newProject(`ADR-251 live ${group}`);
  const item = group === "RadioGroup" ? "Radio" : "Checkbox";
  const wrapper = `${item}Items`;
  await step(`L1-${group}`, async () => {
    await addFromPalette(group === "RadioGroup" ? "radio group" : "checkbox group");
    const t = await groupTree(group);
    const shape = [t.type, t.children.map((c) => [c.type, c.children.map((k) => k.type)])];
    record(`L1-${group}`, t.children.length === 2 && t.children[1].type === wrapper && t.children[1].children.every((c) => c.type === item) && t.children[1].children.length === 2, { shape });
  });
  let wrapperId;
  await step(`L2-${group}`, async () => {
    const t = await groupTree(group);
    wrapperId = t.children[1].id;
    await selectLayer(wrapper);
    const selection = await page.evaluate(() => window.__L251__.selection());
    record(`L2-${group}`, selection.length === 1 && selection[0] === wrapperId, { selection, wrapperId });
  });
  await step(`L3-${group}`, async () => {
    await openPanel("Styles");
    const block = page.getByRole("radio", { name: "Block" });
    const blockDisabled = (await block.getAttribute("data-disabled")) !== null;
    const before = await page.evaluate(() => window.__L251__.steps());
    await page.getByRole("radio", { name: "Row" }).click();
    await page.waitForTimeout(600);
    const t = await groupTree(group);
    const steps = await page.evaluate(() => window.__L251__.steps());
    const orientation = await page.evaluate(([id, key]) => window.__L251__.groupProp(id, key), [t.id, "orientation"]);
    const radios = t.children[1].children.map((c) => c.id);
    const g = await page.evaluate((ids) => window.__L251__.geometry(ids), radios);
    const [a, b] = radios.map((id) => g[id]);
    record(`L3-${group}`, blockDisabled && orientation === "horizontal" && steps === before + 1 && t.children[1].layout.flexDirection === "row" && b.x > a.x + a.width - 0.5 && Math.abs(a.y - b.y) < 0.5, { blockDisabled, orientation, steps: steps - before, wrapperLayout: t.children[1].layout, a, b });
    writeFileSync(`${OUT}/${group}-horizontal.png`, await page.screenshot());
  });
  await step(`L4-${group}`, async () => {
    await page.locator("canvas").first().click({ position: { x: 5, y: 5 }, trial: true }).catch(() => {});
    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(600);
    const t = await groupTree(group);
    const orientation = await page.evaluate(([id, key]) => window.__L251__.groupProp(id, key), [t.id, "orientation"]);
    record(`L4-${group}`, orientation === "vertical" && t.children[1].layout.flexDirection === "column", { orientation, wrapperLayout: t.children[1].layout });
  });
  await step(`L5-${group}`, async () => {
    await selectLayer(group);
    await openPanel("Styles");
    await page.getByRole("radio", { name: "Row" }).click();
    await page.waitForTimeout(600);
    const t = await groupTree(group);
    const lp = await page.evaluate(([id, key]) => window.__L251__.groupProp(id, key), [t.id, "labelPosition"]);
    const orientation = await page.evaluate(([id, key]) => window.__L251__.groupProp(id, key), [t.id, "orientation"]);
    await page.keyboard.press("Meta+z");
    await page.waitForTimeout(600);
    const back = await page.evaluate(([id, key]) => window.__L251__.groupProp(id, key), [t.id, "labelPosition"]);
    record(`L5-${group}`, lp === "side" && orientation === "vertical" && back === "top", { labelPosition: lp, orientation, undone: back });
  });
  await step(`L6-${group}`, async () => {
    await selectLayer(wrapper);
    await openPanel("Properties");
    await page.getByRole("button", { name: `Insert ${item}` }).click();
    await page.waitForTimeout(600);
    await selectLayer(group);
    await openPanel("Properties");
    await page.getByRole("button", { name: `Insert ${item}` }).click();
    await page.waitForTimeout(600);
    const t = await groupTree(group);
    const items = t.children[1].children;
    const values = items.map((c) => c.props.value ?? null);
    const pass =
      t.children.length === 2 &&
      items.length === 4 &&
      items.every((c) => c.type === item) &&
      (group !== "RadioGroup" || new Set(values).size === 4);
    record(`L6-${group}`, pass, { groupChildren: t.children.map((c) => c.type), values });
    writeFileSync(`${OUT}/${group}-insert.png`, await page.screenshot());
  });
}

record("errors", errors.length === 0, { count: errors.length, errors: errors.slice(0, 10) });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ base: BASE, results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

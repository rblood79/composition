// ADR-256 Phase 3c live: a CheckboxGroup and a RadioGroup are RAC `CheckboxGroup` / `RadioGroup` that
// draw their children in order (Label · `div.checkbox-items` / `div.radio-items` · Description), a
// ToggleButtonGroup draws its children in order. A free child (an Icon) put into a detached group
// and into a ToggleButtonGroup shows in its place in the Preview and on the Canvas; Space selects
// the second Checkbox (RAC group state); after a reload (contract 9) the same tree. Real Builder,
// headed Chrome.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p3c-group-live.mjs <out>
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
await page.keyboard.type("ADR-256 P3c groups");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
await addFromPalette("checkbox group");
await addFromPalette("radio group");
await addFromPalette("toggle button group");
await page.waitForTimeout(800);
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const actions = `/@fs${REPO}/apps/builder/src/builder/catalogRuntime/componentActions.ts`;
// Detach the CheckboxGroup and put an Icon after its items; put an Icon at the end of the
// ToggleButtonGroup (detached too) — free children.
const ids = await page.evaluate(
  async ({ commands, actions }) => {
    const { insertNodes } = await import(commands);
    const { catalogComponentCommands } = await import(actions);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const of = (type) =>
      [...ws.root.canvasInputs.values()].find((r) => ws.root.typeOf(r) === type)
        .sourceId;
    const ids = {
      checkbox: of("CheckboxGroup"),
      radio: of("RadioGroup"),
      toggle: of("ToggleButtonGroup"),
      errors: [],
    };
    const icon = (parent, index) => {
      const id = ws.newId("node");
      ws.execute(
        insertNodes({
          parent: { kind: "node", id: parent },
          index,
          entries: [
            {
              kind: "node",
              id,
              definitionId: "lib:definition:type-Icon",
              children: [],
              props: { iconName: { kind: "set", value: "star" } },
              visual: {},
              sizing: {},
              descendantOverrides: [],
            },
          ],
          rootIds: [id],
          newId: ws.newId,
        }),
      );
    };
    for (const [key, index] of [
      ["checkbox", 2],
      ["toggle", undefined],
    ])
      try {
        ws.execute(catalogComponentCommands.detach(ids[key], ws.newId));
        icon(ids[key], index);
      } catch (error) {
        ids.errors.push(`${key}: ${String(error?.message ?? error)}`);
      }
    return ids;
  },
  { commands, actions },
);
record("P3c-0 detach + insert a free Icon", ids.errors.length === 0, ids);
await compareOn();
const preview = (id) =>
  page.evaluate((id) => {
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const root = [...(doc?.querySelectorAll("[data-catalog-id]") ?? [])].find(
      (e) =>
        e.getAttribute("data-catalog-id").endsWith(`::${id}`) &&
        !e.parentElement?.closest(`[data-catalog-id$="::${id}"]`),
    );
    if (!root) return null;
    const name = (e) =>
      e.tagName.toLowerCase() +
      (e.getAttribute("class")
        ? "." + e.getAttribute("class").split(" ")[0]
        : "") +
      (e.getAttribute("role") ? `[${e.getAttribute("role")}]` : "");
    return {
      root: name(root),
      children: [...root.children].map(name),
      items: [
        ...(root.querySelector(":scope > .checkbox-items, :scope > .radio-items")
          ?.children ?? []),
      ].map(name),
      labelledBy: !!root.getAttribute("aria-labelledby"),
      selected: [...root.querySelectorAll("input")].map((i) => i.checked),
    };
  }, id);
const canvas = (id) =>
  page.evaluate((id) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const top = [...ws.root.canvasInputs.values()].find(
      (r) => r.sourceId === id,
    );
    return top.children
      .map((c) => ws.root.canvasInputs.get(c))
      .map((r) => `${ws.root.typeOf(r)}${r.hidden ? " (hidden)" : ""}`);
  }, id);
const cb = await preview(ids.checkbox);
const cbc = await canvas(ids.checkbox);
record(
  "P3c-1 CheckboxGroup: div[group] > Label · div.checkbox-items (Checkbox fields) · Icon in place; Canvas the same order",
  !!cb &&
    cb.root.startsWith("div.react-aria-CheckboxGroup[group]") &&
    cb.labelledBy &&
    cb.children[0]?.startsWith("span.react-aria-Label") &&
    cb.children[1] === "div.checkbox-items" &&
    /svg|Icon/.test(cb.children[2] ?? "") &&
    cb.items.every((i) => i.startsWith("div.react-aria-Checkbox")) &&
    cbc[1] === "CheckboxItems" &&
    cbc[2] === "Icon",
  { preview: cb, canvas: cbc },
);
const rg = await preview(ids.radio);
const rgc = await canvas(ids.radio);
record(
  "P3c-2 RadioGroup: div[radiogroup] > Label · div.radio-items (Radio fields); first selected",
  !!rg &&
    rg.root.startsWith("div.react-aria-RadioGroup[radiogroup]") &&
    rg.labelledBy &&
    rg.children[1] === "div.radio-items" &&
    rg.items.every((i) => i.startsWith("div.react-aria-Radio")) &&
    rg.selected[0] === true &&
    rgc[1] === "RadioItems",
  { preview: rg, canvas: rgc },
);
const tg = await preview(ids.toggle);
const tgc = await canvas(ids.toggle);
record(
  "P3c-3 ToggleButtonGroup: its buttons then the Icon, in order; Canvas the same",
  !!tg &&
    tg.children.slice(0, -1).every((c) => c.startsWith("button")) &&
    /svg|Icon/.test(tg.children.at(-1) ?? "") &&
    tgc.at(-1) === "Icon",
  { preview: tg, canvas: tgc },
);
// Space on the second Checkbox selects it (RAC CheckboxGroup state).
const frame = page.frameLocator("#previewFrame");
await frame
  .locator(`[data-catalog-id$="::${ids.checkbox}"] .checkbox-items input`)
  .nth(1)
  .focus();
await page.keyboard.press("Space");
await page.waitForTimeout(500);
const cb2 = await preview(ids.checkbox);
record(
  "P3c-4 Space flips the second Checkbox in the group (RAC state); the first stays",
  cb2?.selected[1] !== cb.selected[1] && cb2.selected[0] === cb.selected[0],
  { before: cb?.selected, after: cb2?.selected },
);
// Saved and opened again (contract 9): the same trees.
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
const re = {
  checkbox: await preview(ids.checkbox),
  toggle: await preview(ids.toggle),
};
record(
  "P3c-5 reopened: the CheckboxGroup and the ToggleButtonGroup draw the same children",
  JSON.stringify(re.checkbox?.children) === JSON.stringify(cb?.children) &&
    JSON.stringify(re.toggle?.children) === JSON.stringify(tg?.children),
  re,
);
await page.screenshot({ path: `${OUT}/groups-compare.png` });
record("P3c-6 no page errors", errors.length === 0, { errors });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

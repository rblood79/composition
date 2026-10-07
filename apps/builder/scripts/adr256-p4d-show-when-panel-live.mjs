// ADR-256 Phase 4d live: the Design panel's "Show when" section. A Checkbox built from its parts
// holds a check Icon; the Icon selected, the section adds a condition with the panel's own controls
// (Add condition → isSelected from the nearest owner): the Canvas hides the Icon (the Checkbox is
// not selected) and the Preview too; Space in the Preview shows it (RAC state); "Is: false" flips
// it; removing the condition clears it. Real Builder, headed Chrome.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p4d-show-when-panel-live.mjs <out>
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
await page.keyboard.type("ADR-256 P4d panel");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
await page.evaluate(
  async ({ commands }) => {
    const { insertNodes } = await import(commands);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const body = [...ws.root.canvasInputs.values()].find((r) =>
      r.sourceId.endsWith("home-body"),
    );
    const set = (v) => ({ kind: "set", value: v });
    const node = (n, type, children, props = {}) => ({
      kind: "node",
      id: `project:node:p4d-${n}`,
      definitionId: `lib:definition:type-${type}`,
      children: children.map((c) => `project:node:p4d-${c}`),
      props: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, set(v)])),
      visual: {},
      sizing: {},
      descendantOverrides: [],
    });
    ws.execute(
      insertNodes({
        parent: { kind: "node", id: body.sourceId },
        entries: [
          node("box", "Checkbox", ["button"]),
          node("button", "CheckboxButton", ["indicator", "check", "text"]),
          node("indicator", "CheckboxIndicator", []),
          node("check", "Icon", [], { iconName: "check" }),
          node("text", "Label", [], { children: "Subscribe" }),
        ],
        rootIds: ["project:node:p4d-box"],
        newId: ws.newId,
      }),
    );
    const r = ws.root.recordsOfSource("project:node:p4d-check")[0];
    ws.session.select([ws.itemOfRecord(r)]);
  },
  { commands },
);
await page.waitForTimeout(800);
const section = page
  .locator(".section")
  .filter({ has: page.locator(".section-title", { hasText: /^Show when$/ }) })
  .first();
if (!(await section.isVisible().catch(() => false))) {
  await page.getByRole("button", { name: "Design", exact: true }).first().click();
  await page.waitForTimeout(800);
}
await compareOn();
// (Compare Mode keeps the selection; the Design panel stays.)
const read = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const r = ws.root.recordsOfSource("project:node:p4d-check")[0];
    const rec = ws.root.canvasInputs.get(r);
    return {
      showWhen: ws.runtime.graph.getEntry("project:node:p4d-check").showWhen ?? null,
      canvas: rec ? rec.hidden !== true : null,
      preview: !!doc?.querySelector('[data-catalog-id$="::project:node:p4d-check"]'),
    };
  });
const r0 = await read();
record("D-1 the Icon has no condition: shown", r0.showWhen === null && r0.canvas && r0.preview, r0);
const visible = await section.isVisible().catch(() => false);
await section.getByRole("button", { name: "Add condition" }).click();
await page.waitForTimeout(1200);
const r1 = await read();
record(
  "D-2 panel: Add condition → isSelected (nearest): the Canvas and the Preview hide the Icon (not selected)",
  visible &&
    JSON.stringify(r1.showWhen) === JSON.stringify({ all: ["isSelected"] }) &&
    r1.canvas === false &&
    r1.preview === false,
  { visible, ...r1 },
);
const frame = page.frameLocator("#previewFrame");
await frame.locator('[data-catalog-id$="::project:node:p4d-box"] input').focus();
await page.keyboard.press("Space");
await page.waitForTimeout(500);
const r2 = await read();
record("D-3 Preview: Space selects → the Icon shows (RAC state)", r2.preview === true && r2.canvas === false, r2);
// (A Preview interaction selects its element in the Builder: select the Icon again.)
await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const r = ws.root.recordsOfSource("project:node:p4d-check")[0];
  ws.session.select([ws.itemOfRecord(r)]);
});
await page.waitForTimeout(800);
// "Is" → false (the panel's select).
await section.getByRole("button", { name: /\bIs\b/ }).first().click();
await page.getByRole("option", { name: "false", exact: true }).click();
await page.waitForTimeout(1200);
const r3 = await read();
record(
  "D-4 panel: Is false → { not: isSelected }: the Canvas shows the Icon",
  JSON.stringify(r3.showWhen) === JSON.stringify({ all: [{ not: "isSelected" }] }) &&
    r3.canvas === true,
  r3,
);
await section.getByRole("button", { name: "Remove condition 1" }).click();
await page.waitForTimeout(1200);
const r4 = await read();
record("D-5 panel: removing the condition clears it", r4.showWhen === null && r4.canvas && r4.preview, r4);
await page.screenshot({ path: `${OUT}/panel.png` });
record("D-6 no page errors", errors.length === 0, { errors });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

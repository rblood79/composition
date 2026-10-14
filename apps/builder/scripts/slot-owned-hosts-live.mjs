// Slot hosts placed with owned contents (2026-10-14): Compare Mode screenshot of CheckboxGroup ·
// RadioGroup · ButtonGroup · Toolbar · Card · CardView · Form after placing — the Canvas and the
// Preview both draw the items, and each host's first slot item is an owned node.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/slot-owned-hosts-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const state = JSON.parse(readFileSync(`${process.cwd()}/apps/builder/scripts/.auth-session.json`, "utf8"));
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const page = await (await browser.newContext({ storageState: state, viewport: { width: 1600, height: 1000 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`); });
const ready = () => page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
async function addFromPalette(label) {
  await ready();
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
await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await page.waitForTimeout(300);
await page.keyboard.type("Slot owned hosts");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await ready();
await page.waitForTimeout(1500);
const compare = page.getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true }).first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await page.waitForTimeout(2000);
const hosts = ["Checkbox Group", "Radio Group", "Button Group", "Toolbar", "Card", "Form"];
for (const host of hosts) await addFromPalette(host).catch((e) => errors.push(`add ${host}: ${e.message.slice(0, 120)}`));
await page.waitForTimeout(1500);
const report = await page.evaluate(() => {
  const { workspace } = window.__COMPOSITION_CATALOG__;
  const graph = workspace.runtime.graph;
  const root = workspace.root;
  const doc = document.querySelector("#previewFrame")?.contentDocument;
  const pageId = workspace.session.getSnapshot().pageId;
  const pageEntry = graph.getEntry(pageId);
  const body = graph.getEntry(pageEntry.children[0]);
  return body.children.map((id) => {
    const node = graph.getEntry(id);
    const fills = node.descendantOverrides.filter((o) => o.kind === "fillSlot");
    const owned = fills.flatMap((o) => o.childIds).map((child) => graph.getEntry(child)?.definitionId);
    const [record] = root.recordsOfSource(id);
    const el = doc?.querySelector(`[data-catalog-id="${record}"]`);
    return { type: root.typeOf(root.canvasInputs.get(record)), fills: fills.length, owned, domText: el?.textContent?.slice(0, 80) ?? null, canvasChildren: root.canvasInputs.get(record)?.children.length };
  });
});
for (const row of report) process.stdout.write(`${JSON.stringify(row)}\n`);
await page.screenshot({ path: `${OUT}/compare.png` });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ report, errors }, null, 2));
process.stdout.write(`errors ${errors.length}\n`);
for (const e of errors.slice(0, 8)) process.stdout.write(`  ${e}\n`);
await browser.close();

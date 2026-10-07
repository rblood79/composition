// ADR-256 Phase 1c live: named slots reach RAC. (1) A ListBox option is named by its label Text
// (Preview `aria-labelledby` → the label span). (2) The label Text's Properties shows the RAC slot
// section with the ListBoxItem's names; choosing Detach makes the Preview label a plain span (the
// option loses that name) and Default connects it again. (3) A Tag's `label` Text shows "Not connected"
// (TagGroup provides only description · errorMessage) and the Preview renders without an error. Real Builder, headed Chrome.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p1-rac-slot-live.mjs <out>
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
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1200)}\n`,
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
const frameDoc = () => page.frameLocator("#previewFrame");

await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-256 P1 RAC slot");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
await addFromPalette("list box");
await addFromPalette("tag group");
await page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first()
  .click();
await page.waitForTimeout(2500);

const optionName = () =>
  page.evaluate(() => {
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const option = doc?.querySelector('[role="option"]');
    const id = option?.getAttribute("aria-labelledby");
    const label = id ? doc.getElementById(id) : null;
    return {
      labelledBy: id,
      labelTag: label?.tagName ?? null,
      labelSlot: label?.getAttribute("slot") ?? null,
      labelText: label?.textContent ?? null,
    };
  });
const before = await optionName();
record("P1c-1 the option is named by its label Text", !!before.labelText, before);

// Select the first ListBoxItem's label Text (a Text whose slot is `label` under a ListBoxItem).
const selectText = (parentType, slot) =>
  page.evaluate(
    ({ parentType, slot }) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const records = [...ws.root.canvasInputs.values()];
      const text = records.find(
        (r) =>
          ws.root.typeOf(r) === "Text" &&
          r.props.slot === slot &&
          ws.root.typeOf(ws.root.canvasInputs.get(r.parentId)) === parentType,
      );
      ws.selectRecords([text.id]);
      return text.id;
    },
    { parentType, slot },
  );
const openDesign = async () => {
  const section = page.locator(".section", { hasText: "RAC slot" }).first();
  if (!(await section.isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Design", exact: true }).first().click();
    await page.waitForTimeout(1000);
  }
  return section;
};
await selectText("ListBoxItem", "label");
await page.waitForTimeout(800);
const section = await openDesign();
void section;
const slotSelect = () =>
  page.getByRole("button", { name: /Slot of|^Slot/ }).first();
await slotSelect().click();
await page.waitForTimeout(300);
const options = await page.getByRole("option").allTextContents();
record(
  "P1c-2 the label Text lists the ListBoxItem's slot names",
  ["Default", "label", "description", "Detach (slot = null)"].every((o) =>
    options.includes(o),
  ),
  { options },
);
const choose = async (name) => {
  const option = page.getByRole("option", { name, exact: true });
  await option.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);
};
await choose("Detach (slot = null)");
const detached = await optionName();
record(
  "P1c-3 Detach: the label is no longer the option's name",
  detached.labelText !== before.labelText || detached.labelSlot === null,
  { detached },
);
await openDesign();
await slotSelect().click();
await page.waitForTimeout(300);
await choose("label");
const back = await optionName();
record("P1c-4 choosing label connects it again", back.labelText === before.labelText, {
  back,
});

await selectText("Tag", "label");
await page.waitForTimeout(800);
const menuSection = await openDesign();
const notConnected = await menuSection
  .getByText("Not connected")
  .isVisible()
  .catch(() => false);
record("P1c-5 a Tag's label Text (TagGroup has no `label` Text slot) shows Not connected", notConnected, {});
await page.screenshot({ path: `${OUT}/rac-slot.png` });
record("P1c-6 no page errors", errors.length === 0, { errors });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

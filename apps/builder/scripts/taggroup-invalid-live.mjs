// S2 TagGroup isInvalid · errorMessage live (사용자 2026-10-09 「②로 넘어가」): real Builder (headed
// Chrome, Compare Mode). A TagGroup: an Error Message typed in the Design panel stays hidden (it
// showed at once before); Invalid on → the Preview shows the error text and the Canvas error record
// is shown with the Preview's height; Invalid off → hidden on both again; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/taggroup-invalid-live.mjs <out>
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
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
}
const field = (label) =>
  page
    .locator(".panel-wrapper[data-panel='properties'] fieldset", {
      has: page.locator("legend", { hasText: new RegExp(`^${label}$`) }),
    })
    .first();
const pick = async (label, option) => {
  const box = field(label);
  const radio = box.getByRole("radio", { name: option, exact: true });
  if (await radio.count()) await radio.first().click();
  else {
    await box.locator("button").first().click();
    await page.waitForTimeout(400);
    await page.getByRole("option", { name: option, exact: true }).click();
  }
  await page.waitForTimeout(1500);
};
const selectType = (type) =>
  page.evaluate((type) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === type,
    );
    ws.selectRecords([node.id]);
  }, type);
const read = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "TagGroup",
    );
    const error = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "FieldError",
    );
    const doc = document.querySelector("#previewFrame").contentDocument;
    const errorEl = doc.querySelector(
      '.react-aria-TagGroup [slot="errorMessage"]',
    );
    return {
      isInvalid: node.props.isInvalid ?? null,
      errorMessage: node.props.errorMessage ?? null,
      canvasErrorHidden: error?.hidden ?? null,
      canvasErrorHeight: error
        ? root.getGeometry([error.id]).get(error.id)?.height
        : null,
      previewErrorText: errorEl?.textContent ?? null,
      previewErrorHeight: errorEl?.getBoundingClientRect().height ?? null,
    };
  });

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("TagGroup invalid");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
const compare = page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await page.waitForTimeout(1500);

await addFromPalette("tag group");
await page.waitForTimeout(1500);
await selectType("TagGroup");
await page.waitForTimeout(1000);
for (let i = 0; i < 3; i++) {
  if (await field("Error Message").isVisible().catch(() => false)) break;
  await page.getByRole("button", { name: "Design", exact: true }).first().click();
  await page.waitForTimeout(1200);
}
const message = field("Error Message").locator("input, textarea").first();
await message.fill("Too many");
await message.press("Enter");
await page.waitForTimeout(1200);
const before = await read();
record(
  "Error Message alone: Canvas error hidden · Preview no error text",
  before.errorMessage === "Too many" &&
    before.canvasErrorHidden === true &&
    before.previewErrorText === null,
  before,
);
const panel = page.locator(".panel-wrapper[data-panel='properties']");
await panel.getByText("Invalid", { exact: true }).first().click();
await page.waitForTimeout(1500);
const invalid = await read();
record(
  "Invalid from the panel: Preview error text · Canvas error shown at the Preview height",
  invalid.isInvalid === true &&
    invalid.previewErrorText === "Too many" &&
    invalid.canvasErrorHidden !== true &&
    Math.abs(invalid.canvasErrorHeight - invalid.previewErrorHeight) <= 1,
  invalid,
);
await page.screenshot({ path: `${OUT}/taggroup-invalid.png` });
await panel.getByText("Invalid", { exact: true }).first().click();
await page.waitForTimeout(1500);
const valid = await read();
record(
  "Invalid off: hidden on both again",
  valid.isInvalid === false &&
    valid.canvasErrorHidden === true &&
    valid.previewErrorText === null,
  valid,
);

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();

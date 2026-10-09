// S2 SearchField type · Row isDisabled live (사용자 2026-10-09 「①부터 진행해」): real Builder
// (headed Chrome, Compare Mode). A SearchField: Input Type Email from the Design panel → the
// Preview input's type is email; a value and Password → the Preview input is a password input and
// the Canvas Input text is the same count of bullets. A Table with a row (the Table's own "+"):
// Disabled from the panel → the Preview row carries `data-disabled` at opacity 0.38 and the Canvas
// row record the same opacity; a Value typed in the panel reaches the mounted Preview input; no
// errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/searchfield-type-row-disabled-live.mjs <out>
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
const search = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "SearchField",
    );
    const input = [...root.canvasInputs.values()].find(
      (r) =>
        root.typeOf(r) === "Input" &&
        root.typeOf(
          root.canvasInputs.get(root.canvasInputs.get(r.parentId).parentId) ??
            {},
        ) === "SearchField",
    );
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = doc.querySelector(".react-aria-SearchField input");
    return {
      type: node.props.type ?? null,
      value: node.props.value ?? null,
      domType: el?.getAttribute("type") ?? null,
      domValue: el?.value ?? null,
      canvasText: input?.derivedProps?.placeholder ?? null,
    };
  });

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("SearchField type Row disabled");
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

await addFromPalette("search field");
await page.waitForTimeout(1500);
await selectType("SearchField");
await page.waitForTimeout(1000);
await page.getByRole("button", { name: "Design", exact: true }).first().click();
await page.waitForTimeout(1200);
await pick("Input Type", "Email");
const email = await search();
record(
  "Input Type Email from the panel: node email · Preview input type email",
  email.type === "email" && email.domType === "email",
  email,
);
const value = field("Value").locator("input").first();
await value.fill("secret");
await value.press("Enter");
await page.waitForTimeout(1200);
const typed = await search();
record(
  "Value from the panel reaches the mounted Preview input (it stayed empty before) · Canvas text",
  typed.value === "secret" &&
    typed.domValue === "secret" &&
    typed.canvasText === "secret",
  typed,
);
await pick("Input Type", "Password");
const password = await search();
record(
  "Password + value: Preview input type password · Canvas Input text = 6 bullets",
  password.type === "password" &&
    password.domType === "password" &&
    password.domValue === "secret" &&
    password.canvasText === "••••••",
  password,
);
await page.screenshot({ path: `${OUT}/searchfield-password.png` });

await addFromPalette("table");
await page.waitForTimeout(1500);
await selectType("Table");
await page.waitForTimeout(1200);
for (const type of ["Column", "Row"]) {
  await selectType("Table");
  await page.waitForTimeout(1200);
  await page
    .getByRole("button", { name: `Insert ${type}`, exact: true })
    .first()
    .click();
  await page.waitForTimeout(1200);
}
await selectType("Row");
await page.waitForTimeout(1200);
const disabled = page
  .locator(".panel-wrapper[data-panel='properties']")
  .getByText("Disabled", { exact: true })
  .first();
await disabled.click();
await page.waitForTimeout(1500);
const row = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const root = ws.root;
  const node = [...root.canvasInputs.values()].find(
    (r) => root.typeOf(r) === "Row",
  );
  const doc = document.querySelector("#previewFrame").contentDocument;
  const el =
    doc.querySelector(`[data-catalog-id="${node.id}"]`) ??
    doc.querySelector(".react-aria-Row");
  return {
    isDisabled: node.props.isDisabled ?? null,
    canvasOpacity: node.visual.opacity ?? null,
    domDisabled: el?.getAttribute("data-disabled") ?? null,
    domOpacity: el ? doc.defaultView.getComputedStyle(el).opacity : null,
  };
});
record(
  "Row Disabled from the panel: node true · Preview data-disabled at 0.38 · Canvas 0.38",
  row.isDisabled === true &&
    row.domDisabled === "true" &&
    row.domOpacity === "0.38" &&
    row.canvasOpacity === 0.38,
  row,
);
await page.screenshot({ path: `${OUT}/row-disabled.png` });

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();

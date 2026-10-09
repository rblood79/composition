// S2 NumberField empty value live (사용자 2026-10-10 「2번 NumberField 빈 값 S2 처럼 진행해」): real
// Builder (headed Chrome, Compare Mode). The palette NumberField: it starts empty on the Canvas and
// the Preview (no "0") with the same input box height; Placeholder "Amount" shows on both; Value 42
// → both "42"; Value 150 → both "100" (RAC snaps to the origin's range 0–100); Value cleared → both
// empty with the placeholder; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/numberfield-empty-live.mjs <out>
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
const read = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const all = [...root.canvasInputs.values()];
    const field = all.find((r) => root.typeOf(r) === "NumberField");
    const input = all.find((r) => {
      if (root.typeOf(r) !== "Input") return false;
      const group = root.canvasInputs.get(r.parentId);
      return group && group.parentId === field.id;
    });
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = doc.querySelector(`[data-catalog-id="${field.id}"] input`);
    const geo = root.getGeometry([input.id]).get(input.id);
    return {
      value: field.props.value ?? null,
      placeholder: field.props.placeholder ?? null,
      canvasText:
        input.derivedProps?.placeholder ?? input.props.placeholder ?? "",
      canvasInputHeight: geo?.height ?? null,
      previewValue: el?.value ?? null,
      previewPlaceholder: el?.getAttribute("placeholder") ?? "",
      previewInputHeight: el?.getBoundingClientRect().height ?? null,
    };
  });
const selectField = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "NumberField",
    );
    ws.selectRecords([node.id]);
  });
const type = async (label, text) => {
  const box = field(label).locator("input, textarea").first();
  await box.fill(text);
  await box.press("Enter");
  await page.waitForTimeout(1500);
};

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("NumberField empty");
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

await addFromPalette("number field");
await page.waitForTimeout(1500);
await selectField();
await page.waitForTimeout(1000);
for (let i = 0; i < 3; i++) {
  if (await field("Placeholder").isVisible().catch(() => false)) break;
  await page.getByRole("button", { name: "Design", exact: true }).first().click();
  await page.waitForTimeout(1200);
}
const fresh = await read();
await page.screenshot({ path: `${OUT}/numberfield-empty.png` });
record(
  "new NumberField: empty on the Canvas and the Preview (no 0) · same input height",
  fresh.canvasText === "" &&
    fresh.previewValue === "" &&
    fresh.canvasInputHeight > 0 &&
    Math.abs(fresh.canvasInputHeight - fresh.previewInputHeight) <= 0.5,
  fresh,
);
await type("Placeholder", "Amount");
const withPlaceholder = await read();
await page.screenshot({ path: `${OUT}/numberfield-placeholder.png` });
record(
  "Placeholder Amount: shown on both while empty",
  withPlaceholder.canvasText === "Amount" &&
    withPlaceholder.previewValue === "" &&
    withPlaceholder.previewPlaceholder === "Amount",
  withPlaceholder,
);
await type("Value", "42");
const v42 = await read();
record(
  "Value 42: both 42",
  v42.canvasText === "42" && v42.previewValue === "42",
  v42,
);
await type("Value", "150");
const v150 = await read();
record(
  "Value 150: both 100 (snapped to the range 0–100, as RAC)",
  v150.canvasText === "100" && v150.previewValue === "100",
  v150,
);
const valueBox = field("Value").locator("input, textarea").first();
await valueBox.fill("");
await valueBox.press("Enter");
await page.waitForTimeout(1500);
const cleared = await read();
await page.screenshot({ path: `${OUT}/numberfield-cleared.png` });
record(
  "Value cleared: both empty · the placeholder again",
  cleared.canvasText === "Amount" &&
    cleared.previewValue === "" &&
    cleared.previewPlaceholder === "Amount" &&
    Math.abs(cleared.canvasInputHeight - cleared.previewInputHeight) <= 0.5,
  cleared,
);

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();

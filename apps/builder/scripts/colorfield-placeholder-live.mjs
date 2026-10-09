// S2 ColorField placeholder live (2026-10-10, 조사 문서 6 「다」): real Builder (headed Chrome,
// Compare Mode). The palette ColorField: no placeholder on the Canvas or the Preview (S2 — no default;
// the old fixed "#000000" is gone) with the same input box height; Placeholder "#FF0000" from the
// Design panel → both show it; cleared → both empty again; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/colorfield-placeholder-live.mjs <out>
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
    const field = all.find((r) => root.typeOf(r) === "ColorField");
    const input = all.find(
      (r) => root.typeOf(r) === "Input" && r.parentId === field.id,
    );
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = doc.querySelector(`[data-catalog-id="${field.id}"] input`);
    const geo = root.getGeometry([input.id]).get(input.id);
    return {
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
      (r) => root.typeOf(r) === "ColorField",
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
await page.keyboard.type("ColorField placeholder");
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

await addFromPalette("color field");
await page.waitForTimeout(1500);
await selectField();
await page.waitForTimeout(1000);
for (let i = 0; i < 3; i++) {
  if (await field("Placeholder").isVisible().catch(() => false)) break;
  await page.getByRole("button", { name: "Design", exact: true }).first().click();
  await page.waitForTimeout(1200);
}
const fresh = await read();
await page.screenshot({ path: `${OUT}/colorfield-fresh.png` });
record(
  "new ColorField: no placeholder on the Canvas or the Preview (no #000000) · same input height",
  fresh.canvasText === "" &&
    fresh.previewValue === "" &&
    fresh.previewPlaceholder === "" &&
    fresh.canvasInputHeight > 0 &&
    Math.abs(fresh.canvasInputHeight - fresh.previewInputHeight) <= 0.5,
  fresh,
);
await type("Placeholder", "#FF0000");
const written = await read();
await page.screenshot({ path: `${OUT}/colorfield-placeholder.png` });
record(
  "Placeholder #FF0000: shown on both",
  written.placeholder === "#FF0000" &&
    written.canvasText === "#FF0000" &&
    written.previewValue === "" &&
    written.previewPlaceholder === "#FF0000" &&
    Math.abs(written.canvasInputHeight - written.previewInputHeight) <= 0.5,
  written,
);
const box = field("Placeholder").locator("input, textarea").first();
await box.fill("");
await box.press("Enter");
await page.waitForTimeout(1500);
const cleared = await read();
record(
  "Placeholder cleared: both empty again",
  cleared.canvasText === "" && cleared.previewPlaceholder === "",
  cleared,
);

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();

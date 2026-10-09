// S2 InlineAlert fillStyle live (사용자 2026-10-10 「개별 10건 착수」): real Builder (headed
// Chrome, Compare Mode). An InlineAlert from the palette: the Design panel offers Fill Style
// (Border by default — base background + the variant border); Subtle Fill gives the variant
// subtle background without a border; Bold Fill fills with the variant color and turns the
// title white (black on notice) in the Preview and on the Canvas; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/inline-alert-fillstyle-live.mjs <out>
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
  await page.evaluate(() => {
    window.__COMPOSITION_CATALOG__.workspace.selectRecords([]);
  });
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
const choose = async (label, option) => {
  const panel = page.locator(".panel-wrapper[data-panel='properties']");
  const radio = panel.getByRole("radio", { name: option, exact: true });
  if (await radio.first().isVisible().catch(() => false)) {
    await radio.first().click();
  } else {
    await field(label).getByRole("button").first().click();
    await page.waitForTimeout(400);
    await page
      .getByRole("option", { name: option, exact: true })
      .first()
      .click();
  }
  await page.waitForTimeout(1500);
};
const openDesign = async (label) => {
  for (let i = 0; i < 3; i++) {
    if (await field(label).isVisible().catch(() => false)) return true;
    await page
      .getByRole("button", { name: "Design", exact: true })
      .first()
      .click();
    await page.waitForTimeout(1200);
  }
  return field(label).isVisible().catch(() => false);
};
const select = (kind) =>
  page.evaluate((kind) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()]
      .filter((r) => root.typeOf(r) === kind)
      .at(-1);
    ws.selectRecords([node.id]);
    return { id: node.id, source: node.sourceId };
  }, kind);
const read = (id) =>
  page.evaluate((id) => {
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = doc.querySelector(`[data-catalog-id="${id}"]`);
    const styles = el ? doc.defaultView.getComputedStyle(el) : null;
    const heading = el?.querySelector(".react-aria-Heading");
    const node = window.__composition_SKIA_DEBUG__?.getSkiaNode(id);
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const headingRecord = [...root.canvasInputs.values()].find(
      (r) => r.bindingId === "heading" && r.parentId === id,
    );
    const headingNode = headingRecord
      ? window.__composition_SKIA_DEBUG__?.getSkiaNode(headingRecord.id)
      : null;
    const textOf = (n) =>
      n?.text?.color ??
      (n?.children ?? []).map(textOf).find((c) => c !== undefined);
    const rgb = (c) => (c ? [...c].slice(0, 3).map((v) => Math.round(v * 255)) : null);
    const box = node?.box?.fillColor;
    return {
      fillStyle: el?.getAttribute("data-fill-style") ?? null,
      bg: styles?.backgroundColor ?? null,
      borderColor: styles?.borderTopColor ?? null,
      headingColor: heading
        ? doc.defaultView.getComputedStyle(heading).color
        : null,
      canvasFill: rgb(box),
      canvasHeading: rgb(textOf(headingNode)),
    };
  }, id);

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("InlineAlert fill");
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

await addFromPalette("inline alert");
const alert = await select("InlineAlert");
const hasFill = await openDesign("Fill Style");
record("Design offers Fill Style on an InlineAlert", hasFill, { alert });

const outline = await read(alert.id);
await page.screenshot({ path: `${OUT}/outline.png` });
record(
  "default Border: base background + the variant border in both consumers",
  outline.fillStyle === "outline" &&
    outline.bg === "rgb(255, 255, 255)" &&
    outline.borderColor !== "rgba(0, 0, 0, 0)" &&
    JSON.stringify(outline.canvasFill) === "[255,255,255]",
  outline,
);

await choose("Fill Style", "Subtle Fill");
const subtle = await read(alert.id);
await page.screenshot({ path: `${OUT}/subtle.png` });
record(
  "Subtle Fill: the variant subtle background, no border, in both consumers",
  subtle.fillStyle === "subtle" &&
    subtle.bg !== "rgb(255, 255, 255)" &&
    subtle.borderColor === "rgba(0, 0, 0, 0)" &&
    JSON.stringify(subtle.canvasFill) !== "[255,255,255]",
  subtle,
);

await choose("Fill Style", "Bold Fill");
const bold = await read(alert.id);
await page.screenshot({ path: `${OUT}/bold.png` });
record(
  "Bold Fill: the variant color fills, the title goes white, in both consumers",
  bold.fillStyle === "bold" &&
    bold.bg !== subtle.bg &&
    bold.headingColor === "rgb(255, 255, 255)" &&
    JSON.stringify(bold.canvasHeading) === "[255,255,255]",
  bold,
);

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();

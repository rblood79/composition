// LinkButton staticColor live (2026-11-25): real Builder (headed Chrome, Compare Mode). A LinkButton
// paints with the Button rule's tree, so its generated sheet owns the fill and its states — the DOM
// binding wrote the resolved fill inline over them (Black · White · Auto stayed the theme fill) and
// built the centring padding from a font size it never wrote (`undefined` → padding 0).
// Static Color Black · White · Auto from the Design panel → the Preview fill is the scheme's, no inline
// fill, no broken declaration, the padding is the sheet's; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/linkbutton-static-color-live.mjs <out>
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
    .locator(".list-item", { hasText: /^link ?button$/i })
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
const read = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "LinkButton",
    );
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = doc.querySelector(".react-aria-LinkButton");
    const computed = el ? doc.defaultView.getComputedStyle(el) : null;
    const inline = el?.getAttribute("style") ?? "";
    return {
      staticColor: node.props.staticColor ?? null,
      derivedStaticColor: node.derivedProps?.staticColor ?? null,
      dataStaticColor: el?.getAttribute("data-static-color") ?? null,
      previewFill: computed?.backgroundColor ?? null,
      previewPaddingTop: computed?.paddingTop ?? null,
      inlineFill: /background-color/.test(inline),
      inlineUndefined: inline.includes("undefined"),
      previewHeight: el?.getBoundingClientRect().height ?? null,
      canvasHeight: root.getGeometry([node.id]).get(node.id)?.height ?? null,
    };
  });
const selectLinkButton = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "LinkButton",
    );
    ws.selectRecords([node.id]);
  });

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("LinkButton static color");
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
  .getByRole("button", { name: "Compare mode (Preview + Skia)", exact: true })
  .first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await page.waitForTimeout(1500);

await addFromPalette("link");
await page.waitForTimeout(1500);
await selectLinkButton();
await page.waitForTimeout(1000);
for (let i = 0; i < 3; i++) {
  if (
    await field("Static color")
      .isVisible()
      .catch(() => false)
  )
    break;
  await page
    .getByRole("button", { name: "Design", exact: true })
    .first()
    .click();
  await page.waitForTimeout(1200);
}
const rest = await read();
const clean = (r) =>
  !r.inlineFill &&
  !r.inlineUndefined &&
  parseFloat(r.previewPaddingTop) > 0 &&
  r.canvasHeight === r.previewHeight;
record(
  "at rest: no inline fill · no broken declaration · sheet padding · height Canvas = Preview",
  clean(rest),
  rest,
);
await pick("Static color", "Black");
const black = await read();
record(
  "Black: Preview fill rgba(0, 0, 0, 0.85) · Canvas record black",
  black.staticColor === "black" &&
    black.dataStaticColor === "black" &&
    black.previewFill === "rgba(0, 0, 0, 0.85)" &&
    black.previewFill !== rest.previewFill &&
    clean(black),
  black,
);
await pick("Static color", "White");
const white = await read();
record(
  "White: Preview fill rgba(255, 255, 255, 0.85) · Canvas record white",
  white.staticColor === "white" &&
    white.dataStaticColor === "white" &&
    white.previewFill === "rgba(255, 255, 255, 0.85)" &&
    clean(white),
  white,
);
await pick("Static color", "Auto");
const auto = await read();
record(
  "Auto on the page background: the black scheme on both (S2 autoStaticColor)",
  auto.staticColor === "auto" &&
    auto.derivedStaticColor === "black" &&
    auto.dataStaticColor === "black" &&
    auto.previewFill === "rgba(0, 0, 0, 0.85)" &&
    clean(auto),
  auto,
);

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();

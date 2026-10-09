// S2 Separator staticColor live (사용자 2026-10-09 「②로 넘어가」): real Builder (headed Chrome,
// Compare Mode). A Separator: Static Color Black from the Design panel → the Preview line is
// rgba(0, 0, 0, 0.14) and the Canvas record carries staticColor black (its divider paints the same,
// `separatorStaticColor.test.ts`); size L → 0.85; White → rgba(255, 255, 255, 0.14); no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/separator-static-color-live.mjs <out>
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
const read = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "Separator",
    );
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = doc.querySelector(".react-aria-Separator");
    return {
      staticColor: node.props.staticColor ?? null,
      size: node.props.size ?? null,
      dataStaticColor: el?.getAttribute("data-static-color") ?? null,
      previewColor: el ? doc.defaultView.getComputedStyle(el).backgroundColor : null,
      previewHeight: el?.getBoundingClientRect().height ?? null,
      canvasHeight: root.getGeometry([node.id]).get(node.id)?.height ?? null,
    };
  });
const selectSeparator = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "Separator",
    );
    ws.selectRecords([node.id]);
  });

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Separator static color");
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

await addFromPalette("separator");
await page.waitForTimeout(1500);
await selectSeparator();
await page.waitForTimeout(1000);
for (let i = 0; i < 3; i++) {
  if (await field("Static Color").isVisible().catch(() => false)) break;
  await page.getByRole("button", { name: "Design", exact: true }).first().click();
  await page.waitForTimeout(1200);
}
const before = await read();
await pick("Static Color", "Black");
const black = await read();
record(
  "Black from the panel: Preview line rgba(0, 0, 0, 0.14) · Canvas record black · height Canvas = Preview",
  before.previewColor !== black.previewColor &&
    black.staticColor === "black" &&
    black.dataStaticColor === "black" &&
    black.previewColor === "rgba(0, 0, 0, 0.14)" &&
    black.canvasHeight === black.previewHeight,
  { before, black },
);
await pick("Size", "L");
const large = await read();
record(
  "Size L: Preview line rgba(0, 0, 0, 0.85) · height 4 on both",
  large.previewColor === "rgba(0, 0, 0, 0.85)" &&
    large.previewHeight === 4 &&
    large.canvasHeight === 4,
  large,
);
await pick("Static Color", "White");
const white = await read();
record(
  "White: Preview line rgba(255, 255, 255, 0.85) at L · Canvas record white",
  white.staticColor === "white" &&
    white.previewColor === "rgba(255, 255, 255, 0.85)",
  white,
);

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();

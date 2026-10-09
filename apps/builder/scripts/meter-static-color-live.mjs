// S2 Meter staticColor live (2026-10-10, 조사 문서 목록 D): real Builder (headed Chrome, Compare
// Mode). A Meter: Static Color White from the Design panel → the Preview fill is white and its track
// a 25% white wash; the Canvas track · fill take the Meter's staticColor (their paint:
// `meterStaticColor.test.ts`); Black → black; Auto → the variant fill again; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/meter-static-color-live.mjs <out>
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
    const records = [...root.canvasInputs.values()];
    const of = (type) => records.find((r) => root.typeOf(r) === type);
    const meter = of("Meter");
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = doc.querySelector(".react-aria-Meter");
    const css = (selector, key) => {
      const target = el?.querySelector(selector);
      return target ? doc.defaultView.getComputedStyle(target)[key] : null;
    };
    const height = (record) =>
      record ? (root.getGeometry([record.id]).get(record.id)?.height ?? null) : null;
    return {
      staticColor: meter.props.staticColor ?? null,
      fillDerived: of("MeterFill")?.derivedProps?.staticColor ?? null,
      trackDerived: of("MeterTrack")?.derivedProps?.staticColor ?? null,
      dataStaticColor: el?.getAttribute("data-static-color") ?? null,
      previewFill: css(".fill", "backgroundColor"),
      previewTrack: css(".bar", "backgroundColor"),
      previewLabel: css(".react-aria-Label", "color"),
      previewValue: css(".value", "color"),
      canvasHeight: height(meter),
      previewHeight: el?.getBoundingClientRect().height ?? null,
    };
  });
const selectMeter = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "Meter",
    );
    ws.selectRecords([node.id]);
  });

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Meter static color");
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

await addFromPalette("meter");
await page.waitForTimeout(1500);
await selectMeter();
await page.waitForTimeout(1000);
for (let i = 0; i < 3; i++) {
  if (await field("Static Color").isVisible().catch(() => false)) break;
  await page.getByRole("button", { name: "Design", exact: true }).first().click();
  await page.waitForTimeout(1200);
}
const before = await read();
await pick("Static Color", "White");
const white = await read();
record(
  "White from the panel: Preview fill white · track 25% white · Canvas track · fill take white · height Canvas = Preview",
  white.staticColor === "white" &&
    white.dataStaticColor === "white" &&
    white.fillDerived === "white" &&
    white.trackDerived === "white" &&
    white.previewFill === "rgb(255, 255, 255)" &&
    white.previewTrack === "rgba(255, 255, 255, 0.25)" &&
    white.canvasHeight === white.previewHeight,
  { before, white },
);
await pick("Static Color", "Black");
const black = await read();
record(
  "Black: Preview fill black · track 25% black · Canvas black",
  black.fillDerived === "black" &&
    black.trackDerived === "black" &&
    black.previewFill === "rgb(0, 0, 0)" &&
    black.previewTrack === "rgba(0, 0, 0, 0.25)",
  black,
);
await pick("Static Color", "Auto");
const auto = await read();
record(
  "Auto: the variant fill again on both",
  auto.dataStaticColor === null &&
    auto.previewFill === before.previewFill &&
    auto.previewTrack === before.previewTrack &&
    (auto.fillDerived === null || auto.fillDerived === "auto"),
  auto,
);

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();

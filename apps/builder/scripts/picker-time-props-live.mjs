// S2 picker hourCycle · placeholderValue live (사용자 2026-10-09 「①부터 진행해」): real Builder
// (headed Chrome, Compare Mode). A DatePicker: Granularity Minute and Hour Cycle 24 from the Design
// panel → the Canvas DateInput segments and the Preview's carry no day period and read the same;
// 12 → both carry it; Placeholder Value 2030-03-15 typed in the panel (at the minute granularity —
// RAC threw on a date-only placeholder there and the Preview went blank) → the Preview's calendar
// opens on March 2030; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/picker-time-props-live.mjs <out>
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
const segments = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const picker = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "DatePicker",
    );
    const input = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "DateInput",
    );
    root.getGeometry([input.id]);
    const canvas = (root.dateSegmentPaint(input.id)?.runs ?? [])
      .map((run) => run.text)
      .join("");
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = doc.querySelector(
      ".react-aria-DatePicker .react-aria-DateInput",
    );
    const preview = (el?.textContent ?? "").replace(
      /[\u2066-\u2069\u200e\u200f]/g,
      "",
    );
    // (The Canvas paints the segments as runs; the DOM text has the literal spaces between them.)
    return {
      hourCycle: picker.props.hourCycle ?? null,
      canvas: canvas.replace(/\s/g, ""),
      preview: preview.replace(/\s/g, ""),
    };
  });

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Picker time props");
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

await addFromPalette("date picker");
await page.waitForTimeout(1500);
await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const root = ws.root;
  const node = [...root.canvasInputs.values()].find(
    (r) => root.typeOf(r) === "DatePicker",
  );
  ws.selectRecords([node.id]);
});
await page.waitForTimeout(1000);
await page.getByRole("button", { name: "Design", exact: true }).first().click();
await page.waitForTimeout(1200);
await pick("Granularity", "Minute");
await pick("Hour Cycle", "24");
const h24 = await segments();
// (A day period: 오전/오후 · AM/PM.)
const period = /오전|오후|AM|PM/;
record(
  "Hour Cycle 24 from the panel: node 24 · Canvas = Preview segments · no day period",
  h24.hourCycle === "24" &&
    h24.canvas === h24.preview &&
    !period.test(h24.canvas),
  h24,
);
await pick("Hour Cycle", "12");
const h12 = await segments();
record(
  "Hour Cycle 12: Canvas = Preview segments · day period on both",
  h12.hourCycle === "12" &&
    h12.canvas === h12.preview &&
    period.test(h12.canvas),
  h12,
);
await page.screenshot({ path: `${OUT}/hour-cycle-12.png` });

const input = field("Placeholder Value").locator("input").first();
await input.fill("2030-03-15");
await input.press("Enter");
await page.waitForTimeout(1500);
const doc = page.frameLocator("#previewFrame");
await doc
  .locator(".react-aria-DatePicker button")
  .first()
  .dispatchEvent("click", undefined, { timeout: 5000 });
await page.waitForTimeout(1200);
const heading = await doc
  .locator(".react-aria-Popover .react-aria-Calendar .react-aria-Heading")
  .first()
  .innerText()
  .catch(() => null);
const stored = await page.evaluate(() => {
  const root = window.__COMPOSITION_CATALOG__.workspace.root;
  return [...root.canvasInputs.values()].find(
    (r) => root.typeOf(r) === "DatePicker",
  ).props.placeholderValue;
});
record(
  "Placeholder Value 2030-03-15 from the panel: the Preview calendar opens on March 2030",
  stored === "2030-03-15" &&
    /2030/.test(heading ?? "") &&
    /3월|March/.test(heading ?? ""),
  { stored, heading },
);
await page.screenshot({ path: `${OUT}/placeholder-value.png` });

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();

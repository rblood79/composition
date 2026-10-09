// S2 Meter · ProgressBar staticColor live (2026-10-10, 조사 문서 목록 D · 사용자 「Static Color 일 때
// S2와 동일하게」): real Builder (headed Chrome, Compare Mode). For a Meter and a ProgressBar: Static
// Color White from the Design panel → Preview track 0.17 · fill 0.94 · label and value text white
// (S2 transparent-overlay-300 · -900 · -1000); the Canvas track · fill · label · value take the
// owner's staticColor (their paint: `meterStaticColor.test.ts`); Black → black; Auto → the theme
// colors again; no errors.
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
const PARTS = {
  Meter: { track: "MeterTrack", fill: "MeterFill", value: "MeterValue", bar: ".bar" },
  ProgressBar: {
    track: "ProgressBarTrack",
    fill: "ProgressBarFill",
    value: "ProgressBarValue",
    bar: ".bar",
  },
};
const read = (type) =>
  page.evaluate(
    ({ type, parts }) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const root = ws.root;
      const records = [...root.canvasInputs.values()];
      const owner = records.find((r) => root.typeOf(r) === type);
      const under = (partType) =>
        records.find((r) => {
          if (root.typeOf(r) !== partType) return false;
          for (let c = root.canvasInputs.get(r.parentId); c; c = root.canvasInputs.get(c.parentId))
            if (c.id === owner.id) return true;
          return false;
        });
      const doc = document.querySelector("#previewFrame").contentDocument;
      const el = doc.querySelector(`.react-aria-${type}`);
      const css = (selector, key) => {
        const target = el?.querySelector(selector);
        return target ? doc.defaultView.getComputedStyle(target)[key] : null;
      };
      const height = (record) =>
        record ? (root.getGeometry([record.id]).get(record.id)?.height ?? null) : null;
      return {
        staticColor: owner.props.staticColor ?? null,
        canvas: {
          track: under(parts.track)?.derivedProps?.staticColor ?? null,
          fill: under(parts.fill)?.derivedProps?.staticColor ?? null,
          label: under("Label")?.derivedProps?.color ?? null,
          value: under(parts.value)?.derivedProps?.staticColor ?? null,
        },
        preview: {
          attr: el?.getAttribute("data-static-color") ?? null,
          track: css(parts.bar, "backgroundColor"),
          fill: css(".fill", "backgroundColor"),
          label: css(".react-aria-Label", "color"),
          value: css(".value", "color"),
        },
        canvasHeight: height(owner),
        previewHeight: el?.getBoundingClientRect().height ?? null,
      };
    },
    { type, parts: PARTS[type] },
  );
const select = (type) =>
  page.evaluate((type) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === type,
    );
    ws.selectRecords([node.id]);
  }, type);

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Bar static color");
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

const s2 = (rgb) => ({
  track: `rgba(${rgb}, 0.17)`,
  fill: `rgba(${rgb}, 0.94)`,
  text: `rgb(${rgb})`,
});
const PALETTE = { Meter: "meter", ProgressBar: "progress bar" };
for (const type of ["Meter", "ProgressBar"]) {
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectRecords([]),
  );
  await addFromPalette(PALETTE[type]);
  await page.waitForTimeout(1500);
  await select(type);
  await page.waitForTimeout(1000);
  for (let i = 0; i < 3; i++) {
    if (await field("Static Color").isVisible().catch(() => false)) break;
    await page.getByRole("button", { name: "Design", exact: true }).first().click();
    await page.waitForTimeout(1200);
  }
  const before = await read(type);
  for (const [option, value, rgb, hex] of [
    ["White", "white", "255, 255, 255", "#ffffff"],
    ["Black", "black", "0, 0, 0", "#000000"],
  ]) {
    await pick("Static Color", option);
    const shown = await read(type);
    const want = s2(rgb);
    record(
      `${type} ${option}: Preview track 0.17 · fill 0.94 · label · value ${value} = Canvas track · fill · label · value ${value} · height Canvas = Preview`,
      shown.staticColor === value &&
        shown.preview.attr === value &&
        shown.preview.track === want.track &&
        shown.preview.fill === want.fill &&
        shown.preview.label === want.text &&
        shown.preview.value === want.text &&
        shown.canvas.track === value &&
        shown.canvas.fill === value &&
        shown.canvas.label === hex &&
        shown.canvas.value === value &&
        shown.canvasHeight === shown.previewHeight,
      option === "White" ? { before, shown } : shown,
    );
  }
  await pick("Static Color", "Auto");
  const auto = await read(type);
  record(
    `${type} Auto: the theme colors again on both`,
    auto.preview.attr === null &&
      auto.preview.track === before.preview.track &&
      auto.preview.fill === before.preview.fill &&
      auto.preview.label === before.preview.label &&
      auto.preview.value === before.preview.value &&
      auto.canvas.label === before.canvas.label &&
      auto.canvas.value === before.canvas.value,
    auto,
  );
  await page.keyboard.press("Escape");
}

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();

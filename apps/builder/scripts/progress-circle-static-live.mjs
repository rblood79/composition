// S2 ProgressCircle staticColor live (2026-10-10 사용자 「ProgressCircle 도 S2와 동일하게」): real
// Builder (headed Chrome, Compare Mode). A ProgressCircle: Static Color Black from the Design panel →
// the Preview track stroke is rgba(0, 0, 0, 0.17) and the indicator rgba(0, 0, 0, 0.94) (S2
// transparent-overlay-300 · -900); the Canvas paints the same — its pixels at zoom: the darkest
// stroke pixel ≈ 15 (0.94 black over white) and the track ≈ 212 (0.17), as the Preview's; White →
// the Preview strokes white at the same opacities; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/progress-circle-static-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const OUT = process.argv[2];
const pngjsDir = readdirSync(`${process.cwd()}/node_modules/.pnpm`).find((d) =>
  d.startsWith("pngjs@"),
);
const { PNG } = createRequire(import.meta.url)(
  `${process.cwd()}/node_modules/.pnpm/${pngjsDir}/node_modules/pngjs/lib/png.js`,
);
/**
 * Neutral pixels of a shot: at 0.94 black over white (≈15), at the 0.17 track gray (≈212) and
 * solid black (≤3). Compared with the Auto shot, so the builder's own dark UI cancels out.
 */
const grays = (buffer) => {
  const img = PNG.sync.read(buffer);
  const out = { fill94: 0, track17: 0, solid: 0 };
  for (let i = 0; i < img.data.length; i += 4) {
    const [r, g, b] = [img.data[i], img.data[i + 1], img.data[i + 2]];
    if (Math.max(r, g, b) - Math.min(r, g, b) > 4) continue;
    if (Math.abs(r - 15) <= 2) out.fill94++;
    if (Math.abs(r - 212) <= 2) out.track17++;
    if (r <= 3) out.solid++;
  }
  return out;
};
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
  deviceScaleFactor: 3,
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
      (r) => root.typeOf(r) === "ProgressCircle",
    );
    const doc = document.querySelector("#previewFrame").contentDocument;
    const circles = [
      ...doc.querySelectorAll(".react-aria-ProgressCircle circle, [data-static-color] circle, [role=progressbar] circle"),
    ];
    const stroke = (el) =>
      el ? doc.defaultView.getComputedStyle(el).stroke : null;
    return {
      staticColor: node.props.staticColor ?? null,
      track: stroke(circles[0]),
      indicator: stroke(circles[1]),
    };
  });
const select = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "ProgressCircle",
    );
    ws.selectRecords([node.id]);
  });
const shots = async (name) => {
  const canvas = await page.locator("canvas").first().screenshot();
  const preview = await page.locator("#previewFrame").screenshot();
  writeFileSync(`${OUT}/${name}-canvas.png`, canvas);
  writeFileSync(`${OUT}/${name}-preview.png`, preview);
  return { canvas: grays(canvas), preview: grays(preview) };
};

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ProgressCircle static color");
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

await addFromPalette("progress circle");
await page.waitForTimeout(1500);
await select();
await page.waitForTimeout(1000);
for (let i = 0; i < 3; i++) {
  if (await field("Static Color").isVisible().catch(() => false)) break;
  await page.getByRole("button", { name: "Design", exact: true }).first().click();
  await page.waitForTimeout(1200);
}
// (No selection chrome in the shots; the context renders at 3× so the 3px strokes have fully
// covered pixels at the fit zoom.)
const deselect = () =>
  page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.selectRecords([]),
  );
const pickOn = async (option) => {
  await select();
  await page.waitForTimeout(600);
  await pick("Static Color", option);
  await deselect();
  await page.waitForTimeout(1200);
};

await deselect();
await page.waitForTimeout(1200);
const before = await read();
const autoShots = await shots("auto");
await pickOn("Black");
const black = await read();
const blackShots = await shots("black");
const added = (side) => ({
  fill94: blackShots[side].fill94 - autoShots[side].fill94,
  track17: blackShots[side].track17 - autoShots[side].track17,
  solid: blackShots[side].solid - autoShots[side].solid,
});
const canvasAdded = added("canvas");
const previewAdded = added("preview");
record(
  "Black: Preview track rgba(0, 0, 0, 0.17) · indicator rgba(0, 0, 0, 0.94) · Canvas pixels like the Preview's (new ≈15 indicator and ≈212 track pixels, no solid black)",
  black.staticColor === "black" &&
    black.track === "rgba(0, 0, 0, 0.17)" &&
    black.indicator === "rgba(0, 0, 0, 0.94)" &&
    canvasAdded.fill94 > 10 &&
    canvasAdded.track17 > 10 &&
    canvasAdded.solid <= 0 &&
    previewAdded.fill94 > 10 &&
    previewAdded.track17 > 10 &&
    previewAdded.solid <= 0,
  { before, black, canvasAdded, previewAdded },
);
await pickOn("White");
const white = await read();
record(
  "White: Preview track rgba(255, 255, 255, 0.17) · indicator rgba(255, 255, 255, 0.94) · Canvas record white",
  white.staticColor === "white" &&
    white.track === "rgba(255, 255, 255, 0.17)" &&
    white.indicator === "rgba(255, 255, 255, 0.94)",
  white,
);
await pickOn("Auto");
const auto = await read();
record(
  "Auto: the theme strokes again",
  auto.track === before.track && auto.indicator === before.indicator,
  auto,
);

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();

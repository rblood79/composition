// S2 Slider trackStyle · thumbStyle · fillOffset live (사용자 2026-10-10 「개별 10건 착수」):
// real Builder (headed Chrome, Compare Mode). A Slider from the palette (400px): the Design
// panel offers Track Style · Thumb Style · Fill Offset; Thick makes a 16px bar with the S2 sm
// corner, Precise a 6×(size+2) thumb bar, and Fill Offset 50 with value 30 runs the fill from
// 30% to 50% of the track — each in the Preview and on the Canvas; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/slider-s2-styles-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
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
const type = async (label, text) => {
  const box = field(label).locator("input").first();
  await box.fill(text);
  await box.press("Enter");
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
const setWidth = (source) =>
  page.evaluate(
    async ({ commands, source }) => {
      const c = await import(commands);
      window.__COMPOSITION_CATALOG__.workspace.execute(
        c.setFields({
          targets: [{ kind: "node", id: source }],
          sizing: { width: { kind: "set", value: 400 } },
        }),
      );
      await new Promise((r) => setTimeout(r, 800));
    },
    { commands, source },
  );
/** Preview + Canvas boxes of the slider's parts. */
const read = (id) =>
  page.evaluate((id) => {
    const doc = document.querySelector("#previewFrame").contentDocument;
    const owner = doc.querySelector(`[data-catalog-id="${id}"]`);
    const track = owner?.querySelector(".react-aria-SliderTrack");
    const fill = owner?.querySelector(".react-aria-SliderFill");
    const thumb = owner?.querySelector(".react-aria-SliderThumb");
    const box = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, width: r.width, height: r.height };
    };
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const records = [...root.canvasInputs.values()];
    const part = (match) => records.find(match);
    const trackRecord = part((r) => (r.ruleId ?? "") === "SliderTrack");
    const fillRecord = part((r) => r.bindingId === "sliderfill");
    const thumbRecord = part((r) => r.bindingId === "sliderthumb");
    const geo = (recordEntry) =>
      recordEntry
        ? root.getGeometry([recordEntry.id]).get(recordEntry.id)
        : null;
    const skia = trackRecord
      ? window.__composition_SKIA_DEBUG__?.getSkiaNode(trackRecord.id)
      : null;
    const radius = skia?.box?.borderRadius;
    return {
      dom: {
        track: box(track),
        fill: box(fill),
        thumb: box(thumb),
        trackRadius: track
          ? doc.defaultView.getComputedStyle(track).borderRadius
          : null,
      },
      canvas: {
        track: geo(trackRecord),
        fill: geo(fillRecord),
        thumb: geo(thumbRecord),
        trackRadius: Array.isArray(radius) ? radius[0] : (radius ?? null),
      },
    };
  }, id);
const near = (a, b, tolerance = 1.5) =>
  typeof a === "number" && typeof b === "number" && Math.abs(a - b) <= tolerance;

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Slider S2");
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

await addFromPalette("slider");
const slider = await select("Slider");
await setWidth(slider.source);
const offered =
  (await openDesign("Track Style")) &&
  (await field("Thumb Style").isVisible().catch(() => false)) &&
  (await field("Fill Offset").isVisible().catch(() => false));
record("Design offers Track Style · Thumb Style · Fill Offset", offered, {
  slider,
});

const thin = await read(slider.id);
record(
  "default: the M track is an 8px bar in both consumers",
  near(thin.dom.track?.height, 8) && near(thin.canvas.track?.height, 8),
  thin,
);

await choose("Track Style", "Thick");
const thick = await read(slider.id);
await page.screenshot({ path: `${OUT}/track-thick.png` });
record(
  "Thick: a 16px bar with the 4px corner in both consumers",
  near(thick.dom.track?.height, 16) &&
    thick.dom.trackRadius === "4px" &&
    near(thick.canvas.track?.height, 16) &&
    thick.canvas.trackRadius === 4,
  thick,
);
await choose("Track Style", "Thin");

await choose("Thumb Style", "Precise");
const precise = await read(slider.id);
await page.screenshot({ path: `${OUT}/thumb-precise.png` });
record(
  "Precise: a 6×20 thumb bar in both consumers (M)",
  near(precise.dom.thumb?.width, 6) &&
    near(precise.dom.thumb?.height, 20) &&
    near(precise.canvas.thumb?.width, 6) &&
    near(precise.canvas.thumb?.height, 20),
  precise,
);
await choose("Thumb Style", "Default");

// (The slider's value — the pre-existing Content field; set by command, the panel's Value
// input is a text field whose commit timing is not this feature's surface.)
await page.evaluate(
  async ({ commands, source }) => {
    const c = await import(commands);
    window.__COMPOSITION_CATALOG__.workspace.execute(
      c.setFields({
        targets: [{ kind: "node", id: source }],
        props: { value: { kind: "set", value: 30 } },
      }),
    );
    await new Promise((r) => setTimeout(r, 800));
  },
  { commands, source: slider.source },
);
await type("Fill Offset", "50");
const offset = await read(slider.id);
await page.screenshot({ path: `${OUT}/fill-offset.png` });
const ratioDom = offset.dom.fill && offset.dom.track
  ? {
      start: (offset.dom.fill.left - offset.dom.track.left) / offset.dom.track.width,
      width: offset.dom.fill.width / offset.dom.track.width,
    }
  : null;
const ratioCanvas = offset.canvas.fill && offset.canvas.track
  ? {
      start:
        (offset.canvas.fill.x - offset.canvas.track.x) /
        offset.canvas.track.width,
      width: offset.canvas.fill.width / offset.canvas.track.width,
    }
  : null;
record(
  "Fill Offset 50 (value 30): the fill runs 30% → 50% in both consumers",
  !!ratioDom &&
    !!ratioCanvas &&
    near(ratioDom.start, 0.3, 0.02) &&
    near(ratioDom.width, 0.2, 0.02) &&
    near(ratioCanvas.start, 0.3, 0.02) &&
    near(ratioCanvas.width, 0.2, 0.02),
  { ratioDom, ratioCanvas },
);

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();

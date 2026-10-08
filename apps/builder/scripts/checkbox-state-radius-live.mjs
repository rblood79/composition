// Checkbox live (사용자 2026-10-09 보고 3건) — in the real Builder (headed Chrome, Compare Mode opens
// the Preview), a palette Checkbox edited through the Properties「Options」chips:
//   L-1 Selected off → on: the Canvas indicator (Skia node data) and the Preview follow each step
//   L-2 Indeterminate on: Canvas box filled + one dash · Preview box filled + a stroked Minus glyph
//   L-3 indicator radius: Canvas `box.borderRadius` = Preview `.checkbox` computed border-radius
//   L-4 no page / console errors
//   L-6 Invalid: Canvas border (and a filled box's fill) = the Preview's computed negative
//   L-5 glyph geometry: Canvas check · dash lines = the Preview's lucide paths in the measured svg frame
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/checkbox-state-radius-live.mjs <out>
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

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type(`checkbox-live-${Date.now()}`);
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
  timeout: 30000,
});

// Palette → Checkbox (the new node stays selected: the Properties panel shows it).
const search = page.getByLabel("Search components");
if (!(await search.isVisible().catch(() => false)))
  await page.getByRole("button", { name: "Components", exact: true }).first().click();
await search.fill("checkbox");
await page.waitForTimeout(300);
await page.locator(".list-item", { hasText: /^checkbox$/i }).first().click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Components", exact: true }).first().click();
const compare = page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await page.waitForTimeout(3000);

const skia = null;
/** Canvas: the indicator node's Skia data · Preview: the Checkbox element and its box / glyph. */
const read = () =>
  page.evaluate(async (skia) => {
    const getSkiaNode = (id) => window.__composition_SKIA_DEBUG__?.getSkiaNode?.(id);
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const indicator = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "CheckboxIndicator",
    );
    const data = getSkiaNode(indicator.id);
    const owner = [...root.canvasInputs.values()].find((r) => root.typeOf(r) === "Checkbox");
    const entry = window.__COMPOSITION_CATALOG__.workspace.runtime?.graph?.getEntry?.(owner.sourceId);
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const el = doc?.querySelector(".react-aria-Checkbox");
    const box = el?.querySelector(".checkbox");
    const svg = box?.querySelector("svg");
    const css = box ? getComputedStyle(box) : undefined;
    // (Computed colors come as oklch: read them back as sRGB through a 1px 2D canvas.)
    const toRgb = (color) => {
      if (!color) return null;
      const ctx = new OffscreenCanvas(1, 1).getContext("2d");
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    };
    return {
      debug: { ownerProps: { isSelected: owner.props.isSelected, isIndeterminate: owner.props.isIndeterminate, displayState: owner.displayState ?? null }, entryProps: entry?.props ?? null, hasData: !!data, indicatorId: indicator.id },
      canvas: {
        fill: data?.box?.fillColor ? Array.from(Object.values(data.box.fillColor)).map((v) => +v.toFixed(3)) : null,
        stroke: data?.box?.strokeColor ? Array.from(Object.values(data.box.strokeColor)).map((v) => Math.round(v * 255)) : null,
        radius: data?.box?.borderRadius ?? null,
        lines: (data?.children ?? []).filter((c) => c.type === "line").length,
        glyph: (data?.children ?? [])
          .filter((c) => c.type === "line")
          .map((c) => [c.line.x1, c.line.y1, c.line.x2, c.line.y2, c.line.strokeWidth, c.line.strokeCap]),
      },
      preview: {
        selected: el?.hasAttribute("data-selected") ?? null,
        indeterminate: el?.hasAttribute("data-indeterminate") ?? null,
        background: toRgb(css?.backgroundColor),
        borderColor: toRgb(css?.borderTopColor),
        invalid: el?.hasAttribute("data-invalid") ?? null,
        radius: css?.borderRadius ?? null,
        glyph: svg?.getAttribute("class") ?? null,
        glyphStroke: svg ? getComputedStyle(svg).stroke : null,
        // The svg's place in the box (viewBox 24, `meet`): origin · scale of its 24-unit square.
        glyphFrame: svg && box
          ? (() => {
              const b = box.getBoundingClientRect();
              const v = svg.getBoundingClientRect();
              const scale = Math.min(v.width, v.height) / 24;
              return {
                x: v.x - b.x + (v.width - 24 * scale) / 2,
                y: v.y - b.y + (v.height - 24 * scale) / 2,
                scale,
                stroke: parseFloat(getComputedStyle(svg).strokeWidth) * scale,
                cap: getComputedStyle(svg).strokeLinecap,
              };
            })()
          : null,
      },
    };
  }, skia);
const chip = async (name) => {
  await page.locator(".property-chips").getByText(name, { exact: true }).first().click();
  await page.waitForTimeout(900);
};
const canvasBox = await page.locator("canvas").first().boundingBox();
const shot = (name) =>
  page.screenshot({ path: `${OUT}/${name}.png`, clip: canvasBox ?? undefined });

// (Compare Mode leaves the side panels closed: open the Design panel for the Options chips.)
if (!(await page.locator(".property-chips").first().isVisible().catch(() => false)))
  await page.getByRole("button", { name: /^design/i }).last().click();
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/0-builder.png` });
const initial = await read();
await shot("1-initial");
await chip("Selected");
const off = await read();
await shot("2-selected-off");
await chip("Selected");
const on = await read();
await shot("3-selected-on");
await chip("Selected");
await chip("Indeterminate");
const indeterminate = await read();
await shot("4-indeterminate");
// L-6: Invalid on an indeterminate box, then on an unselected one.
await chip("Invalid");
const invalidFilled = await read();
await chip("Indeterminate");
const invalidEmpty = await read();
await shot("5-invalid");

record(
  "L-1 Selected off → on follows on the Canvas and in the Preview",
  initial.canvas.lines === 2 &&
    off.canvas.lines === 0 &&
    JSON.stringify(off.canvas.fill) !== JSON.stringify(initial.canvas.fill) &&
    off.preview.selected === false &&
    on.canvas.lines === 2 &&
    JSON.stringify(on.canvas.fill) === JSON.stringify(initial.canvas.fill) &&
    on.preview.selected === true,
  { initial, off, on },
);
record(
  "L-2 Indeterminate: Canvas filled box + dash · Preview filled box + stroked Minus",
  indeterminate.canvas.lines === 1 &&
    JSON.stringify(indeterminate.canvas.fill) === JSON.stringify(initial.canvas.fill) &&
    indeterminate.preview.indeterminate === true &&
    indeterminate.preview.background === initial.preview.background &&
    /lucide-minus/.test(indeterminate.preview.glyph ?? "") &&
    indeterminate.preview.glyphStroke !== "none",
  { indeterminate },
);
record(
  "L-3 indicator radius: Canvas = Preview",
  initial.canvas.radius === 4 && initial.preview.radius === "4px",
  { canvas: initial.canvas.radius, preview: initial.preview.radius },
);
// L-5: the Canvas glyph lines are the Preview's lucide paths in the svg's measured frame.
const glyphMatches = (sample, paths) => {
  const f = sample.preview.glyphFrame;
  if (!f) return false;
  const expected = paths.map(([a, b]) => [
    f.x + a[0] * f.scale, f.y + a[1] * f.scale, f.x + b[0] * f.scale, f.y + b[1] * f.scale,
  ]);
  return (
    sample.canvas.glyph.length === expected.length &&
    sample.canvas.glyph.every(
      (line, i) =>
        expected[i].every((v, j) => Math.abs(line[j] - v) < 0.01) &&
        Math.abs(line[4] - f.stroke) < 0.01 &&
        line[5] === f.cap,
    )
  );
};
record(
  "L-5 glyph geometry: Canvas lines = Preview lucide Check / Minus in the measured svg frame",
  glyphMatches(initial, [[[20, 6], [9, 17]], [[9, 17], [4, 12]]]) &&
    glyphMatches(indeterminate, [[[5, 12], [19, 12]]]),
  {
    check: { canvas: initial.canvas.glyph, frame: initial.preview.glyphFrame },
    dash: { canvas: indeterminate.canvas.glyph, frame: indeterminate.preview.glyphFrame },
  },
);
// L-6: invalid — Canvas box border (and a filled box's fill) = the Preview's computed negative.
const rgb = (css) => (css?.match(/\d+(\.\d+)?/g) ?? []).slice(0, 3).map((v) => Math.round(+v));
const near = (a, b) => a?.length === 3 && b?.length >= 3 && a.every((v, i) => Math.abs(v - b[i]) <= 1);
const fill255 = (sample) => sample.canvas.fill?.slice(0, 3).map((v) => Math.round(v * 255));
record(
  "L-6 Invalid: Canvas border (and filled box) = Preview negative",
  invalidFilled.preview.invalid === true &&
    near(rgb(invalidFilled.preview.borderColor), invalidFilled.canvas.stroke) &&
    near(rgb(invalidFilled.preview.background), fill255(invalidFilled)) &&
    near(rgb(invalidEmpty.preview.borderColor), invalidEmpty.canvas.stroke) &&
    JSON.stringify(invalidEmpty.canvas.fill) === JSON.stringify(off.canvas.fill) &&
    !near(rgb(off.preview.borderColor), invalidEmpty.canvas.stroke),
  {
    filled: { canvas: { fill: fill255(invalidFilled), stroke: invalidFilled.canvas.stroke }, preview: { background: invalidFilled.preview.background, border: invalidFilled.preview.borderColor } },
    empty: { canvas: { fill: fill255(invalidEmpty), stroke: invalidEmpty.canvas.stroke }, preview: { background: invalidEmpty.preview.background, border: invalidEmpty.preview.borderColor } },
  },
);
record("L-4 no errors", errors.length === 0, { errors });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

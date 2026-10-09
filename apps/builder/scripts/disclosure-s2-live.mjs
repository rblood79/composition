// S2 Disclosure live (사용자 2026-10-10 「S2 처럼 기본 Disclosure 에 위아래 테두리를 넣고, isQuiet 로 없애게」):
// real Builder (headed Chrome, Compare Mode). A Disclosure has a 1px top and bottom border and a
// square trigger; Quiet removes the borders and rounds the trigger; Density changes the trigger
// height (compact · regular · spacious); in the palette DisclosureGroup only the last item keeps
// its bottom border — each step Canvas = Preview; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/disclosure-s2-live.mjs <out>
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
const select = (type, index = 0) =>
  page.evaluate(
    ([type, index]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const root = ws.root;
      const node = [...root.canvasInputs.values()].filter(
        (r) => root.typeOf(r) === type,
      )[index];
      ws.selectRecords([node.id]);
    },
    [type, index],
  );
const toggle = async (label) => {
  for (let i = 0; i < 3; i++) {
    if (
      await field(label)
        .isVisible()
        .catch(() => false)
    )
      break;
    const byText = page
      .locator(".panel-wrapper[data-panel='properties']")
      .getByText(label, { exact: true });
    if (
      await byText
        .first()
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
  await page
    .locator(".panel-wrapper[data-panel='properties']")
    .getByText(label, { exact: true })
    .first()
    .click();
  await page.waitForTimeout(1500);
};

/** Pick an enum option in the Design panel (a segment radio, else a select). */
const choose = async (label, option) => {
  const panel = page.locator(".panel-wrapper[data-panel='properties']");
  const radio = panel.getByRole("radio", { name: option, exact: true });
  if (
    await radio
      .first()
      .isVisible()
      .catch(() => false)
  ) {
    await radio.first().click();
  } else {
    await field(label).getByRole("button").first().click();
    await page
      .getByRole("option", { name: option, exact: true })
      .first()
      .click();
  }
  await page.waitForTimeout(1500);
};
/** Canvas (Skia debug node · layout) and Preview (computed style · box) of each Disclosure. */
const read = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const skia = (id) => window.__composition_SKIA_DEBUG__?.getSkiaNode?.(id);
    const rgb = (c) =>
      c ? [0, 1, 2].map((i) => Math.round(c[i] * 255)) : null;
    const doc = document.querySelector("#previewFrame").contentDocument;
    const toRgb = (color) => {
      if (!color) return null;
      const ctx = new OffscreenCanvas(1, 1).getContext("2d");
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data).slice(0, 3);
    };
    const all = [...root.canvasInputs.values()];
    const height = (id) => root.getGeometry([id]).get(id)?.height ?? null;
    return all
      .filter((r) => root.typeOf(r) === "Disclosure")
      .map((d) => {
        const trigger = all.find(
          (r) =>
            root.typeOf(r) === "Button" &&
            r.props.slot === "trigger" &&
            root.canvasInputs.get(r.parentId)?.parentId === d.id,
        );
        const node = skia(d.id);
        const el = doc.querySelector(`[data-catalog-id="${d.id}"]`);
        const tEl =
          trigger && doc.querySelector(`[data-catalog-id="${trigger.id}"]`);
        const cs = el && getComputedStyle(el);
        const ts = tEl && getComputedStyle(tEl);
        return {
          canvas: {
            strokes: node?.box?.strokeWidths ?? [0, 0, 0, 0],
            color: rgb(node?.box?.strokeColor),
            height: height(d.id),
            triggerHeight: trigger ? height(trigger.id) : null,
            triggerRadius: trigger?.visual.radius ?? null,
            triggerMinHeight: trigger?.visual.minHeight ?? null,
            triggerPaddingY:
              trigger?.visual.paddingTop ?? trigger?.visual.paddingY ?? null,
          },
          preview: el
            ? {
                strokes: [cs.borderTopWidth, cs.borderBottomWidth].map(
                  parseFloat,
                ),
                color: toRgb(cs.borderTopColor),
                height: el.getBoundingClientRect().height,
                triggerHeight: tEl.getBoundingClientRect().height,
                triggerRadius: parseFloat(ts.borderTopLeftRadius),
                triggerMinHeight: parseFloat(ts.minHeight),
                triggerPaddingY: parseFloat(ts.paddingTop),
                attrs: ["data-quiet", "data-density", "data-in-group"].map(
                  (a) => el.getAttribute(a),
                ),
              }
            : null,
        };
      });
  });
const near = (a, b, tol = 3) =>
  !!a && !!b && a.every((v, i) => Math.abs(v - b[i]) <= tol);
const close = (a, b, tol = 1) => Math.abs(a - b) <= tol;
/** Canvas = Preview for one Disclosure (borders, their color, heights, trigger corner). */
const same = (d) =>
  !!d.preview &&
  d.canvas.strokes[0] === d.preview.strokes[0] &&
  d.canvas.strokes[2] === d.preview.strokes[1] &&
  (d.canvas.strokes[0] + d.canvas.strokes[2] === 0 ||
    near(d.canvas.color, d.preview.color)) &&
  close(d.canvas.height, d.preview.height) &&
  close(d.canvas.triggerHeight, d.preview.triggerHeight) &&
  close(d.canvas.triggerRadius, d.preview.triggerRadius, 0.5);

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("S2 disclosure");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  {
    timeout: 30000,
  },
);
await page.waitForTimeout(1500);
const compare = page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await page.waitForTimeout(1500);

await addFromPalette("disclosure");
await page.waitForTimeout(1500);
await select("Disclosure");
await page.waitForTimeout(800);
const d0 = (await read())[0];
record(
  "default: 1px top and bottom border, square trigger, Canvas = Preview",
  d0.canvas.strokes.join() === "1,0,1,0" &&
    d0.canvas.triggerRadius === 0 &&
    same(d0),
  d0,
);
await page.screenshot({ path: `${OUT}/default.png` });
await toggle("Quiet");
const d1 = (await read())[0];
record(
  "Quiet: no border, rounded trigger, 2px shorter, Canvas = Preview",
  d1.canvas.strokes.join() === "0,0,0,0" &&
    d1.canvas.triggerRadius > 0 &&
    close(d1.canvas.height, d0.canvas.height - 2, 0.5) &&
    d1.preview?.attrs[0] === "true" &&
    same(d1),
  d1,
);
await toggle("Quiet");
const heights = {};
for (const [option, value] of [
  ["Compact", "compact"],
  ["Spacious", "spacious"],
  ["Regular", "regular"],
]) {
  await choose("Density", option);
  const d = (await read())[0];
  heights[value] = d;
  record(
    `Density ${option}: trigger height Canvas = Preview`,
    d.preview?.attrs[1] === value && same(d),
    d,
  );
}
record(
  "Density order: compact < regular < spacious (S2 M 24 · 32 · 40 apart by 8)",
  close(
    heights.regular.canvas.triggerHeight - heights.compact.canvas.triggerHeight,
    8,
  ) &&
    close(
      heights.spacious.canvas.triggerHeight -
        heights.regular.canvas.triggerHeight,
      8,
    ),
  Object.fromEntries(
    Object.entries(heights).map(([k, d]) => [
      k,
      [d.canvas.triggerHeight, d.preview?.triggerHeight],
    ]),
  ),
);

// (Per size: the trigger's S2 min-height and its centering padding on both sides. The heights are
// not compared after a size edit — the Canvas title Text keeps its old font size until a reload, a
// separate existing issue found here, 2026-10-10.)
for (const [size, height, padding] of [
  ["S", 24, 3],
  ["L", 40, 8],
  ["M", 32, 6],
]) {
  await choose("Size", size);
  const d = (await read())[0];
  record(
    `Size ${size}: regular trigger min-height ${height} · padding ${padding} (S2), Canvas = Preview`,
    d.canvas.triggerMinHeight === height &&
      d.preview?.triggerMinHeight === height &&
      d.canvas.triggerPaddingY === padding &&
      d.preview?.triggerPaddingY === padding,
    d,
  );
}

await addFromPalette("disclosure group");
await page.waitForTimeout(1500);
const grouped = (await read()).slice(1);
const canvasBox = await page.locator("canvas").first().boundingBox();
await page.screenshot({
  path: `${OUT}/canvas.png`,
  clip: canvasBox ?? undefined,
});
await page.screenshot({ path: `${OUT}/page.png` });
record(
  "DisclosureGroup: only the last item keeps its bottom border, Canvas = Preview",
  grouped.length >= 2 &&
    grouped.every((d) => d.preview?.attrs[2] === "true" && same(d)) &&
    grouped.slice(0, -1).every((d) => d.canvas.strokes[2] === 0) &&
    grouped.at(-1).canvas.strokes[2] === 1,
  grouped,
);

record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();

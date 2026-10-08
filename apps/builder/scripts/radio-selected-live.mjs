// Radio selected indicator live (사용자 2026-10-09 「radio 의 indicator 가 selected 일때 canvas 와 css 가
// 다르다 — css 기준으로 맞춰」) — in the real Builder (headed Chrome, Compare Mode opens the Preview), a
// palette RadioGroup whose first Radio gets its「Selected」option chip in the Design panel:
//   L-1 the Preview `.react-aria-Radio[data-selected] .indicator`: border width (= (box − dot) / 2),
//       border color, white background
//   L-2 the Canvas indicator: a filled circle of the box's radius in the Preview border color + a white
//       center of the Preview's content radius (box / 2 − border width)
//   L-3 an unselected Radio keeps the thin ring (no white-center pair)
//   L-4 no page / console errors
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/radio-selected-live.mjs <out>
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
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});

await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await page.waitForTimeout(300);
await page.keyboard.type(`radio-live-${Date.now()}`);
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
  timeout: 30000,
});

const search = page.getByLabel("Search components");
if (!(await search.isVisible().catch(() => false)))
  await page.getByRole("button", { name: "Components", exact: true }).first().click();
await search.fill("radio");
await page.waitForTimeout(300);
await page.locator(".list-item", { hasText: /^radio ?group$/i }).first().click();
await page.waitForTimeout(800);
await page.getByRole("button", { name: "Components", exact: true }).first().click();
const compare = page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await page.waitForTimeout(2500);
if (!(await page.getByRole("tab", { name: "Property", exact: true }).isVisible().catch(() => false)))
  await page.getByRole("button", { name: /^design/i }).last().click();
await page.waitForTimeout(600);

// Select the first Radio and turn on its「Selected」option chip (Design panel · Property tab).
await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const radio = [...ws.root.canvasInputs.values()].find(
    (r) => ws.root.typeOf(r) === "Radio",
  );
  ws.selectRecords([radio.id]);
});
await page.waitForTimeout(500);
await page.getByRole("tab", { name: "Property", exact: true }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/0-property.png` });
await page.locator(".property-chips").getByText("Selected", { exact: true }).first().click();
await page.waitForTimeout(1500);

const read = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const getSkiaNode = (id) => window.__composition_SKIA_DEBUG__?.getSkiaNode?.(id);
    const radios = [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === "Radio");
    const indicatorOf = (radio) => {
      const queue = [...radio.children];
      while (queue.length) {
        const r = root.canvasInputs.get(queue.shift());
        if (!r) continue;
        if (root.typeOf(r) === "RadioIndicator") return r;
        queue.push(...r.children);
      }
      return undefined;
    };
    const canvas = radios.map((radio) => {
      const indicator = indicatorOf(radio);
      const data = indicator ? getSkiaNode(indicator.id) : undefined;
      const rgb = (c) =>
        c ? Array.from(Object.values(c)).map((v, i) => (i < 3 ? Math.round(v * 255) : +v.toFixed(2))) : null;
      return {
        selected: radio.props.isSelected ?? radio.derivedProps?._isSelected ?? null,
        box: data?.box
          ? {
              width: data.width,
              fill: rgb(data.box.fillColor),
              stroke: rgb(data.box.strokeColor),
              strokeWidth: data.box.strokeWidth ?? null,
            }
          : null,
        children: (data?.children ?? []).map((c) => ({
          type: c.type,
          ...(c.box
            ? {
                x: c.x,
                y: c.y,
                width: c.width,
                fill: rgb(c.box.fillColor),
                stroke: rgb(c.box.strokeColor),
                strokeWidth: c.box.strokeWidth ?? null,
                radius: c.box.borderRadius ?? null,
              }
            : {}),
        })),
        raw: data ? Object.keys(data) : null,
      };
    });
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const toRgb = (color) => {
      if (!color) return null;
      const ctx = new OffscreenCanvas(1, 1).getContext("2d");
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      return Array.from(ctx.getImageData(0, 0, 1, 1).data);
    };
    const preview = [...(doc?.querySelectorAll(".react-aria-Radio") ?? [])].map((el) => {
      const ind = el.querySelector(".indicator");
      const css = ind ? getComputedStyle(ind) : undefined;
      return {
        selected: el.hasAttribute("data-selected"),
        width: css ? parseFloat(css.width) : null,
        borderWidth: css ? parseFloat(css.borderTopWidth) : null,
        borderColor: toRgb(css?.borderTopColor),
        background: toRgb(css?.backgroundColor),
      };
    });
    return { canvas, preview };
  });

const values = await read();
const canvasBox = await page.locator("canvas").first().boundingBox();
await page.screenshot({ path: `${OUT}/1-selected.png`, clip: canvasBox ?? undefined });
writeFileSync(`${OUT}/values.json`, JSON.stringify(values, null, 2));

const selectedPreview = values.preview.find((p) => p.selected);
record("L-1 Preview selected indicator", !!selectedPreview && selectedPreview.borderWidth > 2, selectedPreview ?? values.preview);

const selectedCanvasIndex = values.preview.findIndex((p) => p.selected);
const selectedCanvas = values.canvas[selectedCanvasIndex];
const circles = (selectedCanvas?.children ?? []).filter((c) => c.width !== undefined);
const near = (a, b, tol = 2) => a && b && a.slice(0, 3).every((v, i) => Math.abs(v - b[i]) <= tol);
const outer = circles[0];
const center = circles[1];
const expectCenter = selectedPreview ? selectedPreview.width - 2 * selectedPreview.borderWidth : null;
record(
  "L-2 Canvas selected = border-color circle + white center (Preview geometry)",
  !!outer &&
    !!center &&
    Math.abs(outer.width - selectedPreview.width) <= 0.5 &&
    near(outer.fill, selectedPreview.borderColor) &&
    Math.abs(center.width - expectCenter) <= 0.5 &&
    near(center.fill, selectedPreview.background),
  { canvas: selectedCanvas, expectCenter, preview: selectedPreview },
);
const unselected = values.canvas.find((_, i) => !values.preview[i]?.selected);
const unselectedCircles = (unselected?.children ?? []).filter((c) => c.width !== undefined);
record(
  "L-3 unselected keeps the thin ring",
  !!unselected && unselectedCircles.every((c) => !near(c.fill, [255, 255, 255]) || c.width === selectedPreview?.width),
  unselected,
);
record("L-4 no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

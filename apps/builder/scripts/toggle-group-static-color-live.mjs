// ToggleButtonGroup staticColor live (사용자 2026-10-09 「canvas 에 반영되게 수정해」) — real Builder
// (headed Chrome, Compare Mode): the palette's ToggleButtonGroup with `staticColor` white · black
// paints its ToggleButtons on the Canvas in the Preview's static scheme (box fill · border · label
// colour = the Preview button's computed background · border · color, ±2), and auto restores the
// default; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/toggle-group-static-color-live.mjs <out>
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
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const setStatic = (value) =>
  page.evaluate(
    async ({ commands, value }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const root = ws.root;
      const group = [...root.canvasInputs.values()].find(
        (r) => root.typeOf(r) === "ToggleButtonGroup",
      );
      try {
        ws.execute(
          c.setFields({
            targets: [ws.positionOfRecord(group.id).target],
            props: { staticColor: { kind: "set", value } },
          }),
        );
        await new Promise((r) => setTimeout(r, 900));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, value },
  );
const read = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const getSkiaNode = (id) =>
      window.__composition_SKIA_DEBUG__?.getSkiaNode?.(id);
    const rgb = (c) =>
      c
        ? Array.from(Object.values(c))
            .slice(0, 4)
            .map((v, i) => (i < 3 ? Math.round(v * 255) : +v.toFixed(2)))
        : null;
    const buttons = [...root.canvasInputs.values()].filter(
      (r) => root.typeOf(r) === "ToggleButton",
    );
    const canvas = buttons.map((button) => {
      const data = getSkiaNode(button.id);
      // (the label: the button's own text, or its Text child's)
      const text =
        data?.text ??
        (data?.children ?? []).find((child) => child.text)?.text ??
        (button.children
          .map((id) => getSkiaNode(id)?.text)
          .find(Boolean) ?? null);
      return {
        derived: button.derivedProps?.staticColor ?? null,
        fill: rgb(data?.box?.fillColor),
        stroke: rgb(data?.box?.strokeColor),
        text: rgb(text?.color),
      };
    });
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const toRgb = (color) => {
      if (!color) return null;
      const ctx = new OffscreenCanvas(1, 1).getContext("2d");
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 1, 1);
      const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
      // (alpha: the 4th component of `rgba(…)` or the one after `/`)
      const alpha =
        /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\)$/.exec(color)?.[1] ??
        /\/\s*([\d.]+)\)$/.exec(color)?.[1];
      return [r, g, b, alpha === undefined ? 1 : +(+alpha).toFixed(2)];
    };
    const preview = [
      ...(doc?.querySelectorAll(".react-aria-ToggleButton") ?? []),
    ].map((el) => {
      const css = getComputedStyle(el);
      return {
        staticColor: el.dataset.staticColor ?? null,
        fill: toRgb(css.backgroundColor),
        stroke: toRgb(css.borderTopColor),
        text: toRgb(css.color),
      };
    });
    return { canvas, preview };
  });
const near = (a, b, tol = 2) =>
  !!a &&
  !!b &&
  a.slice(0, 3).every((v, i) => Math.abs(v - b[i]) <= tol) &&
  Math.abs((a[3] ?? 1) - (b[3] ?? 1)) <= 0.02;

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ToggleButtonGroup static");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
await addFromPalette("toggle button group");
const compare = page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await page.waitForTimeout(3000);

const before = await read();
for (const value of ["white", "black"]) {
  const result = await setStatic(value);
  const s = await read();
  const same =
    s.canvas.length === 2 &&
    s.preview.length === 2 &&
    s.canvas.every(
      (c, i) =>
        c.derived === value &&
        s.preview[i].staticColor === value &&
        near(c.fill, s.preview[i].fill) &&
        near(c.stroke, s.preview[i].stroke) &&
        near(c.text, s.preview[i].text),
    );
  record(
    `${value}: Canvas ToggleButtons paint the Preview's static scheme (fill · border · label)`,
    result.ok && same && JSON.stringify(s.canvas) !== JSON.stringify(before.canvas),
    { result, canvas: s.canvas, preview: s.preview },
  );
  await page.screenshot({ path: `${OUT}/${value}.png` });
}
const result = await setStatic("auto");
const after = await read();
record(
  "auto: the default paint again (= before)",
  result.ok &&
    JSON.stringify(after.canvas) === JSON.stringify(before.canvas) &&
    after.canvas.every((c) => c.derived === null),
  { before: before.canvas, after: after.canvas },
);
record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

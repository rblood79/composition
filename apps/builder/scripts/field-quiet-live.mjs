// Live: a quiet Select · DateRangePicker (RSP `isQuiet`) — the box their own rule styles (the
// Select's trigger, the range picker's Group) is quiet in the Preview (computed: no fill, no side
// borders, square, a 1px bottom border) and on the Canvas (`catalogQuietOwnerPaint`: the same
// fill, corners and underline color). The real Builder (Compare Mode), headed Chrome, saved auth
// session; screenshots for the eye.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/field-quiet-live.mjs <out-dir>
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
const errors = [];
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 2000)}\n`,
  );
};
const page = await context.newPage();
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
}
const modules = {
  commands: `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`,
  canvas: `/@fs${REPO}/apps/builder/src/builder/catalogRuntime/canvasBinding.ts`,
};

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Field quiet live");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
await addFromPalette("select");
await addFromPalette("date range picker");
await page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first()
  .click();
await page.waitForTimeout(2000);

const setQuiet = (value) =>
  page.evaluate(
    async ([path, value]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const { setFields } = await import(/* @vite-ignore */ path);
      const records = ws.root.canvasInputs;
      for (const r of records.values())
        if (
          r.sourceId.startsWith("project:node:") &&
          records.get(r.parentId)?.sourceId === "project:node:home-body" &&
          ["Select", "DateRangePicker"].includes(ws.root.typeOf(r))
        )
          ws.execute(
            setFields({
              targets: [{ kind: "node", id: r.sourceId }],
              props: { isQuiet: { kind: "set", value } },
            }),
          );
    },
    [modules.commands, value],
  );
const read = () =>
  page.evaluate(async (path) => {
    const { catalogQuietOwnerPaint } = await import(/* @vite-ignore */ path);
    const handle = window.__COMPOSITION_CATALOG__;
    const ws = handle.workspace;
    const records = ws.root.canvasInputs;
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const out = {};
    for (const [field, boxType, selector] of [
      ["Select", "Button", ".react-aria-Select > .react-aria-Button"],
      ["DateRangePicker", "SelectTrigger", ".react-aria-DateRangePicker .react-aria-Group"],
    ]) {
      const owner = [...records.values()].find(
        (r) =>
          ws.root.typeOf(r) === field &&
          records.get(r.parentId)?.sourceId === "project:node:home-body",
      );
      const boxRecord = owner?.children
        .map((id) => records.get(id))
        .find((c) => ws.root.typeOf(c) === boxType);
      const rect = boxRecord && handle.canvas.boundsOf(boxRecord.id);
      const paint = boxRecord && rect && catalogQuietOwnerPaint(boxRecord, rect);
      const el = doc?.querySelector(selector);
      const cs = el && getComputedStyle(el);
      out[field] = {
        root: doc?.querySelector(`.react-aria-${field}`)?.getAttribute("data-quiet"),
        canvas: paint
          ? {
              fill: paint.visual.fill,
              radius: paint.visual.radius,
              borderWidth: paint.visual.borderWidth,
              underline: paint.underline,
            }
          : null,
        preview: cs
          ? {
              background: cs.backgroundColor,
              radius: cs.borderTopLeftRadius,
              top: cs.borderTopColor,
              left: cs.borderLeftColor,
              bottom: `${cs.borderBottomWidth} ${cs.borderBottomColor}`,
            }
          : null,
      };
    }
    return out;
  }, modules.canvas);
const hex = (rgb) => {
  const m = /rgba?\((\d+), (\d+), (\d+)/.exec(rgb ?? "");
  return m
    ? `#${[m[1], m[2], m[3]].map((v) => Number(v).toString(16).padStart(2, "0")).join("")}`
    : rgb;
};

if (process.env.PROBE_CSS) {
  await setQuiet(true);
  await page.waitForTimeout(1500);
  process.stdout.write(
    `css probe: ${JSON.stringify(
      await page.evaluate(() => {
        const doc = document.querySelector("#previewFrame")?.contentDocument;
        const el = doc?.querySelector(".react-aria-Select > .react-aria-Button");
        const hits = [];
        const visit = (rules, layer) => {
          for (const rule of rules) {
            if (rule.cssRules && !rule.selectorText)
              visit(rule.cssRules, rule.name ?? layer);
            else if (rule.selectorText && el?.matches(rule.selectorText)) {
              const bg = rule.style.getPropertyValue("background") || rule.style.getPropertyValue("background-color");
              if (bg) hits.push({ layer, selector: rule.selectorText.slice(0, 160), bg });
            }
          }
        };
        for (const sheet of doc?.styleSheets ?? [])
          try {
            visit(sheet.cssRules, undefined);
          } catch {}
        return { inline: el?.getAttribute("style"), hits };
      }),
    )}\n`,
  );
  await browser.close();
  process.exit(0);
}
const before = await read();
record(
  "rest",
  Object.values(before).every((f) => f.canvas === null && f.root !== "true"),
  before,
);
await setQuiet(true);
await page.waitForTimeout(1500);
const quiet = await read();
writeFileSync(`${OUT}/quiet.png`, await page.screenshot());
record(
  "quiet",
  Object.values(quiet).every(
    (f) =>
      f.root === "true" &&
      f.canvas &&
      f.preview &&
      f.canvas.fill === "transparent" &&
      f.canvas.radius === 0 &&
      f.canvas.borderWidth === 0 &&
      f.canvas.underline.height === 1 &&
      f.preview.background === "rgba(0, 0, 0, 0)" &&
      f.preview.radius === "0px" &&
      f.preview.top === "rgba(0, 0, 0, 0)" &&
      f.preview.left === "rgba(0, 0, 0, 0)" &&
      f.preview.bottom.startsWith("1px ") &&
      hex(f.preview.bottom.slice(4)) === f.canvas.underline.color.toLowerCase(),
  ),
  quiet,
);
await setQuiet(false);
await page.waitForTimeout(1500);
const after = await read();
record(
  "off",
  Object.values(after).every((f) => f.canvas === null && f.root !== "true"),
  after,
);
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
process.stdout.write(`errors: ${errors.length}\n${errors.join("\n")}\n`);
await browser.close();

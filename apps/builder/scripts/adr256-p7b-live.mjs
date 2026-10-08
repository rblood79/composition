// ADR-256 Phase 7b live — the Meter node tree in the real Builder with the Preview open (Compare
// Mode), headed Chrome: the palette's Meter is RAC's `Meter > Label + span.value {valueText} +
// div.bar > div.fill {width: percentage%}`; a value · range change reaches the bound parts on the
// Canvas and in the Preview at once; the variant repaints the fill; saved and reopened the same.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p7b-live.mjs <out>
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
  // (label: a RegExp source — the palette's item text)
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page
      .getByRole("button", { name: "Components", exact: true })
      .first()
      .click();
  await search.fill(label.replace(/[^a-z ].*$/i, "").trim());
  await page.waitForTimeout(300);
  await page
    .locator(".list-item", { hasText: new RegExp(`^${label}$`, "i") })
    .first()
    .click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
}
async function compareOn() {
  const button = page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first();
  if (await button.isVisible().catch(() => false)) await button.click();
  await page.waitForTimeout(3000);
}

const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const shortcuts = `/@fs${REPO}/apps/builder/src/builder/catalogRuntime/shortcuts.ts`;
async function newProject(name) {
  await page.goto(`${BASE}/dashboard`);
  await page
    .getByRole("button", { name: /new project/i })
    .first()
    .click();
  await page.waitForTimeout(300);
  await page.keyboard.type(name);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/builder\//, { timeout: 30000 });
  await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
  await page.waitForFunction(
    () => window.__COMPOSITION_CATALOG__?.workspace,
    null,
    { timeout: 30000 },
  );
}
const partId = (type, index = 0) =>
  page.evaluate(
    ({ type, index }) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      return [...ws.root.canvasInputs.values()].filter(
        (r) => ws.root.typeOf(r) === type,
      )[index]?.id;
    },
    { type, index },
  );
async function insertVia(partType, label, times) {
  const id = await partId(partType);
  await page.evaluate(
    (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
    id,
  );
  await page.waitForTimeout(600);
  if (
    !(await page
      .getByRole("button", { name: label, exact: true })
      .first()
      .isVisible()
      .catch(() => false))
  ) {
    await page
      .getByRole("button", { name: "Design", exact: true })
      .first()
      .click()
      .catch(() => {});
    await page.waitForTimeout(800);
  }
  for (let k = 0; k < times; k++) {
    await page
      .getByRole("button", { name: label, exact: true })
      .first()
      .click();
    await page.waitForTimeout(500);
    await page.evaluate(
      (id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]),
      id,
    );
    await page.waitForTimeout(400);
  }
}
/** Run a catalog command in the page: `build(commands, ws)` returns the command. */
async function run(build, arg) {
  return page.evaluate(
    async ({ commands, build, arg }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const at = (id) => ws.positionOfRecord(id).target;
      try {
        ws.execute(
          new Function(
            "c",
            "ws",
            "at",
            "arg",
            `return (${build})(c, ws, at, arg);`,
          )(c, ws, at, arg),
        );
        await new Promise((r) => setTimeout(r, 400));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, build: build.toString(), arg },
  );
}


await newProject("ADR-256 P7b meter");
await addFromPalette("meter");
await compareOn();
const probe = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const all = [...root.canvasInputs.values()];
    const of = (type) => all.find((r) => root.typeOf(r) === type);
    const bar = of("Meter");
    const value = of("MeterValue");
    const track = of("MeterTrack");
    const fill = of("MeterFill");
    const geo = root.getGeometry([track?.id, fill?.id].filter(Boolean));
    const box = (r) => {
      const g = r && geo.get(r.id);
      return g ? [g.x, g.y, g.width, g.height].map((n) => Math.round(n * 10) / 10) : null;
    };
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const el = (r) => r && doc?.querySelector(`[data-catalog-id="${CSS.escape(r.id)}"]`);
    const rect = (e) => {
      const b = e?.getBoundingClientRect();
      return b ? [b.width, b.height].map((n) => Math.round(n * 10) / 10) : null;
    };
    const domBar = el(bar);
    const domFill = el(fill);
    const tree = (e) =>
      e
        ? `<${e.tagName.toLowerCase()}${e.getAttribute("role") ? `[${e.getAttribute("role")}]` : ""}${e.className && typeof e.className === "string" ? "." + e.className.split(" ").join(".") : ""}>` +
          [...e.children].map(tree).join("") + "</>"
        : null;
    return {
      ids: { bar: bar?.id, fill: fill?.id },
      canvas: {
        valueText: value?.props.children,
        valueHidden: value?.hidden === true,
        fillWidth: fill?.visual.width ?? null,
        track: box(track),
        fill: box(fill),
      },
      dom: {
        tree: tree(domBar),
        valueText: el(value)?.textContent ?? null,
        indeterminate: domBar?.getAttribute("data-indeterminate") ?? null,
        valuenow: domBar?.getAttribute("aria-valuenow") ?? null,
        fillStyleWidth: domFill?.style.width ?? null,
        track: rect(el(track)),
        fill: rect(domFill),
        fillColor: domFill ? getComputedStyle(domFill).backgroundColor : null,
        fillAnimation: domFill ? getComputedStyle(domFill).animationName : null,
      },
    };
  });
const near = (a, b, tol = 1) => a && b && Math.abs(a - b) <= tol;
const s1 = await probe();
record(
  "L-1 the palette's Meter is RAC's node tree: [meter progressbar] > Label + span.value + div.bar > div.fill — 75% text and fill on both",
  s1.dom.tree?.startsWith("<div[meter progressbar].react-aria-Meter>") &&
    s1.dom.tree.includes("<span.value></><div.bar><div.fill></></>") &&
    s1.canvas.valueText === "75%" &&
    s1.dom.valueText === "75%" &&
    near(s1.canvas.fill?.[2], s1.canvas.track?.[2] * 0.75) &&
    near(s1.dom.fill?.[0], s1.dom.track?.[0] * 0.75) &&
    near(s1.canvas.track?.[3], s1.dom.track?.[1]),
  s1,
);
const barId = s1.ids.bar;
const sourceOf = await page.evaluate(
  (id) => window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.get(id)?.sourceId,
  barId,
);
const edit = (props) =>
  run(
    (c, ws, at, arg) =>
      c.setFields({
        targets: [{ kind: "node", id: arg.id }],
        props: Object.fromEntries(
          Object.entries(arg.props).map(([k, v]) => [k, { kind: "set", value: v }]),
        ),
      }),
    { id: sourceOf, props },
  );
const e2 = await edit({ value: 30, maxValue: 40 });
await page.waitForTimeout(800);
const s2 = await probe();
record(
  "L-2 value 30 of 40 reaches the bound parts at once: 75% → 75% (range place), then the text and fill follow",
  e2.ok &&
    s2.canvas.valueText === "75%" &&
    s2.dom.valueText === "75%" &&
    near(s2.dom.fill?.[0], s2.dom.track?.[0] * 0.75),
  { e2, s2 },
);
const e3 = await edit({ value: 10 });
await page.waitForTimeout(800);
const s3 = await probe();
record(
  "L-3 value 10 of 40: 25% text and fill on both (no reload)",
  e3.ok &&
    s3.canvas.valueText === "25%" &&
    s3.dom.valueText === "25%" &&
    near(s3.canvas.fill?.[2], s3.canvas.track?.[2] * 0.25) &&
    near(s3.dom.fill?.[0], s3.dom.track?.[0] * 0.25),
  { e3, s3 },
);
const e4 = await edit({ variant: "critical" });
await page.waitForTimeout(800);
const s4 = await probe();
record(
  "L-4 variant critical repaints the Preview fill (the sheet's --fill-color) and keeps the value",
  e4.ok && s4.dom.fillColor !== s3.dom.fillColor && s4.dom.valueText === "25%",
  { e4, s4, before: s3.dom.fillColor },
);
await page.screenshot({ path: `${OUT}/meter.png` });
await page.waitForTimeout(1500);
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await page.waitForTimeout(1500);
await compareOn();
const s5 = await probe();
record(
  "L-5 saved and reopened: the node tree and its bindings (25%) on both",
  s5.dom.tree === s1.dom.tree &&
    s5.canvas.valueText === "25%" &&
    s5.dom.valueText === "25%" &&
    s5.dom.fillColor === s4.dom.fillColor,
  s5,
);
record("L-6 no page errors", errors.length === 0, { errors });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

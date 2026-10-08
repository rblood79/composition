// ADR-256 Phase 7a live — the ProgressBar node tree in the real Builder with the Preview open
// (Compare Mode), headed Chrome: the palette's ProgressBar is RAC's `ProgressBar > Label +
// span.value {valueText} + div.bar > div.fill {width: percentage%}`; a value change reaches the
// bound parts on the Canvas and in the Preview at once; indeterminate · showValueLabel · variant;
// saved and reopened the same.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p7a-live.mjs <out>
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


await newProject("ADR-256 P7a progress");
await addFromPalette("progress ?bar");
await compareOn();
const probe = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const all = [...root.canvasInputs.values()];
    const of = (type) => all.find((r) => root.typeOf(r) === type);
    const bar = of("ProgressBar");
    const value = of("ProgressBarValue");
    const track = of("ProgressBarTrack");
    const fill = of("ProgressBarFill");
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
  "L-1 the palette's ProgressBar is RAC's node tree: [progressbar] > Label + span.value + div.bar > div.fill — value text 50%, fill 50% of the track on both",
  s1.dom.tree?.startsWith("<div[progressbar].react-aria-ProgressBar>") &&
    s1.dom.tree.includes("<span.value></><div.bar><div.fill></></>") &&
    s1.canvas.valueText === "50%" &&
    s1.dom.valueText === "50%" &&
    s1.dom.fillStyleWidth === "50%" &&
    near(s1.canvas.fill?.[2], s1.canvas.track?.[2] * 0.5) &&
    near(s1.dom.fill?.[0], s1.dom.track?.[0] * 0.5) &&
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
const e2 = await edit({ value: 80 });
await page.waitForTimeout(800);
const s2 = await probe();
record(
  "L-2 value 80 reaches the bound parts at once (no reload): text 80%, fill 80% on Canvas and Preview",
  e2.ok &&
    s2.canvas.valueText === "80%" &&
    s2.dom.valueText === "80%" &&
    s2.dom.valuenow === "80" &&
    near(s2.canvas.fill?.[2], s2.canvas.track?.[2] * 0.8) &&
    near(s2.dom.fill?.[0], s2.dom.track?.[0] * 0.8),
  { e2, s2 },
);
const e3 = await edit({ isIndeterminate: true });
await page.waitForTimeout(800);
const s3 = await probe();
record(
  "L-3 indeterminate: no value text on both, the Preview fill moves (sheet animation, no inline width), the Canvas still bar at 20%–50%",
  e3.ok &&
    s3.dom.indeterminate === "true" &&
    s3.dom.valueText === "" &&
    s3.canvas.valueText === "" &&
    s3.dom.fillStyleWidth === "" &&
    s3.dom.fillAnimation !== "none" &&
    near(s3.canvas.fill?.[0] - s3.canvas.track?.[0], s3.canvas.track?.[2] * 0.2) &&
    near(s3.canvas.fill?.[2], s3.canvas.track?.[2] * 0.3),
  { e3, s3 },
);
const e4 = await edit({ isIndeterminate: false, showValueLabel: false, variant: "neutral" });
await page.waitForTimeout(800);
const s4 = await probe();
record(
  "L-4 showValueLabel false hides the value text on both; variant neutral repaints the Preview fill",
  e4.ok &&
    s4.canvas.valueHidden &&
    s4.dom.valueText === null &&
    s4.dom.fillColor !== s2.dom.fillColor &&
    near(s4.canvas.fill?.[2], s4.canvas.track?.[2] * 0.8),
  { e4, s4, before: s2.dom.fillColor },
);
await page.screenshot({ path: `${OUT}/progress.png` });
await edit({ showValueLabel: true, value: 35 });
await page.waitForTimeout(1500);
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await page.waitForTimeout(1500);
await compareOn();
const s5 = await probe();
record(
  "L-5 saved and reopened: the node tree and its bindings (value 35 → text 35%, fill 35%) on both",
  s5.dom.tree === s1.dom.tree &&
    s5.canvas.valueText === "35%" &&
    s5.dom.valueText === "35%" &&
    near(s5.canvas.fill?.[2], s5.canvas.track?.[2] * 0.35),
  s5,
);
record("L-6 no page errors", errors.length === 0, { errors });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

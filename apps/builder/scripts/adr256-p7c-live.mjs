// ADR-256 Phase 7c live — the Slider node tree in the real Builder with the Preview open (Compare
// Mode), headed Chrome: the palette's Slider is RAC's `Slider > Label + SliderOutput + SliderTrack >
// SliderFill + SliderThumb`; RAC places the fill and the thumb and writes the output; the Canvas the
// same from the record; a value change reaches both; the Preview thumb moves by keyboard (RAC);
// showValueLabel; saved and reopened the same.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p7c-live.mjs <out>
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


await newProject("ADR-256 P7c slider");
await addFromPalette("slider");
await compareOn();
const probe = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const all = [...root.canvasInputs.values()];
    const of = (type) => all.find((r) => root.typeOf(r) === type);
    const slider = of("Slider");
    const output = of("SliderOutput");
    const track = of("SliderTrack");
    const fill = of("SliderFill");
    const thumb = of("SliderThumb");
    const geo = root.getGeometry([track?.id, fill?.id, thumb?.id].filter(Boolean));
    const box = (r) => {
      const g = r && geo.get(r.id);
      return g ? [g.x, g.y, g.width, g.height].map((n) => Math.round(n * 10) / 10) : null;
    };
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const el = (r) => r && doc?.querySelector(`[data-catalog-id="${CSS.escape(r.id)}"]`);
    const rect = (e) => {
      const b = e?.getBoundingClientRect();
      return b ? [b.x, b.y, b.width, b.height].map((n) => Math.round(n * 10) / 10) : null;
    };
    const tree = (e) =>
      e
        ? `<${e.tagName.toLowerCase()}.${String(e.className).split(" ")[0]}>` +
          [...e.children].map(tree).join("") + "</>"
        : null;
    return {
      ids: { slider: slider?.id, thumb: thumb?.id },
      canvas: {
        output: output?.props.children,
        outputHidden: output?.hidden === true,
        track: box(track),
        fill: box(fill),
        thumb: box(thumb),
      },
      dom: {
        tree: tree(el(slider)),
        output: el(output)?.textContent ?? null,
        track: rect(el(track)),
        fill: rect(el(fill)),
        thumb: rect(el(thumb)),
        trackColor: el(track) ? getComputedStyle(el(track)).backgroundColor : null,
        fillColor: el(fill) ? getComputedStyle(el(fill)).backgroundColor : null,
        thumbBorder: el(thumb) ? getComputedStyle(el(thumb)).borderTopWidth : null,
      },
    };
  });
const near = (a, b, tol = 1) => a != null && b != null && Math.abs(a - b) <= tol;
const ratio = (s, part, track) => s[part]?.[2] / s[track]?.[2];
const thumbAt = (s) => (s.thumb[0] + s.thumb[2] / 2 - s.track[0]) / s.track[2];
const s1 = await probe();
record(
  "L-1 the palette's Slider is RAC's node tree: Label + SliderOutput + SliderTrack > SliderFill + SliderThumb — output 50, fill · thumb at 50% on both",
  s1.dom.tree?.includes("<div.react-aria-SliderTrack><div.react-aria-SliderFill></><div.react-aria-SliderThumb>") &&
    s1.dom.tree.includes("<output.react-aria-SliderOutput></>") &&
    s1.canvas.output === "50" &&
    s1.dom.output === "50" &&
    near(ratio(s1.canvas, "fill", "track"), 0.5, 0.01) &&
    near(ratio(s1.dom, "fill", "track"), 0.5, 0.01) &&
    near(thumbAt(s1.canvas), 0.5, 0.01) &&
    near(thumbAt(s1.dom), 0.5, 0.01) &&
    s1.dom.thumbBorder === "2px",
  s1,
);
const sourceOf = await page.evaluate(
  (id) => window.__COMPOSITION_CATALOG__.workspace.root.canvasInputs.get(id)?.sourceId,
  s1.ids.slider,
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
const e2 = await edit({ value: 20 });
await page.waitForTimeout(800);
const s2 = await probe();
record(
  "L-2 value 20 reaches RAC's parts and the Canvas at once: output 20, fill · thumb at 20%",
  e2.ok &&
    s2.canvas.output === "20" &&
    s2.dom.output === "20" &&
    near(ratio(s2.canvas, "fill", "track"), 0.2, 0.01) &&
    near(ratio(s2.dom, "fill", "track"), 0.2, 0.01) &&
    near(thumbAt(s2.canvas), 0.2, 0.01) &&
    near(thumbAt(s2.dom), 0.2, 0.01),
  { e2, s2 },
);
// The Preview thumb moves by keyboard (RAC's slider): its output and fill follow RAC's state.
const moved = await page.evaluate((id) => {
  const doc = document.querySelector("#previewFrame")?.contentDocument;
  const input = doc?.querySelector(`[data-catalog-id="${CSS.escape(id)}"] input`);
  input?.focus();
  return !!input;
}, s1.ids.thumb);
for (let k = 0; k < 5; k++) {
  await page.evaluate((id) => {
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const input = doc?.querySelector(`[data-catalog-id="${CSS.escape(id)}"] input`);
    input?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    input?.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true }));
  }, s1.ids.thumb);
  await page.waitForTimeout(80);
}
await page.waitForTimeout(400);
const s3 = await probe();
record(
  "L-3 in the Preview the thumb moves by keyboard (RAC): output 25, fill 25% — the document stays 20",
  moved && s3.dom.output === "25" && near(ratio(s3.dom, "fill", "track"), 0.25, 0.01) && s3.canvas.output === "20",
  { moved, s3 },
);
const e4 = await edit({ showValueLabel: false });
await page.waitForTimeout(800);
const s4 = await probe();
record(
  "L-4 showValueLabel false hides the output on both",
  e4.ok && s4.canvas.outputHidden && s4.dom.output === null,
  { e4, s4 },
);
await page.screenshot({ path: `${OUT}/slider.png` });
await edit({ showValueLabel: true, value: 65 });
await page.waitForTimeout(1500);
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await page.waitForTimeout(1500);
await compareOn();
const s5 = await probe();
record(
  "L-5 saved and reopened: the node tree, output 65, fill · thumb at 65% on both",
  s5.dom.tree === s1.dom.tree &&
    s5.canvas.output === "65" &&
    s5.dom.output === "65" &&
    near(ratio(s5.canvas, "fill", "track"), 0.65, 0.01) &&
    near(thumbAt(s5.dom), 0.65, 0.01),
  s5,
);
record("L-6 no page errors", errors.length === 0, { errors });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

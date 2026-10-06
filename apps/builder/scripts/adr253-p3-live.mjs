// ADR-253 Phase 3 live (G3 — Label): the real Builder + Preview (Compare Mode), headed Chrome,
// saved auth session → /dashboard. Every field · group Label is an instance of the Label origin:
// its font is the Label rule's at the field's size, and editing the origin on the Components page
// changes all of them on the Canvas and in the Preview together.
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const AUTH =
  process.env.AUTH_SESSION ?? `${REPO}/apps/builder/scripts/.auth-session.json`;
const state = JSON.parse(readFileSync(AUTH, "utf8"));
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
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1800)}\n`,
  );
};
const page = await context.newPage();
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
const step = async (id, run) => {
  try {
    await run();
  } catch (error) {
    record(id, false, { threw: String(error?.message ?? error).slice(0, 800) });
    writeFileSync(`${OUT}/${id}-error.png`, await page.screenshot());
  }
};
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
  await page.waitForTimeout(700);
}
const LABEL = "lib:definition:origin-component-label";
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
// The palette's own entries (their labels), placed by clicking them.
const PALETTE = [
  "text field",
  "text area",
  "number field",
  "search field",
  "color field",
  "select",
  "combo box",
  "date field",
  "time field",
  "date picker",
  "date range picker",
  "checkbox group",
  "radio group",
  "meter",
  "progress bar",
  "slider",
  "tag group",
];
const TYPES = [
  "TextField",
  "TextArea",
  "NumberField",
  "SearchField",
  "ColorField",
  "Select",
  "ComboBox",
  "DateField",
  "TimeField",
  "DatePicker",
  "DateRangePicker",
  "CheckboxGroup",
  "RadioGroup",
  "Meter",
  "ProgressBar",
  "Slider",
  "TagGroup",
];
/** Every placed field's Label: its Canvas record · geometry and the Preview's element. */
const snap = () =>
  page.evaluate((types) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const g = ws.runtime.graph;
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const round = (v) => Math.round(v * 10) / 10;
    const out = {};
    for (const field of ws.root.canvasInputs.values()) {
      const type = g.getDefinition(field.definitionId)?.name;
      if (!types.includes(type) || !field.sourceId.startsWith("project:"))
        continue;
      const label = field.children
        .map((id) => ws.root.canvasInputs.get(id))
        .find((r) => r?.definitionId === "lib:definition:type-Label");
      if (!label) {
        out[type] = { missing: "canvas label" };
        continue;
      }
      const rect = ws.root.getGeometry([label.id]).get(label.id);
      const el = doc?.querySelector(
        `[data-catalog-id="${CSS.escape(label.id)}"]`,
      );
      const cs = el && doc.defaultView.getComputedStyle(el);
      const box = el?.getBoundingClientRect();
      out[type] = {
        c: {
          size: label.props.size,
          color: label.visual.color,
          weight: label.visual.fontWeight,
          font: label.visual.fontSize,
          line: round(label.visual.lineHeight * label.visual.fontSize),
          collapsed: label.collapsedSourceIds?.[0]?.split(":").pop(),
          w: rect && round(rect.width),
          h: rect && round(rect.height),
        },
        p: el
          ? {
              tag: el.tagName,
              color: cs.color,
              weight: Number(cs.fontWeight),
              font: parseFloat(cs.fontSize),
              line: round(parseFloat(cs.lineHeight)),
              w: round(box.width),
              h: round(box.height),
            }
          : null,
      };
    }
    return {
      fields: out,
      visibility: document.visibilityState,
      dpr: devicePixelRatio,
    };
  }, TYPES);
/** Fields whose Canvas Label and Preview Label differ (font · weight · line · box > 1px). */
const mismatches = (shot, expect = {}) =>
  TYPES.flatMap((type) => {
    const f = shot.fields[type];
    if (!f) return [`${type}: not placed`];
    if (!f.c || !f.p) return [`${type}: ${JSON.stringify(f)}`];
    const bad = [];
    if (f.c.collapsed !== "component-label") bad.push("not the origin");
    if (f.c.weight !== f.p.weight)
      bad.push(`weight ${f.c.weight}/${f.p.weight}`);
    if (f.c.font !== f.p.font) bad.push(`font ${f.c.font}/${f.p.font}`);
    if (Math.abs(f.c.line - f.p.line) > 0.5)
      bad.push(`line ${f.c.line}/${f.p.line}`);
    if (Math.abs(f.c.w - f.p.w) > 1) bad.push(`w ${f.c.w}/${f.p.w}`);
    if (Math.abs(f.c.h - f.p.h) > 1) bad.push(`h ${f.c.h}/${f.p.h}`);
    for (const [key, value] of Object.entries(expect))
      if (f.c[key] !== value) bad.push(`${key} ${f.c[key]} ≠ ${value}`);
    return bad.length ? [`${type}: ${bad.join(" · ")}`] : [];
  });
const continueImpact = async () => {
  const impact = page.getByRole("button", { name: "Continue", exact: true });
  const asked =
    (await impact.count()) > 0
      ? await page
          .getByText(/will affect/)
          .first()
          .textContent()
      : null;
  if (asked) await impact.first().click();
  await page.waitForTimeout(500);
  return asked;
};

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-253 P3 live");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);

let before;
await step("setup", async () => {
  const placed = [];
  for (const label of PALETTE)
    try {
      await addFromPalette(label);
      placed.push(label);
      // Deselect: the next palette click adds to the page, not into the selection.
      await page.evaluate(() =>
        window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
      );
    } catch (error) {
      placed.push(`${label}: ${String(error?.message ?? error).slice(0, 80)}`);
    }
  await page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first()
    .click();
  await page.waitForTimeout(3000);
  before = await snap();
  writeFileSync(`${OUT}/1-before.png`, await page.screenshot());
  const bad = mismatches(before, { weight: 500, size: "md", font: 14 });
  record("setup", bad.length === 0, {
    bad,
    placed: placed.length,
    visibility: before.visibility,
    dpr: before.dpr,
    sample: before.fields.Select,
  });
});
await step("size-xl", async () => {
  // Each field at its largest size: its Label takes the Label rule's font at that size.
  const sized = await page.evaluate(
    async ([path, types]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const g = ws.runtime.graph;
      const { setFields } = await import(/* @vite-ignore */ path);
      const done = {};
      for (const field of [...ws.root.canvasInputs.values()]) {
        const type = g.getDefinition(field.definitionId)?.name;
        if (!types.includes(type) || !field.sourceId.startsWith("project:"))
          continue;
        for (const size of ["xl", "lg"])
          try {
            ws.execute(
              setFields({
                targets: [{ kind: "node", id: field.sourceId }],
                props: { size: { kind: "set", value: size } },
              }),
            );
            done[type] = size;
            break;
          } catch {
            /* the field does not offer this size */
          }
      }
      return done;
    },
    [commands, TYPES],
  );
  await page.waitForTimeout(2500);
  const shot = await snap();
  writeFileSync(`${OUT}/2-size.png`, await page.screenshot());
  const bad = mismatches(shot);
  for (const [type, size] of Object.entries(sized)) {
    const c = shot.fields[type]?.c;
    const want = size === "xl" ? [18, 28] : [16, 24];
    if (c && (c.size !== size || c.font !== want[0] || c.line !== want[1]))
      bad.push(`${type}: ${size} → ${c.size} ${c.font}/${c.line}`);
  }
  record("size-xl", bad.length === 0, {
    bad,
    sized,
    sample: shot.fields.Select,
  });
});
await step("edit-label-origin", async () => {
  await page.evaluate(
    (id) => window.__COMPOSITION_CATALOG__.workspace.showDefinition(id),
    LABEL,
  );
  await page.waitForTimeout(1500);
  const wrote = await page.evaluate(
    async ([path, id]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const { setFields } = await import(/* @vite-ignore */ path);
      const sample = ws.session.getSnapshot().selection[0];
      const record = ws.root.canvasInputs.get(sample.identity);
      ws.execute(
        setFields({
          targets: [{ kind: "node", id: record.sourceId }],
          visual: {
            color: { kind: "set", value: "#ff0000" },
            fontWeight: { kind: "set", value: 800 },
          },
        }),
      );
      const g = ws.runtime.graph;
      return {
        sampleType: g.getDefinition(record.definitionId)?.name,
        overrides: g
          .getEntry(g.projectId)
          .overrideIds.map((o) => g.getEntry(o).targetId),
      };
    },
    [commands, LABEL],
  );
  const asked = await continueImpact();
  writeFileSync(`${OUT}/3-origin-edited.png`, await page.screenshot());
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.showDefinition(undefined),
  );
  await page.waitForTimeout(3000);
  const shot = await snap();
  writeFileSync(`${OUT}/4-after.png`, await page.screenshot());
  const bad = mismatches(shot, { color: "#ff0000", weight: 800 });
  for (const type of TYPES)
    if (shot.fields[type]?.p?.color !== "rgb(255, 0, 0)")
      bad.push(`${type}: preview color ${shot.fields[type]?.p?.color}`);
  record(
    "edit-label-origin",
    wrote.sampleType === "Label" && bad.length === 0,
    { asked, bad, sample: shot.fields.DatePicker },
  );
});
await step("own-style-and-undo", async () => {
  // One field's Label written on its own (the Styles panel's target): it alone changes.
  const target = await page.evaluate(async (path) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const g = ws.runtime.graph;
    const { setFields } = await import(/* @vite-ignore */ path);
    const field = [...ws.root.canvasInputs.values()].find(
      (r) =>
        g.getDefinition(r.definitionId)?.name === "Select" &&
        r.sourceId.startsWith("project:"),
    );
    const label = field.children
      .map((id) => ws.root.canvasInputs.get(id))
      .find((r) => r.definitionId === "lib:definition:type-Label");
    ws.execute(
      setFields({
        targets: [ws.itemOfRecord(label.id).target],
        visual: { color: { kind: "set", value: "#00aa00" } },
      }),
    );
    return label.id;
  }, commands);
  await page.waitForTimeout(2000);
  const own = await snap();
  writeFileSync(`${OUT}/5-own-style.png`, await page.screenshot());
  const ownOk =
    own.fields.Select.c.color === "#00aa00" &&
    own.fields.Select.p.color === "rgb(0, 170, 0)" &&
    own.fields.ComboBox.c.color === "#ff0000" &&
    own.fields.ComboBox.p.color === "rgb(255, 0, 0)";
  let undone;
  for (let i = 0; i < 40; i++) {
    await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());
    await page.waitForTimeout(150);
    undone = await snap();
    if (
      undone.fields.TextField?.c.weight === 500 &&
      undone.fields.TextField?.c.size === "md"
    )
      break;
  }
  await page.waitForTimeout(2000);
  undone = await snap();
  const bad = mismatches(undone, { weight: 500, size: "md" });
  record("own-style-and-undo", ownOk && bad.length === 0, {
    target: target.split("::").pop(),
    own: { select: own.fields.Select, combo: own.fields.ComboBox.p },
    bad,
  });
});
record("errors", errors.length === 0, {
  count: errors.length,
  errors: errors.slice(0, 10),
});
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ base: BASE, results, errors }, null, 2),
);
await browser.close();
process.exit(0);

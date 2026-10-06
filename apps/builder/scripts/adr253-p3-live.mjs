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
const HINT_TYPES = TYPES.filter(
  (type) => !["Meter", "ProgressBar", "Slider", "TagGroup"].includes(type),
);
/**
 * Every hint field's visible parts (Label · Description · FieldError): the Canvas box relative to
 * the field and the Preview element's box relative to the field's element, with their fonts.
 */
const snapParts = () =>
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
      const fieldEl = doc?.querySelector(
        `[data-catalog-id="${CSS.escape(field.id)}"]`,
      );
      const fieldBox = fieldEl?.getBoundingClientRect();
      const fieldRect = ws.root.getGeometry([field.id]).get(field.id);
      const parts = {};
      for (const id of field.children) {
        const record = ws.root.canvasInputs.get(id);
        const name = g.getDefinition(record.definitionId)?.name;
        if (!["Label", "Description", "FieldError"].includes(name)) continue;
        const rect = ws.root.getGeometry([id]).get(id);
        const el = doc?.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
        const cs = el && doc.defaultView.getComputedStyle(el);
        const box = el?.getBoundingClientRect();
        parts[name] = {
          hidden: record.hidden === true,
          text: record.props.children,
          c: rect && {
            x: round(rect.x),
            y: round(rect.y),
            w: round(rect.width),
            h: round(rect.height),
            font: record.visual.fontSize,
            line: round(record.visual.lineHeight * record.visual.fontSize),
            color: record.visual.color,
          },
          p: el
            ? {
                x: round(box.x - fieldBox.x),
                y: round(box.y - fieldBox.y),
                w: round(box.width),
                h: round(box.height),
                font: parseFloat(cs.fontSize),
                line: round(parseFloat(cs.lineHeight)),
                color: cs.color,
                text: el.textContent,
              }
            : null,
        };
      }
      out[type] = {
        field: {
          c: fieldRect && {
            w: round(fieldRect.width),
            h: round(fieldRect.height),
          },
          p: fieldBox && {
            w: round(fieldBox.width),
            h: round(fieldBox.height),
          },
        },
        parts,
      };
    }
    return out;
  }, HINT_TYPES);
/** Parts the Canvas and the Preview draw differently (presence · font · box > 1px). */
const partMismatches = (shot, shown) =>
  HINT_TYPES.flatMap((type) => {
    const f = shot[type];
    if (!f) return [`${type}: not placed`];
    const bad = [];
    if (Math.abs(f.field.c.h - f.field.p.h) > 1)
      bad.push(`field h ${f.field.c.h}/${f.field.p.h}`);
    for (const name of ["Label", "Description", "FieldError"]) {
      const part = f.parts[name];
      if (!part) {
        bad.push(`${name}: no node`);
        continue;
      }
      const visible = name === "Label" || shown;
      if (part.hidden === visible) bad.push(`${name}: hidden=${part.hidden}`);
      if (!!part.p !== visible) bad.push(`${name}: dom=${!!part.p}`);
      if (!visible || !part.p || !part.c) continue;
      for (const key of ["x", "y", "w", "h"])
        if (Math.abs(part.c[key] - part.p[key]) > 1)
          bad.push(`${name}.${key} ${part.c[key]}/${part.p[key]}`);
      if (part.c.font !== part.p.font)
        bad.push(`${name}.font ${part.c.font}/${part.p.font}`);
      if (Math.abs(part.c.line - part.p.line) > 0.5)
        bad.push(`${name}.line ${part.c.line}/${part.p.line}`);
    }
    return bad.length ? [`${type}: ${bad.join(" · ")}`] : [];
  });
const writeFields = (types, props) =>
  page.evaluate(
    async ([path, types, props]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const g = ws.runtime.graph;
      const { setFields } = await import(/* @vite-ignore */ path);
      const failed = [];
      for (const field of [...ws.root.canvasInputs.values()]) {
        const type = g.getDefinition(field.definitionId)?.name;
        if (!types.includes(type) || !field.sourceId.startsWith("project:"))
          continue;
        for (const [key, value] of Object.entries(props))
          try {
            ws.execute(
              setFields({
                targets: [{ kind: "node", id: field.sourceId }],
                props: { [key]: { kind: "set", value } },
              }),
            );
          } catch (error) {
            failed.push(`${type}.${key}: ${String(error).slice(0, 60)}`);
          }
      }
      return failed;
    },
    [commands, types, props],
  );
await step("hints-rest", async () => {
  // At rest no field shows a Description or a FieldError, on either side.
  const shot = await snapParts();
  const bad = partMismatches(shot, false);
  record("hints-rest", bad.length === 0, { bad, sample: shot.TextField });
});
await step("hints-top", async () => {
  const failed = await writeFields(HINT_TYPES, {
    description: "Help text",
    isInvalid: true,
    errorMessage: "Not valid",
  });
  await page.waitForTimeout(3000);
  const shot = await snapParts();
  writeFileSync(`${OUT}/1b-hints-top.png`, await page.screenshot());
  const bad = partMismatches(shot, true);
  record("hints-top", bad.length === 0 && failed.length === 0, {
    bad,
    failed,
    sample: shot.Select,
  });
});
await step("hints-side", async () => {
  const failed = await writeFields(HINT_TYPES, { labelPosition: "side" });
  await page.waitForTimeout(3000);
  const shot = await snapParts();
  writeFileSync(`${OUT}/1c-hints-side.png`, await page.screenshot());
  const bad = partMismatches(shot, true);
  record("hints-side", bad.length === 0 && failed.length === 0, {
    bad,
    failed,
    sample: shot.TextField,
  });
  await writeFields(HINT_TYPES, { labelPosition: "top" });
  await page.waitForTimeout(1500);
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
  bad.push(...partMismatches(await snapParts(), true));
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
await step("dynamic-validation", async () => {
  // RAC's own validation (the Preview's run state): a required email TextField with no authored
  // message shows the browser's message after the value is committed, described to the input,
  // and drops it once the value is valid. With an authored `errorMessage` that text shows.
  await writeFields(["TextField"], {
    isRequired: true,
    type: "email",
    isInvalid: false,
    errorMessage: "",
    description: "",
  });
  await page.waitForTimeout(1500);
  const frame = page.frameLocator("#previewFrame");
  const input = frame.locator(".react-aria-TextField input").first();
  const read = () =>
    page.evaluate(() => {
      const doc = document.querySelector("#previewFrame").contentDocument;
      const field = doc.querySelector(".react-aria-TextField");
      const input = field.querySelector("input");
      const error = field.querySelector(".react-aria-FieldError");
      const described = (input.getAttribute("aria-describedby") ?? "")
        .split(" ")
        .filter(Boolean);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const record = error
        ? ws.root.canvasInputs.get(error.getAttribute("data-catalog-id"))
        : undefined;
      return {
        value: input.value,
        invalid: input.getAttribute("aria-invalid"),
        error: error?.textContent ?? null,
        errorIsNode: !!record,
        describedByError: !!error && described.includes(error.id),
        danglingDescribedBy: described.filter((id) => !doc.getElementById(id)),
      };
    });
  await input.focus();
  await page.keyboard.type("abc");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(600);
  const wrong = await read();
  await input.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.type("a@b.co");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(600);
  const fixed = await read();
  await input.focus();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(600);
  const empty = await read();
  writeFileSync(`${OUT}/6-validation.png`, await page.screenshot());
  // The authored message, while the document says the field is invalid.
  await writeFields(["TextField"], {
    isInvalid: true,
    errorMessage: "Not valid",
  });
  await page.waitForTimeout(1500);
  const authored = await read();
  record(
    "dynamic-validation",
    !!wrong.error &&
      wrong.errorIsNode &&
      wrong.describedByError &&
      wrong.danglingDescribedBy.length === 0 &&
      fixed.error === null &&
      !!empty.error &&
      empty.describedByError &&
      authored.error === "Not valid" &&
      authored.describedByError,
    { wrong, fixed, empty, authored },
  );
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

// ADR-253 Phase 3 (3) live — Input: the real Builder + Preview (Compare Mode), headed Chrome,
// saved auth session → /dashboard. The control of TextField · TextArea · ColorField is an instance
// of the Input origin: its box is the Input rule's at the field's size on the Canvas and in the
// Preview (the rule's own sheet), its states are that sheet's, and editing the origin on the
// Components page changes all three together.
//
// The same script runs against the build before this step (BUILDER_URL=http://localhost:5173):
// the Preview control is found through its field's element there, so the resting computed styles
// of the two builds can be compared (`results.json` → `preview`).
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
const preview = {};
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 2200)}\n`,
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
const INPUT = "lib:definition:origin-component-input";
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
// The fields whose control is the Input node, and three whose control is still a trigger wrapper
// (their look must not move with this step).
const PALETTE = [
  "text field",
  "text area",
  "color field",
  "combo box",
  "number field",
  "search field",
];
const TYPES = ["TextField", "TextArea", "ColorField"];
const OTHERS = ["ComboBox", "NumberField", "SearchField"];

/**
 * Each placed field's control: the Canvas record · box of its Input node and the Preview
 * element's computed style · box (relative to the field).
 */
const snap = () =>
  page.evaluate(
    ([types, others]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const g = ws.runtime.graph;
      const doc = document.querySelector("#previewFrame")?.contentDocument;
      const round = (v) => Math.round(v * 10) / 10;
      const out = {};
      const style = (el) => {
        const cs = doc.defaultView.getComputedStyle(el);
        return {
          padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
          font: parseFloat(cs.fontSize),
          line: round(parseFloat(cs.lineHeight)),
          border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
          radius: cs.borderTopLeftRadius,
          background: cs.backgroundColor,
          color: cs.color,
          outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor} ${cs.outlineOffset}`,
          opacity: cs.opacity,
          display: cs.display,
          family: cs.fontFamily.split(",")[0],
        };
      };
      for (const field of ws.root.canvasInputs.values()) {
        const type = g.getDefinition(field.definitionId)?.name;
        if (
          ![...types, ...others].includes(type) ||
          !field.sourceId.startsWith("project:")
        )
          continue;
        const fieldEl = doc?.querySelector(
          `[data-catalog-id="${CSS.escape(field.id)}"]`,
        );
        const fieldBox = fieldEl?.getBoundingClientRect();
        const fieldRect = ws.root.getGeometry([field.id]).get(field.id);
        const el = fieldEl?.querySelector("input:not([hidden]), textarea");
        const box = el?.getBoundingClientRect();
        const node = field.children
          .map((id) => ws.root.canvasInputs.get(id))
          .find((r) => r?.ruleId === "Input");
        const rect = node && ws.root.getGeometry([node.id]).get(node.id);
        out[type] = {
          field: {
            c: fieldRect && round(fieldRect.height),
            p: fieldBox && round(fieldBox.height),
            rootOpacity:
              fieldEl && doc.defaultView.getComputedStyle(fieldEl).opacity,
          },
          c: node &&
            rect && {
              size: node.props.size,
              collapsed: node.collapsedSourceIds?.[0]?.split(":").pop(),
              padding: `${node.visual.paddingY}px ${node.visual.paddingX}px`,
              font: node.visual.fontSize,
              line: round(node.visual.lineHeight * node.visual.fontSize),
              radius: node.visual.radius,
              borderWidth: node.visual.borderWidth,
              borderColor: node.visual.borderColor,
              fill: node.visual.fill,
              x: round(rect.x),
              y: round(rect.y),
              w: round(rect.width),
              h: round(rect.height),
            },
          p: el
            ? {
                tag: el.tagName,
                isNode: el.getAttribute("data-catalog-id") === node?.id,
                size: el.getAttribute("data-size"),
                placeholder: el.getAttribute("placeholder"),
                labelled:
                  !!el.id &&
                  !!fieldEl.querySelector(`label[for="${CSS.escape(el.id)}"]`),
                x: round(box.x - fieldBox.x),
                y: round(box.y - fieldBox.y),
                w: round(box.width),
                h: round(box.height),
                ...style(el),
              }
            : null,
        };
      }
      return {
        fields: out,
        visibility: document.visibilityState,
        dpr: devicePixelRatio,
      };
    },
    [TYPES, OTHERS],
  );
/** Fields whose Canvas Input and Preview control differ (box > 1px · font · padding · radius). */
const mismatches = (shot) =>
  TYPES.flatMap((type) => {
    const f = shot.fields[type];
    if (!f) return [`${type}: not placed`];
    if (!f.c || !f.p) return [`${type}: ${JSON.stringify(f).slice(0, 200)}`];
    const bad = [];
    if (f.c.collapsed !== "component-input") bad.push("not the origin");
    if (!f.p.isNode) bad.push("the element is not the node");
    if (f.p.size !== f.c.size) bad.push(`data-size ${f.p.size}/${f.c.size}`);
    for (const key of ["x", "y", "w", "h"])
      if (Math.abs(f.c[key] - f.p[key]) > 1)
        bad.push(`${key} ${f.c[key]}/${f.p[key]}`);
    if (Math.abs(f.field.c - f.field.p) > 1)
      bad.push(`field h ${f.field.c}/${f.field.p}`);
    if (f.c.font !== f.p.font) bad.push(`font ${f.c.font}/${f.p.font}`);
    if (Math.abs(f.c.line - f.p.line) > 0.5)
      bad.push(`line ${f.c.line}/${f.p.line}`);
    const [py, px] = f.c.padding.split(" ");
    if (f.p.padding !== `${py} ${px} ${py} ${px}`)
      bad.push(`padding ${f.c.padding}/${f.p.padding}`);
    if (`${f.c.radius}px` !== f.p.radius)
      bad.push(`radius ${f.c.radius}/${f.p.radius}`);
    if (`${f.c.borderWidth}px` !== f.p.border.split(" ")[0])
      bad.push(`border ${f.c.borderWidth}/${f.p.border}`);
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
/** The Preview control of a field type, with a state raised inside the Preview document. */
const previewState = (type, action) =>
  page.evaluate(
    async ([type, action]) => {
      const doc = document.querySelector("#previewFrame").contentDocument;
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const g = ws.runtime.graph;
      const placed = [...ws.root.canvasInputs.values()].find(
        (r) =>
          g.getDefinition(r.definitionId)?.name === type &&
          r.sourceId.startsWith("project:"),
      );
      const field = doc.querySelector(
        `[data-catalog-id="${CSS.escape(placed.id)}"]`,
      );
      const el = field.querySelector("input:not([hidden]), textarea");
      const view = doc.defaultView;
      const wait = (ms) => new Promise((done) => setTimeout(done, ms));
      if (action === "focus") el.focus();
      if (action === "blur") el.blur();
      if (action === "hover")
        for (const name of ["pointerover", "pointerenter", "mouseover"])
          el.dispatchEvent(
            new view.PointerEvent(name, {
              bubbles: name !== "pointerenter",
              pointerType: "mouse",
            }),
          );
      if (action === "unhover")
        for (const name of ["pointerout", "pointerleave", "mouseout"])
          el.dispatchEvent(
            new view.PointerEvent(name, {
              bubbles: name !== "pointerleave",
              pointerType: "mouse",
            }),
          );
      await wait(350);
      const cs = view.getComputedStyle(el);
      return {
        attrs: ["data-focused", "data-hovered", "data-invalid", "data-disabled"]
          .filter((name) => el.hasAttribute(name))
          .join(" "),
        border: cs.borderTopColor,
        outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor} ${cs.outlineOffset}`,
        background: cs.backgroundColor,
        color: cs.color,
        opacity: cs.opacity,
        rootOpacity: view.getComputedStyle(field).opacity,
      };
    },
    [type, action],
  );

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-253 P3 input live");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);

await step("rest-md", async () => {
  const placed = [];
  for (const label of PALETTE)
    try {
      await addFromPalette(label);
      placed.push(label);
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
  const shot = await snap();
  preview.md = Object.fromEntries(
    Object.entries(shot.fields).map(([type, f]) => [type, f.p]),
  );
  writeFileSync(`${OUT}/1-rest.png`, await page.screenshot());
  const bad = mismatches(shot);
  record("rest-md", bad.length === 0, {
    bad,
    placed: placed.length,
    visibility: shot.visibility,
    dpr: shot.dpr,
    sample: shot.fields.TextField,
    color: shot.fields.ColorField?.p,
  });
});
for (const size of ["xl", "sm"])
  await step(`size-${size}`, async () => {
    const failed = await writeFields([...TYPES, ...OTHERS], { size });
    await page.waitForTimeout(2500);
    const shot = await snap();
    preview[size] = Object.fromEntries(
      Object.entries(shot.fields).map(([type, f]) => [type, f.p]),
    );
    writeFileSync(`${OUT}/2-size-${size}.png`, await page.screenshot());
    const bad = mismatches(shot);
    record(`size-${size}`, bad.length === 0, {
      bad,
      failed,
      sample: shot.fields.TextField,
      area: shot.fields.TextArea,
    });
  });
await step("side-label", async () => {
  await writeFields([...TYPES, ...OTHERS], { size: "md" });
  await writeFields(TYPES, { labelPosition: "side" });
  await page.waitForTimeout(2500);
  const shot = await snap();
  writeFileSync(`${OUT}/3-side.png`, await page.screenshot());
  const bad = mismatches(shot);
  record("side-label", bad.length === 0, {
    bad,
    sample: shot.fields.TextField,
  });
  await writeFields(TYPES, { labelPosition: "top" });
  await page.waitForTimeout(1500);
});
await step("states", async () => {
  // The Input rule's own sheet: hover · focus · invalid · disabled, in the Preview document.
  const out = {};
  for (const type of TYPES) {
    const rest = await previewState(type, "none");
    const hover = await previewState(type, "hover");
    await previewState(type, "unhover");
    const focus = await previewState(type, "focus");
    await previewState(type, "blur");
    out[type] = { rest, hover, focus };
  }
  // The trigger-wrapper fields' inner input: no box of its own in any state.
  for (const type of OTHERS) {
    const rest = await previewState(type, "none");
    const focus = await previewState(type, "focus");
    await previewState(type, "blur");
    out[type] = { rest, focus };
  }
  await writeFields(TYPES, { isInvalid: true });
  await page.waitForTimeout(1200);
  for (const type of TYPES)
    out[type].invalid = await previewState(type, "none");
  await writeFields(TYPES, { isInvalid: false });
  await writeFields([...TYPES, ...OTHERS], { isDisabled: true });
  await page.waitForTimeout(1200);
  for (const type of [...TYPES, ...OTHERS])
    out[type].disabled = await previewState(type, "none");
  writeFileSync(`${OUT}/4-disabled.png`, await page.screenshot());
  await writeFields([...TYPES, ...OTHERS], { isDisabled: false });
  await page.waitForTimeout(1200);
  preview.states = out;
  const bad = [];
  for (const type of TYPES) {
    const s = out[type];
    if (s.hover.border === s.rest.border) bad.push(`${type}: hover border`);
    if (!s.hover.attrs.includes("data-hovered")) bad.push(`${type}: no hover`);
    if (!/^solid 2px/.test(s.focus.outline))
      bad.push(`${type}: focus outline ${s.focus.outline}`);
    if (s.focus.border === s.rest.border) bad.push(`${type}: focus border`);
    if (s.invalid.border === s.rest.border) bad.push(`${type}: invalid border`);
    // The field root dims once; the control does not dim again.
    if (s.disabled.rootOpacity !== "0.38" || s.disabled.opacity !== "1")
      bad.push(
        `${type}: disabled ${s.disabled.rootOpacity}/${s.disabled.opacity}`,
      );
  }
  for (const type of OTHERS) {
    const s = out[type];
    if (!/^none/.test(s.focus.outline))
      bad.push(`${type}: inner focus outline ${s.focus.outline}`);
    if (s.disabled.opacity !== "1")
      bad.push(`${type}: inner disabled ${s.disabled.opacity}`);
  }
  record("states", bad.length === 0, {
    bad,
    text: out.TextField,
    combo: out.ComboBox,
  });
});
await step("quiet", async () => {
  // The quiet variant (still the fields' own blocks): an underline in place of the box.
  const failed = await writeFields(TYPES, { isQuiet: true });
  await page.waitForTimeout(1500);
  const out = {};
  for (const type of TYPES) {
    const read = async (action) => {
      const state = await previewState(type, action);
      const box = await page.evaluate((type) => {
        const doc = document.querySelector("#previewFrame").contentDocument;
        const ws = window.__COMPOSITION_CATALOG__.workspace;
        const g = ws.runtime.graph;
        const placed = [...ws.root.canvasInputs.values()].find(
          (r) =>
            g.getDefinition(r.definitionId)?.name === type &&
            r.sourceId.startsWith("project:"),
        );
        const el = doc
          .querySelector(`[data-catalog-id="${CSS.escape(placed.id)}"]`)
          .querySelector("input:not([hidden]), textarea");
        const cs = doc.defaultView.getComputedStyle(el);
        return {
          bottom: `${cs.borderBottomWidth} ${cs.borderBottomColor}`,
          top: cs.borderTopColor,
          radius: cs.borderTopLeftRadius,
        };
      }, type);
      return { ...state, ...box };
    };
    const rest = await read("none");
    const focus = await read("focus");
    await previewState(type, "blur");
    out[type] = { rest, focus };
  }
  writeFileSync(`${OUT}/4b-quiet.png`, await page.screenshot());
  await writeFields(TYPES, { isQuiet: false });
  await page.waitForTimeout(1200);
  preview.quiet = out;
  const bad = [];
  // (The fields' quiet blocks name `.react-aria-Input` only: a TextArea's `<textarea>` keeps its
  // box — the same before this step. Its values are recorded, not judged.)
  for (const type of TYPES.filter((type) => type !== "TextArea")) {
    const s = out[type];
    if (s.rest.background !== "rgba(0, 0, 0, 0)" || s.rest.radius !== "0px")
      bad.push(`${type}: quiet rest ${s.rest.background} ${s.rest.radius}`);
    if (!/^none/.test(s.focus.outline))
      bad.push(`${type}: quiet focus ${s.focus.outline}`);
  }
  record("quiet", bad.length === 0 && failed.length === 0, {
    bad,
    failed,
    text: out.TextField,
  });
});
await step("typing", async () => {
  // The node's element is the control RAC wires to the field: it takes the value.
  const frame = page.frameLocator("#previewFrame");
  const typed = {};
  for (const [type, selector, text] of [
    ["TextField", ".react-aria-TextField input", "hello"],
    ["TextArea", ".react-aria-TextField textarea", "two\nlines"],
  ]) {
    const control = frame.locator(selector).first();
    await control.focus();
    await page.keyboard.type(text.replace("\n", ""));
    typed[type] = await control.inputValue();
    await page.keyboard.press("ControlOrMeta+A");
    await page.keyboard.press("Backspace");
  }
  // Leave no control focused (the focused state is the `states` step's).
  await page.evaluate(() =>
    document
      .querySelector("#previewFrame")
      .contentDocument.activeElement?.blur(),
  );
  record(
    "typing",
    typed.TextField === "hello" && typed.TextArea === "twolines",
    typed,
  );
});
await step("edit-input-origin", async () => {
  await page.evaluate(
    (id) => window.__COMPOSITION_CATALOG__.workspace.showDefinition(id),
    INPUT,
  );
  await page.waitForTimeout(1500);
  const write = (values) =>
    page.evaluate(
      async ([path, values]) => {
        const ws = window.__COMPOSITION_CATALOG__.workspace;
        const { setFields } = await import(/* @vite-ignore */ path);
        const sample = ws.session.getSnapshot().selection[0];
        const record = ws.root.canvasInputs.get(sample.identity);
        ws.execute(
          setFields({
            targets: [{ kind: "node", id: record.sourceId }],
            visual: Object.fromEntries(
              Object.entries(values).map(([key, value]) => [
                key,
                { kind: "set", value },
              ]),
            ),
          }),
        );
        return ws.runtime.graph.getDefinition(record.definitionId)?.name;
      },
      [commands, values],
    );
  const sampleType = await write({ borderColor: "#ff0000", radius: 0 });
  const asked = await continueImpact();
  // A second edit of the same origin (a value-only step).
  await write({ borderColor: "#0000ff" });
  writeFileSync(`${OUT}/5-origin-edited.png`, await page.screenshot());
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.showDefinition(undefined),
  );
  await page.waitForTimeout(3000);
  const shot = await snap();
  writeFileSync(`${OUT}/6-after.png`, await page.screenshot());
  const bad = mismatches(shot);
  for (const type of TYPES) {
    const f = shot.fields[type];
    if (f?.c?.borderColor !== "#0000ff" || f?.c?.radius !== 0)
      bad.push(`${type}: canvas ${f?.c?.borderColor} ${f?.c?.radius}`);
    if (!/rgb\(0, 0, 255\)$/.test(f?.p?.border ?? "") || f?.p?.radius !== "0px")
      bad.push(`${type}: preview ${f?.p?.border} ${f?.p?.radius}`);
  }
  // The trigger-wrapper fields do not follow yet (their control is not an Input node).
  record("edit-input-origin", sampleType === "Input" && bad.length === 0, {
    asked,
    bad,
    sample: shot.fields.TextArea,
  });
});
await step("own-style-and-undo", async () => {
  await page.evaluate(async (path) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const g = ws.runtime.graph;
    const { setFields } = await import(/* @vite-ignore */ path);
    const field = [...ws.root.canvasInputs.values()].find(
      (r) =>
        g.getDefinition(r.definitionId)?.name === "TextField" &&
        r.sourceId.startsWith("project:"),
    );
    const input = field.children
      .map((id) => ws.root.canvasInputs.get(id))
      .find((r) => r.ruleId === "Input");
    ws.execute(
      setFields({
        targets: [ws.itemOfRecord(input.id).target],
        visual: { borderColor: { kind: "set", value: "#00aa00" } },
      }),
    );
  }, commands);
  await page.waitForTimeout(2000);
  const own = await snap();
  writeFileSync(`${OUT}/7-own-style.png`, await page.screenshot());
  const ownOk =
    own.fields.TextField.c.borderColor === "#00aa00" &&
    /rgb\(0, 170, 0\)$/.test(own.fields.TextField.p.border) &&
    own.fields.TextArea.c.borderColor === "#0000ff" &&
    /rgb\(0, 0, 255\)$/.test(own.fields.TextArea.p.border);
  let undone;
  for (let i = 0; i < 6; i++) {
    await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());
    await page.waitForTimeout(200);
    undone = await snap();
    if (undone.fields.TextField?.c.radius === 6) break;
  }
  await page.waitForTimeout(2000);
  undone = await snap();
  const bad = mismatches(undone);
  for (const type of TYPES)
    if (
      undone.fields[type].c.radius !== 6 ||
      undone.fields[type].p.radius !== "6px" ||
      undone.fields[type].p.border !== preview.md[type].border
    )
      bad.push(
        `${type}: ${undone.fields[type].c.radius} ${undone.fields[type].p.border}`,
      );
  record("own-style-and-undo", ownOk && bad.length === 0, {
    own: {
      text: own.fields.TextField.p.border,
      area: own.fields.TextArea.p.border,
    },
    bad,
  });
});
record("errors", errors.length === 0, {
  count: errors.length,
  errors: errors.slice(0, 10),
});
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ base: BASE, results, errors, preview }, null, 2),
);
await browser.close();
process.exit(0);

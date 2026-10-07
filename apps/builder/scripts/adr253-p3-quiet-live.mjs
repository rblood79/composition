// ADR-253 Phase 3 (끝) live — a quiet field (RSP `isQuiet`): the part that draws the field's box
// (its Input / DateInput instance) shows the quiet shape from its own rule (`&[data-quiet]`), in
// the real Builder's Preview (Compare Mode), headed Chrome, saved auth session → /dashboard.
//
//   BUILDER_URL=http://localhost:5175 node apps/builder/scripts/adr253-p3-quiet-live.mjs <out>
//
// With BEFORE=1 the script runs against the build before this step (main, 5173) and only records
// the Preview's computed style (`preview`) for the comparison of the two builds.
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const BEFORE = process.env.BEFORE === "1";
const AUTH =
  process.env.AUTH_SESSION ?? `${REPO}/apps/builder/scripts/.auth-session.json`;
const state = JSON.parse(readFileSync(AUTH, "utf8"));
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
  locale: "en-US",
});
const errors = [];
const results = [];
const preview = {};
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 3000)}\n`,
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
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
/** Fields with `isQuiet` whose box is a part instance, by palette label. */
const FIELDS = {
  "text field": "TextField",
  "text area": "TextArea",
  "number field": "NumberField",
  "search field": "SearchField",
  "color field": "ColorField",
  "combo box": "ComboBox",
  "date field": "DateField",
  "time field": "TimeField",
  "date picker": "DatePicker",
};
const TYPES = Object.values(FIELDS);
/** Quiet shown in the Preview before this step (the field's root carried it and its sheet matched). */
const QUIET_BEFORE = [
  "TextField",
  "NumberField",
  "SearchField",
  "ColorField",
  "DateField",
  "TimeField",
];

const writeFields = (props) =>
  page.evaluate(
    async ([path, types, props]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const g = ws.runtime.graph;
      const { setFields } = await import(/* @vite-ignore */ path);
      for (const field of [...ws.root.canvasInputs.values()]) {
        const type = g.getDefinition(field.definitionId)?.name;
        if (!types.includes(type) || !field.sourceId.startsWith("project:"))
          continue;
        for (const [key, value] of Object.entries(props))
          ws.execute(
            setFields({
              targets: [{ kind: "node", id: field.sourceId }],
              props: { [key]: { kind: "set", value } },
            }),
          );
      }
    },
    [commands, TYPES, props],
  );

/**
 * Each field's box element in the Preview with its computed paint, in the state asked for:
 * `hover` (a mouse pointer over it — RAC `data-hovered`), `focus` (focus inside it — RAC
 * `data-focused` · `data-focus-within`), else at rest. The Canvas record's paint goes with it.
 */
const snap = (stateName) =>
  page.evaluate(
    async ([types, stateName, repo]) => {
      const { catalogRuleShapes } = await import(
        /* @vite-ignore */ `/@fs${repo}/apps/builder/src/builder/catalogRuntime/ruleShapes.ts`
      );
      const { catalogAuthoredVisual } = await import(
        /* @vite-ignore */ `/@fs${repo}/packages/shared/src/catalog/runtime/libraryVisual.ts`
      );
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const g = ws.runtime.graph;
      const frame = document.querySelector("#previewFrame");
      const doc = frame?.contentDocument;
      const view = doc?.defaultView;
      const wait = (ms) => new Promise((done) => setTimeout(done, ms));
      const out = {};
      for (const field of ws.root.canvasInputs.values()) {
        const type = g.getDefinition(field.definitionId)?.name;
        if (!types.includes(type) || !field.sourceId.startsWith("project:"))
          continue;
        const fieldEl = doc?.querySelector(
          `[data-catalog-id="${CSS.escape(field.id)}"]`,
        );
        const box = fieldEl?.querySelector(
          ".react-aria-DateInput, textarea, input:not([hidden]):not([type=hidden])",
        );
        if (!box) {
          const shapes =
            part &&
            catalogRuleShapes({
              node: { ...part, props: { ...part.props, ...part.derivedProps } },
              rect: {
                width: box.getBoundingClientRect().width,
                height: box.getBoundingClientRect().height,
              },
              rule: g.library.rules.get(part.ruleId),
              type: part.ruleId,
              authoredVisual: catalogAuthoredVisual(ws.root, part),
              state:
                stateName === "focus"
                  ? "focusVisible"
                  : stateName === "hover"
                    ? "hover"
                    : undefined,
              theme: ws.root.colorMode,
            });
          const line = shapes?.find((s) => s.type === "line");
          const rgba = (color) => {
            const surface = doc.createElement("canvas");
            surface.width = surface.height = 1;
            const paint = surface.getContext("2d");
            paint.fillStyle = color;
            paint.fillRect(0, 0, 1, 1);
            return [...paint.getImageData(0, 0, 1, 1).data].join(",");
          };
          out[type] = { missing: true };
          continue;
        }
        const target = box.querySelector?.('[role="spinbutton"]') ?? box;
        if (stateName === "hover") {
          const at = box.getBoundingClientRect();
          const init = {
            bubbles: true,
            pointerType: "mouse",
            clientX: at.x + 5,
            clientY: at.y + 5,
            view,
          };
          box.dispatchEvent(new view.PointerEvent("pointerover", init));
          box.dispatchEvent(new view.PointerEvent("pointerenter", init));
          box.dispatchEvent(new view.MouseEvent("mouseover", init));
        }
        if (stateName === "focus") {
          view.focus();
          target.focus();
        }
        await wait(350);
        const cs = view.getComputedStyle(box);
        // The Canvas record of the same part (its box paint).
        const walk = (id) => {
          const node = ws.root.canvasInputs.get(id);
          if (!node) return undefined;
          if (node.ruleId === "Input" || node.ruleId === "DateInput")
            return node;
          for (const child of node.children) {
            const found = walk(child);
            if (found) return found;
          }
          return undefined;
        };
        const part = walk(field.id);
        const shapes =
          part &&
          catalogRuleShapes({
            node: { ...part, props: { ...part.props, ...part.derivedProps } },
            rect: {
              width: box.getBoundingClientRect().width,
              height: box.getBoundingClientRect().height,
            },
            rule: g.library.rules.get(part.ruleId),
            type: part.ruleId,
            authoredVisual: catalogAuthoredVisual(ws.root, part),
            state:
              stateName === "focus"
                ? "focusVisible"
                : stateName === "hover"
                  ? "hover"
                  : undefined,
            theme: ws.root.colorMode,
          });
        const line = shapes?.find((s) => s.type === "line");
        const rgba = (color) => {
          const surface = doc.createElement("canvas");
          surface.width = surface.height = 1;
          const paint = surface.getContext("2d");
          paint.fillStyle = color;
          paint.fillRect(0, 0, 1, 1);
          return [...paint.getImageData(0, 0, 1, 1).data].join(",");
        };
        out[type] = {
          quiet: box.getAttribute("data-quiet"),
          rootQuiet: fieldEl.getAttribute("data-quiet"),
          hovered: box.hasAttribute("data-hovered"),
          focused:
            box.hasAttribute("data-focused") ||
            box.hasAttribute("data-focus-within"),
          background: cs.backgroundColor,
          top: `${cs.borderTopWidth} ${cs.borderTopColor}`,
          left: `${cs.borderLeftWidth} ${cs.borderLeftColor}`,
          bottom: `${cs.borderBottomWidth} ${cs.borderBottomStyle} ${cs.borderBottomColor}`,
          radius: cs.borderTopLeftRadius,
          outline: `${cs.outlineStyle} ${cs.outlineWidth}`,
          shadow: cs.boxShadow,
          canvas: part && {
            fill: part.visual.fill ?? part.visual.backgroundColor,
            borderWidth: part.visual.borderWidth,
            radius: part.visual.radius,
            derivedQuiet: part.derivedProps?.isQuiet ?? null,
            shapes,
            quietParity: Boolean(
              line &&
              line.strokeWidth === parseFloat(cs.borderBottomWidth) &&
              rgba(line.stroke) === rgba(cs.borderBottomColor) &&
              !shapes.some(
                (s) =>
                  s.type === "border" ||
                  (s.type === "roundRect" &&
                    (s.fill !== "transparent" || s.radius !== 0)),
              ),
            ),
          },
        };
        if (stateName === "hover") {
          const init = { bubbles: true, pointerType: "mouse", view };
          box.dispatchEvent(new view.PointerEvent("pointerout", init));
          box.dispatchEvent(new view.PointerEvent("pointerleave", init));
          box.dispatchEvent(new view.MouseEvent("mouseout", init));
        }
        if (stateName === "focus") {
          target.blur();
          doc.activeElement?.blur?.();
        }
        await wait(150);
      }
      return out;
    },
    [TYPES, stateName ?? "rest", REPO],
  );

const CLEAR = "rgba(0, 0, 0, 0)";
const color = (side) =>
  side
    .split(" ")
    .slice(side.includes("solid") ? 2 : 1)
    .join(" ");
/** The quiet shape at rest: no fill, an underline only, square corners. */
const quietRest = (shot) =>
  shot.quiet === "true" &&
  shot.background === CLEAR &&
  color(shot.top) === CLEAR &&
  color(shot.left) === CLEAR &&
  shot.bottom.startsWith("1px solid") &&
  color(shot.bottom) !== CLEAR &&
  shot.radius === "0px" &&
  shot.canvas?.quietParity;

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-253 P3 quiet live");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);

await step("place", async () => {
  const placed = [];
  for (const label of Object.keys(FIELDS))
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
  preview.plain = shot;
  const missing = TYPES.filter((type) => !shot[type] || shot[type].missing);
  const quiet = TYPES.filter((type) => shot[type]?.quiet);
  record("place", missing.length === 0 && quiet.length === 0, {
    placed,
    missing,
    quiet,
  });
});

await step("quiet-rest", async () => {
  await writeFields({ isQuiet: true });
  await page.waitForTimeout(1500);
  const shot = await snap();
  preview.rest = shot;
  writeFileSync(`${OUT}/1-quiet.png`, await page.screenshot());
  if (BEFORE) return record("quiet-rest", true, { before: true });
  const bad = TYPES.filter((type) => !quietRest(shot[type]));
  record("quiet-rest", bad.length === 0, {
    bad: bad.map((type) => [type, shot[type]]),
    sample: shot.TextField,
    // The production Canvas shape executor must agree with the Preview.
    canvas: shot.TextField?.canvas,
  });
});

await step("quiet-hover", async () => {
  const shot = await snap("hover");
  preview.hover = shot;
  if (BEFORE) return record("quiet-hover", true, { before: true });
  const bad = TYPES.filter((type) => {
    const s = shot[type];
    return !(
      s.canvas?.quietParity &&
      s.hovered &&
      s.background === CLEAR &&
      color(s.top) === CLEAR &&
      color(s.left) === CLEAR &&
      color(s.bottom) !== CLEAR &&
      color(s.bottom) !== color(preview.rest[type].bottom)
    );
  });
  record("quiet-hover", bad.length === 0, {
    bad: bad.map((type) => [type, shot[type]]),
    sample: shot.TextField,
  });
});

await step("quiet-focus", async () => {
  const shot = await snap("focus");
  preview.focus = shot;
  if (BEFORE) return record("quiet-focus", true, { before: true });
  const bad = TYPES.filter((type) => {
    const s = shot[type];
    return !(
      s.canvas?.quietParity &&
      s.focused &&
      s.outline.startsWith("none") &&
      color(s.top) === CLEAR &&
      color(s.left) === CLEAR &&
      color(s.bottom) !== CLEAR &&
      color(s.bottom) !== color(preview.rest[type].bottom)
    );
  });
  record("quiet-focus", bad.length === 0, {
    bad: bad.map((type) => [type, shot[type]]),
    sample: shot.TextField,
  });
});

await step("quiet-invalid", async () => {
  await writeFields({ isInvalid: true });
  await page.waitForTimeout(1200);
  const shot = await snap();
  preview.invalid = shot;
  await writeFields({ isInvalid: false });
  await page.waitForTimeout(800);
  if (BEFORE) return record("quiet-invalid", true, { before: true });
  const bad = TYPES.filter((type) => {
    const s = shot[type];
    return !(
      s.canvas?.quietParity &&
      color(s.top) === CLEAR &&
      color(s.left) === CLEAR &&
      color(s.bottom) !== CLEAR &&
      color(s.bottom) !== color(preview.rest[type].bottom)
    );
  });
  record("quiet-invalid", bad.length === 0, {
    bad: bad.map((type) => [type, shot[type]]),
    sample: shot.TextField,
  });
});

await step("quiet-off", async () => {
  await writeFields({ isQuiet: false });
  await page.waitForTimeout(1500);
  const shot = await snap();
  preview.off = shot;
  if (BEFORE) return record("quiet-off", true, { before: true });
  // Back to the box the field showed before it was quiet.
  const bad = TYPES.filter(
    (type) =>
      JSON.stringify(shot[type]) !== JSON.stringify(preview.plain[type]),
  );
  record("quiet-off", bad.length === 0, {
    bad: bad.map((type) => [type, shot[type], preview.plain[type]]),
  });
});

record("errors", errors.length === 0, errors.slice(0, 8));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify(
    { base: BASE, results, preview, quietBefore: QUIET_BEFORE },
    null,
    1,
  ),
);
await browser.close();
process.exit(results.every((result) => result.pass) ? 0 : 1);

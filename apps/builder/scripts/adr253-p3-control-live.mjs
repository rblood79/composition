// ADR-253 Phase 3 (4) live — a field's control parts: the real Builder + Preview (Compare Mode),
// headed Chrome, saved auth session → /dashboard. The control wrapper of a field (NumberField's
// Group) only places its parts; the parts are instances of the Input and Button origins, drawn by
// the same nodes on the Canvas and in the Preview. Editing an origin on the Components page
// changes every instance together, and the steppers keep what RAC's context gives them.
//
//   BUILDER_URL=http://localhost:5175 node apps/builder/scripts/adr253-p3-control-live.mjs <out>
//
// With BEFORE=1 the script runs against the build before this step (main, 5173): the Canvas part
// records differ there, so it only records the Preview (`preview`) and the Builder's own number
// inputs (`chrome`) for the comparison of the two builds.
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
});
const errors = [];
const results = [];
const preview = {};
let chrome = {};
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 2600)}\n`,
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
const BUTTON = "lib:definition:origin-component-button";
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const PALETTE = (process.env.PALETTE ?? "number field,text field,button")
  .split(",")
  .map((label) => label.trim());
const TYPES = (process.env.TYPES ?? "NumberField").split(",");

/**
 * Each placed field: every Canvas record under it (box from the field, paint) with the Preview
 * element of the same node (box from the field element, computed style). The wrapper has no
 * element of its own node: it is the field's `.react-aria-Group`.
 */
const snap = () =>
  page.evaluate(
    ([types]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const g = ws.runtime.graph;
      const doc = document.querySelector("#previewFrame")?.contentDocument;
      const view = doc?.defaultView;
      const round = (v) => Math.round(v * 10) / 10;
      const out = {};
      const css = (el) => {
        const cs = view.getComputedStyle(el);
        return {
          padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
          font: parseFloat(cs.fontSize),
          border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
          radius: `${cs.borderTopLeftRadius} ${cs.borderTopRightRadius} ${cs.borderBottomRightRadius} ${cs.borderBottomLeftRadius}`,
          background: cs.backgroundColor,
          color: cs.color,
          opacity: cs.opacity,
          display: cs.display,
          margin: cs.marginLeft,
        };
      };
      for (const field of ws.root.canvasInputs.values()) {
        const type = g.getDefinition(field.definitionId)?.name;
        if (!types.includes(type) || !field.sourceId.startsWith("project:"))
          continue;
        const fieldEl = doc?.querySelector(
          `[data-catalog-id="${CSS.escape(field.id)}"]`,
        );
        const fieldBox = fieldEl?.getBoundingClientRect();
        const fieldRect = ws.root.getGeometry([field.id]).get(field.id);
        const parts = [];
        const walk = (id, ox, oy, depth) => {
          const node = ws.root.canvasInputs.get(id);
          if (!node) return;
          const rect = ws.root.getGeometry([id]).get(id);
          const name = g.getDefinition(node.definitionId)?.name;
          const x = ox + (rect?.x ?? 0);
          const y = oy + (rect?.y ?? 0);
          if (
            depth > 0 &&
            !["Label", "Description", "FieldError"].includes(name)
          ) {
            const el =
              doc?.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`) ??
              (name === "SelectTrigger"
                ? fieldEl?.querySelector(
                    ".react-aria-Group, .combobox-container, .searchfield-container",
                  )
                : null);
            const box = el?.getBoundingClientRect();
            const v = node.visual;
            const corner = (key) => v[key] ?? v.radius ?? 0;
            // A Canvas color as the Preview document computes it (theme variables included).
            const computed = (value) => {
              if (typeof value !== "string" || !doc) return undefined;
              const probe = doc.createElement("div");
              probe.style.backgroundColor = value;
              doc.body.appendChild(probe);
              const out = view.getComputedStyle(probe).backgroundColor;
              probe.remove();
              return out;
            };
            parts.push({
              type: name,
              source: node.sourceId.split("component-").pop(),
              collapsed: node.collapsedSourceIds?.[0]?.split(":").pop(),
              size: node.props.size,
              hidden: node.hidden === true,
              c: rect && {
                x: round(x),
                y: round(y),
                w: round(rect.width),
                h: round(rect.height),
                radius: `${corner("radiusTopLeft")}px ${corner("radiusTopRight")}px ${corner("radiusBottomRight")}px ${corner("radiusBottomLeft")}px`,
                borderWidth: v.borderWidth,
                fill: v.fill,
                fillCss: computed(v.fill),
                borderColor: v.borderColor,
                borderColorCss: computed(v.borderColor),
                color: v.color,
                iconSize: v.iconSize,
              },
              p: el
                ? {
                    tag: el.tagName,
                    isNode: el.getAttribute("data-catalog-id") === id,
                    size: el.getAttribute("data-size"),
                    slot: el.getAttribute("slot"),
                    disabled: el.hasAttribute("disabled"),
                    x: round(box.x - fieldBox.x),
                    y: round(box.y - fieldBox.y),
                    w: round(box.width),
                    h: round(box.height),
                    ...css(el),
                  }
                : null,
            });
          }
          const inside = (childId) => {
            const child = ws.root.canvasInputs.get(childId);
            const childType =
              child && g.getDefinition(child.definitionId)?.name;
            return depth > 0 || childType === "SelectTrigger";
          };
          if (node.hidden !== true)
            for (const child of node.children)
              if (inside(child)) walk(child, x, y, depth + 1);
        };
        walk(field.id, -(fieldRect?.x ?? 0), -(fieldRect?.y ?? 0), 0);
        const input = fieldEl?.querySelector("input:not([hidden])");
        out[type] = {
          field: {
            c: fieldRect && round(fieldRect.height),
            p: fieldBox && round(fieldBox.height),
            rootOpacity: fieldEl && view.getComputedStyle(fieldEl).opacity,
          },
          value: input?.value,
          parts,
        };
      }
      return {
        fields: out,
        visibility: document.visibilityState,
        dpr: devicePixelRatio,
      };
    },
    [TYPES],
  );
/** The Preview alone (either build): the control's elements found through the field's element. */
const snapPreview = () =>
  page.evaluate(
    ([types]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const g = ws.runtime.graph;
      const doc = document.querySelector("#previewFrame")?.contentDocument;
      const view = doc?.defaultView;
      const round = (v) => Math.round(v * 10) / 10;
      const out = {};
      for (const field of ws.root.canvasInputs.values()) {
        const type = g.getDefinition(field.definitionId)?.name;
        if (!types.includes(type) || !field.sourceId.startsWith("project:"))
          continue;
        const fieldEl = doc?.querySelector(
          `[data-catalog-id="${CSS.escape(field.id)}"]`,
        );
        if (!fieldEl) continue;
        const fieldBox = fieldEl.getBoundingClientRect();
        out[type] = [
          ...fieldEl.querySelectorAll(
            ".react-aria-Group, .combobox-container, .searchfield-container, input:not([hidden]), button, button svg",
          ),
        ].map((el) => {
          const cs = view.getComputedStyle(el);
          const box = el.getBoundingClientRect();
          return {
            el: `${el.tagName.toLowerCase()}${el.getAttribute("slot") ? `[${el.getAttribute("slot")}]` : ""}`,
            x: round(box.x - fieldBox.x),
            y: round(box.y - fieldBox.y),
            w: round(box.width),
            h: round(box.height),
            padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
            border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
            radius: `${cs.borderTopLeftRadius} ${cs.borderTopRightRadius} ${cs.borderBottomRightRadius} ${cs.borderBottomLeftRadius}`,
            background: cs.backgroundColor,
            color: cs.color,
            shadow: cs.boxShadow,
          };
        });
      }
      return out;
    },
    [TYPES],
  );
/** Parts whose Canvas record and Preview element differ (box > 1px · corners · border · fill). */
const mismatches = (shot) =>
  TYPES.flatMap((type) => {
    const f = shot.fields[type];
    if (!f) return [`${type}: not placed`];
    const bad = [];
    if (Math.abs(f.field.c - f.field.p) > 1)
      bad.push(`field h ${f.field.c}/${f.field.p}`);
    for (const part of f.parts) {
      const tag = `${part.type}(${part.source})`;
      if (part.hidden) continue;
      if (!part.c || !part.p) {
        bad.push(`${tag}: ${part.c ? "no element" : "no box"}`);
        continue;
      }
      if (part.type !== "SelectTrigger" && !part.p.isNode)
        bad.push(`${tag}: the element is not the node`);
      for (const key of ["x", "y", "w", "h"])
        if (Math.abs(part.c[key] - part.p[key]) > 1)
          bad.push(`${tag} ${key} ${part.c[key]}/${part.p[key]}`);
      if (part.type === "Icon") continue;
      if (part.c.radius !== part.p.radius)
        bad.push(`${tag} radius ${part.c.radius}/${part.p.radius}`);
      if (`${part.c.borderWidth ?? 0}px` !== part.p.border.split(" ")[0])
        bad.push(`${tag} border ${part.c.borderWidth}/${part.p.border}`);
      // A stepper RAC disables at the value's limit is the Preview's run state: its sheet's
      // disabled paint is not the document's (the Canvas draws the document).
      if (part.type === "Button" && part.p.disabled) continue;
      if (part.c.fill && part.c.fillCss !== part.p.background)
        bad.push(`${tag} fill ${part.c.fill}/${part.p.background}`);
      if (
        part.c.borderWidth &&
        part.c.borderColor &&
        part.c.borderColorCss !== part.p.border.split(" ").slice(2).join(" ")
      )
        bad.push(`${tag} border color ${part.c.borderColor}/${part.p.border}`);
      if (["Input", "Button"].includes(part.type) && part.p.size !== part.size)
        bad.push(`${tag} data-size ${part.p.size}/${part.size}`);
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
/** The steppers of the placed NumberField in the Preview, after an action inside that document. */
const steppers = (action) =>
  page.evaluate(
    async ([action]) => {
      const doc = document.querySelector("#previewFrame").contentDocument;
      const view = doc.defaultView;
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const g = ws.runtime.graph;
      const placed = [...ws.root.canvasInputs.values()].find(
        (r) =>
          g.getDefinition(r.definitionId)?.name === "NumberField" &&
          r.sourceId.startsWith("project:"),
      );
      const field = doc.querySelector(
        `[data-catalog-id="${CSS.escape(placed.id)}"]`,
      );
      const button = (slot) => field.querySelector(`button[slot="${slot}"]`);
      const wait = (ms) => new Promise((done) => setTimeout(done, ms));
      const pointer = (el, names) => {
        for (const name of names)
          el.dispatchEvent(
            new view.PointerEvent(name, {
              bubbles: !/enter|leave/.test(name),
              pointerType: "mouse",
            }),
          );
      };
      if (action === "increment" || action === "decrement")
        button(action).click();
      if (action === "hover")
        pointer(button("increment"), [
          "pointerover",
          "pointerenter",
          "mouseover",
        ]);
      if (action === "unhover")
        pointer(button("increment"), [
          "pointerout",
          "pointerleave",
          "mouseout",
        ]);
      if (action === "focus-input") field.querySelector("input").focus();
      if (action === "blur-input") field.querySelector("input").blur();
      await wait(350);
      const input = field.querySelector("input");
      const ics = view.getComputedStyle(input);
      const read = (slot) => {
        const el = button(slot);
        const cs = view.getComputedStyle(el);
        return {
          disabled: el.hasAttribute("disabled"),
          hovered: el.hasAttribute("data-hovered"),
          background: cs.backgroundColor,
          opacity: cs.opacity,
        };
      };
      return {
        value: input.value,
        decrement: read("decrement"),
        increment: read("increment"),
        input: {
          focused: input.hasAttribute("data-focused"),
          outline: `${ics.outlineStyle} ${ics.outlineWidth} ${ics.outlineOffset}`,
          border: ics.borderTopColor,
        },
        group: {
          outline: view.getComputedStyle(
            field.querySelector(".react-aria-Group"),
          ).outlineStyle,
        },
      };
    },
    [action],
  );
/** The Builder's own number inputs (its panels' RAC NumberField): what this step must not move. */
const snapChrome = () =>
  page.evaluate(() => {
    const out = {};
    const pick = (el) => {
      const cs = getComputedStyle(el);
      const box = el.getBoundingClientRect();
      return {
        w: Math.round(box.width * 10) / 10,
        h: Math.round(box.height * 10) / 10,
        display: cs.display,
        flex: `${cs.flexGrow} ${cs.flexShrink} ${cs.flexBasis}`,
        padding: `${cs.paddingTop} ${cs.paddingRight} ${cs.paddingBottom} ${cs.paddingLeft}`,
        border: `${cs.borderTopWidth} ${cs.borderRightWidth} ${cs.borderBottomWidth} ${cs.borderLeftWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
        radius: cs.borderTopLeftRadius,
        background: cs.backgroundColor,
        font: `${cs.fontSize}/${cs.lineHeight}`,
        color: cs.color,
        outline: cs.outlineStyle,
        minWidth: cs.minWidth,
        margin: cs.marginLeft,
      };
    };
    [...document.querySelectorAll(".react-aria-NumberField")].forEach(
      (root, index) => {
        const label =
          root.getAttribute("aria-label") ??
          root.closest("fieldset")?.querySelector("legend")?.textContent ??
          "";
        const key = `${index}:${label}`.slice(0, 40);
        out[key] = {
          root: pick(root),
          group: root.firstElementChild && pick(root.firstElementChild),
          input:
            root.querySelector("input") && pick(root.querySelector("input")),
          buttons: [...root.querySelectorAll("button")].map(pick),
        };
      },
    );
    return out;
  });

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-253 P3 control live");
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
      // The Builder's own number inputs, while a placed field is selected (its Design panel).
      if (label === PALETTE[0]) {
        await page.waitForTimeout(800);
        chrome = await snapChrome();
      }
      await page.evaluate(() =>
        window.__COMPOSITION_CATALOG__.workspace.selectItems([]),
      );
    } catch (error) {
      placed.push(`${label}: ${String(error?.message ?? error).slice(0, 80)}`);
    }
  // A SearchField's value is its input's initial value: set before the Preview mounts, so the
  // clear button shows on both sides.
  if (TYPES.includes("SearchField"))
    await writeFields(["SearchField"], { value: "abc" });
  // CLOSEUP=1: the Canvas alone at the mobile viewport (near 100%), to look at the parts.
  if (process.env.CLOSEUP) {
    await page.getByLabel("Mobile", { exact: true }).first().click();
    await page.waitForTimeout(1500);
    writeFileSync(`${OUT}/0-closeup.png`, await page.screenshot());
    await page.getByLabel("Desktop", { exact: true }).first().click();
    await page.waitForTimeout(1500);
  }
  await page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first()
    .click();
  await page.waitForTimeout(3000);
  preview.md = await snapPreview();
  writeFileSync(`${OUT}/1-rest.png`, await page.screenshot());
  if (BEFORE) {
    record("rest-md", true, {
      before: true,
      placed,
      chrome: Object.keys(chrome).length,
    });
    return;
  }
  const shot = await snap();
  const bad = mismatches(shot);
  record("rest-md", bad.length === 0, {
    bad,
    placed,
    visibility: shot.visibility,
    dpr: shot.dpr,
    chrome: Object.keys(chrome).length,
    sample: shot.fields[TYPES[0]],
  });
});
for (const size of ["xl", "xs", "sm", "lg"])
  await step(`size-${size}`, async () => {
    // (SearchField's rule has no xs size.)
    const failed = await writeFields(
      TYPES.filter((type) => !(size === "xs" && type === "SearchField")),
      { size },
    );
    await page.waitForTimeout(1200);
    preview[size] = await snapPreview();
    if (size === "xl")
      writeFileSync(`${OUT}/2-size-xl.png`, await page.screenshot());
    if (BEFORE) {
      record(`size-${size}`, true, { before: true });
      return;
    }
    const shot = await snap();
    const bad = mismatches(shot);
    record(`size-${size}`, bad.length === 0 && failed.length === 0, {
      bad,
      failed,
      parts: shot.fields[TYPES[0]]?.parts.map((part) => ({
        type: part.type,
        c: part.c && `${part.c.w}x${part.c.h}`,
        p: part.p && `${part.p.w}x${part.p.h}`,
      })),
    });
  });
await step("side-label", async () => {
  await writeFields(TYPES, { size: "md", labelPosition: "side" });
  await page.waitForTimeout(1200);
  preview.side = await snapPreview();
  if (BEFORE) {
    record("side-label", true, { before: true });
    await writeFields(TYPES, { labelPosition: "top" });
    return;
  }
  const shot = await snap();
  const bad = mismatches(shot);
  record("side-label", bad.length === 0, {
    bad,
    parts: shot.fields[TYPES[0]]?.parts.map((part) => ({
      type: part.type,
      c: part.c && `${part.c.x},${part.c.y} ${part.c.w}x${part.c.h}`,
      p: part.p && `${part.p.x},${part.p.y} ${part.p.w}x${part.p.h}`,
    })),
  });
  await writeFields(TYPES, { labelPosition: "top" });
  await page.waitForTimeout(800);
});
if (TYPES.includes("NumberField"))
  await step("steppers", async () => {
    // Value 0 = the minimum: decrease is disabled, increase is not (RAC's context — nothing the
    // document did not write is passed to the Button).
    const rest = await steppers();
    const up = await steppers("increment");
    const up2 = await steppers("increment");
    const down = await steppers("decrement");
    // A disabled field disables both; enabling it gives them back.
    await writeFields(["NumberField"], { isDisabled: true });
    await page.waitForTimeout(800);
    const disabled = await steppers();
    const rootOpacity =
      (await snapPreview()) &&
      (await page.evaluate(() => {
        const doc = document.querySelector("#previewFrame").contentDocument;
        const el = doc.querySelector(".react-aria-NumberField");
        return doc.defaultView.getComputedStyle(el).opacity;
      }));
    await writeFields(["NumberField"], { isDisabled: false });
    await page.waitForTimeout(800);
    // Read only: the steppers do not change the value.
    await writeFields(["NumberField"], { isReadOnly: true });
    await page.waitForTimeout(800);
    const readOnlyBefore = await steppers();
    const readOnly = await steppers("increment");
    await writeFields(["NumberField"], { isReadOnly: false });
    await page.waitForTimeout(800);
    const hover = await steppers("hover");
    await steppers("unhover");
    // A Button placed on the page: the same sheet, the same hover.
    const pageButton = await page.evaluate(async () => {
      const doc = document.querySelector("#previewFrame").contentDocument;
      const view = doc.defaultView;
      const el = [
        ...doc.querySelectorAll("button.react-aria-Button:not([slot])"),
      ].find(
        (button) =>
          !button.closest(".react-aria-ComboBox, .react-aria-SearchField"),
      );
      if (!el) return {};
      const before = view.getComputedStyle(el).backgroundColor;
      for (const name of ["pointerover", "pointerenter", "mouseover"])
        el.dispatchEvent(
          new view.PointerEvent(name, {
            bubbles: name !== "pointerenter",
            pointerType: "mouse",
          }),
        );
      await new Promise((done) => setTimeout(done, 400));
      const out = {
        before,
        hovered: el.hasAttribute("data-hovered"),
        after: view.getComputedStyle(el).backgroundColor,
      };
      for (const name of ["pointerout", "pointerleave", "mouseout"])
        el.dispatchEvent(
          new view.PointerEvent(name, {
            bubbles: name !== "pointerleave",
            pointerType: "mouse",
          }),
        );
      return out;
    });
    const focus = await steppers("focus-input");
    await steppers("blur-input");
    const pass =
      rest.value === "0" &&
      rest.decrement.disabled &&
      !rest.increment.disabled &&
      up.value === "1" &&
      !up.decrement.disabled &&
      up2.value === "2" &&
      down.value === "1" &&
      disabled.decrement.disabled &&
      disabled.increment.disabled &&
      // A disabled field fades once, at its root: its steppers keep their rest paint.
      rootOpacity === "0.38" &&
      disabled.increment.opacity === "1" &&
      disabled.decrement.opacity === "1" &&
      disabled.increment.background === rest.increment.background &&
      readOnly.value === readOnlyBefore.value &&
      hover.increment.hovered &&
      // The Button rule's sheet paints the hover (no inline rest color over it).
      hover.increment.background !== rest.increment.background &&
      pageButton.hovered &&
      pageButton.after !== pageButton.before &&
      focus.input.focused &&
      /solid 2px/.test(focus.input.outline);
    record("steppers", BEFORE || pass, {
      rest,
      up: up.value,
      up2: up2.value,
      down: down.value,
      disabled,
      rootOpacity,
      readOnly: [readOnlyBefore.value, readOnly.value, readOnly.increment],
      hover: hover.increment,
      pageButton,
      focus,
    });
  });
/** The placed ComboBox in the Preview, after an action inside that document. */
const combo = (action) =>
  page.evaluate(
    async ([action]) => {
      const doc = document.querySelector("#previewFrame").contentDocument;
      const view = doc.defaultView;
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const g = ws.runtime.graph;
      const placed = [...ws.root.canvasInputs.values()].find(
        (r) =>
          g.getDefinition(r.definitionId)?.name === "ComboBox" &&
          r.sourceId.startsWith("project:"),
      );
      const field = doc.querySelector(
        `[data-catalog-id="${CSS.escape(placed.id)}"]`,
      );
      const input = field.querySelector("input");
      const button = field.querySelector("button");
      const wait = (ms) => new Promise((done) => setTimeout(done, ms));
      const pointer = (el, names) => {
        for (const name of names)
          el.dispatchEvent(
            new view.PointerEvent(name, {
              bubbles: !/enter|leave/.test(name),
              pointerType: "mouse",
            }),
          );
      };
      if (action === "open" || action === "close") button.click();
      if (action === "hover")
        pointer(button, ["pointerover", "pointerenter", "mouseover"]);
      if (action === "unhover")
        pointer(button, ["pointerout", "pointerleave", "mouseout"]);
      if (action === "focus") input.focus();
      if (action === "blur") input.blur();
      await wait(450);
      const bcs = view.getComputedStyle(button);
      const ics = view.getComputedStyle(input);
      const error = field.querySelector(".react-aria-FieldError");
      return {
        expanded: input.getAttribute("aria-expanded"),
        options: doc.querySelectorAll('[role="option"]').length,
        listbox: !!doc.querySelector('[role="listbox"]'),
        button: {
          disabled: button.hasAttribute("disabled"),
          hovered: button.hasAttribute("data-hovered"),
          background: bcs.backgroundColor,
          opacity: bcs.opacity,
        },
        input: {
          focused: input.hasAttribute("data-focused"),
          outline: `${ics.outlineStyle} ${ics.outlineWidth} ${ics.outlineOffset}`,
          invalid: input.hasAttribute("data-invalid"),
          required:
            input.hasAttribute("required") ||
            input.getAttribute("aria-required"),
        },
        error: error?.textContent ?? null,
        rootOpacity: view.getComputedStyle(field).opacity,
      };
    },
    [action],
  );
if (TYPES.includes("ComboBox"))
  await step("combobox", async () => {
    const rest = await combo();
    const open = await combo("open");
    const closed = await combo("close");
    const hover = await combo("hover");
    await combo("unhover");
    const focus = await combo("focus");
    await combo("blur");
    await writeFields(["ComboBox"], { isDisabled: true });
    await page.waitForTimeout(800);
    const disabled = await combo();
    await writeFields(["ComboBox"], { isDisabled: false });
    await page.waitForTimeout(800);
    // Required: focus and leave the empty field (RAC's own validation — the Preview's run state).
    await writeFields(["ComboBox"], { isRequired: true });
    await page.waitForTimeout(800);
    await combo("focus");
    const required = await combo("blur");
    await writeFields(["ComboBox"], { isRequired: false });
    await page.waitForTimeout(800);
    const pass =
      rest.expanded === "false" &&
      // The Preview gives the ComboBox no items yet (ADR-253 F11 — Phase 4): RAC opens no empty
      // list, in this build and the one before. With items the button opens and closes it.
      (open.options === 0
        ? open.expanded === "false"
        : open.expanded === "true" && open.listbox) &&
      closed.expanded === "false" &&
      hover.button.hovered &&
      hover.button.background !== rest.button.background &&
      focus.input.focused &&
      /solid 2px/.test(focus.input.outline) &&
      disabled.button.disabled &&
      disabled.rootOpacity === "0.38" &&
      disabled.button.opacity === "1" &&
      disabled.button.background === rest.button.background;
    record("combobox", BEFORE || pass, {
      rest,
      open: [open.expanded, open.listbox, open.options],
      closed: closed.expanded,
      hover: hover.button,
      focus: focus.input,
      disabled: [disabled.button, disabled.rootOpacity],
      required: [required.input, required.error],
    });
  });
/** The placed SearchField in the Preview, after an action inside that document. */
const search = (action) =>
  page.evaluate(
    async ([action]) => {
      const doc = document.querySelector("#previewFrame").contentDocument;
      const view = doc.defaultView;
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const g = ws.runtime.graph;
      const placed = [...ws.root.canvasInputs.values()].find(
        (r) =>
          g.getDefinition(r.definitionId)?.name === "SearchField" &&
          r.sourceId.startsWith("project:"),
      );
      const field = doc.querySelector(
        `[data-catalog-id="${CSS.escape(placed.id)}"]`,
      );
      const input = field.querySelector("input");
      const button = field.querySelector("button");
      const wait = (ms) => new Promise((done) => setTimeout(done, ms));
      const pointer = (el, names) => {
        for (const name of names)
          el.dispatchEvent(
            new view.PointerEvent(name, {
              bubbles: !/enter|leave/.test(name),
              pointerType: "mouse",
            }),
          );
      };
      if (action === "clear") button.click();
      if (action === "type") {
        const setter = Object.getOwnPropertyDescriptor(
          view.HTMLInputElement.prototype,
          "value",
        ).set;
        setter.call(input, "xyz");
        input.dispatchEvent(new view.Event("input", { bubbles: true }));
      }
      if (action === "hover")
        pointer(button, ["pointerover", "pointerenter", "mouseover"]);
      if (action === "unhover")
        pointer(button, ["pointerout", "pointerleave", "mouseout"]);
      if (action === "focus") input.focus();
      if (action === "blur") input.blur();
      await wait(450);
      const bcs = view.getComputedStyle(button);
      const ics = view.getComputedStyle(input);
      const glyph = field.querySelector(
        ".searchfield-container > .react-aria-Icon, .search-icon",
      );
      const glyphBox = glyph?.getBoundingClientRect();
      const inputBox = input.getBoundingClientRect();
      return {
        value: input.value,
        type: input.type,
        empty: field.getAttribute("data-empty"),
        button: {
          display: bcs.display,
          label: button.getAttribute("aria-label"),
          disabled: button.hasAttribute("disabled"),
          hovered: button.hasAttribute("data-hovered"),
          background: bcs.backgroundColor,
          opacity: bcs.opacity,
          radius: bcs.borderTopLeftRadius,
        },
        input: {
          focused: input.hasAttribute("data-focused"),
          outline: `${ics.outlineStyle} ${ics.outlineWidth} ${ics.outlineOffset}`,
          radius: ics.borderTopLeftRadius,
        },
        // The glyph is drawn over the Input (inside its box, above it).
        glyph: glyph && {
          inside:
            glyphBox.left >= inputBox.left && glyphBox.right <= inputBox.right,
          top:
            doc.elementFromPoint(
              glyphBox.left + glyphBox.width / 2,
              glyphBox.top + glyphBox.height / 2,
            ) !== input,
          color: view.getComputedStyle(glyph).color,
        },
        rootOpacity: view.getComputedStyle(field).opacity,
      };
    },
    [action],
  );
if (TYPES.includes("SearchField"))
  await step("searchfield", async () => {
    const rest = await search();
    const hover = await search("hover");
    await search("unhover");
    const cleared = await search("clear");
    const typed = await search("type");
    const focus = await search("focus");
    await search("blur");
    await writeFields(["SearchField"], { isDisabled: true });
    await page.waitForTimeout(800);
    const disabled = await search();
    await writeFields(["SearchField"], { isDisabled: false });
    await page.waitForTimeout(800);
    // An empty document value: the clear button is hidden on both sides from the start.
    // (The value is the input's initial value: the Preview mounts again to read it.)
    const remount = async () => {
      for (const name of ["Skia Only Mode", "Compare Mode (Preview + Skia)"]) {
        await page.getByRole("button", { name, exact: true }).first().click();
        await page.waitForTimeout(name.startsWith("Skia") ? 500 : 3000);
      }
    };
    await writeFields(["SearchField"], { value: "" });
    await remount();
    const emptied = await search();
    const emptiedCanvas = await page.evaluate(() => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const g = ws.runtime.graph;
      const records = [...ws.root.canvasInputs.values()];
      const field = records.find(
        (r) =>
          g.getDefinition(r.definitionId)?.name === "SearchField" &&
          r.sourceId.startsWith("project:"),
      );
      const wrapper = ws.root.canvasInputs.get(field.children[1]);
      return wrapper.children.map(
        (id) => ws.root.canvasInputs.get(id).hidden === true,
      );
    });
    await writeFields(["SearchField"], { value: "abc" });
    await remount();
    const pass =
      rest.value === "abc" &&
      rest.type === "search" &&
      rest.button.display !== "none" &&
      rest.glyph?.inside &&
      rest.glyph.top &&
      hover.button.hovered &&
      hover.button.background !== rest.button.background &&
      cleared.value === "" &&
      cleared.button.display === "none" &&
      typed.value === "xyz" &&
      typed.button.display !== "none" &&
      focus.input.focused &&
      /solid 2px/.test(focus.input.outline) &&
      disabled.button.disabled &&
      disabled.rootOpacity === "0.38" &&
      disabled.button.opacity === "1" &&
      emptied.value === "" &&
      emptied.button.display === "none" &&
      emptiedCanvas.at(-1) === true;
    record("searchfield", BEFORE || pass, {
      emptied: [emptied.value, emptied.button.display, emptiedCanvas],
      rest,
      hover: hover.button,
      cleared: [cleared.value, cleared.empty, cleared.button.display],
      typed: [typed.value, typed.button.display],
      focus: focus.input,
      disabled: [disabled.button, disabled.rootOpacity],
    });
  });
if (!BEFORE) {
  // The origin a type's button is an instance of.
  const BUTTON_ORIGIN = {
    NumberField: BUTTON,
    ComboBox: "lib:definition:origin-component-fieldbutton",
    SearchField: BUTTON,
  };
  // A SearchField's clear button writes its own fill on its template position: the Button
  // origin's fill stays under it (its border color, which the position does not write, follows).
  const OWN_FILL = new Set(["SearchField"]);
  const partsOf = (shot, type, partType) =>
    (shot.fields[type]?.parts ?? []).filter((part) => part.type === partType);
  await step("edit-origins", async () => {
    const before = await snap();
    const write = (definition, visual) =>
      page.evaluate(
        async ([path, definition, visual]) => {
          const ws = window.__COMPOSITION_CATALOG__.workspace;
          const { setFields } = await import(/* @vite-ignore */ path);
          ws.showDefinition(definition);
          await new Promise((done) => setTimeout(done, 700));
          const selected = ws.session.getSnapshot().selection[0]?.identity;
          const node = selected && ws.root.canvasInputs.get(selected);
          if (!node) return "no origin selected";
          ws.execute(
            setFields({
              targets: [{ kind: "node", id: node.sourceId }],
              visual: Object.fromEntries(
                Object.entries(visual).map(([key, value]) => [
                  key,
                  { kind: "set", value },
                ]),
              ),
            }),
          );
          return null;
        },
        [commands, definition, visual],
      );
    const asked = [];
    const failures = [];
    const origins = [...new Set(TYPES.map((type) => BUTTON_ORIGIN[type]))];
    for (const origin of origins) {
      failures.push(await write(origin, { fill: "#ffcc00" }));
      asked.push(await continueImpact());
      failures.push(await write(origin, { borderColor: "#ff0000" }));
      asked.push(await continueImpact());
    }
    failures.push(await write(INPUT, { borderColor: "#0000ff" }));
    asked.push(await continueImpact());
    await page.evaluate(() =>
      window.__COMPOSITION_CATALOG__.workspace.showDefinition(undefined),
    );
    await page.waitForTimeout(1500);
    const after = await snap();
    writeFileSync(`${OUT}/3-origins.png`, await page.screenshot());
    const bad = mismatches(after);
    const followed = TYPES.map((type) => {
      const buttons = partsOf(after, type, "Button");
      const input = partsOf(after, type, "Input")[0];
      return {
        type,
        buttons: buttons.map((part) => [part.c.fill, part.p.background]),
        input: input && [input.c.borderColor, input.p.border],
        ok:
          buttons.length > 0 &&
          buttons.every(
            (part) =>
              part.c.borderColor === "#ff0000" &&
              (OWN_FILL.has(type) ||
                (part.c.fill === "#ffcc00" &&
                  (part.p.disabled ||
                    part.p.background === "rgb(255, 204, 0)"))),
          ) &&
          input?.c.borderColor === "#0000ff" &&
          input.p.border.endsWith("rgb(0, 0, 255)"),
      };
    });
    record(
      "edit-origins",
      failures.every((failure) => !failure) &&
        bad.length === 0 &&
        followed.every((item) => item.ok),
      { failures, asked, bad, followed },
    );
    // Undo back to the origins' own values.
    const fills = (shot) =>
      JSON.stringify(
        TYPES.map((type) => [
          partsOf(shot, type, "Button").map((part) => [
            part.c.fill,
            part.c.borderColor,
          ]),
          partsOf(shot, type, "Input").map((part) => part.c.borderColor),
        ]),
      );
    for (let i = 0; i < 10; i += 1) {
      await page.evaluate(() =>
        window.__COMPOSITION_CATALOG__.workspace.undo(),
      );
      await page.waitForTimeout(250);
      if (fills(await snap()) === fills(before)) break;
    }
    await page.waitForTimeout(800);
    const undone = await snap();
    const undoneBad = mismatches(undone);
    const paint = (shot) =>
      JSON.stringify(
        TYPES.map((type) =>
          partsOf(shot, type, "Button").map((part) => part.p.background),
        ),
      );
    record(
      "undo",
      undoneBad.length === 0 &&
        fills(undone) === fills(before) &&
        paint(undone) === paint(before),
      { undoneBad, fills: fills(undone), paint: paint(undone) },
    );
  });
}
record("errors", errors.length === 0, errors.slice(0, 8));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ base: BASE, results, preview, chrome }, null, 1),
);
await browser.close();
process.exit(results.every((result) => result.pass) ? 0 : 1);

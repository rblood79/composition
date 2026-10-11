// G5 example 7 — Checkbox vanilla (react-aria.adobe.com Checkbox.md): CheckboxField > CheckboxButton
// (div.indicator > svg + text) + Description + FieldError. States: default · selected · indeterminate
// · invalid. Fixed difference (user decision 2026-10-09 「Icon div · 글자 span 유지」): the button's
// text is a builder text node (`span.react-aria-Label`) where the reference writes bare text.
import { edit, launch, newProject, place, reopen } from "./harness.mjs";
import { compareCase, summarize } from "./helpers-b.mjs";

const BASE = { children: "Subscribe", description: "Get the newsletter" };
const CASES = [
  // (The palette Checkbox shows its origin's `selected` display state until the author sets
  //  `isSelected` — resolver.ts DISPLAY_STATE_PROPS, 2026-10-09: an unselected box is authored.)
  ["Checkbox default", { isSelected: false }],
  ["Checkbox selected", { isSelected: true }],
  ["Checkbox indeterminate", { isSelected: false, isIndeterminate: true }],
  ["Checkbox invalid", { isSelected: false, isInvalid: true }],
];

const reference = (state) =>
  `(h, R) => h(R.CheckboxField, ${JSON.stringify(state)},
    h(R.CheckboxButton, null,
      h("div", { className: "indicator" }, h("svg", { "aria-hidden": "true" })),
      "Subscribe"),
    h(R.Text, { slot: "description" }, "Get the newsletter"),
    h(R.FieldError))`;

export async function run(page) {
  const placed = [];
  for (const _ of CASES) placed.push(await place(page, "lib:definition:origin-component-checkbox"));
  const edits = [];
  for (let i = 0; i < CASES.length; i++)
    edits.push(await edit(page, (c, ws, h, [source, props]) => h.props(h.bySource(source).id, props), [placed[i], { ...BASE, ...CASES[i][1] }]));
  const reopened = await reopen(page);
  const out = [];
  for (let i = 0; i < CASES.length; i++) {
    const s = CASES[i][1];
    const state = {
      ...(s.isSelected ? { defaultSelected: true } : {}),
      ...(s.isIndeterminate ? { isIndeterminate: true } : {}),
      ...(s.isInvalid ? { isInvalid: true } : {}),
    };
    out.push(await compareCase(page, CASES[i][0], placed[i], reference(state), {
      unwrap: [".react-aria-CheckboxButton > span.react-aria-Label"],
    }));
  }
  const tree = await page.evaluate((source) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const dump = (id, d = 0) => {
      const r = root.canvasInputs.get(id);
      return `${"  ".repeat(d)}${root.typeOf(r)}${r.hidden ? " (hidden)" : ""}${r.showWhen ? " showWhen" : ""} ${typeof r.props.children === "string" ? r.props.children : ""}${r.props.iconName ? " icon=" + r.props.iconName : ""}\n` + r.children.map((k) => dump(k, d + 1)).join("");
    };
    return dump([...root.canvasInputs.values()].find((x) => x.sourceId === source).id);
  }, placed[2]);
  return { edits, reopened, out, tree };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { browser, page, errors } = await launch();
  await newProject(page, `g5-ex07-${Date.now()}`);
  const r = await run(page);
  console.log(summarize("ex07", r, errors));
  console.log(r.tree);
  await browser.close();
}

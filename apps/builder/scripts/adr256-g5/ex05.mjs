// G5 example 5 — TextField · SearchField vanilla (react-aria.adobe.com TextField.md · SearchField.md):
// Label · Input · Description · FieldError; SearchField's icon + Input + clear Button.
// States: default · invalid (empty error text — RAC's validation message) · disabled.
import { edit, launch, newProject, place, reopen } from "./harness.mjs";
import { compareCase, summarize } from "./helpers-b.mjs";

const CASES = [
  ["TextField default", "textfield", { label: "Name", description: "Your full name" }],
  ["TextField invalid", "textfield", { label: "Name", description: "Your full name", isInvalid: true }],
  ["TextField disabled", "textfield", { label: "Name", description: "Your full name", isDisabled: true }],
  ["SearchField default", "searchfield", { label: "Search", description: "" }],
  ["SearchField disabled", "searchfield", { label: "Search", description: "", isDisabled: true }],
];

// (referenceHtml sends `build.toString()` — a source string carries the state literally.)
const reference = (origin, state) =>
  origin === "textfield"
    ? `(h, R) => h(R.TextField, ${JSON.stringify(state)}, h(R.Label, null, "Name"), h(R.Input), h(R.Text, { slot: "description" }, "Your full name"), h(R.FieldError))`
    : `(h, R) => h(R.SearchField, ${JSON.stringify(state)}, h(R.Label, null, "Search"), h("svg", { "aria-hidden": "true" }), h(R.Input), h(R.Button, null, h("svg", { "aria-hidden": "true" })), h(R.FieldError))`;

export async function run(page) {
  const placed = [];
  for (const [, origin] of CASES) placed.push(await place(page, `lib:definition:origin-component-${origin}`));
  const edits = [];
  for (let i = 0; i < CASES.length; i++)
    edits.push(await edit(page, (c, ws, h, [source, props]) => h.props(h.bySource(source).id, { placeholder: "", ...props }), [placed[i], CASES[i][2]]));
  const reopened = await reopen(page);
  const out = [];
  for (let i = 0; i < CASES.length; i++) {
    const [label, origin, props] = CASES[i];
    const state = { ...(props.isInvalid ? { isInvalid: true } : {}), ...(props.isDisabled ? { isDisabled: true } : {}) };
    out.push(await compareCase(page, label, placed[i], reference(origin, state)));
  }
  return { edits, reopened, out };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { browser, page, errors } = await launch();
  await newProject(page, `g5-ex05-${Date.now()}`);
  const r = await run(page);
  console.log(summarize("ex05", r, errors));
  await browser.close();
}

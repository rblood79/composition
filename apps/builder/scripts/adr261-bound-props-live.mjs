// 2026-10-15 user report — a Create-component'd TextField's instance: Label · Description ·
// placeholder written in the Design panel reach the Canvas record and the Preview DOM in the same
// step (no later action).  BUILDER_URL=http://localhost:5173 node bound-props-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const state = JSON.parse(
  readFileSync(
    `${process.cwd()}/apps/builder/scripts/.auth-session.json`,
    "utf8",
  ),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail });
  process.stdout.write(
    `${ok ? "PASS" : "FAIL"} ${name}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}\n`,
  );
};
const wait = (ms) => page.waitForTimeout(ms);
const exec = (source, arg) =>
  page.evaluate(
    ({ source, arg }) =>
      new Function("cat", "arg", `return (${source})(cat, arg);`)(
        window.__COMPOSITION_CATALOG__,
        arg,
      ),
    { source, arg },
  );
const panel = () =>
  page.locator('.workspace-panel-frame[data-panel="properties"]');

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await wait(300);
await page.keyboard.type(`bound props ${Date.now()}`);
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await wait(1500);
const compare = page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await wait(2500);

const ids = await exec(`(cat) => {
  const ws = cat.workspace, c = cat.commands, g = ws.runtime.graph;
  const body = g.getEntry(ws.session.getSnapshot().pageId).children[0];
  const n = (id, def, extra = {}) => ({ kind: "node", id, definitionId: def, children: [], props: {}, visual: {}, sizing: {}, descendantOverrides: [], ...extra });
  const f = ws.newId("node"), cb = ws.newId("node");
  ws.execute(c.insertNodes({ parent: { kind: "node", id: body }, entries: [n(f, "lib:definition:origin-component-textfield"), n(cb, "lib:definition:origin-component-checkbox")], rootIds: [f, cb], newId: ws.newId }));
  ws.execute(c.createComponent({ id: f, name: "Field", newId: ws.newId }));
  ws.execute(c.createComponent({ id: cb, name: "Check", newId: ws.newId }));
  const I = ws.execute(c.duplicateNodes({ ids: [f], newId: ws.newId })).plan.selectAfter[0];
  const J = ws.execute(c.duplicateNodes({ ids: [cb], newId: ws.newId })).plan.selectAfter[0];
  return { f, cb, I, J };
}`);
/** Parts' text inside instance: Canvas records (Label children · Input placeholder · Description) and the Preview DOM of those records. */
const parts = async (I) => {
  const records = await exec(
    `(cat, a) => [...cat.workspace.root.domInputs.entries()].filter(([, r]) => r.instancePath[1] === a.I && /type-(Label|Description|Input)$/.test(r.definitionId)).map(([id, r]) => [r.definitionId.replace(/.*type-/, ""), id, r.definitionId.endsWith("Input") ? r.props.placeholder : r.props.children])`,
    { I },
  );
  const out = {};
  for (const [kind, id, text] of records) {
    const el = page
      .frameLocator("#previewFrame")
      .locator(`[data-catalog-id="${id}"]`)
      .first();
    const dom =
      kind === "Input"
        ? await el
            .getAttribute("placeholder", { timeout: 3000 })
            .catch(() => null)
        : (await el.textContent({ timeout: 3000 }).catch(() => null))?.trim();
    out[kind] = { canvas: text, dom };
  }
  return out;
};
const selectRoot = async (I) => {
  const id = await exec(
    `(cat, a) => { for (const id of cat.workspace.root.recordsOfSource(a.I)) return id; }`,
    { I },
  );
  await exec(`(cat, a) => cat.workspace.selectRecords([a.id])`, { id });
  await wait(700);
  const design = page
    .getByRole("button", { name: "Design", exact: true })
    .first();
  if (await design.isVisible().catch(() => false))
    await design.click().catch(() => {});
  await wait(300);
};
/** The Design panel's text input under the fieldset whose legend is `label` (the input itself has no name). */
const fieldInput = (label) =>
  panel()
    .locator("fieldset.properties-aria", {
      has: page.locator("legend", { hasText: new RegExp(`^${label}$`) }),
    })
    .locator("input, textarea")
    .first();
const typeField = async (label, value) => {
  const box = fieldInput(label);
  await box.click();
  await box.fill(value);
  await box.press("Enter");
  await wait(600);
};

check(
  "0 instance 기본 Label/placeholder/description (Canvas = DOM)",
  JSON.stringify(await parts(ids.I)).includes(
    '"Label":{"canvas":"Text Field","dom":"Text Field"}',
  ),
  await parts(ids.I),
);
await selectRoot(ids.I);
await page.screenshot({ path: `${OUT}/0-panel.png` });
await typeField("Label", "Name");
let p = await parts(ids.I);
check(
  "1 Label 입력 직후 Canvas record · Preview DOM = Name (다른 조작 없이)",
  p.Label?.canvas === "Name" && p.Label?.dom === "Name",
  p,
);
await page.screenshot({ path: `${OUT}/1-label.png` });
await typeField("Placeholder", "Your name");
p = await parts(ids.I);
check(
  "2 Placeholder 입력 직후 Input record · DOM placeholder = Your name",
  p.Input?.canvas === "Your name" && p.Input?.dom === "Your name",
  p,
);
await typeField("Description", "Required");
p = await parts(ids.I);
check(
  "3 Description 입력 직후 record · DOM = Required",
  p.Description?.canvas === "Required" && p.Description?.dom === "Required",
  p,
);
await page.screenshot({ path: `${OUT}/3-all.png` });
// Undo twice → description · placeholder back.
await page.keyboard.press("Escape");
await exec(`(cat) => { cat.workspace.undo(); cat.workspace.undo(); }`);
await wait(600);
p = await parts(ids.I);
check(
  "4 undo ×2 → placeholder · description 원복 · Label 유지",
  p.Label?.canvas === "Name" &&
    p.Input?.canvas === "Enter text..." &&
    p.Description?.canvas === "" &&
    p.Input?.dom === "Enter text...",
  p,
);
// Checkbox instance: its text (`children`) — the same command the panel runs (`setFields`).
await selectRoot(ids.J);
await exec(
  `(cat, a) => cat.workspace.execute(cat.commands.setFields({ targets: [{ kind: "node", id: a.J }], props: { children: { kind: "set", value: "Agree" } } }))`,
  { J: ids.J },
);
await wait(600);
const textName = "setFields";
p = await parts(ids.J);
check(
  "5 Checkbox instance 글자 입력 직후 Label record · DOM = Agree",
  p.Label?.canvas === "Agree" && p.Label?.dom === "Agree",
  { p, textName },
);
await page.screenshot({ path: `${OUT}/5-checkbox.png` });
// Origin untouched.
const origin = await parts(ids.f);
check(
  "6 원본 Field 의 Label 은 Text Field 그대로",
  origin.Label?.canvas === "Text Field",
  origin,
);
check("7 page/console errors 0", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
process.stdout.write(
  `\n${results.filter((r) => r.ok).length}/${results.length} PASS\n`,
);
await browser.close();

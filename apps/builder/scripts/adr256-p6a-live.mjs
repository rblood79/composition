// ADR-256 Phase 6a live — RAC Group as a catalog type in the real Builder with the Preview open
// (Compare Mode), headed Chrome: an owned Group (as pasted · AI insert) with two Buttons renders
// the reference `div.react-aria-Group[role=group]` in the Preview at the Canvas box size, takes
// RAC's disabled state without dimming (no paint of its own on either side), shows its props in
// the Design panel, and is not offered by the palette (layout grouping is a frame — ADR-130).
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p6a-live.mjs <out>
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

await newProject("ADR-256 P6a group");
const bodyId = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  return [...ws.root.canvasInputs.values()].find(
    (r) => ws.root.typeOf(r).toLowerCase() === "body",
  )?.id;
});
const built = await run((c, ws, at, bodyId) => {
  const set = (value) => ({ kind: "set", value });
  const n = (id, type, props = {}, children = []) => ({
    kind: "node",
    id,
    definitionId: `lib:definition:type-${type}`,
    children,
    props: Object.fromEntries(
      Object.entries(props).map(([k, v]) => [k, set(v)]),
    ),
    visual: {},
    sizing: {},
    descendantOverrides: [],
  });
  return c.insertNodes({
    parent: at(bodyId),
    entries: [
      n("project:node:p6a-group", "Group", {}, [
        "project:node:p6a-a",
        "project:node:p6a-b",
      ]),
      n("project:node:p6a-a", "Button", { children: "Alpha" }),
      n("project:node:p6a-b", "Button", { children: "Beta" }),
    ],
    rootIds: ["project:node:p6a-group"],
    newId: ws.newId,
  });
}, bodyId);
await compareOn();
const probe = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const group = [...root.canvasInputs.values()].find(
      (r) => r.sourceId === "project:node:p6a-group",
    );
    const box = group && root.getGeometry([group.id]).get(group.id);
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const dom = group
      ? doc?.querySelector(`[data-catalog-id="${CSS.escape(group.id)}"]`)
      : null;
    const r = dom?.getBoundingClientRect();
    const cs = dom ? getComputedStyle(dom) : null;
    return {
      type: group ? root.typeOf(group) : null,
      canvasSize: box ? [Math.round(box.width), Math.round(box.height)] : null,
      tag: dom ? `${dom.tagName.toLowerCase()}.${dom.className}` : null,
      role: dom?.getAttribute("role") ?? null,
      orientation: dom?.getAttribute("aria-orientation") ?? null,
      disabled: dom?.hasAttribute("data-disabled") ?? null,
      buttons: dom
        ? [...dom.children].map((c) => `${c.tagName.toLowerCase()}:${c.textContent}`)
        : [],
      domSize: r ? [Math.round(r.width), Math.round(r.height)] : null,
      background: cs?.backgroundColor ?? null,
      opacity: cs?.opacity ?? null,
      outline: cs?.outlineStyle ?? null,
    };
  });
const before = await probe();
record(
  "L-1 an owned Group renders the reference div.react-aria-Group[role=group] > button × 2 at the Canvas box size, no paint",
  built.ok &&
    before.type === "Group" &&
    before.tag === "div.react-aria-Group" &&
    before.role === "group" &&
    before.orientation === null &&
    JSON.stringify(before.buttons) === '["button:Alpha","button:Beta"]' &&
    JSON.stringify(before.canvasSize) === JSON.stringify(before.domSize) &&
    before.background === "rgba(0, 0, 0, 0)" &&
    before.outline === "none",
  { built, before },
);
const disabled = await run(
  (c) =>
    c.setFields({
      targets: [{ kind: "node", id: "project:node:p6a-group" }],
      props: { isDisabled: { kind: "set", value: true } },
    }),
  null,
);
await page.waitForTimeout(800);
const after = await probe();
record(
  "L-2 isDisabled reaches RAC's Group (data-disabled) and dims nothing (the Canvas draws no dimming either)",
  disabled.ok && after.disabled === true && after.opacity === "1",
  { disabled, after },
);
// The Design panel shows the Group's props when it is selected.
await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const group = [...ws.root.canvasInputs.values()].find(
    (r) => r.sourceId === "project:node:p6a-group",
  );
  ws.selectRecords([group.id]);
});
await page.waitForTimeout(800);
await page
  .getByRole("button", { name: "Design", exact: true })
  .first()
  .click()
  .catch(() => {});
await page.waitForTimeout(800);
const panel = await page.evaluate(() => {
  const text = document.body.innerText;
  return ["Disabled", "Invalid", "Read only", "Role"].map((word) => [
    word,
    new RegExp(word, "i").test(text),
  ]);
});
record(
  "L-3 the Design panel shows the Group's props (role · disabled · invalid · read-only)",
  panel.filter(([, found]) => found).length >= 3,
  { panel },
);
await page.screenshot({ path: `${OUT}/group.png` });
// The palette does not offer it (grouping is a frame — ADR-130).
const search = page.getByLabel("Search components");
if (!(await search.isVisible().catch(() => false)))
  await page.getByRole("button", { name: "Components", exact: true }).first().click();
await search.fill("group");
await page.waitForTimeout(500);
const offered = await page
  .locator(".list-item")
  .allInnerTexts()
  .then((texts) => texts.map((t) => t.trim()));
record(
  "L-4 the palette does not offer a bare Group",
  !offered.some((t) => /^group$/i.test(t)),
  { offered },
);
record("L-5 no page errors", errors.length === 0, { errors });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

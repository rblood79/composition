// ADR-256 Phase 6g live — Autocomplete is RAC `Autocomplete` (react-aria.adobe.com Autocomplete,
// "ListBox example": `Autocomplete > SearchField + ListBox`), in the real Builder with the Preview
// open (Compare Mode), headed Chrome. It has no element of its own: the Preview puts the SearchField
// and the ListBox in its parent's flow, and the Canvas lays it out as `display: contents` (engine
// CSS-DISPLAY-3 §2.5) — the boxes and their offsets are the same on both sides, also in a row with a
// gap (Chrome is the oracle for the engine's `contents`). Typing filters the list (the reference's
// `contains`), the first match takes virtual focus, and the tree stays after a reload.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p6g-live.mjs <out>
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
  // (Close the Components panel: it covers the Preview half in Compare Mode.)
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
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

const frame = () => page.frameLocator("#previewFrame");
/** Canvas page rect (parents' rects added) and Preview rect of each child of the n-th Autocomplete. */
const snapshot = (index = 0) =>
  page.evaluate((index) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const ac = [...root.canvasInputs.values()].filter(
      (r) => root.typeOf(r) === "Autocomplete",
    )[index];
    if (!ac) return null;
    const pageRect = (id) => {
      const own = root.getGeometry([id]).get(id);
      if (!own) return null;
      let x = own.x;
      let y = own.y;
      for (
        let p = root.canvasInputs.get(root.canvasInputs.get(id).parentId);
        p;
        p = root.canvasInputs.get(p.parentId)
      ) {
        const g = root.getGeometry([p.id]).get(p.id);
        if (!g) break;
        x += g.x;
        y += g.y;
      }
      return { x, y, w: own.width, h: own.height };
    };
    const elOf = (id) =>
      doc?.querySelector(`[data-catalog-id="${CSS.escape(id)}"]`);
    const domRect = (id) => {
      const r = elOf(id)?.getBoundingClientRect();
      return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
    };
    const kids = ac.children.map((id) => root.canvasInputs.get(id));
    const parentEl = elOf(ac.parentId);
    return {
      kinds: kids.map((k) => root.typeOf(k)),
      acElement: !!elOf(ac.id),
      // The Preview children of the Autocomplete's parent element (RAC focus-scope spans aside).
      parentChildren: parentEl
        ? [...parentEl.children]
            .filter((el) => el.getAttribute("data-catalog-id"))
            .map((el) =>
              root.typeOf(
                root.canvasInputs.get(el.getAttribute("data-catalog-id")),
              ),
            )
        : null,
      canvas: kids.map((k) => pageRect(k.id)),
      dom: kids.map((k) => domRect(k.id)),
      box: pageRect(ac.id),
    };
  }, index);
const round = (r) =>
  r && {
    x: Math.round(r.x),
    y: Math.round(r.y),
    w: Math.round(r.w),
    h: Math.round(r.h),
  };
/** Sizes equal and the second child's offset from the first equal (±1) on both sides. */
const sameLayout = (s) => {
  if (!s || s.canvas.some((r) => !r) || s.dom.some((r) => !r)) return false;
  const near = (a, b) => Math.abs(a - b) <= 1;
  const sizes = s.canvas.every(
    (c, i) => near(c.w, s.dom[i].w) && near(c.h, s.dom[i].h),
  );
  const off = (rs) => ({ dx: rs[1].x - rs[0].x, dy: rs[1].y - rs[0].y });
  const a = off(s.canvas);
  const b = off(s.dom);
  return sizes && near(a.dx, b.dx) && near(a.dy, b.dy);
};
const summary = (s) =>
  s && {
    ...s,
    canvas: s.canvas.map(round),
    dom: s.dom.map(round),
    box: round(s.box),
  };
const optionsText = () =>
  frame()
    .locator('[role="listbox"] [role="option"] [slot="label"]')
    .allTextContents();

await newProject("ADR-256 P6g autocomplete");
await addFromPalette("autocomplete");
await compareOn();
const s1 = await snapshot();
await page.screenshot({ path: `${OUT}/autocomplete-default.png` });
record(
  "L-1 palette 'autocomplete' adds Autocomplete > SearchField + ListBox; the Preview has no element for it — the SearchField and the ListBox sit in its parent's element",
  JSON.stringify(s1?.kinds) === JSON.stringify(["SearchField", "ListBox"]) &&
    s1.acElement === false &&
    JSON.stringify(s1.parentChildren) ===
      JSON.stringify(["SearchField", "ListBox"]),
  summary(s1),
);
record(
  "L-2 Canvas = Preview: the two boxes' sizes and the ListBox's offset from the SearchField (±1)",
  sameLayout(s1),
  summary(s1),
);
// L-3 typing filters the list (case-insensitive `contains`).
const input = frame().locator(".react-aria-SearchField input").first();
const before = await optionsText();
await input.fill("AR");
await page.waitForTimeout(500);
const filtered = await optionsText();
await page.screenshot({ path: `${OUT}/autocomplete-filtered.png` });
// L-4 the first match takes virtual focus (RAC: aria-activedescendant on the input).
const active = await page.evaluate(() => {
  const doc = document.querySelector("#previewFrame").contentDocument;
  const el = doc.querySelector(".react-aria-SearchField input");
  const id = el?.getAttribute("aria-activedescendant");
  const option = id ? doc.getElementById(id) : null;
  return {
    activedescendant: !!id,
    option: option?.querySelector('[slot="label"]')?.textContent ?? null,
    focused: option?.hasAttribute("data-focused") ?? false,
    controls:
      el?.getAttribute("aria-controls") ===
      doc.querySelector('[role="listbox"]')?.id,
  };
});
await input.fill("");
await page.waitForTimeout(500);
const restored = await optionsText();
record(
  "L-3 typing 'AR' filters the list to Starred · Archive; clearing restores all",
  JSON.stringify(before) === JSON.stringify(["Inbox", "Starred", "Archive"]) &&
    JSON.stringify(filtered) === JSON.stringify(["Starred", "Archive"]) &&
    JSON.stringify(restored) === JSON.stringify(before),
  { before, filtered, restored },
);
record(
  "L-4 the input controls the list and the first match has virtual focus (aria-activedescendant · data-focused)",
  active.controls &&
    active.activedescendant &&
    active.option === "Starred" &&
    active.focused,
  active,
);
// L-5 in a row with a gap the Autocomplete's children are the row's items (Chrome = engine).
const ROW = "project:node:p6g-row";
const AC2 = "project:node:p6g-ac";
const body = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  return [...ws.root.canvasInputs.values()].find(
    (r) => ws.root.typeOf(r) === "body",
  ).id;
});
const put = await run(
  (c, ws, at, { body, ROW, AC2 }) =>
    c.insertNodes({
      parent: at(body),
      entries: [
        {
          kind: "node",
          id: ROW,
          definitionId: "lib:definition:type-frame",
          children: [AC2],
          props: {},
          visual: {},
          layout: {
            display: { kind: "set", value: "flex" },
            flexDirection: { kind: "set", value: "row" },
            columnGap: { kind: "set", value: "24px" },
          },
          sizing: { width: { kind: "set", value: 900 } },
          descendantOverrides: [],
        },
        {
          kind: "node",
          id: AC2,
          definitionId: "lib:definition:origin-component-autocomplete",
          children: [],
          props: {},
          visual: {},
          sizing: {},
          descendantOverrides: [],
        },
      ],
      rootIds: [ROW],
      newId: ws.newId,
    }),
  { body, ROW, AC2 },
);
await page.waitForTimeout(1500);
const s2 = await snapshot(1);
await page.screenshot({ path: `${OUT}/autocomplete-row.png` });
record(
  "L-5 in a flex row with gap 24: the SearchField and the ListBox are the row's items, side by side 24 apart, on the Canvas as in Chrome",
  put.ok &&
    sameLayout(s2) &&
    Math.abs(s2.dom[1].x - (s2.dom[0].x + s2.dom[0].w) - 24) <= 1 &&
    Math.abs(s2.canvas[1].x - (s2.canvas[0].x + s2.canvas[0].w) - 24) <= 1,
  { put, s2: summary(s2) },
);
// Decision 11: after a reload the tree is the same.
await page.waitForTimeout(1500);
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(2500);
const s3 = await snapshot(0);
const s4 = await snapshot(1);
record(
  "L-6 after a reload both Autocompletes keep their children (SearchField + ListBox)",
  JSON.stringify(s3?.kinds) === JSON.stringify(["SearchField", "ListBox"]) &&
    JSON.stringify(s4?.kinds) === JSON.stringify(["SearchField", "ListBox"]),
  { s3: s3?.kinds, s4: s4?.kinds },
);
record("L-7 no page errors", errors.length === 0, { errors });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

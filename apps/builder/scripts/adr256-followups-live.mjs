// ADR-256 후속 live (사용자 2026-10-09 「8~19번 묶어서 수정해」) — A 날짜 · D 편집 in the real Builder
// (headed Chrome, Compare Mode opens the Preview): L-1 a DateRangePicker's start field is as wide on the
// Canvas as in the Preview (ko-KR literal spaces) · L-2 the open DatePicker's calendar has no frame of
// its own · L-3 the range dash is aria-hidden · L-4 Delete on a palette Tree's item removes it (the
// shortcut's plan — automation keys do not reach the Builder's shortcut scope) · L-5 a ToggleButton in
// a group: a Preview press shows its conditioned child · L-6 no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-followups-live.mjs <out>
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
const errorsAt = [];
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
async function addFromPalette(label, match = new RegExp(`^${label}$`, "i")) {
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page
      .getByRole("button", { name: "Components", exact: true })
      .first()
      .click();
  await search.fill(label);
  await page.waitForTimeout(300);
  await page
    .locator(".list-item", { hasText: match })
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
/** Run a catalog command in the page: `build(c, ws, find, arg)` returns the command. */
async function run(build, arg) {
  return page.evaluate(
    async ({ commands, build, arg }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      // `find(type, within)` — the first record of `type` (inside the first `within` record).
      const find = (type, within) => {
        const all = [...ws.root.canvasInputs.values()];
        const scope = within
          ? all.find((r) => ws.root.typeOf(r) === within)
          : undefined;
        const inScope = (r) => {
          if (!scope) return true;
          for (let c = r; c; c = ws.root.canvasInputs.get(c.parentId))
            if (c.id === scope.id) return true;
          return false;
        };
        return all.find((r) => ws.root.typeOf(r) === type && inScope(r));
      };
      try {
        ws.execute(
          new Function(
            "c",
            "ws",
            "find",
            "arg",
            `return (${build})(c, ws, find, arg);`,
          )(c, ws, find, arg),
        );
        await new Promise((r) => setTimeout(r, 500));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, build: build.toString(), arg },
  );
}
const preview = (fn, arg) =>
  page.evaluate(
    ({ fn, arg }) => {
      const doc = document.querySelector("#previewFrame")?.contentDocument;
      return new Function("doc", "arg", `return (${fn})(doc, arg);`)(doc, arg);
    },
    { fn: fn.toString(), arg },
  );
const press = async (selector) => {
  await page
    .frameLocator("#previewFrame")
    .locator(selector)
    .first()
    // (Compare Mode shrinks the Preview under the Builder header — RAC's virtual press.)
    .dispatchEvent("click");
  await page.waitForTimeout(800);
};
const closeOverlay = async () => {
  await page.frameLocator("#previewFrame").locator("body").press("Escape");
  await page.waitForTimeout(500);
};



const exec = (build, arg) =>
  page.evaluate(async ({ commands, build, arg }) => {
    const c = await import(commands);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    try {
      ws.execute(new Function("c", "ws", "arg", `return (${build})(c, ws, arg);`)(c, ws, arg));
      await new Promise((r) => setTimeout(r, 800));
      return { ok: true };
    } catch (error) {
      return { ok: false, code: error?.code ?? String(error) };
    }
  }, { commands, build: build.toString(), arg });
/** The first record of `type` (its source id, record id, props, visual, derived props, hidden). */
const canvas = (type, title) =>
  page.evaluate(({ type, title }) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const r = [...root.canvasInputs.values()].find(
      (x) => root.typeOf(x) === type && (title === undefined || x.props.title === title),
    );
    return r && { id: r.id, sourceId: r.sourceId, props: r.props, visual: r.visual, derived: r.derivedProps ?? null, hidden: !!r.hidden };
  }, { type, title });
/** Each section's Canvas panel shown, by its Disclosure's title. */
const canvasPanels = () =>
  page.evaluate(() => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return Object.fromEntries(
      [...root.canvasInputs.values()]
        .filter((r) => root.typeOf(r) === "DisclosurePanel")
        .map((p) => [String(root.canvasInputs.get(p.parentId).props.title), !p.hidden]),
    );
  });
const domExpanded = () =>
  preview((doc) => [...doc.querySelectorAll(".react-aria-Disclosure")].map((d) => d.hasAttribute("data-expanded")));
const frameEntry = (ws) => ({ kind: "node", id: ws.newId("node"), definitionId: "lib:definition:type-frame", children: [], props: {}, visual: {}, sizing: {}, descendantOverrides: [] });


// ── A: date pickers
await newProject(`adr256-followups-a-${Date.now()}`);
await compareOn();
await addFromPalette("date range picker");
await addFromPalette("date picker");
await page.waitForTimeout(2000);
const widths = await page.evaluate(() => {
  const root = window.__COMPOSITION_CATALOG__.workspace.root;
  const start = [...root.canvasInputs.values()].find(
    (r) => root.typeOf(r) === "DateInput" && root.typeOf(root.canvasInputs.get(root.canvasInputs.get(r.parentId).parentId)) === "DateRangePicker",
  );
  const doc = document.querySelector("#previewFrame")?.contentDocument;
  const dom = doc.querySelector(".react-aria-DateRangePicker .react-aria-DateInput");
  return { lang: doc.documentElement.lang, canvas: root.getGeometry([start.id]).get(start.id).width, dom: dom.getBoundingClientRect().width };
});
record(
  "L-1 DateRangePicker start field: Canvas width = Preview width (±1)",
  Math.abs(widths.canvas - widths.dom) <= 1,
  widths,
);
errorsAt.push(["L-1", errors.length]);

await press(".react-aria-DatePicker .react-aria-Button");
await page.waitForTimeout(800);
const calendar = await preview((doc) => {
  const cal = doc.querySelector('.react-aria-Popover[data-trigger="DatePicker"] .react-aria-Calendar');
  if (!cal) return null;
  const cs = getComputedStyle(cal);
  return { border: cs.borderTopWidth, padding: cs.paddingTop, background: cs.backgroundColor };
});
record(
  "L-2 open DatePicker: the calendar has no frame of its own inside the Popover (border 0 · padding 0)",
  calendar?.border === "0px" && calendar?.padding === "0px",
  calendar,
);
await closeOverlay();
errorsAt.push(["L-2", errors.length]);

const dash = await preview((doc) => {
  const span = [...doc.querySelectorAll(".react-aria-DateRangePicker .react-aria-Group span")].find((s) => s.textContent === "–");
  return span ? span.getAttribute("aria-hidden") : "missing";
});
record("L-3 DateRangePicker dash is aria-hidden in the Preview", dash === "true", { dash });
errorsAt.push(["L-3", errors.length]);

// ── D: editing
await newProject(`adr256-followups-d-${Date.now()}`);
await compareOn();
await addFromPalette("Tree");
await page.waitForTimeout(1500);
const shortcuts = `/@fs${REPO}/apps/builder/src/builder/catalogRuntime/shortcuts.ts`;
const deleted = await page.evaluate(async (path) => {
  const { runCatalogShortcut } = await import(path);
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const root = ws.root;
  const items = () => [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === "TreeItem" && !r.hidden);
  const before = items().length;
  const target = items().at(-1);
  ws.selectRecords([target.id]);
  const errors = [];
  const ran = runCatalogShortcut(ws, "delete", (e) => errors.push(String(e)));
  await new Promise((r) => setTimeout(r, 800));
  return { ran, before, after: items().length, gone: !items().some((r) => r.id === target.id), errors };
}, shortcuts);
await page.waitForTimeout(800);
const domItems = await preview((doc) => doc.querySelectorAll(".react-aria-TreeItem").length);
record(
  "L-4 Delete on a palette Tree's item (inside the instance): removed on Canvas and Preview",
  deleted.ran && deleted.gone && deleted.after === deleted.before - 1 && deleted.errors.length === 0 && domItems === deleted.after,
  { ...deleted, domItems },
);
errorsAt.push(["L-4", errors.length]);

const r5 = await page.evaluate(async (commands) => {
  const c = await import(commands);
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const body = [...ws.root.canvasInputs.values()].find((r) => r.sourceId.endsWith("home-body"));
  const id = (n) => `project:node:fu-${n}`;
  const t = (type) => `lib:definition:type-${type}`;
  const node = (n, definitionId, children, props = {}, showWhen) => ({
    kind: "node", id: id(n), definitionId, children: children.map(id),
    props: Object.fromEntries(Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }])),
    visual: {}, sizing: {}, descendantOverrides: [], ...(showWhen ? { showWhen } : {}),
  });
  try {
    ws.execute(c.insertNodes({
      parent: { kind: "node", id: body.sourceId },
      entries: [
        node("g", t("ToggleButtonGroup"), ["a", "b"], { selectionMode: "single" }),
        node("a", t("ToggleButton"), ["on"], { children: "A" }),
        node("on", "lib:definition:text", [], { children: "On" }, { all: ["isSelected"] }),
        node("b", t("ToggleButton"), [], { children: "B", isSelected: true }),
      ],
      rootIds: [id("g")],
      newId: ws.newId,
    }));
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error?.code ?? String(error) };
  }
}, commands);
await page.waitForTimeout(1500);
const onShown = () => preview((doc) => !!doc.querySelector('[data-catalog-id$="::project:node:fu-on"]'));
const before5 = await onShown();
await press('[data-catalog-id$="::project:node:fu-a"]');
const after5 = await onShown();
await press('[data-catalog-id$="::project:node:fu-b"]');
const back5 = await onShown();
record(
  "L-5 ToggleButtonGroup: pressing A in the Preview shows its conditioned child · pressing B hides it",
  r5.ok && before5 === false && after5 === true && back5 === false,
  { r5, before5, after5, back5 },
);
errorsAt.push(["L-5", errors.length]);
record("L-6 no page errors", errors.length === 0, { errorsAt, errors: errors.slice(0, 3) });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

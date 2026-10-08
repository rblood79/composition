// ADR-256 Phase 8 판독 (Round 18) live — the four repairs in the real Builder (headed Chrome, Compare
// Mode opens the Preview): L-1 · L-2 a Disclosure in a frame inside a DisclosureGroup follows the
// group (H1) · L-3 a frame around the Heading keeps the trigger's box and the turned chevron (M1) ·
// L-4 the trigger's authored isDisabled · text (M2) · L-5 a replaced Icon does not turn (M3) · L-6 no
// errors · L-7 a Tree's replaced chevron Icon does not turn either.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p8r18-live.mjs <out>
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

// ── H1: DisclosureGroup, detached, Section 2 in a frame
await newProject(`adr256-p8r18-a-${Date.now()}`);
await compareOn();
await addFromPalette("Disclosure", /^Disclosure ?Group$/i);
await page.waitForTimeout(1500);
const group = await canvas("DisclosureGroup");
const rd = await exec((c, ws, id) => c.detachInstances({ ids: [id], newId: ws.newId }), group.sourceId);
const s2 = await canvas("Disclosure", "Section 2");
const rf = await exec(
  (c, ws, id) => c.groupNodes({ ids: [id], group: { kind: "node", id: ws.newId("node"), definitionId: "lib:definition:type-frame", children: [], props: {}, visual: {}, sizing: {}, descendantOverrides: [] }, newId: ws.newId }),
  s2.sourceId,
);
await page.waitForTimeout(1000);
const p1 = await canvasPanels();
const e1a = await domExpanded();
const frameTrigger = await preview((doc) => {
  const sections = [...doc.querySelectorAll(".react-aria-Disclosure")];
  return sections.length;
});
// (the framed section's trigger: the second Disclosure in document order)
await page
  .frameLocator("#previewFrame")
  .locator(".react-aria-Disclosure")
  .nth(1)
  .locator("button[slot='trigger']")
  .dispatchEvent("click");
await page.waitForTimeout(800);
const e1b = await domExpanded();
record(
  "L-1 framed Section 2 in the group: Canvas both open · Preview both open → pressing it closes it",
  rd.ok && rf.ok && p1["Section 1"] && p1["Section 2"] && JSON.stringify(e1a) === "[true,true]" && JSON.stringify(e1b) === "[true,false]",
  { rd, rf, canvas: p1, before: e1a, after: e1b, sections: frameTrigger },
);
errorsAt.push(["L-1", errors.length]);

const r2 = await exec(
  (c, ws, id) => c.setFields({ targets: [{ kind: "node", id }], props: { allowsMultipleExpanded: { kind: "set", value: false } } }),
  group.sourceId,
);
await page.waitForTimeout(1200);
const p2 = await canvasPanels();
const e2 = await domExpanded();
record(
  "L-2 allowsMultipleExpanded false: the framed section is the group's — Canvas and Preview [open, closed]",
  r2.ok && p2["Section 1"] === true && p2["Section 2"] === false && JSON.stringify(e2) === "[true,false]",
  { r2, canvas: p2, dom: e2 },
);
errorsAt.push(["L-2", errors.length]);

// ── M1 · M2 · M3: Disclosure size lg, detached, Heading in a frame
await newProject(`adr256-p8r18-b-${Date.now()}`);
await compareOn();
await addFromPalette("Disclosure");
await page.waitForTimeout(1500);
const disclosure = await canvas("Disclosure");
const r3a = await exec((c, ws, id) => c.detachInstances({ ids: [id], newId: ws.newId }), disclosure.sourceId);
const r3b = await exec(
  (c, ws, id) => c.setFields({ targets: [{ kind: "node", id }], props: { size: { kind: "set", value: "lg" } } }),
  disclosure.sourceId,
);
await page.waitForTimeout(800);
const before = (await canvas("Button")).visual;
const heading = await canvas("Heading");
const r3c = await exec(
  (c, ws, id) => c.groupNodes({ ids: [id], group: { kind: "node", id: ws.newId("node"), definitionId: "lib:definition:type-frame", children: [], props: {}, visual: {}, sizing: {}, descendantOverrides: [] }, newId: ws.newId }),
  heading.sourceId,
);
await page.waitForTimeout(1200);
const after = (await canvas("Button")).visual;
const turn = () =>
  preview((doc) => {
    const svg = doc.querySelector(".react-aria-Disclosure button[slot='trigger'] svg");
    const button = doc.querySelector(".react-aria-Disclosure button[slot='trigger']");
    return svg && { rotate: getComputedStyle(svg).rotate, fontSize: getComputedStyle(button).fontSize, disabled: button.disabled, text: button.textContent };
  });
const t3 = await turn();
record(
  "L-3 Heading in a frame: Canvas trigger values unchanged (lg font, transparent) · Preview chevron 90deg",
  r3a.ok && r3b.ok && r3c.ok && JSON.stringify(before) === JSON.stringify(after) && t3?.rotate === "90deg",
  { before: { fontSize: before.fontSize, fill: before.fill ?? before.backgroundColor }, after: { fontSize: after.fontSize, fill: after.fill ?? after.backgroundColor }, same: JSON.stringify(before) === JSON.stringify(after), dom: t3 },
);
errorsAt.push(["L-3", errors.length]);

const trigger = await canvas("Button");
const r4 = await exec(
  (c, ws, id) => c.setFields({ targets: [{ kind: "node", id }], props: { isDisabled: { kind: "set", value: true }, children: { kind: "set", value: "Extra" } } }),
  trigger.sourceId,
);
await page.waitForTimeout(1200);
const t4 = await turn();
await press(".react-aria-Disclosure button[slot='trigger']");
const e4 = await domExpanded();
record(
  "L-4 trigger isDisabled + text: Preview button disabled · shows 「Extra」 · press keeps it open",
  r4.ok && t4?.disabled === true && /Extra/.test(t4?.text ?? "") && JSON.stringify(e4) === "[true]",
  { r4, dom: t4, expanded: e4 },
);
errorsAt.push(["L-4", errors.length]);

const icon = await canvas("Icon");
const r5 = await exec(
  (c, ws, id) => c.setFields({ targets: [{ kind: "node", id }], props: { iconName: { kind: "set", value: "arrow-up" } } }),
  icon.sourceId,
);
await page.waitForTimeout(1200);
const icon5 = await canvas("Icon");
const t5 = await turn();
record(
  "L-5 Icon replaced by arrow-up: Canvas draws arrow-up (no turned glyph) · Preview does not turn it",
  r5.ok && !icon5.derived?.iconName && t5?.rotate !== "90deg",
  { r5, canvasIcon: icon5.props.iconName, derived: icon5.derived, dom: t5?.rotate },
);
await page.screenshot({ path: `${OUT}/m-series.png` });

// ── Round 18 범위 밖 (Tree, Phase 5h): an expanded item's replaced chevron Icon does not turn
await newProject(`adr256-p8r18-c-${Date.now()}`);
await compareOn();
await addFromPalette("Tree");
await page.waitForTimeout(1500);
const treeTurn = () =>
  preview((doc) => {
    const button = doc.querySelector(".react-aria-TreeItem button[slot='chevron']");
    const icon = button?.querySelector(".react-aria-Icon");
    const svg = icon?.querySelector("svg");
    return svg && { glyph: icon.getAttribute("data-icon"), rotate: getComputedStyle(svg).rotate, expanded: button.closest(".react-aria-TreeItem").getAttribute("aria-expanded") };
  });
await press(".react-aria-TreeItem button[slot='chevron']");
const t7a = await treeTurn();
const chevronIcon = await page.evaluate(() => {
  const root = window.__COMPOSITION_CATALOG__.workspace.root;
  const r = [...root.canvasInputs.values()].find((x) => root.typeOf(x) === "Icon" && x.props.iconName === "chevron-right");
  return r.id;
});
const r7 = await exec(
  (c, ws, id) => c.setFields({ targets: [ws.positionOfRecord(id).target], props: { iconName: { kind: "set", value: "arrow-up" } } }),
  chevronIcon,
);
await page.waitForTimeout(1200);
const t7b = await treeTurn();
record(
  "L-7 Tree: the expanded chevron-right turns 90deg · replaced by arrow-up it does not (Canvas draws arrow-up too)",
  t7a?.expanded === "true" && t7a?.rotate === "90deg" && r7.ok && t7b?.glyph === "arrow-up" && t7b?.rotate !== "90deg",
  { before: t7a, r7, after: t7b },
);
errorsAt.push(["L-7", errors.length]);
record("L-6 no page errors", errors.length === 0, { errorsAt, errors: errors.slice(0, 3) });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

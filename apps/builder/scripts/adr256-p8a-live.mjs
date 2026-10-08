// ADR-256 Phase 8a live — a Popover's · Tooltip's arrow is an OverlayArrow node, in the real Builder
// (headed Chrome, Compare Mode opens the Preview): L-1 the placed origins hold the arrow node first,
// hidden on the Canvas · L-2 the Preview's open Popover draws it (RAC OverlayArrow, svg 12, placed) ·
// L-3 the Tooltip's (svg 8) · L-4 no Hide Arrow in the Popover's Properties · L-5 removing the node
// removes the Preview's arrow · L-6 saved and reopened the same · L-7 no page errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p8a-live.mjs <out>
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



const overlayProbe = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const all = [...root.canvasInputs.values()];
    const shape = (type) =>
      all
        .filter((r) => root.typeOf(r) === type)
        .map((r) => ({
          id: r.id,
          children: r.children.map((id) => {
            const c = root.canvasInputs.get(id);
            return { type: root.typeOf(c), hidden: c.hidden === true };
          }),
        }));
    return { popover: shape("Popover"), tooltip: shape("Tooltip") };
  });
const arrowIn = (selector) =>
  preview(
    (doc, selector) => {
      const overlay = doc.querySelector(selector);
      if (!overlay) return { open: false };
      const arrows = [...overlay.querySelectorAll(".react-aria-OverlayArrow")];
      const svg = arrows[0]?.querySelector("svg");
      const rect = arrows[0]?.getBoundingClientRect();
      return {
        open: true,
        arrows: arrows.length,
        width: svg?.getAttribute("width"),
        placement: arrows[0]?.getAttribute("data-placement"),
        box: rect ? [Math.round(rect.width), Math.round(rect.height)] : null,
        fill: svg ? getComputedStyle(svg).fill : null,
      };
    },
    selector,
  );
const openTooltip = () =>
  preview((doc) => {
    const button = [...doc.querySelectorAll("button")].find(
      (b) => b.textContent === "Hover me",
    );
    // (RAC opens a tooltip on a keyboard focus.)
    doc.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    button?.focus();
    return !!button;
  });

await newProject(`adr256-p8a-${Date.now()}`);
await compareOn();
await addFromPalette("Popover");
await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.selectRecords([]));
await addFromPalette("Tooltip");
await page.waitForTimeout(1000);

// L-1: the placed origins hold the arrow node first; the Canvas has no box for it.
const p1 = await overlayProbe();
const kinds = (list) => list[0]?.children.map((c) => c.type);
record(
  "L-1 Popover > OverlayArrow + Heading + Description · Tooltip > OverlayArrow + Description · arrow hidden on Canvas",
  JSON.stringify(kinds(p1.popover)) ===
    JSON.stringify(["OverlayArrow", "Heading", "Description"]) &&
    JSON.stringify(kinds(p1.tooltip)) ===
      JSON.stringify(["OverlayArrow", "Description"]) &&
    p1.popover[0].children[0].hidden &&
    p1.tooltip[0].children[0].hidden,
  p1,
);
errorsAt.push(["L-1", errors.length]);

// L-2: the Preview's open Popover draws the arrow node (RAC OverlayArrow, svg 12, placed).
await press("button:has-text('Open Popover')");
const a2 = await arrowIn(".react-aria-Popover");
record(
  "L-2 Preview Popover: one RAC OverlayArrow · svg 12 · placed (data-placement) · overlay fill",
  a2.open && a2.arrows === 1 && a2.width === "12" && !!a2.placement && a2.box?.[0] > 0,
  a2,
);
await closeOverlay();
errorsAt.push(["L-2", errors.length]);

// L-3: the Preview's open Tooltip draws its arrow node (svg 8).
await openTooltip();
await page.waitForTimeout(1200);
const a3 = await arrowIn(".react-aria-Tooltip");
record(
  "L-3 Preview Tooltip: one RAC OverlayArrow · svg 8 · placed",
  a3.open && a3.arrows === 1 && a3.width === "8" && !!a3.placement,
  a3,
);
await closeOverlay();
errorsAt.push(["L-3", errors.length]);

// L-4: the Properties of the placed Popover have no Hide Arrow (the node is the arrow).
const popoverRoot = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const all = [...ws.root.canvasInputs.values()];
  const trigger = all.find((r) => ws.root.typeOf(r) === "DialogTrigger");
  ws.selectRecords([trigger.id]);
  return trigger.id;
});
await page.waitForTimeout(800);
const design = page.getByRole("button", { name: "Design", exact: true }).first();
await design.click();
await page.waitForTimeout(1200);
writeFileSync(`${OUT}/l4-panel.png`, await page.screenshot());
const panel = await page.evaluate(() => document.body.innerText);
// (Close the Design panel: it covers the Preview half in Compare Mode.)
await design.click();
await page.waitForTimeout(500);
record(
  "L-4 placed Popover's Properties: Placement shown, no Hide Arrow",
  !!popoverRoot && /Placement/.test(panel) && !/Hide Arrow/i.test(panel),
  { placement: /Placement/.test(panel), hideArrow: /Hide Arrow/i.test(panel) },
);
errorsAt.push(["L-4", errors.length]);

// L-5: removing the Popover's arrow node removes the Preview's arrow (the overlay draws none).
const r5 = await page.evaluate(async ({ commands }) => {
  const c = await import(commands);
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const arrow = [...ws.root.canvasInputs.values()].find((r) => {
    if (ws.root.typeOf(r) !== "OverlayArrow") return false;
    return ws.root.typeOf(ws.root.canvasInputs.get(r.parentId)) === "Popover";
  });
  try {
    ws.execute(c.removeTargets({ targets: [ws.positionOfRecord(arrow.id).target] }));
    await new Promise((r) => setTimeout(r, 600));
    return { ok: true };
  } catch (error) {
    return { ok: false, code: error?.code ?? String(error) };
  }
}, { commands });
await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.selectRecords([]));
await page.waitForTimeout(800);
await press("button:has-text('Open Popover')");
const a5 = await arrowIn(".react-aria-Popover");
record(
  "L-5 arrow node removed → the open Popover has no arrow",
  r5.ok && a5.open && a5.arrows === 0,
  { r5, a5 },
);
await closeOverlay();
errorsAt.push(["L-5", errors.length]);

// L-6: saved and reopened the same (Popover without its arrow, Tooltip with).
await page.waitForTimeout(1500);
const projectUrl = page.url();
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
  timeout: 30000,
});
await page.waitForTimeout(2500);
const p6 = await overlayProbe();
record(
  "L-6 saved and reopened: Popover > Heading + Description · Tooltip > OverlayArrow + Description",
  page.url() === projectUrl &&
    JSON.stringify(kinds(p6.popover)) === JSON.stringify(["Heading", "Description"]) &&
    JSON.stringify(kinds(p6.tooltip)) === JSON.stringify(["OverlayArrow", "Description"]),
  p6,
);
record("L-7 no page errors", errors.length === 0, { errorsAt, errors: errors.slice(0, 3) });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

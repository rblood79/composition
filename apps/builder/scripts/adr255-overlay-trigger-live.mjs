// ADR-255 live: the palette's Popover · Tooltip are their trigger + the closed overlay. The real
// Builder + Preview (Compare Mode), headed Chrome, saved auth session.
// - Canvas and Preview both show the trigger Buttons (no open card / box)
// - in the Preview the Popover opens on its trigger's press (title · description inside), Escape
//   closes it; the Tooltip opens on its trigger's keyboard focus (Tab from the Popover's trigger)
// - the placed Popover's `placement` (its own Properties prop, bound to the overlay) moves the
//   open Popover to its trigger's right (the trigger sits at the frame's top: `top` would flip)
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr255-overlay-trigger-live.mjs <out-dir>
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
const errors = [];
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 1500)}\n`,
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
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
}
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
/** The placed overlays on the Canvas (root type, drawn children) and the Preview's state. */
const snap = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const g = ws.runtime.graph;
    const records = ws.root.canvasInputs;
    const typeOf = (r) => g.getDefinition(r.definitionId)?.name;
    const placed = [...records.values()]
      .filter(
        (r) =>
          r.sourceId.startsWith("project:node:") &&
          ["DialogTrigger", "TooltipTrigger"].includes(typeOf(r)),
      )
      .map((r) => ({
        node: r.sourceId,
        type: typeOf(r),
        children: r.children.map((id) => {
          const child = records.get(id);
          return {
            type: typeOf(child),
            hidden: child.hidden === true,
            text: child.props.children ?? null,
          };
        }),
      }));
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
    };
    const popover = doc?.querySelector(".react-aria-Popover");
    const tooltip = doc?.querySelector('[role="tooltip"]');
    const trigger = [...(doc?.querySelectorAll("button") ?? [])].find(
      (b) => b.textContent === "Open Popover",
    );
    return {
      placed,
      preview: {
        buttons: [...(doc?.querySelectorAll("button") ?? [])].map(
          (b) => b.textContent,
        ),
        popover: popover
          ? {
              title: popover.querySelector(".react-aria-Heading")?.textContent,
              text: popover.textContent,
              rect: rect(popover),
              placement: popover.getAttribute("data-placement"),
            }
          : null,
        tooltip: tooltip ? { text: tooltip.textContent } : null,
        trigger: rect(trigger),
      },
    };
  });

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-255 overlay trigger live");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);

let placed;
await step("setup", async () => {
  await addFromPalette("popover");
  await addFromPalette("tooltip");
  await page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first()
    .click();
  await page.waitForTimeout(3000);
  const now = await snap();
  placed = now.placed;
  writeFileSync(`${OUT}/1-setup.png`, await page.screenshot());
  const shape = now.placed.map(
    (p) =>
      `${p.type}:${p.children.map((c) => `${c.type}${c.hidden ? "(hidden)" : ""}`).join("+")}`,
  );
  record(
    "setup",
    JSON.stringify(shape) ===
      JSON.stringify([
        "DialogTrigger:Button+Popover(hidden)",
        "TooltipTrigger:Button+Tooltip(hidden)",
      ]) &&
      now.preview.buttons.includes("Open Popover") &&
      now.preview.buttons.includes("Hover me") &&
      !now.preview.popover &&
      !now.preview.tooltip,
    { shape, preview: now.preview.buttons },
  );
});
const frame = page.frameLocator("#previewFrame");
await step("popover-open", async () => {
  // (The Compare Mode overlay takes the pointer over the frame: RAC's press by keyboard.)
  await frame.getByRole("button", { name: "Open Popover" }).press("Enter");
  await page.waitForTimeout(1000);
  const now = await snap();
  writeFileSync(`${OUT}/2-popover-open.png`, await page.screenshot());
  record(
    "popover-open",
    now.preview.popover?.title === "Popover Title" &&
      now.preview.popover.text.includes("Popover content goes here.") &&
      now.preview.popover.rect.top >= now.preview.trigger.bottom,
    now.preview,
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600);
});
await step("tooltip-focus", async () => {
  // Focus is back on the Popover's trigger: Tab moves it (by keyboard) to the Tooltip's trigger.
  await frame.getByRole("button", { name: "Open Popover" }).focus();
  await page.keyboard.press("Tab");
  await page.waitForTimeout(800);
  const now = await snap();
  writeFileSync(`${OUT}/3-tooltip.png`, await page.screenshot());
  record(
    "tooltip-focus",
    now.preview.popover === null &&
      now.preview.tooltip?.text?.includes("Tooltip text"),
    now.preview,
  );
});
await step("popover-placement", async () => {
  await page.evaluate(
    async ([path, node]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const { setFields } = await import(/* @vite-ignore */ path);
      ws.execute(
        setFields({
          targets: [{ kind: "node", id: node }],
          props: { placement: { kind: "set", value: "right" } },
        }),
      );
    },
    [commands, placed[0].node],
  );
  await page.waitForTimeout(1500);
  await frame.getByRole("button", { name: "Open Popover" }).press("Enter");
  await page.waitForTimeout(1000);
  const now = await snap();
  writeFileSync(`${OUT}/4-popover-right.png`, await page.screenshot());
  record(
    "popover-placement",
    now.preview.popover?.placement === "right" &&
      now.preview.popover.rect.left >= now.preview.trigger.right,
    now.preview,
  );
  await page.keyboard.press("Escape");
});

writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
process.stdout.write(`errors: ${errors.length}\n${errors.join("\n")}\n`);
await browser.close();

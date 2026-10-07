// ADR-254 Phase 2 live: the five containers' titles and descriptions are Heading · Description
// origin instances. The real Builder + Preview (Compare Mode), headed Chrome, saved auth session.
// - the open Dialog (Preview: its trigger pressed) is named by its title (RAC aria-labelledby)
// - the Heading · Description origins' edits reach every title / description on the Canvas
//   (records) and in the Preview (computed style) for the containers that render DOM
//   (Popover · Tooltip render no DOM while closed — record only, ADR-254 R4)
// - the InlineAlert's size sizes its parts (sm/md/lg → title 14/16/18 · description 12/14/16)
// - undo returns
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr254-containers-live.mjs <out-dir>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const REPO = process.cwd();
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const PALETTE = ["dialog", "card", "inline alert", "popover", "tooltip"];
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
    `${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 2000)}\n`,
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
const ORIGIN = {
  heading: "lib:definition:origin-component-heading",
  description: "lib:definition:origin-component-description",
};
/** Every title / description record on the Canvas with its container, and the Preview's elements. */
const snap = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const g = ws.runtime.graph;
    const records = ws.root.canvasInputs;
    const typeOf = (r) => g.getDefinition(r.definitionId)?.name;
    const CONTAINERS = ["Dialog", "Popover", "Card", "InlineAlert", "Tooltip"];
    const containerOf = (r) => {
      for (let p = records.get(r.parentId); p; p = records.get(p.parentId))
        if (CONTAINERS.includes(typeOf(p))) return typeOf(p);
      return null;
    };
    const canvas = [];
    for (const r of records.values()) {
      if (!["heading", "description"].includes(r.bindingId)) continue;
      const container = containerOf(r);
      if (!container) continue;
      canvas.push({
        container,
        part: r.bindingId,
        instance: r.collapsedSourceIds?.[0] ?? null,
        text: r.props.children,
        color: r.visual.color,
        fontSize: r.visual.fontSize,
        fontWeight: r.visual.fontWeight,
      });
    }
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const preview = [];
    const dialog = doc?.querySelector('[role="dialog"]');
    for (const [container, selector] of [
      ["Dialog", '[role="dialog"]'],
      ["Card", ".react-aria-Card"],
      ["InlineAlert", ".react-aria-InlineAlert"],
    ]) {
      const host = doc?.querySelector(selector);
      if (!host) continue;
      for (const el of host.querySelectorAll(
        ".react-aria-Heading, [slot='description'], .react-aria-Description",
      )) {
        const cs = doc.defaultView.getComputedStyle(el);
        preview.push({
          container,
          part: el.matches(".react-aria-Heading") ? "heading" : "description",
          tag: el.tagName,
          text: el.textContent,
          color: cs.color,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
        });
      }
    }
    return {
      canvas,
      preview,
      dialog: dialog
        ? {
            ariaLabel: dialog.getAttribute("aria-label"),
            labelledBy: dialog.getAttribute("aria-labelledby"),
            title: dialog.getAttribute("aria-labelledby")
              ? doc.getElementById(dialog.getAttribute("aria-labelledby"))
                  ?.textContent
              : null,
            titleTag: doc.querySelector('[role="dialog"] .react-aria-Heading')
              ?.tagName,
          }
        : null,
    };
  });
const editOrigin = async (id, visual) => {
  await page.evaluate((id) => {
    window.__COMPOSITION_CATALOG__.workspace.showDefinition(id);
  }, id);
  await page.waitForTimeout(1500);
  await page.evaluate(
    async ([path, visual]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const { setFields } = await import(/* @vite-ignore */ path);
      const sample = ws.session.getSnapshot().selection[0];
      const r = ws.root.canvasInputs.get(sample.identity);
      ws.execute(
        setFields({
          targets: [{ kind: "node", id: r.sourceId }],
          visual: Object.fromEntries(
            Object.entries(visual).map(([k, v]) => [
              k,
              { kind: "set", value: v },
            ]),
          ),
        }),
      );
    },
    [commands, visual],
  );
  const impact = page.getByRole("button", { name: "Continue", exact: true });
  if ((await impact.count()) > 0) await impact.first().click();
  await page.waitForTimeout(500);
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.showDefinition(undefined),
  );
  await page.waitForTimeout(2500);
};
/** Press the Dialog's trigger in the Preview (the RAC overlay mounts the Dialog). */
const openDialog = async () => {
  const frame = page.frameLocator("#previewFrame");
  // (The Compare Mode overlay takes the pointer over the frame: RAC's press by keyboard.)
  await frame
    .getByRole("button", { name: "Open Dialog" })
    .first()
    .press("Enter");
  await page.waitForTimeout(1200);
};
const closeDialog = async () => {
  const frame = page.frameLocator("#previewFrame");
  const close = frame.getByRole("button", { name: "Close" });
  if ((await close.count()) > 0) await close.first().press("Enter");
  await page.waitForTimeout(800);
};
const rgb = (hex) =>
  `rgb(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")})`;

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-254 containers live");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);

let before;
await step("setup", async () => {
  for (const label of PALETTE) await addFromPalette(label);
  await page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first()
    .click();
  await page.waitForTimeout(3000);
  before = await snap();
  writeFileSync(`${OUT}/1-setup.png`, await page.screenshot());
  const instances = before.canvas.every(
    (row) =>
      row.instance ===
      (row.part === "heading"
        ? "lib:template:component-heading"
        : "lib:template:component-description"),
  );
  record("setup", before.canvas.length === 9 && instances, {
    canvas: before.canvas.map((r) => `${r.container}:${r.part}`),
    preview: before.preview.map((r) => `${r.container}:${r.part}`),
  });
});
await step("dialog-name", async () => {
  await openDialog();
  const now = await snap();
  writeFileSync(`${OUT}/2-dialog-open.png`, await page.screenshot());
  record(
    "dialog-name",
    now.dialog?.ariaLabel === null &&
      now.dialog?.title === "Dialog Title" &&
      now.dialog?.titleTag === "H2",
    now.dialog,
  );
});
await step("origin-edit", async () => {
  await closeDialog();
  await editOrigin(ORIGIN.heading, { color: "#ff0000" });
  await editOrigin(ORIGIN.description, { color: "#00aa00" });
  await openDialog();
  const now = await snap();
  writeFileSync(`${OUT}/3-origin-edit.png`, await page.screenshot());
  // The Card's description keeps its own color (the position's patch over the origin's).
  const want = (row) =>
    row.part === "heading"
      ? "#ff0000"
      : row.container === "Card"
        ? "#49454f"
        : "#00aa00";
  const canvasMisses = now.canvas
    .filter((row) => row.color !== want(row))
    .map((row) => `${row.container}:${row.part}:${row.color}`);
  const previewMisses = now.preview
    .filter((row) => row.color !== rgb(want(row)))
    .map((row) => `${row.container}:${row.part}:${row.color}`);
  record(
    "origin-edit",
    canvasMisses.length === 0 &&
      previewMisses.length === 0 &&
      now.canvas.length === 9 &&
      ["Dialog", "Card", "InlineAlert"].every((c) =>
        now.preview.some((row) => row.container === c),
      ),
    {
      canvasMisses,
      previewMisses,
      preview: now.preview.map((r) => `${r.container}:${r.part}:${r.color}`),
    },
  );
  await closeDialog();
});
await step("inline-alert-size", async () => {
  const sizes = {};
  for (const size of ["sm", "lg"]) {
    await page.evaluate(
      async ([path, size]) => {
        const ws = window.__COMPOSITION_CATALOG__.workspace;
        const g = ws.runtime.graph;
        const { setFields } = await import(/* @vite-ignore */ path);
        const alert = [...ws.root.canvasInputs.values()].find(
          (r) =>
            g.getDefinition(r.definitionId)?.name === "InlineAlert" &&
            r.sourceId.startsWith("project:node:"),
        );
        ws.execute(
          setFields({
            targets: [{ kind: "node", id: alert.sourceId }],
            props: { size: { kind: "set", value: size } },
          }),
        );
      },
      [commands, size],
    );
    await page.waitForTimeout(1500);
    const now = await snap();
    sizes[size] = {
      canvas: now.canvas
        .filter((r) => r.container === "InlineAlert")
        .map((r) => `${r.part}:${r.fontSize}/${r.fontWeight}`),
      preview: now.preview
        .filter((r) => r.container === "InlineAlert")
        .map((r) => `${r.part}:${r.fontSize}/${r.fontWeight}`),
    };
  }
  writeFileSync(`${OUT}/4-inline-alert-lg.png`, await page.screenshot());
  const expect = {
    sm: [
      ["heading:14/600", "description:12/400"],
      ["heading:14px/600", "description:12px/400"],
    ],
    lg: [
      ["heading:18/600", "description:16/400"],
      ["heading:18px/600", "description:16px/400"],
    ],
  };
  const pass = ["sm", "lg"].every(
    (size) =>
      JSON.stringify(sizes[size].canvas) === JSON.stringify(expect[size][0]) &&
      JSON.stringify(sizes[size].preview) === JSON.stringify(expect[size][1]),
  );
  record("inline-alert-size", pass, sizes);
});
await step("undo", async () => {
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());
    await page.waitForTimeout(600);
  }
  await page.waitForTimeout(1500);
  const now = await snap();
  record(
    "undo",
    JSON.stringify(now.canvas.map((r) => [r.color, r.fontSize])) ===
      JSON.stringify(before.canvas.map((r) => [r.color, r.fontSize])),
    { canvas: now.canvas.map((r) => `${r.container}:${r.part}:${r.color}`) },
  );
});

writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
process.stdout.write(`errors: ${errors.length}\n${errors.join("\n")}\n`);
await browser.close();

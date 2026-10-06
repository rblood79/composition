// ADR-253 Phase 1 live (G1 · G0 ④): the real Builder + Preview (Compare Mode), headed Chrome,
// saved auth session → /dashboard.
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
}
const BUTTON = "lib:definition:origin-component-button";
/** Every drawn Button record of the open page (Canvas records) and every Button in the Preview. */
const snap = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const canvas = [...ws.root.canvasInputs.values()]
      .filter((r) => r.definitionId === "lib:definition:type-Button")
      .map((r) => ({
        source: String(r.sourceId).split(":").pop(),
        depth: r.instancePath.length,
        bg: r.visual.backgroundColor ?? null,
        pt: r.visual.paddingTop ?? null,
      }));
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const preview = doc
      ? [...doc.querySelectorAll("button.react-aria-Button")].map((el) => {
          const cs = doc.defaultView.getComputedStyle(el);
          return {
            text: el.textContent.trim().slice(0, 12),
            bg: cs.backgroundColor,
            pt: cs.paddingTop,
          };
        })
      : null;
    return {
      view: ws.session.getSnapshot().definitionView ?? null,
      canvas,
      preview,
      visibility: document.visibilityState,
      dpr: devicePixelRatio,
    };
  });

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-253 P1 live");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);

let before, after, undone;
await step("setup", async () => {
  await addFromPalette("button");
  await page.keyboard.press("Escape");
  await addFromPalette("toolbar");
  await page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first()
    .click();
  await page.waitForTimeout(2500);
  before = await snap();
  writeFileSync(`${OUT}/1-before.png`, await page.screenshot());
  record(
    "setup",
    before.canvas.length >= 2 && (before.preview?.length ?? 0) >= 2,
    before,
  );
});
await step("edit-origin", async () => {
  // Open the Components page on the Button origin (the Navigator Components tab's action).
  const tab = page.getByRole("tab", { name: "Components", exact: true });
  let via = "ui";
  if (await tab.count()) {
    await tab.first().click();
    await page.waitForTimeout(500);
    const row = page
      .locator(".elementItem, [role=row], [role=treeitem]")
      .filter({ hasText: /^Button$/ })
      .first();
    if (await row.count()) await row.click();
    else via = "api";
  } else via = "api";
  if (via === "api")
    await page.evaluate(
      (id) => window.__COMPOSITION_CATALOG__.workspace.showDefinition(id),
      BUTTON,
    );
  await page.waitForTimeout(1500);
  const opened = await page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const s = ws.session.getSnapshot();
    return {
      view: s.definitionView ?? null,
      selection: s.selection.map((x) => String(x.identity)),
    };
  });
  writeFileSync(`${OUT}/2-components-page.png`, await page.screenshot());
  // The Design panel's fields of the selected origin sample (for the UI edit).
  const fields = await page.evaluate(() =>
    [...document.querySelectorAll("input[aria-label], [role=tab]")]
      .map(
        (el) =>
          `${el.tagName}|${el.getAttribute("role") ?? ""}|${el.getAttribute("aria-label") ?? el.textContent.trim()}|${el.value ?? ""}`,
      )
      .slice(0, 80),
  );
  writeFileSync(`${OUT}/fields.json`, JSON.stringify(fields, null, 1));
  // The edit itself: the same command the Styles panel issues on the selected sample (`setFields`
  // through `workspace.execute`, which rewrites it as the origin's project default).
  const wrote = await page.evaluate(
    async ([repo, id]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const { setFields } = await import(
        /* @vite-ignore */ `/@fs${repo}/packages/shared/src/catalog/commands/index.ts`
      );
      const sample = ws.session.getSnapshot().selection[0];
      const sourceId = ws.root.canvasInputs.get(sample.identity)?.sourceId;
      ws.execute(
        setFields({
          targets: [{ kind: "node", id: sourceId }],
          visual: {
            backgroundColor: { kind: "set", value: "#ff0000" },
            paddingTop: { kind: "set", value: 20 },
          },
        }),
      );
      const g = ws.runtime.graph;
      const project = g.getEntry(g.projectId);
      return {
        sourceId,
        overrides: project.overrideIds
          .map((o) => g.getEntry(o))
          .map((o) => ({ target: o.targetId, visual: o.visual })),
      };
    },
    [REPO, BUTTON],
  );
  await page.waitForTimeout(800);
  // The first edit of a component asks (the impact dialog): the user continues.
  const impact = page.getByRole("button", { name: "Continue", exact: true });
  const asked =
    (await impact.count()) > 0
      ? await page
          .getByText(/will affect/)
          .first()
          .textContent()
      : null;
  if (asked) await impact.first().click();
  await page.waitForTimeout(500);
  writeFileSync(`${OUT}/3-origin-edited.png`, await page.screenshot());
  record(
    "edit-origin",
    opened.view !== null && wrote.overrides.some((o) => o.target === BUTTON),
    { via, asked, opened, wrote },
  );
});
await step("instances-follow", async () => {
  // Back to the page (the Navigator Pages tab's action).
  const tab = page.getByRole("tab", { name: "Pages", exact: true });
  if (await tab.count()) await tab.first().click();
  await page.waitForTimeout(400);
  if ((await snap()).view)
    await page.evaluate(() =>
      window.__COMPOSITION_CATALOG__.workspace.showDefinition(undefined),
    );
  await page.waitForTimeout(2500);
  after = await snap();
  writeFileSync(`${OUT}/4-after.png`, await page.screenshot());
  const canvasOk =
    after.canvas.length === before.canvas.length &&
    after.canvas.every((r) => r.bg === "#ff0000" && r.pt === 20);
  const previewOk =
    (after.preview?.length ?? 0) === before.preview.length &&
    after.preview.every((r) => r.bg === "rgb(255, 0, 0)" && r.pt === "20px");
  record("instances-follow", canvasOk && previewOk, {
    canvasOk,
    previewOk,
    after,
  });
});
await step("undo", async () => {
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.undo());
  await page.waitForTimeout(2000);
  undone = await snap();
  record(
    "undo",
    JSON.stringify(undone.canvas) === JSON.stringify(before.canvas) &&
      JSON.stringify(undone.preview) === JSON.stringify(before.preview),
    { undone },
  );
});
await step("state", async () => {
  // No panel writes a state style yet: the command writes the origin's hover style.
  await page.evaluate(
    async ([repo, id]) => {
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const { setLibraryDefault } = await import(
        /* @vite-ignore */ `/@fs${repo}/packages/shared/src/catalog/commands/index.ts`
      );
      ws.execute(
        setLibraryDefault({
          definitionId: id,
          scope: "stateRules",
          state: "hover",
          key: "backgroundColor",
          write: { kind: "set", value: "#123456" },
          newId: ws.newId,
        }),
      );
    },
    [REPO, BUTTON],
  );
  await page.waitForTimeout(1500);
  const rest = await snap();
  // Real hover in the Preview.
  // (The Builder's chrome sits over the iframe: move the real pointer to the button's centre.)
  const box = await page
    .frameLocator("#previewFrame")
    .locator("button.react-aria-Button")
    .first()
    .boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {
    steps: 8,
  });
  await page.waitForTimeout(600);
  const at = await page.evaluate(
    ([x, y]) => {
      const top = document.elementFromPoint(x, y);
      const frame = document.querySelector("#previewFrame");
      const rect = frame.getBoundingClientRect();
      const inner = frame.contentDocument.elementFromPoint(
        x - rect.x,
        y - rect.y,
      );
      return {
        top: `${top?.tagName}#${top?.id}.${String(top?.className).slice(0, 40)}`,
        frame: [rect.x, rect.y, rect.width, rect.height],
        inner: `${inner?.tagName}.${String(inner?.className).slice(0, 40)}`,
        point: [x, y],
      };
    },
    [box.x + box.width / 2, box.y + box.height / 2],
  );
  // The Builder's editing overlay takes the pointer over the iframe, so the hover is given to the
  // Preview document itself (RAC reads pointer events of type "mouse").
  await page.evaluate(() => {
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = doc.querySelector("button.react-aria-Button");
    for (const type of [
      "pointerover",
      "pointerenter",
      "mouseover",
      "mouseenter",
    ])
      el.dispatchEvent(
        new doc.defaultView.PointerEvent(type, {
          bubbles: type.endsWith("over"),
          pointerType: "mouse",
          view: doc.defaultView,
        }),
      );
  });
  await page.waitForTimeout(500);
  const hovered = await snap();
  const hoveredAttr = await page.evaluate(() =>
    document
      .querySelector("#previewFrame")
      .contentDocument.querySelector("button.react-aria-Button")
      .hasAttribute("data-hovered"),
  );
  // The Components page hover variant (Canvas): an instance of the origin shown hovered.
  await page.evaluate(
    (id) => window.__COMPOSITION_CATALOG__.workspace.showDefinition(id),
    BUTTON,
  );
  await page.waitForTimeout(1500);
  const cells = await page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    return [...ws.root.canvasInputs.values()]
      .filter(
        (r) =>
          r.definitionId === "lib:definition:type-Button" &&
          r.displayState &&
          String(r.sourceId).includes("origin-component-button/"),
      )
      .map((r) => ({
        state: r.displayState,
        bg: r.visual.backgroundColor ?? null,
        source: String(r.sourceId).slice(-40),
      }));
  });
  writeFileSync(`${OUT}/5-components-hover.png`, await page.screenshot());
  record(
    "state-canvas",
    cells.some((c) => c.state === "hover") &&
      cells
        .filter((c) => c.state === "hover")
        .every((c) => c.bg === "#123456") &&
      cells.filter((c) => c.state !== "hover").every((c) => c.bg !== "#123456"),
    { cells: cells.slice(0, 12) },
  );
  record("state-preview", hovered.preview[0].bg === "rgb(18, 52, 86)", {
    hoveredAttr,
    at,
    rest: rest.preview[0],
    hovered: hovered.preview[0],
  });
});
await step("g0-select", async () => {
  // G0 ④ (F11): a Select placed on the page — how many options does the Preview's list hold?
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.showDefinition(undefined),
  );
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
  await addFromPalette("select");
  await page.waitForTimeout(2000);
  const canvasItems = await page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const g = ws.runtime.graph;
    return [...ws.root.canvasInputs.values()]
      .filter((r) => g.getDefinition(r.definitionId)?.name === "ListBoxItem")
      .map((r) => r.props.children ?? r.props.label ?? null);
  });
  const opened = await page.evaluate(() => {
    const frame = document.querySelector("#previewFrame");
    const doc = frame.contentDocument;
    const trigger = doc.querySelector(".react-aria-Select button");
    if (!trigger) return { trigger: false };
    frame.contentWindow.focus();
    trigger.focus();
    return { trigger: true, focused: doc.activeElement === trigger };
  });
  // (The Builder's overlay takes the pointer: the key goes to the trigger in the Preview frame.)
  await page
    .frameLocator("#previewFrame")
    .locator(".react-aria-Select button")
    .first()
    .press("Enter");
  await page.waitForTimeout(1200);
  const list = await page.evaluate(() => {
    const doc = document.querySelector("#previewFrame").contentDocument;
    return {
      expanded: doc
        .querySelector(".react-aria-Select button")
        ?.getAttribute("aria-expanded"),
      listbox: doc.querySelectorAll("[role=listbox]").length,
      options: [...doc.querySelectorAll("[role=option]")].map((o) =>
        o.textContent.trim(),
      ),
    };
  });
  writeFileSync(`${OUT}/6-select-open.png`, await page.screenshot());
  record("g0-select", true, { canvasItems, opened, list });
});
record("errors", errors.length === 0, {
  count: errors.length,
  errors: errors.slice(0, 10),
});
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ base: BASE, results, errors }, null, 2),
);
await browser.close();
process.exit(0);

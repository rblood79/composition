// ADR-256 Phase 10b live — the S2 groups in the real Builder (headed Chrome, Compare Mode opens the
// Preview): L-1 CardView = RAC GridList of Card rows, Canvas = Preview boxes · L-2 the view's
// selection (selectionMode + a Card's isSelected) on both · L-3 pressing a Preview card selects it
// (RAC) · L-4 a ButtonGroup takes a Text (both consumers) · L-5 reopened · L-6 no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p10b-live.mjs <out>
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
  await page.locator(".list-item", { hasText: match }).first().click();
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
  page.evaluate(
    async ({ commands, build, arg }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      try {
        ws.execute(
          new Function("c", "ws", "arg", `return (${build})(c, ws, arg);`)(
            c,
            ws,
            arg,
          ),
        );
        await new Promise((r) => setTimeout(r, 800));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, build: build.toString(), arg },
  );

const near = (a, b, tol = 1) =>
  !!a &&
  !!b &&
  a.length === b.length &&
  a.every((v, i) => Math.abs(v - b[i]) <= tol);
const viewCanvas = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const all = [...root.canvasInputs.values()];
    const view = all.find((r) => root.typeOf(r) === "CardView");
    if (!view) return null;
    const cards = view.children.map((id) => root.canvasInputs.get(id));
    const g = root.getGeometry([view.id, ...cards.map((c) => c.id)]);
    return {
      id: view.id,
      cards: cards.map((c) => ({
        id: c.id,
        type: root.typeOf(c),
        selected: c.derivedProps?._isSelected ?? null,
        box: ["x", "y", "width", "height"].map(
          (k) => Math.round(g.get(c.id)[k] * 10) / 10,
        ),
      })),
    };
  });
const viewDom = () =>
  preview((doc) => {
    const grid = doc.querySelector(".react-aria-CardView");
    if (!grid) return null;
    const base = grid.getBoundingClientRect();
    return {
      role: grid.getAttribute("role"),
      rows: [...grid.children].map((row) => {
        const r = row.getBoundingClientRect();
        return {
          role: row.getAttribute("role"),
          name: row.getAttribute("aria-label") ?? row.textContent.slice(0, 20),
          selected: row.getAttribute("aria-selected"),
          box: [r.left - base.left, r.top - base.top, r.width, r.height].map(
            (v) => Math.round(v * 10) / 10,
          ),
        };
      }),
    };
  });

await newProject(`adr256-p10b-${Date.now()}`);
await compareOn();
await addFromPalette("Card View", /^Card ?View$/i);
await page.waitForTimeout(1500);

// L-1: CardView = RAC GridList (role grid) of its Cards (role row), Canvas = Preview boxes.
const c1 = await viewCanvas();
const d1 = await viewDom();
record(
  "L-1 CardView = RAC GridList of Card rows · Canvas = Preview card boxes",
  d1?.role === "grid" &&
    d1.rows.length === 3 &&
    d1.rows.every((r) => r.role === "row") &&
    c1?.cards.length === 3 &&
    c1.cards.every((c, i) => near(c.box, d1.rows[i].box)),
  { canvas: c1?.cards.map((c) => c.box), dom: d1 },
);
errorsAt.push(["L-1", errors.length]);

// L-2: selectionMode multiple + the first Card's isSelected → selected on both (Canvas paint state · RAC aria-selected).
const r2a = await exec(
  (c, ws, id) =>
    c.setFields({
      targets: [ws.positionOfRecord(id).target],
      props: { isSelected: { kind: "set", value: true } },
    }),
  c1.cards[0].id,
);
const c2a = await viewCanvas();
const d2a = await viewDom();
const r2b = await exec(
  (c, ws, id) =>
    c.setFields({
      targets: [ws.positionOfRecord(id).target],
      props: { selectionMode: { kind: "set", value: "multiple" } },
    }),
  c1.id,
);
await page.waitForTimeout(800);
const c2b = await viewCanvas();
const d2b = await viewDom();
record(
  "L-2 view selection: isSelected without selectionMode = none on both; with multiple = the first card on both",
  r2a.ok &&
    r2b.ok &&
    c2a.cards[0].selected === false &&
    !d2a.rows.some((r) => r.selected === "true") &&
    c2b.cards[0].selected === true &&
    d2b.rows[0].selected === "true" &&
    d2b.rows[1].selected !== "true",
  {
    before: {
      canvas: c2a.cards.map((c) => c.selected),
      dom: d2a.rows.map((r) => r.selected),
    },
    after: {
      canvas: c2b.cards.map((c) => c.selected),
      dom: d2b.rows.map((r) => r.selected),
    },
  },
);
errorsAt.push(["L-2", errors.length]);

// L-3: pressing the second card in the Preview selects it (RAC's run state).
await press(".react-aria-CardView > .react-aria-Card:nth-child(2)");
const d3 = await viewDom();
record(
  "L-3 Preview press selects the second card (RAC multiple selection)",
  d3?.rows[0].selected === "true" && d3?.rows[1].selected === "true",
  d3?.rows.map((r) => r.selected),
);
errorsAt.push(["L-3", errors.length]);

// L-4: a ButtonGroup takes a Text (free content — the limit row is gone): Canvas box and Preview child.
await addFromPalette("Button Group", /^Button ?Group$/i);
await page.waitForTimeout(1500);
const groupId = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  return [...ws.root.canvasInputs.values()].find(
    (r) => ws.root.typeOf(r) === "ButtonGroup",
  )?.id;
});
const r4 = await exec((c, ws, id) => {
  const note = ws.newId("node");
  return c.insertNodes({
    parent: ws.positionOfRecord(id).target,
    entries: [
      {
        kind: "node",
        id: note,
        definitionId: "lib:definition:text",
        children: [],
        props: { children: { kind: "set", value: "Note" } },
        visual: {},
        sizing: {},
        descendantOverrides: [],
      },
    ],
    rootIds: [note],
    newId: ws.newId,
  });
}, groupId);
const c4 = await page.evaluate((id) => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const group = ws.root.canvasInputs.get(id);
  const kids = group.children.map((k) => ws.root.canvasInputs.get(k));
  const g = ws.root.getGeometry(kids.map((k) => k.id));
  return kids.map((k) => [
    ws.root.typeOf(k),
    k.props.children ?? null,
    Math.round(g.get(k.id).width),
  ]);
}, groupId);
const d4 = await preview((doc) =>
  [...doc.querySelectorAll('[role="group"]')].map((g) => g.textContent),
);
record(
  "L-4 ButtonGroup takes a Text: Canvas [Button, Button, Text] with a box · Preview group shows it",
  r4.ok &&
    JSON.stringify(c4.map((k) => k[0])) === '["Button","Button","Text"]' &&
    c4[2][2] > 0 &&
    d4.some((t) => t.includes("Note")),
  { r4, canvas: c4, dom: d4 },
);
errorsAt.push(["L-4", errors.length]);

// L-5: saved and reopened the same.
await page.waitForTimeout(1500);
const projectUrl = page.url();
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(2500);
const c5 = await viewCanvas();
const c5g = await page.evaluate((id) => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const group = [...ws.root.canvasInputs.values()].find(
    (r) => ws.root.typeOf(r) === "ButtonGroup",
  );
  return group?.children.map((k) =>
    ws.root.typeOf(ws.root.canvasInputs.get(k)),
  );
});
record(
  "L-5 saved and reopened: the first card selected · the group's Text",
  page.url() === projectUrl &&
    c5?.cards[0].selected === true &&
    JSON.stringify(c5g) === '["Button","Button","Text"]',
  { cards: c5?.cards.map((c) => c.selected), group: c5g },
);
record("L-6 no page errors", errors.length === 0, {
  errorsAt,
  errors: errors.slice(0, 3),
});
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

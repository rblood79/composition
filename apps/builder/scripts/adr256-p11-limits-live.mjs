// ADR-256 Phase 11 live — the limit table's last rows in the real Builder (headed Chrome, Compare
// Mode opens the Preview). Per family: the original's Canvas child types · the Preview's elements ·
// inserting a Text (a child the row does not list) → accepted or refused, and where it shows.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p11-limits-live.mjs <out>
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

// [type, palette label | definition id (no palette entry — the AI · paste path)]
const FAMILIES = [
  ["ColorSwatchPicker", "lib:definition:origin-component-colorswatchpicker"],
  ["TableView", "Table View", /^Table ?View$/i],
  ["Pagination", "Pagination", /^Pagination$/i],
  ["Toast", "lib:definition:type-Toast"],
  ["ColorPicker", "lib:definition:type-ColorPicker"],
];
async function addByDefinition(definitionId) {
  return page.evaluate(
    async ({ commands, definitionId }) => {
      const { insertNodes } = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const body = [...ws.root.canvasInputs.values()].find((r) =>
        r.sourceId.endsWith("home-body"),
      );
      const id = ws.newId("node");
      try {
        ws.execute(
          insertNodes({
            parent: { kind: "node", id: body.sourceId },
            entries: [
              {
                kind: "node",
                id,
                definitionId,
                children: [],
                props: {},
                visual: {},
                sizing: {},
                descendantOverrides: [],
              },
            ],
            rootIds: [id],
            newId: ws.newId,
          }),
        );
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, definitionId },
  );
}
const EXPECT_FREE = new Set(
  (process.env.EXPECT_FREE ?? "").split(",").filter(Boolean),
);

const tree = (type) =>
  page.evaluate((type) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const node = [...root.canvasInputs.values()]
      .reverse()
      .find((r) => root.typeOf(r) === type);
    if (!node) return null;
    const ids = [node.id, ...node.children];
    const g = root.getGeometry(ids);
    return {
      id: node.id,
      children: node.children.map((id) => {
        const k = root.canvasInputs.get(id);
        const b = g.get(id);
        return [
          root.typeOf(k),
          b ? Math.round(b.width) : null,
          b ? Math.round(b.height) : null,
        ];
      }),
    };
  }, type);
const domOf = (id) =>
  preview(
    (doc, id) => {
      const el = doc.querySelector(`[data-catalog-id="${id}"]`);
      if (!el) return null;
      return {
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute("role"),
        className: el.className?.baseVal ?? el.className,
        text: el.textContent.slice(0, 80),
        kids: [...el.querySelectorAll("[data-catalog-id]")].length,
      };
    },
    id,
  );
const domHas = (id) =>
  preview(
    (doc, id) => {
      const el = doc.querySelector(`[data-catalog-id="${id}"]`);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { text: el.textContent, w: Math.round(r.width), h: Math.round(r.height) };
    },
    id,
  );

await newProject(`adr256-p11-${Date.now()}`);
await compareOn();
for (const [type, label, match] of FAMILIES) {
  if (label.startsWith("lib:definition:")) {
    const added = await addByDefinition(label);
    if (!added.ok) record(`${type} added`, false, added);
  } else await addFromPalette(label, match);
  await page.waitForTimeout(1500);
  const before = await tree(type);
  if (!before) {
    record(`${type} added`, false, "not on the page");
    continue;
  }
  const dom = await domOf(before.id);
  const textId = await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.newId("node"),
  );
  const insert = await exec(
    (c, ws, [parent, note]) =>
      c.insertNodes({
        parent: ws.positionOfRecord(parent).target,
        entries: [
          {
            kind: "node",
            id: note,
            definitionId: "lib:definition:text",
            children: [],
            props: { children: { kind: "set", value: "P11 note" } },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootIds: [note],
        newId: ws.newId,
      }),
    [before.id, textId],
  );
  const after = await tree(type);
  const textRecord = await page.evaluate((parent) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const p = ws.root.canvasInputs.get(parent);
    const id = p.children.find(
      (k) => ws.root.typeOf(ws.root.canvasInputs.get(k)) === "Text",
    );
    if (!id) return null;
    const b = ws.root.getGeometry([id]).get(id);
    return { id, w: Math.round(b?.width ?? 0), h: Math.round(b?.height ?? 0) };
  }, before.id);
  const textDom = textRecord ? await domHas(textRecord.id) : null;
  const free = EXPECT_FREE.has(type);
  record(
    `${type}: ${free ? "Text accepted · Canvas box · Preview element" : "Text refused (items only)"}`,
    free
      ? insert.ok &&
          textRecord?.w > 0 &&
          textDom?.text === "P11 note" &&
          textDom.w > 0
      : !insert.ok,
    { canvas: before.children, dom, insert, textRecord, textDom, after: after?.children.map((c) => c[0]) },
  );
  errorsAt.push([type, errors.length]);
}
record("no page errors", errors.length === 0, { errorsAt, errors: errors.slice(0, 5) });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

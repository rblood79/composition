// TagGroup maxRows live (사용자 2026-10-09 「TagGroup 프로퍼티 Max Rows 도 정상동작 되지 않고 있다」 →
// 「Canvas 에도 접힘」) — real Builder (headed Chrome, Compare Mode): at width 140 the Canvas and the
// Preview show the same tags and a "Show all (4)" box for maxRows 1 · 2 · 3, every tag for 0, and the
// same TagGroup height; the Design panel's Max Rows edits it; after a reload the same · no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/tag-group-maxrows-live.mjs <out>
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

await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i });

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Tag group max rows");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
await addFromPalette("tag group");
await compareOn();
const setGroup = (props, visual) =>
  exec(
    (c, ws, arg) => {
      const g = [...ws.root.canvasInputs.values()].find(
        (r) => ws.root.typeOf(r) === "TagGroup",
      );
      const map = (o) =>
        Object.fromEntries(
          Object.entries(o ?? {}).map(([k, v]) => [
            k,
            { kind: "set", value: v },
          ]),
        );
      return c.setFields({
        targets: [ws.positionOfRecord(g.id).target],
        props: map(arg.props),
        ...(arg.visual ? { visual: map(arg.visual) } : {}),
      });
    },
    { props, visual },
  );
const look = () =>
  page.evaluate(() => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const g = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "TagGroup",
    );
    const list = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "TagList",
    );
    const tags = [...root.canvasInputs.values()].filter(
      (r) => root.typeOf(r) === "Tag",
    );
    const showAll = root.tagShowAllInputs.get(list.id);
    const geo = root.getGeometry([g.id, ...(showAll ? [showAll.id] : [])]);
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = doc.querySelector(`[data-catalog-id="${g.id}"]`);
    const button = el.querySelector(".tag-show-all-btn");
    return {
      maxRows: g.props.maxRows,
      canvas: {
        shown: tags.filter((t) => !root.tagRowCollapsed(t.id)).length,
        showAll: showAll?.text ?? null,
        height: Math.round(geo.get(g.id).height),
      },
      preview: {
        shown: el.querySelectorAll('.react-aria-TagList [role="row"]').length,
        showAll: button?.textContent ?? null,
        height: Math.round(el.getBoundingClientRect().height),
      },
    };
  });
const same = (v) =>
  v.canvas.shown === v.preview.shown &&
  v.canvas.showAll === v.preview.showAll &&
  Math.abs(v.canvas.height - v.preview.height) <= 1;
await setGroup({ maxRows: 1 }, { width: 140 });
await page.waitForTimeout(1000);
for (const [maxRows, shown] of [
  [1, 1],
  [2, 2],
  [3, 3],
  [0, 4],
]) {
  await setGroup({ maxRows });
  await page.waitForTimeout(1000);
  const v = await look();
  record(
    `maxRows ${maxRows} at width 140: Canvas = Preview (${shown} tags${shown < 4 ? " + Show all (4)" : ""})`,
    same(v) &&
      v.canvas.shown === shown &&
      (shown < 4
        ? v.canvas.showAll === "Show all (4)"
        : v.canvas.showAll === null),
    v,
  );
  if (maxRows === 2) await page.screenshot({ path: `${OUT}/maxrows-2.png` });
}
// the Design panel's Max Rows field
await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  const g = [...ws.root.canvasInputs.values()].find(
    (r) => ws.root.typeOf(r) === "TagGroup",
  );
  ws.session.select([
    { identity: g.id, target: ws.positionOfRecord(g.id).target },
  ]);
});
await page
  .getByRole("button", { name: /^Design/ })
  .first()
  .click()
  .catch(() => {});
await page.waitForTimeout(1000);
const field = page
  .locator('fieldset:has(> legend:text-is("Max Rows")) input')
  .or(page.getByLabel("Max Rows"))
  .first();
await field.fill("2");
await field.press("Enter");
await page.waitForTimeout(1200);
const panel = await look();
record(
  "Design panel Max Rows 2: Canvas = Preview (2 tags + Show all (4))",
  same(panel) && panel.maxRows === 2 && panel.canvas.shown === 2,
  panel,
);
await page.waitForTimeout(1500);
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(2500);
await compareOn();
const reloaded = await look();
record(
  "reload: the same",
  same(reloaded) && reloaded.canvas.shown === 2,
  reloaded,
);
await page.screenshot({ path: `${OUT}/maxrows-reload.png` });
record("no errors", errors.length === 0, { errors: errors.slice(0, 6) });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors, url: page.url() }, null, 2),
);
await browser.close();

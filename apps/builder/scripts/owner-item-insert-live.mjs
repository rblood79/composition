// Owner "+" live (사용자 2026-10-09 「Tabs 의 경우 컴퍼넌트 상단 프러퍼티에 "+" 가 없고 tablist 에 slot "+"
// 가 있다, Taggroup 도 Tags 에 "+" 가 있다」) — real Builder (headed Chrome, Compare Mode): a selected
// Tabs' · TagGroup's Design panel offers "+" for its items (Insert Tab · Insert Tag); pressing it adds
// one in its TabList · TagList — on the Canvas and in the Preview (a Tab with its TabPanel; a TagGroup
// with maxRows counts the new Tag again — no stale Show all) · no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/owner-item-insert-live.mjs <out>
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
await page.keyboard.type("Owner item insert");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
const counts = (type, previewSelector) =>
  page.evaluate(
    ({ type, previewSelector }) => {
      const root = window.__COMPOSITION_CATALOG__.workspace.root;
      const records = [...root.canvasInputs.values()].filter(
        (r) => root.typeOf(r) === type,
      );
      const doc = document.querySelector("#previewFrame").contentDocument;
      return {
        canvas: records.length,
        parents: [
          ...new Set(
            records.map((r) => root.typeOf(root.canvasInputs.get(r.parentId))),
          ),
        ],
        preview: doc.querySelectorAll(previewSelector).length,
        showAll: doc.querySelector(".tag-show-all-btn")?.textContent ?? null,
        panels: [...root.canvasInputs.values()].filter(
          (r) => root.typeOf(r) === "TabPanel",
        ).length,
      };
    },
    { type, previewSelector },
  );
const selectType = (type) =>
  page.evaluate((type) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const r = [...ws.root.canvasInputs.values()].find(
      (x) => ws.root.typeOf(x) === type,
    );
    ws.session.select([
      { identity: r.id, target: ws.positionOfRecord(r.id).target },
    ]);
  }, type);
let compare = false;
for (const [palette, owner, item, list, selector] of [
  ["tabs", "Tabs", "Tab", "TabList", '[role="tab"]'],
  [
    "tag group",
    "TagGroup",
    "Tag",
    "TagList",
    '.react-aria-TagList [role="row"]',
  ],
]) {
  await page.evaluate(() =>
    window.__COMPOSITION_CATALOG__.workspace.session.clearSelection(),
  );
  await addFromPalette(palette);
  if (!compare) {
    await compareOn();
    compare = true;
  }
  await page.waitForTimeout(800);
  const before = await counts(item, selector);
  await selectType(owner);
  await page.waitForTimeout(800);
  const insert = page
    .getByRole("button", { name: `Insert ${item}`, exact: true })
    .first();
  // (The Design panel is a toggle: open it only when its "+" is not shown.)
  if (!(await insert.isVisible().catch(() => false))) {
    await page
      .getByRole("button", { name: /^Design/ })
      .first()
      .click()
      .catch(() => {});
    await page.waitForTimeout(1000);
  }
  const offered = await insert.isVisible().catch(() => false);
  if (offered) await insert.click();
  await page.waitForTimeout(1200);
  const after = await counts(item, selector);
  record(
    `${owner} selected: Design panel "+" (Insert ${item}) adds one in its ${list} (Canvas · Preview)`,
    offered &&
      after.canvas === before.canvas + 1 &&
      after.preview === before.preview + 1 &&
      after.showAll === null &&
      after.parents.length === 1 &&
      after.parents[0] === list &&
      (item !== "Tab" || after.panels === before.panels + 1),
    { offered, before, after },
  );
}
await page.screenshot({ path: `${OUT}/owner-insert.png` });
record("no errors", errors.length === 0, { errors: errors.slice(0, 6) });
writeFileSync(
  `${OUT}/results.json`,
  JSON.stringify({ results, errors, url: page.url() }, null, 2),
);
await browser.close();

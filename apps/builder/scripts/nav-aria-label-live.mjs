// Nav aria-label live (사용자 2026-10-09 「Nav aria-label vs label 진행해」) — real Builder (headed
// Chrome, Compare Mode): the palette Nav is `<nav aria-label="Navigation">`; its `aria-label` prop
// (the binding's accepts — the DOM used to read an unwritten `label`) names the Preview `<nav>`; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/nav-aria-label-live.mjs <out>
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
  await page
    .getByRole("button", { name: "Components", exact: true })
    .first()
    .click()
    .catch(() => {});
  await page.waitForTimeout(300);
}
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const setProps = (props) =>
  page.evaluate(
    async ({ commands, props }) => {
      const c = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const root = ws.root;
      const card = [...root.canvasInputs.values()].find(
        (r) => root.typeOf(r) === "Nav",
      );
      try {
        ws.execute(
          c.setFields({
            targets: [ws.positionOfRecord(card.id).target],
            props: Object.fromEntries(
              Object.entries(props).map(([k, v]) => [k, { kind: "set", value: v }]),
            ),
          }),
        );
        await new Promise((r) => setTimeout(r, 900));
        return { ok: true };
      } catch (error) {
        return { ok: false, code: error?.code ?? String(error) };
      }
    },
    { commands, props },
  );
const read = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const nav = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "Nav",
    );
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = doc.querySelector(`[data-catalog-id="${nav.id}"]`);
    return { tag: el.tagName, name: el.getAttribute("aria-label") };
  });

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Nav aria-label");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
await addFromPalette("navigation");
const compare = page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await page.waitForTimeout(3000);

const before = await read();
record("no name: <nav aria-label=Navigation>", before.tag === "NAV" && before.name === "Navigation", before);
const result = await setProps({ "aria-label": "Main" });
const named = await read();
record("aria-label prop names the <nav>", result.ok && named.name === "Main", { result, ...named });
await page.screenshot({ path: `${OUT}/named.png` });
record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

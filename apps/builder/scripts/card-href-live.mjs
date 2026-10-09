// Card href live (사용자 2026-10-09 「Card href 진행해」) — real Builder (headed Chrome, Compare Mode):
// the palette Card with an `href` is a RAC Link in the Preview (`a.react-aria-Card` with the href ·
// target), its text keeps the plain Card's look (no underline, same colours — the Canvas has no link
// paint), the Canvas box = the Preview box, and an empty href is a div again; no errors.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/card-href-live.mjs <out>
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
        (r) => root.typeOf(r) === "Card",
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
    const card = [...root.canvasInputs.values()].find(
      (r) => root.typeOf(r) === "Card",
    );
    const g = root.getGeometry([card.id]).get(card.id);
    const doc = document.querySelector("#previewFrame").contentDocument;
    const el = doc.querySelector(`[data-catalog-id="${card.id}"]`);
    const view = doc.defaultView;
    const r = el.getBoundingClientRect();
    const texts = [...el.querySelectorAll(".react-aria-Heading, [slot='description'], .react-aria-Text")].map(
      (node) => {
        const css = view.getComputedStyle(node);
        return {
          decoration: css.textDecorationLine,
          color: css.color,
        };
      },
    );
    return {
      canvas: { w: Math.round(g.width), h: Math.round(g.height) },
      dom: { w: Math.round(r.width), h: Math.round(r.height) },
      tag: el.tagName,
      href: el.getAttribute("href"),
      target: el.getAttribute("target"),
      decoration: view.getComputedStyle(el).textDecorationLine,
      color: view.getComputedStyle(el).color,
      texts,
    };
  });

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("Card href");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
await addFromPalette("card");
const compare = page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await page.waitForTimeout(3000);

const before = await read();
record("no href: a div", before.tag === "DIV" && before.href === null, before);
const result = await setProps({ href: "https://example.com", target: "_blank" });
const linked = await read();
record(
  "href: RAC Link a.react-aria-Card with href · target",
  result.ok &&
    linked.tag === "A" &&
    linked.href === "https://example.com" &&
    linked.target === "_blank",
  { result, ...linked },
);
record(
  "the link Card looks like the plain Card (no underline, same colours) — the Canvas draws no link paint",
  linked.decoration === "none" &&
    linked.color === before.color &&
    JSON.stringify(linked.texts) === JSON.stringify(before.texts),
  { before: { color: before.color, texts: before.texts }, linked: { decoration: linked.decoration, color: linked.color, texts: linked.texts } },
);
record(
  "Canvas box = Preview box (link Card)",
  Math.abs(linked.canvas.w - linked.dom.w) <= 1 &&
    Math.abs(linked.canvas.h - linked.dom.h) <= 1,
  { canvas: linked.canvas, dom: linked.dom },
);
await page.screenshot({ path: `${OUT}/linked.png` });
const cleared = await setProps({ href: "" });
const after = await read();
record("empty href: a div again", cleared.ok && after.tag === "DIV", after);
record("no errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

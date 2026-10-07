// ADR-256 Phase 5a live: a Breadcrumbs placed from the palette is the reference's RAC
// `Breadcrumb > Link + separator Icon (not on the current crumb)`. The Preview draws the Link with
// the crumb's href and no separator on the last crumb; the Canvas crumbs and labels sit where the
// Preview's do; a crumb added after the last moves the current crumb (both sides); the hover
// underline is the Preview's (Canvas rests without it); after a reload (contract 10) the same.
// Real Builder, headed Chrome.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p5a-breadcrumbs-live.mjs <out>
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
}
async function compareOn() {
  const button = page
    .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
    .first();
  if (await button.isVisible().catch(() => false)) await button.click();
  await page.waitForTimeout(3000);
}

await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await page.waitForTimeout(300);
await page.keyboard.type("ADR-256 P5a breadcrumbs");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
await addFromPalette("breadcrumbs");
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const crumbsId = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  return [...ws.root.canvasInputs.values()].find(
    (r) => ws.root.typeOf(r) === "Breadcrumbs",
  ).sourceId;
});
await compareOn();
const read = () =>
  page.evaluate((crumbsId) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const owner = [...(doc?.querySelectorAll("[data-catalog-id]") ?? [])].find(
      (e) => e.getAttribute("data-catalog-id").endsWith(`::${crumbsId}`),
    );
    const top = [...ws.root.canvasInputs.values()].find((r) => r.sourceId === crumbsId);
    const crumbs = top.children.map((c) => ws.root.canvasInputs.get(c));
    const abs = (rid) => {
      let x = 0, y = 0, cur = ws.root.canvasInputs.get(rid);
      while (cur && cur.id !== top.id) {
        const g = ws.root.getGeometry([cur.id]).get(cur.id);
        x += g.x; y += g.y;
        cur = ws.root.canvasInputs.get(cur.parentId);
      }
      return [Math.round(x), Math.round(y)];
    };
    const ob = owner?.getBoundingClientRect();
    return {
      preview: owner
        ? [...owner.querySelectorAll(":scope > li")].map((li) => {
            const a = li.querySelector(".react-aria-Link");
            const r = a?.getBoundingClientRect();
            return {
              text: a?.textContent,
              tag: a?.tagName.toLowerCase(),
              href: a?.getAttribute("href"),
              current: li.hasAttribute("data-current"),
              separator: !!li.querySelector(".react-aria-Icon"),
              at: r ? [Math.round(r.x - ob.x), Math.round(r.y - ob.y)] : null,
            };
          })
        : null,
      canvas: crumbs.map((crumb) => {
        const kids = crumb.children.map((c) => ws.root.canvasInputs.get(c));
        const link = kids.find((k) => ws.root.typeOf(k) === "Link");
        const sep = kids.find((k) => k.props.slot === "separator");
        return {
          text: link?.props.children,
          separator: !!sep && sep.hidden !== true,
          at: link ? abs(link.id) : null,
        };
      }),
    };
  }, crumbsId);
const r0 = await read();
record(
  "C-1 Preview: li > a.react-aria-Link (href) + separator, the last crumb current without one; Canvas the same order and separators",
  !!r0.preview &&
    JSON.stringify(r0.preview.map((c) => [c.text, c.separator, c.current])) ===
      JSON.stringify([["Home", true, false], ["Category", true, false], ["Page", false, true]]) &&
    r0.preview[0].href === "/" &&
    JSON.stringify(r0.canvas.map((c) => [c.text, c.separator])) ===
      JSON.stringify([["Home", true], ["Category", true], ["Page", false]]),
  r0,
);
record(
  "C-2 Canvas labels sit where the Preview's Links do (±1px)",
  r0.canvas.every((c, i) =>
    c.at.every((v, k) => Math.abs(v - r0.preview[i].at[k]) <= 1),
  ),
  { canvas: r0.canvas.map((c) => c.at), preview: r0.preview.map((c) => c.at) },
);
await page.evaluate(
  async ({ commands, crumbsId }) => {
    const { insertNodes } = await import(commands);
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const id = ws.newId("node");
    ws.execute(
      insertNodes({
        parent: { kind: "node", id: crumbsId },
        entries: [
          {
            kind: "node",
            id,
            definitionId: "lib:definition:origin-component-breadcrumb-item-default",
            children: [],
            props: { href: { kind: "set", value: "/more" } },
            visual: {},
            sizing: {},
            descendantOverrides: [],
          },
        ],
        rootIds: [id],
        newId: ws.newId,
      }),
    );
  },
  { commands, crumbsId },
);
await page.waitForTimeout(1500);
const r1 = await read();
record(
  "C-3 a crumb added after the last: Page shows its separator, the new crumb is current (both sides)",
  r1.preview?.length === 4 &&
    r1.preview[2].separator === true &&
    r1.preview[3].current === true &&
    r1.preview[3].separator === false &&
    r1.canvas[2].separator === true &&
    r1.canvas[3].separator === false,
  r1,
);
await page.waitForTimeout(1500);
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, {
  timeout: 30000,
});
await page.waitForTimeout(2500);
await compareOn();
const r2 = await read();
record(
  "C-4 reopened (contract 10): the same crumbs, Links and separators",
  JSON.stringify(r2.preview?.map((c) => [c.text, c.separator, c.current])) ===
    JSON.stringify(r1.preview.map((c) => [c.text, c.separator, c.current])) &&
    JSON.stringify(r2.canvas.map((c) => [c.text, c.separator])) ===
      JSON.stringify(r1.canvas.map((c) => [c.text, c.separator])),
  r2,
);
await page.screenshot({ path: `${OUT}/breadcrumbs.png` });
record("C-5 no page errors", errors.length === 0, { errors });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

// ADR-256 Phase 5c live: a ListBox placed from the palette is the reference's (example 1) — items
// with an icon, a label Text and a description Text that name and describe the option. The Canvas
// item labels sit where the Preview's do; an emptied description is gone on both sides (presentWhen)
// and comes back with text; after a reload (contract 12) the same. Real Builder, headed Chrome.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p5c-listbox-live.mjs <out>
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
await page.keyboard.type("ADR-256 P5c listbox");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1500);
await addFromPalette("list box");
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const listId = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  return [...ws.root.canvasInputs.values()].find((r) => ws.root.typeOf(r) === "ListBox").sourceId;
});
await compareOn();
const read = () =>
  page.evaluate((listId) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const owner = [...(doc?.querySelectorAll("[data-catalog-id]") ?? [])].find((e) =>
      e.getAttribute("data-catalog-id").endsWith(`::${listId}`),
    );
    const ob = owner?.getBoundingClientRect();
    const top = [...ws.root.canvasInputs.values()].find((r) => r.sourceId === listId);
    const abs = (rid) => {
      let x = 0, y = 0, cur = ws.root.canvasInputs.get(rid);
      while (cur && cur.id !== top.id) {
        const g = ws.root.getGeometry([cur.id]).get(cur.id);
        x += g.x; y += g.y;
        cur = ws.root.canvasInputs.get(cur.parentId);
      }
      return [Math.round(x), Math.round(y)];
    };
    return {
      preview: owner
        ? [...owner.querySelectorAll('[role="option"]')].map((o) => {
            const label = o.querySelector('[slot="label"]');
            const r = label.getBoundingClientRect();
            return {
              label: label.textContent,
              labelled: o.getAttribute("aria-labelledby") === label.id,
              description: o.querySelector('[slot="description"]')?.textContent ?? null,
              at: [Math.round(r.x - ob.x), Math.round(r.y - ob.y)],
            };
          })
        : null,
      canvas: top.children
        .map((c) => ws.root.canvasInputs.get(c))
        .map((item) => {
          const kids = item.children.map((c) => ws.root.canvasInputs.get(c));
          const label = kids.find((k) => k.props.slot === "label");
          const desc = kids.find((k) => k.props.slot === "description");
          return {
            label: label.props.children,
            description: desc && desc.hidden !== true ? desc.props.children : null,
            descId: desc?.id,
            at: abs(label.id),
          };
        }),
    };
  }, listId);
const r0 = await read();
record(
  "L-1 Preview options are named by their label Text and described; Canvas the same items",
  r0.preview?.length === 3 &&
    r0.preview.every((o) => o.labelled && o.description) &&
    JSON.stringify(r0.preview.map((o) => o.label)) === JSON.stringify(r0.canvas.map((c) => c.label)),
  r0,
);
record(
  "L-2 Canvas labels sit where the Preview's do (±1px)",
  r0.canvas.every((c, i) => c.at.every((v, k) => Math.abs(v - r0.preview[i].at[k]) <= 1)),
  { canvas: r0.canvas.map((c) => c.at), preview: r0.preview?.map((p) => p.at) },
);
const editDesc = (value) =>
  page.evaluate(
    async ({ commands, descId, value }) => {
      const { setFields } = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      ws.execute(
        setFields({
          targets: [ws.positionOfRecord(descId).target],
          props: { children: { kind: "set", value } },
        }),
      );
    },
    { commands, descId: r0.canvas[0].descId, value },
  );
await editDesc("");
await page.waitForTimeout(1500);
const r1 = await read();
record(
  "L-3 an emptied description is gone on both sides",
  r1.preview?.[0].description === null && r1.canvas[0].description === null,
  { preview: r1.preview?.[0], canvas: r1.canvas[0] },
);
await editDesc("Back again");
await page.waitForTimeout(1500);
const r2 = await read();
record(
  "L-4 text brings it back on both sides",
  r2.preview?.[0].description === "Back again" && r2.canvas[0].description === "Back again",
  { preview: r2.preview?.[0], canvas: r2.canvas[0] },
);
await page.waitForTimeout(1500);
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await page.waitForTimeout(2500);
await compareOn();
const r3 = await read();
record(
  "L-5 reopened (contract 12): the same items",
  JSON.stringify(r3.canvas.map((c) => [c.label, c.description])) ===
    JSON.stringify(r2.canvas.map((c) => [c.label, c.description])),
  r3.canvas,
);
record("L-6 no page errors", errors.length === 0, { errors });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

// ADR-256 Phase 5d live: a TagGroup placed from the palette is the reference's — each Tag holds a
// remove `Button[slot=remove]` node shown by the Tag's `allowsRemoving` (the TagGroup's), and the
// TagGroup's description · error message are its Description · FieldError part nodes (the
// reference's `Text[description]` · `Text[errorMessage]`). Canvas and Preview show and place them
// alike; the Preview's remove button removes the tag from the run (the document keeps it); after a
// reload (contract 13) the same. Real Builder, headed Chrome.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr256-p5d-taggroup-live.mjs <out>
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
await page.keyboard.type("ADR-256 P5d taggroup");
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
const commands = `/@fs${REPO}/packages/shared/src/catalog/commands/index.ts`;
const groupId = await page.evaluate(() => {
  const ws = window.__COMPOSITION_CATALOG__.workspace;
  return [...ws.root.canvasInputs.values()].find((r) => ws.root.typeOf(r) === "TagGroup").sourceId;
});
await compareOn();
const edit = (props) =>
  page.evaluate(
    async ({ commands, groupId, props }) => {
      const { setFields } = await import(commands);
      const ws = window.__COMPOSITION_CATALOG__.workspace;
      const record = [...ws.root.canvasInputs.values()].find((r) => r.sourceId === groupId);
      ws.execute(
        setFields({
          targets: [ws.positionOfRecord(record.id).target],
          props: Object.fromEntries(
            Object.entries(props).map(([key, value]) => [key, { kind: "set", value }]),
          ),
        }),
      );
    },
    { commands, groupId, props },
  );
const read = () =>
  page.evaluate((groupId) => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const root = ws.root;
    const doc = document.querySelector("#previewFrame")?.contentDocument;
    const owner = [...(doc?.querySelectorAll("[data-catalog-id]") ?? [])].find((e) =>
      e.getAttribute("data-catalog-id").endsWith(`::${groupId}`),
    );
    const ob = owner?.getBoundingClientRect();
    const top = [...root.canvasInputs.values()].find((r) => r.sourceId === groupId);
    const abs = (rid) => {
      let x = 0, y = 0, cur = root.canvasInputs.get(rid);
      while (cur && cur.id !== top.id) {
        const g = root.getGeometry([cur.id]).get(cur.id);
        x += g.x; y += g.y;
        cur = root.canvasInputs.get(cur.parentId);
      }
      return [Math.round(x), Math.round(y)];
    };
    const at = (el) => {
      const r = el.getBoundingClientRect();
      return [Math.round(r.x - ob.x), Math.round(r.y - ob.y)];
    };
    const shown = (r) => {
      for (let cur = r; cur; cur = root.canvasInputs.get(cur.parentId)) if (cur.hidden) return false;
      return true;
    };
    const all = [...root.canvasInputs.values()];
    const under = (r) => {
      for (let cur = r; cur; cur = root.canvasInputs.get(cur.parentId)) if (cur.id === top.id) return true;
      return false;
    };
    const mine = all.filter(under);
    const tags = mine.filter((r) => root.typeOf(r) === "Tag");
    const removes = mine.filter((r) => root.typeOf(r) === "Button" && r.props.slot === "remove");
    const glyphs = mine.filter((r) => root.typeOf(r) === "Icon" && r.props.iconName === "x");
    const label = mine.find((r) => root.typeOf(r) === "Text" && r.parentId === tags[0]?.id);
    const hint = (type) => mine.find((r) => root.typeOf(r) === type);
    const description = hint("Description");
    const error = hint("FieldError");
    return {
      preview: owner
        ? {
            tags: [...owner.querySelectorAll(".react-aria-Tag")].map((t) => t.getAttribute("aria-label")),
            removes: [...owner.querySelectorAll("button[slot=remove]")].map(at),
            removeNamed: [...owner.querySelectorAll("button[slot=remove]")].every(
              // (RAC's localized "Remove" — the builder locale.)
              (b) => !!b.getAttribute("aria-label"),
            ),
            description: (() => {
              const e = owner.querySelector("[slot=description]");
              return e ? { text: e.textContent, at: at(e) } : null;
            })(),
            error: (() => {
              const e = owner.querySelector("[slot=errorMessage]");
              return e ? { text: e.textContent, at: at(e), color: getComputedStyle(e).color } : null;
            })(),
          }
        : null,
      canvas: {
        tags: tags.length,
        removes: removes.filter(shown).map((r) => abs(r.id)),
        glyphColorIsLabel: glyphs.every((g) => g.derivedProps?.color === label?.derivedProps?.color),
        description: description && shown(description) ? { text: description.props.children, at: abs(description.id) } : null,
        error: error && shown(error) ? { text: error.props.children, at: abs(error.id) } : null,
      },
    };
  }, groupId);
const near = (a, b) => a.every((v, k) => Math.abs(v - b[k]) <= 1);
const r0 = await read();
record(
  "T-1 default (allowsRemoving false): no remove button on either side; 4 tags",
  r0.preview?.removes.length === 0 && r0.canvas.removes.length === 0 && r0.canvas.tags === 4 && r0.preview.tags.length === 4,
  r0,
);
await edit({ allowsRemoving: true });
await page.waitForTimeout(1500);
const r1 = await read();
record(
  "T-2 allowsRemoving: each Tag shows its remove Button on both sides, at the same place (±1px)",
  r1.preview?.removes.length === 4 &&
    r1.preview.removeNamed &&
    r1.canvas.removes.length === 4 &&
    r1.canvas.removes.every((p, i) => near(p, r1.preview.removes[i])) &&
    r1.canvas.glyphColorIsLabel,
  { canvas: r1.canvas.removes, preview: r1.preview?.removes, glyph: r1.canvas.glyphColorIsLabel },
);
await page.screenshot({ path: `${OUT}/removing.png` });
// (The Compare Mode header covers the frame's top edge: a virtual click — RAC `usePress`.)
await page.frameLocator("#previewFrame").locator("button[slot=remove]").first().evaluate((b) => b.click());
await page.waitForTimeout(800);
const r2 = await read();
record(
  "T-3 the Preview's remove button removes its tag from the run; the document keeps 4",
  r2.preview?.tags.length === 3 && !r2.preview.tags.includes("Chocolate") && r2.canvas.tags === 4,
  { preview: r2.preview?.tags, canvas: r2.canvas.tags },
);
await edit({ description: "Pick your flavors", errorMessage: "Pick at most two" });
await page.waitForTimeout(1500);
const r3 = await read();
record(
  "T-4 description · error message: the part nodes on both sides, at the same place (±1px)",
  r3.preview?.description?.text === "Pick your flavors" &&
    r3.preview?.error?.text === "Pick at most two" &&
    r3.canvas.description?.text === "Pick your flavors" &&
    r3.canvas.error?.text === "Pick at most two" &&
    near(r3.canvas.description.at, r3.preview.description.at) &&
    near(r3.canvas.error.at, r3.preview.error.at),
  { canvas: [r3.canvas.description, r3.canvas.error], preview: [r3.preview?.description, r3.preview?.error] },
);
await page.screenshot({ path: `${OUT}/hints.png` });
await edit({ allowsRemoving: false, errorMessage: "" });
await page.waitForTimeout(1500);
const r4 = await read();
record(
  "T-5 off again: remove buttons and the emptied error are gone on both sides",
  r4.preview?.removes.length === 0 && r4.canvas.removes.length === 0 && r4.preview.error === null && r4.canvas.error === null,
  r4,
);
await page.waitForTimeout(1500);
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await page.waitForTimeout(2500);
await compareOn();
const r5 = await read();
record(
  "T-6 reopened (contract 13): the same parts",
  r5.canvas.tags === 4 && r5.canvas.removes.length === 0 && r5.canvas.description?.text === "Pick your flavors" && r5.canvas.error === null,
  r5.canvas,
);
record("T-7 no page errors", errors.length === 0, { errors });
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

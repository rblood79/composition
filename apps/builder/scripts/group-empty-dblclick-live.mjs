// 그룹 빈 영역 더블클릭 live (사용자 2026-10-14 「radioGroup, checkbox Group 선택영역의 빈공간에
// 더블클릭했을때 전체영역으로 label편집창으로 된다」): real Builder (headed Chrome). A RadioGroup and a
// CheckboxGroup from the palette: a double click on the group's own area (no part under it) opens
// no text editor; double clicks on its Label open the editor on the Label's box.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/group-empty-dblclick-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const state = JSON.parse(
  readFileSync(`${process.cwd()}/apps/builder/scripts/.auth-session.json`, "utf8"),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({ storageState: state, viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
const errors = [];
const results = [];
const record = (id, pass, detail) => {
  results.push({ id, pass, detail });
  process.stdout.write(`${pass ? "PASS" : "FAIL"} ${id} — ${JSON.stringify(detail).slice(0, 700)}\n`);
};
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
async function addFromPalette(label) {
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.selectRecords([]));
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page.getByRole("button", { name: "Components", exact: true }).first().click();
  await search.fill(label);
  await page.waitForTimeout(300);
  await page.locator(".list-item", { hasText: new RegExp(`^${label}$`, "i") }).first().click();
  await page.waitForTimeout(800);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Components", exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(300);
}
/** Screen points of the group: an empty spot in its own box (no child box under it) and its Label. */
const points = (type) =>
  page.evaluate((type) => {
    const handle = window.__COMPOSITION_CATALOG__;
    const root = handle.workspace.root;
    const records = root.domInputs;
    const group = [...records.values()].filter((r) => root.typeOf(r) === type).at(-1);
    const camera = handle.canvas.camera();
    const rect = document.querySelector('[data-catalog-canvas="true"]').getBoundingClientRect();
    const screen = (x, y) => ({ x: rect.left + camera.x + x * camera.zoom, y: rect.top + camera.y + y * camera.zoom });
    const box = handle.canvas.boundsOf(group.id);
    const under = (id) => { const r = records.get(id); return r ? [r, ...r.children.flatMap(under)] : []; };
    const parts = under(group.id).slice(1).map((r) => handle.canvas.boundsOf(r.id)).filter(Boolean);
    let empty;
    for (let fy = 0.05; fy < 1 && !empty; fy += 0.05)
      for (let fx = 0.05; fx < 1 && !empty; fx += 0.05) {
        const x = box.x + box.width * fx;
        const y = box.y + box.height * fy;
        if (!parts.some((p) => x >= p.x - 2 && x <= p.x + p.width + 2 && y >= p.y - 2 && y <= p.y + p.height + 2)) empty = { x, y };
      }
    const label = under(group.id).find((r) => root.typeOf(r) === "Label");
    const lb = handle.canvas.boundsOf(label.id);
    return {
      group: group.id,
      label: label.id,
      box,
      empty: empty ? screen(empty.x, empty.y) : null,
      labelPoint: screen(lb.x + Math.min(10, lb.width / 2), lb.y + lb.height / 2),
    };
  }, type);
const editor = () =>
  page.evaluate(() => {
    const ws = window.__COMPOSITION_CATALOG__.workspace;
    const editing = ws.session.getSnapshot().textEditing;
    const el = document.querySelector('[data-testid="catalog-text-editor"]');
    const r = el?.getBoundingClientRect();
    return { identity: editing?.identity ?? null, box: r ? [Math.round(r.width), Math.round(r.height)] : null };
  });

await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await page.waitForTimeout(300);
await page.keyboard.type("Group empty dblclick");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await page.waitForTimeout(1500);

for (const [paletteLabel, type] of [["radio group", "RadioGroup"], ["checkbox group", "CheckboxGroup"]]) {
  await addFromPalette(paletteLabel);
  await page.waitForTimeout(800);
  const p = await points(type);
  if (!p.empty) {
    record(`${type}-empty`, false, { reason: "no empty spot", box: p.box });
    continue;
  }
  // Own area: twice (the first may select, the second is the reported one).
  await page.mouse.dblclick(p.empty.x, p.empty.y);
  await page.waitForTimeout(400);
  await page.mouse.dblclick(p.empty.x, p.empty.y);
  await page.waitForTimeout(400);
  const own = await editor();
  await page.screenshot({ path: `${OUT}/${type}-empty.png` });
  record(`${type}-empty`, own.identity === null && own.box === null, own);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.selectRecords([]));
  // Its Label: the double clicks reach it and edit it there.
  let label;
  for (let i = 0; i < 4; i++) {
    await page.mouse.dblclick(p.labelPoint.x, p.labelPoint.y);
    await page.waitForTimeout(400);
    label = await editor();
    if (label.identity) break;
  }
  await page.screenshot({ path: `${OUT}/${type}-label.png` });
  record(`${type}-label`, label.identity === p.label && label.box && label.box[1] < p.box.height, { ...label, groupBox: p.box });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
}
record("no-errors", errors.length === 0, errors.slice(0, 5));
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.pass) ? 0 : 1);

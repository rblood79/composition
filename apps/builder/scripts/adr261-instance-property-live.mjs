// ADR-261 G3 (Phase 5) — instance swap property (Figma): on the origin a nested instance makes an
// instance swap property (Design panel) and gets preferred components; an instance's Component
// section picks the value (preferred first, current left out) — the Canvas record and the Preview
// DOM draw the picked component (Compare Mode), the origin keeps its own; the Overrides list shows
// the swap; reset folds it back; undo; reload keeps it.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr261-instance-property-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const state = JSON.parse(readFileSync(`${process.cwd()}/apps/builder/scripts/.auth-session.json`, "utf8"));
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({ storageState: state, viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`); });
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail });
  process.stdout.write(`${ok ? "PASS" : "FAIL"} ${name}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}\n`);
};
const wait = (ms) => page.waitForTimeout(ms);
const exec = (source, arg) =>
  page.evaluate(({ source, arg }) => new Function("cat", "arg", `return (${source})(cat, arg);`)(window.__COMPOSITION_CATALOG__, arg), { source, arg });
const entry = (id) => page.evaluate((id) => JSON.parse(JSON.stringify(window.__COMPOSITION_CATALOG__.workspace.runtime.graph.getEntry(id) ?? null)), id);
const panel = () => page.locator('.workspace-panel-frame[data-panel="properties"]');
let INSTANCE;
/** The record drawn for node `source` inside instance `instance` (else outside the instance). */
const recordOf = (source, instance) =>
  exec(`(cat, a) => { const root = cat.workspace.root; for (const id of root.recordsOfSource(a.source)) { const r = root.domInputs.get(id); if (a.instance ? r.instancePath.includes(a.instance) : !r.instancePath.includes(a.other)) return { id, text: r.props?.children ?? null }; } return null; }`, { source, instance, other: INSTANCE });
const select = async (source, instance) => {
  const found = await recordOf(source, instance);
  await exec(`(cat, a) => cat.workspace.selectRecords([a.id])`, { id: found?.id });
  return found?.id;
};
const continueImpact = async () => {
  const impact = page.locator('[role="dialog"], [role="alertdialog"]').filter({ hasNot: page.getByRole("searchbox") }).first();
  if (await impact.isVisible().catch(() => false)) {
    await impact.getByRole("button").filter({ hasNotText: /cancel|취소/i }).last().click();
    await wait(500);
    return true;
  }
  return false;
};
const domText = (recordId) =>
  recordId
    ? page.frameLocator("#previewFrame").locator(`[data-catalog-id="${recordId}"]`).first().textContent({ timeout: 3000 }).catch(() => null)
    : null;
/** The glyph texts the instance draws (Canvas records inside it), and the same records in the DOM. */
const drawn = async () => {
  const records = await exec(`(cat, a) => [...cat.workspace.root.domInputs.entries()].filter(([, r]) => r.instancePath.includes(a.I) && typeof r.props?.children === "string").map(([id, r]) => ({ id, text: r.props.children }))`, { I: INSTANCE });
  const dom = [];
  for (const record of records) dom.push((await domText(record.id))?.trim() ?? null);
  return { canvas: records.map((r) => r.text), dom };
};

await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await wait(300);
await page.keyboard.type(`ADR-261 swap property ${Date.now()}`);
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await wait(1500);
const compare = page.getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true }).first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await wait(2500);
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });

// Fixture (commands): Star = Frame > "★" · Heart = Frame > "♥" · Card = Frame > "Title" · a Star
// instance (named Icon); I = ⌘D copy of Card.
const ids = await exec(`(cat) => {
  const ws = cat.workspace, c = cat.commands, g = ws.runtime.graph;
  const body = g.getEntry(ws.session.getSnapshot().pageId).children[0];
  const n = (id, def, extra = {}) => ({ kind: "node", id, definitionId: def, children: [], props: {}, visual: {}, sizing: {}, descendantOverrides: [], ...extra });
  const text = (id, value, name) => n(id, "lib:definition:text", { name, props: { children: { kind: "set", value } } });
  const frame = (id, children) => n(id, "lib:definition:type-frame", { children });
  const s = ws.newId("node"), sg = ws.newId("node"), h = ws.newId("node"), hg = ws.newId("node");
  ws.execute(c.insertNodes({ parent: { kind: "node", id: body }, entries: [frame(s, [sg]), text(sg, "★", "Glyph"), frame(h, [hg]), text(hg, "♥", "Glyph")], rootIds: [s, h], newId: ws.newId }));
  ws.execute(c.createComponent({ id: s, name: "Star", newId: ws.newId }));
  ws.execute(c.createComponent({ id: h, name: "Heart", newId: ws.newId }));
  const [star, heart] = g.getEntry(g.projectId).definitionIds;
  const root = ws.newId("node"), title = ws.newId("node"), icon = ws.newId("node");
  ws.execute(c.insertNodes({ parent: { kind: "node", id: body }, entries: [frame(root, [title, icon]), text(title, "Title", "Title"), n(icon, star, { name: "Icon" })], rootIds: [root], newId: ws.newId }));
  ws.execute(c.createComponent({ id: root, name: "Card", newId: ws.newId }));
  const card = g.getEntry(g.projectId).definitionIds[2];
  const I = ws.execute(c.duplicateNodes({ ids: [root], newId: ws.newId })).plan.selectAfter[0];
  return { star, heart, card, root, icon, sg, hg, I };
}`);
INSTANCE = ids.I;
const design = page.getByRole("button", { name: "Design", exact: true }).first();
if (await design.isVisible().catch(() => false)) await design.click().catch(() => {});
check("0 instance 기본 = Title · ★ (Canvas = DOM)", JSON.stringify(await drawn()) === JSON.stringify({ canvas: ["Title", "★"], dom: ["Title", "★"] }), await drawn());

// 1 — origin layer Icon (a Star instance): 「Instance swap property」.
await select(ids.icon);
await wait(700);
const swapButton = panel().getByRole("button", { name: /^(Instance swap property|인스턴스 교체 속성)$/ });
check("1a 원본의 중첩 instance 레이어에 「Instance swap property」", await swapButton.isVisible().catch(() => false));
await swapButton.click();
await wait(400);
await continueImpact();
let definition = await entry(ids.card);
const property = definition.properties?.[0];
check("1b 정의 properties = [instance · Icon · targets Icon]", definition.properties?.length === 1 && property.kind === "instance" && property.targets[0].id === ids.icon, definition.properties);
await page.screenshot({ path: `${OUT}/1-origin-layer.png` });

// 2 — its preferred: Heart (the 「Add preferred」 list).
await select(ids.icon);
await wait(700);
const addPreferred = panel().getByRole("button", { name: /Add preferred|추천 추가/ }).first();
await addPreferred.click();
await wait(300);
await page.getByRole("option", { name: "Heart", exact: true }).click();
await wait(500);
await continueImpact();
definition = await entry(ids.card);
check("2 preferred = [Heart]", JSON.stringify(definition.properties?.[0]?.preferred) === JSON.stringify([ids.heart]), definition.properties?.[0]);
await page.screenshot({ path: `${OUT}/2-preferred.png` });

// 3 — the instance's Component section: Icon = Star; its list puts Heart first (Preferred) and
// leaves Star out; pick Heart.
await select(ids.I, ids.I);
await wait(800);
const chip = panel().locator("fieldset.instance-property-field", { has: page.locator("legend", { hasText: /^Icon$/ }) }).getByRole("button").first();
check("3a instance Component 절에 Icon 행 · 값 Star", (await chip.textContent().catch(() => ""))?.includes("Star"), await chip.textContent().catch(() => null));
await chip.click();
await wait(400);
const list = page.getByRole("listbox").last();
const options = await list.getByRole("option").allTextContents();
const headers = await page.locator(".component-swap-header").allTextContents();
check("3b 목록: 맨 위 Preferred 의 Heart · 현재 Star 제외", headers[0]?.match(/Preferred|추천/) && options[0] === "Heart" && !options.includes("Star"), { headers, options: options.slice(0, 8) });
await page.screenshot({ path: `${OUT}/3-picker.png` });
await list.getByRole("option", { name: "Heart", exact: true }).click();
await wait(1000);
let instance = await entry(ids.I);
const replace = instance.descendantOverrides.find((item) => item.kind === "replace");
check("3c I 에 replace override (Heart instance) · 원본 Icon 은 Star", !!replace && (await entry(replace.replacementId))?.definitionId === ids.heart && (await entry(ids.icon)).definitionId === ids.star, instance.descendantOverrides);
const swapped = await drawn();
check("3d Canvas record = Title · ♥ · Preview DOM 같음 (Compare Mode)", JSON.stringify(swapped) === JSON.stringify({ canvas: ["Title", "♥"], dom: ["Title", "♥"] }), swapped);
check("3e 원본 Card 는 ★ 그대로", (await recordOf(ids.sg))?.text === "★");
await page.screenshot({ path: `${OUT}/3-swapped.png` });

// 4 — the Overrides list shows the swap; the row's reset button is there.
const overrideRow = panel().locator(".component-semantics-field", { hasText: /Heart/ });
check("4 Overrides 목록에 「Icon → Heart」 행", await overrideRow.isVisible().catch(() => false), await panel().locator(".component-semantics-field-name").allTextContents());

// 5 — reset (the row's icon button): back to Star, no override.
await panel().getByRole("button", { name: /^(Reset Icon|Icon 원본으로 되돌리기)$/ }).click();
await wait(900);
instance = await entry(ids.I);
check("5 Reset → override 0 · Title · ★ (Canvas = DOM)", instance.descendantOverrides.length === 0 && JSON.stringify(await drawn()) === JSON.stringify({ canvas: ["Title", "★"], dom: ["Title", "★"] }), { overrides: instance.descendantOverrides, drawn: await drawn() });

// 6 — undo: Heart again.
await exec(`(cat) => cat.workspace.undo()`);
await wait(800);
check("6 undo → ♥", JSON.stringify((await drawn()).canvas) === JSON.stringify(["Title", "♥"]), await drawn());

// 7 — reload: the swap is saved.
await wait(1500);
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await wait(2500);
instance = await entry(ids.I);
check("7 새로고침 뒤 replace 유지 · ♥", instance?.descendantOverrides?.some((item) => item.kind === "replace") && JSON.stringify((await drawn()).canvas) === JSON.stringify(["Title", "♥"]), { overrides: instance?.descendantOverrides, drawn: await drawn() });
await page.screenshot({ path: `${OUT}/7-reload.png` });

check("8 콘솔 오류 0", errors.length === 0, errors.slice(0, 5));
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);

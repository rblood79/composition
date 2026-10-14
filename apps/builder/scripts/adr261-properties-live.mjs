// ADR-261 G3 — user component properties, text · boolean (Figma component properties): on the
// origin a layer makes a text / visibility property (Design panel), the root lists and renames
// them; an instance's Property tab edits the values — the Canvas record and the Preview DOM show
// them (Compare Mode), the origin keeps its own, no property key on the DOM; an inline text edit
// of the driven layer in the instance sets the property; undo; detach keeps the values.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr261-properties-live.mjs <out>
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
/** The record drawn for origin node `source` inside instance `instance` (else outside every instance). */
let INSTANCE;
const recordOf = (source, instance) =>
  exec(`(cat, a) => { const root = cat.workspace.root; for (const id of root.recordsOfSource(a.source)) { const r = root.domInputs.get(id); if (a.instance ? r.instancePath.includes(a.instance) : !r.instancePath.includes(a.other)) return { id, text: r.props?.children ?? null }; } return null; }`, { source, instance, other: INSTANCE });
const select = async (source, instance) => {
  const found = await recordOf(source, instance);
  await exec(`(cat, a) => cat.workspace.selectRecords([a.id])`, { id: found?.id });
  return found?.id;
};
/** An origin edit with instances asks first (ADR-260 impact dialog): continue. */
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
  page.frameLocator("#previewFrame").locator(`[data-catalog-id="${recordId}"]`).first().textContent({ timeout: 3000 }).catch(() => null);
const domCount = (recordId) =>
  page.frameLocator("#previewFrame").locator(`[data-catalog-id="${recordId}"]`).count();

await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await wait(300);
await page.keyboard.type(`ADR-261 properties ${Date.now()}`);
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await wait(1500);
const compare = page.getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true }).first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await wait(2500);
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });

// Fixture (commands): Card = Frame > Text "Title" (named Title) · Text "★" (named Icon); I = ⌘D copy.
const ids = await exec(`(cat) => {
  const ws = cat.workspace, c = cat.commands, g = ws.runtime.graph;
  const body = g.getEntry(ws.session.getSnapshot().pageId).children[0];
  const n = (id, def, extra = {}) => ({ kind: "node", id, definitionId: def, children: [], props: {}, visual: {}, sizing: {}, descendantOverrides: [], ...extra });
  const text = (id, value, name) => n(id, "lib:definition:text", { name, props: { children: { kind: "set", value } } });
  const root = ws.newId("node"), title = ws.newId("node"), icon = ws.newId("node");
  ws.execute(c.insertNodes({ parent: { kind: "node", id: body }, entries: [n(root, "lib:definition:type-frame", { children: [title, icon] }), text(title, "Title", "Title"), text(icon, "★", "Icon")], rootIds: [root], newId: ws.newId }));
  ws.execute(c.createComponent({ id: root, name: "Card", newId: ws.newId }));
  const definitionId = g.getEntry(g.projectId).definitionIds[0];
  const I = ws.execute(c.duplicateNodes({ ids: [root], newId: ws.newId })).plan.selectAfter[0];
  return { root, title, icon, definitionId, I };
}`);
INSTANCE = ids.I;
const design = page.getByRole("button", { name: "Design", exact: true }).first();
if (await design.isVisible().catch(() => false)) await design.click().catch(() => {});

// 1 — origin layer Title: 「Text property」 makes a text property on its text.
await select(ids.title);
await wait(700);
const textButton = panel().getByRole("button", { name: /^(Text property|텍스트 속성)$/ });
check("1a 원본 레이어 Title 에 Component properties 섹션 · 「Text property」", await textButton.isVisible().catch(() => false));
await textButton.click();
await wait(400);
const asked1 = await continueImpact();
let definition = await entry(ids.definitionId);
check("1b 정의 properties = [text · Title · targets Title.children]", definition.properties?.length === 1 && definition.properties[0].kind === "text" && definition.properties[0].name === "Title" && definition.properties[0].targets[0].id === ids.title && definition.properties[0].targets[0].prop === "children", { properties: definition.properties, asked1 });
await page.screenshot({ path: `${OUT}/1-origin-layer.png` });

// 2 — origin layer Icon: 「Visibility property」.
await select(ids.icon);
await wait(700);
await panel().getByRole("button", { name: /^(Visibility property|표시 속성)$/ }).click();
await wait(400);
await continueImpact();
definition = await entry(ids.definitionId);
const [textProp, boolProp] = definition.properties ?? [];
check("2 Icon 에 boolean 속성 「Show Icon」", boolProp?.kind === "boolean" && /Icon/.test(boolProp.name) && boolProp.targets[0].id === ids.icon, definition.properties);

// 3 — the origin root lists both; rename Title → Heading in its row.
await select(ids.root);
await wait(700);
const rowInputs = panel().locator(".component-property-row input");
check("3a 원본 루트에 속성 2행", (await rowInputs.count()) === 2, await rowInputs.evaluateAll((els) => els.map((e) => e.value)));
await rowInputs.first().fill("Heading");
await rowInputs.first().press("Enter");
await wait(500);
await continueImpact();
check("3b 행 이름 변경 → Heading", (await entry(ids.definitionId)).properties?.[0].name === "Heading");
await page.screenshot({ path: `${OUT}/3-origin-root.png` });

// 4 — the instance's Property tab: a Heading text field (the origin's value as its base); type a value.
await select(ids.I, ids.I);
await wait(800);
const headingField = panel().locator("fieldset", { has: page.locator("legend", { hasText: /^Heading$/ }) }).locator("input").first();
check("4a instance Property 탭에 Heading 필드 · 기본값 = 원본 Title", (await headingField.inputValue({ timeout: 3000 }).catch(() => null)) === "Title", { value: await headingField.inputValue({ timeout: 1000 }).catch(() => null), sections: await panel().locator(".section-title").allTextContents(), legends: (await panel().locator("legend").allTextContents()).slice(0, 20), selection: await exec(`(cat) => cat.workspace.session.getSnapshot().selection.map((i) => i.target)`) });
if (!results.at(-1).ok) { await page.screenshot({ path: `${OUT}/4a-fail.png` }); writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2)); await browser.close(); process.exit(1); }
await headingField.fill("Hello");
await headingField.press("Enter");
await wait(900);
const instance = await entry(ids.I);
const titleIn = await recordOf(ids.title, ids.I);
const titleOrigin = await recordOf(ids.title);
check("4b I.props 에 속성 값 · Canvas record = Hello · 원본은 Title", instance.props?.[textProp.key]?.value === "Hello" && titleIn?.text === "Hello" && titleOrigin?.text === "Title", { props: instance.props, titleIn, titleOrigin });
const domIn = await domText(titleIn?.id);
const domOrigin = await domText(titleOrigin?.id);
check("4c Preview DOM = Hello · 원본 DOM = Title (Compare Mode)", domIn?.trim() === "Hello" && domOrigin?.trim() === "Title", { domIn, domOrigin });
const instanceRecord = await exec(`(cat, a) => cat.workspace.root.recordsOfSource(a.I)[0]`, ids);
const attrs = await page.frameLocator("#previewFrame").locator(`[data-catalog-id="${instanceRecord}"]`).first().evaluate((el) => [...el.attributes].map((a) => a.name)).catch(() => null);
check("4d Preview DOM 루트에 속성 키 attribute 0 (R3)", !!attrs && !attrs.some((name) => name.toLowerCase().includes(textProp.key.toLowerCase()) || name.toLowerCase().includes(boolProp.key.toLowerCase())), attrs);
await page.screenshot({ path: `${OUT}/4-instance-text.png` });

// 5 — the Show Icon switch off: the instance's icon is gone on the Canvas and in the DOM.
const iconIn = await recordOf(ids.icon, ids.I);
// (A boolean is the panel's chip: the 「Show」 group's 「Icon」 chip — `fieldEditor` `chipLabel`.)
const toggle = panel().locator("fieldset", { has: page.locator("legend", { hasText: /^Show$/ }) }).getByRole("button", { name: "Icon", exact: true });
check("5a 「Show」 칩 그룹의 Icon 칩 (기본 켜짐)", (await toggle.getAttribute("aria-pressed").catch(() => null)) === "true", boolProp.name);
await toggle.click();
await wait(900);
check("5b 끔 → Canvas record 없음 · DOM 요소 0 · 원본 Icon 은 그대로", !(await recordOf(ids.icon, ids.I)) && (await domCount(iconIn?.id)) === 0 && !!(await recordOf(ids.icon)), { before: iconIn, value: (await entry(ids.I)).props?.[boolProp.key] });
await page.screenshot({ path: `${OUT}/5-instance-boolean.png` });

// 6 — an inline text edit of the instance's Heading layer writes the property, not a patch.
const titleRecord = (await recordOf(ids.title, ids.I)).id;
await exec(`(cat, a) => { cat.workspace.selectRecords([a.id]); cat.workspace.session.startTextEdit(cat.workspace.itemOfRecord(a.id)); }`, { id: titleRecord });
await wait(500);
const editor = page.locator("textarea").last();
await editor.fill("Typed");
await editor.press("Escape");
await wait(800);
const afterEdit = await entry(ids.I);
check("6 인라인 편집 → I 의 속성 값 = Typed (patch 0)", afterEdit.props?.[textProp.key]?.value === "Typed" && afterEdit.descendantOverrides.length === 0 && (await recordOf(ids.title, ids.I))?.text === "Typed", { props: afterEdit.props, overrides: afterEdit.descendantOverrides });

// 7 — undo: back to Hello.
await exec(`(cat) => cat.workspace.undo()`);
await wait(600);
check("7 undo → Hello", (await recordOf(ids.title, ids.I))?.text === "Hello" && (await domText(titleIn?.id))?.trim() === "Hello");

// 8 — detach keeps what the properties showed.
await exec(`(cat, a) => cat.workspace.execute(cat.commands.detachInstances({ ids: [a.I], newId: cat.workspace.newId }))`, ids);
await wait(800);
const detached = await entry(ids.I);
const copies = await Promise.all(detached.children.map((child) => entry(child)));
check("8 detach → 사본 Title = Hello · Icon enabled false · 루트에 속성 키 없음", copies[0]?.props?.children?.value === "Hello" && copies[1]?.enabled === false && !Object.keys(detached.props).some((key) => key === textProp.key || key === boolProp.key), { root: detached.props, copies: copies.map((c) => ({ props: c.props, enabled: c.enabled })) });
await page.screenshot({ path: `${OUT}/8-detach.png` });

check("9 콘솔 오류 0", errors.length === 0, errors.slice(0, 5));
writeFileSync(`${OUT}/results.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);

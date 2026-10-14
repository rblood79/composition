// Create component from an instance: the Component section after it (2026-10-14 user report —
// a second detach appears, the new component's identity is missing).
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/create-component-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const state = JSON.parse(readFileSync(`${process.cwd()}/apps/builder/scripts/.auth-session.json`, "utf8"));
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const page = await (await browser.newContext({ storageState: state, viewport: { width: 1600, height: 1000 } })).newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`); });
const ready = () => page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
async function addFromPalette(label) {
  await ready();
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.selectRecords([]));
  const search = page.getByLabel("Search components");
  if (!(await search.isVisible().catch(() => false)))
    await page.getByRole("button", { name: "Components", exact: true }).first().click();
  await search.fill(label);
  await page.waitForTimeout(300);
  await page.locator(".list-item", { hasText: new RegExp(`^${label}$`, "i") }).first().click();
  await page.waitForTimeout(700);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Components", exact: true }).first().click().catch(() => {});
  await page.waitForTimeout(200);
}
const recordsOf = (type) =>
  page.evaluate((type) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    return [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type).map((r) => r.id);
  }, type);
const select = (id) => page.evaluate((id) => window.__COMPOSITION_CATALOG__.workspace.selectRecords([id]), id);
const section = () =>
  page.evaluate(() => {
    const panel = document.querySelector('.workspace-panel-frame[data-panel="properties"]');
    const s = panel?.querySelector('.section[data-section-id="component"]') ?? [...(panel?.querySelectorAll(".section") ?? [])].find((x) => x.querySelector(".section-title")?.textContent?.trim() === "Component");
    return {
      html: s?.outerHTML.slice(0, 4000),
      identity: s?.querySelector(".component-semantics-identity")?.textContent ?? null,
      buttons: [...(s?.querySelectorAll("button") ?? [])].map((b) => b.getAttribute("aria-label") ?? b.textContent?.trim()),
      sections: [...(panel?.querySelectorAll(".section-title") ?? [])].map((t) => t.textContent?.trim()),
    };
  });
const nodeInfo = (recordId) =>
  page.evaluate((recordId) => {
    const { workspace } = window.__COMPOSITION_CATALOG__;
    const graph = workspace.runtime.graph;
    const target = workspace.itemOfRecord(recordId)?.target;
    const node = target?.kind === "node" ? graph.getEntry(target.id) : undefined;
    const def = node ? graph.getEntry(node.definitionId) ?? graph.getDefinition?.(node.definitionId) : undefined;
    return { target, definitionId: node?.definitionId, defKind: def?.kind, defName: def?.name, templateRootId: def?.templateRootId };
  }, recordId);

await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await page.waitForTimeout(300);
await page.keyboard.type("Create component");
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await ready();
await page.waitForTimeout(1500);
await page.getByRole("button", { name: "Design", exact: true }).first().click().catch(() => {});

const out = {};
for (const [label, type] of [["Button", "Button"], ["Toggle Button Group", "ToggleButton"]]) {
  const before = await recordsOf(type);
  await addFromPalette(label);
  const target = (await recordsOf(type)).filter((id) => !before.includes(id))[0];
  await select(target);
  await page.waitForTimeout(500);
  const pre = { section: await section(), node: await nodeInfo(target) };
  await page.screenshot({ path: `${OUT}/${type}-before.png` });
  await page.getByRole("button", { name: "Create component" }).first().click();
  await page.waitForTimeout(800);
  // The confirm/name dialog, if any.
  const dialog = await page.locator('[role="dialog"], [role="alertdialog"]').count();
  if (dialog) { await page.screenshot({ path: `${OUT}/${type}-dialog.png` }); await page.keyboard.press("Enter"); await page.waitForTimeout(800); }
  const selected = await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.session.getSnapshot().selection ?? null);
  const post = { section: await section(), selected, records: await recordsOf(type) };
  const now = (await recordsOf(type)).filter((id) => !before.includes(id))[0];
  post.node = now ? await nodeInfo(now) : null;
  await page.screenshot({ path: `${OUT}/${type}-after.png` });
  // The new component's origin (Go to component): its Component section.
  await page.getByRole("button", { name: "Go to component" }).first().click();
  await page.waitForTimeout(900);
  // Select the origin root the view shows (the template root of the new definition).
  await page.evaluate(() => {
    const { workspace } = window.__COMPOSITION_CATALOG__;
    const view = workspace.session.getSnapshot().definitionView;
    const def = workspace.runtime.graph.getEntry(view);
    const records = workspace.root.recordsOfSource(def.templateRootId);
    if (records[0]) workspace.selectRecords([records[0]]);
  });
  await page.waitForTimeout(600);
  const origin = { section: await section(), view: await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.session.getSnapshot().definitionView ?? null) };
  await page.screenshot({ path: `${OUT}/${type}-origin.png` });
  // Layers / Components tab: the project component listed?
  await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.showDefinition(undefined));
  await page.waitForTimeout(800);
  const layers = [];
  out[type] = { pre, post, dialog, origin, layers };
  process.stdout.write(`  origin ${JSON.stringify({ id: origin.section.identity, b: origin.section.buttons, view: origin.view, sections: origin.section.sections })}\n  layers ${JSON.stringify(layers)}\n`);
  process.stdout.write(`${type}: pre ${JSON.stringify({ id: pre.section.identity, b: pre.section.buttons })}\n  post ${JSON.stringify({ id: post.section.identity, b: post.section.buttons, node: post.node })}\n`);
}
writeFileSync(`${OUT}/out.json`, JSON.stringify({ out, errors }, null, 2));
process.stdout.write(`errors ${errors.length}\n`);
for (const e of errors.slice(0, 8)) process.stdout.write(`  ${e}\n`);
await browser.close();

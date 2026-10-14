// ADR-260 G3 — Create component keeps the node in place as the ORIGIN (pen.dev · Figma).
// Button · Toggle Button Group · Card: create → ORIGIN in the Design panel · Components list ·
// a copy (⌘D) is an INSTANCE · Go to component selects the page origin · an origin edit reaches the
// instance · delete origin → Restore origin · Detach component keeps the node · reload · paste into
// another project.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr260-origin-in-place-live.mjs <out>
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
const watch = (p) => {
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
  p.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`); });
};
watch(page);
const results = [];
/** A button of the Design panel's Component section (the action bar repeats some names). */
const panelButton = (name) =>
  page.locator('.workspace-panel-frame[data-panel="properties"]').getByRole("button", { name, exact: true }).first();
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail });
  process.stdout.write(`${ok ? "PASS" : "FAIL"} ${name}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}\n`);
};
const ready = (p = page) => p.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
async function newProject(p, name) {
  await p.goto(`${BASE}/dashboard`);
  await p.getByRole("button", { name: /new project/i }).first().click();
  await p.waitForTimeout(300);
  await p.keyboard.type(name);
  await p.keyboard.press("Enter");
  await p.waitForURL(/\/builder\//, { timeout: 30000 });
  await p.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
  await ready(p);
  await p.waitForTimeout(1500);
  await p.getByRole("button", { name: "Design", exact: true }).first().click().catch(() => {});
}
async function addFromPalette(label) {
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
/** The owned node ids of a type on the page (owned records only). */
const nodesOf = (type) =>
  page.evaluate((type) => {
    const { workspace } = window.__COMPOSITION_CATALOG__;
    const root = workspace.root;
    return [...root.canvasInputs.values()]
      .filter((r) => root.typeOf(r) === type)
      .map((r) => workspace.itemOfRecord(r.id)?.target)
      .filter((t) => t?.kind === "node")
      .map((t) => t.id);
  }, type);
const selectNode = (id) =>
  page.evaluate((id) => {
    const { workspace } = window.__COMPOSITION_CATALOG__;
    const record = workspace.root.recordsOfSource(id)[0];
    workspace.selectRecords([record]);
  }, id);
const section = () =>
  page.evaluate(() => {
    const panel = document.querySelector('.workspace-panel-frame[data-panel="properties"]');
    const s = panel?.querySelector('.section[data-section-id="component"]') ?? [...(panel?.querySelectorAll(".section") ?? [])].find((x) => x.querySelector(".section-title")?.textContent?.trim() === "Component");
    return {
      role: s?.querySelector(".component-semantics-identity")?.getAttribute("data-role") ?? null,
      name: s?.querySelector(".component-semantics-identity-name")?.textContent ?? null,
      buttons: [...(s?.querySelectorAll("button") ?? [])].map((b) => b.getAttribute("aria-label") ?? b.textContent?.trim()),
    };
  });
const selected = () =>
  page.evaluate(() => {
    const snapshot = window.__COMPOSITION_CATALOG__.workspace.session.getSnapshot();
    return { target: snapshot.selection[0]?.target ?? null, view: snapshot.definitionView ?? null };
  });
const definitionOf = (id) =>
  page.evaluate((id) => {
    const graph = window.__COMPOSITION_CATALOG__.workspace.runtime.graph;
    const node = graph.getEntry(id);
    const ref = graph.definitionOfTemplateRoot(id);
    return { definitionId: node?.definitionId, origin: ref ? graph.getEntry(ref) : null };
  }, id);
/** Answer the component dialog (impact / detach) with Continue, if it opened. */
async function answerDialog() {
  await page.waitForTimeout(400);
  const dialog = page.locator('[role="dialog"], [role="alertdialog"]').first();
  if (await dialog.isVisible().catch(() => false)) {
    const button = dialog.getByRole("button").filter({ hasNotText: /cancel|취소/i }).last();
    await button.click();
    await page.waitForTimeout(400);
    return true;
  }
  return false;
}
/** ⌘D on the selection: the Canvas has the focus first. */
async function duplicateSelection(origin) {
  const before = await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.runtime.graph.revision);
  await page.evaluate(() => document.querySelector(".canvas-container")?.focus());
  await page.keyboard.press("Meta+d");
  await page.waitForTimeout(600);
  const after = await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.runtime.graph.revision);
  if (after > before) return { via: "⌘D", id: (await selected()).target?.id };
  // Fallback: the same command the shortcut runs.
  const id = await page.evaluate((origin) => {
    const { workspace, commands } = window.__COMPOSITION_CATALOG__;
    return workspace.execute(commands.duplicateNodes({ ids: [origin], newId: workspace.newId })).plan.selectAfter[0];
  }, origin);
  await page.waitForTimeout(500);
  return { via: "command", id };
}
const instanceCount = (definitionId) =>
  page.evaluate((d) => window.__COMPOSITION_CATALOG__.workspace.runtime.graph.instancesOf(d).size, definitionId);
/** Drawn records of `type` inside the node's record (its own subtree on the Canvas). */
const projected = (nodeId, type) =>
  page.evaluate(
    ({ nodeId, type }) => {
      const root = window.__COMPOSITION_CATALOG__.workspace.root;
      const top = root.recordsOfSource(nodeId)[0];
      const inside = (record) => {
        for (let at = record.parentId; at; at = root.canvasInputs.get(at)?.parentId) if (at === top) return true;
        return false;
      };
      return [...root.canvasInputs.values()].filter((r) => root.typeOf(r) === type && inside(r)).length;
    },
    { nodeId, type },
  );

await newProject(page, "ADR-260 live");
const kept = {};
for (const [label, type, part] of [
  ["Button", "Button", undefined],
  ["Toggle Button Group", "ToggleButtonGroup", "ToggleButton"],
  ["Card", "Card", undefined],
]) {
  const before = await nodesOf(type);
  await addFromPalette(label);
  const origin = (await nodesOf(type)).find((id) => !before.includes(id));
  await selectNode(origin);
  await page.waitForTimeout(400);
  const partsBefore = part ? await projected(origin, part) : undefined;
  await panelButton("Create component").click();
  await page.waitForTimeout(800);
  await answerDialog();
  const afterCreate = await section();
  const sel = await selected();
  check(`${type}: Create → same node selected, ORIGIN chip`, sel.target?.id === origin && afterCreate.role === "origin" && sel.view === null, { sel, afterCreate });
  check(`${type}: ORIGIN offers Detach component, no Detach instance`, afterCreate.buttons.includes("Detach component") && !afterCreate.buttons.includes("Detach instance"), afterCreate.buttons);
  const { origin: definition } = await definitionOf(origin);
  check(`${type}: definition references the node (originRef)`, definition?.originRef === true && definition.templateRootId === origin);
  if (part) check(`${type}: its ${part} items stay after Create`, (await projected(origin, part)) === partsBefore, { before: partsBefore, after: await projected(origin, part) });
  const listed = await page.evaluate(() => window.__COMPOSITION_CATALOG__.workspace.readModel.components().map((c) => c.name));
  check(`${type}: listed as a component`, listed.includes(definition?.name), listed);
  await page.screenshot({ path: `${OUT}/${type}-origin.png` });

  const copy = await duplicateSelection(origin);
  const copyDef = await definitionOf(copy.id);
  await selectNode(copy.id);
  await page.waitForTimeout(400);
  const instanceSection = await section();
  check(`${type}: a copy of the origin is an INSTANCE (${copy.via})`, copyDef.definitionId === definition?.id && instanceSection.role === "instance", { copyDef: copyDef.definitionId, instanceSection });
  check(`${type}: instance offers Go to component · Detach instance once`, instanceSection.buttons.includes("Go to component") && instanceSection.buttons.filter((b) => b === "Detach instance").length === 1, instanceSection.buttons);
  if (part) check(`${type}: the instance shows the origin's ${part} items`, (await projected(copy.id, part)) === partsBefore, { instance: await projected(copy.id, part), origin: partsBefore });
  await page.screenshot({ path: `${OUT}/${type}-instance.png` });

  await panelButton("Go to component").click();
  await page.waitForTimeout(700);
  const gone = await selected();
  check(`${type}: Go to component selects the page origin (no view)`, gone.target?.id === origin && gone.view === null, gone);

  // An origin edit reaches the instance (the first one asks: N instances).
  await page.evaluate((origin) => {
    const { workspace, commands } = window.__COMPOSITION_CATALOG__;
    workspace.execute(commands.setFields({ targets: [{ kind: "node", id: origin }], visual: { opacity: { kind: "set", value: 0.5 } } }));
  }, origin);
  const asked = await answerDialog();
  const opacity = await page.evaluate((id) => {
    const root = window.__COMPOSITION_CATALOG__.workspace.root;
    const record = root.recordsOfSource(id)[0];
    return root.canvasInputs.get(record)?.visual.opacity ?? null;
  }, copy.id);
  check(`${type}: origin edit asks once and reaches the instance`, asked && opacity === 0.5, { asked, opacity });
  kept[type] = { origin, instance: copy.id, definitionId: definition?.id };
}

// Delete an origin → its instance stays and restores it beside itself (Button).
{
  const { origin, instance, definitionId } = kept.Button;
  await selectNode(origin);
  await page.evaluate(() => document.querySelector(".canvas-container")?.focus());
  await page.keyboard.press("Delete");
  await page.waitForTimeout(600);
  let present = await page.evaluate((id) => window.__COMPOSITION_CATALOG__.workspace.runtime.graph.ownerOf(id), origin);
  if (present !== definitionId) {
    await page.evaluate((origin) => {
      const { workspace, commands } = window.__COMPOSITION_CATALOG__;
      workspace.execute(commands.removeTargets({ targets: [{ kind: "node", id: origin }] }));
    }, origin);
    await page.waitForTimeout(500);
    present = await page.evaluate((id) => window.__COMPOSITION_CATALOG__.workspace.runtime.graph.ownerOf(id), origin);
  }
  check("Button: deleting the origin keeps the instance (hidden template)", present === definitionId && (await instanceCount(definitionId)) === 1, { owner: present });
  await selectNode(instance);
  await page.waitForTimeout(400);
  const restorable = await section();
  check("Button: the instance offers Restore origin", restorable.buttons.includes("Restore origin"), restorable.buttons);
  await panelButton("Restore origin").click();
  await page.waitForTimeout(700);
  const restored = await page.evaluate(({ origin, instance }) => {
    const graph = window.__COMPOSITION_CATALOG__.workspace.runtime.graph;
    const parent = graph.getEntry(graph.ownerOf(instance));
    const list = parent?.children ?? [];
    return { owner: graph.ownerOf(origin) === graph.ownerOf(instance), next: list.indexOf(origin) === list.indexOf(instance) + 1 };
  }, { origin, instance });
  check("Button: Restore origin puts it back right after the instance", restored.owner && restored.next, restored);
  await page.screenshot({ path: `${OUT}/Button-restored.png` });
}

// Detach component on the Card origin: the node stays, the instance is detached.
{
  const { origin, instance, definitionId } = kept.Card;
  await selectNode(origin);
  await page.waitForTimeout(400);
  await panelButton("Detach component").click();
  await answerDialog();
  const after = await page.evaluate(({ origin, instance, definitionId }) => {
    const graph = window.__COMPOSITION_CATALOG__.workspace.runtime.graph;
    return { origin: graph.getEntry(origin)?.kind, definition: graph.getEntry(definitionId)?.kind ?? null, instanceDef: graph.getEntry(instance)?.definitionId };
  }, { origin, instance, definitionId });
  check("Card: Detach component keeps the origin node and detaches the instance", after.origin === "node" && after.definition === null && !after.instanceDef?.startsWith("project:definition:"), after);
}

// Copy the ToggleButtonGroup origin, then paste into another project → ordinary node.
const clipboard = await page.evaluate((origin) => {
  const { workspace, commands } = window.__COMPOSITION_CATALOG__;
  return JSON.parse(JSON.stringify(commands.copyNodes(workspace.runtime.graph, [origin])));
}, kept.ToggleButtonGroup.origin);
const sameProject = await page.evaluate((clipboard) => {
  const { workspace, commands } = window.__COMPOSITION_CATALOG__;
  const body = workspace.runtime.graph.getEntry(workspace.session.getSnapshot().pageId)?.children[0];
  const plan = workspace.execute(commands.pasteNodes({ clipboard, parent: { kind: "node", id: body }, newId: workspace.newId })).plan;
  return workspace.runtime.graph.getEntry(plan.selectAfter[0])?.definitionId;
}, clipboard);
check("ToggleButtonGroup: pasted copy of the origin in the same project = INSTANCE", sameProject === kept.ToggleButtonGroup.definitionId, sameProject);

// Reload (after the autosave wrote the last step): the origin is still the origin.
await page.waitForTimeout(1500);
await page.reload();
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await ready();
await page.waitForTimeout(1500);
const reloaded = await page.evaluate(({ origin, definitionId }) => {
  const graph = window.__COMPOSITION_CATALOG__.workspace.runtime.graph;
  return { ref: graph.definitionOfTemplateRoot(origin) === definitionId, instances: graph.instancesOf(definitionId).size };
}, kept.ToggleButtonGroup);
check("reload: the origin stays the origin, instances kept", reloaded.ref && reloaded.instances === 2, reloaded);

const other = await context.newPage();
watch(other);
await newProject(other, "ADR-260 live other");
const otherProject = await other.evaluate((clipboard) => {
  const { workspace, commands } = window.__COMPOSITION_CATALOG__;
  const body = workspace.runtime.graph.getEntry(workspace.session.getSnapshot().pageId)?.children[0];
  const plan = workspace.execute(commands.pasteNodes({ clipboard, parent: { kind: "node", id: body }, newId: workspace.newId })).plan;
  const graph = workspace.runtime.graph;
  const pasted = graph.getEntry(plan.selectAfter[0]);
  const projectInstances = Object.values(graph.exportDocument().entries).filter((e) => e.kind === "node" && e.definitionId.startsWith("project:definition:")).length;
  return { definitionId: pasted?.definitionId, projectInstances };
}, clipboard);
check("another project: the pasted origin is an ordinary node", !otherProject.definitionId?.startsWith("project:definition:") && otherProject.projectInstances === 0, otherProject);

const projects = await page.evaluate(() => indexedDB.databases?.().then((list) => list.map((d) => d.name)) ?? []);
writeFileSync(`${OUT}/out.json`, JSON.stringify({ results, errors, kept, projects }, null, 2));
const failed = results.filter((r) => !r.ok).length;
process.stdout.write(`\n${results.length - failed}/${results.length} PASS · page errors ${errors.length}\n`);
for (const e of errors.slice(0, 8)) process.stdout.write(`  ${e}\n`);
await browser.close();

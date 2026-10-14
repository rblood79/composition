// ADR-262 G3 — Component 절 「Push changes to component」 · 「Reset all changes」 · Canvas 메뉴 · 확인
// 대화상자 · 토스트 undo · 자리별 목록의 Fill · Hidden 행 · 다른 instance 반영 · Compare Mode (Canvas = Preview).
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr262-override-push-reset-live.mjs <out>
import { chromium } from "playwright";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const BASE = process.env.BUILDER_URL ?? "http://localhost:5173";
const state = JSON.parse(
  readFileSync(
    `${process.cwd()}/apps/builder/scripts/.auth-session.json`,
    "utf8",
  ),
);
state.origins = (state.origins ?? []).map((o) => ({ ...o, origin: BASE }));
const browser = await chromium.launch({ headless: false, channel: "chrome" });
const context = await browser.newContext({
  storageState: state,
  viewport: { width: 1600, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) =>
  errors.push(`pageerror: ${e.message.slice(0, 300)}`),
);
page.on("console", (m) => {
  if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`);
});
const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok: !!ok, detail });
  process.stdout.write(
    `${ok ? "PASS" : "FAIL"} ${name}${detail === undefined ? "" : ` ${JSON.stringify(detail)}`}\n`,
  );
};
const wait = (ms) => page.waitForTimeout(ms);
const exec = (source, arg) =>
  page.evaluate(
    ({ source, arg }) => {
      const cat = window.__COMPOSITION_CATALOG__;
      const make = new Function("cat", "arg", `return (${source})(cat, arg);`);
      return make(cat, arg);
    },
    { source, arg },
  );
const entry = (id) =>
  exec(
    `(cat, id) => JSON.parse(JSON.stringify(cat.workspace.runtime.graph.getEntry(id) ?? null))`,
    id,
  );
const panel = () =>
  page.locator('.workspace-panel-frame[data-panel="properties"]');
const rowNames = () =>
  panel()
    .locator(".component-semantics-field-name")
    .allTextContents()
    .catch(() => []);
async function answerDialog() {
  await wait(400);
  const dialog = page.locator('[role="dialog"], [role="alertdialog"]').first();
  if (await dialog.isVisible().catch(() => false)) {
    await dialog
      .getByRole("button")
      .filter({ hasNotText: /cancel|취소/i })
      .last()
      .click();
    await wait(400);
    return true;
  }
  return false;
}
const selectRoot = async (I) => {
  await exec(
    `(cat, a) => cat.workspace.selectRecords([cat.workspace.root.recordsOfSource(a.I)[0]])`,
    { I },
  );
  await wait(600);
  // (The rail button toggles the panel: open it only when it is closed.)
  if (!(await panel().isVisible().catch(() => false))) {
    const design = page
      .getByRole("button", { name: "Design", exact: true })
      .first();
    if (await design.isVisible().catch(() => false))
      await design.click().catch(() => {});
  }
  await wait(300);
};
const panelDebug = () =>
  page.evaluate(() => {
    const el = document.querySelector('.workspace-panel-frame[data-panel="properties"]');
    return {
      visible: !!el && getComputedStyle(el).display !== "none",
      buttons: [...(el?.querySelectorAll("button") ?? [])].map((b) => b.textContent?.trim()).filter(Boolean).slice(0, 20),
      selection: window.__COMPOSITION_CATALOG__.workspace.session.getSnapshot().selection.map((i) => i.target),
    };
  });
/** The Text record drawn inside instance `I` — its Canvas visual and the Preview DOM computed color. */
const textOf = async (I, T) => {
  const found = await exec(
    `(cat, a) => { for (const [id, r] of cat.workspace.root.domInputs.entries()) if (r.sourceId === a.T && r.instancePath.includes(a.I)) return { id, color: r.visual.color ?? null, opacity: r.visual.opacity ?? null }; return null; }`,
    { I, T },
  );
  if (!found) return null;
  const dom = await page
    .frameLocator("#previewFrame")
    .locator(`[data-catalog-id="${found.id}"]`)
    .first()
    .evaluate((el) => getComputedStyle(el).color, { timeout: 3000 })
    .catch(() => null);
  return { ...found, dom };
};
const clickUndoToast = async () => {
  const undo = page
    .getByRole("button", { name: /^(Undo|실행 취소)$/ })
    .first();
  const visible = await undo.isVisible().catch(() => false);
  if (visible) await undo.click();
  await wait(500);
  return visible;
};

// ── fixture ─────────────────────────────────────────────────────────────────────────────────────
await page.goto(`${BASE}/dashboard`);
await page
  .getByRole("button", { name: /new project/i })
  .first()
  .click();
await wait(300);
await page.keyboard.type(`ADR-262 push ${Date.now()}`);
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(
  () => window.__COMPOSITION_CATALOG__?.workspace,
  null,
  { timeout: 30000 },
);
await wait(1500);
const compare = page
  .getByRole("button", { name: "Compare Mode (Preview + Skia)", exact: true })
  .first();
if (await compare.isVisible().catch(() => false)) await compare.click();
await wait(2500);

const ids = await exec(`(cat) => {
  const ws = cat.workspace, c = cat.commands, g = ws.runtime.graph;
  const def = (name) => (name === "Frame" ? "lib:definition:type-frame" : "lib:definition:text");
  const body = g.getEntry(ws.session.getSnapshot().pageId).children[0];
  const n = (id, definitionId, children = [], extra = {}) => ({ kind: "node", id, definitionId, children, props: {}, visual: {}, sizing: {}, descendantOverrides: [], ...extra });
  const F = ws.newId("node"), T = ws.newId("node");
  ws.execute(c.insertNodes({ parent: { kind: "node", id: body }, entries: [n(F, def("Frame"), [T]), n(T, def("Text"), [], { props: { children: { kind: "set", value: "Hello" } } })], rootIds: [F], newId: ws.newId }));
  ws.execute(c.createComponent({ id: F, name: "Card", newId: ws.newId }));
  const I = ws.execute(c.duplicateNodes({ ids: [F], newId: ws.newId })).plan.selectAfter[0];
  const J = ws.execute(c.duplicateNodes({ ids: [F], newId: ws.newId })).plan.selectAfter[0];
  return { F, T, I, J, frame: def("Frame"), text: def("Text") };
}`);
process.stdout.write(`fixture ${JSON.stringify(ids)}\n`);
const overrideI = () =>
  exec(
    `(cat, a) => { const ws = cat.workspace, c = cat.commands;
      ws.execute(c.setFields({ targets: [{ kind: "descendant", ownerId: a.I, address: { instances: [a.I], templatePath: [a.F, a.T] } }], visual: { color: { kind: "set", value: "#ff0000" } } }));
      ws.execute(c.setFields({ targets: [{ kind: "node", id: a.I }], visual: { opacity: { kind: "set", value: 0.5 } } }));
      ws.execute(c.setWholeField({ targets: [{ kind: "node", id: a.I }], field: "fills", value: [{ kind: "color", id: "f1", enabled: true, opacity: 1, blendMode: "normal", color: "#00ff00ff" }] }));
      return ws.runtime.graph.revision; }`,
    ids,
  );
await overrideI();
await wait(600);

// 1 — the list shows every kind: the root's opacity · Fill and the position's Text.color.
await selectRoot(ids.I);
const rows1 = await rowNames();
check(
  "1 Overrides 목록에 opacity · Fill · Text.color 행",
  rows1.some((r) => /^opacity$/.test(r)) &&
    rows1.some((r) => /^(Fill|채움)$/.test(r)) &&
    rows1.some((r) => /^Text\.color$/.test(r)),
  rows1,
);
const beforeI = await textOf(ids.I, ids.T);
const beforeJ = await textOf(ids.J, ids.T);
check(
  "1b 반영 전 — I 의 Text 빨강 (Canvas = Preview) · J 는 아님",
  beforeI?.color === "#ff0000" &&
    beforeI?.dom === "rgb(255, 0, 0)" &&
    beforeJ?.color !== "#ff0000",
  { beforeI, beforeJ },
);
await page.screenshot({ path: `${OUT}/adr262-1-before.png` });

// 2 — Push changes: the dialog asks (one other instance), the origin takes it, I is clear, J shows it.
const pushButton = panel()
  .getByRole("button", { name: /^(Push changes to component|원본에 반영)$/ })
  .first();
check("2a Component 절에 Push 버튼", await pushButton.isVisible().catch(() => false));
await pushButton.click();
const asked = await answerDialog();
await wait(900);
const originT = await entry(ids.T);
const originF = await entry(ids.F);
const instanceI = await entry(ids.I);
const afterI = await textOf(ids.I, ids.T);
const afterJ = await textOf(ids.J, ids.T);
check(
  "2b 확인 대화상자 → 원본 T.color 빨강 · F.opacity 0.5 · F.fills · I 비움",
  asked &&
    originT?.visual?.color?.value === "#ff0000" &&
    originF?.visual?.opacity?.value === 0.5 &&
    Array.isArray(originF?.fills) &&
    Object.keys(instanceI?.visual ?? {}).length === 0 &&
    instanceI?.fills === undefined &&
    instanceI?.descendantOverrides?.length === 0,
  { asked, originT: originT?.visual, originF: { visual: originF?.visual, fills: originF?.fills }, instanceI: { visual: instanceI?.visual, overrides: instanceI?.descendantOverrides } },
);
check(
  "2c 반영 불변식 — I 의 Text 그대로 빨강 · J 도 빨강 · Canvas = Preview",
  afterI?.color === "#ff0000" &&
    afterI?.dom === "rgb(255, 0, 0)" &&
    afterJ?.color === "#ff0000" &&
    afterJ?.dom === "rgb(255, 0, 0)",
  { afterI, afterJ },
);
await page.screenshot({ path: `${OUT}/adr262-2-pushed.png` });
check("2d 토스트 undo → I 의 override 복원 · 원본 원상", (await clickUndoToast()) && (await entry(ids.T))?.visual?.color === undefined && (await entry(ids.I))?.descendantOverrides?.length === 1, { T: (await entry(ids.T))?.visual, I: (await entry(ids.I))?.descendantOverrides?.length });

// 3 — Reset all changes: I shows the origin; J untouched; undo restores.
await selectRoot(ids.I);
const resetButton = panel()
  .getByRole("button", { name: /^(Reset all changes|전부 되돌리기)$/ })
  .first();
check("3a Component 절에 Reset all 버튼", await resetButton.isVisible().catch(() => false), await panelDebug());
await resetButton.click();
await wait(800);
const resetI = await entry(ids.I);
const resetTextI = await textOf(ids.I, ids.T);
check(
  "3b Reset all → I override 0 · Text 색 원본 (빨강 아님) · Canvas = Preview · 대화상자 없음",
  resetI?.descendantOverrides?.length === 0 &&
    Object.keys(resetI?.visual ?? {}).length === 0 &&
    resetI?.fills === undefined &&
    resetTextI?.color !== "#ff0000" &&
    resetTextI?.dom !== "rgb(255, 0, 0)",
  { resetI: { visual: resetI?.visual, overrides: resetI?.descendantOverrides?.length }, resetTextI },
);
check("3c 토스트 undo → I 의 override 복원", (await clickUndoToast()) && (await entry(ids.I))?.descendantOverrides?.length === 1);
await page.screenshot({ path: `${OUT}/adr262-3-reset.png` });

// 4 — the Canvas menu's two items (on I, before its Text is hidden — a hidden-only frame has no
//     height to hit), then the position's Hidden row.
if (await page.getByLabel("Search components").isVisible().catch(() => false))
  await page.getByRole("button", { name: "Components", exact: true }).first().click();
const point = await exec(
  `(cat, a) => { const r = cat.workspace.root.recordsOfSource(a.I)[0]; cat.workspace.selectRecords([r]); const box = cat.canvas.boundsOf(r); const cam = cat.canvas.camera(); const rect = document.querySelector(".canvas-container canvas").getBoundingClientRect(); return { x: rect.left + cam.x + (box.x + 4) * cam.zoom, y: rect.top + cam.y + (box.y + 4) * cam.zoom, box }; }`,
  ids,
);
await page.mouse.click(point.x, point.y, { button: "right" });
await wait(600);
const menuPush = page.locator(".context-menu-item", { hasText: /Push changes to component|원본에 반영/ });
const menuReset = page.locator(".context-menu-item", { hasText: /Reset all changes|전부 되돌리기/ });
check("4b Canvas 메뉴에 Push · Reset all", (await menuPush.count()) > 0 && (await menuReset.count()) > 0, point);
await page.screenshot({ path: `${OUT}/adr262-4-menu.png` });
if (await menuReset.count()) await menuReset.first().click();
await wait(700);
check("4c 메뉴의 Reset all → I override 0", (await entry(ids.I))?.descendantOverrides?.length === 0);
await page.keyboard.press("Escape");
await exec(
  `(cat, a) => cat.workspace.execute(cat.commands.setWholeField({ targets: [{ kind: "descendant", ownerId: a.I, address: { instances: [a.I], templatePath: [a.F, a.T] } }], field: "enabled", value: false }))`,
  ids,
);
await selectRoot(ids.I);
const rows4 = await rowNames();
check(
  "4d 자리별 목록에 Text.Hidden 행",
  rows4.some((r) => /^Text\.(Hidden|숨김)$/.test(r)),
  rows4,
);
await page.screenshot({ path: `${OUT}/adr262-4-hidden.png` });

check("console · page errors 0", errors.length === 0, errors.slice(0, 5));
writeFileSync(
  `${OUT}/adr262-override-push-reset-live.json`,
  JSON.stringify({ ids, results, errors }, null, 2),
);
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);

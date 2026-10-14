// ADR-261 G2 — Swap instance (Figma): Design panel Component section → the component list →
// another component; what the instance changed follows by name (title text · slot content); the
// notice counts it; ⌘Z restores; the Canvas right-click 「Swap instance」 opens the same list.
//
//   BUILDER_URL=http://localhost:5173 node apps/builder/scripts/adr261-swap-live.mjs <out>
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

await page.goto(`${BASE}/dashboard`);
await page.getByRole("button", { name: /new project/i }).first().click();
await wait(300);
await page.keyboard.type(`ADR-261 swap ${Date.now()}`);
await page.keyboard.press("Enter");
await page.waitForURL(/\/builder\//, { timeout: 30000 });
await page.waitForSelector(".app:not(.builder-booting)", { timeout: 30000 });
await page.waitForFunction(() => window.__COMPOSITION_CATALOG__?.workspace, null, { timeout: 30000 });
await wait(1500);

// Fixture (commands): A = Frame > Text "A title" · Frame (slot content); B = Frame > Text "B title" ·
// Frame (slot content); I = ⌘D copy of A whose title says "Mine" and whose slot holds a Text.
const ids = await exec(`(cat) => {
  const ws = cat.workspace, c = cat.commands, g = ws.runtime.graph;
  const body = g.getEntry(ws.session.getSnapshot().pageId).children[0];
  const n = (id, def, extra = {}) => ({ kind: "node", id, definitionId: def, children: [], props: {}, visual: {}, sizing: {}, descendantOverrides: [], ...extra });
  const text = (id, value) => n(id, "lib:definition:text", { props: { children: { kind: "set", value } } });
  const F = "lib:definition:type-frame";
  const make = (label) => {
    const root = ws.newId("node"), title = ws.newId("node"), slot = ws.newId("node");
    ws.execute(c.insertNodes({ parent: { kind: "node", id: body }, entries: [n(root, F, { children: [title, slot] }), text(title, label + " title"), n(slot, F, { slot: { name: "content", required: false } })], rootIds: [root], newId: ws.newId }));
    ws.execute(c.createComponent({ id: root, name: "Card " + label, newId: ws.newId }));
    return { root, title, slot };
  };
  const A = make("A"), B = make("B");
  const project = g.getEntry(g.projectId);
  const [defA, defB] = project.definitionIds;
  const I = ws.execute(c.duplicateNodes({ ids: [A.root], newId: ws.newId })).plan.selectAfter[0];
  ws.execute(c.setFields({ targets: [{ kind: "descendant", ownerId: I, address: { instances: [I], templatePath: [A.root, A.title] } }], props: { children: { kind: "set", value: "Mine" } } }));
  const x = ws.newId("node");
  ws.execute(c.insertNodes({ parent: { kind: "descendant", ownerId: I, address: { instances: [I], templatePath: [A.root, A.slot] } }, entries: [text(x, "Slot content")], rootIds: [x], newId: ws.newId }));
  return { A, B, defA, defB, I, x };
}`);
await exec(`(cat, a) => cat.workspace.selectRecords([cat.workspace.root.recordsOfSource(a.I)[0]])`, ids);
await page.getByRole("button", { name: "Design", exact: true }).first().click().catch(() => {});
await wait(700);

// 1 — the name chip opens the list; the related component (Card B) is listed; choose it.
const trigger = page.getByRole("button", { name: /^(Swap instance|인스턴스 교체): Card A$/ });
check("1a Component 절 이름 칩 = Swap instance 버튼 (Card A)", await trigger.isVisible(), {});
await trigger.click();
await wait(400);
const dialog = page.getByRole("dialog");
const listed = await dialog.getByRole("option").allTextContents();
check("1b 목록: Card B 맨 위 「관련」 · 현재 Card A 없음 · Library 항목 포함", listed[0] === "Card B" && !listed.includes("Card A") && listed.length > 10, { first: listed.slice(0, 4), count: listed.length });
await dialog.getByRole("searchbox").fill("Card");
await wait(200);
const filtered = await dialog.getByRole("option").allTextContents();
check("1c 검색 'Card' → Card B 가 맨 위 (관련) · 맞지 않는 항목 0", filtered[0] === "Card B" && filtered.every((label) => /card/i.test(label)), filtered);
const revision = await exec(`(cat) => cat.workspace.runtime.graph.revision`);
await dialog.getByRole("option", { name: "Card B" }).click();
await wait(600);
const swapped = await entry(ids.I);
const toast = await page.locator(".toast-message").last().textContent().catch(() => null);
const drawn = await exec(`(cat, a) => { const root = cat.workspace.root; const top = root.recordsOfSource(a.I)[0]; const texts = []; const walk = (id) => { const r = root.domInputs.get(id); if (!r) return; if (root.typeOf(r) === "Text") texts.push(r.props?.children ?? r.text ?? null); r.children.forEach(walk); }; walk(top); return texts; }`, ids);
check("1d 교체 = 한 step · I 정의 = Card B · id 유지", swapped.definitionId === ids.defB && (await exec(`(cat) => cat.workspace.runtime.graph.revision`)) === revision + 1, { def: swapped.definitionId });
check("1e 제목 override 「Mine」 · slot 내용이 B 의 같은 자리로 (이름 경로 · slot 이름)", JSON.stringify(swapped.descendantOverrides.map((o) => [o.kind, o.address.templatePath.at(-1)])) === JSON.stringify([["patch", ids.B.title], ["fillSlot", ids.B.slot]]), { overrides: swapped.descendantOverrides.map((o) => [o.kind, o.address.templatePath]), drawn });
check("1f 알림: 유지 2 · 버림 0 · 밖으로 0", !!toast && /2/.test(toast) && /0/.test(toast), toast);
await page.screenshot({ path: `${OUT}/adr261-swap-1.png` });

// 2 — ⌘Z restores the instance of Card A with its changes.
await exec(`(cat) => cat.workspace.undo()`);
await wait(500);
const undone = await entry(ids.I);
check("2 undo 한 번 → Card A · 옛 주소 그대로", undone.definitionId === ids.defA && undone.descendantOverrides.every((o) => o.address.templatePath[0] === ids.A.root), { def: undone.definitionId });

// 3 — the Canvas right-click 「Swap instance」 opens the same list.
await page.keyboard.press("Escape");
const point = await exec(`(cat, a) => { const r = cat.workspace.root.recordsOfSource(a.I)[0]; cat.workspace.selectRecords([r]); const box = cat.canvas.boundsOf(r); const cam = cat.canvas.camera(); const rect = document.querySelector(".canvas-container canvas").getBoundingClientRect(); return { x: rect.left + cam.x + (box.x + 4) * cam.zoom, y: rect.top + cam.y + (box.y + 4) * cam.zoom }; }`, ids);
if (await page.getByLabel("Search components").isVisible().catch(() => false))
  await page.getByRole("button", { name: "Components", exact: true }).first().click();
await page.mouse.click(point.x, point.y, { button: "right" });
await wait(600);
const menuItem = page.locator(".context-menu-item", { hasText: /Swap instance|인스턴스 교체/ });
check("3a Canvas 메뉴에 Swap instance", (await menuItem.count()) > 0, point);
if (await menuItem.count()) await menuItem.first().click();
await wait(800);
check("3b 메뉴 → Design 패널의 같은 목록이 열림", await page.getByRole("dialog").getByRole("searchbox").isVisible().catch(() => false));
await page.screenshot({ path: `${OUT}/adr261-swap-3.png` });

// 4 — Phase 3 slot suggestions: on A's origin slot add 「Card B」 as a suggestion (Design panel);
//     on the instance's slot the suggestion is a button; pressing it fills the slot with Card B.
await page.keyboard.press("Escape");
await page.keyboard.press("Escape");
await exec(`(cat, a) => cat.workspace.selectRecords([cat.workspace.root.recordsOfSource(a.A.slot)[0]])`, ids);
await wait(700);
const addSuggestion = page.getByRole("group", { name: /^(Add suggestion|추천 추가)$/ }).getByRole("button").first();
check("4a 원본 slot 의 「추천 추가」", await addSuggestion.isVisible().catch(() => false), await page.evaluate(() => { const panel = document.querySelector('.workspace-panel-frame[data-panel="properties"]'); return { sections: [...(panel?.querySelectorAll(".section-title") ?? [])].map((e) => e.textContent), legends: [...(panel?.querySelectorAll("legend") ?? [])].map((e) => e.textContent).slice(0, 12), selection: window.__COMPOSITION_CATALOG__.workspace.session.getSnapshot().selection.map((i) => i.target) }; }));
await page.screenshot({ path: `${OUT}/adr261-slot-4a.png` });
await addSuggestion.click();
await wait(300);
await page.getByRole("option", { name: "Card B", exact: true }).click();
await wait(500);
// An origin edit with instances asks first (ADR-260 — the impact dialog): continue.
const impact = page.locator('[role="dialog"], [role="alertdialog"]').filter({ hasNot: page.getByRole("searchbox") }).first();
const asked = await impact.isVisible().catch(() => false);
if (asked) {
  await impact.getByRole("button").filter({ hasNotText: /cancel|취소/i }).last().click();
  await wait(500);
}
process.stdout.write(`impact dialog: ${asked}\n`);
const declared = (await entry(ids.A.slot)).slot;
check("4b 원본 slot.suggested = [Card B]", JSON.stringify(declared?.suggested) === JSON.stringify([ids.defB]), declared);
await exec(`(cat, a) => { const root = cat.workspace.root; const r = root.recordsOfSource(a.A.slot).find((id) => { for (let at = root.domInputs.get(id)?.parentId; at; at = root.domInputs.get(at)?.parentId) if (root.domInputs.get(at)?.sourceId === a.I) return true; return false; }); cat.workspace.selectRecords([r]); }`, ids);
await wait(700);
const chip = page.locator(".slot-suggestion-strip").getByRole("button", { name: "Card B", exact: true });
check("4c instance slot 에 추천 버튼 Card B", await chip.isVisible().catch(() => false));
const fillBefore = (await entry(ids.I)).descendantOverrides.find((o) => o.kind === "fillSlot")?.childIds.length ?? 0;
await chip.click();
await wait(600);
const fillAfter = (await entry(ids.I)).descendantOverrides.find((o) => o.kind === "fillSlot")?.childIds ?? [];
const added = fillAfter.length ? await entry(fillAfter.at(-1)) : null;
check("4d 누르면 slot 에 Card B instance 가 채워짐 (원본 무변경)", fillAfter.length === fillBefore + 1 && added?.definitionId === ids.defB && (await entry(ids.A.slot)).children.length === 0, { fillBefore, fillAfter: fillAfter.length, def: added?.definitionId });
await page.screenshot({ path: `${OUT}/adr261-slot-suggest.png` });

check("console · page errors 0", errors.length === 0, errors.slice(0, 5));
writeFileSync(`${OUT}/adr261-swap-live.json`, JSON.stringify({ results, errors }, null, 2));
await browser.close();
process.exit(results.every((r) => r.ok) ? 0 : 1);

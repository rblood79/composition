// G5 결함 수리 live 확인 — 5 (Select instance 의 ListBox 안 Section 에 항목) · 6 (Dialog instance 의 Close · footer 숨김,
// trigger 는 거부) · 7 (NumberField instance 의 Group 에 자식 — Input 은 placeholder 를 값으로 고정, 사용자 결정
// 2026-10-12 「A」). 수정 전: 5 = NESTING_NOT_ALLOWED, 6 = REQUIRED_PART_NOT_REMOVABLE, 7 = POSITION_HAS_TEMPLATE_BINDING.
import { edit, launch, newProject, place, previewHtml, recordOf, reopen } from "./harness.mjs";

const { browser, page, errors } = await launch();
await newProject(page, `g5-fix-${Date.now()}`);
const out = {};
const select = await place(page, "lib:definition:origin-component-select");
out.sectionInSelect = await edit(page, (c, ws, h, source) => {
  const list = h.within(h.bySource(source).id, "ListBox")[0];
  return [h.later(() => h.insert(list.id, [h.node(h.newId(), "lib:definition:origin-component-listbox-section")]))];
}, select);
out.itemInSection = await edit(page, (c, ws, h, source) => {
  const section = h.within(h.bySource(source).id, "ListBoxSection")[0];
  return [h.later(() => h.insert(section.id, [h.node(h.newId(), "lib:definition:origin-component-listbox-item-default")]))];
}, select);
const dialog = await place(page, "lib:definition:origin-component-dialog");
const hide = (type, index = 0) =>
  edit(page, (c, ws, h, [source, type, index]) => {
    const target = h.within(h.bySource(source).id, type)[index];
    return [h.later(() => c.removeTargets({ targets: [h.target(target.id)] }))];
  }, [dialog, type, index]);
// Buttons in the Dialog origin: [0] trigger "Open Dialog", [1] Close (in the footer).
out.closeHidden = await hide("Button", 1);
out.footerHidden = await hide("DialogFooter");
out.triggerHidden = await hide("Button", 0);
const field = await place(page, "lib:definition:origin-component-numberfield");
out.fieldPlaceholder = await edit(page, (c, ws, h, source) => [h.props(h.bySource(source).id, { placeholder: "Amount" })], field);
out.textInGroup = await edit(page, (c, ws, h, source) => {
  const group = h.within(h.bySource(source).id, "Group")[0];
  return [h.later(() => h.insert(group.id, [h.node(h.newId(), "lib:definition:text", { children: "kg" })]))];
}, field);
out.fieldPlaceholderChanged = await edit(page, (c, ws, h, source) => [h.props(h.bySource(source).id, { placeholder: "Weight" })], field);
out.reopened = await reopen(page);
const fieldHtml = (await previewHtml(page, await recordOf(page, field))) ?? "";
out.fieldInputPlaceholder = /<input[^>]*placeholder="([^"]*)"/.exec(fieldHtml)?.[1];
out.fieldGroupHasKg = /role="group"[\s\S]*kg/.test(fieldHtml);
out.sectionItems = await page.evaluate((source) => {
  const root = window.__COMPOSITION_CATALOG__.workspace.root;
  const all = [...root.canvasInputs.values()];
  const select = all.find((r) => r.sourceId === source);
  const count = (id, type) => { let n = 0; const v = (rid) => { const r = root.canvasInputs.get(rid); if (!r) return; if (root.typeOf(r) === type) n++; r.children.forEach(v); }; v(id); return n; };
  const section = (() => { let f; const v = (rid) => { const r = root.canvasInputs.get(rid); if (!r || f) return; if (root.typeOf(r) === "ListBoxSection") f = r; r.children.forEach(v); }; v(select.id); return f; })();
  return section ? count(section.id, "ListBoxItem") : -1;
}, select);
out.dialogPreview = (await previewHtml(page, await recordOf(page, dialog)))?.slice(0, 200);
console.log(JSON.stringify(out, null, 1));
console.log("errors", errors.slice(0, 5));
await browser.close();

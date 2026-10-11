import { edit, launch, newProject, place, previewHtml, recordOf, reopen } from "./harness.mjs";
import { run } from "./ex01.mjs";
const { browser, page } = await launch();
await newProject(page, `g5-diag01-${Date.now()}`);
// only part (b) — reuse run then inspect
await run(page);
const info = await page.evaluate(() => {
  const root = window.__COMPOSITION_CATALOG__.workspace.root;
  const all = [...root.canvasInputs.values()];
  const lists = all.filter((r) => root.typeOf(r) === "ListBox");
  const b = lists[lists.length - 1];
  const dump = (id, d = 0) => { const r = root.canvasInputs.get(id); return `${"  ".repeat(d)}${root.typeOf(r)} ${r.props.children ?? ""} [${r.id.slice(-40)}]\n` + r.children.map((k) => dump(k, d + 1)).join(""); };
  return { tree: dump(b.id), id: b.id };
});
console.log(info.tree);
const html = await previewHtml(page, info.id);
console.log(html.replace(/ (class|data-[a-z-]+|id|style|tabindex|aria-[a-z]+)="[^"]*"/g, "").slice(0, 3000));
await browser.close();

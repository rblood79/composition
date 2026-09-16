// index.css 를 잔여(residual)로 줄였을 때 preview 캐스케이드 순서가 바뀌는 (동일 layer·selector·property, 값이 다른) 쌍을 센다.
import postcss from "/Users/admin/work/composition/node_modules/.pnpm/postcss@8.5.26/node_modules/postcss/lib/postcss.mjs";
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
const S = resolve("packages/shared/src/components/styles");
import { execSync } from "node:child_process";
const sheets = JSON.parse(readFileSync(process.argv[2], "utf-8")).preview; // sheet-ids-before.json
const sheetsAfter = process.argv[3] ? JSON.parse(readFileSync(process.argv[3], "utf-8")).preview : null;
const idx = execSync("git show HEAD:packages/shared/src/components/styles/index.css", { encoding: "utf-8" });
const idxNew = readFileSync(join(S, "index.css"), "utf-8");
const indexListNew = [...idxNew.matchAll(/^@import "\.\/([^"]+)"/gm)].map((m) => m[1]);
const indexList = [...idx.matchAll(/^@import "\.\/([^"]+)"/gm)].map((m) => m[1]); // theme 제외 (토큰만)
const foundation = readFileSync(join(S, "foundation.css"), "utf-8");
const foundationList = [...foundation.matchAll(/^@import "\.\/([^"]+)"/gm)].map((m) => m[1]);
const jsList = sheets.filter((s) => s.id.startsWith("packages/shared/src/components/styles/") && !s.id.endsWith("index.css") && !s.id.endsWith("foundation.css")).map((s) => s.id.replace("packages/shared/src/components/styles/", ""));
const jsSet = new Set(jsList), fSet = new Set(foundationList);
const toJs = (list) => list.filter((s) => s.id.startsWith("packages/shared/src/components/styles/") && !s.id.endsWith("index.css") && !s.id.endsWith("foundation.css")).map((s) => s.id.replace("packages/shared/src/components/styles/", ""));
const jsListAfter = sheetsAfter ? toJs(sheetsAfter) : jsList;
const residual = sheetsAfter ? indexListNew : indexList.filter((f) => !jsSet.has(f) && !fSet.has(f));
const removed = indexList.filter((f) => jsSet.has(f) || fSet.has(f));
console.log(`index entries ${indexList.length} · foundation ${foundationList.length} · js sheets ${jsList.length} · residual ${residual.length} · removed ${removed.length}`);
console.log("RESIDUAL:", residual.join(" "));
// 순서 모델: 문서 등장 순서. BEFORE = foundation(0) + js + index(전체). AFTER = foundation(0) + js + residual.
const seqBefore = [...foundationList, ...jsList, ...indexList];
const MODEL = process.env.MODEL || "last";
const seqAfter = MODEL === "first" ? [...residual, ...foundationList, ...jsListAfter] : [...foundationList, ...jsListAfter, ...residual];
console.log("MODEL:", MODEL);
const lastPos = (seq) => { const m = new Map(); seq.forEach((f, i) => m.set(f, i)); return m; };
const pb = lastPos(seqBefore), pa = lastPos(seqAfter);
// 파일별 선언 추출 (nesting 은 부모 selector 와 결합, @layer 이름 기록)
const decls = new Map(); // file -> [{layer, sel, prop, val, imp}]
const flatten = (node, ctx, out) => {
  for (const child of node.nodes || []) {
    if (child.type === "atrule") {
      if (child.name === "layer") flatten(child, { ...ctx, layer: child.params || ctx.layer }, out);
      else if (child.name === "media" || child.name === "supports" || child.name === "container") flatten(child, { ...ctx, sel: ctx.sel, cond: (ctx.cond || "") + "@" + child.name + " " + child.params + ";" }, out);
      else if (child.name === "import") continue; else if (/keyframes$/.test(child.name)) flatten(child, { ...ctx, cond: (ctx.cond || "") + "@kf " + child.params + ";" }, out); else flatten(child, ctx, out);
    } else if (child.type === "rule") {
      const sels = child.selector.split(",").map((s) => s.trim());
      const parents = ctx.sel ? ctx.sel : [""];
      const combined = [];
      for (const p of parents) for (const s of sels) combined.push(p ? (s.includes("&") ? s.replace(/&/g, p) : p + " " + s) : s);
      flatten(child, { ...ctx, sel: combined }, out);
    } else if (child.type === "decl") {
      for (const s of ctx.sel || [""]) out.push({ layer: ctx.layer || "", cond: ctx.cond || "", sel: s, prop: child.prop, val: child.value, imp: !!child.important });
    }
  }
};
const allFiles = new Set([...foundationList, ...jsList, ...jsListAfter, ...indexList, ...residual]);
for (const f of allFiles) { try { const root = postcss.parse(readFileSync(join(S, f), "utf-8")); const out = []; flatten(root, {}, out); decls.set(f, out); } catch (e) { console.log("parse fail", f, e.message); } }
// key -> [{file, val}]
const byKey = new Map();
for (const [f, list] of decls) for (const d of list) { const k = `${d.layer}|${d.cond}|${d.imp ? "!" : ""}|${d.sel}|${d.prop}`; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push({ file: f, val: d.val }); }
const flips = [];
for (const [k, arr] of byKey) {
  if (arr.length < 2) continue;
  const files = [...new Set(arr.map((a) => a.file))]; if (files.length < 2) continue;
  for (let i = 0; i < files.length; i++) for (let j = i + 1; j < files.length; j++) {
    const A = files[i], B = files[j];
    const vA = arr.filter((a) => a.file === A).map((a) => a.val), vB = arr.filter((a) => a.file === B).map((a) => a.val);
    if (vA.every((v) => vB.includes(v)) && vB.every((v) => vA.includes(v))) continue; // 같은 값 → 무영향
    const before = Math.sign(pb.get(A) - pb.get(B)), after = Math.sign(pa.get(A) - pa.get(B));
    if (before !== after) flips.push({ key: k, A, B, vA, vB, winnerBefore: before > 0 ? A : B, winnerAfter: after > 0 ? A : B });
  }
}
console.log(`\nFLIPS (winner changes): ${flips.length}`);
for (const f of flips) console.log(`- ${f.key}\n    before→${f.winnerBefore}  after→${f.winnerAfter}   [${f.A}: ${f.vA.join("/")}] [${f.B}: ${f.vB.join("/")}]`);
// 부가: 동일 property + 같은 주 class 토큰이지만 selector 문자열이 다른 후보 (수동 검토용) — 순서가 바뀌는 파일쌍만
const spec = (sel) => { const s = sel.replace(/::?[a-z-]+(\([^)]*\))?/g, (m) => m.startsWith("::") ? "#E#" : (/^:(not|is|where|has)/.test(m) ? "" : "#C#")); const ids = (s.match(/#(?!E#|C#)[\w-]+/g) || []).length; const cls = (s.match(/\.[\w-]+|\[[^\]]*\]|#C#/g) || []).length; const els = (s.match(/(^|[\s>+~(])[a-z][\w-]*|#E#/g) || []).length; return ids * 100 + cls * 10 + els; };
const primary = (sel) => (sel.match(/\.react-aria-[A-Za-z]+|\.[a-zA-Z][\w-]*/) || [""])[0];
const cand = new Map();
for (const [f, list] of decls) for (const d of list) { const toks = [...new Set(d.sel.match(/\.react-aria-[A-Za-z]+/g) || [primary(d.sel)])]; for (const t of toks) { const k = `${d.layer}|${d.cond}|${d.imp ? "!" : ""}|${t}|${spec(d.sel)}|${d.prop}`; if (!cand.has(k)) cand.set(k, new Map()); const m = cand.get(k); if (!m.has(f)) m.set(f, new Map()); m.get(f).set(d.sel, d.val); } }
const pairFlip = (A, B) => Math.sign(pb.get(A) - pb.get(B)) !== Math.sign(pa.get(A) - pa.get(B));
let n = 0; const candOut = [];
const valuesDiffer = (a, b) => { const va = new Set(a.values()), vb = new Set(b.values()); for (const v of va) if (!vb.has(v)) return true; for (const v of vb) if (!va.has(v)) return true; return false; };
for (const [k, m] of cand) { const files = [...m.keys()]; if (files.length < 2) continue; for (let i = 0; i < files.length; i++) for (let j = i + 1; j < files.length; j++) if (pairFlip(files[i], files[j]) && valuesDiffer(m.get(files[i]), m.get(files[j]))) { n++; candOut.push(`${k}  {${files[i]} ↔ ${files[j]}}`); } }
console.log(`\nCANDIDATES (same primary class+prop, differing selectors, order changes): ${n}`);
console.log(candOut.slice(0, 400).join("\n"));
if (process.env.DUMP) { for (const [k, m] of cand) { const files = [...m.keys()]; if (files.length < 2) continue; for (let i = 0; i < files.length; i++) for (let j = i + 1; j < files.length; j++) if (pairFlip(files[i], files[j]) && valuesDiffer(m.get(files[i]), m.get(files[j]))) { console.log("\n## " + k); for (const f of [files[i], files[j]]) for (const [sel, val] of m.get(f)) console.log("   " + f + " :: " + sel + " = " + val); } } }

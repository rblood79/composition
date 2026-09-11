#!/usr/bin/env node
// adr212-editor-initial-bytes.mjs — ADR-212 G0/G5: production dist 의 초기 집합 (adr209-bundle-closure.mjs
// 가 계산한 initial JS 파일 목록) 안에 Data 패널 편집기 구현 (`panels/datatable/**`) 의 바이트가 몇 B
// 실렸는지 sourcemap 으로 귀속한다. `vite build --sourcemap` 산출물이 필요하다.
//
// 사용:
//   node apps/builder/scripts/adr212-editor-initial-bytes.mjs --closure <closure.json> --dist apps/builder/dist [--match panels/datatable]
import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

// sourcemap v3 `mappings` VLQ 디코더 (의존성 0 — @jridgewell/sourcemap-codec 은 hoist 되지 않는다).
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function decode(mappings) {
  const lines = [];
  let gen = 0,
    src = 0,
    srcLine = 0,
    srcCol = 0,
    name = 0;
  for (const line of mappings.split(";")) {
    const segs = [];
    gen = 0;
    if (line) {
      for (const seg of line.split(",")) {
        const vals = [];
        let shift = 0,
          value = 0;
        for (const ch of seg) {
          const d = B64.indexOf(ch);
          value += (d & 31) << shift;
          if (d & 32) shift += 5;
          else {
            vals.push(value & 1 ? -(value >> 1) : value >> 1);
            shift = 0;
            value = 0;
          }
        }
        gen += vals[0];
        const out = [gen];
        if (vals.length >= 4) {
          src += vals[1];
          srcLine += vals[2];
          srcCol += vals[3];
          out.push(src, srcLine, srcCol);
          if (vals.length >= 5) {
            name += vals[4];
            out.push(name);
          }
        }
        segs.push(out);
      }
    }
    lines.push(segs);
  }
  return lines;
}

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const closure = JSON.parse(readFileSync(resolve(opt("closure")), "utf8"));
const dist = resolve(opt("dist", "apps/builder/dist"));
const match = opt("match", "panels/datatable");

const files = closure.initial.js.files.map((f) =>
  typeof f === "string" ? f : (f.file ?? f.path ?? f.name),
);
const bySource = new Map();
let total = 0;
for (const rel of files) {
  const jsPath = join(dist, rel);
  const mapPath = `${jsPath}.map`;
  if (!existsSync(mapPath)) continue;
  const code = readFileSync(jsPath, "utf8");
  const map = JSON.parse(readFileSync(mapPath, "utf8"));
  const lines = code.split("\n");
  const decoded = decode(map.mappings);
  decoded.forEach((segments, lineIdx) => {
    const lineLen = Buffer.byteLength(lines[lineIdx] ?? "", "utf8");
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const start = seg[0];
      const end = i + 1 < segments.length ? segments[i + 1][0] : lineLen;
      const bytes = Math.max(0, end - start);
      const src = seg.length >= 4 ? map.sources[seg[1]] : "(unmapped)";
      if (!src || !src.includes(match)) continue;
      bySource.set(src, (bySource.get(src) ?? 0) + bytes);
      total += bytes;
    }
  });
}
const rows = [...bySource.entries()].sort((a, b) => b[1] - a[1]);
console.log(
  `# ${match} in initial JS (raw B, sourcemap 귀속) @ ${closure.revision.sha.slice(0, 9)}`,
);
console.log(`| source | raw B |\n| --- | ---: |`);
for (const [src, b] of rows)
  console.log(
    `| ${src.replace(/^.*?\/src\//, "src/")} | ${b.toLocaleString("en-US")} |`,
  );
console.log(`| **합계** | **${total.toLocaleString("en-US")}** |`);

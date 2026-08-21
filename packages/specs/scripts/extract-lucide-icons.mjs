#!/usr/bin/env node
/**
 * Lucide 아이콘 SVG path 데이터 추출 스크립트
 *
 * lucide-react ESM 파일에서 __iconNode 배열을 파싱하여
 * LucideIconData 형식의 TypeScript 파일을 생성한다.
 *
 * Usage: node packages/specs/scripts/extract-lucide-icons.mjs
 */

import { readdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

// lucide-react ESM icons — resolve via package (pin 경로 하드코딩 금지)
const require = createRequire(import.meta.url);
const lucidePkgJson = require.resolve("lucide-react/package.json");
const LUCIDE_ICONS_DIR = join(dirname(lucidePkgJson), "dist/esm/icons");
const OUTPUT_FILE = resolve(
  __dirname,
  "../src/icons/lucideIconData.generated.ts",
);

/**
 * SVG points 속성을 path d 문자열로 변환
 * points 형식: "x1,y1 x2,y2" 또는 "x1 y1 x2 y2"
 */
function pointsToPathD(pts) {
  // 쉼표와 공백을 모두 분리자로 처리하여 개별 숫자 추출
  const nums = pts.trim().split(/[\s,]+/).filter(Boolean);
  if (nums.length < 4) return null; // 최소 2좌표(x,y 2쌍)
  const pairs = [];
  for (let i = 0; i < nums.length - 1; i += 2) {
    pairs.push(`${nums[i]} ${nums[i + 1]}`);
  }
  return "M" + pairs[0] + pairs.slice(1).map((p) => " L" + p).join("");
}

/**
 * ESM 아이콘 파일에서 __iconNode 배열을 추출
 * 형식: const __iconNode = [ ["path", { d: "...", key: "..." }], ["circle", { cx: "11", cy: "11", r: "8", key: "..." }] ];
 */
function parseIconFile(content, fileName) {
  // __iconNode 배열 추출 — greedy로 마지막 ];까지 캡처
  const nodeMatch = content.match(
    /const __iconNode\s*=\s*(\[[\s\S]*?\]);\s*\nconst /,
  );
  if (!nodeMatch) return null;

  const nodeArrayStr = nodeMatch[1];

  const paths = [];
  const circles = [];
  const lines = [];
  const rects = [];
  const polylines = [];
  const polygons = [];
  const ellipses = [];

  // path 요소 추출 (multiline object support with [\s\S])
  const pathRegex = /\[\s*"path",\s*\{[\s\S]*?d:\s*"([^"]+)"/g;
  let match;
  while ((match = pathRegex.exec(nodeArrayStr)) !== null) {
    paths.push(match[1]);
  }

  // circle 요소 추출
  const circleRegex =
    /\[\s*"circle",\s*\{[\s\S]*?cx:\s*"([^"]+)"[\s\S]*?cy:\s*"([^"]+)"[\s\S]*?r:\s*"([^"]+)"/g;
  while ((match = circleRegex.exec(nodeArrayStr)) !== null) {
    circles.push({
      cx: parseFloat(match[1]),
      cy: parseFloat(match[2]),
      r: parseFloat(match[3]),
    });
  }

  // line 요소 추출 (속성 순서 비의존 — v1 는 x1,x2,y1,y2 순이 흔함)
  const lineRegex = /\[\s*"line",\s*\{([\s\S]*?)\}/g;
  while ((match = lineRegex.exec(nodeArrayStr)) !== null) {
    const attrs = match[1];
    const getAttr = (name) => {
      const m = attrs.match(new RegExp(`${name}:\\s*"([^"]+)"`));
      return m ? m[1] : null;
    };
    const x1 = getAttr("x1");
    const y1 = getAttr("y1");
    const x2 = getAttr("x2");
    const y2 = getAttr("y2");
    if (x1 != null && y1 != null && x2 != null && y2 != null) {
      lines.push({
        x1: parseFloat(x1),
        y1: parseFloat(y1),
        x2: parseFloat(x2),
        y2: parseFloat(y2),
      });
    }
  }

  // rect 요소 추출
  const rectRegex =
    /\[\s*"rect",\s*\{([\s\S]*?)\}/g;
  while ((match = rectRegex.exec(nodeArrayStr)) !== null) {
    const attrs = match[1];
    const getAttr = (name) => {
      const m = attrs.match(new RegExp(`${name}:\\s*"([^"]+)"`));
      return m ? m[1] : null;
    };
    const rect = {};
    for (const attr of ["width", "height", "x", "y", "rx", "ry"]) {
      const v = getAttr(attr);
      if (v != null) rect[attr] = parseFloat(v);
    }
    if (rect.width != null && rect.height != null) {
      rects.push(rect);
    }
  }

  // polyline 요소 추출
  const polylineRegex = /\[\s*"polyline",\s*\{[\s\S]*?points:\s*"([^"]+)"/g;
  while ((match = polylineRegex.exec(nodeArrayStr)) !== null) {
    polylines.push(match[1]);
  }

  // polygon 요소 추출
  const polygonRegex = /\[\s*"polygon",\s*\{[\s\S]*?points:\s*"([^"]+)"/g;
  while ((match = polygonRegex.exec(nodeArrayStr)) !== null) {
    polygons.push(match[1]);
  }

  // ellipse 요소 추출
  const ellipseRegex =
    /\[\s*"ellipse",\s*\{[\s\S]*?cx:\s*"([^"]+)"[\s\S]*?cy:\s*"([^"]+)"[\s\S]*?rx:\s*"([^"]+)"[\s\S]*?ry:\s*"([^"]+)"/g;
  while ((match = ellipseRegex.exec(nodeArrayStr)) !== null) {
    ellipses.push({
      cx: parseFloat(match[1]),
      cy: parseFloat(match[2]),
      rx: parseFloat(match[3]),
      ry: parseFloat(match[4]),
    });
  }

  // Convert non-path elements to path d strings for unified rendering
  // Lines → path
  for (const l of lines) {
    paths.push(`M${l.x1} ${l.y1}L${l.x2} ${l.y2}`);
  }

  // Polylines → path
  for (const pts of polylines) {
    const d = pointsToPathD(pts);
    if (d) paths.push(d);
  }

  // Polygons → path (closed)
  for (const pts of polygons) {
    const d = pointsToPathD(pts);
    if (d) paths.push(d + " Z");
  }

  // Rects → path
  for (const r of rects) {
    const x = r.x ?? 0;
    const y = r.y ?? 0;
    const w = r.width;
    const h = r.height;
    const rx = r.rx ?? 0;
    const ry = r.ry ?? rx;
    if (rx > 0 || ry > 0) {
      // Rounded rect as path
      paths.push(
        `M${x + rx} ${y}h${w - 2 * rx}a${rx} ${ry} 0 0 1 ${rx} ${ry}v${h - 2 * ry}a${rx} ${ry} 0 0 1 -${rx} ${ry}h-${w - 2 * rx}a${rx} ${ry} 0 0 1 -${rx} -${ry}v-${h - 2 * ry}a${rx} ${ry} 0 0 1 ${rx} -${ry}z`,
      );
    } else {
      paths.push(`M${x} ${y}h${w}v${h}h-${w}z`);
    }
  }

  // Ellipses → approximate as circles if rx === ry, else as path
  for (const e of ellipses) {
    if (e.rx === e.ry) {
      circles.push({ cx: e.cx, cy: e.cy, r: e.rx });
    } else {
      // Ellipse as two arcs
      paths.push(
        `M${e.cx - e.rx} ${e.cy}a${e.rx} ${e.ry} 0 1 0 ${2 * e.rx} 0a${e.rx} ${e.ry} 0 1 0 -${2 * e.rx} 0`,
      );
    }
  }

  if (paths.length === 0 && circles.length === 0) return null;

  const data = { paths };
  if (circles.length > 0) data.circles = circles;
  return data;
}

async function main() {
  console.log("Extracting Lucide icons from:", LUCIDE_ICONS_DIR);

  const files = await readdir(LUCIDE_ICONS_DIR);
  const jsFiles = files
    .filter((f) => (f.endsWith(".js") || f.endsWith(".mjs")) && !f.endsWith(".map"))
    .sort();

  console.log(`Found ${jsFiles.length} icon files`);

  const icons = new Map();
  const aliases = new Map(); // alias → canonical name
  let skipped = 0;
  const skippedNames = [];

  for (const file of jsFiles) {
    const name = file.replace(/\.mjs$/, "").replace(/\.js$/, "");
    const content = await readFile(join(LUCIDE_ICONS_DIR, file), "utf-8");

    // Check if this is an alias (re-export) — v0 `.js` / v1 `.mjs`
    const aliasMatch = content.match(
      /export \{\s*default\s*\}\s*from\s*['"]\.\/([^'"]+)\.(?:js|mjs)['"]/,
    );
    if (aliasMatch) {
      aliases.set(name, aliasMatch[1]);
      continue;
    }

    const data = parseIconFile(content, name);
    if (data) {
      icons.set(name, data);
    } else {
      skipped++;
      skippedNames.push(name);
    }
  }

  console.log(
    `Extracted ${icons.size} icons, ${aliases.size} aliases, ${skipped} skipped`,
  );
  if (skipped > 0) {
    console.log("Skipped icons (first 10):", skippedNames.slice(0, 10));
  }

  const lucideVersion =
    require(lucidePkgJson).version ?? "unknown";

  // Generate TypeScript
  let output = `/**
 * Lucide 아이콘 SVG path 데이터 (자동 생성)
 *
 * 생성 스크립트: packages/specs/scripts/extract-lucide-icons.mjs
 * lucide-react v${lucideVersion} 기준
 *
 * @generated
 */

import type { LucideIconData } from './lucideIcons';

/** Lucide 전체 아이콘 레지스트리 (~${icons.size}개) */
export const LUCIDE_ICON_DATA: Record<string, LucideIconData> = {\n`;

  for (const [name, data] of icons) {
    const pathsStr = data.paths.map((p) => `'${p.replace(/'/g, "\\'")}'`).join(",");
    if (data.circles) {
      const circlesStr = data.circles
        .map((c) => `{cx:${c.cx},cy:${c.cy},r:${c.r}}`)
        .join(",");
      output += `'${name}':{paths:[${pathsStr}],circles:[${circlesStr}]},\n`;
    } else {
      output += `'${name}':{paths:[${pathsStr}]},\n`;
    }
  }

  output += `};\n\n`;

  // Alias map
  output += `/** 아이콘 별칭 매핑 (alias → canonical name) */\nexport const LUCIDE_ALIASES: Record<string, string> = {\n`;
  for (const [alias, canonical] of aliases) {
    output += `'${alias}':'${canonical}',\n`;
  }
  output += `};\n\n`;

  // Icon names list for search
  output += `/** 전체 아이콘 이름 목록 (검색용) */\nexport const LUCIDE_ICON_NAMES: string[] = ${JSON.stringify([...icons.keys()])};\n`;

  await writeFile(OUTPUT_FILE, output, "utf-8");
  console.log(`Generated: ${OUTPUT_FILE}`);

  // Check file size
  const stats = await readFile(OUTPUT_FILE, "utf-8");
  console.log(`Output size: ${(stats.length / 1024).toFixed(1)} KB (raw)`);
}

main().catch(console.error);

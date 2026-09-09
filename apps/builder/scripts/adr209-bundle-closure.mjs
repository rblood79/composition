#!/usr/bin/env node
// adr209-bundle-closure.mjs — ADR-209 후속 F3 (§8.2·§8.3) 번들 closure 계산.
//
// 재는 것: production dist 의 entry html 이 실제로 참조하는 초기 집합 (script/modulepreload 의
// **정적 import 를 재귀 추적**한 closure) 과, Chart lazy entry (`RechartsChart-*.js`) 의 정적
// 전이 closure 에서 초기 집합을 뺀 lazy graph. 파일별 raw byte 와 gzip(level 9, mtime 0) byte 를
// 따로 합산한다. CSS 는 JS 와 분리해 기록한다 (과거 기록 209-bundle-closure.json 은 JS 만 합산).
//
// 동적 import (`import("./x.js")`, `__vitePreload`) 는 초기 집합에 넣지 않는다 — 대신 초기 집합이
// 가리키는 동적 대상 목록을 `dynamicTargets` 로 남겨 lazy entry 가 실제로 초기 밖에 있는지 확인한다.
//
// 사용:
//   node apps/builder/scripts/adr209-bundle-closure.mjs --repo <repo-root> --dist <dist-dir> --entry index.html --label builder --out <json>
//   node apps/builder/scripts/adr209-bundle-closure.mjs --compare before.json after.json   # markdown 표
import {
  readFileSync,
  writeFileSync,
  readdirSync,
  statSync,
  existsSync,
} from "node:fs";
import { resolve, dirname, join, relative, basename } from "node:path";
import { gzipSync } from "node:zlib";
import { execSync } from "node:child_process";
import { createHash } from "node:crypto";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};

if (args[0] === "--compare") {
  const before = JSON.parse(readFileSync(args[1], "utf8"));
  const after = JSON.parse(readFileSync(args[2], "utf8"));
  const fmt = (n) => n.toLocaleString("en-US");
  const row = (label, b, a) =>
    `| ${label} | ${fmt(b)} | ${fmt(a)} | ${a - b >= 0 ? "+" : ""}${fmt(a - b)} |`;
  console.log(
    `| ${before.label} (${before.revision.sha.slice(0, 9)} → ${after.revision.sha.slice(0, 9)}) | before B | after B | Δ B |`,
  );
  console.log("| --- | ---: | ---: | ---: |");
  console.log(
    row(
      "initial JS gzip",
      before.initial.js.gzipBytes,
      after.initial.js.gzipBytes,
    ),
  );
  console.log(
    row(
      "initial JS raw",
      before.initial.js.rawBytes,
      after.initial.js.rawBytes,
    ),
  );
  console.log(
    row(
      "initial CSS gzip",
      before.initial.css.gzipBytes,
      after.initial.css.gzipBytes,
    ),
  );
  console.log(
    row(
      "lazy chart graph JS gzip",
      before.lazy.js.gzipBytes,
      after.lazy.js.gzipBytes,
    ),
  );
  console.log(
    row(
      "lazy chart graph JS raw",
      before.lazy.js.rawBytes,
      after.lazy.js.rawBytes,
    ),
  );
  process.exit(0);
}

const repo = resolve(opt("repo", "."));
const dist = resolve(opt("dist"));
const entry = opt("entry", "index.html");
const label = opt("label", basename(dist));
const lazyMarker = opt("lazy", "RechartsChart");
const out = opt("out");
if (!dist || !existsSync(join(dist, entry))) {
  console.error(`entry not found: ${join(dist, entry)}`);
  process.exit(2);
}

const git = (cmd) =>
  execSync(`git -C "${repo}" ${cmd}`, { encoding: "utf8" }).trim();
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const revision = {
  sha: git("rev-parse HEAD"),
  dirtyFiles: git("status --porcelain").split("\n").filter(Boolean),
  dirtyPatchSha256: (() => {
    const patch = execSync(`git -C "${repo}" diff`, { encoding: "utf8" });
    return patch ? sha256(patch) : null;
  })(),
  lockfileSha256: sha256(readFileSync(join(repo, "pnpm-lock.yaml"))),
  node: process.version,
  pnpm: execSync("pnpm -v", { encoding: "utf8" }).trim(),
};

const html = readFileSync(join(dist, entry), "utf8");
const stripBase = (p) =>
  p
    .replace(/^https?:\/\/[^/]+/, "")
    .replace(/^\/composition\//, "/")
    .replace(/^\//, "");
const seedJs = [];
const seedCss = [];
for (const m of html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g))
  seedJs.push(stripBase(m[1]));
for (const m of html.matchAll(
  /<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g,
))
  seedJs.push(stripBase(m[1]));
for (const m of html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g))
  seedCss.push(stripBase(m[1]));

const STATIC_IMPORT =
  /(?:^|[;}\s])import(?:\s*[\w$*{}\s,]*?\s*from)?\s*["']([^"']+)["']/g;
const STATIC_EXPORT =
  /(?:^|[;}\s])export\s*[\w$*{}\s,]*?\s*from\s*["']([^"']+)["']/g;
const DYNAMIC_IMPORT = /import\(\s*["'`]([^"'`]+)["'`]\s*\)/g; // rolldown 은 backtick 으로 낸다
const cache = new Map();
function readJs(rel) {
  if (cache.has(rel)) return cache.get(rel);
  const abs = join(dist, rel);
  const src = readFileSync(abs, "utf8");
  const resolveRel = (spec) =>
    relative(dist, resolve(dirname(abs), spec))
      .split("\\")
      .join("/");
  const statics = new Set();
  for (const m of src.matchAll(STATIC_IMPORT))
    if (m[1].startsWith(".")) statics.add(resolveRel(m[1]));
  for (const m of src.matchAll(STATIC_EXPORT))
    if (m[1].startsWith(".")) statics.add(resolveRel(m[1]));
  const dynamics = new Set();
  for (const m of src.matchAll(DYNAMIC_IMPORT))
    if (m[1].startsWith(".")) dynamics.add(resolveRel(m[1]));
  const info = {
    statics: [...statics],
    dynamics: [...dynamics],
    rawBytes: statSync(abs).size,
    gzipBytes: gzipSync(readFileSync(abs), { level: 9 }).length,
  };
  cache.set(rel, info);
  return info;
}
function closure(seeds) {
  const seen = new Set();
  const stack = [...seeds];
  while (stack.length) {
    const rel = stack.pop();
    if (seen.has(rel)) continue;
    if (!existsSync(join(dist, rel))) continue;
    seen.add(rel);
    for (const dep of readJs(rel).statics) stack.push(dep);
  }
  return [...seen].sort();
}
const sum = (files, key) => files.reduce((acc, f) => acc + readJs(f)[key], 0);
const cssStats = (files) => {
  let rawBytes = 0,
    gzipBytes = 0;
  for (const f of files) {
    const buf = readFileSync(join(dist, f));
    rawBytes += buf.length;
    gzipBytes += gzipSync(buf, { level: 9 }).length;
  }
  return { files, rawBytes, gzipBytes };
};

const initialJs = closure(seedJs);
const initialSet = new Set(initialJs);
const dynamicTargets = [
  ...new Set(initialJs.flatMap((f) => readJs(f).dynamics)),
].sort();

const assetsDir = existsSync(join(dist, "assets")) ? "assets" : ".";
const lazyEntries = readdirSync(join(dist, assetsDir))
  .filter((f) => f.endsWith(".js") && f.includes(lazyMarker))
  .map((f) => `${assetsDir}/${f}`);
const lazyClosure = closure(lazyEntries).filter((f) => !initialSet.has(f));

const result = {
  label,
  measuredAt: new Date().toISOString(),
  repo,
  dist: relative(repo, dist),
  entry,
  revision,
  gzip: "node:zlib gzipSync level 9 (header mtime 0), per-file sum",
  initial: {
    seeds: seedJs,
    js: {
      files: initialJs,
      rawBytes: sum(initialJs, "rawBytes"),
      gzipBytes: sum(initialJs, "gzipBytes"),
    },
    css: cssStats(seedCss),
  },
  dynamicTargets,
  lazy: {
    marker: lazyMarker,
    entries: lazyEntries,
    entryInInitial: lazyEntries.some((f) => initialSet.has(f)),
    entryReachableDynamically: lazyEntries.some((f) =>
      dynamicTargets.includes(f),
    ),
    js: {
      files: lazyClosure,
      rawBytes: sum(lazyClosure, "rawBytes"),
      gzipBytes: sum(lazyClosure, "gzipBytes"),
    },
  },
};
const text = JSON.stringify(result, null, 2);
if (out) writeFileSync(out, text);
console.log(
  `[ADR-209 closure] ${label} @ ${revision.sha.slice(0, 9)}${revision.dirtyFiles.length ? ` (dirty ${revision.dirtyFiles.length})` : ""} — initial JS gzip ${result.initial.js.gzipBytes.toLocaleString("en-US")} B (${initialJs.length} files) · CSS gzip ${result.initial.css.gzipBytes.toLocaleString("en-US")} B · lazy ${lazyMarker} gzip ${result.lazy.js.gzipBytes.toLocaleString("en-US")} B (${lazyClosure.length} files, entry in initial=${result.lazy.entryInInitial}, dynamic-reachable=${result.lazy.entryReachableDynamically})`,
);

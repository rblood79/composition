#!/usr/bin/env node
/**
 * ADR-201 HC1 크기 게이트 측정 — core+tus (esm, minify, gzip) ≤ 6KB · IIFE (gzip) ≤ 10KB.
 *
 * "core+tus" = `createUploadQueue` 하나만 import 하는 소비자 번들의 **초기 청크** (tree-shake + code splitting 후) —
 * composition `renderFileUpload` 가 `import("@composition/upload/react")` 로 싣는 실제 페이로드에 가장 가깝다.
 * dry-run · fetch · multipart 는 큐가 옵션에 따라 `import()` 하는 지연 청크라 초기 청크 밖 (별도 표기).
 * 전체 index (모든 export) 와 IIFE (`dist/composition-upload.iife.js`, 지연 청크까지 전부 inline) 도 같이 잰다.
 *
 * 결과: `scripts/results/size.json` (테스트 `src/size.gate.test.ts` 가 읽는다)
 */
import { gzipSync } from "node:zlib";
import { mkdirSync, readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "tsup";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG = resolve(HERE, "..");
const OUT = join(process.env.TMPDIR ?? "/tmp", "adr201-size");
const KB = 1024;

export const LIMITS = { coreTus: 6 * KB, iife: 10 * KB };

const gz = (buf) => gzipSync(buf, { level: 9 }).length;

async function bundle(name, entryFile) {
  const outDir = join(OUT, name);
  await build({
    entry: { [name]: entryFile },
    outDir,
    format: ["esm"],
    target: "es2020",
    minify: true,
    // rollup treeshake 패스는 지연 청크를 entry 에 hoist (`import './chunk'`) 해 실제 로드 순서를 가린다 —
    // esbuild 자체 tree-shaking + splitting 만 쓴다 (Vite 의 dynamic import 청크 분리와 같은 형태)
    treeshake: false,
    clean: true,
    silent: true,
    dts: false,
    sourcemap: false,
    splitting: true,
    config: false,
    external: ["react"],
  });
  // 초기 페이로드 = entry + entry 가 정적으로 import 하는 청크 (재귀). 나머지 = 지연 청크
  const files = new Map(
    readdirSync(outDir)
      .filter((f) => f.endsWith(".js"))
      .map((f) => [f, readFileSync(join(outDir, f))]),
  );
  const staticImports = (code) =>
    [...code.matchAll(/(?:^|[;}\s])import\s*(?:[^;'"]*?from\s*)?["']\.\/([^"']+)["']/g)].map((m) => m[1]);
  const initial = new Set();
  const visit = (f) => {
    if (initial.has(f) || !files.has(f)) return;
    initial.add(f);
    for (const dep of staticImports(files.get(f).toString())) visit(dep);
  };
  visit(`${name}.js`);
  const sum = (names) =>
    names.reduce((acc, f) => ({ raw: acc.raw + files.get(f).length, gzip: acc.gzip + gz(files.get(f)) }), { raw: 0, gzip: 0 });
  const initialSize = sum([...initial]);
  const lazy = [...files.keys()]
    .filter((f) => !initial.has(f))
    .map((f) => ({ file: f, raw: files.get(f).length, gzip: gz(files.get(f)) }));
  return { ...initialSize, initialFiles: [...initial], lazyChunks: lazy };
}

export async function measure() {
  mkdirSync(OUT, { recursive: true });
  // 소비자 번들 — createUploadQueue 만
  const consumer = join(OUT, "consumer.ts");
  writeFileSync(
    consumer,
    `// 소비자는 re-export 를 tree-shake 한다 (package.json sideEffects:false) — 그 결과와 같은 정적 도달 범위를 만들기 위해 queue 모듈을 직접 가리킨다\nimport { createUploadQueue } from ${JSON.stringify(join(PKG, "src/core/queue.ts"))};\n(globalThis as any).__q = createUploadQueue;\n`,
  );
  const coreTus = await bundle("core-tus", consumer);
  const full = await bundle("index", join(PKG, "src/index.ts"));
  const react = await bundle("react", join(PKG, "src/react/index.ts"));
  const iifePath = join(PKG, "dist/composition-upload.iife.js");
  if (!existsSync(iifePath)) throw new Error("dist/composition-upload.iife.js 없음 — pnpm build 먼저");
  const iifeRaw = readFileSync(iifePath);
  const iife = { raw: iifeRaw.length, gzip: gz(iifeRaw), initialFiles: ["composition-upload.iife.js"], lazyChunks: [] };
  const result = {
    date: new Date().toISOString(),
    limits: LIMITS,
    coreTus,
    fullIndex: full,
    reactEntry: react,
    iife,
    pass: coreTus.gzip <= LIMITS.coreTus && iife.gzip <= LIMITS.iife,
  };
  mkdirSync(join(HERE, "results"), { recursive: true });
  writeFileSync(join(HERE, "results", "size.json"), JSON.stringify(result, null, 2) + "\n");
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = await measure();
  const row = (label, v, limit) =>
    `${label.padEnd(28)} raw ${String(v.raw).padStart(7)} B · gzip ${String(v.gzip).padStart(6)} B${
      limit ? ` (상한 ${limit} B — ${v.gzip <= limit ? "PASS" : "FAIL"})` : ""
    }`;
  console.log(row("core+tus (createUploadQueue)", r.coreTus, LIMITS.coreTus));
  console.log(`  initial = ${r.coreTus.initialFiles.join(" + ")}`);
  for (const c of r.coreTus.lazyChunks) console.log(row(`  lazy ${c.file}`, c));
  console.log(row("index (모든 export)", r.fullIndex));
  console.log(row("react entry", r.reactEntry));
  console.log(row("IIFE (vanilla, global)", r.iife, LIMITS.iife));
  if (!r.pass) process.exitCode = 1;
}

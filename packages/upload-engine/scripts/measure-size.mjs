#!/usr/bin/env node
/**
 * ADR-201 HC1 크기 게이트 측정 — core+tus (esm, minify, gzip) ≤ 6KB · IIFE (gzip) ≤ 10KB.
 *
 * "core+tus" = `createUploadQueue` 하나만 import 하는 소비자 번들 (tree-shake 후) —
 * composition `renderFileUpload` 가 `import("@composition/upload/react")` 로 싣는 실제 페이로드에 가장 가깝다.
 * 전체 index (모든 export) 와 IIFE (`dist/composition-upload.iife.js`, 빌드 산출물) 도 같이 잰다.
 *
 * 결과: `scripts/results/size.json` (테스트 `src/size.gate.test.ts` 가 읽는다)
 */
import { gzipSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
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
    treeshake: true,
    clean: true,
    silent: true,
    dts: false,
    sourcemap: false,
    splitting: false,
    config: false,
    external: ["react"],
  });
  const raw = readFileSync(join(outDir, `${name}.js`));
  return { raw: raw.length, gzip: gz(raw) };
}

export async function measure() {
  mkdirSync(OUT, { recursive: true });
  // 소비자 번들 — createUploadQueue 만
  const consumer = join(OUT, "consumer.ts");
  writeFileSync(
    consumer,
    `import { createUploadQueue } from ${JSON.stringify(join(PKG, "src/index.ts"))};\n(globalThis as any).__q = createUploadQueue;\n`,
  );
  const coreTus = await bundle("core-tus", consumer);
  const full = await bundle("index", join(PKG, "src/index.ts"));
  const react = await bundle("react", join(PKG, "src/react/index.ts"));
  const iifePath = join(PKG, "dist/composition-upload.iife.js");
  if (!existsSync(iifePath)) throw new Error("dist/composition-upload.iife.js 없음 — pnpm build 먼저");
  const iifeRaw = readFileSync(iifePath);
  const iife = { raw: iifeRaw.length, gzip: gz(iifeRaw) };
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
  console.log(row("index (모든 export)", r.fullIndex));
  console.log(row("react entry", r.reactEntry));
  console.log(row("IIFE (vanilla, global)", r.iife, LIMITS.iife));
  if (!r.pass) process.exitCode = 1;
}

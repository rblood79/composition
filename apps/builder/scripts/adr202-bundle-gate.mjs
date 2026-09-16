#!/usr/bin/env node
/** ADR-202 HC12: adr209-bundle-closure 산출물과 Vite manifest로 initial/lazy gate를 판정한다. */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const args = Object.fromEntries(
  Array.from({ length: (process.argv.length - 2) / 2 }, (_, i) => [
    process.argv[2 + i * 2].replace(/^--/, ""),
    process.argv[3 + i * 2],
  ]),
);
const read = (key) => JSON.parse(readFileSync(args[key], "utf8"));
const beforeBuilder = read("before-builder");
const beforePreview = read("before-preview");
const afterBuilder = read("after-builder");
const afterPreview = read("after-preview");
const manifest = read("manifest");
const dist = resolve(dirname(args.manifest), "..");
const closure = (key, seen = new Set()) => {
  if (seen.has(key)) return seen;
  if (!manifest[key]) throw new Error(`Missing manifest entry: ${key}`);
  seen.add(key);
  for (const child of manifest[key].imports ?? []) closure(child, seen);
  return seen;
};
const initialFiles = new Set(afterBuilder.initial.js.files);
const aiEntry = "src/builder/panels/ai/AIPanel.tsx";
const commandEntry = "src/services/ai/tools/runCommand.ts";
const aiClosure = closure(aiEntry);
closure(commandEntry, aiClosure);
const files = [
  ...new Set([...aiClosure].map((key) => manifest[key].file)),
].filter((file) => !initialFiles.has(file));
const sum = (fn) =>
  files.reduce((n, file) => n + fn(readFileSync(resolve(dist, file))), 0);
const before = {
  builder: beforeBuilder.initial.js.gzipBytes,
  preview: beforePreview.initial.js.gzipBytes,
};
const after = {
  builder: afterBuilder.initial.js.gzipBytes,
  preview: afterPreview.initial.js.gzipBytes,
};
const delta = {
  builder: after.builder - before.builder,
  preview: after.preview - before.preview,
};
const checks = {
  sameLockfile: [beforePreview, afterBuilder, afterPreview].every(
    (value) =>
      value.revision.lockfileSha256 === beforeBuilder.revision.lockfileSha256,
  ),
  beforeSameRevision: beforeBuilder.revision.sha === beforePreview.revision.sha,
  afterSameRevision: afterBuilder.revision.sha === afterPreview.revision.sha,
  builderAbsolute: after.builder <= 1319829,
  previewAbsolute: after.preview <= 675691, // 202 재승인 2026-09-16 (219 675021 대체)
  builderDelta: delta.builder <= 3.5 * 1024,
  previewDelta: delta.preview <= 0,
  budgetCurrent: new Date().toISOString().slice(0, 10) <= "2026-10-16",
  aiImplementationLazy: !initialFiles.has(manifest[aiEntry].file),
  commandLazy: !initialFiles.has(manifest[commandEntry].file),
};
const output = {
  before,
  after,
  delta,
  checks,
  firstOpen: {
    files,
    rawBytes: sum((buffer) => buffer.length),
    gzipBytes: sum((buffer) => gzipSync(buffer, { level: 9 }).length),
  },
  pass: Object.values(checks).every(Boolean),
};
if (args.out) writeFileSync(args.out, `${JSON.stringify(output, null, 2)}\n`);
console.log(JSON.stringify(output, null, 2));
process.exitCode = output.pass ? 0 : 1;

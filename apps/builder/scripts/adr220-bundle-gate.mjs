#!/usr/bin/env node
/**
 * ADR-220 G4 번들 판정기 — `adr202-bundle-gate.mjs` 는 202 전용 (Builder Δ ≤ 3,584 · Preview Δ ≤ 0 ·
 * lazy 대상 AIPanel/runCommand) 이라 220 조건을 검사하지 않는다 (round 1 m4). 입력은 202 와 같다:
 * adr209-bundle-closure.mjs 산출 4 (before/after × builder/preview) + after dist 의 Vite manifest.
 *
 *   node apps/builder/scripts/adr220-bundle-gate.mjs \
 *     --before-builder …/before-builder.json --before-preview …/before-preview.json \
 *     --after-builder …/after-builder.json --after-preview …/after-preview.json \
 *     --manifest …/after-dist/.vite/manifest.json --out …/220-gate.json
 *   node apps/builder/scripts/adr220-bundle-gate.mjs --self-test   # 음성 fixture 3
 *
 * 조건 (breakdown §7): sameLockfile · before/afterSameRevision · Builder·Preview initial gzip
 * |Δ| ≤ 512 각각 · 절대 상한 1,319,829 / 592,000 (ADR-202 재승인, 만료 2026-10-16) ·
 * `presetStrings` chunk 가 builder initial closure 밖 · 202 lazy 조건 (AIPanel · runCommand) 보존.
 */
import { readFileSync, writeFileSync } from "node:fs";

const BUILDER_CEILING = 1_319_829;
const PREVIEW_CEILING = 592_000;
const CEILING_EXPIRES = "2026-10-16";
const DELTA_LIMIT = 512;
// presetStrings 는 dynamic import 대상이 아니라 lazy 표면 (Add Table) 이 나눠 쓰는 공유 청크라
// manifest 키가 소스 경로가 아니라 청크 이름 (`_presetStrings-<hash>.js`, name "presetStrings") 이다
const PRESET_STRINGS_CHUNK = /^_presetStrings-[\w-]+\.js$/;
const AI_ENTRY = "src/builder/panels/ai/AIPanel.tsx";
const COMMAND_ENTRY = "src/services/ai/tools/runCommand.ts";

function sameRevision(left, right) {
  const leftDirtyFiles = [...(left.revision.dirtyFiles ?? [])].sort();
  const rightDirtyFiles = [...(right.revision.dirtyFiles ?? [])].sort();
  return (
    left.revision.sha === right.revision.sha &&
    (left.revision.dirtyPatchSha256 ?? null) ===
      (right.revision.dirtyPatchSha256 ?? null) &&
    JSON.stringify(leftDirtyFiles) === JSON.stringify(rightDirtyFiles)
  );
}

export function judge({
  beforeBuilder,
  beforePreview,
  afterBuilder,
  afterPreview,
  manifest,
  today = new Date().toISOString().slice(0, 10),
}) {
  const initialFiles = new Set(afterBuilder.initial.js.files);
  const chunkFile = (key) => {
    if (!manifest[key]) throw new Error(`Missing manifest entry: ${key}`);
    return manifest[key].file;
  };
  const presetStringsFile = (() => {
    const keys = Object.keys(manifest).filter(
      (key) =>
        PRESET_STRINGS_CHUNK.test(key) ||
        manifest[key].name === "presetStrings",
    );
    if (keys.length !== 1)
      throw new Error(
        `presetStrings chunk 가 1 개여야 한다: ${keys.join(", ")}`,
      );
    return manifest[keys[0]].file;
  })();
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
    beforeSameRevision: sameRevision(beforeBuilder, beforePreview),
    afterSameRevision: sameRevision(afterBuilder, afterPreview),
    builderDeltaWithin512: Math.abs(delta.builder) <= DELTA_LIMIT,
    previewDeltaWithin512: Math.abs(delta.preview) <= DELTA_LIMIT,
    builderAbsolute: after.builder <= BUILDER_CEILING,
    previewAbsolute: after.preview <= PREVIEW_CEILING,
    budgetCurrent: today <= CEILING_EXPIRES,
    presetStringsLazy: !initialFiles.has(presetStringsFile),
    aiImplementationLazy: !initialFiles.has(chunkFile(AI_ENTRY)),
    commandLazy: !initialFiles.has(chunkFile(COMMAND_ENTRY)),
  };
  return {
    before,
    after,
    delta,
    limits: {
      deltaAbs: DELTA_LIMIT,
      builderCeiling: BUILDER_CEILING,
      previewCeiling: PREVIEW_CEILING,
      expires: CEILING_EXPIRES,
    },
    chunks: {
      presetStrings: presetStringsFile,
      aiPanel: chunkFile(AI_ENTRY),
      runCommand: chunkFile(COMMAND_ENTRY),
    },
    checks,
    pass: Object.values(checks).every(Boolean),
  };
}

/** 음성 fixture 3 — ① after builder +1,000 ② presetStrings initial 편입 ③ 같은 SHA·다른 dirty patch → 실패 */
export function selfTest() {
  const revision = {
    sha: "a",
    dirtyFiles: [],
    dirtyPatchSha256: null,
    lockfileSha256: "lock",
  };
  const closure = (gzipBytes, files, revisionOverride = revision) => ({
    revision: revisionOverride,
    initial: { js: { gzipBytes, files } },
  });
  const manifest = {
    "_presetStrings-x.js": {
      file: "assets/presetStrings-x.js",
      name: "presetStrings",
    },
    [AI_ENTRY]: { file: "assets/AIPanel-x.js" },
    [COMMAND_ENTRY]: { file: "assets/runCommand-x.js" },
  };
  const initial = ["assets/index-x.js"];
  const good = {
    beforeBuilder: closure(1_300_000, initial),
    beforePreview: closure(590_000, initial),
    afterBuilder: closure(1_300_000, initial),
    afterPreview: closure(590_000, initial),
    manifest,
    today: "2026-09-16",
  };
  const results = {
    control: judge(good),
    plus1000: judge({ ...good, afterBuilder: closure(1_301_000, initial) }),
    presetStringsInInitial: judge({
      ...good,
      afterBuilder: closure(1_300_000, [
        ...initial,
        "assets/presetStrings-x.js",
      ]),
    }),
    dirtyPatchMismatch: judge({
      ...good,
      beforePreview: closure(590_000, initial, {
        ...revision,
        dirtyFiles: [" M apps/builder/src/example.ts"],
        dirtyPatchSha256: "different-patch",
      }),
    }),
  };
  const verdicts = {
    controlPasses: results.control.pass === true,
    plus1000Fails:
      results.plus1000.pass === false &&
      results.plus1000.checks.builderDeltaWithin512 === false,
    presetStringsInInitialFails:
      results.presetStringsInInitial.pass === false &&
      results.presetStringsInInitial.checks.presetStringsLazy === false,
    dirtyPatchMismatchFails:
      results.dirtyPatchMismatch.pass === false &&
      results.dirtyPatchMismatch.checks.beforeSameRevision === false,
  };
  return { verdicts, pass: Object.values(verdicts).every(Boolean), results };
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1]);
if (isMain) {
  if (process.argv.includes("--self-test")) {
    const result = selfTest();
    console.log(
      JSON.stringify({ verdicts: result.verdicts, pass: result.pass }, null, 2),
    );
    process.exitCode = result.pass ? 0 : 1;
  } else {
    const args = Object.fromEntries(
      Array.from({ length: (process.argv.length - 2) / 2 }, (_, i) => [
        process.argv[2 + i * 2].replace(/^--/, ""),
        process.argv[3 + i * 2],
      ]),
    );
    const read = (key) => JSON.parse(readFileSync(args[key], "utf8"));
    const output = judge({
      beforeBuilder: read("before-builder"),
      beforePreview: read("before-preview"),
      afterBuilder: read("after-builder"),
      afterPreview: read("after-preview"),
      manifest: read("manifest"),
    });
    if (args.out)
      writeFileSync(args.out, `${JSON.stringify(output, null, 2)}\n`);
    console.log(JSON.stringify(output, null, 2));
    process.exitCode = output.pass ? 0 : 1;
  }
}

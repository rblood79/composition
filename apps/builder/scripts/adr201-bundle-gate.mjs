#!/usr/bin/env node
/**
 * ADR-201 HC1 번들 판정기 — 202 판정기 (`adr202-bundle-gate.mjs`) 동형에 201 조건을 얹는다
 * (review-adr round 1 h2). 입력은 202 와 같다: adr209-bundle-closure.mjs 산출 4
 * (before/after × builder/preview) + after dist 의 Vite manifest.
 *
 *   node apps/builder/scripts/adr201-bundle-gate.mjs \
 *     --before-builder …/before-builder.json --before-preview …/before-preview.json \
 *     --after-builder …/after-builder.json --after-preview …/after-preview.json \
 *     --manifest …/after-dist/.vite/manifest.json --out …/201-gate.json
 *   node apps/builder/scripts/adr201-bundle-gate.mjs --self-test   # 음성 fixture 4
 *
 * 조건 (ADR-201 HC1 · G3):
 *   ① `@composition/upload` 의 모든 chunk (react entry + 지연 청크) 가 builder·preview initial closure 밖
 *   ② 등록 8지점 + renderer shell 의 initial Δ 가 201 허용치 안 (Builder ≤ +4,096 · Preview ≤ +3,584 —
 *      2026-09-17 실측 +3,875 / +3,507 을 올림한 값, 등록 구조상 Δ 0 은 불가)
 *   ③ 절대 상한 = ADR-201 initial 상한 재승인 (Builder ≤ 1,328,315 / Preview ≤ 601,346 B gzip,
 *      만료 2026-10-17 — 202 상한 1,319,829 / 592,000 을 대체). **`APPROVED` 가 false 인 동안 pass 는
 *      항상 false** — 상한 재승인은 사용자 결정이라 실행자가 켤 수 없다.
 *   ④ 202 lazy 조건 (AIPanel · runCommand) 보존 · before/after 각각 같은 revision
 *   sameLockfile 은 검사하지 않는다 — 201 은 workspace package 를 추가하므로 lockfile 이 달라지는 것이
 *   정상이다 (대신 lockfile diff 가 upload-engine 항목뿐임을 통합 세션이 `git diff pnpm-lock.yaml` 로 확인).
 */
import { readFileSync, writeFileSync } from "node:fs";

export const APPROVED = false; // 사용자 재승인 시 true 로 — ADR-201 §Gates "initial 상한 재승인" 절
export const BUILDER_CEILING = 1_328_315;
export const PREVIEW_CEILING = 601_346;
export const CEILING_EXPIRES = "2026-10-17";
export const BUILDER_DELTA_LIMIT = 4_096;
export const PREVIEW_DELTA_LIMIT = 3_584;
const UPLOAD_ENGINE_KEY = /packages\/upload-engine\/dist\//;
const AI_ENTRY = "src/builder/panels/ai/AIPanel.tsx";
const COMMAND_ENTRY = "src/services/ai/tools/runCommand.ts";

function sameRevision(left, right) {
  const l = [...(left.revision.dirtyFiles ?? [])].sort();
  const r = [...(right.revision.dirtyFiles ?? [])].sort();
  return (
    left.revision.sha === right.revision.sha &&
    (left.revision.dirtyPatchSha256 ?? null) ===
      (right.revision.dirtyPatchSha256 ?? null) &&
    JSON.stringify(l) === JSON.stringify(r)
  );
}

export function judge({
  beforeBuilder,
  beforePreview,
  afterBuilder,
  afterPreview,
  manifest,
  approved = APPROVED,
  today = new Date().toISOString().slice(0, 10),
}) {
  const initialFiles = new Set([
    ...afterBuilder.initial.js.files,
    ...afterPreview.initial.js.files,
  ]);
  const chunkFile = (key) => {
    if (!manifest[key]) throw new Error(`Missing manifest entry: ${key}`);
    return manifest[key].file;
  };
  const uploadChunks = Object.keys(manifest)
    .filter((key) => UPLOAD_ENGINE_KEY.test(key))
    .map((key) => ({ key, file: manifest[key].file }));
  if (uploadChunks.length === 0)
    throw new Error(
      "manifest 에 @composition/upload chunk 가 없다 — 실배선 누락",
    );
  const reactEntry = uploadChunks.find((c) =>
    /\/dist\/react\/index\.js$/.test(c.key),
  );
  if (!reactEntry)
    throw new Error("@composition/upload/react entry chunk 가 없다");
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
    beforeSameRevision: sameRevision(beforeBuilder, beforePreview),
    afterSameRevision: sameRevision(afterBuilder, afterPreview),
    uploadEngineLazy: uploadChunks.every((c) => !initialFiles.has(c.file)),
    builderDelta: delta.builder <= BUILDER_DELTA_LIMIT,
    previewDelta: delta.preview <= PREVIEW_DELTA_LIMIT,
    builderAbsolute: after.builder <= BUILDER_CEILING,
    previewAbsolute: after.preview <= PREVIEW_CEILING,
    budgetCurrent: today <= CEILING_EXPIRES,
    ceilingApproved: approved,
    aiImplementationLazy: !initialFiles.has(chunkFile(AI_ENTRY)),
    commandLazy: !initialFiles.has(chunkFile(COMMAND_ENTRY)),
  };
  return {
    before,
    after,
    delta,
    limits: {
      builderDelta: BUILDER_DELTA_LIMIT,
      previewDelta: PREVIEW_DELTA_LIMIT,
      builderCeiling: BUILDER_CEILING,
      previewCeiling: PREVIEW_CEILING,
      expires: CEILING_EXPIRES,
    },
    chunks: {
      uploadEngine: uploadChunks.map((c) => c.file),
      uploadReactEntry: reactEntry.file,
      aiPanel: chunkFile(AI_ENTRY),
      runCommand: chunkFile(COMMAND_ENTRY),
    },
    checks,
    pass: Object.values(checks).every(Boolean),
  };
}

/** 음성 fixture 4 — ① 미승인 ② react entry 가 initial 편입 ③ Builder Δ 초과 ④ 만료 */
export function selfTest() {
  const revision = { sha: "a", dirtyFiles: [], dirtyPatchSha256: null };
  const closure = (gzipBytes, files) => ({
    revision,
    initial: { js: { gzipBytes, files } },
  });
  const manifest = {
    "../../packages/upload-engine/dist/react/index.js": {
      file: "assets/react-x.js",
    },
    "../../packages/upload-engine/dist/dryRun-x.js": {
      file: "assets/dryRun-x.js",
    },
    [AI_ENTRY]: { file: "assets/AIPanel-x.js" },
    [COMMAND_ENTRY]: { file: "assets/runCommand-x.js" },
  };
  const initial = ["assets/index-x.js"];
  const base = {
    beforeBuilder: closure(1_324_440, initial),
    beforePreview: closure(597_839, initial),
    afterBuilder: closure(1_328_315, initial),
    afterPreview: closure(601_346, initial),
    manifest,
    today: "2026-09-17",
  };
  const results = {
    approvedPasses: judge({ ...base, approved: true }).pass === true,
    unapprovedFails: judge({ ...base, approved: false }).pass === false,
    reactEntryInInitialFails:
      judge({
        ...base,
        approved: true,
        afterBuilder: closure(1_328_315, [...initial, "assets/react-x.js"]),
      }).checks.uploadEngineLazy === false,
    builderDeltaOverFails:
      judge({
        ...base,
        approved: true,
        afterBuilder: closure(1_324_440 + BUILDER_DELTA_LIMIT + 1, initial),
      }).checks.builderDelta === false,
    expiredFails:
      judge({ ...base, approved: true, today: "2026-10-18" }).checks
        .budgetCurrent === false,
  };
  return { results, pass: Object.values(results).every(Boolean) };
}

const isMain =
  process.argv[1] && /adr201-bundle-gate\.mjs$/.test(process.argv[1]);
if (isMain) {
  if (process.argv.includes("--self-test")) {
    const r = selfTest();
    console.log(JSON.stringify(r, null, 2));
    process.exit(r.pass ? 0 : 1);
  }
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
  const json = JSON.stringify(output, null, 2);
  if (args.out) writeFileSync(args.out, json);
  console.log(json);
  process.exit(output.pass ? 0 : 1);
}

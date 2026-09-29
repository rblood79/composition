#!/usr/bin/env node
// ADR-248 G0: freeze exact old-module retirement candidates before adding the
// disconnected catalog graph. A candidate may need pure logic extracted first.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const baselineDir = resolve(root, "docs/adr/design/248-baseline");
const inventory = JSON.parse(
  readFileSync(resolve(baselineDir, "inventory.json"), "utf8"),
);
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (head !== inventory.baselineHead)
  throw new Error("Retirement inventory uses another baseline HEAD");

const oldDirectories = [
  "apps/builder/src/adapters/canonical",
  "apps/builder/src/builder/stores/canonical",
  "apps/builder/src/resolvers/canonical",
];
const oldFiles = execFileSync("rg", ["--files", ...oldDirectories], {
  cwd: root,
  encoding: "utf8",
})
  .trim()
  .split("\n")
  .sort();
const isTest = (path) =>
  path.includes("/__tests__/") || /\.test\.[cm]?[jt]sx?$/.test(path);
const hash = (path) =>
  createHash("sha256")
    .update(readFileSync(resolve(root, path)))
    .digest("hex");
const retirementCandidates = oldFiles.map((path) => ({
  path,
  sourceSha256: hash(path),
  kind: isTest(path) ? "old-contract-test" : "old-product-module",
  phase: "Phase 4",
  action: isTest(path)
    ? "replace with catalog behavior tests or retire after equivalent coverage"
    : "extract reusable pure behavior into catalog module, then remove old import graph module",
  status: "RETIREMENT_CANDIDATE; NOT_REMOVED",
}));
if (
  retirementCandidates.length !== 126 ||
  retirementCandidates.filter((row) => row.kind === "old-product-module")
    .length !== 56 ||
  new Set(oldFiles).size !== oldFiles.length
)
  throw new Error("Old Builder canonical module set changed from G0 count");

const nativeSpecs = ["Frame", "Group", "Slot"].map((name) => {
  const path = `packages/specs/src/components/${name}.spec.ts`;
  return {
    path,
    sourceSha256: hash(path),
    phase: "Phase 1–4",
    action:
      "move visual/structure definition to read-only catalog; replace runtime consumers; remove component spec definition",
    status: "NATIVE_SPEC_CANDIDATE; NOT_REMOVED",
  };
});
const rewriteBoundaries = [
  "apps/builder/src/lib/db/indexedDB/incrementalDocuments.ts",
  "apps/builder/src/lib/db/indexedDB/adapter.ts",
  "apps/builder/src/lib/db/types.ts",
  "apps/builder/src/lib/db/indexedDB/documentPersistGuard.ts",
].map((path) => ({
  path,
  sourceSha256: hash(path),
  phase: "Phase 4",
  action:
    "replace canonical document storage/guard with new graph namespace; preserve H1 data stores and current backup safety",
  status: "REWRITE_BOUNDARY; NOT_REMOVED",
}));
const publishFollowUp = inventory.directConsumers
  .filter((row) => row.family === "Publish follow-up")
  .map((row) => ({
    path: row.path,
    sourceSha256: hash(row.path),
    phase: "Publish follow-up",
    action:
      "leave untouched during Builder cutover, then replace canonical runtime",
    status: "DEFERRED_BY_H4",
  }));
if (publishFollowUp.length !== 3)
  throw new Error("Publish follow-up file set changed");
const retainedUntilPublish = [
  "packages/shared/src/types/composition-document.types.ts",
].map((path) => ({
  path,
  sourceSha256: hash(path),
  phase: "Publish follow-up",
  action:
    "remove shared canonical public model after Publish no longer imports it",
  status: "DEFERRED_BY_H4",
}));

const report = {
  baselineHead: head,
  status:
    "Exact old-module/spec/storage retirement candidate paths frozen; actual deletion requires Phase 4/Publish import graph checks",
  summary: {
    builderOldModuleCandidates: retirementCandidates.length,
    builderProductCandidates: retirementCandidates.filter(
      (row) => row.kind === "old-product-module",
    ).length,
    builderOldTests: retirementCandidates.filter(
      (row) => row.kind === "old-contract-test",
    ).length,
    nativeSpecDefinitions: nativeSpecs.length,
    storageRewriteBoundaries: rewriteBoundaries.length,
    publishFollowUpFiles: publishFollowUp.length,
    sharedModelDeferredUntilPublish: retainedUntilPublish.length,
  },
  retirementCandidates,
  nativeSpecs,
  rewriteBoundaries,
  publishFollowUp,
  retainedUntilPublish,
};
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
writeFileSync(
  resolve(process.argv[outIndex + 1]),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(report.summary)}\n`);

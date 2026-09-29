// ADR-248 G0: old persist command's isolated failure and project-switch result.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { DatabaseAdapter } from "../src/lib/db";
import { useCanonicalDocumentStore } from "../src/builder/stores/canonical/canonicalDocumentStore";
import { persistActiveCanonicalDocument } from "../src/builder/stores/canonical/persistActiveCanonicalDocument";

const root = resolve(import.meta.dirname, "../../..");
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out path required");
const out = resolve(process.argv[outIndex + 1]);
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const inventory = JSON.parse(
  readFileSync(
    resolve(root, "docs/adr/design/248-baseline/inventory.json"),
    "utf8",
  ),
);
assert.equal(head, inventory.baselineHead);
const sha256 = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
const sourcePaths = execFileSync(
  "git",
  [
    "ls-files",
    "-z",
    "apps/builder/src",
    "packages/shared/src",
    "packages/specs/src",
    "packages/engine/src",
  ],
  { cwd: root },
)
  .toString()
  .split("\0")
  .filter(Boolean);
const digest = createHash("sha256");
for (const path of sourcePaths)
  digest
    .update(path)
    .update("\0")
    .update(readFileSync(resolve(root, path)))
    .update("\0");
const scenario = {
  id: "adr248-old-isolated-save-failure-v1",
  seed: 248,
  operations: [
    { op: "setDocument", project: "first" },
    { op: "persistActive", database: "pending" },
    { op: "switchProject", project: "second", while: "database pending" },
    { op: "rejectPersist", error: "storage failure" },
  ],
  expectedRelations: [
    ["persist request", "first"],
    ["current project", "second"],
  ],
};
const store = useCanonicalDocumentStore;
const first = { version: "composition-1.0" as const, children: [] };
const second = { version: "composition-1.0" as const, children: [] };
store.getState().setDocument("adr248-failure-first", first);
store.getState().setDocument("adr248-failure-second", second);
store.getState().setCurrentProject("adr248-failure-first");
const captured = store.getState().getDocument("adr248-failure-first");
let resolveDatabase!: (db: DatabaseAdapter) => void;
const pending = persistActiveCanonicalDocument(
  () =>
    new Promise<DatabaseAdapter>((resolve) => {
      resolveDatabase = resolve;
    }),
);
store.getState().setCurrentProject("adr248-failure-second");
const calls: Array<{ projectId: string; sameDocument: boolean }> = [];
const error = new Error("storage failure");
const db = {
  documents: {
    put: async (projectId: string, document: unknown) => {
      calls.push({ projectId, sameDocument: document === captured });
      throw error;
    },
  },
} as unknown as DatabaseAdapter;
resolveDatabase(db);
const rejected = await pending.then(
  () => null,
  (reason: unknown) => reason,
);
assert.equal(rejected, error);
assert.deepEqual(calls, [
  { projectId: "adr248-failure-first", sameDocument: true },
]);
const oldOutput = {
  calledProject: calls[0].projectId,
  capturedDocumentIdentityPreserved: calls[0].sameDocument,
  rejectionName: error.name,
  rejectionMessage: error.message,
  currentProjectAfterFailure: store.getState().currentProjectId,
  firstDocumentStillInMemory:
    store.getState().getDocument("adr248-failure-first") === captured,
};
assert.equal(oldOutput.currentProjectAfterFailure, "adr248-failure-second");
assert.equal(oldOutput.firstDocumentStillInMemory, true);
const report = {
  head,
  executionBuildIdentity: `old-source-modules:${digest.digest("hex")}`,
  executionClass: "ISOLATED_OLD_MODULE_ORACLE",
  visualEnvironment: "NOT_APPLICABLE_TO_PURE_PERSIST_COMMAND",
  scenario,
  scenarioHash: sha256(JSON.stringify(scenario)),
  oldOutput,
  sourceAnchors: [
    "apps/builder/src/builder/stores/canonical/persistActiveCanonicalDocument.ts:16-29",
    "apps/builder/src/builder/stores/canonical/persistActiveCanonicalDocument.test.ts:29-48",
    "apps/builder/src/builder/stores/canonical/persistActiveCanonicalDocument.test.ts:70-89",
  ],
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(oldOutput)}\n`);

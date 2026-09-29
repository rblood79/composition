#!/usr/bin/env node
// ADR-248 G0: freeze external Pencil interchange without serializing the old document.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  exportPencilDocument,
  normalizePencilDocumentForSchemaCompare,
} from "../src/adapters/pencil/pencilExport";
import { importPencilDocument } from "../src/adapters/pencil/pencilImport";

const root = resolve(import.meta.dirname, "../../..");
const fixtureDir = resolve(root, "apps/builder/src/adapters/pencil/fixtures");
const fixtureNames = [
  "sample-minimal.pen",
  "sample-slots.pen",
  "sample-ref.pen",
  "sample-descendants.pen",
  "sample-imports.pen",
] as const;
const sha256 = (text: string) =>
  createHash("sha256").update(text).digest("hex");
const stable = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, stable(item)]),
    );
  return value;
};
const summarize = (value: unknown): unknown[] => {
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const children = Array.isArray(record.children) ? record.children : [];
  return [
    {
      id: record.id ?? null,
      type: record.type ?? null,
      ref: record.ref ?? null,
      slot: record.slot ?? null,
      descendantPaths:
        record.descendants && typeof record.descendants === "object"
          ? Object.keys(record.descendants).sort()
          : [],
      childIds: children.map((child) =>
        child && typeof child === "object"
          ? (child as Record<string, unknown>).id
          : null,
      ),
    },
    ...children.flatMap(summarize),
  ];
};
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
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
const sourceDigest = createHash("sha256");
for (const path of sourcePaths) {
  sourceDigest
    .update(path)
    .update("\0")
    .update(readFileSync(resolve(root, path)))
    .update("\0");
}
const productReferences = execFileSync(
  "rg",
  [
    "-l",
    "importPencilDocument|exportPencilDocument",
    "apps/builder/src",
    "-g",
    "!**/__tests__/**",
    "-g",
    "!**/fixtures/**",
  ],
  { cwd: root, encoding: "utf8" },
)
  .trim()
  .split("\n")
  .sort();
const adapterDefinitionPaths = [
  "apps/builder/src/adapters/pencil/index.ts",
  "apps/builder/src/adapters/pencil/pencilExport.ts",
  "apps/builder/src/adapters/pencil/pencilImport.ts",
];
assert.deepStrictEqual(productReferences, adapterDefinitionPaths);
const fixtures = fixtureNames.map((name) => {
  const inputText = readFileSync(resolve(fixtureDir, name), "utf8");
  const input = JSON.parse(inputText);
  const imported = importPencilDocument(input);
  const exported = exportPencilDocument(imported);
  const normalizedInput = normalizePencilDocumentForSchemaCompare(input);
  const normalizedOutput = normalizePencilDocumentForSchemaCompare(exported);
  assert.deepStrictEqual(
    normalizedOutput,
    normalizedInput,
    `${name}: old Pencil roundtrip`,
  );
  return {
    name,
    inputSha256: sha256(inputText),
    normalizedOutputSha256: sha256(JSON.stringify(stable(normalizedOutput))),
    semanticTree: (exported.children ?? []).flatMap(summarize),
    status: "OLD_INTERCHANGE_ROUNDTRIP_PASS",
  };
});
const scenario = {
  id: "adr248-old-pencil-interchange-v1",
  operations: fixtureNames.map((name) => ({
    op: "importPencilThenExportPencil",
    fixture: name,
  })),
};
const report = {
  head,
  executionBuildIdentity: `old-source-modules:${sourceDigest.digest("hex")}`,
  executionClass: "ISOLATED_OLD_MODULE_ORACLE",
  visualEnvironment: "NOT_APPLICABLE_TO_PURE_PENCIL_EXCHANGE",
  oldPublicCommandStatus: "UNREACHABLE_NO_PRODUCT_CALLER",
  productReferences,
  scenario,
  scenarioHash: sha256(JSON.stringify(scenario)),
  comparisonSurface: "external Pencil JSON normalized schema and semantic tree",
  oldDocumentSerialized: false,
  fixtures,
  summary: {
    fixtures: fixtures.length,
    totalSemanticNodes: fixtures.reduce(
      (count, fixture) => count + fixture.semanticTree.length,
      0,
    ),
    withDescendants: fixtures.filter((fixture) =>
      fixture.semanticTree.some(
        (node) =>
          typeof node === "object" &&
          node !== null &&
          "descendantPaths" in node &&
          Array.isArray(node.descendantPaths) &&
          node.descendantPaths.length > 0,
      ),
    ).length,
  },
};
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
writeFileSync(
  resolve(process.argv[outIndex + 1]),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(report.summary)}\n`);

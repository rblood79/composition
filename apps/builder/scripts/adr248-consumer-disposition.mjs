#!/usr/bin/env node
// ADR-248 G0: assign every directly affected source file a proposed owner/gate.
// Family routing is an impact map, not proof of a file's new implementation.
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
  throw new Error("Consumer disposition uses another baseline HEAD");

const plans = {
  "old mutation/ref adapter": [
    "replace",
    "catalog/document + catalog/transactions + catalog/resolution",
    ["G1", "G2", "G6"],
  ],
  "Pencil exchange": [
    "replace",
    "validated catalog import/export and external definition refs",
    ["G4", "G6"],
  ],
  "Builder integration": [
    "replace",
    "builder/catalogRuntime composition root and command adapter",
    ["G2", "G4", "G6"],
  ],
  "Builder inspector/panels": [
    "replace",
    "catalog graph selectors and typed editor transactions",
    ["G2", "G4", "G6"],
  ],
  "Builder state/history": [
    "replace",
    "builder/catalogRuntime state, history, derived indexes",
    ["G2", "G4", "G6"],
  ],
  "Canvas consumer": [
    "replace",
    "resolved catalog graph → Canvas scene/layout consumer",
    ["G3", "G6"],
  ],
  persistence: [
    "replace",
    "new catalog graph storage namespace and guarded commit",
    ["G4", "G6"],
  ],
  "DOM Preview consumer": [
    "replace",
    "resolved catalog graph → isolated DOM Preview consumer",
    ["G3", "G4", "G6"],
  ],
  "old resolver": [
    "replace",
    "catalog resolution and ephemeral cache",
    ["G1", "G3", "G6"],
  ],
  "AI command consumer": [
    "replace",
    "authorized AI command → typed catalog transaction/read selector",
    ["G2", "G4", "G6"],
  ],
  "Publish follow-up": [
    "defer-to-publish",
    "Publish catalog runtime after Builder stabilization; keep current code during Builder cutover",
    ["Publish"],
  ],
  "library definition/consumer": [
    "merge-and-replace",
    "read-only code catalog library, project overrides, binding registry",
    ["G1", "G3", "G6"],
  ],
  "shared reader/serializer": [
    "replace",
    "typed catalog graph schema, serializer, validated reader",
    ["G1", "G4", "G6"],
  ],
  "shared public schema": [
    "replace",
    "catalog graph public types/exports; remove canonical aliases",
    ["G1", "G6"],
  ],
};
const observedFamilies = [
  ...new Set(inventory.directConsumers.map((row) => row.family)),
];
if (
  observedFamilies.length !== Object.keys(plans).length ||
  observedFamilies.sort().join("|") !== Object.keys(plans).sort().join("|")
)
  throw new Error("Direct consumer family classification changed");
const rows = inventory.directConsumers.map((current) => {
  const [disposition, proposedOwner, plannedGates] = plans[current.family];
  if (
    !current.path ||
    !current.symbols?.length ||
    !proposedOwner ||
    !plannedGates.length
  )
    throw new Error(`Incomplete consumer responsibility: ${current.path}`);
  return {
    path: current.path,
    currentFamily: current.family,
    currentSymbols: current.symbols,
    test: current.test,
    disposition,
    proposedOwner,
    plannedGates,
    status: "FAMILY_ROUTE_CANDIDATE; FILE_LEVEL_BEHAVIOR_UNVERIFIED",
  };
});
if (
  rows.length !== 526 ||
  new Set(rows.map((row) => row.path)).size !== rows.length ||
  rows
    .map((row) => row.path)
    .sort()
    .join("|") !== [...inventory.directReferenceFiles].sort().join("|")
)
  throw new Error("Direct consumer path set differs from G0 inventory");
const report = {
  baselineHead: head,
  status:
    "526 direct reference files have family-level proposed owners; per-file value flow and implementation UNVERIFIED",
  summary: {
    files: rows.length,
    productFiles: rows.filter((row) => !row.test).length,
    testFiles: rows.filter((row) => row.test).length,
    families: observedFamilies.length,
    publishFollowUpFiles: rows.filter(
      (row) => row.disposition === "defer-to-publish",
    ).length,
    missingOwnerOrGate: rows.filter(
      (row) => !row.proposedOwner || !row.plannedGates.length,
    ).length,
  },
  rows,
};
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
writeFileSync(
  resolve(process.argv[outIndex + 1]),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(report.summary)}\n`);

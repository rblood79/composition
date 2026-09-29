#!/usr/bin/env node
// ADR-248 G0: state exact old-app output obligations; do not treat a broad PNG as field proof.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const dir = resolve(root, "docs/adr/design/248-baseline");
const read = (name) => JSON.parse(readFileSync(resolve(dir, name), "utf8"));
const flow = read("core-field-flow-audit.json");
const active = read("core-active-flow/baseline.json");
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (flow.head !== head || active.head !== head)
  throw new Error("Scenario scope HEAD drift");
const scenarios = [
  {
    id: "node-visual",
    fields: [
      "CanonicalNode.props",
      "CanonicalNode.fills",
      "CanonicalNode.responsive",
      "CanonicalNode.enabled",
      "CanonicalNode.sizing",
      "CanonicalNode.theme",
      "FrameNode.clip",
      "FrameNode.placeholder",
    ],
    required: [
      "public per-field mutation",
      "IDB/refresh",
      "Canvas geometry",
      "before/after PNG",
      "scene semantic value",
    ],
    evidence: [
      "node-fields/baseline.json",
      "core-active-flow/baseline.json",
      "native-state/baseline.json",
    ],
    gap: "single aggregate PNG does not isolate all eight field effects; clip has a known old Canvas style.overflow path; placeholder has no live reader",
  },
  {
    id: "node-identity-structure",
    fields: [
      "CanonicalNode.id",
      "CanonicalNode.type",
      "CanonicalNode.name",
      "CanonicalNode.metadata",
      "CanonicalNode.reusable",
      "CanonicalNode.children",
      "CanonicalNode.slot",
      "FrameNode.type",
      "RefNode.type",
      "RefNode.ref",
      "CompositionDocument.children",
      "CompositionDocument.version",
    ],
    required: [
      "public creation or edit",
      "IDB/refresh",
      "semantic tree",
      "geometry/PNG where rendered",
    ],
    evidence: [
      "leaf-value/baseline.json",
      "node-fields/baseline.json",
      "core-active-flow/baseline.json",
    ],
    gap: "semantic and pixels for each identity/structure field are not causally isolated",
  },
  {
    id: "node-state",
    fields: ["CanonicalNode.state"],
    required: [
      "public variable edit",
      "IDB/refresh",
      "element projection",
      "variant-dependent output",
    ],
    evidence: ["core-active-flow/baseline.json"],
    gap: "variable state projection confirmed; variant-dependent visual effect not exercised",
  },
  {
    id: "ref-descendant",
    fields: ["RefNode.descendants"],
    required: [
      "public patch",
      "IDB/refresh",
      "resolved semantic text",
      "Canvas geometry/PNG",
      "slot/presentation precedence branches",
    ],
    evidence: [
      "core-active-flow/baseline.json",
      "descendant-precedence.json",
      "descendant-transitive-audit.json",
    ],
    gap: "Label text resolves; every UI caller and input combination not exercised",
  },
  {
    id: "theme",
    fields: [
      "CompositionDocument.themes",
      "ThemeDefinition.id",
      "ThemeDefinition.name",
      "ThemeDefinition.preset",
      "ThemeDefinition.tokens",
      "ThemesCollection.active",
      "ThemesCollection.items",
      "ThemesCollection.order",
    ],
    required: [
      "public theme command",
      "IDB/refresh",
      "theme resolver output",
      "affected Canvas/DOM PNG",
    ],
    evidence: ["core-active-flow/baseline.json"],
    gap: "tint token resolver output confirmed; preset-only and selected component pixel outputs not isolated",
  },
  {
    id: "page-layout",
    fields: [
      "CompositionDocument.pageLayout",
      "PagePlacement.style",
      "PagePlacement.responsive",
      "PageLayoutSettingsDocument.direction",
      "PageLayoutSettingsDocument.gap",
      "PageLayoutSettingsDocument.columns",
      "PageLayoutSettingsDocument.responsive",
      "PageLayoutSettingsDocument.placementModel",
      "PageLayoutSettingsDocument.placements",
      "PageLayoutSettingsDocument.legacyFallback",
    ],
    required: [
      "public page command",
      "IDB/refresh",
      "resolved breakpoint style",
      "Canvas geometry/PNG",
    ],
    evidence: [
      "page-authoring/baseline.json",
      "core-active-flow/baseline.json",
    ],
    gap: "responsive mobile resolver confirmed; mobile Canvas PNG and legacyFallback old-model case absent",
  },
  {
    id: "page-guides",
    fields: [
      "CompositionDocument.pageGuides",
      "PageGuideLine.id",
      "PageGuideLine.axis",
      "PageGuideLine.position",
    ],
    required: [
      "public guide command",
      "IDB/refresh",
      "guide semantic and Canvas PNG",
    ],
    evidence: ["page-authoring/baseline.json"],
    gap: "stored values confirmed; field-specific guide pixel/geometry is not isolated",
  },
  {
    id: "interaction",
    fields: ["CompositionDocument.events", "CompositionDocument.actions"],
    required: [
      "public event command",
      "IDB/refresh",
      "interaction index and trigger result",
    ],
    evidence: ["core-active-flow/baseline.json"],
    gap: "events index confirmed; actual trigger outcome absent; root actions is dormant mirror with no live consumer",
  },
  {
    id: "optional-or-external",
    fields: [
      "CompositionDocument.tokens",
      "CompositionDocument.componentRules",
      "CompositionDocument.imports",
      "CompositionDocument.pagePositions",
      "CompositionDocument._meta",
    ],
    required: [
      "source writer/reader and absence reason",
      "external import or legacy input output only where reachable",
    ],
    evidence: ["core-field-flow-audit.json", "pen-interchange.json"],
    gap: "no current old Builder public edit command for these five fields; external/legacy routes are classified, not waived",
  },
];
const byKey = new Map();
for (const scenario of scenarios)
  for (const field of scenario.fields) {
    if (byKey.has(field)) throw new Error(`Duplicate field ${field}`);
    byKey.set(field, scenario.id);
  }
const missing = flow.rows
  .map((row) => row.key)
  .filter((key) => !byKey.has(key));
const extra = [...byKey.keys()].filter(
  (key) => !flow.rows.some((row) => row.key === key),
);
if (missing.length || extra.length)
  throw new Error(`Scope mismatch: ${missing}; ${extra}`);
const report = {
  head,
  status:
    "ALL_51_FIELDS_HAVE_SCENARIO_OUTPUT_SCOPE; PER_FIELD_OUTPUTS_NOT_CLOSED",
  summary: {
    fields: byKey.size,
    scenarios: scenarios.length,
    completeScenarios: 0,
    noPublicCommandFields: 7,
  },
  scenarios,
  fieldScenario: Object.fromEntries(
    [...byKey].sort(([a], [b]) => a.localeCompare(b)),
  ),
};
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
writeFileSync(
  resolve(process.argv[outIndex + 1]),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(report.summary)}\n`);

#!/usr/bin/env node
// ADR-248 G0: join proposed destinations with observed consumers and future gates.
// Static references and bridge source edges are routing evidence, never behavior PASS.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const baselineDir = resolve(root, "docs/adr/design/248-baseline");
const read = (name) =>
  JSON.parse(readFileSync(resolve(baselineDir, name), "utf8"));
const inventory = read("inventory.json");
const visualUses = read("visual-field-uses.json");
const visualBridge = read("visual-bridge-audit.json");
const visualValues = read("visual-value-source.json");
const visualRuntime = read("visual-runtime-output.json");
const visualRuntimeRepeatability = read(
  "visual-runtime-output-repeatability.json",
);
const nonvisual = read("nonvisual-field-audit.json");
const nonvisualRuntime = read("nonvisual-runtime-output.json");
const nonvisualRuntimeRepeatability = read(
  "nonvisual-runtime-output-repeatability.json",
);
const baselineHead = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
for (const [name, source] of [
  ["inventory", inventory],
  ["visual-field-uses", visualUses],
  ["visual-bridge-audit", visualBridge],
  ["visual-value-source", visualValues],
  ["visual-runtime-output", visualRuntime],
  ["nonvisual-field-audit", nonvisual],
  ["nonvisual-runtime-output", nonvisualRuntime],
]) {
  if ((source.baselineHead ?? source.head) !== baselineHead)
    throw new Error(`${name} uses another baseline HEAD`);
}
if (
  visualRuntime.summary.fields !== 102 ||
  visualRuntime.summary.authoredRuntimeValues !== 98 ||
  visualRuntime.summary.noCurrentTableValue !== 4 ||
  !visualRuntimeRepeatability.byteIdentical ||
  visualRuntimeRepeatability.independentRuns !== 2 ||
  visualRuntimeRepeatability.baselineSha256 !==
    createHash("sha256")
      .update(readFileSync(resolve(baselineDir, "visual-runtime-output.json")))
      .digest("hex") ||
  visualRuntimeRepeatability.repeatSha256 !==
    visualRuntimeRepeatability.baselineSha256
)
  throw new Error("Old visual runtime field output changed");
if (
  nonvisualRuntime.summary.fields !== 19 ||
  nonvisualRuntime.summary.oldRuntimeWitnesses !== 12 ||
  nonvisualRuntime.summary.dispositionOnly !== 7 ||
  !nonvisualRuntimeRepeatability.byteIdentical ||
  nonvisualRuntimeRepeatability.independentRuns !== 2 ||
  nonvisualRuntimeRepeatability.baselineSha256 !==
    createHash("sha256")
      .update(
        readFileSync(resolve(baselineDir, "nonvisual-runtime-output.json")),
      )
      .digest("hex") ||
  nonvisualRuntimeRepeatability.repeatSha256 !==
    nonvisualRuntimeRepeatability.baselineSha256
)
  throw new Error("Old nonvisual runtime field output changed");

const keyOf = (entry) => `${entry.interface ?? entry.family}.${entry.field}`;
const visualRows = new Map(visualUses.rows.map((row) => [keyOf(row), row]));
const visualValueRows = new Map(visualValues.rows.map((row) => [row.key, row]));
const visualRuntimeRows = new Map(
  visualRuntime.rows.map((row) => [row.key, row]),
);
const bridgeRoutes = new Map(
  visualBridge.indirectRoutes.flatMap((route) =>
    route.fields.map((field) => [field, route]),
  ),
);
const chartFields = new Set(
  visualBridge.chartFields.map((field) => `ComponentRuleChart.${field}`),
);
const nonvisualRoutes = new Map(
  nonvisual.fields.map((field) => [keyOf(field), field]),
);
const nonvisualRuntimeRows = new Map(
  nonvisualRuntime.rows.map((row) => [row.key, row]),
);
const uniquePaths = (sites) =>
  [...new Set(sites.map((site) => site.path))].sort();
const surfaceOf = (path) =>
  path.startsWith("apps/builder/src/builder/workspace/canvas/")
    ? "Canvas"
    : path.startsWith("apps/builder/src/preview/") ||
        path.startsWith("packages/shared/src/renderers/") ||
        path.startsWith("packages/shared/src/components/")
      ? "DOM/Preview"
      : path.startsWith("packages/specs/scripts/") ||
          path.startsWith("packages/rendering/src/renderers/")
        ? "specs generator/renderer"
        : path.startsWith("apps/builder/src/builder/")
          ? "Builder state/UI"
          : "shared/other";
const plannedGates = (family, disposition) => {
  if (family.startsWith("ComponentRule")) return ["G1", "G3", "G4", "G6"];
  if (family === "PagePositionPoint") return ["G1", "G2", "G3", "G4", "G6"];
  if (family === "ThemeSnapshot" || family === "TokensSnapshotEntry")
    return ["G1", "G4", "G6"];
  if (
    disposition?.includes("BINDING") ||
    family === "SerializedDataBinding" ||
    family === "CompositionExtension" ||
    family === "CompositionExtendedNode"
  )
    return ["G1", "G2", "G4", "G6"];
  return ["G1", "G4", "G6"];
};
const entries = inventory.proposedFieldDestinations.map((proposed) => {
  const key = keyOf(proposed);
  const gates = plannedGates(proposed.interface);
  if (proposed.interface.startsWith("ComponentRule")) {
    const row = visualRows.get(key);
    if (!row) throw new Error(`${key}: visual row missing`);
    const valueSource = visualValueRows.get(key);
    const runtimeOutput = visualRuntimeRows.get(key);
    if (
      !valueSource ||
      valueSource.status !==
        "OLD_SOURCE_AND_CONSUMER_CLASSIFIED; BEHAVIOR_UNVERIFIED"
    )
      throw new Error(`${key}: old table value source missing`);
    if (
      !runtimeOutput ||
      runtimeOutput.consumerRouteKind !==
        (row.sites.some((site) => !site.test)
          ? "DIRECT_STATIC_ACCESS"
          : chartFields.has(key)
            ? "STRUCTURAL_CHART_BRIDGE"
            : "CURATED_INDIRECT_BRIDGE")
    )
      throw new Error(`${key}: old resolver output missing or route changed`);
    const productSites = row.sites.filter((site) => !site.test);
    const directTestPaths = uniquePaths(row.sites.filter((site) => site.test));
    const bridge = bridgeRoutes.get(key);
    const chart = chartFields.has(key);
    if (!productSites.length && !bridge && !chart)
      throw new Error(`${key}: no observed direct or bridge route`);
    const paths = productSites.length
      ? uniquePaths(productSites)
      : chart
        ? [...new Set(visualBridge.edges.map((edge) => edge.path))].sort()
        : [...new Set(bridge.edges.map(([path]) => path))].sort();
    return {
      key,
      oldInterface: proposed.interface,
      oldField: proposed.field,
      proposedDestination: proposed.target,
      writerFamily:
        "componentRulesTable library definition; current authored values counted, project override unverified",
      currentTableValueCount: valueSource.authoredCount,
      currentTableValueStatus: valueSource.currentValueStatus,
      currentValueSource: "visual-value-source.json",
      oldRuntimeValueEvidence: {
        scenarioId: runtimeOutput.scenarioId,
        oldOutput: "visual-runtime-output.json",
        status: runtimeOutput.oldOutput.status,
        aggregateCanvas: runtimeOutput.oldOutput.aggregateCanvas?.path ?? null,
      },
      routeKind: productSites.length
        ? "DIRECT_STATIC_ACCESS"
        : chart
          ? "STRUCTURAL_CHART_BRIDGE"
          : "CURATED_INDIRECT_BRIDGE",
      currentConsumerPaths: paths,
      currentSurfaces: [...new Set(paths.map(surfaceOf))].sort(),
      currentDirectTestPaths: directTestPaths,
      testEvidence: directTestPaths.length
        ? "DIRECT_SYMBOL_REFERENCE_ONLY"
        : "NO_DIRECT_SYMBOL_TEST_FOUND",
      plannedGates: gates,
      plannedScenario: `catalog-visual/${proposed.interface}/${proposed.field}`,
      plannedScenarioStatus: "NOT_IMPLEMENTED",
      behaviorStatus: "UNVERIFIED",
    };
  }
  const route = nonvisualRoutes.get(key);
  if (!route) throw new Error(`${key}: nonvisual route missing`);
  const runtimeOutput = nonvisualRuntimeRows.get(key);
  if (!runtimeOutput) throw new Error(`${key}: nonvisual old output missing`);
  const paths = [route.writer?.path, route.reader?.path].filter(Boolean);
  return {
    key,
    oldInterface: proposed.interface,
    oldField: proposed.field,
    proposedDestination: proposed.target,
    disposition: route.disposition,
    oldRuntimeValueEvidence: {
      scenarioId: runtimeOutput.scenarioId,
      oldOutput: "nonvisual-runtime-output.json",
      status: runtimeOutput.status,
    },
    currentWriterPath: route.writer?.path ?? null,
    currentReaderPath: route.reader?.path ?? null,
    currentConsumerPaths: [...new Set(paths)].sort(),
    currentSurfaces: [...new Set(paths.map(surfaceOf))].sort(),
    routeKind: "CURATED_SOURCE_EDGE_CANDIDATE",
    testEvidence: "NOT_ASSESSED_BY_THIS_AUDIT",
    plannedGates: plannedGates(proposed.interface, route.disposition),
    plannedScenario: `catalog-document/${proposed.interface}/${proposed.field}`,
    plannedScenarioStatus: "NOT_IMPLEMENTED",
    behaviorStatus: "UNVERIFIED",
  };
});
const keys = entries.map((entry) => entry.key);
if (keys.length !== 121 || new Set(keys).size !== keys.length)
  throw new Error("Field matrix must cover 121 unique proposed fields");
if (
  entries.some(
    (entry) =>
      !entry.proposedDestination ||
      !entry.currentConsumerPaths.length ||
      !entry.plannedGates.length,
  )
)
  throw new Error("Field matrix has missing destination, source path, or gate");
const report = {
  baselineHead,
  status:
    "ROUTES_CLASSIFIED; behavior, field-level authoring, and future gate PASS UNVERIFIED",
  summary: {
    fields: entries.length,
    visual: entries.filter((entry) =>
      entry.oldInterface.startsWith("ComponentRule"),
    ).length,
    nonvisual: entries.filter(
      (entry) => !entry.oldInterface.startsWith("ComponentRule"),
    ).length,
    directVisual: entries.filter(
      (entry) => entry.routeKind === "DIRECT_STATIC_ACCESS",
    ).length,
    chartBridge: entries.filter(
      (entry) => entry.routeKind === "STRUCTURAL_CHART_BRIDGE",
    ).length,
    indirectVisual: entries.filter(
      (entry) => entry.routeKind === "CURATED_INDIRECT_BRIDGE",
    ).length,
    visualFieldsWithTableValue: entries.filter(
      (entry) => entry.currentTableValueCount > 0,
    ).length,
    visualFieldsWithoutTableValue: entries
      .filter((entry) => entry.currentTableValueCount === 0)
      .map((entry) => entry.key),
    oldRuntimeValuesVerified: entries.filter(
      (entry) =>
        entry.oldRuntimeValueEvidence?.status === "OLD_RESOLVER_VALUE_FROZEN",
    ).length,
    nonvisualOldRuntimeWitnesses: entries.filter(
      (entry) =>
        entry.oldRuntimeValueEvidence?.status === "OLD_PURE_RUNTIME_WITNESS",
    ).length,
    missingDestinationOrRouteOrGate: 0,
    behaviorVerified: entries.filter(
      (entry) => entry.behaviorStatus !== "UNVERIFIED",
    ).length,
  },
  entries,
};
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
writeFileSync(
  resolve(process.argv[outIndex + 1]),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(report.summary)}\n`);

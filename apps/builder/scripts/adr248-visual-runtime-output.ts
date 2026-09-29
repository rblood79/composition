// ADR-248 G0: old table field values through the actual shared rule resolver.
// Existing old Canvas captures are attached as aggregate output, not proof of
// each individual visual field's pixel effect.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { COMPONENT_RULES_TABLE } from "../../../packages/shared/src/catalog/generated/componentRulesTable";
import { resolveComponentRule } from "../../../packages/shared/src/catalog/resolvers/resolveComponentRule";

const root = resolve(import.meta.dirname, "../../..");
const baselineDir = resolve(root, "docs/adr/design/248-baseline");
const read = (name: string) =>
  JSON.parse(readFileSync(resolve(baselineDir, name), "utf8"));
const source = read("visual-value-source.json");
const uses = read("visual-field-uses.json");
const bridges = read("visual-bridge-audit.json");
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (
  head !== source.baselineHead ||
  head !== uses.baselineHead ||
  head !== bridges.baselineHead
)
  throw new Error("Old visual runtime output uses another HEAD");
const hash = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
const directRows = new Map(
  uses.rows.map((item: { interface: string; field: string }) => [
    `${item.interface}.${item.field}`,
    item,
  ]),
);
const indirectRows = new Map(
  bridges.indirectRoutes.flatMap((route: { fields: string[] }) =>
    route.fields.map((key) => [key, route]),
  ),
);
const chartKeys = new Set(
  bridges.chartFields.map((field: string) => `ComponentRuleChart.${field}`),
);
const uniquePaths = (sites: { path: string }[]) =>
  [...new Set(sites.map((site) => site.path))].sort();
const captureFor = (type: string) => {
  const candidates = [
    `palette-production-base/canvas/${type}.png`,
    `unlisted-simple-production/canvas/${type}.png`,
    `unlisted-composite-production/canvas/${type}.png`,
    `system-root-ref-production/canvas/${type}.png`,
  ];
  return (
    candidates.find((path) => existsSync(resolve(baselineDir, path))) ?? null
  );
};
const generatedCssFor = (type: string) => {
  const path = `packages/shared/src/components/styles/generated/${type}.css`;
  return existsSync(resolve(root, path)) ? path : null;
};
const rows = source.rows.map(
  (field: {
    key: string;
    authoredCount: number;
    samples: { type: string; path: string; valueSha256: string }[];
  }) => {
    const direct = directRows.get(field.key) as
      { sites: { path: string; test: boolean }[] } | undefined;
    const productSites = direct?.sites.filter((site) => !site.test) ?? [];
    const bridge = indirectRows.get(field.key) as
      { edges: [string, string][] } | undefined;
    const chart = chartKeys.has(field.key);
    const routeKind = productSites.length
      ? "DIRECT_STATIC_ACCESS"
      : chart
        ? "STRUCTURAL_CHART_BRIDGE"
        : "CURATED_INDIRECT_BRIDGE";
    const consumerPaths = productSites.length
      ? uniquePaths(productSites)
      : chart
        ? uniquePaths(bridges.edges)
        : [...new Set(bridge?.edges.map(([path]) => path) ?? [])].sort();
    if (!consumerPaths.length)
      throw new Error(`${field.key}: old consumer route missing`);
    if (field.authoredCount === 0) {
      if (field.samples.length)
        throw new Error(`${field.key}: unowned sample despite absent value`);
      return {
        key: field.key,
        scenarioId: `adr248-old-visual-field/${field.key}`,
        semanticInput: { op: "readRuleField", status: "NO_AUTHORED_VALUE" },
        oldOutput: { status: "NO_CURRENT_TABLE_VALUE" },
        consumerRouteKind: routeKind,
        consumerPaths,
        behaviorStatus: "UNVERIFIED",
      };
    }
    const sample =
      field.samples.find((item) => captureFor(item.type)) ?? field.samples[0];
    if (!sample) throw new Error(`${field.key}: authored field has no sample`);
    const [type, ...segments] = sample.path.split(".");
    if (type !== sample.type)
      throw new Error(`${field.key}: sample owner/type mismatch`);
    const readPath = (rule: unknown): unknown =>
      segments.reduce<unknown>(
        (value, key) =>
          value && typeof value === "object"
            ? (value as Record<string, unknown>)[key]
            : undefined,
        rule,
      );
    const tableValue = readPath(COMPONENT_RULES_TABLE[type]);
    const resolvedValue = readPath(resolveComponentRule(type));
    const tableHash = hash(JSON.stringify(tableValue) ?? "undefined");
    const resolvedHash = hash(JSON.stringify(resolvedValue) ?? "undefined");
    if (
      tableValue === undefined ||
      tableHash !== sample.valueSha256 ||
      resolvedHash !== tableHash
    )
      throw new Error(`${field.key}: old table → resolver value differs`);
    const capture = captureFor(type);
    const canvas = capture
      ? {
          path: capture,
          surface: "Canvas production",
          case: "aggregate old type capture",
          sha256: hash(readFileSync(resolve(baselineDir, capture))),
        }
      : null;
    const cssPath = generatedCssFor(type);
    const css = cssPath
      ? { path: cssPath, sha256: hash(readFileSync(resolve(root, cssPath))) }
      : null;
    return {
      key: field.key,
      scenarioId: `adr248-old-visual-field/${field.key}`,
      semanticInput: {
        op: "readRuleField",
        component: type,
        fieldPath: segments,
        sourceValueSha256: tableHash,
      },
      oldOutput: {
        status: "OLD_RESOLVER_VALUE_FROZEN",
        valueSha256: resolvedHash,
        aggregateCanvas: canvas,
        generatedCss: css,
      },
      consumerRouteKind: routeKind,
      consumerPaths,
      behaviorStatus: "UNVERIFIED",
    };
  },
);
if (rows.length !== 102 || new Set(rows.map((row) => row.key)).size !== 102)
  throw new Error("Visual field runtime output is incomplete");
const report = {
  head,
  buildIndexSha256: hash(
    readFileSync(resolve(root, "apps/builder/dist/index.html")),
  ),
  status:
    "OLD_TABLE_TO_RESOLVER_VALUES_FROZEN; aggregate Canvas captures are not field-causal or G3 parity evidence",
  summary: {
    fields: rows.length,
    authoredRuntimeValues: rows.filter(
      (row) => row.oldOutput.status === "OLD_RESOLVER_VALUE_FROZEN",
    ).length,
    noCurrentTableValue: rows.filter(
      (row) => row.oldOutput.status === "NO_CURRENT_TABLE_VALUE",
    ).length,
    withAggregateOldCanvas: rows.filter(
      (row) =>
        "aggregateCanvas" in row.oldOutput && row.oldOutput.aggregateCanvas,
    ).length,
    withGeneratedCss: rows.filter(
      (row) => "generatedCss" in row.oldOutput && row.oldOutput.generatedCss,
    ).length,
    fieldCausalPixelVerified: 0,
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

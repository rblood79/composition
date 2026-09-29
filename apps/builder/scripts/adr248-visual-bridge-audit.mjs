#!/usr/bin/env node
// ADR-248 G0: trace visual fields hidden by structural casts and dynamic keys.
// Shape and routing evidence only; DOM/Canvas behavior remains a G3 obligation.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const ts = require("../node_modules/typescript");
const root = resolve(import.meta.dirname, "../../..");
const baselineDir = resolve(root, "docs/adr/design/248-baseline");
const visualUses = JSON.parse(
  readFileSync(resolve(baselineDir, "visual-field-uses.json"), "utf8"),
);
const sourceFile = (path) => {
  const absolute = resolve(root, path);
  return ts.createSourceFile(
    absolute,
    readFileSync(absolute, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
};
const sharedTypes = sourceFile(
  "packages/shared/src/types/composition-document.types.ts",
);
const chartScene = sourceFile("packages/specs/src/chart/computeChartScene.ts");
const specTypes = sourceFile("packages/specs/src/types/spec.types.ts");
const interfaceNamed = (file, name) => {
  const declaration = file.statements.find(
    (statement) =>
      ts.isInterfaceDeclaration(statement) && statement.name.text === name,
  );
  if (!declaration) throw new Error(`${file.fileName}: ${name} missing`);
  return declaration;
};
const fieldNames = (members, file) =>
  members.map((member) =>
    member.name?.getText(file).replace(/^["']|["']$/g, ""),
  );
const chartFields = fieldNames(
  interfaceNamed(sharedTypes, "ComponentRuleChart").members,
  sharedTypes,
).sort();
const fillStateFields = fieldNames(
  interfaceNamed(sharedTypes, "ComponentRuleFillState").members,
  sharedTypes,
).sort();
const specFillStateFields = fieldNames(
  interfaceNamed(specTypes, "FillStateTokens").members,
  specTypes,
).sort();
if (JSON.stringify(fillStateFields) !== JSON.stringify(specFillStateFields))
  throw new Error("FillStateTokens differs from ComponentRuleFillState");
const channelFields = fieldNames(
  interfaceNamed(chartScene, "ChartRuleChannel").members,
  chartScene,
).sort();
const specChart = interfaceNamed(specTypes, "ComponentSpec").members.find(
  (member) => member.name?.getText(specTypes) === "chart",
);
if (!specChart || !ts.isTypeLiteralNode(specChart.type))
  throw new Error("ComponentSpec.chart type literal missing");
const virtualSpecFields = fieldNames(specChart.type.members, specTypes).sort();
if (JSON.stringify(chartFields) !== JSON.stringify(channelFields))
  throw new Error("ChartRuleChannel differs from ComponentRuleChart");
const missingFromVirtualSpec = chartFields.filter(
  (field) => !virtualSpecFields.includes(field),
);
if (JSON.stringify(missingFromVirtualSpec) !== JSON.stringify(["budget"]))
  throw new Error(
    `Unexpected ComponentSpec.chart mirror gap: ${missingFromVirtualSpec.join(",")}`,
  );

const read = (path) => readFileSync(resolve(root, path), "utf8");
const generateCssPath = "packages/specs/scripts/generate-css.ts";
const cssGeneratorPath = "packages/specs/src/renderers/CSSGenerator.ts";
const builderChartPath =
  "apps/builder/src/builder/workspace/canvas/skia/buildSpecNodeData.ts";
const skiaChartPath = "packages/specs/src/renderers/skiaPrimitives.ts";
const domChartPath = "packages/shared/src/components/Chart.tsx";
const generateCss = read(generateCssPath);
const cssGenerator = read(cssGeneratorPath);
const cssGeneratorFile = sourceFile(cssGeneratorPath);
const builderChart = read(builderChartPath);
const skiaChart = read(skiaChartPath);
const domChart = read(domChartPath);
const chartMetrics = read("packages/specs/src/chart/computeChartScene.ts");
const paintResolverPath =
  "packages/shared/src/catalog/resolvers/resolveCatalogPaint.ts";
const paintResolver = read(paintResolverPath);
const catalogTable = sourceFile(
  "packages/shared/src/catalog/generated/componentRulesTable.ts",
);
const selectedComboCounts = { selectedHover: 0, selectedPressed: 0 };
function visitCatalog(node) {
  if (ts.isPropertyAssignment(node)) {
    const name = node.name.getText(catalogTable);
    if (name in selectedComboCounts) selectedComboCounts[name] += 1;
  }
  ts.forEachChild(node, visitCatalog);
}
visitCatalog(catalogTable);
const requiredEdges = [
  [
    generateCssPath,
    generateCss,
    "...(rule.chart ? { chart: rule.chart } : {})",
  ],
  [builderChartPath, builderChart, "_chartRule: chartChannel"],
  [skiaChartPath, skiaChart, "props._chartRule as ChartRuleChannel"],
  [skiaChartPath, skiaChart, "resolveChartMetrics("],
  [domChartPath, domChart, "resolveChartMetrics(rule?.chart"],
  [
    "packages/specs/src/chart/computeChartScene.ts",
    chartMetrics,
    "channel?.budget",
  ],
  [
    "packages/specs/src/chart/computeChartScene.ts",
    chartMetrics,
    "channel?.metrics",
  ],
];
for (const [path, body, symbol] of requiredEdges) {
  if (!body.includes(symbol))
    throw new Error(`${path}: Chart bridge edge missing: ${symbol}`);
}
for (const symbol of [
  'fill: v.fill as unknown as ComponentVisualRule["fill"]',
  "fill.default.selectedHover",
  "fill.default.selectedPressed",
]) {
  const body = symbol.startsWith("fill: ") ? generateCss : cssGenerator;
  if (!body.includes(symbol))
    throw new Error(`Fill state bridge edge missing: ${symbol}`);
}
if (
  !paintResolver.includes("fillStates?.hover") ||
  !paintResolver.includes("fillStates?.pressed") ||
  paintResolver.includes("selectedHover") ||
  paintResolver.includes("selectedPressed")
)
  throw new Error(
    "Canvas catalog paint selection changed; review state bridge",
  );
const cssAccessFields = new Set();
function visitCss(node) {
  if (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "chart" &&
    chartFields.includes(node.name.text)
  )
    cssAccessFields.add(node.name.text);
  ts.forEachChild(node, visitCss);
}
visitCss(cssGeneratorFile);
const cssFields = [...cssAccessFields].sort();
const nonCssFields = chartFields.filter((field) => !cssFields.includes(field));
if (JSON.stringify(nonCssFields) !== JSON.stringify(["budget", "metrics"]))
  throw new Error(`Unexpected Chart fields absent from CSS: ${nonCssFields}`);
const directUnseen = visualUses.summary.fieldsWithoutProductionStaticAccess;
if (
  !chartFields.every((field) =>
    directUnseen.includes(`ComponentRuleChart.${field}`),
  )
)
  throw new Error("Visual field report and Chart bridge audit disagree");
const indirectRoutes = [
  {
    fields: ["ComponentRuleComposition.[index]"],
    route:
      "open schema; ten authored keys classified by inventory.compositionKeyPlan",
    status: "G1_TYPED_SCHEMA_REQUIRED",
    edges: [[generateCssPath, "meta.composition as ComponentSpec"]],
  },
  {
    fields: ["ComponentRuleDensity.gap", "ComponentRuleDensity.paddingY"],
    route: "density map to DOM container variant and Canvas dynamic resolver",
    status: "SHAPE_TRACED_G3_UNVERIFIED",
    edges: [
      [
        generateCssPath,
        "for (const [densityName, spacing] of Object.entries(densities))",
      ],
      [
        "packages/shared/src/catalog/resolvers/resolveCatalogContainer.ts",
        "return densities[key]?.[field]",
      ],
    ],
  },
  {
    fields: ["ComponentRuleFillState.hover", "ComponentRuleFillState.pressed"],
    route: "fill cast to CSS visual and Canvas selected fill-state resolver",
    status: "SHAPE_TRACED_G3_UNVERIFIED",
    edges: [
      [
        generateCssPath,
        'fill: v.fill as unknown as ComponentVisualRule["fill"]',
      ],
      [paintResolverPath, "fillStates?.hover"],
      [paintResolverPath, "fillStates?.pressed"],
    ],
  },
  {
    fields: [
      "ComponentRuleFillState.selectedHover",
      "ComponentRuleFillState.selectedPressed",
    ],
    route:
      "CSS supports selected combinations; Canvas selected path ignores them; base table has no value",
    status: "G1_AUTHORING_AND_G3_PARITY_REQUIRED",
    edges: [
      [cssGeneratorPath, "fill.default.selectedHover"],
      [cssGeneratorPath, "fill.default.selectedPressed"],
      [paintResolverPath, "const stateBackground = isSelected"],
    ],
  },
  {
    fields: [
      "ComponentRuleSize.descFontSize",
      "ComponentRuleSize.descFontWeight",
      "ComponentRuleSize.headingFontSize",
      "ComponentRuleSize.headingFontWeight",
    ],
    route:
      "size conversion to DOM child CSS; Canvas inline alert font and layout read-through",
    status: "SHAPE_TRACED_G3_UNVERIFIED",
    edges: [
      [generateCssPath, "s.headingFontSize !== undefined"],
      [generateCssPath, "s.headingFontWeight !== undefined"],
      [generateCssPath, "s.descFontSize !== undefined"],
      [generateCssPath, "s.descFontWeight !== undefined"],
      [cssGeneratorPath, "ds.headingFontSize"],
      [cssGeneratorPath, "ds.descFontSize"],
      [builderChartPath, "sizeSpec.headingFontSize"],
      [builderChartPath, "sizeSpec.descFontSize"],
    ],
  },
  {
    fields: ["ComponentRuleSize.iconGap", "ComponentRuleSize.maxWidth"],
    route:
      "size conversion to DOM CSS; Canvas has layout/read-through for maxWidth, iconGap parity unverified",
    status: "SHAPE_TRACED_G3_UNVERIFIED",
    edges: [
      [generateCssPath, "s.iconGap !== undefined"],
      [generateCssPath, "s.maxWidth !== undefined"],
      [cssGeneratorPath, "size.iconGap !== undefined"],
      [cssGeneratorPath, "size.maxWidth !== undefined"],
      [
        "apps/builder/src/builder/workspace/canvas/layout/engines/implicitStyles.ts",
        'specSizeField(containerTag, sizeName, "maxWidth")',
      ],
    ],
  },
  {
    fields: ["ComponentRuleSize.indentPerLevel"],
    route:
      "Canvas SizeSpec cast to tree indent; DOM Tree.css uses separate --padding constant",
    status: "G1_DEFINITION_AND_G3_PARITY_REQUIRED",
    edges: [
      [
        "apps/builder/src/builder/workspace/canvas/skia/resolveSkiaVisualRule.ts",
        "s as unknown as Partial<SizeSpec>",
      ],
      [
        "packages/specs/src/renderers/buildCatalogShapes.ts",
        "size.indentPerLevel",
      ],
      [
        "packages/shared/src/components/styles/Tree.css",
        "var(--tree-item-level)",
      ],
    ],
  },
  {
    fields: ["ComponentRuleSize.indicator"],
    route: "nested indicator to DOM Slider metrics and Canvas primitive/layout",
    status: "SHAPE_TRACED_G3_UNVERIFIED",
    edges: [
      [generateCssPath, "s.indicator !== undefined"],
      [cssGeneratorPath, "indicator?.thumbSize"],
      [
        "packages/specs/src/renderers/skiaPrimitives.ts",
        "size.indicator?.thumbSize",
      ],
    ],
  },
  {
    fields: ["ComponentRuleSize.thumbSize"],
    route:
      "Canvas SliderTrack flat thumb mirror; DOM Slider uses parent nested indicator",
    status: "G1_SINGLE_DEFINITION_AND_G3_PARITY_REQUIRED",
    edges: [
      [
        "packages/specs/src/renderers/skiaPrimitives.ts",
        'typeof size.thumbSize === "number"',
      ],
      [cssGeneratorPath, "indicator?.thumbSize"],
      [
        "packages/shared/src/catalog/generated/componentRulesTable.ts",
        "thumbSize: 14",
      ],
    ],
  },
  {
    fields: ["ComponentRuleStates.[index]"],
    route:
      "open state/style map; authored keys classified by inventory.stateStyleValueKinds",
    status: "G1_TYPED_SCHEMA_REQUIRED",
    edges: [[generateCssPath, "states: (meta.states ?? {"]],
  },
  {
    fields: [
      "ComponentRuleStates.focusVisible",
      "ComponentRuleStates.hover",
      "ComponentRuleStates.pressed",
    ],
    route:
      "structure.states to generated CSS; Canvas has no matching state-style consumer in this path",
    status: "G3_STATE_PARITY_REQUIRED",
    edges: [
      [generateCssPath, "states: (meta.states ?? {"],
      [cssGeneratorPath, "if (states?.hover)"],
      [cssGeneratorPath, "if (states?.pressed)"],
      [cssGeneratorPath, "states?.focusVisible?.focusRing"],
      [builderChartPath, 'componentState === "disabled"'],
    ],
  },
];
const routedFields = indirectRoutes.flatMap((route) => route.fields).sort();
const expectedIndirect = directUnseen
  .filter((field) => !field.startsWith("ComponentRuleChart."))
  .sort();
if (JSON.stringify(routedFields) !== JSON.stringify(expectedIndirect))
  throw new Error(
    "Indirect route map does not cover exactly the remaining fields",
  );
for (const route of indirectRoutes) {
  for (const [path, symbol] of route.edges) {
    if (!read(path).includes(symbol))
      throw new Error(
        `${path}: missing ${symbol} for ${route.fields.join(",")}`,
      );
  }
}
const report = {
  baselineHead: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
  status: "BRIDGE_SHAPE_CONFIRMED; behavior and parity UNVERIFIED",
  source: "ComponentRuleChart",
  chartFields,
  chartRuleChannelFields: channelFields,
  componentSpecChartFields: virtualSpecFields,
  missingFromVirtualSpec,
  cssFields,
  nonCssFields,
  edges: requiredEdges.map(([path, , symbol]) => ({ path, symbol })),
  fillStateBridge: {
    source: "ComponentRuleFillState",
    sourceFields: fillStateFields,
    specMirror: "FillStateTokens",
    specMirrorFields: specFillStateFields,
    domSelectedComboAccess: true,
    canvasSelectedComboAccess: false,
    currentCatalogSelectedComboEntries: selectedComboCounts,
    status:
      "SHAPE_CONFIRMED; selectedHover/selectedPressed Canvas handling and future authored values UNVERIFIED",
  },
  visualFieldsStillWithoutStaticAccess: expectedIndirect,
  indirectRoutes,
};
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
writeFileSync(
  resolve(process.argv[outIndex + 1]),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(
  `${JSON.stringify({ chartFields: chartFields.length, channelFields: channelFields.length, cssFields: cssFields.length, nonCssFields, fillStateFields: fillStateFields.length, currentCatalogSelectedComboEntries: selectedComboCounts, remainingIndirectFields: report.visualFieldsStillWithoutStaticAccess.length })}\n`,
);

#!/usr/bin/env node
// ADR-248 G0: classify old Builder creation branches without treating catalog
// registration, factory aliases, and visual rules as interchangeable types.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const require = createRequire(import.meta.url);
const ts = require("../node_modules/typescript");
const root = resolve(import.meta.dirname, "../../..");
const baselineDir = resolve(root, "docs/adr/design/248-baseline");
const inventory = JSON.parse(
  readFileSync(resolve(baselineDir, "inventory.json"), "utf8"),
);
const read = (path) => readFileSync(resolve(root, path), "utf8");
const sourceFile = (path) =>
  ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true);
const findInitializer = (file, name) => {
  for (const statement of file.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (declaration.name.getText(file) === name)
        return declaration.initializer;
    }
  }
  throw new Error(`${file.fileName}: ${name} initializer missing`);
};
const constantsPath = "apps/builder/src/builder/factories/constants.ts";
const definitionsPath =
  "apps/builder/src/builder/factories/componentDefinitions.ts";
const creatorPath = "apps/builder/src/builder/hooks/useElementCreator.ts";
const palettePath =
  "apps/builder/src/builder/panels/components/paletteItems.ts";
const constants = sourceFile(constantsPath);
const definitions = sourceFile(definitionsPath);
const complexInitializer = findInitializer(constants, "COMPLEX_COMPONENT_TAGS");
if (
  !ts.isNewExpression(complexInitializer) ||
  !complexInitializer.arguments?.[0] ||
  !ts.isArrayLiteralExpression(complexInitializer.arguments[0])
)
  throw new Error("COMPLEX_COMPONENT_TAGS is no longer a literal Set");
const complexTypes = complexInitializer.arguments[0].elements.map((element) => {
  if (!ts.isStringLiteral(element))
    throw new Error("Complex component type is not a string literal");
  return element.text;
});
const complexSet = new Set(complexTypes);
const definitionInitializer = findInitializer(
  definitions,
  "COMPONENT_DEFINITIONS",
);
if (!ts.isObjectLiteralExpression(definitionInitializer))
  throw new Error("COMPONENT_DEFINITIONS is no longer a literal object");
const factoryTypes = definitionInitializer.properties.map((property) => {
  if (!ts.isPropertyAssignment(property))
    throw new Error("Factory definition has a nonliteral entry");
  return property.name.getText(definitions).replace(/^["']|["']$/g, "");
});
factoryTypes.push("Table"); // ComponentFactory.creators overrides Table imperatively.
const factorySet = new Set(factoryTypes);
const palette = sourceFile(palettePath);
const paletteInitializer = findInitializer(palette, "PALETTE_ORDER");
if (!ts.isArrayLiteralExpression(paletteInitializer))
  throw new Error("PALETTE_ORDER is no longer a literal array");
const paletteTypes = paletteInitializer.elements.map((entry) => {
  if (!ts.isObjectLiteralExpression(entry))
    throw new Error("PALETTE_ORDER has a nonliteral entry");
  const type = entry.properties.find(
    (property) => property.name?.getText(palette) === "type",
  );
  if (
    !type ||
    !ts.isPropertyAssignment(type) ||
    !ts.isStringLiteral(type.initializer)
  )
    throw new Error("PALETTE_ORDER entry has no literal type");
  return type.initializer.text;
});
const paletteSet = new Set(paletteTypes);
if (paletteSet.size !== paletteTypes.length)
  throw new Error("PALETTE_ORDER contains duplicate types");
const creator = read(creatorPath);
for (const symbol of [
  "getReusableCompositeOriginId(type)",
  "COMPLEX_COMPONENT_TAGS.has(type)",
  "ComponentFactory.createComplexComponent(",
  "addElement(newElement)",
]) {
  if (!creator.includes(symbol))
    throw new Error(`${creatorPath}: creation branch changed: ${symbol}`);
}
const registrationByType = new Map(
  inventory.registrationCoverage.map((registration) => [
    registration.type,
    registration,
  ]),
);
const visualTypes = new Set(inventory.visualRules.map((rule) => rule.type));
const typeUniverse = [
  ...new Set([...registrationByType.keys(), ...visualTypes]),
].sort();
const ruleOnlyRoutes = {
  Group: {
    mode: "simple",
    oldRoute: "simple old node with residual Group spec",
    parentFixture: "frame > Group",
    newContract: "native/RAC Group definition and binding",
    evidence: ["packages/specs/src/components/Group.spec.ts"],
  },
  Image: {
    mode: "simple",
    oldRoute:
      "simple old node; factory creator also declared but not selected by branch",
    parentFixture: "frame > Image",
    newContract: "image primitive definition and binding",
    evidence: [
      "apps/builder/src/builder/factories/definitions/DisplayComponents.ts",
      "apps/builder/src/builder/panels/components/paletteItems.ts",
    ],
  },
  MenuItem: {
    mode: "parentOwned",
    oldRoute: "Menu-owned static child node",
    parentFixture: "Menu > MenuItem",
    newContract: "Menu child/slot definition and binding",
    evidence: ["packages/shared/src/renderers/CollectionRenderers.tsx"],
  },
  TabPanels: {
    mode: "parentOwned",
    oldRoute: "Tabs-owned panels container",
    parentFixture: "Tabs > TabPanels",
    newContract: "Tabs panels child/slot definition and binding",
    evidence: [
      "apps/builder/src/builder/factories/definitions/LayoutComponents.ts",
    ],
  },
  TabPanel: {
    mode: "parentOwned",
    oldRoute: "TabPanels-owned panel node",
    parentFixture: "Tabs > TabPanels > TabPanel",
    newContract: "Tabs panel child/slot definition and binding",
    evidence: [
      "apps/builder/src/builder/factories/definitions/LayoutComponents.ts",
    ],
  },
};
if (
  JSON.stringify(Object.keys(ruleOnlyRoutes).sort()) !==
  JSON.stringify([...inventory.ruleOnlyTypes].sort())
)
  throw new Error("Rule-only creation route list differs from inventory");
for (const route of Object.values(ruleOnlyRoutes)) {
  for (const path of route.evidence) read(path);
}
const ruleOnlyRequiredEdges = [
  ["packages/specs/src/components/Group.spec.ts", 'name: "Group"'],
  [
    "apps/builder/src/builder/factories/definitions/DisplayComponents.ts",
    "createImageDefinition(",
  ],
  [
    "apps/builder/src/builder/panels/components/paletteItems.ts",
    'type: "Image"',
  ],
  [
    "packages/shared/src/renderers/CollectionRenderers.tsx",
    'child.type === "MenuItem"',
  ],
  [
    "apps/builder/src/builder/factories/definitions/LayoutComponents.ts",
    'type: "TabPanels"',
  ],
  [
    "apps/builder/src/builder/factories/definitions/LayoutComponents.ts",
    'type: "TabPanel"',
  ],
];
for (const [path, symbol] of ruleOnlyRequiredEdges) {
  if (!read(path).includes(symbol))
    throw new Error(`${path}: rule-only route changed: ${symbol}`);
}
const routes = typeUniverse.map((type) => {
  const registration = registrationByType.get(type);
  const kinds = registration?.entries.map((entry) => entry.kind) ?? [];
  const ruleOnly = ruleOnlyRoutes[type];
  const oldMode =
    ruleOnly?.mode ??
    (kinds.includes("reusable")
      ? "reusableOrigin"
      : kinds.includes("native")
        ? "native"
        : complexSet.has(type)
          ? "factoryComplex"
          : "simple");
  if (oldMode === "factoryComplex" && !factorySet.has(type))
    throw new Error(`${type}: complex creator has no factory definition`);
  return {
    type,
    catalogKinds: kinds,
    visualRule: visualTypes.has(type),
    oldMode,
    paletteEntry: paletteSet.has(type),
    creatorBranchScope: paletteSet.has(type)
      ? "PALETTE_ENTRY; actual UI insertion unverified"
      : ruleOnly?.mode === "parentOwned"
        ? "PARENT_OWNED; parent fixture required"
        : "NO_PALETTE_ENTRY; branch is conditional, not observed insertion",
    ...(ruleOnly ? { ruleOnlyRoute: ruleOnly } : {}),
    oldBuilderBranch: creatorPath,
    fullMatrixScenarioDriverStatus: "PLANNED_UNEXECUTED",
    newGraphRouteStatus: "G1_UNVERIFIED",
  };
});
const factoryOnly = factoryTypes
  .filter((type) => !registrationByType.has(type) && !visualTypes.has(type))
  .sort();
if (JSON.stringify(factoryOnly) !== JSON.stringify(["DataTable", "Navigation"]))
  throw new Error(`Unexpected factory-only types: ${factoryOnly.join(",")}`);
const paletteOnly = paletteTypes.filter((type) => !typeUniverse.includes(type));
if (
  paletteOnly.some(
    (type) => !type || !read(palettePath).includes(`type: "${type}"`),
  )
)
  throw new Error("Palette-only creation route changed");
const factoryOnlyDispositions = [
  {
    type: "Navigation",
    disposition: "CREATOR_ALIAS_TO_NAV; no Navigation node definition",
    evidence: [
      definitionsPath,
      "apps/builder/src/builder/factories/definitions/NavigationComponents.ts",
    ],
    g1Action:
      "retire alias or explicit compatibility entry; Nav remains the node type",
  },
  {
    type: "DataTable",
    disposition: "NONVISUAL_LEGACY_FACTORY; data SSOT belongs to H1 stores",
    evidence: [
      definitionsPath,
      "apps/builder/src/builder/factories/definitions/DataComponents.ts",
    ],
    g1Action:
      "classify old creator removal separately from collections store retention",
  },
];
for (const item of factoryOnlyDispositions) item.evidence.forEach(read);
for (const [path, symbol] of [
  [definitionsPath, "Navigation: createNavDefinition"],
  [
    "apps/builder/src/builder/factories/definitions/NavigationComponents.ts",
    'type: "Nav"',
  ],
  [definitionsPath, "DataTable: createDataTableDefinition"],
  [
    "apps/builder/src/builder/factories/definitions/DataComponents.ts",
    'type: "DataTable"',
  ],
]) {
  if (!read(path).includes(symbol))
    throw new Error(`${path}: factory-only disposition changed: ${symbol}`);
}
const counts = Object.fromEntries(
  ["reusableOrigin", "factoryComplex", "native", "simple", "parentOwned"].map(
    (mode) => [mode, routes.filter((route) => route.oldMode === mode).length],
  ),
);
if (
  routes.length !== 130 ||
  Object.values(counts).reduce((a, b) => a + b, 0) !== routes.length
)
  throw new Error(
    "Creation routes do not cover the visual/registration universe",
  );
const report = {
  baselineHead: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
  status:
    "OLD_CREATION_BRANCHES_CLASSIFIED; scenario drivers and new graph UNVERIFIED",
  summary: {
    visualAndRegistrationTypes: routes.length,
    modes: counts,
    paletteEntries: paletteTypes.length,
    paletteEntriesInVisualUniverse: routes.filter((route) => route.paletteEntry)
      .length,
    paletteEntriesOutsideVisualUniverse: paletteOnly.length,
    conditionalNonPaletteRoutes: routes.filter((route) => !route.paletteEntry)
      .length,
    factoryOnly: factoryOnly.length,
    fullMatrixDriversPlannedUnexecuted: routes.length,
  },
  paletteTypes,
  paletteOnly,
  complexTypes: complexTypes.sort(),
  factoryTypes: [...factorySet].sort(),
  routes,
  factoryOnlyDispositions,
};
if (report.baselineHead !== inventory.baselineHead)
  throw new Error("Creation route audit uses another baseline HEAD");
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
writeFileSync(
  resolve(process.argv[outIndex + 1]),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(report.summary)}\n`);

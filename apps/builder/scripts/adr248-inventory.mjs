#!/usr/bin/env node
/** ADR-248 G0: executable field inventory; inspect before editing either model. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const require = createRequire(import.meta.url);
const ts = require("../node_modules/typescript");
const root = resolve(import.meta.dirname, "../../..");
const sourcePath = resolve(
  root,
  "packages/shared/src/types/composition-document.types.ts",
);
const source = ts.createSourceFile(
  sourcePath,
  readFileSync(sourcePath, "utf8"),
  ts.ScriptTarget.Latest,
  true,
);
const parse = (path) =>
  ts.createSourceFile(
    path,
    readFileSync(path, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
const propertyName = (node, file) =>
  node?.name?.getText(file)?.replace(/^["']|["']$/g, "");
const objectProperty = (object, name, file) =>
  object && ts.isObjectLiteralExpression(object)
    ? object.properties.find(
        (property) => propertyName(property, file) === name,
      )
    : undefined;
const objectKeys = (object, file) =>
  object && ts.isObjectLiteralExpression(object)
    ? object.properties
        .map((property) => propertyName(property, file))
        .filter(Boolean)
    : [];
const strictObjectKeys = (object, file, label) => {
  if (!object) return [];
  if (!ts.isObjectLiteralExpression(object))
    throw new Error(`${label} is not a literal object`);
  return object.properties.map((property) => {
    if (!ts.isPropertyAssignment(property))
      throw new Error(`${label} has computed/spread member`);
    const name = propertyName(property, file);
    if (!name) throw new Error(`${label} has unnamed member`);
    return name;
  });
};

const mapping = {
  CanonicalNode: {
    id: "node.id",
    type: "node.definitionId",
    name: "node.name",
    props: "node.props",
    fills: "node.visual.fills",
    responsive: "node.visual.responsive",
    enabled: "node.enabled",
    sizing: "node.sizing",
    state: "node.stateDefinitions (page/node scope only)",
    metadata: "node.metadata (typed allowlist)",
    reusable: "definition entry discriminator",
    children: "owner.orderedChildIds",
    slot: "node.slotDeclaration",
    theme: "node.themeOverride",
  },
  FrameNode: {
    type: "node.definitionId = lib:frame",
    clip: "node.visual.overflow (legacy boolean input normalized; no stored clip mirror)",
    placeholder: "node.placeholder",
  },
  RefNode: {
    type: "node.definitionId = referenced definition",
    ref: "node.definitionId",
    descendants: "node.descendantOverrides (typed address)",
  },
  CompositionDocument: {
    version: "envelope.schemaVersion",
    themes: "project/theme entries",
    tokens: "project/token entries",
    componentRules: "project.definitionOverrides",
    imports: "project.externalImports",
    pagePositions: "legacy migration/debug input; drop from new format",
    pageLayout: "project.pageLayout",
    pageGuides: "page.guideEntries",
    _meta: "envelope format marker",
    children: "project/page/definition ordered roots",
    events: "interaction entries",
    actions: "dormant action root + IDB mirror writer; drop from new format",
  },
  ThemeDefinition: {
    id: "theme entry.id",
    name: "theme entry.name",
    preset: "theme entry.preset",
    tokens: "theme entry.tokenIds/deltas",
  },
  ThemesCollection: {
    active: "project.activeThemeId",
    items: "theme entries",
    order: "project.orderedThemeIds",
  },
  PagePlacement: {
    style: "page.placement.base",
    responsive: "page.placement.breakpoints",
  },
  PageLayoutSettingsDocument: {
    direction: "project.pageLayout.direction",
    gap: "project.pageLayout.gap",
    columns: "project.pageLayout.columns",
    responsive: "project.pageLayout.breakpoints",
    placementModel:
      "legacy migration/debug discriminator; derived-only new graph",
    placements: "page.placement entries",
    legacyFallback: "legacy migration/debug fallback; drop from new format",
  },
  PageGuideLine: {
    id: "guide entry.id",
    axis: "guide entry.axis",
    position: "guide entry.position",
  },
};
const exportedInterfaces = source.statements
  .filter(
    (statement) =>
      ts.isInterfaceDeclaration(statement) &&
      statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      ),
  )
  .map((statement) => ({
    name: statement.name.text,
    fields: statement.members.map((member) => ({
      name: member.name?.getText(source) ?? "[index]",
      optional: Boolean(member.questionToken),
      type: member.type?.getText(source) ?? "unknown",
    })),
  }));
const aliasPlan = {
  ThemePreset:
    "theme.preset 4-field typed value; old ThemeSnapshot wrapper retired",
  TokensSnapshot: "theme token delta/project token entry map",
  ComponentRuleLayoutToken: "library visual composition layout enum",
  ComponentRulesTable:
    "immutable library visual definitions plus project deltas",
  NumberOrToken: "retire old $var union; new values use validated token syntax",
  StringOrToken: "retire old $var union; new values use validated token syntax",
  BooleanOrToken: "retire old $var union; new values use explicit booleans",
  ColorOrToken: "retire old $var union; new values use validated token syntax",
  DescendantPatchMode:
    "node path override tagged patch; replace open keys with typed allowlist",
  DescendantReplaceMode:
    "node path override tagged replace; instance-owned node entries",
  DescendantChildrenMode:
    "node path override tagged fillSlot; ordered instance-owned child IDs",
  DescendantOverride: "tagged patch/replace/fillSlot union",
  PagePlacementModel:
    "retire old migration/debug mode; new page placement is derived-only",
  PagePlacementStyleMap:
    "page placement style; close to PAGE_PLACEMENT_STYLE_KEYS",
  MigrationHook:
    "old import/hydration runtime function; retire from new format",
};
const exportedTypeAliases = source.statements
  .filter(
    (statement) =>
      ts.isTypeAliasDeclaration(statement) &&
      statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
      ),
  )
  .map((statement) => ({
    name: statement.name.text,
    line:
      source.getLineAndCharacterOfPosition(statement.getStart(source)).line + 1,
    type: statement.type.getText(source),
    fields: ts.isTypeLiteralNode(statement.type)
      ? statement.type.members.map((member) => ({
          name: member.name?.getText(source) ?? "[index]",
          optional: Boolean(member.questionToken),
          type: member.type?.getText(source) ?? "unknown",
        }))
      : [],
    destination: aliasPlan[statement.name.text] ?? "UNCLASSIFIED",
  }));
const unplannedAliases = exportedTypeAliases.filter(
  (item) => item.destination === "UNCLASSIFIED",
);
const staleAliasPlans = Object.keys(aliasPlan).filter(
  (name) => !exportedTypeAliases.some((item) => item.name === name),
);
if (unplannedAliases.length || staleAliasPlans.length)
  throw new Error(
    `Type alias drift: unplanned=${unplannedAliases.map((item) => item.name).join(",")} stale=${staleAliasPlans.join(",")}`,
  );
const responsivePath = resolve(
  root,
  "packages/shared/src/types/responsive.types.ts",
);
const responsiveFile = parse(responsivePath);
const pagePlacementDeclaration = responsiveFile.statements
  .filter(ts.isVariableStatement)
  .flatMap((statement) => [...statement.declarationList.declarations])
  .find(
    (declaration) =>
      declaration.name.getText(responsiveFile) === "PAGE_PLACEMENT_STYLE_KEYS",
  );
if (
  !pagePlacementDeclaration ||
  !ts.isArrayLiteralExpression(pagePlacementDeclaration.initializer)
)
  throw new Error("PAGE_PLACEMENT_STYLE_KEYS literal missing");
const pagePlacementStyleKeys =
  pagePlacementDeclaration.initializer.elements.map((element) => {
    if (!ts.isStringLiteral(element))
      throw new Error("PAGE_PLACEMENT_STYLE_KEYS has nonliteral member");
    return element.text;
  });
const expectedPagePlacementStyleKeys = [
  "position",
  "left",
  "top",
  "gridColumnStart",
  "gridColumnEnd",
  "gridRowStart",
  "gridRowEnd",
];
if (
  JSON.stringify(pagePlacementStyleKeys) !==
  JSON.stringify(expectedPagePlacementStyleKeys)
)
  throw new Error(
    `Page placement style keys drift: ${pagePlacementStyleKeys.join(",")}`,
  );
function interfaceSurface(path, name) {
  const file = parse(resolve(root, path));
  const declaration = file.statements.find(
    (statement) =>
      ts.isInterfaceDeclaration(statement) && statement.name.text === name,
  );
  if (!declaration) throw new Error(`${path}: ${name} interface missing`);
  return {
    path,
    name,
    fields: declaration.members.map((member) => ({
      name: member.name?.getText(file) ?? "[index]",
      optional: Boolean(member.questionToken),
      type: member.type?.getText(file) ?? "unknown",
    })),
  };
}
const adjacentPublicSurfaces = [
  ["packages/shared/src/types/element.types.ts", "DataBinding"],
  ["packages/shared/src/types/collection.types.ts", "PropertyDataBinding"],
  ["apps/builder/src/types/builder/data.types.ts", "ElementDataBinding"],
  ["packages/shared/src/state/variable.types.ts", "VariableDef"],
  [
    "packages/shared/src/interactions/interactionRule.types.ts",
    "InteractionRule",
  ],
  [
    "packages/shared/src/interactions/interactionRule.types.ts",
    "NavigateAction",
  ],
  ["packages/shared/src/interactions/interactionRule.types.ts", "ToastAction"],
  [
    "packages/shared/src/interactions/interactionRule.types.ts",
    "CapabilityAction",
  ],
  [
    "packages/shared/src/interactions/interactionRule.types.ts",
    "SetStateAction",
  ],
  ["apps/builder/src/lib/db/types.ts", "CanonicalDocumentRecord"],
  ["apps/builder/src/lib/db/types.ts", "CanonicalDocumentBackupRecord"],
  ["apps/builder/src/lib/db/types.ts", "DocumentPersistOptions"],
  ["apps/builder/src/lib/db/types.ts", "DatabaseAdapter"],
  ["packages/shared/src/types/canonical-resolver.types.ts", "ResolvedNode"],
  ["packages/shared/src/types/canonical-resolver.types.ts", "ResolverCache"],
  [
    "packages/shared/src/types/canonical-resolver.types.ts",
    "ImportResolverContext",
  ],
  [
    "apps/builder/src/adapters/canonical/canonicalMutationRunner.ts",
    "CanonicalMutationRunnerBridge",
  ],
].map(([path, name]) => interfaceSurface(path, name));
const verifiedRetiredInterfaces = {
  CanonicalTokenRef:
    "old $var wrapper has no AST consumer outside its declaration/aliases; actual resolver reads brace strings",
  TokenDefinition:
    "old two-field declaration has no AST consumer outside its declaration; TokensSnapshotEntry is current token value",
  SerializedEvent:
    "old root event declaration has no AST consumer outside its declaration; document.events now owns InteractionRule",
};
const verifiedLegacyRetiredInterfaces = {
  SerializedEventHandler:
    "only casts from legacy element.events into x-composition remain; interaction authoring/execution reads root InteractionRule",
};
const verifiedOldRootRetiredInterfaces = {
  SerializedAction:
    "old root/IDB action schema has store API and persistence fan-out but no production authoring or execution caller; InteractionRule action union is live",
};
const unmappedInterfaces = exportedInterfaces
  .filter(
    (item) =>
      !mapping[item.name] &&
      !verifiedRetiredInterfaces[item.name] &&
      !verifiedLegacyRetiredInterfaces[item.name] &&
      !verifiedOldRootRetiredInterfaces[item.name],
  )
  .map((item) => item.name);
const pendingFamilyPlan = {
  ThemeSnapshot: [
    "theme preset/token entries",
    "theme store",
    "theme resolver",
  ],
  TokensSnapshotEntry: [
    "project token entry",
    "token editor",
    "token resolver",
  ],
  ComponentRuleFillState: [
    "library visual rule",
    "catalog source",
    "CSS/Canvas",
  ],
  ComponentRuleFill: ["library visual rule", "catalog source", "CSS/Canvas"],
  ComponentRuleVariantColors: [
    "library visual rule",
    "catalog source",
    "CSS/Canvas",
  ],
  ComponentRuleVariant: ["library visual rule", "catalog source", "CSS/Canvas"],
  ComponentRuleSize: ["library visual rule", "catalog source", "CSS/Canvas"],
  ComponentRuleContainerVariantStyles: [
    "library visual rule",
    "catalog source",
    "CSS/Canvas",
  ],
  ComponentRuleDensity: ["library visual rule", "catalog source", "CSS/Canvas"],
  ComponentRuleChart: ["library visual rule", "catalog source", "CSS/Canvas"],
  ComponentRule: ["library visual rule", "catalog source", "CSS/Canvas"],
  ComponentRuleStructure: [
    "library visual rule",
    "catalog source",
    "CSS/Canvas",
  ],
  ComponentRuleComposition: [
    "library visual rule; open keys need typed schema",
    "catalog source",
    "CSSGenerator",
  ],
  ComponentRuleStates: [
    "library visual rule; open keys need typed schema",
    "catalog source",
    "CSSGenerator",
  ],
  PagePositionPoint: [
    "ephemeral page-drop point; remove persisted legacy page position/fallback",
    "Canvas page drag/drop and legacy migration/debug writers",
    "pagePlacementEdit converts point to PagePlacement; old fallback reader retires",
  ],
  CompositionExtension: [
    "retire events/actions; typed node binding ID; ephemeral editor",
    "legacy adapters, canonicalDocumentStore, elements.ts binding patch/restore",
    "canonicalElementsView legacy projection, shared binding fallback, dataChange inverse",
  ],
  CompositionExtendedNode: [
    "remove x-composition namespace; node binding becomes typed field",
    "legacy adapters and canonicalDocumentStore.updateNodeExtension",
    "canonical store clone/select and canonicalElementsView projection",
  ],
  SerializedDataBinding: [
    "typed node data reference; remove legacy wrapper",
    "elements.ts applyCanonicalDataBindingPatch and adapters",
    "elements.ts readCanonicalDataBindingSnapshot",
  ],
};
const extensionFieldContracts = {
  events: {
    currentWriter:
      "legacy element.events adapter and generic updateNodeExtension",
    currentReader:
      "canonicalElementsView legacy mirror; execution reads root InteractionRule",
    newDestination: "retire legacy per-node event payload",
  },
  dataBinding: {
    currentWriter:
      "legacy adapter; elements.applyCanonicalDataBindingPatch restore/clear",
    currentReader:
      "elements.readCanonicalDataBindingSnapshot and shared getElementDataBinding fallback",
    newDestination:
      "typed node data-binding ID reference; external collection/API/variable payload stays in H1 stores",
  },
  actions: {
    currentWriter: "generic updateNodeExtension only; no production caller",
    currentReader:
      "canonical store clone only; execution reads InteractionRule.action",
    newDestination: "retire legacy per-node action chain",
  },
  editor: {
    currentWriter: "generic updateNodeExtension only; test callers",
    currentReader: "canonical store clone only",
    newDestination: "ephemeral Builder editor state, not persisted graph",
  },
};
const extensionActualFields = exportedInterfaces
  .find((item) => item.name === "CompositionExtension")
  ?.fields.map((field) => field.name);
if (
  JSON.stringify(extensionActualFields?.sort()) !==
  JSON.stringify(Object.keys(extensionFieldContracts).sort())
)
  throw new Error("CompositionExtension field contract drift");
const extendedNodeFieldContract = {
  '"x-composition"': {
    currentWriter:
      "legacy adapters and canonicalDocumentStore.updateNodeExtension",
    currentReader:
      "canonical store clone/select and canonicalElementsView projection",
    newDestination:
      "remove namespace wrapper; live binding becomes typed node field",
  },
};
const extendedNodeActualFields = exportedInterfaces
  .find((item) => item.name === "CompositionExtendedNode")
  ?.fields.map((field) => field.name);
if (
  JSON.stringify(extendedNodeActualFields) !==
  JSON.stringify(Object.keys(extendedNodeFieldContract))
)
  throw new Error("CompositionExtendedNode field contract drift");
const proposedFieldPrefixes = {
  ThemeSnapshot: "theme.preset",
  TokensSnapshotEntry: "token",
  ComponentRuleFillState: "definition.visual.variants[*].fill[*]",
  ComponentRuleFill: "definition.visual.variants[*].fill",
  ComponentRuleVariantColors: "definition.visual.variants[*].colors",
  ComponentRuleVariant: "definition.visual.variants[*]",
  ComponentRuleSize: "definition.visual.sizes[*]",
  ComponentRuleContainerVariantStyles:
    "definition.visual.containerVariants[*][*]",
  ComponentRuleDensity: "definition.visual.densities[*]",
  ComponentRuleChart: "definition.visual.chart",
  ComponentRule: "definition.visual",
  ComponentRuleStructure: "definition.visual.structure",
  ComponentRuleComposition: "definition.visual.structure.composition",
  ComponentRuleStates: "definition.visual.structure.states",
  PagePositionPoint:
    "runtime page-drop point; persist derived PagePlacement only",
};
const proposedFieldExceptions = {
  ThemeSnapshot: { customTokens: "project token entries" },
  CompositionExtension: {
    events:
      "retire old extension events; interaction entries are authoritative",
    dataBinding: "node.dataBinding typed ID reference",
    actions: "retire old extension action chain",
    editor: "ephemeral Builder state; exclude from persisted graph",
  },
  CompositionExtendedNode: {
    '"x-composition"':
      "split into typed node binding and ephemeral editor state",
  },
  SerializedDataBinding: {
    type: "node.dataBinding.discriminator",
    source: "node.dataBinding.sourceId",
    config: "separate data store payload; node retains typed ID reference",
    "[index]": "reject unknown legacy config keys in new graph",
  },
};
const proposedFieldDestinations = exportedInterfaces
  .filter((item) => unmappedInterfaces.includes(item.name))
  .flatMap((item) =>
    item.fields.map((field) => {
      const target =
        proposedFieldExceptions[item.name]?.[field.name] ??
        (proposedFieldPrefixes[item.name] && field.name !== "[index]"
          ? `${proposedFieldPrefixes[item.name]}.${field.name}`
          : field.name === "[index]" &&
              ["ComponentRuleComposition", "ComponentRuleStates"].includes(
                item.name,
              )
            ? "replace open index with typed key allowlist"
            : null);
      return {
        interface: item.name,
        field: field.name,
        target,
        status: target ? "proposed" : "UNCLASSIFIED",
      };
    }),
  );
const unclassifiedFieldDestinations = proposedFieldDestinations.filter(
  (item) => item.status === "UNCLASSIFIED",
);
if (unclassifiedFieldDestinations.length)
  throw new Error(
    `Unclassified proposed fields: ${unclassifiedFieldDestinations.map((item) => `${item.interface}.${item.field}`).join(",")}`,
  );
const fieldEvidence = {
  ThemeSnapshot: {
    mode: "legacy-read-only; retire old snapshot shape",
    currentWriter:
      "none in current theme authoring; import/hydration may supply old shape",
    currentReader:
      "readLegacyThemeSnapshot; migrateThemesField; readCanonicalThemes fallback",
    evidence: [
      [
        "packages/shared/src/theme/themesCollection.ts",
        "readLegacyThemeSnapshot",
      ],
      ["packages/shared/src/theme/themesCollection.ts", "migrateThemesField"],
      [
        "apps/builder/src/adapters/canonical/themesAdapter.ts",
        "readCanonicalThemes",
      ],
    ],
    fields: {
      tint: "theme entry.preset.tint",
      darkMode: "theme entry.preset.darkMode",
      neutral: "theme entry.preset.neutral",
      radiusScale: "theme entry.preset.radiusScale",
      customTokens: "theme token override entries; old raw map rejected",
    },
  },
  TokensSnapshotEntry: {
    mode: "active project/theme token delta",
    currentWriter:
      "parseThemeTokenInput → setThemeToken → setThemes; buildTokensSnapshot",
    currentReader:
      "isTokensSnapshotEntry; resolveThemeSnapshot; resolveCanonicalToken",
    evidence: [
      [
        "apps/builder/src/builder/panels/themes/themeTokenEditor.ts",
        "parseThemeTokenInput",
      ],
      [
        "apps/builder/src/builder/panels/themes/themeActions.ts",
        "setThemeToken",
      ],
      [
        "apps/builder/src/adapters/canonical/variablesAdapter.ts",
        "buildTokensSnapshot",
      ],
      [
        "packages/shared/src/theme/themesCollection.ts",
        "isTokensSnapshotEntry",
      ],
      [
        "apps/builder/src/utils/theme/resolveThemeSnapshot.ts",
        "resolveThemeSnapshot",
      ],
    ],
    fields: {
      type: "project token/override.valueType",
      value: "project token/override.value",
      source: "project token/override.provenance",
    },
  },
  PagePositionPoint: {
    mode: "runtime-only drop point; old serialized positions retire",
    currentWriter: "Canvas pointer/drop position",
    currentReader:
      "resolvePlacementForDrop → absolutePlacement → PagePlacement style",
    evidence: [
      [
        "apps/builder/src/builder/workspace/canvas/scene/pagePlacementEdit.ts",
        "resolvePlacementForDrop",
      ],
      [
        "apps/builder/src/builder/workspace/canvas/scene/pagePlacementEdit.ts",
        "absolutePlacement",
      ],
      [
        "apps/builder/src/builder/stores/utils/pagePlacementCommit.ts",
        "commitPagePlacement",
      ],
    ],
    fields: {
      x: "runtime drop.x → derived page placement.style.left",
      y: "runtime drop.y → derived page placement.style.top",
    },
  },
  SerializedDataBinding: {
    mode: "legacy extension binding; retire wrapper and open config",
    currentWriter:
      "old element adapters cast binding; applyCanonicalDataBindingPatch restores old extension",
    currentReader:
      "getElementDataBinding props-first fallback; normalizeDataBinding",
    evidence: [
      [
        "apps/builder/src/adapters/canonical/canonicalMutations.ts",
        "buildCompositionExtensionField",
      ],
      [
        "apps/builder/src/adapters/canonical/index.ts",
        "buildCompositionExtensionField",
      ],
      [
        "apps/builder/src/adapters/canonical/slotAndLayoutAdapter.ts",
        "buildCompositionExtensionField",
      ],
      [
        "apps/builder/src/builder/stores/elements.ts",
        "applyCanonicalDataBindingPatch",
      ],
      [
        "packages/shared/src/utils/compositionExtensionFields.ts",
        "getElementDataBinding",
      ],
      [
        "packages/shared/src/collections/normalizeDataBinding.ts",
        "normalizeDataBinding",
      ],
    ],
    fields: {
      type: "retire old collection/value/field discriminator; validate new typed node binding",
      source: "typed node binding source kind + external data record ID",
      config:
        "external collection/API/variable store payload; no open graph config",
      "[index]": "reject unknown legacy keys in new graph",
    },
  },
  CompositionExtension: {
    mode: "old extension namespace; split live binding from retired event/action/editor payloads",
    currentWriter:
      "old adapters and updateNodeExtension; bind_element patch/restore",
    currentReader:
      "canonicalElementsView projection; props-first binding fallback",
    evidence: [
      [
        "apps/builder/src/builder/stores/canonical/canonicalDocumentStore.ts",
        "updateNodeExtension",
      ],
      [
        "apps/builder/src/builder/stores/canonical/canonicalElementsView.ts",
        "x-composition",
      ],
      [
        "apps/builder/src/builder/stores/elements.ts",
        "applyCanonicalDataBindingPatch",
      ],
      [
        "packages/shared/src/utils/compositionExtensionFields.ts",
        "getElementDataBinding",
      ],
    ],
    fields: Object.fromEntries(
      Object.entries(extensionFieldContracts).map(([name, contract]) => [
        name,
        contract.newDestination,
      ]),
    ),
    fieldContracts: extensionFieldContracts,
  },
  CompositionExtendedNode: {
    mode: "old node extension wrapper; remove namespace",
    currentWriter:
      "canonicalDocumentStore.updateNodeExtension and old adapters",
    currentReader:
      "canonicalDocumentStore clone/select; canonicalElementsView projection",
    evidence: [
      [
        "apps/builder/src/builder/stores/canonical/canonicalDocumentStore.ts",
        "updateNodeExtension",
      ],
      [
        "apps/builder/src/builder/stores/canonical/canonicalElementsView.ts",
        "x-composition",
      ],
    ],
    fields: Object.fromEntries(
      Object.entries(extendedNodeFieldContract).map(([name, contract]) => [
        name,
        contract.newDestination,
      ]),
    ),
    fieldContracts: extendedNodeFieldContract,
  },
};
for (const [name, contract] of Object.entries(fieldEvidence)) {
  const declared = exportedInterfaces.find((item) => item.name === name);
  if (!declared || !unmappedInterfaces.includes(name))
    throw new Error(`Field evidence interface no longer pending: ${name}`);
  const declaredFields = declared.fields.map((field) => field.name).sort();
  const evidencedFields = Object.keys(contract.fields).sort();
  if (JSON.stringify(declaredFields) !== JSON.stringify(evidencedFields))
    throw new Error(`${name} field evidence differs from declaration`);
  for (const [path, symbol] of contract.evidence) {
    if (!readFileSync(resolve(root, path), "utf8").includes(symbol))
      throw new Error(`${name} field evidence missing ${symbol} in ${path}`);
  }
}
const evidencedFieldCount = Object.values(fieldEvidence).reduce(
  (count, contract) => count + Object.keys(contract.fields).length,
  0,
);
const unplannedFamilies = unmappedInterfaces.filter(
  (name) => !pendingFamilyPlan[name],
);
const staleFamilyPlans = Object.keys(pendingFamilyPlan).filter(
  (name) => !unmappedInterfaces.includes(name),
);
if (unplannedFamilies.length || staleFamilyPlans.length) {
  throw new Error(
    `Interface family drift: unplanned=${unplannedFamilies.join(",")} stale=${staleFamilyPlans.join(",")}`,
  );
}

const publicActionPlan = {
  getDocument: ["read", "catalog.selectDocument"],
  setDocument: ["write", "catalog.loadValidatedDocument"],
  setCurrentProject: ["runtime", "catalogRuntime.setActiveProject"],
  updateNode: ["write", "catalog.transaction.patchNode"],
  updateNodeProps: ["write", "catalog.transaction.patchNodeProps"],
  updateNodeExtension: ["retire", "typed node binding/metadata transactions"],
  insertNode: ["write", "catalog.transaction.insertNode"],
  getNodeChildren: ["read", "catalog.selectChildren"],
  moveNode: ["write", "catalog.transaction.moveNode"],
  removeNode: ["write", "catalog.transaction.deleteNode"],
  appendDescendantChild: ["write", "catalog.transaction.fillSlot"],
  moveDescendantChild: ["write", "catalog.transaction.moveSlotChild"],
  updateDescendant: ["write", "catalog.transaction.patchReplaceOrFill"],
  setEvents: ["write", "catalog.transaction.replaceInteractions"],
  updateEvent: ["write", "catalog.transaction.patchInteraction"],
  addEvent: ["write", "catalog.transaction.addInteraction"],
  removeEvent: ["write", "catalog.transaction.deleteInteraction"],
  setActions: ["retire", "dormant action-root API"],
  updateAction: ["retire", "dormant action-root API"],
  addAction: ["retire", "dormant action-root API"],
  removeAction: ["retire", "dormant action-root API"],
  setPagePositions: [
    "retire",
    "old position/debug API; project.pageLayout fallback",
  ],
  setPageLayout: ["write", "catalog.transaction.patchProjectLayout"],
  setPagePlacements: ["write", "catalog.transaction.patchPagePlacements"],
  setPageGuides: ["write", "catalog.transaction.replacePageGuides"],
  setThemes: ["write", "catalog.transaction.replaceThemes"],
};
const actionsPath = resolve(
  root,
  "packages/shared/src/types/composition-document-actions.types.ts",
);
const actionsFile = parse(actionsPath);
const actionsDeclaration = actionsFile.statements.find(
  (statement) =>
    ts.isInterfaceDeclaration(statement) &&
    statement.name.text === "CanonicalDocumentActions",
);
if (!actionsDeclaration) throw new Error("CanonicalDocumentActions missing");
const publicActions = actionsDeclaration.members.map((member) => {
  if (!ts.isMethodSignature(member))
    throw new Error(`Unexpected public action ${member.getText(actionsFile)}`);
  const name = propertyName(member, actionsFile);
  const plan = publicActionPlan[name];
  if (!plan) throw new Error(`Unplanned public action ${name}`);
  return {
    name,
    line:
      actionsFile.getLineAndCharacterOfPosition(member.getStart(actionsFile))
        .line + 1,
    signature: member.getText(actionsFile),
    role: plan[0],
    destination: plan[1],
  };
});
const staleActionPlans = Object.keys(publicActionPlan).filter(
  (name) => !publicActions.some((action) => action.name === name),
);
if (staleActionPlans.length)
  throw new Error(`Stale public action plans: ${staleActionPlans.join(",")}`);
const actionImplementationPath =
  "apps/builder/src/builder/stores/canonical/canonicalDocumentStore.ts";
const actionImplementationSource = readFileSync(
  resolve(root, actionImplementationPath),
  "utf8",
);
for (const action of publicActions) {
  const matches = [
    ...actionImplementationSource.matchAll(
      new RegExp(`^\\s+${action.name}:\\s*\\(`, "gm"),
    ),
  ];
  if (matches.length !== 1)
    throw new Error(
      `${action.name}: expected one store implementation, found ${matches.length}`,
    );
  action.implementation = {
    path: actionImplementationPath,
    line: actionImplementationSource.slice(0, matches[0].index).split("\n")
      .length,
  };
}

function fields(name) {
  const declaration = source.statements.find(
    (statement) =>
      ts.isInterfaceDeclaration(statement) && statement.name.text === name,
  );
  if (!declaration) throw new Error(`Missing interface ${name}`);
  return declaration.members
    .map((member) => member.name?.getText(source))
    .filter(Boolean);
}

let total = 0;
for (const [name, destinations] of Object.entries(mapping)) {
  const actual = fields(name);
  const missing = actual.filter((field) => !(field in destinations));
  const stale = Object.keys(destinations).filter(
    (field) => !actual.includes(field),
  );
  if (missing.length || stale.length) {
    throw new Error(
      `${name}: unmapped=${missing.join(",")} stale=${stale.join(",")}`,
    );
  }
  total += actual.length;
  process.stdout.write(`${name}: ${actual.length} fields mapped\n`);
}

const sourceDirs = [
  "apps/builder/src",
  "apps/publish/src",
  "packages/shared/src",
  "packages/specs/src",
];
const retiredInterfaceUseSites = Object.fromEntries(
  Object.keys(verifiedRetiredInterfaces).map((name) => {
    const paths = execFileSync(
      "rg",
      ["-l", `\\b${name}\\b`, ...sourceDirs, "--glob", "*.{ts,tsx}"],
      { cwd: root, encoding: "utf8" },
    )
      .trim()
      .split("\n");
    const sites = paths.flatMap((path) => {
      const file = parse(resolve(root, path));
      const refs = [];
      function visitRetired(node) {
        if (ts.isIdentifier(node) && node.text === name) {
          refs.push({
            path,
            line:
              file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
            syntax: ts.SyntaxKind[node.parent.kind],
          });
        }
        ts.forEachChild(node, visitRetired);
      }
      visitRetired(file);
      return refs;
    });
    const external = sites.filter(
      (site) =>
        site.path !== "packages/shared/src/types/composition-document.types.ts",
    );
    if (external.length)
      throw new Error(
        `${name} is no longer dormant: ${external.map((site) => `${site.path}:${site.line}`).join(",")}`,
      );
    return [name, sites];
  }),
);
const legacyRetiredUseSites = Object.fromEntries(
  Object.keys(verifiedLegacyRetiredInterfaces).map((name) => {
    const allowedAdapters = new Set([
      "apps/builder/src/adapters/canonical/canonicalMutations.ts",
      "apps/builder/src/adapters/canonical/index.ts",
      "apps/builder/src/adapters/canonical/slotAndLayoutAdapter.ts",
    ]);
    const paths = execFileSync(
      "rg",
      ["-l", `\\b${name}\\b`, ...sourceDirs, "--glob", "*.{ts,tsx}"],
      { cwd: root, encoding: "utf8" },
    )
      .trim()
      .split("\n");
    const sites = paths.flatMap((path) => {
      const file = parse(resolve(root, path));
      const refs = [];
      function visitLegacyRetired(node) {
        if (ts.isIdentifier(node) && node.text === name) {
          const position = file.getLineAndCharacterOfPosition(
            node.getStart(file),
          );
          refs.push({
            path,
            line: position.line + 1,
            syntax: ts.SyntaxKind[node.parent.kind],
            source: file.text.split("\n")[position.line].trim(),
          });
        }
        ts.forEachChild(node, visitLegacyRetired);
      }
      visitLegacyRetired(file);
      return refs;
    });
    const external = sites.filter(
      (site) =>
        site.path !== "packages/shared/src/types/composition-document.types.ts",
    );
    if (
      external.length !== 6 ||
      [...allowedAdapters].some(
        (path) => external.filter((site) => site.path === path).length !== 2,
      ) ||
      external.some(
        (site) =>
          !allowedAdapters.has(site.path) ||
          (site.syntax !== "ImportSpecifier" &&
            !(
              site.syntax === "TypeReference" &&
              site.source.includes(
                "ext.events = element.events as SerializedEventHandler[]",
              )
            )),
      )
    )
      throw new Error(`${name} legacy-only consumer contract drift`);
    return [name, sites];
  }),
);
const oldRootRetiredUseSites = Object.fromEntries(
  Object.keys(verifiedOldRootRetiredInterfaces).map((name) => {
    const allowedExternalPaths = new Set([
      "apps/builder/src/builder/stores/canonical/__tests__/rootCollectionStore.test.ts",
      "apps/builder/src/builder/stores/canonical/canonicalElementsBridge.ts",
      "apps/builder/src/lib/db/types.ts",
      "packages/shared/src/types/composition-document-actions.types.ts",
    ]);
    const paths = execFileSync(
      "rg",
      ["-l", `\\b${name}\\b`, ...sourceDirs, "--glob", "*.{ts,tsx}"],
      { cwd: root, encoding: "utf8" },
    )
      .trim()
      .split("\n");
    const astPaths = paths.filter((path) => {
      const file = parse(resolve(root, path));
      let found = false;
      function visitOldRootType(node) {
        if (ts.isIdentifier(node) && node.text === name) found = true;
        ts.forEachChild(node, visitOldRootType);
      }
      visitOldRootType(file);
      return found;
    });
    const unexpected = astPaths.filter(
      (path) =>
        path !== "packages/shared/src/types/composition-document.types.ts" &&
        !allowedExternalPaths.has(path),
    );
    if (
      unexpected.length ||
      [...allowedExternalPaths].some((path) => !astPaths.includes(path))
    )
      throw new Error(`${name} type consumer drift: ${unexpected.join(",")}`);
    return [name, astPaths];
  }),
);
const oldActionRootReaders = [];
const actionCandidatePaths = execFileSync(
  "rg",
  [
    "-l",
    "\\.actions|\\.(?:setActions|addAction|updateAction|removeAction)\\(|useDocumentActions",
    ...sourceDirs,
    "--glob",
    "*.{ts,tsx}",
  ],
  { cwd: root, encoding: "utf8" },
)
  .trim()
  .split("\n");
for (const path of actionCandidatePaths) {
  if (/(?:__tests__\/|\.test\.|\.spec\.)/.test(path)) continue;
  const file = parse(resolve(root, path));
  function inspectActionRoot(node) {
    if (
      ts.isPropertyAccessExpression(node) &&
      node.name.text === "actions" &&
      ts.isIdentifier(node.expression) &&
      ["doc", "db"].includes(node.expression.text)
    )
      oldActionRootReaders.push({
        path,
        line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
        receiver: node.expression.text,
      });
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ["setActions", "addAction", "updateAction", "removeAction"].includes(
        node.expression.name.text,
      )
    )
      throw new Error(`Active old action API call: ${path}`);
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "useDocumentActions"
    )
      throw new Error(`Active old action selector call: ${path}`);
    ts.forEachChild(node, inspectActionRoot);
  }
  inspectActionRoot(file);
}
const oldActionRootReaderPaths = [
  ...new Set(oldActionRootReaders.map((site) => site.path)),
].sort();
if (
  JSON.stringify(oldActionRootReaderPaths) !==
  JSON.stringify([
    "apps/builder/src/builder/stores/canonical/canonicalDocumentStore.ts",
    "apps/builder/src/builder/stores/inspectorActions.ts",
  ])
)
  throw new Error("Old action root reader/writer drift");
const legacyVarPaths = execFileSync(
  "rg",
  ["-l", "\\$var", ...sourceDirs, "--glob", "*.{ts,tsx}"],
  { cwd: root, encoding: "utf8" },
)
  .trim()
  .split("\n");
const activeLegacyVarSites = legacyVarPaths.flatMap((path) => {
  if (path === "packages/shared/src/types/composition-document.types.ts")
    return [];
  const file = parse(resolve(root, path));
  const sites = [];
  function visitVar(node) {
    const name =
      ts.isPropertyAssignment(node) || ts.isPropertySignature(node)
        ? propertyName(node, file)
        : ts.isPropertyAccessExpression(node)
          ? node.name.text
          : null;
    if (name === "$var")
      sites.push({
        path,
        line: file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
      });
    ts.forEachChild(node, visitVar);
  }
  visitVar(file);
  return sites;
});
if (activeLegacyVarSites.length)
  throw new Error(
    `Legacy $var runtime syntax revived: ${activeLegacyVarSites.map((site) => `${site.path}:${site.line}`).join(",")}`,
  );
const descendantAuthoringPlan = {
  "apps/builder/src/adapters/canonical/canonicalMutations.ts":
    "old node conversion and descendant replacement",
  "apps/builder/src/adapters/canonical/canonicalRefResolution.ts":
    "instance fills/style patch helpers",
  "apps/builder/src/adapters/canonical/slotAndLayoutAdapter.ts":
    "old layout slot child projection",
  "apps/builder/src/adapters/canonical/pageFrameBinding.ts":
    "page layout slot child binding",
  "apps/builder/src/builder/components/migrateDialogTriggerInstances.ts":
    "old dialog instance migration",
  "apps/builder/src/builder/components/dialogRegionPaths.ts":
    "dialog region path construction",
  "apps/builder/src/builder/components/stateVariantLayers.ts":
    "state variant descendant layers",
  "apps/builder/src/builder/components/tableColumnInsert.ts":
    "table column child insertion",
  "apps/builder/src/builder/components/collectionItemInsert.ts":
    "collection item child insertion",
  "apps/builder/src/builder/components/originChildRefs.ts":
    "origin child reference materialization",
  "apps/builder/src/builder/components/stateVariantMigration.ts":
    "old state variant patch migration",
  "apps/builder/src/builder/components/staticCollectionMigration.ts":
    "old static collection item migration",
  "apps/builder/src/builder/components/tree/treeTemplateOrigins.ts":
    "tree template label creation",
};
const descendantAuthoringFiles = execFileSync(
  "rg",
  [
    "-l",
    "descendants\\[[^]]+\\]\\s*=|descendants:\\s*\\{|\\[pathKey\\]:\\s*\\{",
    "apps/builder/src",
    "packages/shared/src",
    "--glob",
    "*.{ts,tsx}",
    "--glob",
    "!**/*.test.*",
    "--glob",
    "!**/__tests__/**",
  ],
  { cwd: root, encoding: "utf8" },
)
  .trim()
  .split("\n")
  .sort()
  .map((path) => ({
    path,
    role: descendantAuthoringPlan[path] ?? "UNCLASSIFIED",
  }));
const unclassifiedDescendantWriters = descendantAuthoringFiles.filter(
  (item) => item.role === "UNCLASSIFIED",
);
const staleDescendantPlans = Object.keys(descendantAuthoringPlan).filter(
  (path) => !descendantAuthoringFiles.some((item) => item.path === path),
);
if (unclassifiedDescendantWriters.length || staleDescendantPlans.length)
  throw new Error(
    `Descendant authoring drift: unclassified=${unclassifiedDescendantWriters.map((item) => item.path).join(",")} stale=${staleDescendantPlans.join(",")}`,
  );
const references = execFileSync(
  "rg",
  [
    "-l",
    "CompositionDocument|CanonicalNode|useCanonicalDocumentStore|resolveCanonicalDocument",
    ...sourceDirs,
    "--glob",
    "*.{ts,tsx}",
  ],
  { cwd: root, encoding: "utf8" },
)
  .trim()
  .split("\n")
  .sort();
const symbolPattern =
  /CompositionDocument|CanonicalNode|useCanonicalDocumentStore|resolveCanonicalDocument/g;
const consumerFamilies = [
  [/^apps\/publish\//, "Publish follow-up"],
  [/^apps\/builder\/src\/preview\//, "DOM Preview consumer"],
  [/^apps\/builder\/src\/builder\/workspace\/canvas\//, "Canvas consumer"],
  [/^apps\/builder\/src\/builder\/panels\//, "Builder inspector/panels"],
  [/^apps\/builder\/src\/builder\/stores\//, "Builder state/history"],
  [/^apps\/builder\/src\/adapters\/canonical\//, "old mutation/ref adapter"],
  [/^apps\/builder\/src\/resolvers\/canonical\//, "old resolver"],
  [/^apps\/builder\/src\/lib\/db\//, "persistence"],
  [/^apps\/builder\/src\/adapters\/pencil\//, "Pencil exchange"],
  [/^apps\/builder\/src\/services\/ai\//, "AI command consumer"],
  [/^apps\/builder\//, "Builder integration"],
  [/^packages\/shared\/src\/catalog\//, "library definition/consumer"],
  [/^packages\/shared\/src\/types\//, "shared public schema"],
  [/^packages\/shared\//, "shared reader/serializer"],
  [/^packages\/specs\//, "old spec/emitter"],
];
const directConsumers = references.map((path) => ({
  path,
  family:
    consumerFamilies.find(([pattern]) => pattern.test(path))?.[1] ??
    "UNCLASSIFIED",
  symbols: [
    ...new Set(
      readFileSync(resolve(root, path), "utf8").match(symbolPattern) ?? [],
    ),
  ],
  test: /(?:__tests__\/|\.test\.|\.spec\.)/.test(path),
}));
const pendingInterfacePattern = new RegExp(
  `\\b(?:${unmappedInterfaces.join("|")})\\b`,
  "g",
);
const interfaceReferenceFiles = execFileSync(
  "rg",
  [
    "-l",
    `\\b(?:${unmappedInterfaces.join("|")})\\b`,
    ...sourceDirs,
    "--glob",
    "*.{ts,tsx}",
  ],
  { cwd: root, encoding: "utf8" },
)
  .trim()
  .split("\n")
  .sort();
const interfaceConsumerRoles = [
  [
    /^apps\/builder\/src\/adapters\/canonical\//,
    "old canonical adapter writer/projection",
  ],
  [/^apps\/builder\/src\/builder\/panels\/themes\//, "theme/token editor"],
  [
    /^apps\/builder\/src\/builder\/stores\/canonical\//,
    "old document store/view",
  ],
  [
    /^apps\/builder\/src\/builder\/stores\/elements\.ts$/,
    "element binding writer/reader",
  ],
  [
    /^apps\/builder\/src\/builder\/stores\/utils\/pagePlacement/,
    "page layout writer/reader",
  ],
  [
    /^apps\/builder\/src\/builder\/utils\/catalogStaticSnapshot/,
    "catalog snapshot builder",
  ],
  [
    /^apps\/builder\/src\/builder\/workspace\/canvas\//,
    "Canvas layout/paint reader",
  ],
  [/^apps\/builder\/src\/lib\/db\/types\.ts$/, "persistence public API"],
  [/^packages\/shared\/src\/catalog\/resolvers\//, "shared catalog resolver"],
  [/^packages\/shared\/src\/theme\//, "shared theme transform"],
  [/^packages\/shared\/src\/types\//, "shared schema declaration"],
];
const interfaceDirectConsumers = interfaceReferenceFiles.map((path) => {
  const file = parse(resolve(root, path));
  const astInterfaces = new Set();
  const useSites = [];
  function visitInterfaceReference(node) {
    if (ts.isIdentifier(node) && unmappedInterfaces.includes(node.text)) {
      astInterfaces.add(node.text);
      let owner = node.parent;
      while (
        owner &&
        !ts.isFunctionDeclaration(owner) &&
        !ts.isMethodDeclaration(owner) &&
        !ts.isVariableDeclaration(owner) &&
        !ts.isInterfaceDeclaration(owner) &&
        !ts.isTypeAliasDeclaration(owner) &&
        !ts.isClassDeclaration(owner)
      ) {
        owner = owner.parent;
      }
      const position = file.getLineAndCharacterOfPosition(node.getStart(file));
      useSites.push({
        interface: node.text,
        line: position.line + 1,
        column: position.character + 1,
        syntax: ts.SyntaxKind[node.parent.kind],
        owner: owner?.name?.getText(file) ?? null,
        source: file.text.split("\n")[position.line].trim().slice(0, 180),
      });
    }
    ts.forEachChild(node, visitInterfaceReference);
  }
  visitInterfaceReference(file);
  const interfaces = [
    ...new Set(
      readFileSync(resolve(root, path), "utf8").match(
        pendingInterfacePattern,
      ) ?? [],
    ),
  ].sort();
  return {
    path,
    family:
      consumerFamilies.find(([pattern]) => pattern.test(path))?.[1] ??
      "UNCLASSIFIED",
    interfaces,
    astInterfaces: [...astInterfaces].sort(),
    useSites,
    commentOnlyInterfaces: interfaces.filter(
      (name) => !astInterfaces.has(name),
    ),
    test: /(?:__tests__\/|\.test\.|\.spec\.)/.test(path),
    role:
      astInterfaces.size === 0
        ? "comment/string only"
        : /(?:__tests__\/|\.test\.|\.spec\.)/.test(path)
          ? "test/fixture"
          : (interfaceConsumerRoles.find(([pattern]) =>
              pattern.test(path),
            )?.[1] ?? "UNCLASSIFIED"),
  };
});
const unclassifiedInterfaceConsumers = interfaceDirectConsumers.filter(
  (row) => row.family === "UNCLASSIFIED",
);
if (unclassifiedInterfaceConsumers.length)
  throw new Error(
    `Unclassified interface consumers: ${unclassifiedInterfaceConsumers.map((row) => row.path).join(",")}`,
  );
const unclassifiedInterfaceRoles = interfaceDirectConsumers.filter(
  (row) => row.role === "UNCLASSIFIED",
);
if (unclassifiedInterfaceRoles.length)
  throw new Error(
    `Unclassified active interface roles: ${unclassifiedInterfaceRoles.map((row) => row.path).join(",")}`,
  );
const unclassified = directConsumers.filter(
  (row) => row.family === "UNCLASSIFIED",
);
if (unclassified.length)
  throw new Error(
    `Unclassified direct consumers: ${unclassified.map((row) => row.path).join(",")}`,
  );
const groups = new Map();
for (const path of references) {
  const group = path.split("/").slice(0, 5).join("/");
  groups.set(group, (groups.get(group) ?? 0) + 1);
}
process.stdout.write(
  `${total} owned fields mapped; ${references.length} direct reference files\n`,
);
for (const [group, count] of [...groups].sort((a, b) => b[1] - a[1])) {
  process.stdout.write(`${count}\t${group}\n`);
}

const vocabularyPath = resolve(
  root,
  "packages/shared/src/types/composition-vocabulary.ts",
);
const vocabularyFile = parse(vocabularyPath);
const vocabulary = vocabularyFile.statements.find(
  (statement) =>
    ts.isTypeAliasDeclaration(statement) &&
    statement.name.text === "ComponentTag",
);
if (!vocabulary || !ts.isUnionTypeNode(vocabulary.type))
  throw new Error("ComponentTag union missing");
const tags = vocabulary.type.types
  .map((node) => node.literal?.text)
  .filter(Boolean);
const rulesPath = resolve(
  root,
  "packages/shared/src/catalog/generated/componentRulesTable.ts",
);
const rulesFile = parse(rulesPath);
const rulesDeclaration = rulesFile.statements
  .filter(ts.isVariableStatement)
  .flatMap((statement) => [...statement.declarationList.declarations])
  .find(
    (declaration) =>
      declaration.name.getText(rulesFile) === "COMPONENT_RULES_TABLE",
  );
if (
  !rulesDeclaration ||
  !ts.isObjectLiteralExpression(rulesDeclaration.initializer)
) {
  throw new Error("COMPONENT_RULES_TABLE object missing");
}
const ruleInventory = rulesDeclaration.initializer.properties.map((rule) => {
  if (!ts.isPropertyAssignment(rule))
    throw new Error(`Unexpected rule ${rule.getText(rulesFile)}`);
  const structure = objectProperty(
    rule.initializer,
    "structure",
    rulesFile,
  )?.initializer;
  const composition = objectProperty(
    structure,
    "composition",
    rulesFile,
  )?.initializer;
  const structureContainerStyles = objectProperty(
    structure,
    "containerStyles",
    rulesFile,
  )?.initializer;
  const concreteStructureContainerStyles =
    structureContainerStyles &&
    ts.isIdentifier(structureContainerStyles) &&
    structureContainerStyles.text === "undefined"
      ? undefined
      : structureContainerStyles;
  const indicatorMode = objectProperty(
    structure,
    "indicatorMode",
    rulesFile,
  )?.initializer;
  const structureContainerStyleKinds = {};
  for (const key of strictObjectKeys(
    concreteStructureContainerStyles,
    rulesFile,
    `${propertyName(rule, rulesFile)}.structure.containerStyles`,
  )) {
    const value = objectProperty(
      structureContainerStyles,
      key,
      rulesFile,
    )?.initializer;
    structureContainerStyleKinds[key] = ts.isStringLiteral(value)
      ? "string"
      : ts.isNumericLiteral(value)
        ? "number"
        : "UNCLASSIFIED";
  }
  const topContainerVariants = objectProperty(
    rule.initializer,
    "containerVariants",
    rulesFile,
  )?.initializer;
  const nestedContainerVariants = objectProperty(
    composition,
    "containerVariants",
    rulesFile,
  )?.initializer;
  const topContainerVariantKeys = strictObjectKeys(
    topContainerVariants,
    rulesFile,
    `${propertyName(rule, rulesFile)}.containerVariants`,
  );
  const nestedContainerVariantKeys = strictObjectKeys(
    nestedContainerVariants,
    rulesFile,
    `${propertyName(rule, rulesFile)}.structure.composition.containerVariants`,
  );
  const compositionContainerStyles = objectProperty(
    composition,
    "containerStyles",
    rulesFile,
  )?.initializer;
  const compositionContainerStyleKinds = {};
  if (compositionContainerStyles) {
    if (!ts.isObjectLiteralExpression(compositionContainerStyles))
      throw new Error(
        `${propertyName(rule, rulesFile)}.composition.containerStyles is not literal`,
      );
    for (const style of compositionContainerStyles.properties) {
      if (!ts.isPropertyAssignment(style))
        throw new Error(
          `${propertyName(rule, rulesFile)}.composition.containerStyles has computed/spread member`,
        );
      const value = style.initializer;
      compositionContainerStyleKinds[propertyName(style, rulesFile)] =
        ts.isStringLiteral(value)
          ? "string"
          : ts.isNumericLiteral(value)
            ? "number"
            : "UNCLASSIFIED";
    }
  }
  const structureStates = objectProperty(
    structure,
    "states",
    rulesFile,
  )?.initializer;
  const stateStyles = {};
  const stateStyleKinds = {};
  if (structureStates) {
    if (!ts.isObjectLiteralExpression(structureStates))
      throw new Error(
        `${propertyName(rule, rulesFile)}.structure.states is not literal`,
      );
    for (const state of structureStates.properties) {
      if (!ts.isPropertyAssignment(state))
        throw new Error(
          `${propertyName(rule, rulesFile)}.structure.states has spread/computed member`,
        );
      const stateName = propertyName(state, rulesFile);
      stateStyles[stateName] = strictObjectKeys(
        state.initializer,
        rulesFile,
        `${propertyName(rule, rulesFile)}.structure.states.${stateName}`,
      );
      const values = state.initializer.properties.map((property) => {
        const value = property.initializer;
        const kind = ts.isStringLiteral(value)
          ? "string"
          : ts.isNumericLiteral(value)
            ? "number"
            : value.kind === ts.SyntaxKind.TrueKeyword ||
                value.kind === ts.SyntaxKind.FalseKeyword
              ? "boolean"
              : "UNCLASSIFIED";
        if (kind === "UNCLASSIFIED")
          throw new Error(
            `${propertyName(rule, rulesFile)}.structure.states.${stateName}.${propertyName(property, rulesFile)} has nonliteral value`,
          );
        return [propertyName(property, rulesFile), kind];
      });
      stateStyleKinds[stateName] = Object.fromEntries(values);
    }
  }
  const variantsNode = objectProperty(
    rule.initializer,
    "variants",
    rulesFile,
  )?.initializer;
  const paintStates = new Set();
  if (variantsNode && ts.isObjectLiteralExpression(variantsNode)) {
    for (const variant of variantsNode.properties) {
      const fill = objectProperty(
        variant.initializer,
        "fill",
        rulesFile,
      )?.initializer;
      if (!fill || !ts.isObjectLiteralExpression(fill)) continue;
      for (const fillStyle of fill.properties) {
        if (propertyName(fillStyle, rulesFile) === "alpha") continue;
        for (const state of objectKeys(fillStyle.initializer, rulesFile)) {
          paintStates.add(state);
        }
      }
    }
  }
  return {
    type: propertyName(rule, rulesFile),
    structureKeys: strictObjectKeys(
      structure,
      rulesFile,
      `${propertyName(rule, rulesFile)}.structure`,
    ),
    structureContainerStyleKinds,
    indicatorModeKeys: strictObjectKeys(
      indicatorMode,
      rulesFile,
      `${propertyName(rule, rulesFile)}.structure.indicatorMode`,
    ),
    variants: objectKeys(
      objectProperty(rule.initializer, "variants", rulesFile)?.initializer,
      rulesFile,
    ),
    sizes: objectKeys(
      objectProperty(rule.initializer, "sizes", rulesFile)?.initializer,
      rulesFile,
    ),
    states: objectKeys(structureStates, rulesFile),
    stateStyles,
    stateStyleKinds,
    compositionKeys: strictObjectKeys(
      composition,
      rulesFile,
      `${propertyName(rule, rulesFile)}.structure.composition`,
    ),
    containerVariantLocations: {
      top: topContainerVariantKeys,
      nested: nestedContainerVariantKeys,
      overlap: topContainerVariantKeys.filter((key) =>
        nestedContainerVariantKeys.includes(key),
      ),
      shadowedNested: topContainerVariantKeys.length
        ? nestedContainerVariantKeys.filter(
            (key) => !topContainerVariantKeys.includes(key),
          )
        : [],
    },
    compositionContainerStyleKinds,
    paintStates: [...paintStates].sort(),
  };
});
const compositionKeyPlan = {
  delegation: "typed library CSS delegation; CSS emitter",
  containerStyles:
    "typed library container styles; CSS emitter and Canvas base",
  layout: "typed library layout token; CSS emitter and Canvas base",
  containerVariants: "typed library variant styles; CSS emitter and Canvas",
  gap: "typed library container gap; CSS emitter and Canvas base",
  rootSelectors: "typed library root selectors; CSS emitter",
  staticSelectors: "typed library child selectors; CSS emitter",
  externalStyles: "typed library external selectors; CSS emitter",
  sizeSelectors: "typed library per-size child selectors; CSS emitter",
  animations: "typed library keyframes; CSS emitter",
};
const structureKeyPlan = {
  archetype: "typed library archetype; CSS generator and Canvas/Panel layout",
  buttonBase:
    "typed library utility membership; DOM/Canvas class and paint gate",
  composition:
    "typed library composition; CSS emitter and Canvas container resolver",
  containerStyles:
    "typed library base styles; CSS emitter and Canvas container resolver",
  cssEmitMode:
    "typed library CSS emission mode; CSS generator and utility membership",
  element:
    "typed library DOM element; CSS virtual spec, compare with DOM binding",
  indicatorMode:
    "typed library indicator settings; CSS generator; Canvas parity gap",
  skipCSSGeneration: "typed library CSS skip; manual DOM CSS remains required",
  states: "typed library state styles; CSS emitter and Canvas disabled opacity",
};
const compositionKeys = [
  ...new Set(ruleInventory.flatMap((rule) => rule.compositionKeys)),
].sort();
const structureKeys = [
  ...new Set(ruleInventory.flatMap((rule) => rule.structureKeys)),
].sort();
const structureContainerStyleKeys = [
  ...new Set(
    ruleInventory.flatMap((rule) =>
      Object.keys(rule.structureContainerStyleKinds),
    ),
  ),
].sort();
const structureContainerStyleValueKinds = [
  ...new Set(
    ruleInventory.flatMap((rule) =>
      Object.values(rule.structureContainerStyleKinds),
    ),
  ),
].sort();
if (structureContainerStyleValueKinds.includes("UNCLASSIFIED"))
  throw new Error("Structure container style has nonliteral value");
const indicatorModeKeys = [
  ...new Set(ruleInventory.flatMap((rule) => rule.indicatorModeKeys)),
].sort();
const specTypesPath = resolve(root, "packages/specs/src/types/spec.types.ts");
const specTypesFile = parse(specTypesPath);
const containerStylesSchema = specTypesFile.statements.find(
  (statement) =>
    ts.isInterfaceDeclaration(statement) &&
    statement.name.text === "ContainerStylesSchema",
);
if (!containerStylesSchema)
  throw new Error("ContainerStylesSchema declaration missing");
const containerStyleSourceKeys = containerStylesSchema.members
  .map((member) => propertyName(member, specTypesFile))
  .sort();
const containerStyleKeysOutsideEmitter = structureContainerStyleKeys.filter(
  (key) => !containerStyleSourceKeys.includes(key),
);
const cssGeneratorFile = parse(
  resolve(root, "packages/specs/src/renderers/CSSGenerator.ts"),
);
const containerStylesEmitter = cssGeneratorFile.statements.find(
  (statement) =>
    ts.isFunctionDeclaration(statement) &&
    statement.name?.text === "emitContainerStyles",
);
if (!containerStylesEmitter)
  throw new Error("emitContainerStyles declaration missing");
const containerStyleEmitterKeys = new Set();
function inspectContainerStyleRead(node) {
  if (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === "c"
  )
    containerStyleEmitterKeys.add(node.name.text);
  ts.forEachChild(node, inspectContainerStyleRead);
}
inspectContainerStyleRead(containerStylesEmitter.body);
if (
  JSON.stringify([...containerStyleEmitterKeys].sort()) !==
  JSON.stringify(containerStyleSourceKeys)
)
  throw new Error("ContainerStylesSchema and emitContainerStyles reads differ");
const indicatorModeSpec = specTypesFile.statements.find(
  (statement) =>
    ts.isInterfaceDeclaration(statement) &&
    statement.name.text === "IndicatorModeSpec",
);
if (!indicatorModeSpec)
  throw new Error("IndicatorModeSpec declaration missing");
const indicatorModeSourceKeys = indicatorModeSpec.members.map((member) =>
  propertyName(member, specTypesFile),
);
if (
  JSON.stringify(indicatorModeSourceKeys.sort()) !==
  JSON.stringify(indicatorModeKeys)
)
  throw new Error("IndicatorModeSpec and catalog indicatorMode keys differ");
if (
  JSON.stringify(Object.keys(structureKeyPlan).sort()) !==
  JSON.stringify(structureKeys)
)
  throw new Error("Unplanned or stale catalog structure key");
const structureInterface = exportedInterfaces.find(
  (item) => item.name === "ComponentRuleStructure",
);
const structureSourceKeys = structureInterface.fields.map(
  (field) => field.name,
);
if (
  JSON.stringify(structureSourceKeys.sort()) !== JSON.stringify(structureKeys)
)
  throw new Error("ComponentRuleStructure and catalog structure keys differ");
const compositionContainerStyleValueKinds = [
  ...new Set(
    ruleInventory.flatMap((rule) =>
      Object.values(rule.compositionContainerStyleKinds),
    ),
  ),
].sort();
if (compositionContainerStyleValueKinds.includes("UNCLASSIFIED"))
  throw new Error("Composition container style has nonliteral value");
const compositionSpec = specTypesFile.statements.find(
  (statement) =>
    ts.isInterfaceDeclaration(statement) &&
    statement.name.text === "CompositionSpec",
);
if (!compositionSpec) throw new Error("CompositionSpec declaration missing");
const compositionSourceTypes = compositionSpec.members.map((member) => ({
  key: propertyName(member, specTypesFile),
  type: member.type?.getText(specTypesFile) ?? "unknown",
  optional: Boolean(member.questionToken),
  line:
    specTypesFile.getLineAndCharacterOfPosition(member.getStart(specTypesFile))
      .line + 1,
}));
if (
  JSON.stringify(compositionSourceTypes.map((item) => item.key).sort()) !==
  JSON.stringify(compositionKeys)
)
  throw new Error("CompositionSpec and catalog composition keys differ");
const ruleStateKeys = [
  ...new Set(ruleInventory.flatMap((rule) => rule.states)),
].sort();
const paintStateKeys = [
  ...new Set(ruleInventory.flatMap((rule) => rule.paintStates)),
].sort();
const stateStyleKeys = [
  ...new Set(
    ruleInventory.flatMap((rule) => Object.values(rule.stateStyles).flat()),
  ),
].sort();
const stateStyleValueKinds = Object.fromEntries(
  stateStyleKeys.map((key) => [
    key,
    [
      ...new Set(
        ruleInventory.flatMap((rule) =>
          Object.values(rule.stateStyleKinds)
            .map((styles) => styles[key])
            .filter(Boolean),
        ),
      ),
    ].sort(),
  ]),
);
const expectedRuleStateKeys = ["disabled", "focusVisible", "hover", "pressed"];
const expectedPaintStateKeys = [
  "base",
  "emphasizedSelected",
  "hover",
  "pressed",
  "selected",
];
if (
  JSON.stringify(ruleStateKeys) !== JSON.stringify(expectedRuleStateKeys) ||
  JSON.stringify(paintStateKeys) !== JSON.stringify(expectedPaintStateKeys)
)
  throw new Error(
    `Visual state drift: structure=${ruleStateKeys.join(",")} paint=${paintStateKeys.join(",")}`,
  );
const unplannedCompositionKeys = compositionKeys.filter(
  (key) => !compositionKeyPlan[key],
);
const staleCompositionKeys = Object.keys(compositionKeyPlan).filter(
  (key) => !compositionKeys.includes(key),
);
if (unplannedCompositionKeys.length || staleCompositionKeys.length)
  throw new Error(
    `Composition keys drift: unplanned=${unplannedCompositionKeys.join(",")} stale=${staleCompositionKeys.join(",")}`,
  );
const catalogPath = resolve(
  root,
  "packages/shared/src/catalog/componentCatalog.ts",
);
const catalogFile = parse(catalogPath);
const registered = [];
function visit(node) {
  if (
    ts.isCallExpression(node) &&
    ["primitiveEntry", "reusableEntry", "nativeEntry"].includes(
      node.expression.getText(catalogFile),
    )
  ) {
    const type = node.arguments[0];
    if (ts.isStringLiteral(type))
      registered.push({
        kind: node.expression.getText(catalogFile).replace("Entry", ""),
        type: type.text,
      });
  }
  ts.forEachChild(node, visit);
}
visit(catalogFile);
function stringArray(name) {
  const declaration = catalogFile.statements
    .filter(ts.isVariableStatement)
    .flatMap((statement) => [...statement.declarationList.declarations])
    .find((item) => item.name.getText(catalogFile) === name);
  if (!declaration || !ts.isArrayLiteralExpression(declaration.initializer)) {
    throw new Error(`${name} array missing`);
  }
  return declaration.initializer.elements.map((element) => {
    if (!ts.isStringLiteral(element))
      throw new Error(`${name} has nonliteral member`);
    return element.text;
  });
}
const derivedReusable = [
  ...stringArray("PALETTE_REUSABLE_ORIGIN_TYPES"),
  ...stringArray("NESTED_REUSABLE_ORIGIN_TYPES"),
];
const runtimeEntries = [
  ...registered,
  ...derivedReusable.map((type) => ({ kind: "reusable", type, derived: true })),
];
const ruleByType = new Map(ruleInventory.map((rule) => [rule.type, rule]));
const registrationCoverage = [
  ...new Set(runtimeEntries.map((entry) => entry.type)),
]
  .sort()
  .map((type) => ({
    type,
    entries: runtimeEntries.filter((entry) => entry.type === type),
    visualRule: ruleByType.has(type),
    variants: ruleByType.get(type)?.variants ?? [],
    sizes: ruleByType.get(type)?.sizes ?? [],
    structureStates: ruleByType.get(type)?.states ?? [],
    paintStates: ruleByType.get(type)?.paintStates ?? [],
  }));
const registrationOnlyTypes = registrationCoverage
  .filter((entry) => !entry.visualRule)
  .map((entry) => entry.type);
const ruleOnlyTypes = ruleInventory
  .filter(
    (rule) => !registrationCoverage.some((entry) => entry.type === rule.type),
  )
  .map((rule) => rule.type);
if (
  JSON.stringify(registrationOnlyTypes) !== JSON.stringify(["IconButton"]) ||
  JSON.stringify(ruleOnlyTypes) !==
    JSON.stringify(["Group", "Image", "MenuItem", "TabPanel", "TabPanels"])
)
  throw new Error("Catalog registration/rule-only classification drift");
const vocabularyOnlyClassification = {
  Body: "obsolete tag alias; use lib:body",
  CheckboxItems: "removed legacy wrapper; reject old document",
  Group: "native RAC Group definition; catalog visual rule exists",
  Image: "primitive media definition; catalog visual rule exists",
  MenuItem: "Menu-owned subpart definition; catalog visual rule exists",
  RadioItems: "removed legacy wrapper; reject old document",
  TabPanel: "Tabs-owned panel definition; catalog visual rule exists",
  TabPanels: "Tabs-owned structural definition; catalog visual rule exists",
  ref: "reference discriminator; replace with node.definitionId",
  group: "Pencil structural group definition, separate from RAC Group",
};
const catalogTypes = new Set(runtimeEntries.map((entry) => entry.type));
const vocabularyOnly = tags.filter((tag) => !catalogTypes.has(tag));
const unclassifiedVocabulary = vocabularyOnly.filter(
  (tag) => !vocabularyOnlyClassification[tag],
);
const staleClassification = Object.keys(vocabularyOnlyClassification).filter(
  (tag) => !vocabularyOnly.includes(tag),
);
if (unclassifiedVocabulary.length || staleClassification.length) {
  throw new Error(
    `Vocabulary/catalog drift: unclassified=${unclassifiedVocabulary.join(",")} stale=${staleClassification.join(",")}`,
  );
}
const primitiveTypes = new Set(
  registered
    .filter((entry) => entry.kind === "primitive")
    .map((entry) => entry.type),
);
const missingDerivedPrimitive = derivedReusable.filter(
  (type) => !primitiveTypes.has(type),
);
if (missingDerivedPrimitive.length)
  throw new Error(
    `Derived reusable lacks primitive: ${missingDerivedPrimitive.join(",")}`,
  );
const slotsPath = resolve(root, "packages/shared/src/catalog/slotRoles.ts");
const slotsFile = parse(slotsPath);
const slotDeclaration = slotsFile.statements
  .filter(ts.isVariableStatement)
  .flatMap((statement) => [...statement.declarationList.declarations])
  .find((declaration) => declaration.name.getText(slotsFile) === "SLOT_ROLES");
const slotArray = slotDeclaration?.initializer;
if (
  !slotArray ||
  !ts.isAsExpression(slotArray) ||
  !ts.isArrayLiteralExpression(slotArray.expression)
) {
  throw new Error("SLOT_ROLES array missing");
}
const slotRoles = slotArray.expression.elements.map((element) => element.text);
const nativeSpecContracts = Object.fromEntries(
  ["Frame", "Group", "Slot"].map((type) => {
    const path = resolve(root, `packages/specs/src/components/${type}.spec.ts`);
    const sourceText = readFileSync(path, "utf8");
    const file = parse(path);
    const declaration = file.statements
      .filter(ts.isVariableStatement)
      .flatMap((statement) => [...statement.declarationList.declarations])
      .find((item) => item.name.getText(file) === `${type}Spec`);
    if (!declaration || !ts.isObjectLiteralExpression(declaration.initializer))
      throw new Error(`${type}Spec object missing`);
    const contract = declaration.initializer;
    return [
      type,
      {
        path: `packages/specs/src/components/${type}.spec.ts`,
        sha256: createHash("sha256").update(sourceText).digest("hex"),
        fields: objectKeys(contract, file),
        sizes: objectKeys(
          objectProperty(contract, "sizes", file)?.initializer,
          file,
        ),
        variants: objectKeys(
          objectProperty(contract, "variants", file)?.initializer,
          file,
        ),
        states: objectKeys(
          objectProperty(contract, "states", file)?.initializer,
          file,
        ),
        composition: objectKeys(
          objectProperty(contract, "composition", file)?.initializer,
          file,
        ),
      },
    ];
  }),
);
const report = {
  baselineHead: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
  fieldMapping: mapping,
  exportedInterfaces,
  verifiedRetiredInterfaces,
  retiredInterfaceUseSites,
  verifiedLegacyRetiredInterfaces,
  legacyRetiredUseSites,
  verifiedOldRootRetiredInterfaces,
  oldRootRetiredUseSites,
  oldActionRootReaders,
  activeLegacyVarSites,
  exportedTypeAliases,
  pagePlacementStyleKeys,
  adjacentPublicSurfaces,
  descendantAuthoringFiles,
  unmappedInterfaces,
  pendingFamilyPlan,
  extensionFieldContracts,
  extendedNodeFieldContract,
  proposedFieldDestinations,
  fieldEvidence,
  fieldEvidenceScope:
    "family-level source symbol presence; field-by-field data flow and new validator remain unverified",
  evidencedFieldCount,
  publicActions,
  directReferenceFiles: references,
  directConsumers,
  interfaceDirectConsumers,
  componentTags: tags,
  catalogExplicitEntries: registered,
  catalogRuntimeEntries: runtimeEntries,
  registrationCoverage,
  registrationOnlyTypes,
  ruleOnlyTypes,
  vocabularyOnlyClassification,
  catalogOnlyTypes: [...catalogTypes].filter((type) => !tags.includes(type)),
  visualRules: ruleInventory,
  structureKeys,
  structureKeyPlan,
  structureContainerStyleKeys,
  structureContainerStyleValueKinds,
  containerStyleSourceKeys,
  containerStyleKeysOutsideEmitter,
  indicatorModeKeys,
  compositionSourceTypes,
  compositionContainerStyleValueKinds,
  ruleStateKeys,
  paintStateKeys,
  stateStyleKeys,
  stateStyleValueKinds,
  compositionKeyPlan,
  slotRoles,
  nativeSpecContracts,
};
const outIndex = process.argv.indexOf("--out");
if (outIndex >= 0) {
  if (!process.argv[outIndex + 1]) throw new Error("--out requires path");
  writeFileSync(
    resolve(process.argv[outIndex + 1]),
    `${JSON.stringify(report, null, 2)}\n`,
  );
}
process.stdout.write(
  `${tags.length} component tags; ${registered.length} explicit + ${derivedReusable.length} derived catalog entries; ${ruleInventory.length} visual rules; ${slotRoles.length} slot roles\n`,
);
process.stdout.write(
  `${exportedInterfaces.length} exported interfaces; ${unmappedInterfaces.length} pending detailed destination mapping\n`,
);
process.stdout.write(
  `${evidencedFieldCount}/${proposedFieldDestinations.length} proposed fields have family-level writer/reader trace candidates; field-level data flow and new graph validation remain pending\n`,
);
process.stdout.write(
  `${Object.keys(verifiedRetiredInterfaces).length} dormant interfaces verified for retirement\n`,
);
process.stdout.write(
  `${Object.keys(verifiedLegacyRetiredInterfaces).length} legacy-adapter-only interface verified for retirement\n`,
);
process.stdout.write(
  `${Object.keys(verifiedOldRootRetiredInterfaces).length} dormant old-root interface verified for Phase 4 retirement\n`,
);
process.stdout.write(
  `${exportedTypeAliases.length} exported type aliases inventoried, including open descendant/page-style payloads\n`,
);
process.stdout.write(
  `${publicActions.length} public document actions classified by role and destination\n`,
);
process.stdout.write(
  `${adjacentPublicSurfaces.length} adjacent data/state/interaction/persistence/resolver interfaces inventoried\n`,
);
process.stdout.write(
  `${descendantAuthoringFiles.length} direct descendant authoring candidate files classified\n`,
);
process.stdout.write(
  `${interfaceDirectConsumers.length} lexical consumer files for ${unmappedInterfaces.length} pending interface types (comments/tests included)\n`,
);
process.stdout.write(
  `${interfaceDirectConsumers.filter((row) => row.astInterfaces.length > 0).length} files with AST identifier references\n`,
);

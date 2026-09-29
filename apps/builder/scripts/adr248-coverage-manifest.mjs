#!/usr/bin/env node
// ADR-248 G0: enumerate old-app fixture obligations without embedding either document format.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const baselineDir = resolve(root, "docs/adr/design/248-baseline");
const readJson = (name) =>
  JSON.parse(readFileSync(resolve(baselineDir, name), "utf8"));
const inventory = readJson("inventory.json");
const visualFieldUses = readJson("visual-field-uses.json");
const visualBridgeAudit = readJson("visual-bridge-audit.json");
const visualValueSource = readJson("visual-value-source.json");
const nonvisualFieldAudit = readJson("nonvisual-field-audit.json");
const nonvisualRuntime = readJson("nonvisual-runtime-output.json");
const nonvisualRuntimeRepeatability = readJson(
  "nonvisual-runtime-output-repeatability.json",
);
const fieldMatrix = readJson("field-matrix.json");
const coreFieldMatrix = readJson("core-field-matrix.json");
const adjacentPublicSurfaces = readJson("adjacent-public-surfaces.json");
const consumerDisposition = readJson("consumer-disposition.json");
const retirementInventory = readJson("retirement-inventory.json");
const creationAudit = readJson("creation-route-audit.json");
const paletteSweep = readJson("palette-sweep.json");
const canvas = readJson("baseline.json");
const button = readJson("button/baseline.json");
const buttonProduction = readJson("button-production-ref/baseline.json");
const buttonProductionRepeatability = readJson(
  "button-production-ref/repeatability.json",
);
const palette = readJson("palette/baseline.json");
const paletteProduction = readJson("palette-production-base/baseline.json");
const paletteAxes = readJson("palette-variant-size/baseline.json");
const paletteAxesRepeatability = readJson(
  "palette-variant-size/repeatability.json",
);
const stateOrigins = readJson("state-origins-production/baseline.json");
const stateOriginRepeatability = readJson(
  "state-origins-production/repeatability.json",
);
const systemSubparts = readJson("system-subpart-coverage.json");
const systemChildScene = readJson("system-child-scene.json");
const systemChildSceneRepeatability = readJson(
  "system-child-scene-repeatability.json",
);
const unlistedSimple = readJson("unlisted-simple-production/baseline.json");
const unlistedSimpleRepeatability = readJson(
  "unlisted-simple-production/repeatability.json",
);
const unlistedComposite = readJson(
  "unlisted-composite-production/baseline.json",
);
const unlistedCompositeRepeatability = readJson(
  "unlisted-composite-production/repeatability.json",
);
const modalMissingOrigin = readJson("modal-missing-origin/baseline.json");
const modalMissingOriginRepeatability = readJson(
  "modal-missing-origin/repeatability.json",
);
const systemRootRefs = readJson("system-root-ref-production/baseline.json");
const systemRootRefRepeatability = readJson(
  "system-root-ref-production/repeatability.json",
);
const sectionHosts = readJson("section-host-production/baseline.json");
const sectionHostRepeatability = readJson(
  "section-host-production/repeatability.json",
);
const paletteProductionRepeatability = readJson(
  "palette-production-base/repeatability.json",
);
const slots = readJson("layout-slots.json");
const nativeState = readJson("native-state/baseline.json");
const leafValue = readJson("leaf-value/baseline.json");
const leafValueRepeatability = readJson("leaf-value/repeatability.json");
const coreFieldDefaults = readJson("core-field-defaults/baseline.json");
const coreFieldDefaultsRepeatability = readJson(
  "core-field-defaults/repeatability.json",
);
const pageAuthoring = readJson("page-authoring/baseline.json");
const pageAuthoringRepeatability = readJson(
  "page-authoring/repeatability.json",
);
const nodeFields = readJson("node-fields/baseline.json");
const nodeFieldsRepeatability = readJson("node-fields/repeatability.json");
const coreActiveFlow = readJson("core-active-flow/baseline.json");
const coreActiveFlowRepeatability = readJson(
  "core-active-flow/repeatability.json",
);
const descendantPrecedence = readJson("descendant-precedence.json");
const descendantPrecedenceRepeatability = readJson(
  "descendant-precedence-repeatability.json",
);
const dom = readJson("dom-native.json");
const readme = readFileSync(resolve(baselineDir, "README.md"), "utf8");
const expectedIndexHash =
  /production `dist\/index\.html` SHA-256: `([a-f0-9]{64})`/.exec(readme)?.[1];
if (!expectedIndexHash) throw new Error("Frozen build hash missing in README");
const actualIndexHash = createHash("sha256")
  .update(readFileSync(resolve(root, "apps/builder/dist/index.html")))
  .digest("hex");
if (expectedIndexHash !== actualIndexHash)
  throw new Error("Current dist/index.html differs from the G0 frozen build");
if (
  visualFieldUses.baselineHead !== inventory.baselineHead ||
  visualFieldUses.summary.visualFields !==
    inventory.proposedFieldDestinations.filter((entry) =>
      entry.interface.startsWith("ComponentRule"),
    ).length
)
  throw new Error("Visual field use report differs from G0 inventory");
if (
  visualBridgeAudit.baselineHead !== inventory.baselineHead ||
  visualBridgeAudit.chartFields.length !== 12 ||
  visualBridgeAudit.fillStateBridge.sourceFields.length !== 7 ||
  visualBridgeAudit.visualFieldsStillWithoutStaticAccess.length !==
    visualFieldUses.summary.fieldsWithoutProductionStaticAccess.length - 12 ||
  visualBridgeAudit.indirectRoutes.flatMap((route) => route.fields).length !==
    20
)
  throw new Error("Visual bridge audit differs from G0 field report");
if (
  visualValueSource.baselineHead !== inventory.baselineHead ||
  visualValueSource.summary.fields !== 102 ||
  visualValueSource.summary.fieldsWithClassifiedConsumer !== 102 ||
  visualValueSource.summary.fieldsWithTableValue !== 98 ||
  visualValueSource.summary.runtimeBehaviorVerified !== 0 ||
  visualValueSource.rows.some(
    (row) =>
      row.status !== "OLD_SOURCE_AND_CONSUMER_CLASSIFIED; BEHAVIOR_UNVERIFIED",
  )
)
  throw new Error("Visual table value source audit differs from G0 inventory");
if (
  nonvisualFieldAudit.baselineHead !== inventory.baselineHead ||
  nonvisualFieldAudit.summary.fields !== inventory.evidencedFieldCount ||
  nonvisualFieldAudit.summary.families !==
    Object.keys(inventory.fieldEvidence).length
)
  throw new Error("Nonvisual field audit differs from G0 inventory");
if (
  nonvisualRuntime.head !== inventory.baselineHead ||
  nonvisualRuntime.summary.fields !== 19 ||
  nonvisualRuntime.summary.oldRuntimeWitnesses !== 12 ||
  nonvisualRuntime.summary.dispositionOnly !== 7 ||
  nonvisualRuntimeRepeatability.scenarioId !== nonvisualRuntime.scenario.id ||
  nonvisualRuntimeRepeatability.independentRuns !== 2 ||
  !nonvisualRuntimeRepeatability.byteIdentical ||
  nonvisualRuntimeRepeatability.baselineSha256 !==
    createHash("sha256")
      .update(
        readFileSync(resolve(baselineDir, "nonvisual-runtime-output.json")),
      )
      .digest("hex") ||
  nonvisualRuntimeRepeatability.repeatSha256 !==
    nonvisualRuntimeRepeatability.baselineSha256
)
  throw new Error("Old nonvisual runtime output changed");
if (
  fieldMatrix.baselineHead !== inventory.baselineHead ||
  fieldMatrix.summary.fields !== inventory.proposedFieldDestinations.length ||
  fieldMatrix.summary.missingDestinationOrRouteOrGate !== 0 ||
  fieldMatrix.summary.visualFieldsWithTableValue !== 98 ||
  fieldMatrix.summary.nonvisualOldRuntimeWitnesses !== 12 ||
  fieldMatrix.summary.behaviorVerified !== 0
)
  throw new Error("Field matrix differs from G0 inventory or gate status");
if (
  coreFieldMatrix.baselineHead !== inventory.baselineHead ||
  coreFieldMatrix.summary.fields !==
    Object.values(inventory.fieldMapping).reduce(
      (count, fields) => count + Object.keys(fields).length,
      0,
    ) ||
  coreFieldMatrix.summary.missingDestinationOrFamilyOrGate !== 0 ||
  coreFieldMatrix.summary.fieldValueFlowVerified !== 0 ||
  coreFieldMatrix.summary.oldDefaultFieldsPresent !== 24
)
  throw new Error("Core field matrix differs from G0 inventory or gate status");
if (
  systemChildScene.head !== inventory.baselineHead ||
  systemChildScene.summary.roots !== 34 ||
  systemChildScene.summary.childContexts !== 91 ||
  systemChildScene.summary.typesWithScene.length !== 33 ||
  systemChildScene.summary.typesWithLayout.length !== 32 ||
  systemChildScene.summary.missingScenePaths.length !== 1 ||
  systemChildScene.summary.rootsRejectedByOldStore.length !== 1 ||
  !systemChildSceneRepeatability.byteIdentical ||
  systemChildSceneRepeatability.independentRuns !== 2 ||
  systemChildSceneRepeatability.repeatSha256 !==
    systemChildSceneRepeatability.baselineSha256 ||
  systemChildSceneRepeatability.baselineSha256 !==
    createHash("sha256")
      .update(readFileSync(resolve(baselineDir, "system-child-scene.json")))
      .digest("hex")
)
  throw new Error("System child scene baseline or repeatability changed");
if (
  adjacentPublicSurfaces.baselineHead !== inventory.baselineHead ||
  adjacentPublicSurfaces.summary.interfaces !==
    inventory.adjacentPublicSurfaces.length ||
  adjacentPublicSurfaces.summary.fields !==
    inventory.adjacentPublicSurfaces.reduce(
      (count, surface) => count + surface.fields.length,
      0,
    ) ||
  adjacentPublicSurfaces.summary.missingDestinationOrGate !== 0
)
  throw new Error("Adjacent public surface audit differs from G0 inventory");
if (
  consumerDisposition.baselineHead !== inventory.baselineHead ||
  consumerDisposition.summary.files !== inventory.directReferenceFiles.length ||
  consumerDisposition.summary.missingOwnerOrGate !== 0 ||
  consumerDisposition.summary.publishFollowUpFiles !== 3
)
  throw new Error("Consumer disposition differs from G0 inventory");
if (
  retirementInventory.baselineHead !== inventory.baselineHead ||
  retirementInventory.summary.builderOldModuleCandidates !== 126 ||
  retirementInventory.summary.builderProductCandidates !== 56 ||
  retirementInventory.summary.nativeSpecDefinitions !== 3 ||
  retirementInventory.summary.storageRewriteBoundaries !== 4 ||
  retirementInventory.summary.publishFollowUpFiles !== 3
)
  throw new Error("Retirement inventory differs from G0 baseline");
for (const row of [
  ...retirementInventory.retirementCandidates,
  ...retirementInventory.nativeSpecs,
  ...retirementInventory.rewriteBoundaries,
  ...retirementInventory.publishFollowUp,
  ...retirementInventory.retainedUntilPublish,
]) {
  const actualHash = createHash("sha256")
    .update(readFileSync(resolve(root, row.path)))
    .digest("hex");
  if (actualHash !== row.sourceSha256)
    throw new Error(`${row.path}: frozen retirement source changed`);
}
if (
  creationAudit.baselineHead !== inventory.baselineHead ||
  creationAudit.summary.visualAndRegistrationTypes !== 130 ||
  creationAudit.summary.paletteEntries !== 65 ||
  creationAudit.summary.paletteEntriesInVisualUniverse !== 65 ||
  creationAudit.summary.factoryOnly !== 2 ||
  creationAudit.routes.some(
    (route) => route.fullMatrixScenarioDriverStatus !== "PLANNED_UNEXECUTED",
  )
)
  throw new Error("Creation route audit differs from G0 type inventory");

const fixtures = [
  { path: "baseline.json", surface: "Canvas live", result: canvas },
  { path: "button/baseline.json", surface: "Canvas live", result: button },
  {
    path: "button-production-ref/baseline.json",
    surface: "Canvas production",
    result: buttonProduction,
  },
  { path: "palette/baseline.json", surface: "Canvas live", result: palette },
  {
    path: "palette-production-base/baseline.json",
    surface: "Canvas production",
    result: paletteProduction,
  },
  {
    path: "palette-variant-size/baseline.json",
    surface: "Canvas production",
    result: paletteAxes,
  },
  {
    path: "state-origins-production/baseline.json",
    surface: "Canvas production",
    result: stateOrigins,
  },
  {
    path: "system-subpart-coverage.json",
    surface: "Builder system Components tree",
    result: systemSubparts,
  },
  {
    path: "system-child-scene.json",
    surface: "Canvas dev child scene/layout",
    result: systemChildScene,
  },
  {
    path: "unlisted-simple-production/baseline.json",
    surface: "Canvas production",
    result: unlistedSimple,
  },
  {
    path: "unlisted-composite-production/baseline.json",
    surface: "Canvas production",
    result: unlistedComposite,
  },
  {
    path: "modal-missing-origin/baseline.json",
    surface: "Canvas production known failure",
    result: modalMissingOrigin,
  },
  {
    path: "system-root-ref-production/baseline.json",
    surface: "Canvas production",
    result: systemRootRefs,
  },
  {
    path: "section-host-production/baseline.json",
    surface: "Canvas production",
    result: sectionHosts,
  },
  { path: "layout-slots.json", surface: "Canvas live", result: slots },
  {
    path: "native-state/baseline.json",
    surface: "Canvas live",
    result: nativeState,
  },
  {
    path: "leaf-value/baseline.json",
    surface: "Canvas dev leaf edit and IDB refresh",
    result: leafValue,
  },
  {
    path: "core-field-defaults/baseline.json",
    surface: "old Builder new-project core field values",
    result: coreFieldDefaults,
  },
  {
    path: "page-authoring/baseline.json",
    surface: "Canvas dev page actions and IDB refresh",
    result: pageAuthoring,
  },
  {
    path: "node-fields/baseline.json",
    surface: "Canvas dev node action and IDB refresh",
    result: nodeFields,
  },
  {
    path: "core-active-flow/baseline.json",
    surface: "Canvas dev core actions, resolvers, IDB refresh and semantics",
    result: coreActiveFlow,
  },
  {
    path: "descendant-precedence.json",
    surface: "isolated old descendant resolver unit",
    result: descendantPrecedence,
  },
  {
    path: "nonvisual-runtime-output.json",
    surface: "isolated old nonvisual adapter and reader unit",
    result: nonvisualRuntime,
  },
  { path: "dom-native.json", surface: "isolated DOM unit", result: dom },
];
for (const { path, result } of fixtures) {
  if (result.head !== inventory.baselineHead)
    throw new Error(`${path} uses another baseline HEAD`);
  if (
    result.scenario?.seed !== canvas.scenario.seed ||
    result.scenario?.dpr !== canvas.scenario.dpr ||
    result.scenario?.theme !== canvas.scenario.theme ||
    JSON.stringify(result.scenario?.viewport) !==
      JSON.stringify(canvas.scenario.viewport)
  )
    throw new Error(`${path} has a different fixture environment`);
  const actualScenarioHash = createHash("sha256")
    .update(JSON.stringify(result.scenario))
    .digest("hex");
  if (result.scenarioHash !== actualScenarioHash)
    throw new Error(`${path} scenario hash differs from its operations`);
  if (Array.isArray(result.errors) && result.errors.length)
    throw new Error(`${path} has browser errors: ${result.errors.length}`);
}
if (canvas.fontState?.loadStatus !== "loaded")
  throw new Error("Canvas baseline font was not loaded");
if (
  coreFieldDefaults.runtime !== "old Builder dev" ||
  coreFieldDefaults.summary.fields !== 51 ||
  coreFieldDefaults.summary.fieldsPresent !== 24 ||
  coreFieldDefaults.fields.length !== 51 ||
  coreFieldDefaultsRepeatability.scenarioId !== coreFieldDefaults.scenario.id ||
  coreFieldDefaultsRepeatability.independentRuns !== 2 ||
  !coreFieldDefaultsRepeatability.byteIdentical ||
  coreFieldDefaultsRepeatability.baselineSha256 !==
    createHash("sha256")
      .update(
        readFileSync(resolve(baselineDir, "core-field-defaults/baseline.json")),
      )
      .digest("hex") ||
  coreFieldDefaultsRepeatability.repeatSha256 !==
    coreFieldDefaultsRepeatability.baselineSha256
)
  throw new Error(
    "Old core field default output or independent repeat changed",
  );
const leafValueBytes = readFileSync(
  resolve(baselineDir, "leaf-value/baseline.json"),
);
if (
  leafValue.runtime !== "old Builder dev" ||
  leafValue.fontState?.loadStatus !== "loaded" ||
  leafValue.before?.canonical?.text !== "초안" ||
  leafValue.after?.canonical?.text !== "확정" ||
  leafValue.refreshed?.canonical?.text !== "확정" ||
  leafValue.persisted?.afterRefreshText !== "확정" ||
  !leafValue.persisted?.revisionChangedOnEdit ||
  leafValueRepeatability.scenarioId !== leafValue.scenario.id ||
  leafValueRepeatability.independentRuns !== 2 ||
  !leafValueRepeatability.byteIdentical ||
  leafValueRepeatability.screenshotsIdentical !== 3 ||
  leafValueRepeatability.baselineSha256 !==
    createHash("sha256").update(leafValueBytes).digest("hex") ||
  leafValueRepeatability.repeatSha256 !== leafValueRepeatability.baselineSha256
)
  throw new Error("Old leaf edit baseline or independent repeat changed");
for (const capture of Object.values(leafValue.screenshots)) {
  if (
    createHash("sha256")
      .update(readFileSync(resolve(baselineDir, "leaf-value", capture.path)))
      .digest("hex") !== capture.sha256
  )
    throw new Error(`Old leaf screenshot changed: ${capture.path}`);
}
if (
  pageAuthoring.runtime !== "old Builder dev" ||
  pageAuthoring.fontState?.loadStatus !== "loaded" ||
  pageAuthoring.before?.direction !== null ||
  pageAuthoring.after?.direction !== "horizontal" ||
  pageAuthoring.refreshed?.gap !== 96 ||
  pageAuthoring.persisted?.columns !== 2 ||
  pageAuthoring.persisted?.placement?.style?.left !== 48 ||
  pageAuthoring.refreshed?.guides?.[0]?.position !== 120 ||
  pageAuthoringRepeatability.scenarioId !== pageAuthoring.scenario.id ||
  pageAuthoringRepeatability.independentRuns !== 2 ||
  !pageAuthoringRepeatability.byteIdentical ||
  pageAuthoringRepeatability.screenshotsIdentical !== 2 ||
  pageAuthoringRepeatability.observedOldFields.length !== 10 ||
  pageAuthoringRepeatability.baselineSha256 !==
    createHash("sha256")
      .update(
        readFileSync(resolve(baselineDir, "page-authoring/baseline.json")),
      )
      .digest("hex") ||
  pageAuthoringRepeatability.repeatSha256 !==
    pageAuthoringRepeatability.baselineSha256
)
  throw new Error("Old page authoring baseline or independent repeat changed");
for (const capture of Object.values(pageAuthoring.screenshots)) {
  if (
    createHash("sha256")
      .update(
        readFileSync(resolve(baselineDir, "page-authoring", capture.path)),
      )
      .digest("hex") !== capture.sha256
  )
    throw new Error(`Old page screenshot changed: ${capture.path}`);
}
if (
  nodeFields.runtime !== "old Builder dev" ||
  nodeFieldsRepeatability.scenarioId !== nodeFields.scenario.id ||
  nodeFieldsRepeatability.independentRuns !== 2 ||
  !nodeFieldsRepeatability.byteIdentical ||
  nodeFieldsRepeatability.screenshotsIdentical !== 2 ||
  nodeFieldsRepeatability.observedOldFields.length !== 8 ||
  JSON.stringify(nodeFields.input) !== JSON.stringify(nodeFields.after) ||
  JSON.stringify(nodeFields.after) !== JSON.stringify(nodeFields.persisted) ||
  JSON.stringify(nodeFields.after) !== JSON.stringify(nodeFields.refreshed) ||
  nodeFieldsRepeatability.baselineSha256 !==
    createHash("sha256")
      .update(readFileSync(resolve(baselineDir, "node-fields/baseline.json")))
      .digest("hex") ||
  nodeFieldsRepeatability.repeatSha256 !==
    nodeFieldsRepeatability.baselineSha256
)
  throw new Error("Old node field action baseline changed");
for (const capture of Object.values(nodeFields.screenshots)) {
  if (
    createHash("sha256")
      .update(readFileSync(resolve(baselineDir, "node-fields", capture.path)))
      .digest("hex") !== capture.sha256
  )
    throw new Error(`Old node screenshot changed: ${capture.path}`);
}
if (
  coreActiveFlow.runtime !== "old Builder dev" ||
  coreActiveFlow.buildIndexSha256 !== actualIndexHash ||
  coreActiveFlow.fontState?.loadStatus !== "loaded" ||
  coreActiveFlow.after?.ref?.descendants?.Label?.children !== "G0 label" ||
  coreActiveFlow.reader?.mobileLayout?.gap !== 44 ||
  coreActiveFlow.reader?.mobilePlacement?.left !== 15 ||
  coreActiveFlow.reader?.theme?.tint !== "#112233" ||
  coreActiveFlow.reader?.interaction?.[0]?.id !== "flow-event" ||
  JSON.stringify(coreActiveFlow.after) !==
    JSON.stringify(coreActiveFlow.refreshed) ||
  coreActiveFlowRepeatability.scenarioId !== coreActiveFlow.scenario.id ||
  coreActiveFlowRepeatability.independentRuns !== 2 ||
  !coreActiveFlowRepeatability.byteIdentical ||
  coreActiveFlowRepeatability.screenshotsIdentical !== 2 ||
  coreActiveFlowRepeatability.baselineSha256 !==
    createHash("sha256")
      .update(
        readFileSync(resolve(baselineDir, "core-active-flow/baseline.json")),
      )
      .digest("hex") ||
  coreActiveFlowRepeatability.repeatSha256 !==
    coreActiveFlowRepeatability.baselineSha256
)
  throw new Error("Old core active flow or independent repeat changed");
for (const capture of Object.values(coreActiveFlow.screenshots)) {
  if (
    createHash("sha256")
      .update(
        readFileSync(resolve(baselineDir, "core-active-flow", capture.path)),
      )
      .digest("hex") !== capture.sha256
  )
    throw new Error(`Old core active screenshot changed: ${capture.path}`);
}
if (
  descendantPrecedence.runtime !==
    "old Builder pure authoring/resolver modules" ||
  descendantPrecedenceRepeatability.scenarioId !==
    descendantPrecedence.scenario.id ||
  descendantPrecedenceRepeatability.independentRuns !== 2 ||
  !descendantPrecedenceRepeatability.byteIdentical ||
  descendantPrecedence.oldOutput.modeA.props.children !== "patched" ||
  descendantPrecedence.oldOutput.modeC.ownedProps.children !== "edited" ||
  descendantPrecedenceRepeatability.baselineSha256 !==
    createHash("sha256")
      .update(readFileSync(resolve(baselineDir, "descendant-precedence.json")))
      .digest("hex") ||
  descendantPrecedenceRepeatability.repeatSha256 !==
    descendantPrecedenceRepeatability.baselineSha256
)
  throw new Error("Old descendant precedence fixture changed");
if (
  buttonProduction.buildIndexSha256 !== expectedIndexHash ||
  buttonProduction.observed?.type !== "ref" ||
  buttonProduction.observed?.componentName !== "Button" ||
  buttonProduction.observed?.ref !== "component-button" ||
  !buttonProduction.observed?.parentIsPageBody ||
  buttonProduction.fontState?.loadStatus !== "loaded" ||
  buttonProduction.rows.length !== 30 ||
  buttonProduction.distinctScreenshotHashes !== 25 ||
  buttonProductionRepeatability.head !== inventory.baselineHead ||
  buttonProductionRepeatability.buildIndexSha256 !== expectedIndexHash ||
  buttonProductionRepeatability.scenarioHash !==
    buttonProduction.scenarioHash ||
  buttonProductionRepeatability.rows.length !== 30 ||
  buttonProductionRepeatability.allEqual !== true
)
  throw new Error("Production Button ref matrix differs from G0 baseline");
for (const row of buttonProduction.rows) {
  const repeat = buttonProductionRepeatability.rows.find(
    (item) => item.variant === row.variant && item.size === row.size,
  );
  if (
    !repeat ||
    repeat.firstSha256 !== row.pngSha256 ||
    repeat.secondSha256 !== row.pngSha256
  )
    throw new Error(`${row.variant}/${row.size}: Button repeatability changed`);
  const actualHash = createHash("sha256")
    .update(
      readFileSync(
        resolve(baselineDir, "button-production-ref", row.screenshot),
      ),
    )
    .digest("hex");
  if (actualHash !== row.pngSha256)
    throw new Error(`${row.variant}/${row.size}: Button PNG hash changed`);
}
if (
  paletteProduction.buildIndexSha256 !== expectedIndexHash ||
  paletteProduction.fontState?.loadStatus !== "loaded" ||
  paletteProduction.rows.length !== creationAudit.paletteTypes.length ||
  JSON.stringify(
    paletteProduction.scenario.operations.map((op) => op.component),
  ) !== JSON.stringify(creationAudit.paletteTypes) ||
  paletteProduction.captureClip?.width !== 600 ||
  paletteProduction.captureClip?.height !== 400
)
  throw new Error("Production palette base differs from frozen G0 environment");
for (const row of paletteProduction.rows) {
  if (row.type === "Slot") {
    if (row.status !== "LAYOUT_MODE_ONLY")
      throw new Error("Production Slot must use the Layout fixture");
    continue;
  }
  if (
    row.status !== "CAPTURED" ||
    !row.observed?.parentIsPageBody ||
    row.pixelEvidence?.width !== 600 ||
    row.pixelEvidence?.height !== 400 ||
    row.pixelEvidence.nonWhite < 0 ||
    row.screenshot !== `canvas/${row.type}.png`
  )
    throw new Error(`${row.type}: production palette screenshot is incomplete`);
  const actualHash = createHash("sha256")
    .update(
      readFileSync(
        resolve(baselineDir, "palette-production-base", row.screenshot),
      ),
    )
    .digest("hex");
  if (actualHash !== row.pngSha256)
    throw new Error(`${row.type}: production screenshot hash changed`);
}
const expectedPaletteAxisTypes = creationAudit.paletteTypes.filter(
  (type) => type !== "Slot",
);
if (
  paletteAxes.buildIndexSha256 !== expectedIndexHash ||
  paletteAxes.fontState?.loadStatus !== "loaded" ||
  JSON.stringify(paletteAxes.rows.map((row) => row.type)) !==
    JSON.stringify(expectedPaletteAxisTypes) ||
  paletteAxesRepeatability.head !== inventory.baselineHead ||
  paletteAxesRepeatability.buildIndexSha256 !== expectedIndexHash ||
  paletteAxesRepeatability.fullScenarioHash !== paletteAxes.scenarioHash ||
  paletteAxesRepeatability.rows.length !== 25 ||
  paletteAxesRepeatability.allEqual !== true
)
  throw new Error(
    "Production palette variant/size matrix differs from G0 baseline",
  );
let capturedPaletteAxes = 0;
for (const row of paletteAxes.rows) {
  const visualRule = inventory.visualRules.find(
    (rule) => rule.type === row.type,
  );
  const expectedAxes = [
    ...(visualRule?.variants ?? []).map((value) => `variant:${value}`),
    ...(visualRule?.sizes ?? []).map((value) => `size:${value}`),
  ];
  if (
    JSON.stringify(row.captures.map((item) => item.axis)) !==
    JSON.stringify(expectedAxes)
  )
    throw new Error(
      `${row.type}: variant/size axis list differs from inventory`,
    );
  for (const capture of row.captures) {
    const [prop, value] = capture.axis.split(":");
    if (
      capture.observed?.propValue !== value ||
      !capture.observed?.parentIsPageBody ||
      capture.screenshot !== `canvas/${row.type}-${prop}-${value}.png`
    )
      throw new Error(`${row.type}/${capture.axis}: authored axis incomplete`);
    const actualHash = createHash("sha256")
      .update(
        readFileSync(
          resolve(baselineDir, "palette-variant-size", capture.screenshot),
        ),
      )
      .digest("hex");
    if (actualHash !== capture.pngSha256)
      throw new Error(`${row.type}/${capture.axis}: PNG hash changed`);
    capturedPaletteAxes += 1;
  }
}
if (capturedPaletteAxes !== 386)
  throw new Error("Production palette variant/size axis count changed");
if (
  systemSubparts.buildIndexSha256 !== expectedIndexHash ||
  systemSubparts.summary.typesWithoutPaletteOrStateBaseline !== 56 ||
  systemSubparts.summary.typesPresent !== 42 ||
  systemSubparts.summary.typesAbsent !== 14 ||
  systemSubparts.summary.typesWithExistingRootCanvasFixture !== 31 ||
  systemSubparts.rows.length !== 56
)
  throw new Error("System subpart coverage differs from G0 baseline");
if (
  unlistedSimple.buildIndexSha256 !== expectedIndexHash ||
  unlistedSimple.rows.length !== 11 ||
  unlistedSimple.scenario.operations.length !== 11 ||
  unlistedSimple.fontState?.loadStatus !== "loaded" ||
  unlistedSimpleRepeatability.head !== inventory.baselineHead ||
  unlistedSimpleRepeatability.buildIndexSha256 !== expectedIndexHash ||
  unlistedSimpleRepeatability.scenarioHash !== unlistedSimple.scenarioHash ||
  unlistedSimpleRepeatability.rows.length !== 11 ||
  !unlistedSimpleRepeatability.allEqual
)
  throw new Error("Unlisted simple command baseline differs from G0 freeze");
for (const row of unlistedSimple.rows) {
  const operation = unlistedSimple.scenario.operations.find(
    (entry) => entry.type === row.type,
  );
  const repeat = unlistedSimpleRepeatability.rows.find(
    (entry) => entry.type === row.type,
  );
  if (
    !operation ||
    operation.op !== "addElement" ||
    row.status !== "CAPTURED" ||
    !row.observed?.parentIsPageBody ||
    !row.observed?.pageIsCurrent ||
    !row.observed?.propsEqual ||
    row.screenshot !== `canvas/${row.type}.png` ||
    row.pixelEvidence?.width !== 600 ||
    row.pixelEvidence?.height !== 400 ||
    repeat?.firstSha256 !== row.pngSha256 ||
    repeat?.secondSha256 !== row.pngSha256 ||
    !repeat?.pixelCountEqual
  )
    throw new Error(
      `${row.type}: unlisted simple command capture is incomplete`,
    );
  const actualHash = createHash("sha256")
    .update(
      readFileSync(
        resolve(baselineDir, "unlisted-simple-production", row.screenshot),
      ),
    )
    .digest("hex");
  if (actualHash !== row.pngSha256)
    throw new Error(`${row.type}: unlisted simple PNG hash changed`);
}
if (
  unlistedComposite.buildIndexSha256 !== expectedIndexHash ||
  JSON.stringify(unlistedComposite.rows.map((row) => row.type)) !==
    JSON.stringify(["ColorPicker", "Toast"]) ||
  unlistedComposite.scenario.operations.length !== 2 ||
  unlistedComposite.fontState?.loadStatus !== "loaded" ||
  unlistedCompositeRepeatability.head !== inventory.baselineHead ||
  unlistedCompositeRepeatability.buildIndexSha256 !== expectedIndexHash ||
  unlistedCompositeRepeatability.scenarioHash !==
    unlistedComposite.scenarioHash ||
  unlistedCompositeRepeatability.rows.length !== 2 ||
  !unlistedCompositeRepeatability.allEqual
)
  throw new Error("Unlisted composite command baseline differs from G0 freeze");
for (const row of unlistedComposite.rows) {
  const operation = unlistedComposite.scenario.operations.find(
    (entry) => entry.type === row.type,
  );
  const repeat = unlistedCompositeRepeatability.rows.find(
    (entry) => entry.type === row.type,
  );
  if (
    !operation ||
    operation.op !== "addParentAndChildren" ||
    row.status !== "CAPTURED" ||
    row.observed?.nodes.length !== operation.children.length + 1 ||
    row.screenshot !== `canvas/${row.type}.png` ||
    row.pixelEvidence?.width !== 600 ||
    row.pixelEvidence?.height !== 400 ||
    repeat?.firstSha256 !== row.pngSha256 ||
    repeat?.secondSha256 !== row.pngSha256 ||
    !repeat?.pixelCountEqual
  )
    throw new Error(`${row.type}: unlisted composite capture is incomplete`);
  const actualHash = createHash("sha256")
    .update(
      readFileSync(
        resolve(baselineDir, "unlisted-composite-production", row.screenshot),
      ),
    )
    .digest("hex");
  if (actualHash !== row.pngSha256)
    throw new Error(`${row.type}: unlisted composite PNG hash changed`);
}
if (
  modalMissingOrigin.buildIndexSha256 !== expectedIndexHash ||
  modalMissingOrigin.scenario.operations.length !== 1 ||
  modalMissingOrigin.scenario.operations[0].componentName !== "Modal" ||
  modalMissingOrigin.scenario.operations[0].ref !== "component-modal" ||
  !modalMissingOrigin.observed.originMissingBefore ||
  !modalMissingOrigin.observed.originMissingAfter ||
  !modalMissingOrigin.observed.refPresent ||
  !modalMissingOrigin.observed.parentIsPageBody ||
  modalMissingOrigin.pixelEvidence?.nonWhite !== 0 ||
  modalMissingOrigin.fontState?.loadStatus !== "loaded" ||
  modalMissingOriginRepeatability.head !== inventory.baselineHead ||
  modalMissingOriginRepeatability.buildIndexSha256 !== expectedIndexHash ||
  modalMissingOriginRepeatability.scenarioHash !==
    modalMissingOrigin.scenarioHash ||
  !modalMissingOriginRepeatability.allEqual ||
  modalMissingOriginRepeatability.firstSha256 !== modalMissingOrigin.pngSha256
)
  throw new Error("Old Modal missing-origin baseline differs from G0 freeze");
const modalPngHash = createHash("sha256")
  .update(
    readFileSync(
      resolve(
        baselineDir,
        "modal-missing-origin",
        modalMissingOrigin.screenshot,
      ),
    ),
  )
  .digest("hex");
if (modalPngHash !== modalMissingOrigin.pngSha256)
  throw new Error("Old Modal missing-origin PNG hash changed");
if (
  systemRootRefs.buildIndexSha256 !== expectedIndexHash ||
  systemRootRefs.rows.length !== 8 ||
  systemRootRefs.rows.filter((row) => row.status === "CAPTURED").length !== 5 ||
  systemRootRefs.rows.filter((row) => row.status === "REJECTED_BY_OLD_STORE")
    .length !== 3 ||
  systemRootRefs.body?.type !== "body" ||
  !systemRootRefs.body?.exists ||
  systemRootRefs.fontState?.loadStatus !== "loaded" ||
  systemRootRefRepeatability.head !== inventory.baselineHead ||
  systemRootRefRepeatability.buildIndexSha256 !== expectedIndexHash ||
  systemRootRefRepeatability.scenarioHash !== systemRootRefs.scenarioHash ||
  systemRootRefRepeatability.rows.length !== 8 ||
  !systemRootRefRepeatability.allEqual
)
  throw new Error("System root ref baseline differs from G0 freeze");
for (const row of [systemRootRefs.body, ...systemRootRefs.rows]) {
  if (row.status === "REJECTED_BY_OLD_STORE") continue;
  const hash = createHash("sha256")
    .update(
      readFileSync(
        resolve(baselineDir, "system-root-ref-production", row.screenshot),
      ),
    )
    .digest("hex");
  if (hash !== row.pngSha256)
    throw new Error(`${row.rootId ?? "body"}: root ref PNG hash changed`);
}
if (
  sectionHosts.buildIndexSha256 !== expectedIndexHash ||
  JSON.stringify(sectionHosts.rows.map((row) => row.sectionType)) !==
    JSON.stringify(["ListBoxSection", "MenuSection", "GridListSection"]) ||
  sectionHosts.fontState?.loadStatus !== "loaded" ||
  sectionHostRepeatability.head !== inventory.baselineHead ||
  sectionHostRepeatability.buildIndexSha256 !== expectedIndexHash ||
  sectionHostRepeatability.scenarioHash !== sectionHosts.scenarioHash ||
  sectionHostRepeatability.rows.length !== 3 ||
  !sectionHostRepeatability.allEqual
)
  throw new Error("Section host baseline differs from G0 freeze");
for (const row of sectionHosts.rows) {
  const operation = sectionHosts.scenario.operations.find(
    (item) => item.sectionType === row.sectionType,
  );
  const repeat = sectionHostRepeatability.rows.find(
    (item) => item.sectionType === row.sectionType,
  );
  if (
    !operation ||
    operation.op !== "addHostThenSectionRef" ||
    row.status !== "CAPTURED" ||
    !row.observed?.hostParentIsPageBody ||
    !row.observed?.sectionParentIsHost ||
    !row.observed?.samePage ||
    row.pixelEvidence?.width !== 600 ||
    row.pixelEvidence?.height !== 400 ||
    repeat?.firstSha256 !== row.pngSha256 ||
    repeat?.secondSha256 !== row.pngSha256 ||
    !repeat?.pixelCountEqual
  )
    throw new Error(`${row.sectionType}: section host capture is incomplete`);
  const hash = createHash("sha256")
    .update(
      readFileSync(
        resolve(baselineDir, "section-host-production", row.screenshot),
      ),
    )
    .digest("hex");
  if (hash !== row.pngSha256)
    throw new Error(`${row.sectionType}: section host PNG hash changed`);
}
for (const row of systemSubparts.rows) {
  for (const occurrence of row.occurrences) {
    if (
      occurrence.path[0]?.id !== occurrence.id ||
      occurrence.path.at(-1)?.id !== occurrence.rootId
    )
      throw new Error(`${row.type}/${occurrence.id}: invalid origin ancestry`);
    if (occurrence.existingRootCanvasFixture) {
      readFileSync(resolve(baselineDir, occurrence.existingRootCanvasFixture));
    }
  }
}
if (
  stateOrigins.buildIndexSha256 !== expectedIndexHash ||
  stateOrigins.originCount !== 75 ||
  stateOrigins.origins.length !== 75 ||
  stateOrigins.rows.length !== 75 ||
  stateOrigins.origins.filter((entry) => entry.role === "variant-ref")
    .length !== 64 ||
  stateOrigins.origins.filter((entry) => entry.role === "base-origin")
    .length !== 11 ||
  stateOrigins.fontState?.loadStatus !== "loaded" ||
  stateOriginRepeatability.head !== inventory.baselineHead ||
  stateOriginRepeatability.buildIndexSha256 !== expectedIndexHash ||
  stateOriginRepeatability.scenarioHash !== stateOrigins.scenarioHash ||
  stateOriginRepeatability.rows.length !== 11 ||
  stateOriginRepeatability.allEqual !== true
)
  throw new Error("Production state origin baseline differs from G0 freeze");
for (const origin of stateOrigins.origins) {
  const row = stateOrigins.rows.find((entry) => entry.id === origin.id);
  if (
    !row ||
    row.state !== origin.state ||
    row.variantOf !== origin.variantOf ||
    origin.parentId !== "page-components-body" ||
    origin.pageId !== "page-components" ||
    row.screenshot !== `canvas/${origin.id}.png` ||
    !/^[0-9]+%$/.test(row.zoomLabel)
  )
    throw new Error(`${origin.id}: seeded state origin is incomplete`);
  const actualHash = createHash("sha256")
    .update(
      readFileSync(
        resolve(baselineDir, "state-origins-production", row.screenshot),
      ),
    )
    .digest("hex");
  if (actualHash !== row.pngSha256)
    throw new Error(`${origin.id}: seeded state PNG hash changed`);
}
for (const repeat of stateOriginRepeatability.rows) {
  const original = stateOrigins.rows.find((entry) => entry.id === repeat.id);
  if (
    !original ||
    repeat.firstSha256 !== original.pngSha256 ||
    repeat.secondSha256 !== original.pngSha256 ||
    !repeat.zoomEqual
  )
    throw new Error(`${repeat.id}: state origin repeatability changed`);
}
for (const repeat of paletteAxesRepeatability.rows) {
  const original = paletteAxes.rows
    .find((row) => row.type === repeat.type)
    ?.captures.find((capture) => capture.axis === repeat.axis);
  if (
    !original ||
    repeat.firstSha256 !== original.pngSha256 ||
    repeat.secondSha256 !== original.pngSha256
  )
    throw new Error(`${repeat.type}/${repeat.axis}: repeatability changed`);
}
if (
  paletteProductionRepeatability.head !== inventory.baselineHead ||
  paletteProductionRepeatability.buildIndexSha256 !== expectedIndexHash ||
  paletteProductionRepeatability.fullScenarioHash !==
    paletteProduction.scenarioHash ||
  paletteProductionRepeatability.allEqual !== true ||
  paletteProductionRepeatability.rows.length !== 6
)
  throw new Error(
    "Production palette repeatability report differs from G0 baseline",
  );
for (const row of paletteProductionRepeatability.rows) {
  const original = paletteProduction.rows.find(
    (item) => item.type === row.type,
  );
  if (
    !original ||
    row.firstSha256 !== row.secondSha256 ||
    row.secondSha256 !== row.fullSweepSha256 ||
    row.fullSweepSha256 !== original.pngSha256 ||
    row.nonWhitePixels !== original.pixelEvidence.nonWhite
  )
    throw new Error(`${row.type}: production repeatability hash changed`);
}
if (
  nativeState.observations.length !== 5 ||
  nativeState.afterRefresh.length !== 5 ||
  nativeState.fontState?.loadStatus !== "loaded"
)
  throw new Error("Frame/Group native state baseline incomplete");
for (const samples of Object.values(nativeState.clipPixelSamples ?? {})) {
  const red = ([r, g, b]) => r > 170 && g < 120 && b < 120;
  const white = ([r, g, b]) => r >= 245 && g >= 245 && b >= 245;
  if (
    !red(samples.clipTrueVisibleOutside) ||
    !white(samples.clipFalseHiddenOutside) ||
    !white(samples.clipTrueHiddenOutside)
  )
    throw new Error("Frame clip/overflow pixel samples changed");
}
if (Object.keys(nativeState.clipPixelSamples ?? {}).length !== 2)
  throw new Error("Frame clip pixel samples missing before or after refresh");
const nativeById = new Map(
  nativeState.afterRefresh.map((item) => [item.semanticId, item]),
);
for (const operation of nativeState.scenario.operations) {
  const result = nativeById.get(operation.id);
  if (!result?.canonical || !result.mirror || !result.layout)
    throw new Error(`${operation.id}: native state refresh result missing`);
  if (operation.op === "insertFrameWithOverflowChild") {
    if (
      result.canonical.clip !== operation.clip ||
      result.mirror.clip !== null ||
      result.scene?.props?.style?.overflow !== operation.overflow
    )
      throw new Error(`${operation.id}: Frame clip/overflow baseline changed`);
  } else if (result.mirror.orientation !== operation.orientation) {
    throw new Error(`${operation.id}: Group orientation baseline changed`);
  }
}
if (
  paletteSweep.head !== inventory.baselineHead ||
  paletteSweep.fontState?.loadStatus !== "loaded" ||
  paletteSweep.scenario.seed !== canvas.scenario.seed ||
  paletteSweep.scenario.dpr !== canvas.scenario.dpr ||
  paletteSweep.scenario.theme !== canvas.scenario.theme ||
  JSON.stringify(paletteSweep.scenario.viewport) !==
    JSON.stringify(canvas.scenario.viewport) ||
  paletteSweep.rows.length !== creationAudit.summary.paletteEntries ||
  JSON.stringify(
    paletteSweep.scenario.operations.map((item) => item.component),
  ) !== JSON.stringify(creationAudit.paletteTypes) ||
  paletteSweep.scenarioHash !==
    createHash("sha256")
      .update(JSON.stringify(paletteSweep.scenario))
      .digest("hex") ||
  paletteSweep.errors.length
)
  throw new Error("Palette sweep does not match G0 creation inventory");
for (const row of paletteSweep.rows) {
  const predicted = creationAudit.routes.find(
    (route) => route.type === row.type,
  );
  if (!predicted?.paletteEntry)
    throw new Error(`${row.type}: palette entry missing`);
  if (row.type === "Slot") {
    if (row.status !== "LAYOUT_MODE_ONLY")
      throw new Error("Slot page-mode disposition changed");
    continue;
  }
  if (
    row.status !== "CREATED_WITH_LAYOUT" ||
    Boolean(row.observed?.type === "ref") !==
      (predicted.oldMode === "reusableOrigin")
  )
    throw new Error(`${row.type}: observed creation differs from audit`);
}

const visualByType = new Map(
  inventory.visualRules.map((rule) => [rule.type, rule]),
);
const registrationByType = new Map(
  inventory.registrationCoverage.map((entry) => [entry.type, entry]),
);
const creationByType = new Map(
  creationAudit.routes.map((entry) => [entry.type, entry]),
);
const typeUniverse = [
  ...new Set([...registrationByType.keys(), ...visualByType.keys()]),
].sort();
if (
  JSON.stringify(typeUniverse) !==
  JSON.stringify(creationAudit.routes.map((route) => route.type).sort())
)
  throw new Error("Creation route types differ from G0 type universe");
const oldBaselineByType = {
  Button: [
    {
      fixture: "button/baseline.json",
      surface: "Canvas live",
      case: "6 variants × 5 sizes, base state",
    },
    {
      fixture: "button-production-ref/baseline.json",
      surface: "Canvas production",
      case: "palette-authored ref; 6 variants × 5 sizes, base state",
    },
  ],
  frame: [
    { fixture: "baseline.json", surface: "Canvas live", case: "fill/border" },
    {
      fixture: "native-state/baseline.json",
      surface: "Canvas live",
      case: "clip/overflow crossing and refresh",
    },
  ],
  Group: [
    {
      fixture: "baseline.json",
      surface: "Canvas live",
      case: "horizontal group",
    },
    {
      fixture: "dom-native.json",
      surface: "isolated DOM unit",
      case: "horizontal/vertical disabled markup",
    },
    {
      fixture: "native-state/baseline.json",
      surface: "Canvas live",
      case: "horizontal/vertical children and refresh",
    },
  ],
  Slot: [
    {
      fixture: "layout-slots.json",
      surface: "Canvas live",
      case: "empty/filled/two-line description",
    },
    {
      fixture: "dom-native.json",
      surface: "isolated DOM unit",
      case: "empty/filled markup",
    },
  ],
  Text: [
    { fixture: "baseline.json", surface: "Canvas live", case: "text child" },
  ],
};
const paletteObserved = new Set();
for (const row of palette.rows) {
  if (
    paletteObserved.has(row.component) ||
    !creationByType.get(row.component)?.paletteEntry
  )
    throw new Error(`Unexpected palette baseline component: ${row.component}`);
  if (
    !row.observed.parentIsPageBody ||
    !row.observed.inDocument ||
    !row.observed.layout
  )
    throw new Error(`Palette baseline is incomplete: ${row.component}`);
  paletteObserved.add(row.component);
  (oldBaselineByType[row.component] ??= []).push({
    fixture: "palette/baseline.json",
    surface: "Canvas live",
    case: "palette insert",
  });
}
for (const row of paletteProduction.rows) {
  if (row.status !== "CAPTURED") continue;
  (oldBaselineByType[row.type] ??= []).push({
    fixture: `palette-production-base/${row.screenshot}`,
    surface: "Canvas production",
    case: `palette base; controlled 220×130 style; ${row.pixelEvidence.nonWhite} nonwhite pixels`,
  });
}
for (const row of paletteAxes.rows) {
  for (const capture of row.captures) {
    (oldBaselineByType[row.type] ??= []).push({
      fixture: `palette-variant-size/${capture.screenshot}`,
      surface: "Canvas production",
      case: `base-relative ${capture.axis}`,
    });
  }
}
for (const origin of stateOrigins.origins) {
  const type = origin.componentName?.split("/")[0];
  if (!type || !typeUniverse.includes(type))
    throw new Error(`${origin.id}: state origin type absent from inventory`);
  (oldBaselineByType[type] ??= []).push({
    fixture: `state-origins-production/canvas/${origin.id}.png`,
    surface: "Canvas production",
    case: `seeded ${origin.role} metadata.variant:${origin.state}`,
  });
}
if (
  JSON.stringify([...paletteObserved]) !==
  JSON.stringify(
    palette.scenario.operations.map((operation) => operation.component),
  )
)
  throw new Error("Palette scenario operations and observed rows differ");
for (const id of ["adr248-frame", "adr248-group", "adr248-text"]) {
  if (!canvas.geometry[id])
    throw new Error(`Canvas baseline has no geometry for ${id}`);
}
const buttonOperations = button.scenario.operations.filter(
  (operation) => operation.component === "Button",
);
if (
  buttonOperations.length !== 30 ||
  buttonOperations.some(
    (operation) => !button.geometry[`adr248-${operation.id}`],
  )
)
  throw new Error("Button matrix baseline has incomplete Canvas geometry");
const actualButtonRelations = new Set(
  button.actualRelations.map(([id, parent]) => `${id}|${parent}`),
);
if (
  button.scenario.expectedRelations.some(
    ([child, parent]) =>
      !actualButtonRelations.has(`adr248-${child}|adr248-${parent}`),
  )
)
  throw new Error("Button matrix has a different authored tree");
if (button.fontState?.loadStatus !== "loaded")
  throw new Error("Button matrix font was not loaded");
if (
  !slots.slots.some((entry) => entry.name === "header" && entry.geometry) ||
  !slots.slots.some((entry) => entry.name === "content" && entry.geometry) ||
  !slots.filled?.geometry
)
  throw new Error("Layout Slot baseline is incomplete");
for (const key of [
  "groupHorizontal",
  "groupVertical",
  "slotEmpty",
  "slotFilled",
]) {
  if (!dom.html?.[key]) throw new Error(`DOM unit baseline has no ${key}`);
}
if (Object.keys(oldBaselineByType).some((type) => !typeUniverse.includes(type)))
  throw new Error("Old baseline names a type outside catalog/rule inventory");
const typesWithoutOldBaseline = typeUniverse.filter(
  (type) => !oldBaselineByType[type]?.length,
);
if (
  JSON.stringify(systemSubparts.scenario.types) !==
    JSON.stringify(typesWithoutOldBaseline) ||
  JSON.stringify(systemSubparts.rows.map((row) => row.type)) !==
    JSON.stringify(typesWithoutOldBaseline)
)
  throw new Error("System subpart probe does not cover every unbased type");
for (const row of unlistedSimple.rows) {
  if (!typesWithoutOldBaseline.includes(row.type))
    throw new Error(`${row.type}: command baseline is not an unbased type`);
  (oldBaselineByType[row.type] ??= []).push({
    fixture: `unlisted-simple-production/${row.screenshot}`,
    surface: "Canvas production",
    case: `explicit addElement command, ${row.pixelEvidence.nonWhite} nonwhite pixels`,
  });
}
for (const row of unlistedComposite.rows) {
  if (!typesWithoutOldBaseline.includes(row.type))
    throw new Error(`${row.type}: composite baseline is not an unbased type`);
  (oldBaselineByType[row.type] ??= []).push({
    fixture: `unlisted-composite-production/${row.screenshot}`,
    surface: "Canvas production",
    case: `explicit parent/child addElement commands, ${row.pixelEvidence.nonWhite} nonwhite pixels`,
  });
}
for (const row of systemRootRefs.rows) {
  if (row.status !== "CAPTURED") continue;
  if (!typesWithoutOldBaseline.includes(row.type))
    throw new Error(`${row.type}: root ref baseline is not an unbased type`);
  (oldBaselineByType[row.type] ??= []).push({
    fixture: `system-root-ref-production/${row.screenshot}`,
    surface: "Canvas production",
    case: `explicit ref to system origin ${row.rootId}; ${row.pixelEvidence.nonWhite} nonwhite pixels`,
  });
}
if (!typesWithoutOldBaseline.includes("body"))
  throw new Error("Page body already had an old direct baseline");
(oldBaselineByType.body ??= []).push({
  fixture: `system-root-ref-production/${systemRootRefs.body.screenshot}`,
  surface: "Canvas production",
  case: "empty page body after Fit to screen",
});
for (const row of sectionHosts.rows) {
  if (!typesWithoutOldBaseline.includes(row.sectionType))
    throw new Error(
      `${row.sectionType}: section host already had an old baseline`,
    );
  (oldBaselineByType[row.sectionType] ??= []).push({
    fixture: `section-host-production/${row.screenshot}`,
    surface: "Canvas production",
    case: `${row.hostType} host with ${row.sectionType} ref origin; ${row.pixelEvidence.nonWhite} nonwhite pixels`,
  });
}

const systemRootRefById = new Map(
  systemRootRefs.rows
    .filter((row) => row.status === "CAPTURED")
    .map((row) => [row.rootId, row]),
);
const sectionHostByOriginId = new Map(
  sectionHosts.rows.map((row) => [row.observed.sectionRef, row]),
);
const indirectContextForType = (type) => {
  const row = systemSubparts.rows.find((item) => item.type === type);
  if (!row) return [];
  const entries = row.occurrences.flatMap((occurrence) => {
    const fixtures = [occurrence.existingRootCanvasFixture];
    const ref = systemRootRefById.get(occurrence.rootId);
    if (ref) fixtures.push(`system-root-ref-production/${ref.screenshot}`);
    const section = sectionHostByOriginId.get(occurrence.rootId);
    if (section) fixtures.push(`section-host-production/${section.screenshot}`);
    return fixtures.filter(Boolean).map((fixture) => ({
      fixture,
      originId: occurrence.rootId,
      elementId: occurrence.id,
    }));
  });
  return entries.filter(
    (entry, index) =>
      entries.findIndex(
        (candidate) =>
          candidate.fixture === entry.fixture &&
          candidate.originId === entry.originId,
      ) === index,
  );
};

const types = typeUniverse.map((type) => {
  const registration = registrationByType.get(type);
  const rule = visualByType.get(type);
  const requiredAxes = [
    "base",
    ...(rule?.variants ?? []).map((value) => `variant:${value}`),
    ...(rule?.sizes ?? []).map((value) => `size:${value}`),
    ...(rule?.states ?? []).map((value) => `structure-state:${value}`),
    ...(rule?.paintStates ?? []).map((value) => `paint-state:${value}`),
    ...[
      ...new Set([
        ...(rule?.containerVariantLocations.top ?? []),
        ...(rule?.containerVariantLocations.nested ?? []),
      ]),
    ].map((value) => `container-variant:${value}`),
  ];
  const directOldCanvas = (oldBaselineByType[type] ?? []).some((item) =>
    item.surface.startsWith("Canvas "),
  );
  const indirectContexts = indirectContextForType(type);
  const oldFixtureCoverage = directOldCanvas
    ? "DIRECT_OLD_CANVAS"
    : type === "Modal"
      ? "KNOWN_OLD_FAILURE"
      : indirectContexts.length
        ? "INDIRECT_PARENT_CONTEXT_ONLY"
        : "MISSING";
  return {
    type,
    registrations: registration?.entries ?? [],
    visualRule: Boolean(rule),
    requiredAxes,
    oldBaseline: oldBaselineByType[type] ?? [],
    oldSystemSubpartContexts:
      systemSubparts.rows.find((row) => row.type === type)?.occurrences ?? [],
    oldChildSceneContexts: systemChildScene.rows.flatMap((row) =>
      row.children
        .filter((child) => child.type === type)
        .map((child) => ({
          fixture: "system-child-scene.json",
          rootId: row.rootId,
          sceneId: child.expectedSceneId,
          scenePresent: child.scenePresent,
          layout: child.layout,
        })),
    ),
    oldFixtureCoverage,
    indirectParentCanvasFixtures: indirectContexts,
    oldKnownFailure:
      type === "Modal"
        ? {
            fixture: "modal-missing-origin/baseline.json",
            reason:
              "stored ref targets absent system origin and Canvas is blank",
          }
        : null,
    scenarioDriver: {
      oldBuilderMode: creationByType.get(type)?.oldMode ?? "UNCLASSIFIED",
      status:
        creationByType.get(type)?.fullMatrixScenarioDriverStatus ??
        "UNCLASSIFIED",
      baseRelativeVariantSizeCaptured:
        paletteAxes.rows.find((row) => row.type === type)?.captures.length ?? 0,
    },
    g3Result: "UNVERIFIED",
  };
});
const slotRoles = inventory.slotRoles.map((role) => ({
  role,
  oldBaseline:
    role === "header" || role === "content" ? ["layout-slots.json"] : [],
  g3Result: "UNVERIFIED",
}));
if (
  types.some((entry) => entry.oldFixtureCoverage === "MISSING") ||
  types.filter((entry) => entry.oldFixtureCoverage === "DIRECT_OLD_CANVAS")
    .length !== 96 ||
  types.filter(
    (entry) => entry.oldFixtureCoverage === "INDIRECT_PARENT_CONTEXT_ONLY",
  ).length !== 33 ||
  types.filter((entry) => entry.oldFixtureCoverage === "KNOWN_OLD_FAILURE")
    .length !== 1
)
  throw new Error("Old type fixture disposition is incomplete");
const manifest = {
  source: {
    baselineHead: inventory.baselineHead,
    buildIndexSha256: expectedIndexHash,
    seed: canvas.scenario.seed,
    viewport: canvas.scenario.viewport,
    dpr: canvas.scenario.dpr,
    theme: canvas.scenario.theme,
    font: canvas.scenario.font,
    resolvedFontFamily: canvas.fontState.bodyFamily,
    fontLoadStatus: canvas.fontState.loadStatus,
  },
  oldFixtures: fixtures.map(({ path, surface, result }) => ({
    path,
    surface,
    scenarioId: result.scenario.id,
    scenarioHash: result.scenarioHash,
  })),
  oldCreationSweep: {
    path: "palette-sweep.json",
    scenarioId: paletteSweep.scenario.id,
    scenarioHash: paletteSweep.scenarioHash,
    surface: "Builder palette UI + Canvas layout",
    fullVisualAxesVerified: false,
  },
  summary: {
    proposedFields: inventory.proposedFieldDestinations.length,
    familyTraceCandidateFields: inventory.evidencedFieldCount,
    nonvisualFieldRoutes: nonvisualFieldAudit.summary.fields,
    fieldMatrixRows: fieldMatrix.summary.fields,
    coreFieldMatrixRows: coreFieldMatrix.summary.fields,
    coreFieldValueFlowVerified: coreFieldMatrix.summary.fieldValueFlowVerified,
    adjacentPublicSurfaceInterfaces: adjacentPublicSurfaces.summary.interfaces,
    adjacentPublicSurfaceFields: adjacentPublicSurfaces.summary.fields,
    directConsumerFilesWithFamilyOwner: consumerDisposition.summary.files,
    publishFollowUpFiles: consumerDisposition.summary.publishFollowUpFiles,
    frozenBuilderRetirementCandidates:
      retirementInventory.summary.builderOldModuleCandidates,
    frozenNativeSpecDefinitions:
      retirementInventory.summary.nativeSpecDefinitions,
    fieldMatrixBehaviorVerified: fieldMatrix.summary.behaviorVerified,
    visualFieldsWithStaticAccess:
      visualFieldUses.summary.fieldsWithProductionStaticAccess,
    visualProductionStaticSites: visualFieldUses.summary.productionStaticSites,
    chartFieldsWithVerifiedBridgeShape: visualBridgeAudit.chartFields.length,
    fillStateFieldsWithVerifiedSpecMirror:
      visualBridgeAudit.fillStateBridge.sourceFields.length,
    visualFieldsWithUnresolvedIndirectBridge:
      visualBridgeAudit.visualFieldsStillWithoutStaticAccess.length,
    indirectVisualRouteGroups: visualBridgeAudit.indirectRoutes.length,
    indirectVisualRoutesNeedingG1Decision: visualBridgeAudit.indirectRoutes
      .filter((route) => route.status.includes("G1"))
      .reduce((count, route) => count + route.fields.length, 0),
    registrationEntries: inventory.catalogRuntimeEntries.length,
    registeredTypes: inventory.registrationCoverage.length,
    visualRuleTypes: inventory.visualRules.length,
    typeUniverse: types.length,
    classifiedOldCreationRoutes: creationAudit.routes.length,
    observedOldPaletteCommands: palette.rows.length,
    productionButtonRefMatrixCaptures: buttonProduction.rows.length,
    productionButtonRefDistinctScreenshots:
      buttonProduction.distinctScreenshotHashes,
    productionPaletteBaseCaptured: paletteProduction.rows.filter(
      (row) => row.status === "CAPTURED",
    ).length,
    productionPaletteVariantSizeAxesCaptured: capturedPaletteAxes,
    productionPaletteVariantSizeRepeatabilityAxes:
      paletteAxesRepeatability.rows.length,
    productionStateOriginsCaptured: stateOrigins.rows.length,
    productionStateVariantRefsCaptured: stateOrigins.origins.filter(
      (entry) => entry.role === "variant-ref",
    ).length,
    productionStateBaseOriginsCaptured: stateOrigins.origins.filter(
      (entry) => entry.role === "base-origin",
    ).length,
    productionStateOriginRepeatability: stateOriginRepeatability.rows.length,
    systemSubpartTypesPresent: systemSubparts.summary.typesPresent,
    systemSubpartTypesAbsent: systemSubparts.summary.typesAbsent,
    systemSubpartTypesWithRootCanvasFixture:
      systemSubparts.summary.typesWithExistingRootCanvasFixture,
    systemChildSceneRoots: systemChildScene.summary.roots,
    systemChildSceneContexts: systemChildScene.summary.childContexts,
    systemChildTypesWithScene: systemChildScene.summary.typesWithScene.length,
    systemChildTypesWithLayout: systemChildScene.summary.typesWithLayout.length,
    unlistedSimpleCommandsCaptured: unlistedSimple.rows.length,
    unlistedSimpleRepeatability: unlistedSimpleRepeatability.rows.length,
    unlistedSimpleZeroNonwhite: unlistedSimple.rows
      .filter((row) => row.pixelEvidence.nonWhite === 0)
      .map((row) => row.type),
    unlistedCompositeCommandsCaptured: unlistedComposite.rows.length,
    unlistedCompositeRepeatability: unlistedCompositeRepeatability.rows.length,
    oldKnownMissingOriginTypes: ["Modal"],
    systemRootRefsCaptured: systemRootRefs.rows.filter(
      (row) => row.status === "CAPTURED",
    ).length,
    systemRootRefsRejected: systemRootRefs.rows.filter(
      (row) => row.status === "REJECTED_BY_OLD_STORE",
    ).length,
    systemRootRefRepeatability: systemRootRefRepeatability.rows.length,
    sectionHostContextsCaptured: sectionHosts.rows.length,
    sectionHostRepeatability: sectionHostRepeatability.rows.length,
    productionPaletteRepeatabilityTypes:
      paletteProductionRepeatability.rows.length,
    productionPaletteBaseZeroNonwhite: paletteProduction.rows
      .filter((row) => row.pixelEvidence?.nonWhite === 0)
      .map((row) => row.type),
    oldNativeStateCases: nativeState.afterRefresh.length,
    sweptPaletteEntries: paletteSweep.rows.length,
    sweptPaletteCreatedWithLayout: paletteSweep.rows.filter(
      (row) => row.status === "CREATED_WITH_LAYOUT",
    ).length,
    factoryOnlyAliasesOrLegacyEntries:
      creationAudit.factoryOnlyDispositions.length,
    requiredTypeAxes: types.reduce(
      (count, entry) => count + entry.requiredAxes.length,
      0,
    ),
    typesWithOldCanvasBaseline: types.filter((entry) =>
      entry.oldBaseline.some((item) => item.surface === "Canvas live"),
    ).length,
    typesWithOldProductionCanvasBaseline: types.filter((entry) =>
      entry.oldBaseline.some((item) => item.surface === "Canvas production"),
    ).length,
    typesWithAnyOldCanvasBaseline: types.filter((entry) =>
      entry.oldBaseline.some((item) => item.surface.startsWith("Canvas ")),
    ).length,
    typesWithOldDomUnitBaseline: types.filter((entry) =>
      entry.oldBaseline.some((item) => item.surface === "isolated DOM unit"),
    ).length,
    typesWithIndirectParentContextOnly: types.filter(
      (entry) => entry.oldFixtureCoverage === "INDIRECT_PARENT_CONTEXT_ONLY",
    ).length,
    typesWithKnownOldFailure: types.filter(
      (entry) => entry.oldFixtureCoverage === "KNOWN_OLD_FAILURE",
    ).length,
    typesMissingOldFixtureDisposition: types.filter(
      (entry) => entry.oldFixtureCoverage === "MISSING",
    ).length,
    slotRoles: slotRoles.length,
  },
  types,
  slotRoles,
};
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
writeFileSync(
  resolve(process.argv[outIndex + 1]),
  `${JSON.stringify(manifest, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(manifest.summary)}\n`);

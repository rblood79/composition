import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import prettier from "prettier";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const baseline = JSON.parse(
  readFileSync(
    resolve(root, "docs/adr/design/248-baseline/coverage-manifest.json"),
    "utf8",
  ),
);
const freeze = JSON.parse(
  readFileSync(
    resolve(root, "docs/adr/design/248-baseline/scenario-freeze-audit.json"),
    "utf8",
  ),
);
const structural = JSON.parse(
  readFileSync(
    resolve(root, "docs/adr/design/248-phase3-structural-new.json"),
    "utf8",
  ),
);
const nativeState = JSON.parse(
  readFileSync(
    resolve(root, "docs/adr/design/248-phase3-native-state-new.json"),
    "utf8",
  ),
);
const oldSlotTrace = JSON.parse(
  readFileSync(
    resolve(root, "docs/adr/design/248-phase3-slot-old-trace.json"),
    "utf8",
  ),
);
if (
  structural.scenarioId !== "adr248-structural-baseline-v1" ||
  nativeState.scenarioId !== "adr248-old-native-state-v1" ||
  oldSlotTrace.scenarioHash !== structural.scenarioHash
)
  throw new Error("PHASE3_COVERAGE_SCENARIO_MISMATCH");
const fixtureDefinitions = new Map([
  ["frame", "lib:definition:frame"],
  ["Group", "lib:definition:group"],
  ["Slot", "lib:definition:slot"],
  ["Text", "lib:definition:text"],
]);
const cases = baseline.types.map((entry) => ({
  type: entry.type,
  sourceRegistration: entry.registrations,
  sourceVisualRule: entry.visualRule
    ? "COMPONENT_RULES_TABLE"
    : "NO_TABLE_RULE",
  requiredAxes: entry.requiredAxes,
  oldFixtureCoverage: entry.oldFixtureCoverage,
  oldBaselineCount: entry.oldBaseline.length,
  fixtureDefinitionId: fixtureDefinitions.get(entry.type) ?? null,
  missing: [
    ...(!fixtureDefinitions.has(entry.type) ? ["TYPED_DEFINITION"] : []),
    "CANVASKIT_BINDING",
    "ISOLATED_RAC_BINDING",
    "AXIS_PARITY",
  ],
  newPublicCommand: "NOT_RUN",
  geometry: "UNVERIFIED",
  canvasPixels: "UNVERIFIED",
  isolatedDomSemantic: "UNVERIFIED",
  g3: "UNVERIFIED",
}));
const representative = {
  frame: {
    geometry: "PASS_G0_BASE_AND_NATIVE_STATE_3_OF_3",
    canvasPixels: `PARTIAL_NATIVE_CLIP_SAMPLE_3_OF_3; FAIL_${structural.renderCommandScene.exactPngDifferentPixels}_OF_248000_RENDER_COMMAND_SCENE`,
    fullSceneClip:
      "PARTIAL_RENDER_COMMAND_FRAME_CLIP; RAC_DOM_HIT_3_OF_3; DOM_PNG_UNVERIFIED",
    isolatedDomClip: "PASS_G0_NATIVE_VISIBLE_OUTSIDE_1_HIDDEN_OUTSIDE_2",
  },
  Group: {
    geometry:
      "FAIL_OLD_NUMERIC_PARITY: horizontal old(2,42) new(58,2); vertical old(2,42) new(2,54); ADR_ROW_COLUMN_AND_SIZE_GAP_CORRECTION",
    isolatedDomSemantic: "PASS_G0_NATIVE_STATIC_MARKUP_2_OF_2",
    actualRacLayout: "PASS_HORIZONTAL_ROW_GAP6_VERTICAL_COLUMN_GAP12_ARIA",
  },
  Slot: {
    geometry: oldSlotTrace.before.canonicalHasProps
      ? "UNVERIFIED_OLD_SLOT_SOURCE_CHANGED"
      : "FAIL_OLD_NULL_NEW_PRESENT; old legacy-slot lacks props and is omitted from scene",
    isolatedDomSemantic: "PASS_G0_NATIVE_STATIC_MARKUP_2_OF_2",
  },
  Text: {
    geometry: "PASS_G0_SINGLE_BASE_CASE",
    canvasPixels: `PARTIAL_REAL_RENDER_COMMAND_TEXT_PAINT_1; COMPOSITE_SCENE_FAIL_${structural.renderCommandScene.exactPngDifferentPixels}_OF_248000`,
  },
};
for (const entry of cases) {
  if (representative[entry.type]) {
    entry.representative = {
      ...representative[entry.type],
      scenarioId: "adr248-structural-baseline-v1",
      evidence: [
        "docs/adr/design/248-phase3-structural-new.json",
        "docs/adr/design/248-phase3-structural-render-commands.png",
        "docs/adr/design/248-phase3-slot-old-trace.json",
        ...(entry.type === "frame" || entry.type === "Group"
          ? ["docs/adr/design/248-phase3-native-state-new.json"]
          : []),
        "apps/builder/tests/parity/adr248CatalogRealDom.browser.test.ts",
        ...(entry.type === "Group" || entry.type === "Slot"
          ? ["docs/adr/design/248-phase3-native-dom-comparison.json"]
          : []),
      ],
      ...(entry.type === "Group" || entry.type === "Slot"
        ? { nativeDomScenarioId: "adr248-native-dom-unit-v1" }
        : {}),
      fullAxisParity: "UNVERIFIED",
    };
    entry.newPublicCommand = "RUN_FROZEN_G0_INPUT_IN_INDEPENDENT_TYPED_DRIVER";
    if (entry.type === "Group")
      entry.g3 = "FAIL_OLD_NUMERIC_GEOMETRY_KNOWN_DEFECT_CORRECTION";
    if (entry.type === "Slot")
      entry.g3 = "FAIL_OLD_NULL_NEW_PRESENT_NO_EXEMPTION";
  }
}
const slotRoles = baseline.slotRoles.map((entry) => ({
  role: entry.role,
  oldBaselineCount: entry.oldBaseline.length,
  typedRegionName: entry.role,
  missing: ["ROLE_SEMANTIC_BINDING", "ROLE_VISUAL_PARITY"],
  newPublicCommand: "NOT_RUN",
  geometry: "UNVERIFIED",
  canvasPixels: "UNVERIFIED",
  isolatedDomSemantic: "UNVERIFIED",
  g3: "UNVERIFIED",
}));
const output = {
  sourceHead: freeze.head,
  sourceBuildIndexSha256: freeze.source.buildIndexSha256,
  viewport: freeze.source.viewport,
  dpr: freeze.source.dpr,
  theme: freeze.source.theme,
  font: freeze.source.font,
  seed: freeze.source.seed,
  scope: "Phase 3 independent comparison; Preview/Compare DEFERRED",
  summary: {
    registeredTypeCases: cases.length,
    requiredTypeAxes: cases.reduce(
      (count, entry) => count + entry.requiredAxes.length,
      0,
    ),
    slotRoles: slotRoles.length,
    g3Passed: 0,
    g3Failed: cases.filter((entry) => entry.g3.startsWith("FAIL")).length,
    g3Unverified:
      cases.filter((entry) => entry.g3 === "UNVERIFIED").length +
      slotRoles.length,
    actualRenderCommandRepresentativeTypes: 4,
    actualRacRepresentativeTypes: 4,
    fullSceneExactDifferentPixels:
      structural.renderCommandScene.exactPngDifferentPixels,
    fullScenePixelParity: "FAIL",
    executionModuleParity: "UNVERIFIED_DEV_SERVER_VS_VITEST",
    typedFixtureDefinitionsInManifest: cases.filter(
      (entry) => entry.fixtureDefinitionId,
    ).length,
    missingTypedDefinitions: cases.filter((entry) => !entry.fixtureDefinitionId)
      .length,
    missingCanvasKitBindings: cases.length,
    missingIsolatedRacBindings: cases.length,
    representativeCasesWithPartialEvidence: Object.keys(representative).length,
    g0NativeStaticSemanticCasesPassed: 4,
    g0NativeFrameGeometryCasesPassed: 3,
    g0NativeFrameCanvasKitSamplePixelsPassed: 3,
    g0NativeGroupNumericCasesFailed: 2,
  },
  pencil: [
    {
      fixture: "sample-minimal.pen",
      fields: {
        version: "exchange.version",
        children: "page.children",
        id: "node.id",
        type: "definitionId",
        name: "node.name",
        fill: "node.visual.fill",
        text: "node.props.children",
      },
      result: "DIRECT_MEANING_ROUNDTRIP_PASS",
    },
    {
      fixture: "sample-slots.pen",
      fields: {
        slot: "node.regions",
        clip: "node.visual.overflow",
        placeholder: "node.placeholder",
        name: "node.name",
      },
      result: "DIRECT_MEANING_ROUNDTRIP_PASS",
    },
    {
      fixture: "sample-ref.pen",
      fields: {
        reusable: "project.definition+templateRootId",
        ref: "node.definitionId",
        slot: "node.regions",
      },
      result: "DIRECT_MEANING_ROUNDTRIP_PASS",
    },
    {
      fixture: "sample-descendants.pen",
      fields: {
        descendants: "typed descendantOverride candidate",
        children: "template children candidate",
      },
      result: "BLOCKED_MISSING_TARGET_PATH",
      missing: [
        "icon target absent from source reusable",
        "footer target absent from source reusable",
      ],
    },
    {
      fixture: "sample-imports.pen",
      fields: {
        imports: "external library dependency candidate",
        ref: "typed definition ID candidate",
      },
      result: "BLOCKED_MISSING_EXTERNAL_LIBRARY",
      missing: [
        "./kit.pen is not supplied",
        "external definition resolution policy",
      ],
    },
  ],
  highRisk: [
    "Frame fill/border/overflow",
    "Group orientation/ARIA",
    "Slot empty/filled/description",
    "named regions",
    "selectedHover/selectedPressed",
    "Tree indentation",
    "Slider thumb size",
    "collection/Table/date/color/chart",
  ].map((name) => ({
    name,
    status:
      name === "Group orientation/ARIA"
        ? "FAIL_OLD_NUMERIC_GEOMETRY; NEW_ROW_COLUMN_GAP_ARIA_OBSERVED"
        : name === "Slot empty/filled/description"
          ? "FAIL_OLD_NULL_NEW_PRESENT; RAC_PARTIAL"
          : [
                "Frame fill/border/overflow",
                "Slot empty/filled/description",
              ].includes(name)
            ? "PARTIAL_REPRESENTATIVE"
            : "UNVERIFIED",
    baselineException: false,
  })),
  types: cases,
  slotRoles,
};
const target = resolve(root, "docs/adr/design/248-phase3-coverage.json");
writeFileSync(
  target,
  await prettier.format(JSON.stringify(output), { parser: "json" }),
);
console.log(JSON.stringify(output.summary));

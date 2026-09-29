#!/usr/bin/env node
// ADR-248 G0: distinguish old-app comparison inputs from later new-app assertions.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import assert from "node:assert/strict";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const dir = resolve(root, "docs/adr/design/248-baseline");
const read = (path) => JSON.parse(readFileSync(resolve(dir, path), "utf8"));
const manifest = read("coverage-manifest.json");
const routeOracle = read("descendant-route-oracle.json");
if (
  routeOracle.oldOutput.publicClonePasteDetach?.writer?.duplicateCount !== 1 ||
  routeOracle.oldOutput.publicClonePasteDetach?.writer?.pastedCount !== 1 ||
  routeOracle.oldOutput.publicClonePasteDetach?.writer?.detached !== true ||
  routeOracle.oldOutput.publicDescendantResetHistory?.reader?.before !==
    "Ordered label" ||
  routeOracle.oldOutput.publicDescendantResetHistory?.reader?.undo !==
    "Ordered label" ||
  routeOracle.oldOutput.publicDescendantResetHistory?.reader?.redo !== "Button"
)
  throw new Error("G2 old edit/history oracle is incomplete");
const breakdownPath =
  "docs/adr/design/248-unified-catalog-document-breakdown.md";
const breakdownLines = readFileSync(resolve(root, breakdownPath), "utf8").split(
  "\n",
);
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const hash = (value) => createHash("sha256").update(value).digest("hex");
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
const sourceHasher = createHash("sha256");
for (const path of sourcePaths)
  sourceHasher
    .update(path)
    .update("\0")
    .update(readFileSync(resolve(root, path)))
    .update("\0");
const sourceDigest = sourceHasher.digest("hex");
const artifactPaths = [
  ...manifest.oldFixtures.map((entry) => entry.path),
  "descendant-active/baseline.json",
  "descendant-route-oracle.json",
  "binding-switch/baseline.json",
  "layout-slots-pinned.json",
  "dom-native-pinned.json",
  "native-state-pinned/baseline.json",
  "system-child-visual-pinned.json",
  "visual-combos/baseline.json",
  "storage-surface/oracle/baseline.json",
  "save-failure-isolated.json",
  "pen-interchange-pinned.json",
];
if (
  manifest.oldFixtures.length !== 24 ||
  new Set(artifactPaths).size !== artifactPaths.length
)
  throw new Error("Existing 24 fixture inventory changed");
const artifacts = artifactPaths.map((path) => {
  const value = read(path);
  if (
    value.head !== head ||
    hash(JSON.stringify(value.scenario)) !== value.scenarioHash
  )
    throw new Error(`${path}: HEAD/scenario hash changed`);
  const isProduction =
    path.includes("production") ||
    [
      "modal-missing-origin/baseline.json",
      "palette-variant-size/baseline.json",
      "system-subpart-coverage.json",
    ].includes(path);
  const actualProductionBuild =
    isProduction && value.buildIndexSha256 === manifest.source.buildIndexSha256;
  const identifiedDevSource =
    typeof value.executionBuildIdentity === "string" &&
    value.executionBuildIdentity.startsWith("dev-source:");
  const identifiedIsolatedSource =
    typeof value.executionBuildIdentity === "string" &&
    value.executionBuildIdentity.startsWith("old-source-modules:") &&
    value.executionClass === "ISOLATED_OLD_MODULE_ORACLE";
  if (identifiedDevSource || identifiedIsolatedSource)
    assert.equal(
      value.executionBuildIdentity.split(":")[1],
      sourceDigest,
      `${path}: old source fingerprint drift`,
    );
  if (identifiedDevSource) {
    const indexDigest =
      value.servedIndexSha256 ??
      value.executionBuildIdentity.split(":index:")[1];
    assert.match(
      indexDigest ?? "",
      /^[a-f0-9]{64}$/,
      `${path}: served dev index identity absent`,
    );
    assert.equal(value.scenario.seed, 248, `${path}: seed drift`);
    assert.equal(value.scenario.dpr, 1, `${path}: DPR drift`);
    assert.deepEqual(
      value.scenario.viewport,
      { width: 1440, height: 900 },
      `${path}: viewport drift`,
    );
    assert.deepEqual(
      value.runtimeEnvironment?.viewport,
      value.scenario.viewport,
      `${path}: actual viewport drift`,
    );
    assert.equal(value.runtimeEnvironment?.dpr, 1, `${path}: actual DPR drift`);
    assert.equal(
      value.runtimeEnvironment?.fontLoadStatus ?? value.fontState?.loadStatus,
      "loaded",
      `${path}: font not loaded`,
    );
    const theme = value.runtimeEnvironment?.theme;
    assert.equal(
      theme === "default-light" ||
        (theme?.themeId === "theme-default" && theme?.darkMode === "light"),
      true,
      `${path}: theme drift`,
    );
  }
  if (identifiedIsolatedSource)
    assert.match(
      value.visualEnvironment ?? "",
      /^NOT_APPLICABLE_TO_/,
      `${path}: isolated surface applicability absent`,
    );
  const isIsolated =
    identifiedIsolatedSource ||
    /isolated|pure|dom-native/.test(
      manifest.oldFixtures.find((entry) => entry.path === path)?.surface ?? "",
    );
  return {
    path,
    scenarioId: value.scenario.id,
    scenarioHash: value.scenarioHash,
    executionHead: value.head,
    executionBuildIdentity: actualProductionBuild
      ? value.buildIndexSha256
      : identifiedDevSource
        ? value.servedIndexSha256
          ? `${value.executionBuildIdentity}:index:${value.servedIndexSha256}`
          : value.executionBuildIdentity
        : identifiedIsolatedSource
          ? value.executionBuildIdentity
          : null,
    recordedProductionBuildReference: value.buildIndexSha256 ?? null,
    executionClass: actualProductionBuild
      ? "OLD_PRODUCTION_BUILD"
      : identifiedDevSource
        ? "OLD_DEV_SOURCE_FINGERPRINT"
        : identifiedIsolatedSource
          ? "ISOLATED_OLD_MODULE_ORACLE"
          : isIsolated
            ? "ISOLATED_OLD_ORACLE"
            : "OLD_DEV_BUILD_ID_UNVERIFIED",
    viewport: value.scenario.viewport ?? null,
    actualViewport: value.runtimeEnvironment?.viewport ?? null,
    dpr: value.scenario.dpr ?? null,
    actualDpr: value.runtimeEnvironment?.dpr ?? null,
    font: value.scenario.font ?? null,
    fontLoadStatus: value.fontState?.loadStatus ?? null,
    theme: value.scenario.theme ?? null,
    actualTheme: value.runtimeEnvironment?.theme ?? null,
    seed: value.scenario.seed ?? null,
    hasSemanticOutput: Boolean(
      value.semanticTree ||
      value.rows ||
      value.observations ||
      value.observed ||
      value.oldOutput ||
      value.reader ||
      value.filled ||
      value.slots ||
      value.fixtures ||
      value.html,
    ),
    hasGeometryOutput: Boolean(
      value.geometry ||
      value.describedSlot?.geometry ||
      value.oldOutput?.after?.geometry ||
      value.viewportState?.layout ||
      value.rows?.some?.((row) => row.geometry || row.layout),
    ),
    hasScreenshotOutput: Boolean(
      value.screenshots ||
      value.pngSha256 ||
      value.rows?.some?.(
        (row) =>
          JSON.stringify(row).includes("pngSha256") ||
          JSON.stringify(row).includes("screenshotSha256") ||
          Boolean(row.screenshot?.sha256),
      ),
    ),
    errors: value.errors ?? [],
  };
});
// New comparison inputs must be real old outputs, with their image/export bytes pinned.
const binding = read("binding-switch/baseline.json");
const responsibility = read("field-responsibility-disposition.json");
const oldDefinitionOverride = responsibility.coreRows.find(
  (row) => row.key === "CompositionDocument.componentRules",
);
assert.equal(oldDefinitionOverride.currentUse, "FUTURE_OVERRIDE_HOOK");
assert.equal(oldDefinitionOverride.currentWriter, null);
assert.match(oldDefinitionOverride.sourceDisposition, /no old public writer/);
assert.equal(
  binding.oldOutput.after?.binding?.collectionId,
  "adr248-bound-collection",
);
assert.equal(
  binding.oldOutput.switchedBack?.persistedCollection?.rows?.[0]?.label,
  "Alpha",
);
assert.equal(binding.oldOutput.refreshed?.collection, null); // observed old in-memory reload gap
for (const [key, name] of Object.entries({
  after: "after.png",
  refreshed: "after-refresh.png",
  switchedBack: "after-switch.png",
}))
  assert.equal(
    hash(readFileSync(resolve(dir, `binding-switch/${name}`))),
    binding.screenshots[key],
  );
const slots = read("layout-slots-pinned.json");
const dom = read("dom-native-pinned.json");
const native = read("native-state-pinned/baseline.json");
assert.equal(slots.describedSlot?.description, "첫째 줄\n둘째 줄");
assert.equal(dom.observations.slotEmptyHasDescription, true);
assert.equal(dom.observations.slotFilledHasPlaceholder, false);
assert.equal(
  slots.slots?.find((item) => item.name === "content")?.required,
  true,
);
for (const [key, name] of Object.entries({
  default: "layout-slots-pinned.png",
  description: "layout-slots-pinned-description.png",
  filled: "layout-slots-pinned-filled.png",
}))
  assert.equal(hash(readFileSync(resolve(dir, name))), slots.screenshots[key]);
assert.equal(native.observations.length, 5);
assert.equal(native.afterRefresh.length, 5);
assert.equal(
  hash(readFileSync(resolve(dir, "native-state-pinned/canvas.png"))),
  native.screenshots.before,
);
assert.equal(
  hash(
    readFileSync(resolve(dir, "native-state-pinned/canvas-after-refresh.png")),
  ),
  native.screenshots.afterRefresh,
);
const children = read("system-child-visual-pinned.json");
assert.equal(children.summary.childContexts, 91);
assert.equal(children.rows.length, 34);
assert.deepEqual(children.summary.rootsRejectedByOldStore, ["component-radio"]);
assert.deepEqual(children.summary.missingScenePaths, [
  "adr248-child-scene-component-menu-section/Header",
]);
for (const row of children.rows.filter((item) => item.status === "AUTHORED"))
  assert.equal(
    hash(
      readFileSync(
        resolve(dir, `system-child-visual-pinned-png/${row.rootId}.png`),
      ),
    ),
    row.screenshot.sha256,
  );
const visual = read("visual-combos/baseline.json");
assert.equal(visual.rows.length, 6);
for (const row of visual.rows) {
  assert.equal(row.status, "AUTHORED");
  assert.ok(row.geometry?.width > 0 && row.geometry?.height > 0);
  assert.equal(
    hash(
      readFileSync(resolve(dir, `visual-combos/canvas/${row.semanticId}.png`)),
    ),
    row.pngSha256,
  );
}
for (const [path, expectedTypes] of [
  [
    "section-host-production/baseline.json",
    ["GridListSection", "ListBoxSection", "MenuSection"],
  ],
  ["unlisted-composite-production/baseline.json", ["ColorPicker", "Toast"]],
]) {
  const production = read(path);
  const folder = path.split("/")[0];
  assert.deepEqual(
    production.rows.map((row) => row.sectionType ?? row.type).sort(),
    expectedTypes,
  );
  for (const row of production.rows) {
    assert.equal(row.status, "CAPTURED");
    assert.equal(
      hash(readFileSync(resolve(dir, folder, row.screenshot))),
      row.pngSha256,
    );
  }
}
assert.equal(routeOracle.oldOutput.table.reader.columns[0].key, "column1");
const storage = read("storage-surface/oracle/baseline.json");
assert.deepEqual(storage.oldOutput.before, storage.oldOutput.refreshed);
assert.deepEqual(storage.oldOutput.before, storage.oldOutput.switchedBack);
assert.deepEqual(storage.oldOutput.before, storage.oldOutput.imported);
assert.equal(storage.oldOutput.afterEdit.memory, "After export");
assert.equal(storage.oldOutput.folder.status, "synced");
assert.equal(
  hash(
    readFileSync(
      resolve(dir, "storage-surface/oracle/old-export.composition.zip"),
    ),
  ),
  storage.oldOutput.exported.sha256,
);
const failure = read("save-failure-isolated.json");
assert.equal(failure.oldOutput.rejectionMessage, "storage failure");
assert.equal(failure.oldOutput.capturedDocumentIdentityPreserved, true);
assert.equal(
  failure.oldOutput.currentProjectAfterFailure,
  "adr248-failure-second",
);
const pen = read("pen-interchange-pinned.json");
assert.equal(pen.summary.fixtures, 5);
assert.equal(pen.oldPublicCommandStatus, "UNREACHABLE_NO_PRODUCT_CALLER");
assert.deepEqual(pen.productReferences, [
  "apps/builder/src/adapters/pencil/index.ts",
  "apps/builder/src/adapters/pencil/pencilExport.ts",
  "apps/builder/src/adapters/pencil/pencilImport.ts",
]);
assert.equal(
  pen.fixtures.every(
    (item) => item.status === "OLD_INTERCHANGE_ROUNDTRIP_PASS",
  ),
  true,
);
const byPath = new Map(artifacts.map((item) => [item.path, item]));
const scenario = (
  id,
  gate,
  evidence,
  missingOldOracle,
  laterVerification,
  access = "OLD_APP_ALLOWED",
) => {
  for (const path of evidence)
    if (!byPath.has(path)) throw new Error(`${id}: fixture ${path} missing`);
  const basisNeedle =
    access === "PREVIEW_FORBIDDEN" ? "Preview/Compare 금지 방침" : `| ${gate} `;
  const basisLine = breakdownLines.findIndex((line) =>
    line.includes(basisNeedle),
  );
  if (basisLine < 0) throw new Error(`${id}: ADR basis missing`);
  return {
    id,
    gate,
    access,
    adrBasis: { path: breakdownPath, line: basisLine + 1 },
    evidence: evidence.map((path) => ({
      path,
      scenarioHash: byPath.get(path).scenarioHash,
      executionClass: byPath.get(path).executionClass,
    })),
    missingOldOracle,
    oldOracleStatus:
      access === "PREVIEW_FORBIDDEN"
        ? "DEFERRED"
        : missingOldOracle.length
          ? "PARTIAL"
          : "FROZEN_FOR_STATED_SCOPE",
    comparisonScriptStatus:
      access === "PREVIEW_FORBIDDEN"
        ? "DEFERRED_BY_SURFACE_POLICY"
        : missingOldOracle.length
          ? "INPUT_SEQUENCE_OR_OUTPUT_NOT_YET_FROZEN"
          : "FROZEN_FROM_OLD_FIXTURE",
    laterVerification,
  };
};
const scenarios = [
  scenario(
    "G1-basic-types-and-refs",
    "G1",
    [
      "baseline.json",
      "button/baseline.json",
      "button-production-ref/baseline.json",
      "descendant-active/baseline.json",
      "descendant-route-oracle.json",
    ],
    [],
    "new typed tree, cycle/dangling validator and invalid transaction behavior",
  ),
  scenario(
    "G1-patch-null-remove-precedence",
    "G1",
    [
      "descendant-precedence.json",
      "descendant-active/baseline.json",
      "descendant-route-oracle.json",
    ],
    [],
    "new resolver precedence",
  ),
  scenario(
    "G2-edit-history",
    "G2",
    [
      "leaf-value/baseline.json",
      "page-authoring/baseline.json",
      "node-fields/baseline.json",
      "descendant-route-oracle.json",
    ],
    [],
    "new atomic edit/inverse/history/revision",
  ),
  scenario(
    "G2-library-override-and-binding",
    "G2",
    [
      "core-active-flow/baseline.json",
      "nonvisual-runtime-output.json",
      "descendant-route-oracle.json",
      "binding-switch/baseline.json",
    ],
    [],
    "new library override and H1 binding history",
  ),
  scenario(
    "G3-native-frame-group-slot",
    "G3",
    [
      "native-state/baseline.json",
      "layout-slots.json",
      "dom-native.json",
      "native-state-pinned/baseline.json",
      "layout-slots-pinned.json",
      "dom-native-pinned.json",
    ],
    [],
    "new Canvas/DOM geometry and pixel parity",
  ),
  scenario(
    "G3-registered-types-variants-states",
    "G3",
    [
      "palette-production-base/baseline.json",
      "palette-variant-size/baseline.json",
      "state-origins-production/baseline.json",
      "system-subpart-coverage.json",
      "system-child-scene.json",
      "system-child-visual-pinned.json",
      "visual-combos/baseline.json",
      "unlisted-simple-production/baseline.json",
      "unlisted-composite-production/baseline.json",
      "modal-missing-origin/baseline.json",
      "system-root-ref-production/baseline.json",
      "section-host-production/baseline.json",
    ],
    [],
    "new registered component parity; known old defects are not exemptions",
  ),
  scenario(
    "G3-modal-known-old-failure",
    "G3",
    ["modal-missing-origin/baseline.json"],
    [],
    "new Modal definition must create valid content or reject explicitly; no old defect parity exemption",
  ),
  scenario(
    "G3-named-regions-collections-table",
    "G3",
    [
      "section-host-production/baseline.json",
      "system-child-scene.json",
      "descendant-route-oracle.json",
      "binding-switch/baseline.json",
      "visual-combos/baseline.json",
      "unlisted-composite-production/baseline.json",
    ],
    [],
    "new named region and collection parity",
  ),
  scenario(
    "G4-save-load-export-import",
    "G4",
    [
      "leaf-value/baseline.json",
      "node-fields/baseline.json",
      "core-active-flow/baseline.json",
      "descendant-active/baseline.json",
      "descendant-route-oracle.json",
      "storage-surface/oracle/baseline.json",
      "save-failure-isolated.json",
    ],
    [],
    "new graph save/load, rejection and failure atomicity",
  ),
  scenario(
    "G4-external-pen",
    "G4",
    ["nonvisual-runtime-output.json", "pen-interchange-pinned.json"],
    [],
    "new external Pen exchange",
    "OLD_PUBLIC_COMMAND_UNREACHABLE_SOURCE_PROVED",
  ),
  scenario(
    "G3-G4-preview-iframe",
    "G3/G4",
    [],
    ["Preview/Compare live capture prohibited by current surface policy"],
    "new allowed DOM unit and iframe stale/gap checks after policy allows",
    "PREVIEW_FORBIDDEN",
  ),
];
// Earlier unverified dev captures stay in the inventory as context. These are
// the explicit, build-identified old inputs used by the later comparison.
const comparisonOraclePaths = {
  "G1-basic-types-and-refs": [
    "button-production-ref/baseline.json",
    "descendant-route-oracle.json",
  ],
  "G1-patch-null-remove-precedence": [
    "descendant-active/baseline.json",
    "descendant-route-oracle.json",
  ],
  "G2-edit-history": ["descendant-route-oracle.json"],
  "G2-library-override-and-binding": ["binding-switch/baseline.json"],
  "G3-native-frame-group-slot": [
    "native-state-pinned/baseline.json",
    "layout-slots-pinned.json",
    "dom-native-pinned.json",
  ],
  "G3-registered-types-variants-states": [
    "palette-variant-size/baseline.json",
    "state-origins-production/baseline.json",
    "system-child-visual-pinned.json",
    "visual-combos/baseline.json",
    "unlisted-simple-production/baseline.json",
    "unlisted-composite-production/baseline.json",
    "section-host-production/baseline.json",
  ],
  "G3-modal-known-old-failure": ["modal-missing-origin/baseline.json"],
  "G3-named-regions-collections-table": [
    "section-host-production/baseline.json",
    "descendant-route-oracle.json",
    "binding-switch/baseline.json",
    "visual-combos/baseline.json",
    "unlisted-composite-production/baseline.json",
  ],
  "G4-save-load-export-import": [
    "descendant-route-oracle.json",
    "storage-surface/oracle/baseline.json",
    "save-failure-isolated.json",
  ],
  "G4-external-pen": ["pen-interchange-pinned.json"],
  "G3-G4-preview-iframe": [],
};
assert.deepEqual(
  Object.keys(comparisonOraclePaths).sort(),
  scenarios.map((item) => item.id).sort(),
);
for (const item of scenarios) {
  const oraclePaths = comparisonOraclePaths[item.id];
  assert.equal(
    item.access === "PREVIEW_FORBIDDEN" || oraclePaths.length > 0,
    true,
  );
  for (const path of oraclePaths) {
    assert.equal(
      item.evidence.some((entry) => entry.path === path),
      true,
      `${item.id}: missing oracle evidence ${path}`,
    );
    const artifact = byPath.get(path);
    assert.ok(
      artifact.executionBuildIdentity,
      `${item.id}: unpinned oracle ${path}`,
    );
    assert.equal(
      artifact.errors.length,
      0,
      `${item.id}: old browser errors ${path}`,
    );
    assert.equal(
      artifact.hasSemanticOutput,
      true,
      `${item.id}: no old semantic output ${path}`,
    );
  }
  item.comparisonOraclePaths = oraclePaths;
  if (item.id === "G2-library-override-and-binding")
    item.oldInputDisposition = {
      projectDefinitionOverride: "UNREACHABLE_NO_OLD_PUBLIC_WRITER",
      source:
        "field-responsibility-disposition.json#CompositionDocument.componentRules",
      laterGate: "G1/G2",
    };
  item.evidence = item.evidence.map((entry) => ({
    ...entry,
    role: oraclePaths.includes(entry.path)
      ? "COMPARISON_ORACLE"
      : "CONTEXT_ONLY",
  }));
}
const report = {
  head,
  source: manifest.source,
  status: scenarios.some((item) => item.oldOracleStatus === "PARTIAL")
    ? "OLD_ARTIFACTS_RETAINED; COMPARISON_ORACLE_GAPS_EXPLICIT"
    : "OLD_ARTIFACTS_RETAINED; ALLOWED_OLD_COMPARISON_ORACLES_FROZEN",
  summary: {
    originalOldArtifacts: manifest.oldFixtures.length,
    addedOldArtifacts: artifactPaths.length - manifest.oldFixtures.length,
    totalOldArtifacts: artifacts.length,
    identifiedComparisonOracleArtifacts: new Set(
      scenarios.flatMap((item) => item.comparisonOraclePaths),
    ).size,
    scenarioFamilies: scenarios.length,
    frozenForStatedScope: scenarios.filter(
      (item) => item.oldOracleStatus === "FROZEN_FOR_STATED_SCOPE",
    ).length,
    partial: scenarios.filter((item) => item.oldOracleStatus === "PARTIAL")
      .length,
    deferred: scenarios.filter((item) => item.oldOracleStatus === "DEFERRED")
      .length,
    productionExecutionBuildIdentified: artifacts.filter(
      (item) => item.executionClass === "OLD_PRODUCTION_BUILD",
    ).length,
    devSourceFingerprintIdentified: artifacts.filter(
      (item) => item.executionClass === "OLD_DEV_SOURCE_FINGERPRINT",
    ).length,
    isolatedSourceFingerprintIdentified: artifacts.filter(
      (item) => item.executionClass === "ISOLATED_OLD_MODULE_ORACLE",
    ).length,
    devExecutionBuildUnverified: artifacts.filter(
      (item) => item.executionClass === "OLD_DEV_BUILD_ID_UNVERIFIED",
    ).length,
  },
  artifacts,
  scenarios,
};
const index = process.argv.indexOf("--out");
if (index < 0 || !process.argv[index + 1])
  throw new Error("--out requires path");
writeFileSync(
  resolve(process.argv[index + 1]),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(report.summary)}\n`);

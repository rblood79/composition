#!/usr/bin/env node
// ADR-248 G0: verify that the old format's responsibilities and comparison
// inputs have a frozen, explicit disposition before new product code runs.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const dir = resolve(root, "docs/adr/design/248-baseline");
const read = (name) => JSON.parse(readFileSync(resolve(dir, name), "utf8"));
const inventory = read("inventory.json");
const core = read("core-field-matrix.json");
const coreFlow = read("core-field-flow-audit.json");
const scenarioScope = read("scenario-output-scope.json");
const expanded = read("field-matrix.json");
const visualValues = read("visual-value-source.json");
const visualRuntime = read("visual-runtime-output.json");
const visualRuntimeRepeatability = read(
  "visual-runtime-output-repeatability.json",
);
const nonvisualRuntime = read("nonvisual-runtime-output.json");
const nonvisualRuntimeRepeatability = read(
  "nonvisual-runtime-output-repeatability.json",
);
const adjacent = read("adjacent-public-surfaces.json");
const consumers = read("consumer-disposition.json");
const retirement = read("retirement-inventory.json");
const descendantWrites = read("descendant-write-audit.json");
const descendantCallers = read("descendant-caller-audit.json");
const descendantTransitive = read("descendant-transitive-audit.json");
const descendantPrecedence = read("descendant-precedence.json");
const descendantPrecedenceRepeatability = read(
  "descendant-precedence-repeatability.json",
);
const descendantSites = read("descendant-site-disposition.json");
const descendantRoutes = read("descendant-route-closure.json");
const descendantActive = read("descendant-active/baseline.json");
const descendantActiveRepeatability = read(
  "descendant-active/repeatability.json",
);
const fieldResponsibility = read("field-responsibility-disposition.json");
const scenarioFreeze = read("scenario-freeze-audit.json");
const pen = read("pen-interchange.json");
const penRepeatability = read("pen-interchange-repeatability.json");
const leafValue = read("leaf-value/baseline.json");
const leafValueRepeatability = read("leaf-value/repeatability.json");
const coreFieldDefaults = read("core-field-defaults/baseline.json");
const coreFieldDefaultsRepeatability = read(
  "core-field-defaults/repeatability.json",
);
const pageAuthoring = read("page-authoring/baseline.json");
const pageAuthoringRepeatability = read("page-authoring/repeatability.json");
const nodeFields = read("node-fields/baseline.json");
const nodeFieldsRepeatability = read("node-fields/repeatability.json");
const coreActiveFlow = read("core-active-flow/baseline.json");
const coreActiveFlowRepeatability = read("core-active-flow/repeatability.json");
const manifest = read("coverage-manifest.json");
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const fail = (message) => {
  throw new Error(`G0: ${message}`);
};
const assert = (value, message) => {
  if (!value) fail(message);
};

const checks = [];
const check = (name, verify, evidence) => {
  verify();
  checks.push({ name, status: "PASS", evidence });
};
check(
  "ADR-243 종료 후 HEAD와 Builder build 고정",
  () => {
    assert(head === inventory.baselineHead, "inventory HEAD changed");
    assert(manifest.source.baselineHead === head, "manifest HEAD changed");
    const buildHash = createHash("sha256")
      .update(readFileSync(resolve(root, "apps/builder/dist/index.html")))
      .digest("hex");
    assert(
      buildHash === manifest.source.buildIndexSha256,
      "frozen Builder build changed",
    );
  },
  ["inventory.json", "coverage-manifest.json", "apps/builder/dist/index.html"],
);
check(
  "현재 문서 interface 전체의 새 책임 분류",
  () => {
    const classified = new Set([
      ...Object.keys(inventory.fieldMapping),
      ...inventory.unmappedInterfaces,
      ...Object.keys(inventory.verifiedRetiredInterfaces),
      ...Object.keys(inventory.verifiedLegacyRetiredInterfaces),
      ...Object.keys(inventory.verifiedOldRootRetiredInterfaces),
    ]);
    assert(
      classified.size === inventory.exportedInterfaces.length,
      "interface overlap",
    );
    assert(
      inventory.exportedInterfaces.every((item) => classified.has(item.name)),
      "unclassified exported interface",
    );
    assert(core.summary.fields === 51, "core field count changed");
    assert(
      coreFlow.head === head &&
        coreFlow.summary.fields === 51 &&
        coreFlow.summary.sourceRouteRows === 46 &&
        coreFlow.summary.activeReaderOutputFields === 7 &&
        coreFlow.summary.fieldSpecificConsumerOutputsVerified === 0 &&
        scenarioScope.head === head &&
        scenarioScope.summary.fields === 51 &&
        scenarioScope.summary.scenarios === 9 &&
        scenarioScope.summary.completeScenarios === 0,
      "core source routes or scenario output scope changed",
    );
    assert(
      expanded.summary.oldRuntimeValuesVerified === 98 &&
        visualRuntime.summary.authoredRuntimeValues === 98 &&
        visualRuntime.summary.noCurrentTableValue === 4 &&
        visualRuntime.summary.withAggregateOldCanvas === 87 &&
        visualRuntime.summary.withGeneratedCss === 94,
      "old visual resolver values changed",
    );
    assert(
      visualRuntimeRepeatability.independentRuns === 2 &&
        visualRuntimeRepeatability.byteIdentical &&
        visualRuntimeRepeatability.baselineSha256 ===
          createHash("sha256")
            .update(readFileSync(resolve(dir, "visual-runtime-output.json")))
            .digest("hex"),
      "old visual resolver repeat diverged",
    );
    assert(expanded.summary.fields === 121, "expanded field count changed");
    assert(
      expanded.summary.nonvisualOldRuntimeWitnesses === 12 &&
        nonvisualRuntime.summary.fields === 19 &&
        nonvisualRuntime.summary.dispositionOnly === 7 &&
        nonvisualRuntime.head === head,
      "old nonvisual witness count changed",
    );
    assert(
      nonvisualRuntimeRepeatability.independentRuns === 2 &&
        nonvisualRuntimeRepeatability.byteIdentical &&
        nonvisualRuntimeRepeatability.baselineSha256 ===
          createHash("sha256")
            .update(readFileSync(resolve(dir, "nonvisual-runtime-output.json")))
            .digest("hex"),
      "old nonvisual witness repeat diverged",
    );
    assert(visualValues.baselineHead === head, "visual values HEAD changed");
    assert(
      visualValues.summary.fields === 102,
      "visual value field count changed",
    );
    assert(
      visualValues.summary.fieldsWithClassifiedConsumer === 102,
      "visual consumer route unclassified",
    );
    assert(
      visualValues.summary.fieldsWithTableValue === 98,
      "visual table values changed",
    );
    assert(
      adjacent.summary.interfaces === 17,
      "adjacent interface count changed",
    );
    assert(adjacent.summary.fields === 68, "adjacent field count changed");
    for (const report of [core, expanded, adjacent])
      assert(report.baselineHead === head, "field matrix HEAD changed");
    for (const row of [
      ...core.entries,
      ...expanded.entries,
      ...adjacent.rows,
    ]) {
      assert(row.proposedDestination, `${row.key}: destination missing`);
      assert(row.plannedGates?.length, `${row.key}: gate missing`);
      assert(
        (
          row.currentFamilyPaths ??
          row.currentConsumerPaths ??
          row.currentConsumerFamilyPaths
        )?.length,
        `${row.key}: current consumer family missing`,
      );
    }
    assert(
      inventory.exportedTypeAliases.every(
        (item) => item.destination && item.destination !== "UNCLASSIFIED",
      ),
      "unclassified exported type alias",
    );
  },
  [
    "core-field-matrix.json",
    "core-field-flow-audit.json",
    "scenario-output-scope.json",
    "field-matrix.json",
    "visual-value-source.json",
    "visual-runtime-output.json",
    "adjacent-public-surfaces.json",
  ],
);
check(
  "H1 별도 data SSOT와 H2 library 참조 경계",
  () => {
    for (const field of ["collections", "api_endpoints", "variables"]) {
      const row = adjacent.rows.find(
        (item) => item.key === `DatabaseAdapter.${field}`,
      );
      assert(
        row?.disposition === "RETAIN_H1_DATA_STORE",
        `${field} H1 owner changed`,
      );
    }
    for (const field of ["events", "actions"]) {
      const row = adjacent.rows.find(
        (item) => item.key === `DatabaseAdapter.${field}`,
      );
      assert(
        row?.disposition === "REMOVE_DOCUMENT_MIRROR",
        `${field} mirror owner changed`,
      );
    }
    assert(
      inventory.fieldMapping.CompositionDocument.componentRules ===
        "project.definitionOverrides",
      "library snapshot ownership changed",
    );
  },
  ["inventory.json", "adjacent-public-surfaces.json"],
);
check(
  "소비자와 삭제 후보의 소유 범위 고정",
  () => {
    assert(consumers.baselineHead === head, "consumer HEAD changed");
    assert(consumers.summary.files === 526, "consumer inventory changed");
    assert(
      consumers.summary.missingOwnerOrGate === 0,
      "consumer owner missing",
    );
    assert(
      consumers.summary.publishFollowUpFiles === 3,
      "Publish boundary changed",
    );
    assert(retirement.baselineHead === head, "retirement HEAD changed");
    assert(
      retirement.summary.builderOldModuleCandidates === 126,
      "retirement list changed",
    );
    assert(
      retirement.summary.nativeSpecDefinitions === 3,
      "native spec list changed",
    );
  },
  ["consumer-disposition.json", "retirement-inventory.json"],
);
check(
  "명시적 자손 writer와 편집 우선순위 분류",
  () => {
    assert(descendantWrites.head === head, "descendant audit HEAD changed");
    assert(descendantWrites.summary.routes === 37, "descendant routes changed");
    assert(
      descendantWrites.summary.paths === 31,
      "descendant source paths changed",
    );
    assert(
      descendantWrites.summary.astCandidateSites === 65,
      "descendant AST candidates changed",
    );
    assert(
      descendantWrites.summary.missingAstFiles.length === 0,
      "AST candidate file unclassified",
    );
    assert(
      descendantWrites.summary.missingInventoryFiles.length === 0,
      "explicit descendant writer unclassified",
    );
    assert(
      descendantWrites.precedence.length === 4,
      "precedence plan incomplete",
    );
    assert(descendantCallers.head === head, "descendant caller HEAD changed");
    assert(
      descendantCallers.summary.writeSites === 115 &&
        descendantCallers.summary.writeFiles === 29 &&
        descendantCallers.summary.directCalls === 40 &&
        descendantCallers.summary.unclassified === 0,
      "descendant caller/write AST set changed",
    );
    assert(
      descendantTransitive.head === head &&
        descendantTransitive.summary.tracedTransitiveRoutes === 5 &&
        descendantTransitive.summary.inputsWithRuntimeResult === 6 &&
        descendantTransitive.summary.routesWithoutRuntimeOutput.length === 3,
      "descendant transitive sample changed",
    );
    assert(
      descendantPrecedence.oldOutput.modeA.props.children === "patched" &&
        descendantPrecedence.oldOutput.modeC.ownedProps.children === "edited" &&
        descendantPrecedence.oldOutput.noOwnedSlotFallback ===
          "mode A caller path" &&
        descendantPrecedence.oldOutput.rejected.length === 2,
      "old descendant precedence output changed",
    );
    assert(
      descendantPrecedenceRepeatability.independentRuns === 2 &&
        descendantPrecedenceRepeatability.byteIdentical &&
        descendantPrecedenceRepeatability.baselineSha256 ===
          createHash("sha256")
            .update(readFileSync(resolve(dir, "descendant-precedence.json")))
            .digest("hex"),
      "old descendant precedence repeat diverged",
    );
  },
  [
    "descendant-ast-sites.json",
    "descendant-write-audit.json",
    "descendant-caller-audit.json",
    "descendant-transitive-audit.json",
    "descendant-precedence.json",
  ],
);
check(
  "등록 type·상태 축·slot과 구 앱 fixture 처분 고정",
  () => {
    assert(manifest.summary.typeUniverse === 130, "type universe changed");
    assert(manifest.summary.requiredTypeAxes === 1333, "visual axes changed");
    assert(manifest.summary.slotRoles === 14, "slot roles changed");
    assert(
      manifest.summary.typesMissingOldFixtureDisposition === 0,
      "type fixture disposition missing",
    );
    assert(
      manifest.summary.typesWithAnyOldCanvasBaseline === 96 &&
        manifest.summary.typesWithIndirectParentContextOnly === 33 &&
        manifest.summary.typesWithKnownOldFailure === 1,
      "old fixture disposition changed",
    );
    assert(
      manifest.summary.systemChildTypesWithScene === 33,
      "child scene missing",
    );
    for (const entry of manifest.types) {
      assert(entry.requiredAxes.length > 0, `${entry.type}: no visual axis`);
      assert(
        entry.scenarioDriver.oldBuilderMode !== "UNCLASSIFIED",
        `${entry.type}: no driver`,
      );
      if (entry.oldFixtureCoverage === "DIRECT_OLD_CANVAS")
        assert(
          entry.oldBaseline.length > 0,
          `${entry.type}: direct fixture missing`,
        );
      if (entry.oldFixtureCoverage === "INDIRECT_PARENT_CONTEXT_ONLY") {
        assert(
          entry.indirectParentCanvasFixtures.length > 0,
          `${entry.type}: parent fixture missing`,
        );
        assert(
          entry.oldChildSceneContexts.some((item) => item.scenePresent),
          `${entry.type}: old child scene missing`,
        );
      }
      for (const fixture of entry.oldBaseline)
        assert(
          existsSync(resolve(dir, fixture.fixture)),
          `${entry.type}: missing ${fixture.fixture}`,
        );
    }
  },
  ["coverage-manifest.json", "system-child-scene.json"],
);
check(
  "포맷 독립 구 앱 scenario 및 성능·저장 baseline 고정",
  () => {
    assert(
      manifest.oldFixtures.length >= 24,
      "old scenario inventory incomplete",
    );
    for (const fixture of manifest.oldFixtures) {
      const result = read(fixture.path);
      assert(result.head === head, `${fixture.path}: HEAD changed`);
      assert(
        result.scenarioHash === fixture.scenarioHash,
        `${fixture.path}: scenario changed`,
      );
      assert(
        result.scenario.id === fixture.scenarioId,
        `${fixture.path}: scenario ID changed`,
      );
      assert(result.scenario.seed === 248, `${fixture.path}: seed changed`);
      assert(result.scenario.dpr === 1, `${fixture.path}: DPR changed`);
      assert(
        result.scenario.theme === "default-light",
        `${fixture.path}: theme changed`,
      );
    }
    for (const name of [
      "storage.json",
      "save-load.json",
      "perf-prod-60-1x.json",
      "perf-prod-60-4x.json",
      "perf-prod-600-1x.json",
      "perf-prod-600-4x.json",
      "perf-prod-5000-1x.json",
      "perf-prod-5000-4x.json",
    ]) {
      const result = read(name);
      assert(
        (result.head ?? result.baselineHead) === head,
        `${name}: HEAD changed`,
      );
    }
    assert(
      leafValue.scenario.id === "adr248-old-leaf-value-v1",
      "leaf scenario changed",
    );
    assert(
      leafValue.before.canonical?.text === "초안",
      "leaf old input changed",
    );
    assert(
      leafValue.refreshed.canonical?.text === "확정",
      "leaf refresh output changed",
    );
    assert(
      leafValue.persisted?.afterRefreshText === "확정",
      "leaf IDB output changed",
    );
    assert(
      leafValue.persisted?.revisionChangedOnEdit,
      "leaf edit revision unchanged",
    );
    assert(
      leafValueRepeatability.independentRuns === 2,
      "leaf repeat count changed",
    );
    assert(leafValueRepeatability.byteIdentical, "leaf repeat diverged");
    assert(
      leafValueRepeatability.baselineSha256 ===
        createHash("sha256")
          .update(readFileSync(resolve(dir, "leaf-value/baseline.json")))
          .digest("hex"),
      "leaf baseline bytes changed",
    );
    assert(
      coreFieldDefaults.summary.fields === 51,
      "core old field output missing",
    );
    assert(
      coreFieldDefaults.summary.fieldsPresent === 24,
      "core old defaults changed",
    );
    assert(
      coreFieldDefaultsRepeatability.independentRuns === 2 &&
        coreFieldDefaultsRepeatability.byteIdentical,
      "core old field output repeat diverged",
    );
    assert(
      coreFieldDefaultsRepeatability.baselineSha256 ===
        createHash("sha256")
          .update(
            readFileSync(resolve(dir, "core-field-defaults/baseline.json")),
          )
          .digest("hex"),
      "core old field output bytes changed",
    );
    assert(
      pageAuthoring.scenario.id === "adr248-old-page-authoring-v1",
      "page authoring scenario changed",
    );
    assert(
      pageAuthoring.refreshed.direction === "horizontal" &&
        pageAuthoring.persisted.gap === 96 &&
        pageAuthoring.refreshed.columns === 2 &&
        pageAuthoring.persisted.placement?.style?.left === 48 &&
        pageAuthoring.refreshed.guides?.[0]?.position === 120,
      "page authoring output changed",
    );
    assert(
      pageAuthoringRepeatability.independentRuns === 2 &&
        pageAuthoringRepeatability.byteIdentical &&
        pageAuthoringRepeatability.screenshotsIdentical === 2,
      "page authoring repeat diverged",
    );
    assert(
      pageAuthoringRepeatability.baselineSha256 ===
        createHash("sha256")
          .update(readFileSync(resolve(dir, "page-authoring/baseline.json")))
          .digest("hex"),
      "page authoring bytes changed",
    );
    assert(
      nodeFields.scenario.id === "adr248-old-node-fields-v1" &&
        JSON.stringify(nodeFields.input) === JSON.stringify(nodeFields.after) &&
        JSON.stringify(nodeFields.after) ===
          JSON.stringify(nodeFields.persisted) &&
        JSON.stringify(nodeFields.after) ===
          JSON.stringify(nodeFields.refreshed),
      "node field roundtrip changed",
    );
    assert(
      nodeFieldsRepeatability.independentRuns === 2 &&
        nodeFieldsRepeatability.byteIdentical &&
        nodeFieldsRepeatability.observedOldFields.length === 8 &&
        nodeFieldsRepeatability.baselineSha256 ===
          createHash("sha256")
            .update(readFileSync(resolve(dir, "node-fields/baseline.json")))
            .digest("hex"),
      "node field repeat diverged",
    );
    assert(
      coreActiveFlow.head === head &&
        coreActiveFlow.buildIndexSha256 === manifest.source.buildIndexSha256 &&
        coreActiveFlow.fontState.loadStatus === "loaded" &&
        coreActiveFlow.after.ref.descendants.Label.children === "G0 label" &&
        coreActiveFlow.reader.mobileLayout.gap === 44 &&
        coreActiveFlow.reader.mobilePlacement.left === 15 &&
        coreActiveFlow.reader.theme.tint === "#112233" &&
        coreActiveFlow.reader.interaction[0].id === "flow-event" &&
        JSON.stringify(coreActiveFlow.after) ===
          JSON.stringify(coreActiveFlow.refreshed) &&
        coreActiveFlowRepeatability.independentRuns === 2 &&
        coreActiveFlowRepeatability.byteIdentical &&
        coreActiveFlowRepeatability.screenshotsIdentical === 2 &&
        coreActiveFlowRepeatability.baselineSha256 ===
          createHash("sha256")
            .update(
              readFileSync(resolve(dir, "core-active-flow/baseline.json")),
            )
            .digest("hex"),
      "core active old-app output changed",
    );
  },
  [
    "coverage-manifest.json",
    "leaf-value/baseline.json",
    "core-field-defaults/baseline.json",
    "page-authoring/baseline.json",
    "node-fields/baseline.json",
    "core-active-flow/baseline.json",
    "storage.json",
    "save-load.json",
    "perf-prod-*.json",
  ],
);
check(
  "외부 Pencil 교환 기준선 고정",
  () => {
    assert(pen.head === head, "Pencil baseline HEAD changed");
    assert(
      pen.oldDocumentSerialized === false,
      "old document leaked into Pencil oracle",
    );
    assert(pen.summary.fixtures === 5, "Pencil fixture set changed");
    assert(
      pen.summary.withDescendants === 2,
      "Pencil descendant fixtures changed",
    );
    assert(
      penRepeatability.independentRuns === 2,
      "Pencil repeat count changed",
    );
    assert(penRepeatability.byteIdentical, "Pencil repeat diverged");
    assert(
      penRepeatability.baselineSha256 === penRepeatability.repeatSha256 &&
        penRepeatability.baselineSha256 ===
          createHash("sha256")
            .update(readFileSync(resolve(dir, "pen-interchange.json")))
            .digest("hex"),
      "Pencil baseline hash changed",
    );
  },
  ["pen-interchange.json", "pen-interchange-repeatability.json"],
);

assert(
  fieldResponsibility.head === head &&
    fieldResponsibility.summary.core === 51 &&
    fieldResponsibility.summary.extended === 121 &&
    fieldResponsibility.summary.adjacent === 68,
  "current field responsibility inventory changed",
);
assert(
  descendantSites.head === head &&
    descendantSites.summary.totalSites === 155 &&
    descendantSites.summary.unclassified === 0,
  "descendant AST disposition changed",
);
assert(
  descendantRoutes.head === head &&
    descendantRoutes.summary.activeRoutes ===
      descendantSites.summary.activeRoutes.length,
  "active descendant route set changed",
);
assert(
  descendantRoutes.routes.every(
    (route) =>
      route.caller?.line && route.writer?.line && route.oldReader?.line,
  ),
  "active descendant source chain incomplete",
);
assert(
  descendantRoutes.summary.routesWithWriterAndReaderOutput === 13 &&
    descendantRoutes.summary.sourceOnlyRoutes.length === 0,
  "active descendant old writer-reader output incomplete",
);
assert(
  descendantActive.head === head &&
    descendantActive.executionBuildIdentity?.startsWith("dev-source:") &&
    descendantActive.runtimeEnvironment?.viewport?.width === 1440 &&
    descendantActive.runtimeEnvironment?.viewport?.height === 900 &&
    descendantActive.runtimeEnvironment?.dpr === 1 &&
    descendantActive.runtimeEnvironment?.theme?.themeId === "theme-default" &&
    descendantActive.runtimeEnvironment?.theme?.darkMode === "light" &&
    descendantActive.fontState.loadStatus === "loaded",
  "old descendant runtime identity missing",
);
assert(
  descendantActive.after.list.description.enabled === false &&
    descendantActive.reader.listItems[0].childNames.length === 2,
  "old slot role output missing",
);
assert(
  descendantActive.reader.iconLabel.fills[0].color === "#ABCDEF80" &&
    descendantActive.reader.iconLabel.style.borderColor === "#ABCDEF",
  "old presentation output missing",
);
assert(
  descendantActive.resetAccepted &&
    JSON.stringify(descendantActive.afterReset) ===
      JSON.stringify(descendantActive.resetRefreshed),
  "old reset/refresh output missing",
);
assert(
  descendantActive.isolatedStoreProbe.oldReader.modeB.some(
    (node) => node.type === "Heading",
  ) &&
    descendantActive.isolatedStoreProbe.oldReader.modeC.some(
      (node) => node.type === "Text",
    ) &&
    JSON.stringify(descendantActive.isolatedStoreProbe.afterCommand) ===
      JSON.stringify(descendantActive.isolatedStoreProbe.afterRefresh),
  "old mode B/C command output missing",
);
assert(
  descendantActive.isolatedResolver.nestedNull.style.color === undefined &&
    descendantActive.isolatedResolver.stateLayerComposition.fills[0].id ===
      "state-fill",
  "old nested/state precedence output missing",
);
assert(
  descendantActiveRepeatability.independentRuns === 2 &&
    descendantActiveRepeatability.byteIdentical &&
    descendantActiveRepeatability.baselineSha256 ===
      createHash("sha256")
        .update(readFileSync(resolve(dir, "descendant-active/baseline.json")))
        .digest("hex"),
  "old descendant repeatability changed",
);
assert(
  scenarioFreeze.head === head &&
    scenarioFreeze.summary.originalOldArtifacts === 24 &&
    scenarioFreeze.summary.addedOldArtifacts === 11 &&
    scenarioFreeze.summary.totalOldArtifacts === 35 &&
    scenarioFreeze.summary.identifiedComparisonOracleArtifacts === 18 &&
    scenarioFreeze.summary.scenarioFamilies === 11 &&
    scenarioFreeze.summary.deferred === 1,
  "old scenario inventory changed",
);
const partialScenarios = scenarioFreeze.scenarios.filter(
  (scenario) => scenario.oldOracleStatus === "PARTIAL",
);
const artifactByPath = new Map(
  scenarioFreeze.artifacts.map((artifact) => [artifact.path, artifact]),
);
const frozenEvidenceWithoutExecutionIdentity = scenarioFreeze.scenarios
  .filter((scenario) => scenario.oldOracleStatus === "FROZEN_FOR_STATED_SCOPE")
  .flatMap((scenario) =>
    scenario.comparisonOraclePaths.map((path) => artifactByPath.get(path)),
  )
  .filter(
    (artifact) =>
      !artifact?.executionBuildIdentity ||
      artifact.executionClass === "OLD_DEV_BUILD_ID_UNVERIFIED",
  )
  .map((artifact) => artifact.path);
const requiredG0 = [
  {
    name: "현재 필드·소비자·새 책임 분류",
    passed: fieldResponsibility.summary.unclassified === 0,
    evidence: "field-responsibility-disposition.json",
  },
  {
    name: "자손 AST 전수 처분과 활성 caller→writer→구 reader",
    passed:
      descendantSites.summary.unclassified === 0 &&
      descendantRoutes.summary.activeRoutes ===
        descendantSites.summary.activeRoutes.length,
    evidence: [
      "descendant-site-disposition.json",
      "descendant-route-closure.json",
    ],
  },
  {
    name: "허용 자손 입력의 구 값 oracle",
    passed: Boolean(
      descendantActive.isolatedStoreProbe.afterRefresh.modeB &&
      descendantActive.isolatedStoreProbe.afterRefresh.modeC &&
      descendantRoutes.summary.routesWithWriterAndReaderOutput === 13 &&
      descendantRoutes.summary.sourceOnlyRoutes.length === 0,
    ),
    evidence: [
      "descendant-active/baseline.json",
      "descendant-precedence.json",
      "descendant-route-closure.json",
      "descendant-route-oracle.json",
    ],
  },
  {
    name: "승인 비교 시나리오의 구 앱 입력·출력 freeze",
    passed: partialScenarios.length === 0,
    evidence: "scenario-freeze-audit.json",
  },
  {
    name: "freeze된 구 앱 실행 build 식별자",
    passed: frozenEvidenceWithoutExecutionIdentity.length === 0,
    evidence: "scenario-freeze-audit.json",
  },
];
const remainingG0 = [
  ...requiredG0
    .filter((item) => !item.passed)
    .map((item) => ({
      gate: item.name,
      evidence: item.evidence,
    })),
  ...partialScenarios.map((scenario) => ({
    scenarioId: scenario.id,
    adrBasis: scenario.adrBasis,
    missingOldOracle: scenario.missingOldOracle,
    evidence: scenario.evidence.map((item) => item.path),
  })),
  ...frozenEvidenceWithoutExecutionIdentity.map((path) => ({
    artifact: path,
    missingOldOracle: ["실제 구 앱 실행 build 식별자"],
  })),
];
const g0Passed = checks.length === 8 && requiredG0.every((item) => item.passed);
const readme = readFileSync(resolve(dir, "README.md"), "utf8");
assert(
  readme.includes(g0Passed ? "**G0 판정: PASS" : "**G0 판정: FAIL") &&
    readme.includes("**기존 분류 검사 8항목 PASS**") &&
    readme.includes("기존 **24개** 산출물") &&
    partialScenarios.every((scenario) => readme.includes(`\`${scenario.id}\``)),
  "README verdict, preserved artifact count or remaining scenario IDs differ from G0 gate",
);
const report = {
  head,
  status: g0Passed ? "G0_PASS" : "G0_CLASSIFICATION_CHECKS_PASS; G0_NOT_CLOSED",
  verdict: g0Passed ? "PASS" : "FAIL",
  phase1Eligible: false,
  phase1RequiresSeparateUserInstruction: true,
  checks,
  requiredG0,
  readmeConsistency: {
    verdictMatches: true,
    preservedOldArtifacts: 24,
    remainingScenarioIdsMatched: partialScenarios.length,
  },
  closureEvidence: {
    classificationChecksPassed: checks.length,
    coreFieldsClassified: core.summary.fields,
    coreFieldsWithOneOldActionSample: core.summary.oldSampleFields,
    coreFieldsWithPublicActionSample: core.summary.oldActionFields,
    coreFieldsWithSourceWriterAndReader: coreFlow.summary.sourceRouteRows,
    coreFieldsWithSelectedActiveReaderOutput:
      coreFlow.summary.activeReaderOutputFields,
    coreFieldsWithCompleteWriterReaderFlow: core.summary.fieldValueFlowVerified,
    extendedFieldsClassified: expanded.summary.fields,
    visualTableToResolverValuesFrozen:
      visualRuntime.summary.authoredRuntimeValues,
    visualFieldsWithAggregateCanvas:
      visualRuntime.summary.withAggregateOldCanvas,
    visualFieldsWithGeneratedCss: visualRuntime.summary.withGeneratedCss,
    nonvisualFieldsWithOldPureRuntimeWitness:
      nonvisualRuntime.summary.oldRuntimeWitnesses,
    extendedFieldsWithExecutedBehavior: expanded.summary.behaviorVerified,
    adjacentPublicFieldsClassified: adjacent.summary.fields,
    registeredTypesClassified: manifest.summary.typeUniverse,
    visualAxesEnumerated: manifest.summary.requiredTypeAxes,
    slotRolesClassified: manifest.summary.slotRoles,
    oldScenarioOutputsFrozen: manifest.oldFixtures.length,
    descendantSourceAnchorsClassified: descendantWrites.summary.routes,
    descendantAstWriteSites: descendantCallers.summary.writeSites,
    descendantDirectCalls: descendantCallers.summary.directCalls,
    descendantTransitiveRoutesSampled:
      descendantTransitive.summary.tracedTransitiveRoutes,
    descendantInputResultsSampled:
      descendantTransitive.summary.inputsWithRuntimeResult,
    scopedCoreOutputScenarios: scenarioScope.summary.scenarios,
    fieldResponsibilityUnclassified: fieldResponsibility.summary.unclassified,
    descendantSitesDisposed: descendantSites.summary.totalSites,
    descendantActiveRoutesLinked: descendantRoutes.summary.activeRoutes,
    descendantRoutesWithOldReaderOutput:
      descendantRoutes.summary.routesWithWriterAndReaderOutput,
    oldScenarioArtifacts: scenarioFreeze.summary.totalOldArtifacts,
    identifiedComparisonOracleArtifacts:
      scenarioFreeze.summary.identifiedComparisonOracleArtifacts,
    scenarioFamiliesFrozenForStatedScope:
      scenarioFreeze.summary.frozenForStatedScope,
    scenarioFamiliesPartial: scenarioFreeze.summary.partial,
    scenarioFamiliesDeferredBySurfacePolicy: scenarioFreeze.summary.deferred,
    devArtifactExecutionIdentityUnverified:
      scenarioFreeze.summary.devExecutionBuildUnverified,
  },
  baselineLimitations: [
    "core-active-flow runs old Builder dev; its dist/index.html hash identifies the frozen production artifact but does not prove that the dev-served runtime bytes equal that build",
    "G5 leak raw artifacts do not carry a HEAD field; they are observations, not a head-verified performance gate",
    "33 child types use parent Canvas PNG plus child scene/layout; per-child pixel and DOM parity belongs to G3",
    "field responsibility routes are classified; new graph behavior and field roundtrip belong to G1-G4",
    "all 13 active descendant routes have old writer-reader output; isolated UI planners and pure helpers are labeled separately from public Builder actions",
    "eleven prior dev artifacts lack their actual execution build identity and remain context only; explicit comparison oracle paths use pinned old production, dev source/index or isolated module identities",
    "Preview/Compare live is DEFERRED under the current surface policy; isolated DOM markup is not a live iframe result",
  ],
  remainingG0,
  deferredByGate: {
    G1: "typed entry/field validator, library override, reference resolution",
    G2: "atomic mutation, inverse history, clone/detach/slot editing",
    G3: "all registered state axes, child pixel and isolated DOM parity",
    G4: "new storage roundtrip and old format rejection",
    G5: "performance, storage, memory and bundle budgets",
    G6: "Builder canonical/spec import and module removal; Publish follows",
  },
};
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
writeFileSync(
  resolve(process.argv[outIndex + 1]),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${report.status}: ${checks.length} checks\n`);

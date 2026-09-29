#!/usr/bin/env node
// ADR-248 G0: connect the 51 mapped core fields to their old owner and future gate.
// Family paths establish routing only; per-field value flow is still unverified.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const inventory = JSON.parse(
  readFileSync(
    resolve(root, "docs/adr/design/248-baseline/inventory.json"),
    "utf8",
  ),
);
const leafPath = resolve(
  root,
  "docs/adr/design/248-baseline/leaf-value/baseline.json",
);
const leaf = JSON.parse(readFileSync(leafPath, "utf8"));
const leafRepeatability = JSON.parse(
  readFileSync(
    resolve(root, "docs/adr/design/248-baseline/leaf-value/repeatability.json"),
    "utf8",
  ),
);
const pagePath = resolve(
  root,
  "docs/adr/design/248-baseline/page-authoring/baseline.json",
);
const page = JSON.parse(readFileSync(pagePath, "utf8"));
const pageRepeatability = JSON.parse(
  readFileSync(
    resolve(
      root,
      "docs/adr/design/248-baseline/page-authoring/repeatability.json",
    ),
    "utf8",
  ),
);
const nodePath = resolve(
  root,
  "docs/adr/design/248-baseline/node-fields/baseline.json",
);
const nodeFields = JSON.parse(readFileSync(nodePath, "utf8"));
const nodeRepeatability = JSON.parse(
  readFileSync(
    resolve(
      root,
      "docs/adr/design/248-baseline/node-fields/repeatability.json",
    ),
    "utf8",
  ),
);
const activeFlowPath = resolve(
  root,
  "docs/adr/design/248-baseline/core-active-flow/baseline.json",
);
const activeFlow = JSON.parse(readFileSync(activeFlowPath, "utf8"));
const activeFlowRepeatability = JSON.parse(
  readFileSync(
    resolve(
      root,
      "docs/adr/design/248-baseline/core-active-flow/repeatability.json",
    ),
    "utf8",
  ),
);
const defaultPath = resolve(
  root,
  "docs/adr/design/248-baseline/core-field-defaults/baseline.json",
);
const defaults = JSON.parse(readFileSync(defaultPath, "utf8"));
const defaultsRepeatability = JSON.parse(
  readFileSync(
    resolve(
      root,
      "docs/adr/design/248-baseline/core-field-defaults/repeatability.json",
    ),
    "utf8",
  ),
);
const baselineHead = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (baselineHead !== inventory.baselineHead)
  throw new Error("Core field matrix uses another baseline HEAD");
if (
  defaults.head !== baselineHead ||
  defaults.scenario.id !== defaultsRepeatability.scenarioId ||
  defaults.summary.fields !== 51 ||
  defaults.summary.fieldsPresent !== 24 ||
  defaults.fields.length !== 51 ||
  !defaultsRepeatability.byteIdentical ||
  defaultsRepeatability.independentRuns !== 2 ||
  defaultsRepeatability.baselineSha256 !== defaultsRepeatability.repeatSha256 ||
  defaultsRepeatability.baselineSha256 !==
    createHash("sha256").update(readFileSync(defaultPath)).digest("hex") ||
  defaults.errors.length
)
  throw new Error(
    "Old core field default snapshot differs from the frozen output",
  );
const defaultByKey = new Map(defaults.fields.map((row) => [row.key, row]));
if (
  leaf.head !== baselineHead ||
  leaf.scenario.id !== leafRepeatability.scenarioId ||
  !leafRepeatability.byteIdentical ||
  leafRepeatability.independentRuns !== 2 ||
  leafRepeatability.baselineSha256 !== leafRepeatability.repeatSha256 ||
  leafRepeatability.baselineSha256 !==
    createHash("sha256").update(readFileSync(leafPath)).digest("hex") ||
  leaf.before.canonical?.text !== "초안" ||
  leaf.after.canonical?.text !== "확정" ||
  leaf.refreshed.canonical?.text !== "확정" ||
  leaf.refreshed.element?.text !== "확정" ||
  leaf.persisted.beforeText !== "초안" ||
  leaf.persisted.afterText !== "확정" ||
  leaf.persisted.afterRefreshText !== "확정" ||
  leaf.persisted.nodeId !== "adr248-leaf-value" ||
  leaf.persisted.nodeType !== "Text" ||
  !leaf.persisted.revisionChangedOnEdit ||
  leaf.errors.length
)
  throw new Error("Old Text leaf field sample differs from the frozen output");
if (
  page.head !== baselineHead ||
  page.scenario.id !== pageRepeatability.scenarioId ||
  !pageRepeatability.byteIdentical ||
  pageRepeatability.independentRuns !== 2 ||
  pageRepeatability.baselineSha256 !== pageRepeatability.repeatSha256 ||
  pageRepeatability.baselineSha256 !==
    createHash("sha256").update(readFileSync(pagePath)).digest("hex") ||
  page.after.direction !== "horizontal" ||
  page.refreshed.gap !== 96 ||
  page.persisted.columns !== 2 ||
  page.persisted.placement?.style?.left !== 48 ||
  page.refreshed.guides?.[0]?.position !== 120 ||
  page.errors.length
)
  throw new Error("Old page field sample differs from the frozen output");
if (
  nodeFields.head !== baselineHead ||
  nodeFields.scenario.id !== nodeRepeatability.scenarioId ||
  !nodeRepeatability.byteIdentical ||
  nodeRepeatability.independentRuns !== 2 ||
  nodeRepeatability.baselineSha256 !== nodeRepeatability.repeatSha256 ||
  nodeRepeatability.baselineSha256 !==
    createHash("sha256").update(readFileSync(nodePath)).digest("hex") ||
  JSON.stringify(nodeFields.input) !== JSON.stringify(nodeFields.after) ||
  JSON.stringify(nodeFields.after) !== JSON.stringify(nodeFields.persisted) ||
  JSON.stringify(nodeFields.after) !== JSON.stringify(nodeFields.refreshed) ||
  nodeFields.errors.length
)
  throw new Error("Old node field sample differs from the frozen output");
if (
  activeFlow.head !== baselineHead ||
  activeFlow.scenario.id !== activeFlowRepeatability.scenarioId ||
  activeFlowRepeatability.independentRuns !== 2 ||
  !activeFlowRepeatability.byteIdentical ||
  activeFlowRepeatability.baselineSha256 !==
    createHash("sha256").update(readFileSync(activeFlowPath)).digest("hex") ||
  activeFlowRepeatability.repeatSha256 !==
    activeFlowRepeatability.baselineSha256 ||
  JSON.stringify(activeFlow.after) !== JSON.stringify(activeFlow.refreshed) ||
  JSON.stringify(activeFlow.after) !==
    JSON.stringify(
      (({ hasRevision: _hasRevision, ...rest }) => rest)(activeFlow.persisted),
    ) ||
  activeFlow.reader.refResolved?.labels?.find((item) => item.name === "Label")
    ?.text !== "G0 label" ||
  activeFlow.fontState.loadStatus !== "loaded" ||
  activeFlow.errors.length
)
  throw new Error("Old core active flow differs from frozen output");

const oldSampleFields = new Map([
  [
    "CanonicalNode.id",
    { fixture: leaf, path: "leaf-value/baseline.json", valuePath: "id" },
  ],
  [
    "CanonicalNode.type",
    { fixture: leaf, path: "leaf-value/baseline.json", valuePath: "type" },
  ],
  [
    "CanonicalNode.props",
    {
      fixture: leaf,
      path: "leaf-value/baseline.json",
      valuePath: "props.children",
    },
  ],
  ...[
    ["CompositionDocument.pageLayout", "after.direction"],
    ["CompositionDocument.pageGuides", "after.guides"],
    ["PagePlacement.style", "after.placement.style"],
    ["PageLayoutSettingsDocument.direction", "after.direction"],
    ["PageLayoutSettingsDocument.gap", "after.gap"],
    ["PageLayoutSettingsDocument.columns", "after.columns"],
    ["PageLayoutSettingsDocument.placements", "after.placement"],
    ["PageGuideLine.id", "after.guides[0].id"],
    ["PageGuideLine.axis", "after.guides[0].axis"],
    ["PageGuideLine.position", "after.guides[0].position"],
  ].map(([key, valuePath]) => [
    key,
    { fixture: page, path: "page-authoring/baseline.json", valuePath },
  ]),
  ...nodeRepeatability.observedOldFields.map((key) => [
    key,
    {
      fixture: nodeFields,
      path: "node-fields/baseline.json",
      valuePath: `after.${key.split(".").at(-1)}`,
    },
  ]),
  ...[
    ["CanonicalNode.state", "after.child.state"],
    [
      "CanonicalNode.reusable",
      "after.origin.reusable",
      "old project library seed → document → IDB → refresh",
    ],
    ["CanonicalNode.children", "after.frame.childIds"],
    ["FrameNode.type", "after.frame.type"],
    ["FrameNode.clip", "after.frame.clip"],
    ["FrameNode.placeholder", "after.frame.placeholder"],
    ["RefNode.type", "after.ref.type"],
    ["RefNode.ref", "after.ref.ref"],
    ["RefNode.descendants", "after.ref.descendants.Label"],
    [
      "CompositionDocument.version",
      "after.version",
      "old project creation → document → IDB → refresh",
    ],
    ["CompositionDocument.themes", "after.themes"],
    [
      "CompositionDocument.children",
      "after.rootChildIds",
      "old project creation → document root IDs → IDB → refresh",
    ],
    ["CompositionDocument.events", "after.events"],
    ["ThemeDefinition.id", "after.themes.item.id"],
    ["ThemeDefinition.name", "after.themes.item.name"],
    ["ThemeDefinition.preset", "after.themes.item.preset"],
    ["ThemeDefinition.tokens", "after.themes.item.tokens"],
    ["ThemesCollection.active", "after.themes.active"],
    ["ThemesCollection.items", "after.themes.item"],
    ["ThemesCollection.order", "after.themes.order"],
    ["PagePlacement.responsive", "after.placementResponsive"],
    ["PageLayoutSettingsDocument.responsive", "after.layoutResponsive"],
    [
      "PageLayoutSettingsDocument.placementModel",
      "after.placementModel",
      "old project hydration → document → IDB → refresh",
    ],
  ].map(([key, valuePath, scope]) => [
    key,
    {
      fixture: activeFlow,
      path: "core-active-flow/baseline.json",
      valuePath,
      scope:
        scope ??
        "one old Builder public action sample → canonical document → IDB part → refresh",
    },
  ]),
]);

const families = {
  CanonicalNode: {
    oldOwner: "canonical document and node mutation",
    paths: [
      "apps/builder/src/builder/stores/canonical/canonicalDocumentStore.ts",
      "apps/builder/src/adapters/canonical/index.ts",
    ],
    gates: ["G1", "G2", "G3", "G4", "G6"],
  },
  FrameNode: {
    oldOwner: "frame adapter and Canvas projection",
    paths: [
      "apps/builder/src/adapters/canonical/frameMirror.ts",
      "apps/builder/src/adapters/canonical/frameElementScope.ts",
    ],
    gates: ["G1", "G2", "G3", "G4", "G6"],
  },
  RefNode: {
    oldOwner: "reusable reference resolution",
    paths: [
      "apps/builder/src/adapters/canonical/canonicalRefResolution.ts",
      "apps/builder/src/builder/utils/canonicalRefResolution.ts",
    ],
    gates: ["G1", "G2", "G3", "G4", "G6"],
  },
  CompositionDocument: {
    oldOwner: "document root, persistence, and hydration",
    paths: [
      "apps/builder/src/builder/stores/canonical/canonicalDocumentStore.ts",
      "apps/builder/src/builder/stores/inspectorActions.ts",
    ],
    gates: ["G1", "G2", "G4", "G6"],
  },
  ThemeDefinition: {
    oldOwner: "theme collection",
    paths: [
      "packages/shared/src/theme/themesCollection.ts",
      "apps/builder/src/adapters/canonical/themesAdapter.ts",
    ],
    gates: ["G1", "G3", "G4", "G6"],
  },
  ThemesCollection: {
    oldOwner: "theme collection",
    paths: [
      "packages/shared/src/theme/themesCollection.ts",
      "apps/builder/src/adapters/canonical/themesAdapter.ts",
    ],
    gates: ["G1", "G3", "G4", "G6"],
  },
  PagePlacement: {
    oldOwner: "page placement and history",
    paths: [
      "apps/builder/src/builder/stores/utils/pagePlacementCommit.ts",
      "apps/builder/src/builder/stores/utils/pageLayoutStorage.ts",
    ],
    gates: ["G1", "G2", "G3", "G4", "G6"],
  },
  PageLayoutSettingsDocument: {
    oldOwner: "page layout and history",
    paths: [
      "apps/builder/src/builder/stores/utils/pageLayoutStorage.ts",
      "apps/builder/src/builder/stores/canonical/canonicalDocumentStore.ts",
    ],
    gates: ["G1", "G2", "G3", "G4", "G6"],
  },
  PageGuideLine: {
    oldOwner: "page guide editing and history",
    paths: [
      "apps/builder/src/builder/workspace/canvas/viewport/pageGuideActions.ts",
      "apps/builder/src/builder/stores/canonical/canonicalDocumentStore.ts",
    ],
    gates: ["G1", "G2", "G3", "G4", "G6"],
  },
};
const entries = Object.entries(inventory.fieldMapping).flatMap(
  ([name, fields]) => {
    const declaration = inventory.exportedInterfaces.find(
      (item) => item.name === name,
    );
    const family = families[name];
    if (!declaration || !family)
      throw new Error(`${name}: missing declaration or family plan`);
    if (declaration.fields.length !== Object.keys(fields).length)
      throw new Error(`${name}: field count drift`);
    for (const path of family.paths)
      if (!existsSync(resolve(root, path)))
        throw new Error(`${name}: missing owner path ${path}`);
    return declaration.fields.map((field) => {
      const destination = fields[field.name];
      if (!destination) throw new Error(`${name}.${field.name}: unclassified`);
      const oldDefault = defaultByKey.get(`${name}.${field.name}`);
      if (!oldDefault)
        throw new Error(`${name}.${field.name}: old default output missing`);
      return {
        key: `${name}.${field.name}`,
        oldType: field.type,
        oldOptional: field.optional,
        sourcePath: "packages/shared/src/types/composition-document.types.ts",
        oldOwner: family.oldOwner,
        currentFamilyPaths: family.paths,
        proposedDestination: destination,
        plannedGates: family.gates,
        plannedScenario: `catalog-document/${name}/${field.name}`,
        plannedScenarioStatus: "NOT_IMPLEMENTED",
        fieldValueFlowStatus: "UNVERIFIED",
        oldDefaultEvidence: {
          scenarioId: defaults.scenario.id,
          oldOutput: "core-field-defaults/baseline.json",
          status: oldDefault.status,
          subjectCount: oldDefault.subjectCount,
          presentCount: oldDefault.presentCount,
        },
        ...(oldSampleFields.has(`${name}.${field.name}`)
          ? {
              oldSampleEvidence: {
                scenarioId: oldSampleFields.get(`${name}.${field.name}`).fixture
                  .scenario.id,
                scenarioHash: oldSampleFields.get(`${name}.${field.name}`)
                  .fixture.scenarioHash,
                oldOutput: oldSampleFields.get(`${name}.${field.name}`).path,
                valuePath: oldSampleFields.get(`${name}.${field.name}`)
                  .valuePath,
                scope:
                  oldSampleFields.get(`${name}.${field.name}`).scope ??
                  "one old Builder public action sample → canonical document → IDB part → refresh",
              },
            }
          : {}),
      };
    });
  },
);
const keys = entries.map((entry) => entry.key);
if (entries.length !== 51 || new Set(keys).size !== entries.length)
  throw new Error(`Expected 51 unique core fields, got ${entries.length}`);
const report = {
  baselineHead,
  status:
    "FAMILY_ROUTES_CLASSIFIED; per-field value flow and future gates UNVERIFIED",
  summary: {
    interfaces: Object.keys(families).length,
    fields: entries.length,
    missingDestinationOrFamilyOrGate: entries.filter(
      (entry) =>
        !entry.proposedDestination ||
        !entry.currentFamilyPaths.length ||
        !entry.plannedGates.length,
    ).length,
    fieldValueFlowVerified: entries.filter(
      (entry) => entry.fieldValueFlowStatus !== "UNVERIFIED",
    ).length,
    oldSampleFields: entries.filter((entry) => entry.oldSampleEvidence).length,
    oldActionFields: entries.filter((entry) =>
      entry.oldSampleEvidence?.scope.startsWith(
        "one old Builder public action",
      ),
    ).length,
    oldDefaultFieldsPresent: entries.filter(
      (entry) => entry.oldDefaultEvidence.presentCount > 0,
    ).length,
  },
  entries,
};
if (report.summary.missingDestinationOrFamilyOrGate)
  throw new Error("Core field matrix has an unclassified route");
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
writeFileSync(
  resolve(process.argv[outIndex + 1]),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(report.summary)}\n`);

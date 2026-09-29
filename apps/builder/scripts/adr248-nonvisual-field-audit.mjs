#!/usr/bin/env node
// ADR-248 G0: field-level route candidates for nonvisual public interfaces.
// A source edge proves a current path exists, not that a new graph validator is correct.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const baselineDir = resolve(root, "docs/adr/design/248-baseline");
const inventory = JSON.parse(
  readFileSync(resolve(baselineDir, "inventory.json"), "utf8"),
);
const paths = {
  types: "packages/shared/src/types/composition-document.types.ts",
  themes: "packages/shared/src/theme/themesCollection.ts",
  themeAdapter: "apps/builder/src/adapters/canonical/themesAdapter.ts",
  tokens: "apps/builder/src/adapters/canonical/variablesAdapter.ts",
  themeResolve: "apps/builder/src/utils/theme/resolveThemeSnapshot.ts",
  placementEdit:
    "apps/builder/src/builder/workspace/canvas/scene/pagePlacementEdit.ts",
  placementCommit:
    "apps/builder/src/builder/stores/utils/pagePlacementCommit.ts",
  bindingNormalize: "packages/shared/src/collections/normalizeDataBinding.ts",
  bindingItems: "packages/shared/src/collections/resolveCollectionItems.ts",
  bindingRender: "packages/shared/src/hooks/useCollectionData.tsx",
  bindingStore: "apps/builder/src/builder/stores/elements.ts",
  bindingRead: "packages/shared/src/utils/compositionExtensionFields.ts",
  documentStore:
    "apps/builder/src/builder/stores/canonical/canonicalDocumentStore.ts",
  elementsView:
    "apps/builder/src/builder/stores/canonical/canonicalElementsView.ts",
  propertyBinding:
    "apps/builder/src/builder/components/property/PropertyDataBinding.tsx",
  dataChange: "apps/builder/src/builder/stores/utils/dataChange.ts",
  apiCreator:
    "apps/builder/src/builder/panels/datatable/editors/ApiEndpointCreator.tsx",
  quickConnect:
    "apps/builder/src/builder/panels/datatable/utils/quickConnect.ts",
  tableRenderer: "packages/shared/src/renderers/TableRenderer.tsx",
};
const edge = (path, symbol) => ({ path: paths[path], symbol });
const routes = [];
const add = (family, field, disposition, writer, reader, newContract) =>
  routes.push({
    family,
    field,
    disposition,
    writer,
    reader,
    newContract,
    status: "CURRENT_ROUTE_CANDIDATE; NEW_VALIDATOR_UNVERIFIED",
  });

for (const field of ["tint", "darkMode", "neutral", "radiusScale"]) {
  add(
    "ThemeSnapshot",
    field,
    "RETAIN_PRESET_SEMANTIC; RETIRE_OLD_SNAPSHOT",
    edge("themeAdapter", `themeConfig.${field}`),
    edge("themes", `value.${field}`),
    `theme entry.preset.${field}`,
  );
}
add(
  "ThemeSnapshot",
  "customTokens",
  "RETIRE_LEGACY_MAP",
  null,
  edge("themes", "customTokensToDelta(rawThemes.customTokens, warnings)"),
  "typed theme token delta entries; reject old raw map on new import",
);
for (const field of ["type", "value", "source"]) {
  add(
    "TokensSnapshotEntry",
    field,
    "RETAIN_TOKEN_DELTA",
    edge(
      "tokens",
      `snapshot[key] = {\n      type: def.type,\n      value: def.value,\n      source: "user-defined",`,
    ),
    edge("themes", `current.${field} === entry.${field}`),
    `theme/root token delta.${field}`,
  );
}
for (const [field, styleField] of [
  ["x", "left"],
  ["y", "top"],
]) {
  add(
    "PagePositionPoint",
    field,
    "RUNTIME_INPUT_ONLY",
    edge("placementCommit", "point: PagePositionPoint"),
    edge("placementEdit", `${styleField}: Math.round(point.${field})`),
    `pageLayout.placements[pageId].style.${styleField}; no saved point`,
  );
}
add(
  "SerializedDataBinding",
  "type",
  "REPLACE_LEGACY_BINDING_SHAPE",
  edge("bindingStore", "nextProps.dataBinding = write.binding"),
  edge("bindingItems", 'dataBinding.type === "collection"'),
  "typed node binding kind and external store reference",
);
add(
  "SerializedDataBinding",
  "source",
  "REPLACE_LEGACY_BINDING_SHAPE",
  edge("bindingStore", "nextProps.dataBinding = write.binding"),
  edge("bindingItems", 'dataBinding.source === "static"'),
  "typed node binding source kind and external store ID",
);
add(
  "SerializedDataBinding",
  "config",
  "MOVE_INLINE_PAYLOAD_TO_H1_DATA_STORES",
  edge("bindingStore", "nextProps.dataBinding = write.binding"),
  edge("bindingRender", "dataBinding.config"),
  "collection/api store payload; graph keeps typed ID reference",
);
add(
  "SerializedDataBinding",
  "[index]",
  "REJECT_UNKNOWN_LEGACY_KEYS",
  null,
  edge("bindingRead", "return element.dataBinding as DataBinding"),
  "closed binding schema; unknown keys fail at import/transaction boundary",
);
for (const [field, disposition, newContract] of [
  ["events", "RETIRE_PER_NODE_LEGACY_PAYLOAD", "interaction graph entry"],
  ["actions", "RETIRE_PER_NODE_LEGACY_PAYLOAD", "interaction action entry"],
  ["dataBinding", "REPLACE_LEGACY_EXTENSION", "typed node binding reference"],
  ["editor", "MOVE_TO_EPHEMERAL_BUILDER_STATE", "nonpersisted editor state"],
]) {
  add(
    "CompositionExtension",
    field,
    disposition,
    edge("documentStore", "updateNodeExtension: (nodeId, patch) =>"),
    edge("documentStore", `extension.${field}`),
    newContract,
  );
}
add(
  "CompositionExtendedNode",
  '"x-composition"',
  "RETIRE_NAMESPACE_WRAPPER",
  edge("documentStore", 'updated["x-composition"] ='),
  edge("elementsView", ')["x-composition"]'),
  "typed node fields and separate interaction/editor owners",
);

const expected = Object.entries(inventory.fieldEvidence)
  .flatMap(([family, contract]) =>
    Object.keys(contract.fields).map((field) => `${family}.${field}`),
  )
  .sort();
const actual = routes.map(({ family, field }) => `${family}.${field}`).sort();
if (JSON.stringify(actual) !== JSON.stringify(expected))
  throw new Error("Nonvisual routes do not match the declared field evidence");
for (const route of routes) {
  if (!route.newContract)
    throw new Error(`Missing destination: ${route.family}.${route.field}`);
  for (const point of [route.writer, route.reader]) {
    if (!point) continue;
    if (!readFileSync(resolve(root, point.path), "utf8").includes(point.symbol))
      throw new Error(
        `${point.path}: ${route.family}.${route.field} edge missing ${point.symbol}`,
      );
  }
}
const report = {
  baselineHead: execFileSync("git", ["rev-parse", "HEAD"], {
    cwd: root,
    encoding: "utf8",
  }).trim(),
  status:
    "CURRENT_FIELD_ROUTE_CANDIDATES; new graph validators and behavior UNVERIFIED",
  fields: routes,
  dataAuthoringBoundary: {
    propertyBindingUi: "new bindings select a dataTable collection ID",
    collectionWriter:
      "DataChange create_collection writes the separate collections store",
    endpointWriter:
      "DataChange define_endpoint writes the separate api_endpoints store",
    legacyInlineReaders:
      "TableRenderer and useCollectionData still read static/API config",
    g1G4Obligation:
      "new node binding stores typed IDs; data store writers and history stay active; old inline config rejected with old format",
    edges: [
      edge("propertyBinding", 'source: "dataTable"'),
      edge("quickConnect", 'op: "create_collection"'),
      edge("quickConnect", 'op: "bind_element"'),
      edge("apiCreator", 'op: "define_endpoint"'),
      edge("dataChange", "const store = db.collections"),
      edge("dataChange", "const endpointsStore = db.api_endpoints"),
      edge("tableRenderer", 'dataBindingLegacy?.source === "api"'),
      edge("tableRenderer", 'dataBindingLegacy?.source === "static"'),
    ],
  },
  summary: {
    fields: routes.length,
    families: inventory.fieldEvidence
      ? Object.keys(inventory.fieldEvidence).length
      : 0,
    retiredOrReplacedLegacyFields: routes.filter((route) =>
      /RETIRE|REPLACE|MOVE|REJECT/.test(route.disposition),
    ).length,
    runtimeOnlyFields: routes.filter(
      (route) => route.disposition === "RUNTIME_INPUT_ONLY",
    ).length,
    retainedTokenFields: routes.filter(
      (route) => route.disposition === "RETAIN_TOKEN_DELTA",
    ).length,
  },
};
if (report.baselineHead !== inventory.baselineHead)
  throw new Error("Nonvisual field audit uses another baseline HEAD");
for (const point of report.dataAuthoringBoundary.edges) {
  if (!readFileSync(resolve(root, point.path), "utf8").includes(point.symbol))
    throw new Error(
      `${point.path}: data authoring edge missing ${point.symbol}`,
    );
}
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
writeFileSync(
  resolve(process.argv[outIndex + 1]),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(report.summary)}\n`);

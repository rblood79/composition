#!/usr/bin/env node
// ADR-248 G0: freeze known old descendant write semantics before typed paths.
// This source audit does not prove all indirect callers or future graph behavior.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const baselineDir = resolve(root, "docs/adr/design/248-baseline");
const inventory = JSON.parse(
  readFileSync(resolve(baselineDir, "inventory.json"), "utf8"),
);
const astSites = JSON.parse(
  readFileSync(resolve(baselineDir, "descendant-ast-sites.json"), "utf8"),
);
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (head !== inventory.baselineHead)
  throw new Error("Descendant write audit uses another HEAD");

const routes = [
  [
    "apps/builder/src/builder/presentation/editorPresentationCommitAdapter.ts",
    "withCanonicalRefDescendantFills(before.node",
    "live-presentation",
    "fills",
    "patch.visual.fills",
  ],
  [
    "apps/builder/src/builder/presentation/editorPresentationCommitAdapter.ts",
    "withCanonicalRefDescendantStylePatch(",
    "live-presentation",
    "style patch",
    "patch.visual.style",
  ],
  [
    "apps/builder/src/builder/stores/inspectorActions.ts",
    "const slotFillEdit = applyEditToSlotFill(",
    "live-inspector",
    "filled-slot owned node props first",
    "patch owned node inside fillSlot",
  ],
  [
    "apps/builder/src/builder/stores/inspectorActions.ts",
    "next[descendantPath] = merged",
    "live-inspector",
    "synthetic child props/style fallback",
    "patch target props/style",
  ],
  [
    "apps/builder/src/builder/stores/canonical/canonicalDocumentStore.ts",
    "updateDescendant: (refPath, descendantPath, value) =>",
    "old-public-action",
    "raw DescendantOverride",
    "typed patch/replace/fillSlot transaction",
  ],
  [
    "apps/builder/src/builder/components/slotFillEdit.ts",
    "[hostPath]: { ...(entry as Record<string, unknown>), children: next }",
    "live-slot-edit",
    "mode C owned child edit",
    "patch owned child inside fillSlot",
  ],
  [
    "apps/builder/src/adapters/canonical/canonicalRefResolution.ts",
    "[pathKey]: {",
    "old-ref-helper",
    "fills or style",
    "patch target visual",
  ],
  [
    "apps/builder/src/adapters/canonical/canonicalMutations.ts",
    "descendants[slotPath] = {",
    "old-adapter",
    "page slot children",
    "fillSlot ordered child IDs",
  ],
  [
    "apps/builder/src/adapters/canonical/canonicalMutations.ts",
    "descendants: { ...descendants, [path]: replacement }",
    "old-adapter",
    "replace owned descendant node",
    "replace typed addressed node",
  ],
  [
    "apps/builder/src/adapters/canonical/pageFrameBinding.ts",
    "descendants[descendantPath] = {",
    "page-layout",
    "page frame direct child grouping",
    "fillSlot ordered child IDs",
  ],
  [
    "apps/builder/src/adapters/canonical/slotAndLayoutAdapter.ts",
    "descendants[slotPath] = {",
    "page-layout",
    "layout slot projection",
    "fillSlot ordered child IDs",
  ],
  [
    "apps/builder/src/builder/components/collectionItemInsert.ts",
    "descendants[listPath] = {",
    "live-collection-edit",
    "collection item list children",
    "fillSlot ordered child IDs",
  ],
  [
    "apps/builder/src/builder/components/collectionItemInsert.ts",
    "descendants[parentPath] = {",
    "live-collection-edit",
    "selection props on parent",
    "patch target props",
  ],
  [
    "apps/builder/src/builder/components/tableColumnInsert.ts",
    "descendants[path] = { ...entry, children }",
    "live-table-edit",
    "TableHeader column children",
    "fillSlot ordered child IDs",
  ],
  [
    "apps/builder/src/builder/components/stateVariantLayers.ts",
    "descendants[path] = readOwnedPatchKeys(",
    "state-variant",
    "instance-owned patch key layer",
    "resolve precedence; do not persist derived layer",
  ],
  [
    "apps/builder/src/builder/components/stateVariantMigration.ts",
    "descendants[path] = { enabled: true }",
    "old-migration",
    "variant visibility",
    "patch target enabled when actively authored",
  ],
  [
    "apps/builder/src/builder/components/staticCollectionMigration.ts",
    "descendants[key] = {",
    "old-migration",
    "static collection item descendants",
    "retire legacy migration; keep live collection edit",
  ],
  [
    "apps/builder/src/builder/components/migrateDialogTriggerInstances.ts",
    "descendants[LEGACY_DIALOG_CONTENT_ID] = contentProps",
    "old-migration",
    "dialog content props",
    "retire legacy migration; keep named-region edit",
  ],
  [
    "apps/builder/src/builder/components/dialogRegionPaths.ts",
    "descendants[key] = value",
    "named-region",
    "dialog region props/children",
    "typed address patch or fillSlot by payload",
  ],
  [
    "apps/builder/src/builder/components/originChildRefs.ts",
    "descendants: { ...existing, ...additions }",
    "origin-materialization",
    "origin child ref additions",
    "template ownership and typed reference",
  ],
  [
    "apps/builder/src/builder/components/tree/treeTemplateOrigins.ts",
    "descendants: { [TREE_ITEM_LABEL_SEGMENT]: { children: label } }",
    "template-origin",
    "TreeItem label text",
    "typed props.children patch",
  ],
  [
    "apps/builder/src/adapters/canonical/index.ts",
    "roleResult.descendantsRemapped as RefNode",
    "old-adapter",
    "role remapped ref descendants",
    "typed template-node address remap",
  ],
  [
    "apps/builder/src/adapters/canonical/legacyElementSanitizer.ts",
    "descendants: cloneSerializable(canonical.descendants)",
    "old-compatibility",
    "legacy Element projection",
    "retire old Element mirror",
  ],
  [
    "apps/builder/src/adapters/canonical/legacyMetadata.ts",
    "descendants: legacy.descendants",
    "old-compatibility",
    "legacy metadata import",
    "reject old format",
  ],
  [
    "apps/builder/src/builder/panels/canonicalPanelNodes.ts",
    "panelNode.descendants = descendants",
    "derived-panel",
    "panel node projection",
    "derived catalog tree view",
  ],
  [
    "apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts",
    "sceneNode.descendants = refNode.descendants",
    "derived-canvas",
    "ref scene projection",
    "read-only resolved scene",
  ],
  [
    "apps/builder/src/builder/workspace/canvas/scene/canvasSceneNode.ts",
    "descendants: buildRowDescendantsPatch(",
    "derived-canvas",
    "GridList row runtime projection",
    "runtime row identity; never graph write",
  ],
  [
    "apps/builder/src/resolvers/canonical/index.ts",
    "descendants: mergedDescendants",
    "old-resolver",
    "nested own/outer patch precedence",
    "typed path override resolver",
  ],
  [
    "packages/shared/src/schemas/project.schema.ts",
    "descendants: LooseRecordSchema.optional()",
    "old-validator",
    "open descendant object schema",
    "closed typed patch/replace/fillSlot validator",
  ],
  [
    "packages/shared/src/types/pencil-adapter.types.ts",
    "refNode.descendants = descendants",
    "pencil-import",
    "external pen descendant import",
    "new graph import with typed address validation",
  ],
  [
    "packages/shared/src/types/pencil-adapter.types.ts",
    "pencilNode.descendants = descendants",
    "pencil-export",
    "external pen descendant export",
    "new graph export projection",
  ],
  [
    "packages/shared/src/utils/export.utils.ts",
    "descendants: refDescendants",
    "old-export",
    "legacy Element export projection",
    "new graph export without old mirror",
  ],
  [
    "packages/shared/src/utils/compositionDocumentOrder.ts",
    "nextDescendants[descendantPath] = {",
    "shared-order-mutation",
    "mode C child insert/remove/reorder",
    "fillSlot ordered child IDs and inverse",
  ],
  [
    "apps/builder/src/builder/stores/history/canonicalHistoryEvents.ts",
    "nextDescendants[path] = { ...override, children: result.nodes }",
    "history-inverse",
    "old mode C history replay",
    "transaction inverse over owned child IDs",
  ],
  [
    "apps/builder/src/builder/stores/utils/instanceActions.ts",
    "nextLegacyDescendantMap[descendantPath] = nextOverride",
    "live-override-reset",
    "instance descendant override key removal",
    "typed patch remove/mask/reset",
  ],
  [
    "apps/builder/src/builder/stores/canonical/canonicalTraversalHelpers.ts",
    "return { ...refNode, descendants };",
    "old-ref-helper",
    "remove empty override map on history/write",
    "typed graph field deletion",
  ],
  [
    "apps/builder/src/builder/components/groupItemInsert.ts",
    "instanceDescendants[item.path] = {",
    "live-group-item-insert",
    "group single-selection sibling patch",
    "transaction patch owned sibling state",
  ],
];
const rows = routes.map(
  ([path, anchor, family, oldPayload, newResponsibility]) => {
    const source = readFileSync(resolve(root, path), "utf8");
    const at = source.indexOf(anchor);
    if (at < 0) throw new Error(`${path}: missing ${anchor}`);
    return {
      path,
      line: source.slice(0, at).split("\n").length,
      anchor,
      family,
      oldPayload,
      newResponsibility,
      evidence:
        "SOURCE_ANCHOR_ONLY; actual value and indirect caller flow unverified",
    };
  },
);
const coveredPaths = new Set(rows.map((row) => row.path));
const missingInventoryFiles = inventory.descendantAuthoringFiles
  .map((item) => item.path)
  .filter((path) => !coveredPaths.has(path));
if (missingInventoryFiles.length)
  throw new Error(
    `Old explicit writer paths unclassified: ${missingInventoryFiles.join(", ")}`,
  );
const missingAstFiles = [
  ...new Set(astSites.sites.map((site) => site.path)),
].filter((path) => !coveredPaths.has(path));
if (missingAstFiles.length)
  throw new Error(
    `AST descendant candidate paths unclassified: ${missingAstFiles.join(", ")}`,
  );
const report = {
  head,
  status:
    "KNOWN_SOURCE_WRITES_CLASSIFIED; indirect callers and value flow UNVERIFIED",
  precedence: [
    "Inspector synthetic child edit first targets an instance-owned node within mode C fillSlot children",
    "If no mode C owner is found, it writes a mode A descendant props/style patch",
    "Presentation fills/style edits target the resolved ref child path; direct node edits use the node root",
    "State variant derived layers omit instance-owned keys, so explicit instance values win at that layer",
  ],
  summary: {
    routes: rows.length,
    paths: coveredPaths.size,
    explicitInventoryPathsCovered: inventory.descendantAuthoringFiles.length,
    astCandidateSites: astSites.sites.length,
    astCandidateFilesCovered: astSites.summary.candidateFiles,
    missingInventoryFiles,
    missingAstFiles,
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

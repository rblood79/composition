#!/usr/bin/env node
// ADR-248 G0: connect every active descendant AST route to its old reader.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const dir = resolve(root, "docs/adr/design/248-baseline");
const disposition = JSON.parse(
  readFileSync(resolve(dir, "descendant-site-disposition.json"), "utf8"),
);
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
if (head !== disposition.head) throw new Error("Descendant site HEAD drift");
const routeOracle = JSON.parse(
  readFileSync(resolve(dir, "descendant-route-oracle.json"), "utf8"),
);
const routeOracleHash = createHash("sha256")
  .update(JSON.stringify(routeOracle.scenario))
  .digest("hex");
if (
  routeOracle.head !== head ||
  routeOracle.scenarioHash !== routeOracleHash ||
  !routeOracle.executionBuildIdentity?.startsWith("dev-source:") ||
  routeOracle.errors?.length
)
  throw new Error("Old descendant route oracle identity/output invalid");
const routeOutput = routeOracle.oldOutput;
const routeOutputKeys = {
  "collection-item-insert": "collection",
  "element-mutation": "publicReorderHistory",
  "group-item-insert": "group",
  "history-inverse": "historyInverse",
  "page-binding": "pageBinding",
  "slot-owned-edit": "slotOwnedEdit",
  "structural-order": "structural",
  "table-column-insert": "table",
};
for (const [id, key] of Object.entries(routeOutputKeys)) {
  if (!routeOutput[key]?.writer || !routeOutput[key]?.reader)
    throw new Error(`${id}: old writer/reader output missing`);
}
const anchor = (path, text) => {
  const lines = readFileSync(resolve(root, path), "utf8").split("\n");
  const matches = lines.flatMap((line, index) =>
    line.includes(text) ? [index + 1] : [],
  );
  if (matches.length === 0)
    throw new Error(`Source anchor missing: ${path} ${text}`);
  return { path, line: matches[0], needle: text };
};
const b = "apps/builder/src/builder/";
const c = "apps/builder/src/adapters/canonical/";
const reader = anchor(
  "apps/builder/src/resolvers/canonical/index.ts",
  "refNode.descendants,",
);
const row = (
  id,
  caller,
  writer,
  oldReader = reader,
  oldOracle = null,
  access = "public command",
) => ({
  id,
  caller: anchor(...caller),
  writer: anchor(...writer),
  oldReader,
  oldOracle,
  oracleStatus: oldOracle
    ? "OLD_OUTPUT_FROZEN_FOR_ROUTE_SAMPLE"
    : "SOURCE_CHAIN_ONLY; OLD_OUTPUT_NOT_FROZEN",
  access,
});
const routes = [
  row(
    "canonical-actions",
    [`${b}stores/canonical/canonicalDocumentStore.ts`, "updateDescendant: ("],
    [
      `${b}stores/canonical/canonicalDocumentStore.ts`,
      "nextDescendants[descendantPath] = value",
    ],
    reader,
    "descendant-active/baseline.json",
    "public store command; no current panel caller",
  ),
  row(
    "collection-item-insert",
    [
      `${b}panels/properties/ComponentSlotFillSection.tsx`,
      "planTabItemInsert({",
    ],
    [
      `${b}components/collectionItemInsert.ts`,
      "export function planTabItemInsert(",
    ],
    reader,
    "descendant-route-oracle.json",
    "UI planner → isolated old resolver",
  ),
  row(
    "element-mutation",
    [`${b}stores/elements.ts`, "moveElementCanonicalPrimary("],
    [
      `${c}canonicalMutations.ts`,
      "export function moveElementCanonicalPrimary(",
    ],
    reader,
    "descendant-route-oracle.json",
    "public reorder/Undo/Redo plus isolated descendant move",
  ),
  row(
    "group-item-insert",
    [`${b}panels/properties/FrameSlotSection.tsx`, "planGroupItemInsert({"],
    [`${b}components/groupItemInsert.ts`, "instanceDescendants[item.path] ="],
    reader,
    "descendant-route-oracle.json",
    "UI planner → isolated old resolver",
  ),
  row(
    "history-inverse",
    [
      `${b}stores/history/historyActions.ts`,
      "applyCanonicalHistoryEventsToActiveDocument(",
    ],
    [
      `${b}stores/history/canonicalHistoryEvents.ts`,
      "applyCanonicalHistoryEventsToDocument(",
    ],
    reader,
    "descendant-route-oracle.json",
    "public reorder/Undo/Redo plus isolated inverse replay",
  ),
  row(
    "inspector-child-edit",
    [
      `${b}panels/properties/ItemSlotRolesSection.tsx`,
      "updateSelectedPropertiesWithChildren({}, [update]",
    ],
    [`${b}stores/inspectorActions.ts`, "buildInstanceDescendantPatches("],
    reader,
    "descendant-active/baseline.json",
  ),
  row(
    "page-binding",
    [
      `${b}panels/properties/editors/PageLayoutSelector.tsx`,
      "applyPageFrameBindingFromSelection({",
    ],
    [`${c}pageFrameBinding.ts`, "descendants: rebuiltDescendants"],
    reader,
    "descendant-route-oracle.json",
    "page-binding adapter → old resolver, IDB, refresh",
  ),
  row(
    "presentation-fills",
    [`${b}panels/styles/hooks/useFillActions.ts`, "handle.finish"],
    [
      `${b}presentation/editorPresentationCommitAdapter.ts`,
      "withCanonicalRefDescendantFills(",
    ],
    reader,
    "descendant-active/baseline.json",
    "UI hook → isolated commit boundary",
  ),
  row(
    "presentation-style",
    [`${b}panels/styles/hooks/useStylePresentationActions.ts`, "handle.finish"],
    [
      `${b}presentation/editorPresentationCommitAdapter.ts`,
      "withCanonicalRefDescendantStylePatch(",
    ],
    reader,
    "descendant-active/baseline.json",
    "UI hook → isolated commit boundary",
  ),
  row(
    "reset-override",
    [
      `${b}panels/properties/ComponentSemanticsSection.tsx`,
      "resetInstanceOverrideField(elementId",
    ],
    [
      `${b}stores/utils/instanceActions.ts`,
      "export function resetInstanceOverrideField(",
    ],
    reader,
    "descendant-active/baseline.json",
    "public store command after isolated presentation commit",
  ),
  row(
    "slot-owned-edit",
    [`${b}stores/inspectorActions.ts`, "applyEditToSlotFill("],
    [`${b}components/slotFillEdit.ts`, "export function applyEditToSlotFill("],
    reader,
    "descendant-route-oracle.json",
    "public store caller → isolated old writer and resolver",
  ),
  row(
    "structural-order",
    [`${b}stores/canonical/canonicalDocumentStore.ts`, "insertCanonicalChild("],
    [
      "packages/shared/src/utils/compositionDocumentOrder.ts",
      "export function insertCanonicalChild(",
    ],
    reader,
    "descendant-route-oracle.json",
    "old order kernel → isolated old resolver",
  ),
  row(
    "table-column-insert",
    [
      `${b}panels/properties/ComponentSlotFillSection.tsx`,
      "planTableColumnInsert({",
    ],
    [
      `${b}components/tableColumnInsert.ts`,
      "descendants[path] = { ...entry, children };",
    ],
    reader,
    "descendant-route-oracle.json",
    "UI planner → isolated old resolver",
  ),
];
const active = disposition.summary.activeRoutes;
if (
  routes.length !== active.length ||
  routes.some((item) => !active.includes(item.id))
)
  throw new Error("Active route set and source chains differ");
const report = {
  head,
  status: "ALL_ACTIVE_ROUTES_SOURCE_LINKED; OUTPUT_SCOPE_EXPLICIT",
  summary: {
    astWriteSites: disposition.summary.writeSites,
    astDirectCalls: disposition.summary.directCalls,
    classifiedSites: disposition.summary.totalSites,
    activeRoutes: routes.length,
    routesWithOldOutputSample: routes.filter((item) => item.oldOracle).length,
    routesWithWriterAndReaderOutput: routes.filter(
      (item) => item.oracleStatus === "OLD_OUTPUT_FROZEN_FOR_ROUTE_SAMPLE",
    ).length,
    sourceOnlyRoutes: routes
      .filter((item) => !item.oldOracle)
      .map((item) => item.id),
  },
  routes,
};
const index = process.argv.indexOf("--out");
if (index < 0 || !process.argv[index + 1])
  throw new Error("--out requires path");
writeFileSync(
  resolve(process.argv[index + 1]),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(report.summary)}\n`);

#!/usr/bin/env node
// ADR-248 G0: concrete old UI-to-descendant edges and input precedence scope.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const dir = resolve(root, "docs/adr/design/248-baseline");
const read = (name) => JSON.parse(readFileSync(resolve(dir, name), "utf8"));
const head = execFileSync("git", ["rev-parse", "HEAD"], {
  cwd: root,
  encoding: "utf8",
}).trim();
const direct = read("descendant-caller-audit.json");
const precedence = read("descendant-precedence.json");
if (direct.head !== head || precedence.head !== head)
  throw new Error("Descendant evidence HEAD drift");
const anchor = (path, needle) => {
  const source = readFileSync(resolve(root, path), "utf8");
  const offset = source.indexOf(needle);
  if (offset < 0) throw new Error(`${path}: missing ${needle}`);
  return { path, line: source.slice(0, offset).split("\n").length, needle };
};
const p = "apps/builder/src/builder/";
const routes = [
  {
    id: "properties-semantic-child",
    anchors: [
      anchor(
        `${p}panels/properties/PropertiesPanel.tsx`,
        "dispatchSemanticUpdateWithPropagation({",
      ),
      anchor(
        `${p}panels/properties/semanticUpdateDispatch.ts`,
        "actions.updateSelectedPropertiesWithChildren(",
      ),
      anchor(
        `${p}stores/inspectorActions.ts`,
        "updateSelectedPropertiesWithChildren: (properties, childUpdates) =>",
      ),
      anchor(
        `${p}stores/inspectorActions.ts`,
        "const descendantPatches = buildInstanceDescendantPatches(root, [",
      ),
      anchor(
        `${p}stores/inspectorActions.ts`,
        "const slotFillEdit = applyEditToSlotFill(",
      ),
      anchor(`${p}stores/inspectorActions.ts`, "next[descendantPath] = merged"),
    ],
    result:
      "mode C owner array edit first; if absent mode A props/style merge; old public input requires selected synthetic child",
    runtimeOutput:
      "descendant-precedence.json#oldOutput.modeC and oldOutput.noOwnedSlotFallback",
  },
  {
    id: "slot-role-toggle",
    anchors: [
      anchor(
        `${p}panels/properties/ItemSlotRolesSection.tsx`,
        "state.updateSelectedPropertiesWithChildren({}, [update] as never)",
      ),
      anchor(
        `${p}stores/inspectorActions.ts`,
        "updateSelectedPropertiesWithChildren: (properties, childUpdates) =>",
      ),
      anchor(
        `${p}stores/inspectorActions.ts`,
        "const slotFillEdit = applyEditToSlotFill(",
      ),
    ],
    result:
      "same mode C then mode A branch, depending on selected instance and owned slot path",
    runtimeOutput: null,
  },
  {
    id: "presentation-ref-fills",
    anchors: [
      anchor(
        `${p}panels/styles/hooks/useFillActions.ts`,
        "commitFirstFillColorPresentation = useCallback(",
      ),
      anchor(
        `${p}panels/styles/hooks/useFillActions.ts`,
        "const result = presentation.handle.finish({",
      ),
      anchor(
        `${p}presentation/editorPresentationCommitAdapter.ts`,
        "? commitEditorPresentationFills(input)",
      ),
      anchor(
        `${p}presentation/editorPresentationCommitAdapter.ts`,
        "export function commitEditorPresentationFills(",
      ),
      anchor(
        `${p}presentation/editorPresentationCommitAdapter.ts`,
        "withCanonicalRefDescendantFills(before.node, target.pathKey, nextFills)",
      ),
    ],
    result:
      "resolved ref descendant target receives fills; direct node target takes separate branch",
    runtimeOutput: null,
  },
  {
    id: "presentation-ref-style",
    anchors: [
      anchor(
        `${p}panels/styles/hooks/useStylePresentationActions.ts`,
        "commitBorderColorPresentation = useCallback(",
      ),
      anchor(
        `${p}panels/styles/hooks/useStylePresentationActions.ts`,
        "const result = presentation.handle.finish({",
      ),
      anchor(
        `${p}presentation/editorPresentationCommitAdapter.ts`,
        ": commitEditorPresentationStyle(input)",
      ),
      anchor(
        `${p}presentation/editorPresentationCommitAdapter.ts`,
        "export function commitEditorPresentationStyle(",
      ),
      anchor(
        `${p}presentation/editorPresentationCommitAdapter.ts`,
        "withCanonicalRefDescendantStylePatch(",
      ),
    ],
    result:
      "resolved ref descendant target receives style patch; direct node target takes separate branch",
    runtimeOutput: null,
  },
  {
    id: "public-canonical-descendant",
    anchors: [
      anchor(
        `${p}stores/canonical/canonicalDocumentStore.ts`,
        "updateDescendant: (refPath, descendantPath, value) =>",
      ),
      anchor(
        "apps/builder/src/resolvers/canonical/index.ts",
        "refNode.descendants as Record<string, unknown> | undefined",
      ),
    ],
    result:
      "old public command writes ref path; old resolver exposes patched child text",
    runtimeOutput: "core-active-flow/baseline.json#reader.refResolved.labels",
  },
];
const inputs = [
  {
    input: "mode A props/style override",
    result: "patched text; style deep merge; enabled false",
    output: "descendant-precedence.json#oldOutput.modeA",
  },
  {
    input: "mode C owned slot child",
    result: "owned text edited; outer mode A patch shadowed",
    output: "descendant-precedence.json#oldOutput.modeC",
  },
  {
    input: "mode C owner absent",
    result: "caller falls back to mode A",
    output: "descendant-precedence.json#oldOutput.noOwnedSlotFallback",
  },
  {
    input: "mask then set on same path",
    result: "last text wins; null color tombstone removed on application",
    output:
      "descendant-precedence.json#oldOutput.composed and oldOutput.applied",
  },
  {
    input: "replace or fillSlot passed to old props patch API",
    result: "rejected",
    output: "descendant-precedence.json#oldOutput.rejected",
  },
  {
    input: "direct old Builder updateDescendant Label text",
    result: "G0 label after reader and refresh",
    output: "core-active-flow/baseline.json#reader.refResolved.labels",
  },
];
const report = {
  head,
  status:
    "SELECTED_TRANSITIVE_ROUTES_AND_INPUTS_FROZEN; ALL_UI_BRANCHES_NOT_VERIFIED",
  summary: {
    astWriteSites: direct.summary.writeSites,
    astDirectCalls: direct.summary.directCalls,
    tracedTransitiveRoutes: routes.length,
    inputsWithRuntimeResult: inputs.length,
    routesWithoutRuntimeOutput: routes
      .filter((route) => !route.runtimeOutput)
      .map((route) => route.id),
  },
  routes,
  inputs,
  remaining: [
    "slot-role toggle, presentation fills/style and nested mode C paths need public command and Canvas output",
    "115 write sites and 40 direct calls are an AST inventory; this five-route sample is not complete transitive reachability",
    "responsive, enabled, sizing, fill and nested-ref precedence combinations are not covered by one pure fixture",
  ],
};
const outIndex = process.argv.indexOf("--out");
if (outIndex < 0 || !process.argv[outIndex + 1])
  throw new Error("--out requires path");
writeFileSync(
  resolve(process.argv[outIndex + 1]),
  `${JSON.stringify(report, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(report.summary)}\n`);
